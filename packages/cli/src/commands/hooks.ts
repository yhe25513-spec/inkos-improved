import { Command } from "commander";
import { PipelineRunner, StateManager, analyzeAllHooksPressure, formatPressureReportMarkdown, parsePendingHooksMarkdown } from "@actalk/inkos-core";
import { loadConfig, buildPipelineConfig, findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 伏笔管理命令
 * 提供伏笔状态查看、压力分析、回收标记等功能
 */
export const hooksCommand = new Command("hooks")
  .description("伏笔管理 / Hook management")
  .addCommand(
    new Command("status")
      .description("查看所有伏笔状态 / View all hook status")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .option("--json", "JSON 格式输出 / JSON output")
      .action(async (bookIdArg: string | undefined, opts) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new StateManager(root);
          const bookDir = state.bookDir(bookId);

          log("🪝 正在查看伏笔状态...\n");

          // 读取伏笔数据
          const hooksPath = join(bookDir, "story", "pending_hooks.md");
          const hooksContent = await readFile(hooksPath, "utf-8").catch(() => "");

          // 解析伏笔
          const hooks = parsePendingHooksMarkdown(hooksContent);

          // 统计伏笔状态
          const activeHooks = hooks.filter(h => h.status === "open" || h.status === "progressing").length;
          const staleHooks = hooks.filter(h => h.status === "stale").length;
          const resolvedHooks = hooks.filter(h => h.status === "resolved").length;

          if (opts.json) {
            log(JSON.stringify({ hooks, activeHooks, staleHooks, resolvedHooks }, null, 2));
          } else {
            log(`📊 伏笔概览`);
            log(`  活跃伏笔: ${activeHooks}`);
            log(`  过期伏笔: ${staleHooks}`);
            log(`  已回收: ${resolvedHooks}`);
            log(`  总计: ${hooks.length}`);
            log("");

            // 显示详细的伏笔列表
            log("💡 使用 inkos hooks pressure 查看需要处理的伏笔");
            log("💡 使用 inkos hooks list 查看所有伏笔详情");
          }
        } catch (e) {
          handleCLIError(e, { json: opts.json, command: "hooks status" });
        }
      })
  )
  .addCommand(
    new Command("pressure")
      .description("查看需要处理的伏笔 / View hooks needing attention")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .option("-n, --limit <number>", "显示数量 / Number to show", "5")
      .option("--json", "JSON 格式输出 / JSON output")
      .option("--output <file>", "输出报告到文件 / Output report to file")
      .action(async (bookIdArg: string | undefined, opts) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new StateManager(root);
          const bookDir = state.bookDir(bookId);

          log("🔍 正在分析伏笔压力...\n");

          // 读取伏笔数据
          const hooksPath = join(bookDir, "story", "pending_hooks.md");
          const hooksContent = await readFile(hooksPath, "utf-8").catch(() => "");

          // 读取章节摘要
          const summariesPath = join(bookDir, "story", "chapter_summaries.md");
          const summariesContent = await readFile(summariesPath, "utf-8").catch(() => "");

          // 解析伏笔
          const hooks = parsePendingHooksMarkdown(hooksContent);

          // 获取当前章节号
          const config = await loadConfig();
          const runner = new PipelineRunner(buildPipelineConfig(config, root));
          const status = await runner.getBookStatus(bookId);
          const currentChapter = status.chaptersWritten;

          // 分析压力
          const report = analyzeAllHooksPressure(hooks, currentChapter, summariesContent);

          if (opts.json) {
            log(JSON.stringify(report, null, 2));
          } else {
            // 显示压力报告
            const markdown = formatPressureReportMarkdown(report);
            log(markdown);

            // 输出到文件
            if (opts.output) {
              const fs = await import("node:fs/promises");
              await fs.writeFile(opts.output, markdown, "utf-8");
              log(`\n📄 报告已保存到 ${opts.output}`);
            }
          }
        } catch (e) {
          handleCLIError(e, { json: opts.json, command: "hooks pressure" });
        }
      })
  )
  .addCommand(
    new Command("resolve")
      .description("标记伏笔回收 / Mark hook as resolved")
      .argument("<hookId>", "伏笔 ID / Hook ID")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .action(async (hookId: string, bookIdArg: string | undefined) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const config = await loadConfig();
          const runner = new PipelineRunner(buildPipelineConfig(config, root));

          log(`🪝 正在标记伏笔回收: ${hookId}...`);

          // TODO: 集成伏笔回收功能
          log("⚠️ 伏笔回收功能开发中...");
          log("\n💡 提示: 在写作过程中，系统会自动检测并回收伏笔");
        } catch (e) {
          handleCLIError(e, { json: false, command: "hooks resolve" });
        }
      })
  )
  .addCommand(
    new Command("list")
      .description("列出所有伏笔 / List all hooks")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .option("--status <status>", "按状态过滤 / Filter by status (active|stale|resolved)")
      .option("--json", "JSON 格式输出 / JSON output")
      .action(async (bookIdArg: string | undefined, opts) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new StateManager(root);
          const bookDir = state.bookDir(bookId);

          log("📋 正在列出所有伏笔...\n");

          // 读取 pending_hooks.md
          const hooksPath = join(bookDir, "story", "pending_hooks.md");
          const hooksContent = await readFile(hooksPath, "utf-8").catch(() => "");

          if (opts.json) {
            // 解析并输出 JSON 格式
            const hooks = parsePendingHooksMarkdown(hooksContent);
            log(JSON.stringify(hooks, null, 2));
          } else {
            log(hooksContent);
          }
        } catch (e) {
          handleCLIError(e, { json: opts.json, command: "hooks list" });
        }
      })
  );
