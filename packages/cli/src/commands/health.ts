import { Command } from "commander";
import { HealthChecker, generateHealthReportMarkdown, generateHealthReportJSON, createLogger, createStderrSink } from "@actalk/inkos-core";
import { loadConfig, findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";

/**
 * 健康检查命令
 * 提供一键式的世界观健康检查
 */
export const healthCommand = new Command("health")
  .description("健康检查 / Health check")
  .addCommand(
    new Command("check")
      .description("运行健康检查 / Run health check")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .option("-o, --output <file>", "输出报告到文件 / Output report to file")
      .option("--json", "JSON 格式输出 / JSON output")
      .action(async (bookIdArg: string | undefined, opts) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const config = await loadConfig();

          log("🏥 正在运行健康检查...\n");

          // 创建 logger
          const logger = createLogger({ tag: "health", sinks: [createStderrSink({})] });

          // 创建健康检查器
          const checker = new HealthChecker({
            client: null as any, // 健康检查不需要 LLM
            model: "",
            projectRoot: root,
            bookId,
            logger,
          });

          // 运行健康检查
          const report = await checker.runHealthCheck(bookId);

          if (opts.json) {
            log(JSON.stringify(generateHealthReportJSON(report), null, 2));
          } else {
            // 显示 Markdown 格式报告
            const markdown = generateHealthReportMarkdown(report);
            log(markdown);
          }

          // 如果指定了输出文件
          if (opts.output) {
            const fs = await import("node:fs/promises");
            const content = opts.json
              ? JSON.stringify(generateHealthReportJSON(report), null, 2)
              : generateHealthReportMarkdown(report);
            await fs.writeFile(opts.output, content, "utf-8");
            log(`\n📄 报告已保存到 ${opts.output}`);
          }
        } catch (e) {
          handleCLIError(e, { json: opts.json, command: "health check" });
        }
      })
  );
