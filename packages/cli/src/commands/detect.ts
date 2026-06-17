import { Command } from "commander";
import {
  StateManager,
  detectChapter,
  loadDetectionHistory,
  analyzeDetectionInsights,
  createLogger,
  createStderrSink,
  type DetectionConfig,
} from "@actalk/inkos-core";
import { DualDetector, detectVoiceStyle, type VoiceProfile } from "@actalk/inkos-core";
import { loadConfig, buildPipelineConfig, findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const detectCommand = new Command("detect")
  .description("Run AIGC detection on chapters")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .argument("[chapter]", "Chapter number (defaults to latest)")
  .option("--all", "Detect all chapters")
  .option("--stats", "Show detection statistics")
  .option("--local", "Use local pattern detection (no API required)")
  .option("--voice <profile>", "Voice profile for detection (casual|professional|warm|blunt|literary|webnovel)")
  .option("--fix", "Auto-fix detected issues (requires --local)")
  .option("--json", "Output JSON")
  .action(async (bookIdArg: string | undefined, chapterStr: string | undefined, opts) => {
    try {
      const config = await loadConfig();
      const root = findProjectRoot();

      if (!config.detection?.enabled) {
        logError("AIGC detection is not enabled. Add detection config to inkos.json.");
        process.exit(1);
      }

      // If first arg looks like a number, treat it as chapter
      let bookId: string;
      let chapterNumber: number | undefined;
      if (bookIdArg && /^\d+$/.test(bookIdArg)) {
        bookId = await resolveBookId(undefined, root);
        chapterNumber = parseInt(bookIdArg, 10);
      } else {
        bookId = await resolveBookId(bookIdArg, root);
        chapterNumber = chapterStr ? parseInt(chapterStr, 10) : undefined;
      }

      const state = new StateManager(root);
      const bookDir = state.bookDir(bookId);

      if (opts.stats) {
        const history = await loadDetectionHistory(bookDir);
        const stats = analyzeDetectionInsights(history);
        if (opts.json) {
          log(JSON.stringify(stats, null, 2));
        } else {
          log(`Detection Statistics:`);
          log(`  Total detections: ${stats.totalDetections}`);
          log(`  Total rewrites: ${stats.totalRewrites}`);
          log(`  Avg original score: ${stats.avgOriginalScore.toFixed(3)}`);
          log(`  Avg final score: ${stats.avgFinalScore.toFixed(3)}`);
          log(`  Avg score reduction: ${stats.avgScoreReduction.toFixed(3)}`);
          log(`  Pass rate: ${(stats.passRate * 100).toFixed(0)}%`);
          if (stats.chapterBreakdown.length > 0) {
            log(`  Chapters:`);
            for (const ch of stats.chapterBreakdown) {
              log(`    Ch.${ch.chapterNumber}: ${ch.originalScore.toFixed(3)} → ${ch.finalScore.toFixed(3)} (${ch.rewriteAttempts} rewrites)`);
            }
          }
        }
        return;
      }

      // 本地模式检测（不需要 API）
      if (opts.local) {
        const targetChapter = chapterNumber ?? (await state.getNextChapterNumber(bookId)) - 1;
        if (targetChapter < 1) {
          logError("No chapters to detect.");
          process.exit(1);
        }

        const content = await readChapterContent(bookDir, targetChapter);
        const pipelineConfig = buildPipelineConfig(config, root);

        // 创建 logger
        const logger = createLogger({ tag: "detect", sinks: [createStderrSink({})] });

        const dualDetector = new DualDetector({
          client: null as any, // 本地检测不需要 LLM
          model: '',
          projectRoot: root,
          bookId,
          logger,
        });

        if (opts.fix) {
          // 检测并修复
          const report = await dualDetector.detect(content, {
            voiceProfile: opts.voice as VoiceProfile | undefined,
            enableSecondPass: true,
          });

          if (opts.json) {
            log(JSON.stringify(report, null, 2));
          } else {
            log(`\n🔍 本地 AI 检测结果 (章节 ${targetChapter}):\n`);
            log(`  原始 AI 分数: ${report.score}/100`);
            log(`  第一轮修复: ${report.firstPassIssues.length} 个问题`);
            log(`  第二轮残留: ${report.secondPassIssues.length} 个问题`);
            log(`  检测到的风格: ${report.detectedStyle || '未知'}`);

            if (report.firstPassIssues.length > 0) {
              log(`\n📋 第一轮发现的问题:`);
              for (const issue of report.firstPassIssues.slice(0, 10)) {
                log(`  - [Tier ${issue.tier}] ${issue.matchedText} → ${issue.suggestion || '移除'}`);
              }
              if (report.firstPassIssues.length > 10) {
                log(`  ... 还有 ${report.firstPassIssues.length - 10} 个问题`);
              }
            }

            if (report.rewritten !== content) {
              log(`\n✅ 已自动修复，请检查修订后的内容`);
            } else {
              log(`\n✅ 未检测到需要修复的 AI 痕迹`);
            }
          }
        } else {
          // 仅检测
          const issues = await dualDetector.detectOnly(content);

          if (opts.json) {
            log(JSON.stringify({ chapterNumber: targetChapter, issues }, null, 2));
          } else {
            log(`\n🔍 本地 AI 检测结果 (章节 ${targetChapter}):\n`);

            // 按 tier 分组
            const tier1 = issues.filter(i => i.tier === 1);
            const tier2 = issues.filter(i => i.tier === 2);
            const tier3 = issues.filter(i => i.tier === 3);

            log(`  Tier 1 (必改): ${tier1.length} 个`);
            log(`  Tier 2 (聚类时改): ${tier2.length} 个`);
            log(`  Tier 3 (高密度时改): ${tier3.length} 个`);
            log(`  总计: ${issues.length} 个`);

            if (tier1.length > 0) {
              log(`\n⚠️ 高优先级问题 (Tier 1):`);
              for (const issue of tier1.slice(0, 5)) {
                log(`  - "${issue.matchedText}" → "${issue.suggestion || '移除'}"`);
              }
            }
          }
        }
        return;
      }

      const detectionConfig = config.detection as DetectionConfig;

      if (opts.all) {
        const index = await state.loadChapterIndex(bookId);
        for (const ch of index) {
          const content = await readChapterContent(bookDir, ch.number);
          const result = await detectChapter(detectionConfig, content, ch.number);
          printResult(result, opts.json);
        }
      } else {
        const targetChapter = chapterNumber ?? (await state.getNextChapterNumber(bookId)) - 1;
        if (targetChapter < 1) {
          logError("No chapters to detect.");
          process.exit(1);
        }
        const content = await readChapterContent(bookDir, targetChapter);
        const result = await detectChapter(detectionConfig, content, targetChapter);
        printResult(result, opts.json);
      }
    } catch (e) {
      handleCLIError(e, { json: opts.json, command: "detect" });
    }
  });

function printResult(
  result: { chapterNumber: number; detection: { score: number; provider: string }; passed: boolean },
  json: boolean,
): void {
  if (json) {
    log(JSON.stringify(result, null, 2));
  } else {
    const icon = result.passed ? "✅" : "⚠️";
    log(`  ${icon} Chapter ${result.chapterNumber}: score=${result.detection.score.toFixed(3)} (${result.detection.provider}) ${result.passed ? "PASS" : "FAIL"}`);
  }
}

async function readChapterContent(bookDir: string, chapterNumber: number): Promise<string> {
  const chaptersDir = join(bookDir, "chapters");
  const files = await readdir(chaptersDir);
  const paddedNum = String(chapterNumber).padStart(4, "0");
  const chapterFile = files.find((f) => f.startsWith(paddedNum) && f.endsWith(".md"));
  if (!chapterFile) {
    throw new Error(`Chapter ${chapterNumber} file not found`);
  }
  const raw = await readFile(join(chaptersDir, chapterFile), "utf-8");
  const lines = raw.split("\n");
  const contentStart = lines.findIndex((l, i) => i > 0 && l.trim().length > 0);
  return contentStart >= 0 ? lines.slice(contentStart).join("\n") : raw;
}
