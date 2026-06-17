import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { initializeProjectDirectory, hasGlobalConfig } from "../project-bootstrap.js";

export const initCommand = new Command("init")
  .description("Initialize an InkOS project (current directory by default)")
  .argument("[name]", "Project name (creates subdirectory). Omit to init current directory.")
  .option("--lang <language>", "Default writing language: zh (Chinese) or en (English)", "zh")
  .action(async (name: string | undefined, opts: { lang?: string }) => {
    const projectDir = name ? resolve(process.cwd(), name) : process.cwd();

    try {
      // 1. 检查 Node 版本
      const nodeVersion = parseInt(process.version.slice(1), 10);
      if (nodeVersion < 20) {
        logError(`❌ 需要 Node.js >= 20，当前版本: ${process.version}`);
        logError(`💡 建议: 升级 Node.js 或使用 nvm install 22`);
        process.exit(4);
      }

      // 2. 检查语言选项
      const lang = opts.lang === "en" ? "en" : "zh";
      if (opts.lang && opts.lang !== "en" && opts.lang !== "zh") {
        logError(`❌ 不支持的语言: "${opts.lang}"。支持: zh (中文), en (英文)`);
        process.exit(4);
      }

      await mkdir(projectDir, { recursive: true });
      await initializeProjectDirectory(projectDir, {
        language: lang,
        overwriteSupportFiles: true,
      });

      log(`✅ 项目已初始化: ${projectDir}`);
      log("");

      const isEnglish = lang === "en";
      const exampleCreate = isEnglish
        ? "  inkos book create --title 'My Novel' --genre progression --platform royalroad --lang en"
        : "  inkos book create --title '我的小说' --genre xuanhuan --platform tomato";

      // 3. 检查 LLM 配置
      const hasConfig = await hasGlobalConfig();
      if (hasConfig) {
        log("✅ 检测到全局 LLM 配置，已就绪！");
        log("");
        log("下一步:");
        if (name) log(`  cd ${name}`);
        log(exampleCreate);
      } else {
        log("⚠️  未检测到 LLM 配置");
        log("");
        log("快速配置（选择一种方式）:");
        log("  方式 1: inkos config set-global --provider deepseek --api-key <your-key> --model deepseek-chat");
        log("  方式 2: 编辑 ~/.inkos/.env 设置 API Key");
        log("  方式 3: 启动 Studio 后在界面中配置 (inkos studio)");
        log("");
        if (name) log(`  cd ${name}`);
        log(exampleCreate);
      }
      log("  inkos write next");
    } catch (e) {
      handleCLIError(e, { command: "init" });
    }
  });
