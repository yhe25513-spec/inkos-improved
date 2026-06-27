import { Command } from "commander";
import { spawn } from "node:child_process";
import { loadConfig, findProjectRoot, resolveBookId, log } from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { createInterface } from "node:readline";
import { readRoleCards, loadCharacterVoices } from "@actalk/inkos-core";
import { launchStudioWorkbench } from "./studio.js";

/**
 * 交互式创作引导
 * 检测当前项目状态，推荐下一步操作
 */
export const startCommand = new Command("start")
  .description("交互式创作引导 / Interactive创作 guide")
  .option("--non-interactive", "不进入交互选择，只打印状态和建议", false)
  .action(async (opts) => {
    try {
      const root = findProjectRoot();
      const state = new (await import("@actalk/inkos-core")).StateManager(root);
      const config = await loadConfig();

      log("");
      log("📖 InkOS 创作引导");
      log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      log("");

      // 1. 检测项目关键状态
      const allBooks = await state.listBooks();
      const hasBooks = allBooks.length > 0;
      const hasApiKey = !!(config.llm?.apiKey || process.env.INKOS_API_KEY);

      let nextChapter = 0;
      let currentBookTitle = "";
      let hasRoleCards = false;

      if (hasBooks) {
        try {
          const bookId = await resolveBookId(undefined, root);
          const book = await state.loadBookConfig(bookId);
          const chapterIndex = await state.loadChapterIndex(bookId);
          currentBookTitle = book.title || bookId;
          nextChapter =
            chapterIndex.length > 0
              ? Math.max(...chapterIndex.map((c) => c.number)) + 1
              : 1;

          const bookDir = state.bookDir(bookId);
          const roles = await readRoleCards(bookDir);
          const voices = await loadCharacterVoices(bookDir);
          hasRoleCards = roles.length > 0 || Object.keys(voices.characters).length > 0;
        } catch {
          // bookId 解析失败时退回"无书"状态
        }
      }

      log("📊 当前项目状态:");
      log(`  ${hasApiKey ? "✅" : "⚠️"}  已配置 LLM API Key`);
      log(`  ${hasBooks ? "✅" : "⚠️"}  已创建书籍: ${hasBooks ? allBooks.length : 0} 本`);
      if (currentBookTitle) {
        log(`     → 当前: 《${currentBookTitle}》（下一章: 第${nextChapter}章）`);
      }
      log(`  ${hasRoleCards ? "✅" : "⚠️"}  已创建角色卡`);
      log("");

      // 2. 生成下一步建议
      const options: Array<{
        key: string;
        label: string;
        command: string;
        description: string;
      }> = [];

      if (!hasBooks) {
        options.push({
          key: "1",
          label: "📝 创建新书",
          command: "book create",
          description: "由 AI 自动生成世界观、大纲、角色卡",
        });
      } else {
        options.push({
          key: "1",
          label: `✍️  写第${nextChapter}章`,
          command: "write next",
          description: `继续《${currentBookTitle}》的创作，自动进入角色圆桌讨论`,
        });
        options.push({
          key: "2",
          label: "🧭 规划下一章的意图",
          command: "plan",
          description: "先让 AI 为下一章制定剧情意图与约束",
        });
        options.push({
          key: "3",
          label: "🧐 审查最近章节的连续性",
          command: "audit",
          description: "检查伏笔回收、角色一致性、时间线等问题",
        });
        if (!hasRoleCards) {
          options.push({
            key: "4",
            label: "👥 打开 Studio 补充角色卡",
            command: "studio",
            description: "在浏览器中管理角色、大纲、世界观",
          });
        } else {
          options.push({
            key: "4",
            label: "👥 查看角色档案",
            command: "characters list",
            description: "浏览角色卡与实体数据库",
          });
        }
      }

      options.push({
        key: "9",
        label: "🧯 运行系统健康检查",
        command: "doctor",
        description: "检查配置文件、API 连接、数据完整性",
      });

      options.push({
        key: "0",
        label: "❌ 退出",
        command: "exit",
        description: "关闭 InkOS 引导",
      });

      log("💡 建议操作:");
      log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      options.forEach((opt) => {
        log(`  [${opt.key}] ${opt.label.padEnd(28)} → inkos ${opt.command}`);
        log(`      ${opt.description}`);
        log("");
      });

      // 3. 非交互模式直接返回
      if (opts.nonInteractive) {
        log("ℹ️  非交互模式：运行对应 inkos <command> 来执行");
        return;
      }

      // 4. 读取用户输入
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await new Promise<string>((resolve) => {
        rl.question("请输入序号: ", resolve);
      });
      rl.close();

      const selected = options.find((o) => o.key === answer.trim());
      if (!selected || selected.key === "0") {
        log("再见！运行 inkos start 随时回到这里 ✨");
        return;
      }

      log("");
      log(`▶ 正在执行: inkos ${selected.command} ...`);
      log("");

      // 5. 分派到目标命令
      if (selected.command === "studio") {
        await launchStudioWorkbench(root, "4570");
        return;
      }

      const child = spawn("npx", ["inkos", ...selected.command.split(" ")], {
        stdio: "inherit",
        cwd: process.cwd(),
      });
      child.on("close", (code) => {
        if (code !== 0) process.exit(code || 0);
      });
    } catch (e) {
      handleCLIError(e, { json: false, command: "start" });
    }
  });
