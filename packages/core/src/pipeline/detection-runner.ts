/**
 * Detection pipeline runner — handles detection, auto-rewrite loop, and history tracking.
 * Extracted from runner.ts to keep runner under 800 lines.
 */

import type { DetectionConfig } from "../models/project.js";
import type { DetectionHistoryEntry } from "../models/detection.js";
import type { AgentContext } from "../agents/base.js";
import { detectAIContent, type DetectionResult } from "../agents/detector.js";
import { ReviserAgent } from "../agents/reviser.js";
import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface DetectChapterResult {
  readonly chapterNumber: number;
  readonly detection: DetectionResult;
  readonly passed: boolean;
}

export interface DetectAndRewriteResult {
  readonly chapterNumber: number;
  readonly originalScore: number;
  readonly finalScore: number;
  readonly attempts: number;
  readonly passed: boolean;
  readonly finalContent: string;
}

/** Run detection on a single chapter's content. */
export async function detectChapter(
  config: DetectionConfig,
  content: string,
  chapterNumber: number,
): Promise<DetectChapterResult> {
  const detection = await detectAIContent(config, content);
  return {
    chapterNumber,
    detection,
    passed: detection.score <= config.threshold,
  };
}

/**
 * Detect-and-rewrite loop: detect → revise in anti-detect mode → re-detect,
 * until score passes threshold or max retries reached.
 */
export async function detectAndRewrite(
  config: DetectionConfig,
  ctx: AgentContext,
  bookDir: string,
  content: string,
  chapterNumber: number,
  genre?: string,
): Promise<DetectAndRewriteResult> {
  const maxRetries = config.maxRetries;

  // Phase 5.4: 本地困惑度分析器（纯程序化，无 LLM），用于与外部检测分数对比
  const perplexityAnalyzer = new PerplexityAnalyzer();

  let currentContent = content;

  // 本地 perplexity 预分析（首次检测前）
  logLocalPerplexity(ctx, perplexityAnalyzer, currentContent, chapterNumber, 0);

  const firstDetection = await detectAIContent(config, currentContent);
  const originalScore = firstDetection.score;

  if (firstDetection.score <= config.threshold) {
    await recordHistory(bookDir, {
      chapterNumber,
      timestamp: firstDetection.detectedAt,
      provider: firstDetection.provider,
      score: firstDetection.score,
      action: "detect",
      attempt: 0,
    });
    return {
      chapterNumber,
      originalScore,
      finalScore: firstDetection.score,
      attempts: 0,
      passed: true,
      finalContent: currentContent,
    };
  }

  let finalScore = firstDetection.score;
  let attempts = 0;

  for (let i = 0; i < maxRetries; i++) {
    attempts = i + 1;

    // Rewrite in anti-detect mode
    const reviser = new ReviserAgent(ctx);
    const reviseOutput = await reviser.reviseChapter(
      bookDir,
      currentContent,
      chapterNumber,
      [{
        severity: "warning",
        category: "AIGC检测",
        description: `AI检测分数 ${finalScore.toFixed(2)} 超过阈值 ${config.threshold}`,
        suggestion: "降低AI生成痕迹：增加段落长度差异、减少套话、用口语化表达替代书面语",
      }],
      "anti-detect",
      genre,
    );

    if (reviseOutput.revisedContent.length === 0) break;
    currentContent = reviseOutput.revisedContent;

    // 本地 perplexity 预分析（重检测前）
    logLocalPerplexity(ctx, perplexityAnalyzer, currentContent, chapterNumber, attempts);

    // Re-detect
    const reDetection = await detectAIContent(config, currentContent);
    finalScore = reDetection.score;

    // 记录本地与外部检测分数对比
    ctx.logger?.info(
      `[detection] chapter ${chapterNumber} attempt ${attempts} | external score=${finalScore.toFixed(2)} | threshold=${config.threshold}`,
    );

    await recordHistory(bookDir, {
      chapterNumber,
      timestamp: reDetection.detectedAt,
      provider: reDetection.provider,
      score: reDetection.score,
      action: "rewrite",
      attempt: attempts,
    });

    if (finalScore <= config.threshold) break;
  }

  return {
    chapterNumber,
    originalScore,
    finalScore,
    attempts,
    passed: finalScore <= config.threshold,
    finalContent: currentContent,
  };
}

/**
 * 运行本地 perplexity 分析并记录日志，用于与外部检测分数对比。
 * 纯程序化分析，失败只记录 debug 日志，不阻断检测流程。
 */
function logLocalPerplexity(
  ctx: AgentContext,
  analyzer: PerplexityAnalyzer,
  content: string,
  chapterNumber: number,
  attempt: number,
): void {
  try {
    const localAnalysis = analyzer.analyze(content);
    ctx.logger?.info(
      `[perplexity] chapter ${chapterNumber} attempt ${attempt} | local perplexity=${localAnalysis.perplexity.toFixed(2)} burstiness=${localAnalysis.burstiness.toFixed(2)} vocabDiversity=${localAnalysis.vocabularyDiversity.toFixed(2)} isAI=${localAnalysis.isAIGenerated} confidence=${localAnalysis.confidence.toFixed(2)}`,
    );
  } catch (e) {
    ctx.logger?.debug(`[perplexity] local analysis failed: ${e}`);
  }
}

/** Append an entry to detection_history.json. */
async function recordHistory(
  bookDir: string,
  entry: DetectionHistoryEntry,
): Promise<void> {
  const historyPath = join(bookDir, "story", "detection_history.json");
  let history: DetectionHistoryEntry[] = [];

  try {
    const raw = await readFile(historyPath, "utf-8");
    history = JSON.parse(raw);
  } catch {
    // File doesn't exist yet
  }

  history.push(entry);

  await mkdir(join(bookDir, "story"), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

/** Load detection history from disk. */
export async function loadDetectionHistory(
  bookDir: string,
): Promise<ReadonlyArray<DetectionHistoryEntry>> {
  const historyPath = join(bookDir, "story", "detection_history.json");
  try {
    const raw = await readFile(historyPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
