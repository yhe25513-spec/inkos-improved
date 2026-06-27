# 角色数据管线升级计划（Character Pipeline Upgrade Plan）

> **版本**: v1.0  
> **日期**: 2026-06-18  
> **目标**: 修复角色圆桌讨论的端到端数据流，建立"角色卡 → 声音档案 → 圆桌讨论 → 章节写作"的完整闭环，解决"新角色数据无法被写作管线使用"的核心问题。

---

## 一、问题诊断（Root Cause Analysis）

### 1.1 现有系统中的数据流断点

```
用户写角色卡 (story/roles/主要角色/林默.md)
    ↓
CharacterVoiceExtractor.extractVoice()  ← 存在但从不被调用
    ↓ (缺失: 自动持久化)
character_voices.json  ← 不存在或为空
    ↓ (缺失: 运行时读取)
loadActiveCharacters()  ← 返回 {}
    ↓
CharacterRoundtable.discuss()  ← 被跳过
    ↓
roleConstraints = undefined  ← Writer agent 看不到角色约束
    ↓
Writer 写出的对话无角色辨识度 ← 用户最终体验问题
```

### 1.2 缺失的三个关键功能

| 缺失项 | 位置 | 影响 |
|--------|------|------|
| **A. roles/ 目录解析器** | `utils/character-voices.ts` 或 `utils/outline-paths.ts` | 角色卡永远无法进入运行时数据 |
| **B. 实体提取 + 持久化闭环** | `pipeline/runner.ts` 的 `writeDraft()` | 新角色不会被写入 `entities.db`，后续章节看不到 |
| **C. 角色数据诊断/管理工具** | `cli/src/commands/` | 用户无法确认角色数据是否有效加载 |

### 1.3 当前已有组件清单（可以直接复用）

| 组件 | 文件 | 现状 |
|------|------|------|
| `loadActiveCharacters()` | `packages/core/src/pipeline/runner.ts:102` | ✅ 已修复，支持 4 种数据源降级加载 |
| `CharacterRoundtable.discuss()` | `packages/core/src/agents/character-roundtable.ts:583` | ✅ 工作正常，只要有角色数据就会运行 |
| `CharacterVoiceExtractor` | `packages/core/src/agents/character-voice-extractor.ts` | ✅ 存在，支持从角色卡提取声音档案 |
| `EntityExtractor` | `packages/core/src/agents/entity-extractor.ts` | ✅ 存在，支持从章节内容提取实体 |
| `EntityDB` | `packages/core/src/state/entity-db.ts` | ✅ 工作正常，SQLite 存储 |
| `entitiesToCharacterVoices()` | `packages/core/src/utils/character-voices.ts` | ✅ 刚刚修复，可工作 |
| `readRoleCards()` | `packages/core/src/utils/outline-paths.ts:154` | ✅ 已存在，可读取 `story/roles/` 目录 |
| `saveCharacterVoices()` | `packages/core/src/utils/character-voices.ts` | ✅ 已存在，可写入 JSON 档案 |

---

## 二、迭代计划（8 Iterations + 2 Test Phases）

### 总体架构目标

```
┌────────────────────────────────────────────────────────────────────┐
│                    运行时写作流程 (Runtime Pipeline)               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. buildWriteInput()                                              │
│  ├─► readRoleCards() ──► parseRoleCardsToVoices()                  │
│  │                        (新增 Iteration 1)                       │
│  │                                                              │
│  ├─► loadCharacterVoices() ─┬─────────────► mergeVoices()         │
│  │                          │                  (新增 I1)          │
│  ├─► EntityDB.getActiveCharacters() ─► entitiesToCharacterVoices()│
│  │                          │                                       │
│  └─► MemoryDB.listCharacters() ──► fallback character name only   │
│                                                                    │
│  2. CharacterRoundtable.discuss()  ← 接收合并后的角色数据          │
│     ├─► Moderator 准备议题                                         │
│     ├─► 每个角色 Agent 审查章节大纲                               │
│     └─► Synthesizer 生成 roleConstraints                          │
│                                                                    │
│  3. WriterAgent.writeChapter()  ← 注入 roleConstraints            │
│                                                                    │
│  4. 后写处理                                                       │
│     ├─► EntityExtractor.extractFromChapter()  ← (新增 I3)         │
│     │   └─► EntityDB.upsertEntity()  ← 写入新角色                 │
│     │                                                              │
│     └─► CharacterVoiceExtractor.extractVoice()  ← (可选 I4)       │
│         └─► saveCharacterVoices()  ← 更新 character_voices.json   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                    工具命令 (Tool Commands)                       │
│                                                                    │
│  `inkos characters list`   - 列出当前可用于圆桌讨论的角色          │
│  `inkos characters extract` - 手动触发角色声音提取                 │
│  `inkos characters inspect` - 检查角色数据完整性                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Iteration 1: roles/ 目录 → CharacterVoice 解析器

**目标**: 在 `utils/character-voices.ts` 中新增对 `story/roles/*.md` 角色卡的解析能力。

**修改文件**:

1. `packages/core/src/utils/character-voices.ts`
   - 新增 `parseRoleCardToVoice(roleCardContent: string, roleName: string): CharacterVoice` 函数
     - 从 Markdown 角色卡的 `**性格**:`、`**说话**:`、`**口癖**:` 等结构化字段提取
     - 填充 `speechStyle / personality / forbiddenTone / vocabulary / emotionalExpression / infoBoundary`
     - 缺失字段使用合理默认值（空数组、空字符串）
     - 可复用 `readRoleCards()` 返回的数据结构
   - 新增 `collectVoicesFromRolesDir(bookDir: string): Promise<Record<string, CharacterVoice>>` 函数
     - 内部调用 `readRoleCards()`（来自 `utils/outline-paths.ts`）
     - 遍历所有角色卡，逐条调用 `parseRoleCardToVoice()`
   - 在 `loadCharacterVoices()` 末尾增加降级逻辑：当 `character_voices.json` 不存在或为空时，自动尝试从 `roles/` 目录生成
     - 调用 `collectVoicesFromRolesDir()`
     - 若获取到角色，调用 `saveCharacterVoices()` 持久化回 JSON
     - 下次启动时直接读取已生成的 JSON，跳过解析

**验收标准**:
- [ ] `loadCharacterVoices()` 在仅有 `story/roles/` 目录时能正常返回角色数据
- [ ] 解析后的 `CharacterVoice` 包含 `personality`、`speechStyle`、`infoBoundary` 三个核心字段
- [ ] 首次运行时自动生成 `character_voices.json`，后续运行直接读取缓存

---

### Iteration 2: runner.ts 中角色数据源优先级调整

**目标**: 将 `loadActiveCharacters()` 的数据源优先级从 4 步扩展为 5 步，确保 roles/ 目录的角色卡优先于 entities.db 的原始实体。

**修改文件**:

1. `packages/core/src/pipeline/runner.ts`
   - 修改 `loadActiveCharacters()` 函数的数据源优先级为：
     ```
     1. character_voices.json  (已存在)
     2. story/roles/*.md  (新增 - 直接解析角色卡，最完整)
     3. entities.db (SQLite) → entitiesToCharacterVoices  (已存在)
     4. memory.db → 仅角色名  (已存在)
     5. story_bible.md 正则提取  (已存在)
     ```
   - 第 2 步实现：调用 `collectVoicesFromRolesDir(bookDir)`
   - 增加详细日志：每一步加载了多少个角色，从哪个来源加载
   - 将 `loadActiveCharacters()` 从 runner.ts 中迁移到 `utils/character-voices.ts`，便于其他模块复用（保持 runner.ts 中的同名包装函数）

**验收标准**:
- [ ] 当 `story/roles/主要角色/林默.md` 存在时，`loadActiveCharacters()` 返回包含林默的角色数据
- [ ] 日志可清晰追踪角色数据从哪个来源加载
- [ ] TypeScript 编译无错误

---

### Iteration 3: 章节写作后自动提取并持久化新角色实体

**目标**: 在 `writeDraft()` 写作完成后，调用 `EntityExtractor` 提取章节中出现的新角色，并写入 `entities.db`，确保"后续章节"能识别这些新角色。

**修改文件**:

1. `packages/core/src/pipeline/runner.ts`
   - 在 `writeDraft()` 中，保存章节后 (`writer.saveChapter()`) 增加实体提取步骤：
     ```typescript
     // 提取并持久化新实体（角色/场景/物品等）
     try {
       const entityExtractor = new EntityExtractor(this.agentCtxFor("entity-extractor", bookId));
       const extraction = await entityExtractor.extractFromChapter(
         draftOutput.content,
         chapterNumber,
       );
       
       const entityDB = new EntityDB(bookDir);
       let newCharacters = 0;
       for (const entity of extraction.delta.characters) {
         const existing = entityDB.getActiveCharacters().find(e => e.name === entity.name);
         if (!existing) {
           entityDB.upsertEntity({ ...entity, status: "active" });
           newCharacters++;
         }
       }
       entityDB.close();
       
       if (newCharacters > 0) {
         this.config.logger?.info(`[entities] 第 ${chapterNumber} 章发现 ${newCharacters} 个新角色，已写入 entities.db`);
       }
     } catch (err) {
       this.config.logger?.warn(`[entities] 实体提取失败（不影响章节保存）: ${err}`);
     }
     ```
   - 注意：实体提取需要 LLM 调用，可能耗时 ~10-30 秒。建议作为可选步骤，通过 `book_rules.md` 中的 `auto_extract_entities: true` 控制是否启用（默认启用）

2. `packages/core/src/agents/entity-extractor.ts`
   - 确认 `extractFromChapter()` 返回的 `EntityDelta.characters` 字段包含 `name, aliases, attributes, state, type, status` 等必要字段
   - 确认这些字段与 `EntityDB.upsertEntity()` 的期望输入兼容

**验收标准**:
- [ ] 写作一个新章节后，如果章节中出现了新角色"萧炎"，`entities.db` 中会有 `type="character", status="active", name="萧炎"` 的记录
- [ ] 再写一章时，`loadActiveCharacters()` 能从 `entities.db` 加载到"萧炎"
- [ ] 实体提取失败时不影响章节的正常保存

---

### Iteration 4: 角色声音自动更新（可选增强）

**目标**: 从 entities.db 提取的角色有基础属性，但缺乏"说话风格"等高级字段。当 `character_voices.json` 中的某个角色只有基本字段时，系统应定期调用 `CharacterVoiceExtractor` 自动补全。

**修改文件**:

1. `packages/core/src/utils/character-voices.ts`
   - 新增 `enrichVoicesWithLLM(voices: Record<string, CharacterVoice>, agentCtx: AgentContext, bookDir: string): Promise<Record<string, CharacterVoice>>` 函数
     - 遍历 voices，对每个缺少 `speechStyle` 或 `personality` 的角色，调用 `CharacterVoiceExtractor.extractVoice()` 补全
     - 补全后自动调用 `saveCharacterVoices()` 持久化

2. `packages/core/src/pipeline/runner.ts`
   - 在 `writeDraft()` 中，实体提取完成后（或在 `loadActiveCharacters()` 中检测到有角色缺少高级字段时）触发补全

**注意**: 此迭代是可选增强。如果增加太多 LLM 调用延迟，可以作为后台任务或默认关闭。

**验收标准**:
- [ ] 从 entities.db 加载的角色（仅有基本属性）在写作时能被检测到缺少 `speechStyle`
- [ ] 检测到后自动补全并保存到 `character_voices.json`
- [ ] 补全后的角色在下次写作时直接使用缓存，不再重复补全

---

### Iteration 5: CLI 工具命令 - `inkos characters`

**目标**: 提供命令行工具，让用户可以诊断、管理角色数据。

**修改文件**:

1. `packages/cli/src/commands/characters.ts`（新建）
   - `inkos characters list` —— 列出当前可用于圆桌讨论的所有角色及其来源
     - 显示每个角色的 name, personality, speechStyle, infoBoundary 摘要
     - 显示角色数据的来源（voices.json / roles/*.md / entities.db / memory.db）
   - `inkos characters inspect <name>` —— 查看某个角色的完整档案
   - `inkos characters extract` —— 手动触发从 roles/ 目录到 character_voices.json 的生成
   - `inkos characters check` —— 检查当前项目的角色数据健康状况
     - 是否有 `story/roles/` 目录？有多少角色卡？
     - `character_voices.json` 是否存在？版本是否正确？
     - `entities.db` 中是否有活跃角色？
     - 预测圆桌讨论能否正常运行？

2. `packages/cli/src/index.ts`（或主命令注册处）
   - 注册 `characters` 子命令

**验收标准**:
- [ ] `inkos characters check` 能正确诊断"角色数据加载问题"并给出修复建议
- [ ] `inkos characters extract` 能手动生成 `character_voices.json`
- [ ] 命令输出格式与其他 inkos 命令保持一致

---

### Iteration 6: 圆桌讨论元数据 - 检测是否实际运行

**目标**: 增加可观测性，让用户在 `inkos doctor` 和写作日志中能确认圆桌讨论是否运行。

**修改文件**:

1. `packages/cli/src/commands/doctor.ts`
   - 增加"角色数据"检查项：
     - 检查 `story/roles/` 目录存在及角色卡数量
     - 检查 `character_voices.json` 存在及版本
     - 检查 `entities.db` 中活跃角色数量
     - 预测圆桌讨论能否运行，给出详细诊断报告

2. `packages/core/src/pipeline/runner.ts`
   - 在 `writeDraft()` 中增加圆桌讨论的运行时统计输出
   - 当 `roleConstraints` 不为空时，记录约束的字数和关键角色名称
   - 当被跳过（无角色数据）时，输出明确的警告信息，告诉用户如何修复

**验收标准**:
- [ ] `inkos doctor` 输出中包含"角色数据健康"检查项
- [ ] 写作日志中明确显示"圆桌讨论已运行 / 已跳过 N 个角色"
- [ ] 被跳过时给出具体的修复建议（如"请在 story/roles/ 目录添加角色卡"）

---

### Iteration 7: 启动脚本更新 - 直接运行本地代码

**目标**: 桌面的 `启动InkOS.bat` 需要运行你修改后的本地代码。

**修改文件**:

1. `C:\Users\ZhuanZ\Desktop\启动InkOS.bat`（或 `packages/cli/launcher.bat`）
   - 在启动前执行 `npm run build` 重新编译
   - 使用 `node packages/cli/dist/index.js studio` 直接调用本地编译产物，而不是 `npx inkos`
   - 参考内容见本文档"三、更新启动脚本"章节

2. `inkos-dev/启动InkOS-本地源码.bat`（已存在）
   - 验证其能正常启动并运行修改后的代码

**验收标准**:
- [ ] 运行 `启动InkOS-本地源码.bat` 后，写章节时能触发圆桌讨论
- [ ] `inkos doctor` 输出包含新增的角色数据检查项
- [ ] 首次从 roles/ 目录生成 character_voices.json 可在日志中看到

---

### Iteration 8: 启动脚本与配置 - `角色卡 Markdown 格式规范`

**目标**: 为用户提供角色卡的标准编写格式，确保 `parseRoleCardToVoice()` 能正确解析。

**文档内容**（在 `inkos doctor` 输出的建议链接或直接在命令输出中给出）:

```markdown
## 推荐角色卡格式

### 基本信息（必填）
**姓名**: 林默
**角色定位**: 主角 / 配角 / 反派 / 导师

### 说话风格（影响对话辨识度）
**说话方式**: 内心独白为主，对外语言简意赅
**常用语气词**: 嗯、...、（沉默）
**口癖**: 不会使用"哈哈"之类的开朗表达
**禁忌表达**: 不使用夸张的感叹词

### 性格特征（影响对话内容选择）
**性格**: 冷静、理性、内省、谨慎
**标签**: 穿越者、系统持有者、低调

### 情绪表达（影响对话情绪）
**情绪表达方式**: 通过动作和短暂对话表达情绪
**激动时的表现**: 语速加快，或反而更沉默

### 信息边界（防止角色知道不该知道的事）
**已知信息**: 穿越前的现代知识、自己的系统功能
**未知信息**: 其他系统持有者、剧情未来走向、世界深层设定
**不会透露**: 自己是穿越者、系统的具体能力数值
```

同时在 `inkos characters check` 中输出此格式建议。

**验收标准**:
- [ ] `inkos characters check` 能识别不符合规范的角色卡并给出改进建议
- [ ] 符合规范的角色卡能被 `parseRoleCardToVoice()` 正确解析

---

## 三、测试计划（Test Plan）

### Phase A: 单元测试（Unit Tests）

| 测试文件 | 测试内容 | 优先级 |
|----------|----------|--------|
| `packages/core/src/__tests__/character-voices-parse.test.ts` | `parseRoleCardToVoice()` 从 Markdown 提取字段 | 高 |
| `packages/core/src/__tests__/character-voices-parse.test.ts` | `collectVoicesFromRolesDir()` 遍历目录并合并 | 高 |
| `packages/core/src/__tests__/character-voices-parse.test.ts` | `loadCharacterVoices()` 的降级逻辑（JSON 不存在时从 roles/ 自动生成） | 高 |
| `packages/core/src/__tests__/character-pipeline.test.ts`（新建） | `loadActiveCharacters()` 多数据源优先级 | 高 |
| `packages/core/src/__tests__/character-pipeline.test.ts` | `entitiesToCharacterVoices()` 转换正确性 | 中 |
| `packages/core/src/__tests__/character-pipeline.test.ts` | `enrichVoicesWithLLM()` 的补全逻辑（带 LLM mock） | 中 |

### Phase B: 集成测试（Integration Tests）

| 测试场景 | 位置 | 优先级 |
|----------|------|--------|
| 完整写作流程: 含 `story/roles/*.md` → `writeDraft()` → 圆桌讨论运行 → 输出包含 `roleConstraints` | `pipeline-runner.test.ts` 扩展 | 高 |
| 完整写作流程: 无角色数据 → `writeDraft()` → 圆桌讨论被跳过 → 输出清晰警告 | `pipeline-runner.test.ts` 扩展 | 高 |
| 新角色提取: 章节出现"萧炎" → `entity-extractor` → `entities.db` 有记录 | `character-pipeline.test.ts` | 高 |
| CLI 命令: `inkos characters list/check/extract` 命令正确性 | `packages/cli/src/__tests__/characters-command.test.ts` | 中 |

### Phase C: 端到端测试（End-to-End / Smoke Test）

1. **手动 smoke test**
   - 准备测试书籍: `books/test-book/`
   - 创建 `story/roles/主要角色/林默.md` 角色卡
   - 运行 `npm run build` 重新编译
   - 运行 `inkos characters check` —— 确认诊断通过
   - 运行 `inkos write next` —— 确认日志中出现 `[roundtable] ... 个角色参与讨论`
   - 检查 `character_voices.json` 是否被自动生成

2. **回归测试**
   - 删除 `character_voices.json` 但保留 `story/roles/`
   - 再次运行 `inkos write next`
   - 确认能自动从 `roles/` 重新生成 JSON 并运行圆桌讨论

3. **新角色提取测试**
   - 写一章，让章节内容中出现新角色"陆沉"
   - 运行 `inkos characters check` —— 确认 `entities.db` 中有"陆沉"
   - 再写一章，确认"陆沉"参与了圆桌讨论

### 测试命令

```bash
# 单元测试
cd packages/core
npx vitest run character-voices-parse --no-coverage
npx vitest run character-pipeline --no-coverage

# 完整回归测试
npx vitest run --no-coverage 2>&1 | Select-Object -Last 30

# TypeScript 编译检查
cd packages/core ; npx tsc --noEmit
cd packages/cli ; npx tsc --noEmit

# CLI smoke test
node packages/cli/dist/index.js doctor
node packages/cli/dist/index.js characters check --book test-book
node packages/cli/dist/index.js write next --book test-book
```

---

## 四、风险与回滚策略

### 4.1 主要风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 实体提取增加 LLM 调用延迟（+10-30s/章） | 高 | 用户体验下降 | 默认启用，提供 `book_rules.md` 关闭选项 |
| `CharacterVoiceExtractor` 的 LLM 调用失败 | 中 | 补全失败但不影响写作 | 用 try-catch 包裹，失败回退到基本字段 |
| 角色卡格式不规范导致解析错误 | 中 | 部分角色字段缺失 | 提供明确的格式规范文档，解析失败给默认值 |
| 与现有实体存储格式不兼容 | 低 | 数据写入失败但不丢失 | 仔细核对 `Entity` schema 与提取输出 |

### 4.2 回滚策略

如果升级后出现严重问题:
```bash
# 1. 回退代码
git checkout v1.5.0 -- packages/core/src/utils/character-voices.ts
git checkout v1.5.0 -- packages/core/src/pipeline/runner.ts
git checkout v1.5.0 -- packages/core/src/agents/entity-extractor.ts

# 2. 重新编译
cd packages/core && npx tsc
cd packages/cli && npx tsc

# 3. 清理生成的角色数据（可选）
rm -f books/*/story/character_voices.json
```

---

## 五、成功标准（Success Criteria）

1. ✅ **功能**: 写新章节时，只要 `story/roles/*.md` 存在角色卡，圆桌讨论必定运行
2. ✅ **数据**: `character_voices.json` 自动生成并包含可解析的角色数据
3. ✅ **可观测**: `inkos doctor` 和写作日志中可清晰看到角色讨论是否运行
4. ✅ **工具**: `inkos characters` 命令可诊断和管理角色数据
5. ✅ **自动化**: 章节中出现的新角色自动写入 `entities.db`，后续章节自动识别
6. ✅ **测试**: 所有新增单元测试通过，现有测试无回归失败
7. ✅ **编译**: `npx tsc --noEmit` 对 core 和 cli 两个包 0 错误

---

## 六、预估工作量

| 迭代 | 预估工时 | 核心风险 |
|------|----------|---------|
| I1. roles/ 目录解析器 | 2-3 h | Markdown 解析鲁棒性 |
| I2. 数据源优先级调整 | 1 h | 日志格式统一 |
| I3. 后写实体提取 | 2-3 h | LLM 调用延迟与错误处理 |
| I4. 角色声音自动更新 | 1-2 h | LLM 调用失败回退 |
| I5. CLI 工具命令 | 2 h | 命令注册与参数解析 |
| I6. 可观测性增强 | 1 h | 日志格式一致性 |
| I7. 启动脚本更新 | 0.5 h | Windows 批处理语法 |
| I8. 角色卡格式规范 | 1 h | 文档清晰度 |
| **总计（不含测试）** | **~12 h** |
| Phase A 单元测试 | 3-4 h | Mock 覆盖完整 |
| Phase B 集成测试 | 2-3 h | Pipeline mock 复杂度 |
| Phase C E2E 验证 | 1-2 h | 手动流程验证 |
| **总计** | **~18-22 h** |

---

## 七、依赖关系图

```
I1 (roles/ 解析器)
  ↓
I2 (数据源优先级) ← 依赖 I1 的 collectVoicesFromRolesDir()
  ↓
I6 (可观测性) ← 依赖 I2 的角色加载函数
  ↓
I5 (CLI 工具) ← 依赖 I1+I2+I6 的所有函数
  ↓
I3 (实体提取闭环) ← 依赖 I1-I2 的基础数据流
  ↓
I4 (声音补全增强) ← 依赖 I3 的 entities.db 填充
  ↓
I7 (启动脚本) ← 独立，仅需编译后可运行
  ↓
I8 (格式规范文档) ← 依赖 I1 的解析规则反向推导
```

**可并行**: I6、I7 可与 I1-I2 并行开发  
**可延迟**: I4 是增强功能，可在 I1-I3 完成后作为后续优化
