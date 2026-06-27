import { Command } from "commander";
import { EntityDB, loadCharacterVoices, parseRoleCardsToVoices } from "@actalk/inkos-core";
import {
  loadConfig,
  buildPipelineConfig,
  findProjectRoot,
  resolveBookId,
  log,
  logError,
} from "../utils.js";
import { handleCLIError } from "../error-handler.js";
import { join } from "node:path";

/**
 * 角色管理命令
 * 提供角色列表查看、详情检查、数据源分析等功能
 */
export const charactersCommand = new Command("characters")
  .description("角色管理 / Character management")

  .addCommand(
    new Command("list")
      .description("列出所有角色 / List all characters")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .option("--json", "JSON 格式输出 / JSON output")
      .action(async (bookIdArg: string | undefined, opts) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new (await import("@actalk/inkos-core")).StateManager(root);
          const bookDir = state.bookDir(bookId);

          log("👥 正在扫描角色数据源...\n");

          const fromVoices = await loadCharacterVoices(bookDir);
          const fromRoles = await parseRoleCardsToVoices(bookDir);
          const entityDB = new EntityDB(bookDir);
          const fromEntities = entityDB.getActiveCharacters();
          entityDB.close();

          const voiceNames = Object.keys(fromVoices.characters);
          const rolesNames = Object.keys(fromRoles);
          const entityNames = fromEntities.map((e) => e.name);

          const allNames = Array.from(
            new Set([...voiceNames, ...rolesNames, ...entityNames]),
          );

          if (opts.json) {
            const enriched = allNames.map((name) => ({
              name,
              sources: {
                voices: !!fromVoices.characters[name],
                roles: !!fromRoles[name],
                entities: entityNames.includes(name),
              },
              personality:
                fromVoices.characters[name]?.personality ??
                fromRoles[name]?.personality ??
                [],
            }));
            log(JSON.stringify(enriched, null, 2));
          } else {
            log(`📊 角色数据来源:`);
            log(`  character_voices.json: ${voiceNames.length} 个`);
            log(`  story/roles/*.md:      ${rolesNames.length} 个`);
            log(`  entities.db (SQLite):  ${fromEntities.length} 个`);
            log(`  去重总计:               ${allNames.length} 个`);
            log("");

            if (allNames.length === 0) {
              log("⚠️  暂未发现任何角色数据");
              log("💡 可以：");
              log("   1. 先运行 inkos book create 创建一本书，系统会生成角色");
              log("   2. 或在 story/roles/ 下创建 .md 角色卡");
              return;
            }

            log("👥 角色列表:");
            log("");
            for (const name of allNames) {
              const voice = fromVoices.characters[name] || fromRoles[name];
              const entity = fromEntities.find((e) => e.name === name);
              const sources: string[] = [];
              if (fromVoices.characters[name]) sources.push("voices");
              if (fromRoles[name]) sources.push("roles");
              if (entity) sources.push("entities");

              log(`  • ${name}  [${sources.join(", ")}]`);
              if (voice?.speechStyle)
                log(`      说话风格: ${voice.speechStyle}`);
              if (voice?.personality?.length)
                log(`      性格标签: ${voice.personality.slice(0, 4).join("、")}`);
              if (entity?.firstAppearance)
                log(`      首次登场: 第${entity.firstAppearance}章`);
              if (entity?.lastAppearance && entity.lastAppearance !== entity.firstAppearance)
                log(`      最近登场: 第${entity.lastAppearance}章`);
              log("");
            }

            log("💡 使用 inkos characters inspect <角色名> 查看角色完整档案");
            log("💡 使用 inkos characters health 检查角色数据完整性");
          }
        } catch (e) {
          handleCLIError(e, { json: opts.json, command: "characters list" });
        }
      })
  )

  .addCommand(
    new Command("inspect")
      .description("查看单个角色的完整档案 / Inspect a single character")
      .argument("<name>", "角色名称 / Character name")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .action(async (name: string, bookIdArg: string | undefined) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new (await import("@actalk/inkos-core")).StateManager(root);
          const bookDir = state.bookDir(bookId);

          log(`🔍 正在查询角色: ${name}\n`);

          const fromVoices = await loadCharacterVoices(bookDir);
          const fromRoles = await parseRoleCardsToVoices(bookDir);
          const entityDB = new EntityDB(bookDir);
          const entities = entityDB
            .getActiveCharacters()
            .filter((e) => e.name === name || e.aliases?.includes(name));
          entityDB.close();

          const voice = fromVoices.characters[name] || fromRoles[name];
          const entity = entities[0];

          if (!voice && !entity) {
            logError(`❌ 未找到角色 "${name}"`);
            log("💡 运行 inkos characters list 查看全部角色");
            return;
          }

          log(`📄 角色档案: ${name}`);
          log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

          if (voice) {
            if (voice.speechStyle) log(`🗣  说话风格: ${voice.speechStyle}`);
            if (voice.personality?.length)
              log(`🎭 性格特征: ${voice.personality.join("、")}`);
            if (voice.vocabulary?.length)
              log(`📝 常用词: ${voice.vocabulary.join("、")}`);
            if (voice.emotionalExpression)
              log(`💭 情绪表达: ${voice.emotionalExpression}`);
            if (voice.sampleDialogues?.length) {
              log("💬 示例对话:");
              for (const d of voice.sampleDialogues.slice(0, 3))
                log(`   > ${d}`);
            }
            if (voice.infoBoundary?.length) {
              log("🔒 信息边界:");
              for (const b of voice.infoBoundary.slice(0, 5))
                log(`   • ${b}`);
            }
            log("");
          }

          if (entity) {
            log(`🗂  实体数据库 (entities.db) 信息:`);
            log(`   实体 ID: ${entity.id}`);
            log(`   类型: ${entity.type}`);
            log(`   状态: ${entity.status}`);
            log(`   首次登场: 第${entity.firstAppearance}章`);
            if (entity.lastAppearance !== entity.firstAppearance)
              log(`   最近登场: 第${entity.lastAppearance}章`);
            if (entity.aliases?.length)
              log(`   别名: ${entity.aliases.join("、")}`);
            if (Object.keys(entity.attributes ?? {}).length) {
              log(`   属性:`);
              for (const [k, v] of Object.entries(entity.attributes ?? {})) {
                log(`     ${k}: ${String(v)}`);
              }
            }
          } else {
            log("ℹ️  entities.db 中未找到此角色（可能还未通过写作被提取）");
          }

          log("");
          log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          log("💡 写作新章节时，此角色会参与圆桌讨论并对剧情施加约束");
        } catch (e) {
          handleCLIError(e, { json: false, command: "characters inspect" });
        }
      })
  )

  .addCommand(
    new Command("health")
      .description("检查角色数据完整性 / Health check for character data")
      .argument("[book-id]", "Book ID (auto-detected if only one book)")
      .action(async (bookIdArg: string | undefined) => {
        try {
          const root = findProjectRoot();
          const bookId = await resolveBookId(bookIdArg, root);
          const state = new (await import("@actalk/inkos-core")).StateManager(root);
          const bookDir = state.bookDir(bookId);

          log("🏥 正在执行角色数据健康检查...\n");

          const fromVoices = await loadCharacterVoices(bookDir);
          const fromRoles = await parseRoleCardsToVoices(bookDir);
          const entityDB = new EntityDB(bookDir);
          const fromEntities = entityDB.getActiveCharacters();
          entityDB.close();

          const voiceNames = new Set(Object.keys(fromVoices.characters));
          const rolesNames = new Set(Object.keys(fromRoles));
          const entityNames = new Set(fromEntities.map((e) => e.name));

          const allNames = new Set([
            ...voiceNames,
            ...rolesNames,
            ...entityNames,
          ]);

          log(`📋 覆盖率检查:`);
          log(`  角色卡(story/roles/*.md):    ${rolesNames.size} 个`);
          log(`  声音档案(character_voices.json): ${voiceNames.size} 个`);
          log(`  实体库(entities.db):           ${entityNames.size} 个`);
          log(`  去重总计:                      ${allNames.size} 个`);
          log("");

          // 找只在一个数据源里的角色，提示缺口
          const underrepresented: string[] = [];
          for (const n of allNames) {
            const score =
              (voiceNames.has(n) ? 1 : 0) +
              (rolesNames.has(n) ? 1 : 0) +
              (entityNames.has(n) ? 1 : 0);
            if (score === 1) underrepresented.push(n);
          }

          if (underrepresented.length === 0) {
            log("✅ 角色数据健康：每个角色在多个数据源中均有交叉");
          } else {
            log(`⚠️  ${underrepresented.length} 个角色只在单个数据源中存在：`);
            for (const n of underrepresented.slice(0, 10)) {
              const which =
                voiceNames.has(n)
                  ? "voices.json 独有"
                  : rolesNames.has(n)
                    ? "roles/*.md 独有"
                    : "entities.db 独有";
              log(`   • ${n}（${which}）`);
            }
            if (underrepresented.length > 10)
              log(`   ... 还有 ${underrepresented.length - 10} 个`);
            log("");
            log(
              "💡 建议：角色卡(roles/*.md)最容易补充，写完后系统自动用于圆桌讨论",
            );
            log("💡 写作新章节时，系统会自动从章节提取实体写入 entities.db");
          }
        } catch (e) {
          handleCLIError(e, { json: false, command: "characters health" });
        }
      })
  );
