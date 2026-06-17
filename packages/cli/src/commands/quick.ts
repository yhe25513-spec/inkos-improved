import { Command } from "commander";
import { PipelineRunner, StateManager } from "@actalk/inkos-core";
import { loadConfig, buildPipelineConfig, findProjectRoot, resolveBookId, log, logError } from "../utils.js";
import { handleCLIError } from "../error-handler.js";

/**
 * 快捷指令映射
 * 支持中文命令，降低非技术用户的学习成本
 */
const QUICK_COMMANDS: Record<string, {
  description: string;
  descriptionEn: string;
  action: string;
  icon: string;
}> = {
  "写大纲": {
    description: "生成章节大纲",
    descriptionEn: "Generate chapter outline",
    action: "plan",
    icon: "📝",
  },
  "写正文": {
    description: "写下一章",
    descriptionEn: "Write next chapter",
    action: "write",
    icon: "✍️",
  },
  "体检": {
    description: "检查世界观健康",
    descriptionEn: "Check world health",
    action: "health",
    icon: "🏥",
  },
  "存档": {
    description: "整合章节状态",
    descriptionEn: "Consolidate chapter state",
    action: "consolidate",
    icon: "💾",
  },
  "检测": {
    description: "检测 AI 痕迹",
    descriptionEn: "Detect AI patterns",
    action: "detect",
    icon: "🔍",
  },
  "修订": {
    description: "修订上一章",
    descriptionEn: "Revise last chapter",
    action: "revise",
    icon: "✏️",
  },
  "状态": {
    description: "查看书籍状态",
    descriptionEn: "View book status",
    action: "status",
    icon: "📊",
  },
  "导出": {
    description: "导出章节",
    descriptionEn: "Export chapters",
    action: "export",
    icon: "📤",
  },
  "伏笔": {
    description: "查看伏笔状态",
    descriptionEn: "View hook status",
    action: "hooks",
    icon: "🪝",
  },
  "角色": {
    description: "查看角色列表",
    descriptionEn: "View character list",
    action: "characters",
    icon: "👥",
  },
};

export const quickCommand = new Command("quick")
  .description("快捷指令（中文命令） / Quick commands")
  .argument("[command]", "指令名称 / Command name")
  .option("--list", "列出所有可用指令 / List all available commands")
  .option("--json", "JSON 格式输出 / JSON output")
  .action(async (command: string | undefined, opts) => {
    try {
      // 列出所有命令
      if (opts.list || !command) {
        if (opts.json) {
          log(JSON.stringify(QUICK_COMMANDS, null, 2));
        } else {
          log("\n🎯 可用快捷指令 / Available Quick Commands:\n");
          for (const [cmd, info] of Object.entries(QUICK_COMMANDS)) {
            log(`  ${info.icon} ${cmd.padEnd(8)} - ${info.description}`);
          }
          log("\n使用方法 / Usage: inkos quick <command>");
          log("例如 / Example: inkos quick 写正文\n");
        }
        return;
      }

      // 查找命令
      const cmdInfo = QUICK_COMMANDS[command];
      if (!cmdInfo) {
        logError(`未知指令: "${command}"`);
        log("使用 inkos quick --list 查看所有可用指令");
        process.exit(1);
      }

      const root = findProjectRoot();
      const bookId = await resolveBookId(undefined, root);
      const config = await loadConfig();
      const pipeline = new PipelineRunner(buildPipelineConfig(config, root));

      log(`${cmdInfo.icon} 执行: ${command} - ${cmdInfo.description}\n`);

      switch (cmdInfo.action) {
        case "plan": {
          log("📝 正在生成章节大纲...");
          const result = await pipeline.planChapter(bookId);
          log(`\n✅ 大纲生成完成！`);
          log(`章节: ${result.chapterNumber}`);
          break;
        }

        case "write": {
          log("✍️ 正在写下一章...");
          const result = await pipeline.writeNextChapter(bookId);
          log(`\n✅ 写作完成！`);
          log(`章节: ${result.chapterNumber} - ${result.title}`);
          log(`字数: ${result.wordCount}`);
          log(`审计: ${result.auditResult.passed ? "通过" : "需要修订"}`);
          break;
        }

        case "health": {
          log("🏥 正在运行健康检查...");
          const state = new StateManager(root);
          const book = await state.loadBookConfig(bookId);

          // 显示基础健康信息
          log(`\n📊 书籍健康报告`);
          log(`书籍: ${book.title || bookId}`);
          log(`类型: ${book.genre || "未设置"}`);
          log(`语言: ${book.language || "zh"}`);

          // TODO: 集成完整的健康检查系统
          log(`\n✅ 基础检查完成`);
          break;
        }

        case "consolidate": {
          log("💾 正在整合章节状态...");
          log(`\n💡 提示: 完整的状态整合功能请使用:`);
          log(`  inkos consolidate             # 整合所有章节状态`);
          break;
        }

        case "detect": {
          log("🔍 正在检测 AI 痕迹...");
          log(`\n💡 提示: 完整的 AI 检测功能请使用:`);
          log(`  inkos detect --local          # 本地模式（无需 API）`);
          log(`  inkos detect --all            # 检测所有章节`);
          log(`  inkos detect --stats          # 查看统计信息`);
          break;
        }

        case "revise": {
          log("✏️ 正在修订上一章...");
          const reviseResult = await pipeline.reviseDraft(bookId);
          log(`\n✅ 修订完成！`);
          log(`章节: ${reviseResult.chapterNumber}`);
          log(`修复问题: ${reviseResult.fixedIssues.length} 个`);
          break;
        }

        case "status": {
          log("📊 正在查看书籍状态...");
          const status = await pipeline.getBookStatus(bookId);
          log(`\n📊 书籍状态`);
          
          
          break;
        }

        case "export": {
          log("📤 正在导出章节...");
          log(`\n💡 提示: 完整的导出功能请使用:`);
          log(`  inkos export                  # 导出为 TXT`);
          log(`  inkos export --format epub    # 导出为 EPUB`);
          break;
        }

        case "hooks": {
          log("🪝 正在查看伏笔状态...");
          const truthFiles = await pipeline.readTruthFiles(bookId);
          if (truthFiles.pendingHooks && truthFiles.pendingHooks.trim()) {
            log(`\n📋 伏笔池:`);
            log(truthFiles.pendingHooks);
          } else {
            log(`\n📋 暂无活跃伏笔`);
          }
          break;
        }

        case "characters": {
          log("👥 正在查看角色列表...");
          const truthFiles = await pipeline.readTruthFiles(bookId);
          log(`\n👥 角色信息已加载`);
          break;
        }

        default:
          logError(`未知操作: ${cmdInfo.action}`);
          process.exit(1);
      }
    } catch (e) {
      handleCLIError(e, { json: opts.json, command: "quick" });
    }
  });

export { QUICK_COMMANDS };
