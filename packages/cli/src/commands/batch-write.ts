import { Command } from "commander";
import { PipelineRunner, StateManager } from "@actalk/inkos-core";
import { loadConfig, buildPipelineConfig, findProjectRoot, resolveBookId, resolveContext, log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { formatWriteNextProgress, formatWriteNextResultLines, resolveCliLanguage } from "../localization.js";

interface BatchChapterResult {
  chapterNumber: number;
  title: string;
  wordCount: number;
  auditPassed: boolean;
  revised: boolean;
  status: string;
  issues: readonly unknown[];
}

interface BatchWriteResult {
  bookId: string;
  totalRequested: number;
  succeeded: number;
  failed: number;
  stoppedEarly: boolean;
  stopReason: string | null;
  chapters: BatchChapterResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const batchWriteCommand = new Command("batch-write")
  .description("Generate multiple chapters in sequence")
  .argument("[book-id]", "Book ID (auto-detected if only one book)")
  .requiredOption("--count <n>", "Number of chapters to write")
  .option("--start <n>", "Starting chapter number (overrides auto-detection)")
  .option("--delay <ms>", "Delay between chapters in milliseconds", "5000")
  .option("--stop-on-failure", "Stop if a chapter fails (default: true)")
  .option("--no-stop-on-failure", "Continue writing even if a chapter fails")
  .option("--words <n>", "Words per chapter (overrides book config)")
  .option("--context <text>", "Creative guidance (natural language)")
  .option("--context-file <path>", "Read guidance from file")
  .option("--json", "Output JSON")
  .option("-q, --quiet", "Suppress console output")
  .action(async (bookIdArg: string | undefined, opts) => {
    try {
      const root = findProjectRoot();
      const bookId = await resolveBookId(bookIdArg, root);
      const context = await resolveContext(opts);
      const state = new StateManager(root);
      const book = await state.loadBookConfig(bookId);
      const language = resolveCliLanguage(book.language);
      const config = await loadConfig();

      const pipeline = new PipelineRunner(buildPipelineConfig(config, root, { externalContext: context, quiet: opts.quiet }));

      const totalCount = parseInt(opts.count, 10);
      const delayMs = parseInt(opts.delay, 10);
      const stopOnFailure = opts.stopOnFailure !== false;
      const wordCount = opts.words ? parseInt(opts.words, 10) : undefined;

      const succeeded: BatchChapterResult[] = [];
      const failed: { chapterNumber: number; error: string }[] = [];
      let stoppedEarly = false;
      let stopReason: string | null = null;

      for (let i = 0; i < totalCount; i++) {
        if (!opts.json) log(formatWriteNextProgress(language, i + 1, totalCount, bookId));

        try {
          const result = await pipeline.writeNextChapter(bookId, wordCount);

          const chapterResult: BatchChapterResult = {
            chapterNumber: result.chapterNumber,
            title: result.title,
            wordCount: result.wordCount,
            auditPassed: result.auditResult.passed,
            revised: result.revised,
            status: result.status,
            issues: result.auditResult.issues,
          };
          succeeded.push(chapterResult);

          if (!opts.json) {
            for (const line of formatWriteNextResultLines(language, {
              chapterNumber: result.chapterNumber,
              title: result.title,
              wordCount: result.wordCount,
              auditPassed: result.auditResult.passed,
              revised: result.revised,
              status: result.status,
              issues: result.auditResult.issues,
            })) {
              log(line);
            }
            log("");
          }

          // Stop on state-degraded
          if (result.status === "state-degraded") {
            stoppedEarly = true;
            stopReason = language === "en"
              ? "State repair required before continuing."
              : "需要先修复 state，已停止后续连写。";
            if (!opts.json) log(stopReason);
            break;
          }
        } catch (e) {
          const errorMsg = String(e);
          failed.push({
            chapterNumber: (succeeded.length > 0 ? succeeded[succeeded.length - 1]!.chapterNumber + 1 : i + 1),
            error: errorMsg,
          });

          if (!opts.json) {
            logError(`Chapter ${i + 1} failed: ${errorMsg}`);
          }

          if (stopOnFailure) {
            stoppedEarly = true;
            stopReason = `Chapter failed: ${errorMsg}`;
            break;
          }
        }

        // Delay between chapters (skip after the last one)
        if (i < totalCount - 1 && delayMs > 0) {
          if (!opts.json) log(`Waiting ${delayMs / 1000}s before next chapter...`);
          await sleep(delayMs);
        }
      }

      const batchResult: BatchWriteResult = {
        bookId,
        totalRequested: totalCount,
        succeeded: succeeded.length,
        failed: failed.length,
        stoppedEarly,
        stopReason,
        chapters: succeeded,
      };

      if (opts.json) {
        log(JSON.stringify({ ...batchResult, failed }, null, 2));
      } else {
        log("");
        log("=".repeat(50));
        log(language === "en" ? "Batch Write Summary" : "批量写作总结");
        log("=".repeat(50));
        log(`  Book: ${bookId}`);
        log(`  Requested: ${totalCount}`);
        log(`  Succeeded: ${succeeded.length}`);
        log(`  Failed: ${failed.length}`);
        if (stoppedEarly) {
          log(`  Stopped early: ${stopReason}`);
        }
        log("=".repeat(50));
      }
    } catch (e) {
      handleCLIError(e, { json: opts.json, command: "batch-write" });
    }
  });
