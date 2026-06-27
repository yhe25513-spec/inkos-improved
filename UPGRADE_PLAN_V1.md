# InkOS 升级计划 V1 — 借鉴 GitHub Writing-Skill 生态的 6 条核心写作方法论

> 制定日期：2026-06-18
> 适用范围：`packages/core`（核心写作引擎），副作用到 CLI/Studio 的 Pipeline 输出
> 风险等级：低-中（类型定义 SchemaVersion 会升级为 3，向前兼容写好的数据）
> 前置条件：当前仓库的 `v1.7.0+` 代码，已通过 `npm run test:core`

> **文档更新记录**
> - v1.0（2026-06-18 初版）：6 条写作方法论升级（章节 1-6）
> - v1.1（2026-06-18 增补）：加入 4 条架构与生态升级（章节 7-10），发现角色 Agent 与信息边界检查器被实现但未接入管线的问题

---

## 0. 本计划的核心理念

InkOS 目前已经是一个"能把小说写对"的引擎——人物一致性、伏笔追踪、角色关系、剧情节奏都有保障。但经过完整代码审查，发现两个**关键缺口**：

1. **写作质量层缺口**：在"把小说写得**让人想读**"这一层上还有明显的提升空间（章节 1-6 解决）。
2. **架构与生态层缺口**：已经实现的角色 Agent 系统（`writers-room/`）、信息边界检查器（`info-boundary.ts`）、角色圆桌（`character-roundtable.ts`）**完全没有被写作管线调用**——这是"被实现但未被使用"的死代码（章节 7-9 解决）。
3. **生态层缺口**：仅有 1 个 SKILL.md，而 ClawHub 平台有 97 个、lingfengQAQ/webnovel-writer 有 7 个（章节 10 解决）。

这就是我们从 GitHub 写作社区（尤其是 `khazix-skills`、`lingfengQAQ/webnovel-writer`、ClawHub 生态）里学到的东西：**好小说不是"信息正确"的，而是"有张力、有呼吸、有节奏、有意外"的；同时还需要一个能让方法论被持续使用和复用的生态。**

本计划聚焦 10 条升级，其中 1-6 条是写作方法论，7-10 条是架构与生态。

---

## 升级清单总览

| # | 名称 | 借鉴来源 | 影响文件 | 改动量 | 收益级别 |
|---|------|---------|---------|--------|---------|
| 1 | 信息揭示方式的硬约束（禁止 Exposition 模式） | khazix-writer "信息是聊着聊着顺手掏出来的" | writer-prompts.ts, en-prompt-sections.ts, post-write-validator.ts | ~400 行 | S |
| 2 | Hook 账本增加 "回环呼应 / Chekhov's Gun" 字段 | khazix-writer "伏笔必须回环，不是一次性工具" | models/runtime-state.ts, writer-prompts.ts, hook-ledger-validator.ts, consolidator.ts | ~200 行 | S |
| 3 | 句子级节奏控制（长短句交替 / 短句子炸弹） | khazix-writer "段落形状都一样就是 AI 文" | post-write-validator.ts, writer-prompts.ts | ~150 行 | A |
| 4 | 具体化 vs 抽象描述检测（"他很紧张"→"指节叩了七次"） | khazix-writer "用具体细节代替概括性陈述" | post-write-validator.ts, ai-patterns.ts, writer-prompts.ts | ~100 行 | A |
| 5 | 角色主动判断检测（主角必须对局势发表判断） | hv-analysis "纵轴角色行为 → 判断 → 行动" | writer-prompts.ts (自检清单) | ~80 行 | B+ |
| 6 | 英文写作规则强化（对齐中文同等力度） | khazix-writer / 开源写作社区英文规范 | en-prompt-sections.ts, post-write-validator.ts | ~120 行 | A |
| 7 | **角色 Agent 接入写作管线**（CharacterRoundtable / DiscussionEngine） | 当前死代码复活 | pipeline/runner.ts, character-roundtable.ts, writers-room/* | ~150 行 | **S** |
| 8 | **信息边界检查器接入审稿管线**（InfoBoundaryChecker） | 当前死代码复活 | pipeline/runner.ts, utils/info-boundary.ts | ~100 行 | **S** |
| 9 | **动态角色 Agent 生成器**（替代硬编码 default-personas） | lingfengQAQ/webnovel-writer 合同系统 | 新增 agents/character-agent-generator.ts, consolidator.ts, agents/writers-room/personas.ts | ~250 行 | **S** |
| 10 | **写作 Skill 扩充**（从 1 个扩展到 8+ 个） | ClawHub 生态 + lingfengQAQ/webnovel-writer 7 个 skill | skills/* 目录 | ~600 行（每个 skill 一个 SKILL.md） | **A** |

---

## 1. 信息揭示方式的硬约束 — 禁止 Exposition 模式

### 1.1 问题诊断

当前 `writer-prompts.ts` 的 `buildCoreRules`（中文）和 `en-prompt-sections.ts` 的 `buildEnglishCoreRules`（英文）里，对于"禁止整段背景介绍"的约束是存在的，但 **只对黄金三章（前 3 章）有高优先级约束**。一旦到了中段，Writer 经常写出：

> "这个大陆上存在着三种修炼体系，分别是……" （整段 exposition，读者直接跳过）

> "他们所在的这个国家建立于三百年前，本来是……" （元叙述式的背景交代）

这种写法在中文网文和英文小说里都会直接打断代入感。**它的本质问题是：叙述者越位成为导游。**

### 1.2 借鉴的方法论

khazix-writer 的核心规则（直接翻译）：

> "知识是聊着聊着顺手掏出来的，不要'下面我来科普一下'。任何世界观/设定/背景信息必须附着在某个具体动作或对话上才能出现。正确方式：'他把灵石按进凹槽——灵石上刻着七阶以上方可驱动，他才五阶。'错误方式：'这个世界的灵石分九阶……'"

### 1.3 具体修改

#### 修改点 1.3.1 — `agents/writer-prompts.ts`

**函数 `buildCoreRules(lengthSpec)`**（`writer-prompts.ts` 导出函数）：

- 在 `## 叙事技法` 一节中，把原来的第 9 条 "信息分层植入" 拆成两条硬规则，并且提升到规则列表的**最前面**（当前在中间）：
  - **新增硬规则 1**：任何世界观/设定/背景信息，必须附着在**某个具体动作或对话**上才能出现。
  - **新增硬规则 2**：禁止以"这是一个……的世界/大陆/国家/时代/体系"开头的整段信息揭示。

- 在反例表中新增两行：
  ```
  | ✗ "这个大陆上存在三种修炼体系" → ✓ "他把灵石按进凹槽，灵石上刻着七阶以上方可驱动，他才五阶" | 信息必须绑定动作
  | ✗ "故事发生在三百年后的世界"    → ✓ 让三百年这个数字通过角色对话中的某个具体事件自然带出       | 禁止时代背景式开篇
  ```

**函数 `buildWritingCraftCard("zh")`**（`writer-prompts.ts` 导出函数）：

- 在"写作铁律"列表的最上面插入一条：
  - **信息揭示铁律**：不写"这是一个……的世界"。任何背景信息必须通过角色正在做的事、正在说的话、正在反应的对象带出来。

**函数 `buildPreWriteChecklist(book, gp)`**（`writer-prompts.ts` 导出函数）：

- 在现有自检清单的前 5 条中插入一条新问题（变成第 3 条，后续自动顺延）：
  - **「本章是否有整段背景介绍？」** 如果有，删掉整段，把信息重新附着到动作或对话上。

#### 修改点 1.3.2 — `agents/post-write-validator.ts`

- 新增 `EXPOSITION_PATTERNS` 正则列表（对标你已有的 `META_NARRATION_PATTERNS`，搜索 `META_NARRATION_PATTERNS` 即可定位）：
  ```
  /^这是一个[\u4e00-\u9fa5]{2,20}的(?:世界|大陆|国家|时代|体系|社会|星球)\b/,
  /^这个(?:世界|大陆|国家|时代|体系)上[，,]?/,
  /^在这个(?:世界|大陆|国家|时代|体系)里[，,]?/,
  /^故事发生在[一二三四五六七八九0-9]*百年?[前之后]/,
  /^话说(?:当年|从前|古时候)[，,]?/,
  /^(?:这个|那个|该)(?:组织|家族|门派|公司|机构|教会)\s*(?:建立于|成立于|创立于)/,
  ```
- 在 `validatePostWrite()` 主函数中增加一条检测：每命中一次 → 一条 `severity: "error"` 的 violation。

#### 修改点 1.3.3 — `agents/en-prompt-sections.ts`

**函数 `buildEnglishCoreRules(_book)`**（`writer-prompts.ts` 英文规则函数）：

- 在 `### Narrative Technique` 一节中，把第 9 条 "Information layering" 升级为**单独一节**，并加入硬规则：
  ```
  ### Information Reveal — HARD RULES (every chapter, not only the first three)
  - Any worldbuilding / lore / backstory / background fact must ride on a specific action, line of dialogue, or object — never as a standalone paragraph.
  - ✗ "This continent has three cultivation systems, ranked..." → ✓ "He slotted the spirit stone into the groove. The stone bore a rank-seven engraving. He was rank-five."
  - ✗ "The story takes place three hundred years after..." → ✓ Let "three hundred years" surface through something a character says or finds or reacts to.
  - Never open a paragraph with "this world / this continent / this kingdom / this era / this system" followed by pure explanation.
  ```

- 在 `### Beat Density & Rhythm` 之前插入上面这一段完整的硬规则小节。

**函数 `buildEnglishAntiAIRules()`**（`writer-prompts.ts` 英文去 AI 味规则函数）：

- 在反例表中新增 2 行：
  ```
  | "This was a world where..." | [Make a character discover / say / do something that implies it] | Info must ride on action/dialogue/object
  | "The organization was founded in..." | [Let a character find a plaque / mention the date in dialogue] | Institutional exposition = reader skip
  ```

- 在 `validatePostWrite()` 对应的英文分支中增加同等强度的正则检测：
  ```
  /^This is a (?:world|continent|kingdom|country|empire|era|age|system|society) of/,
  /^In this (?:world|continent|kingdom|country|empire|era|age|system)\b/,
  /^This (?:world|continent|kingdom|country|empire) (?:has|had|is|was)\b/,
  /^The story takes place \d+ years?/
  ```

### 1.4 验收标准

- [ ] 当用户写一个包含"这是一个……的世界"整段的草稿时，post-write validator 返回至少 1 条 error-level violation。
- [ ] 英文同等行为触发同一条检测。
- [ ] `npm run test:core` 中 `ai-patterns.test.ts` 和 `post-write-validator.test.ts`（需新建）全部通过，其中至少 3 个用例专门针对 exposition 检测。

---

## 2. Hook 账本增加 "回环呼应 / Chekhov's Gun" 字段

### 2.1 问题诊断

你的 `HookRecord`（`models/runtime-state.ts` 导出的 HookRecordSchema / HookRecord 类型）已经非常完备：hookId、startChapter、status、dependsOn、coreHook、halfLifeChapters、advancedCount、promoted…… 但缺少一项关键能力：

> **"之前章节提到过这个 hook 的核心物件/信息吗？"**

当前 Writer 在兑现一个 hook 时，只知道"要兑现 H007"，不知道"H007 在第 3 章里是以'胖虎借条'形式埋下的"。结果就是：**一个 hook 在第 3 章埋下，在第 10 章兑现，但中间章节主角完全没有"惦记它"的痕迹。** 读者会觉得这个伏笔是作者后加的。

### 2.2 借鉴的方法论

khazix-writer 对 Chekhov's gun 的回环规则（翻译+扩展）：

> "第一章墙上挂着枪，第三章一定要响。不仅要响，主角在第 2 章里还得**主动看它一眼**，也许还说了一句'这把枪是谁的'——让读者知道这东西在主角意识里。"

翻译成工程术语：**每个 hook 必须有自己的 "seed text"（埋下时的原文片段）和 "callback history"（中间章节里被唤起过的记录）。** 在兑现时，Writer 必须先回读 seed text，然后写一个"主角主动想起或提到"的自然句子。

### 2.3 具体修改

#### 修改点 2.3.1 — `models/runtime-state.ts`

**`HookRecordSchema`（第 28-49 行）：** 增加两个字段（放在 `promoted` 之后）：

```typescript
// Phase 8 — Chekhov's Gun callback fields.
// seedText: 这个 hook 最早埋下时的原文片段（不超过 80 字），Writer 兑现时会读它来写回环句。
// callbackFrom: 中间哪些章节里主角/角色"主动惦记或提到"过这个 hook 的核心元素。
//               值是章节号数组，如 [3, 7, 9]。长度越长，兑现时越有"读者记得"的感觉。
seedText: z.string().max(200).default(""),
callbackFrom: z.array(z.number().int().min(0)).default([]),
```

> 注意：`zod` 的 schemaVersion 保持不变或升级为 3——两者都 `.optional() / .default()`，所以旧数据 100% 兼容。

#### 修改点 2.3.2 — `agents/consolidator.ts` + `agents/writer.ts`（审查后调整：分两阶段）

**原方案（审查后弃用）**：让 Consolidator 从正文中"自动抽取" seedText。
问题是这是一个**复杂的 NLP 问题**——"从一段几百字的正文中精确抽取与某个特定 hook 相关的 ≤80 字片段"，语义理解要求高，用正则很难做对。

**新方案（Phase A + Phase B）**：

**Phase A（v1，先实现，零 NLP 复杂度）**：
让 **Writer** 在写正文时，自己把 hook 的 seedText 写入 `UPPD_HOOKS` 段。格式扩展：

```markdown
[UPPD_HOOKS]
H001  PLANTED  status=open  startChapter=3  seed_text=胖虎把皱巴巴的借条拍在桌上
H007  PLANTED  status=open  startChapter=5  seed_text=玄关鞋架上多了一双陌生的黑色女鞋
```

- `seed_text` 是** hook 埋下时**的原文片段（Writer 自己写的那段），不超过 80 字。
- Consolidator 的工作从"抽取"简化为"解析 `|` 分隔的 key=value 并写入 HookRecord.seedText"。
- 这是**最可靠、最直接的方案**，Writer 自己写的内容自己最清楚。

**Phase B（v2，后续可选）**：
如果 Phase A 运行稳定，后续可以加一个"正文回扫"——Consolidator 在写好的章节里扫描 hook 核心名词是否出现，出现一次就把当前章节号 append 到 `callbackFrom` 数组。这一步只是"记录有回环"，不再抽取文本。

- 当 Consolidator 检测到正文里有角色"主动提到"一个已有 hook 的核心物件时（如前文 hook 提到"胖虎借条"，正文中出现"借条"、"那张纸"、"胖虎留下的东西"）——把当前章节号 append 到 `callbackFrom`。

#### 修改点 2.3.3 — `agents/writer-prompts.ts`

**函数 `buildChapterMemoContract("zh", governed)`**（`writer-prompts.ts` 导出的 hook 账约束函数）：

- 在"本章 hook 账"的硬对应规则中，在现有规则后面追加一段：
  ```
  如果某 hook 在 hook ledger 中带有 seedText（原始埋下时的原文片段）和 callbackFrom（中间被唤起过的章节），正文里必须有一处自然唤起——不是"他记得借条"这种直白内心独白，而是主角把 seed text 里的某个细节"顺手提一下"。
  示例：seedText="胖虎把皱巴巴的借条拍在桌上" → 正文回环句可以是"他的指尖在桌面上无意识地画了几圈——那桌板上还留着胖虎拍借条时的凹痕"。
  如果 callbackFrom 里已有 ≥2 个章节，回环句可以更隐蔽（一个眼神、一个停顿、一个物件的触感）；如果 callbackFrom 是空数组，说明这是一个"沉睡的 gun"——回环句必须更显眼，让读者被提醒。
  ```

**函数 `buildChapterMemoContract("en", governed)`**（对应英文版）： 增加同等内容的英文版本。

#### 修改点 2.3.4 — `utils/hook-ledger-validator.ts`

- 在 `validateHookLedger(memo, content)`（在 `utils/hook-ledger-validator.ts` 中，被 `pipeline/runner.ts` 的审稿阶段调用）中，新增一条检测：
  > 如果 hook ledger 里某个 hook 的 `seedText` 非空，且 `callbackFrom.length >= 1`（或 `startChapter < currentChapter - 3`），但正文里**完全没有**对 seedText 里任何核心名词的提及——标记一条 warning 级 violation，建议在兑现前加一个回环唤起句。

### 2.4 验收标准

- [ ] `HookRecord` 增加 `seedText: string` 和 `callbackFrom: number[]` 字段，对旧 markdown hook 数据 100% 向后兼容。
- [ ] 当一个 hook 被设置了 seedText 后，Writer 在后续章节里兑现它时，Auditor 能检测到"正文里是否有回环唤起"。
- [ ] `npm run test:core` 中新增 `hook-callback.test.ts`（10-15 个用例）全部通过。

---

## 3. 句子级节奏控制 — 长短句交替 / 短句子炸弹

### 3.1 问题诊断

你已经有**段落级**节奏检测（`Paragraph Length Drift`，`连续短段检测`）。但是，**句子级**的节奏是盲区。AI 写出来的文章最大的通病之一是：**句子长度几乎完全一样**——每句 12-18 字，像节拍器一样机械稳定。人读起来会犯困，但段落级检测不会报警。

相反，人类写作的特征是：**长短句交替，偶尔一个"一句话独立成段"的重击**（短句子炸弹，12 字以内）。

### 3.2 借鉴的方法论

khazix-writer 的 rhythm rule：

> "每 500 字自问一次：这一段里有没有一句话是短句子独立成段？如果全是均匀长度的句子，故意写一句 12 字以内的独立句子段落——让读者在这里停顿、回味。但一个短段后必须接回正常长度段落，禁止 3 连短段。"

### 3.3 具体修改

#### 修改点 3.3.1 — `agents/post-write-validator.ts`

- 在已有 `ParagraphShape` 接口旁新增 `SentenceRhythm` 接口：
  ```typescript
  interface SentenceRhythm {
    readonly sentences: ReadonlyArray<string>;
    readonly sentenceLengths: ReadonlyArray<number>;   // 每个句子的字数
    readonly averageLength: number;
    readonly stdDev: number;                            // 标准差——越小越机械
    readonly monotonousRuns: ReadonlyArray<{ start: number; length: number }>;  // 连续相似长度的 run
    readonly shortBombSentences: number;                // ≤12 字的独立短句子
    readonly shortBombLocations: ReadonlyArray<number>; // 在文中的位置
  }
  ```

- 新增 `analyzeSentenceRhythm(content: string, language: "zh" | "en"): SentenceRhythm` 函数：
  - 中文按 `[。！？；]|\.(?=\s|$)|!(?=\s|$)|\?(?=\s|$)` 断句，英文按 `[.!?]|\n\n` 断句。
  - 计算每句字数/词数，计算 stdDev（标准差）。
  - 找到 "连续 ≥5 个句子的长度都落在 [mean-1, mean+1] 窄带" 的 run——这是"机械节拍器"。
  - 找到 ≤12 字 / ≤5 词的短句子炸弹。

- 在 `validatePostWrite()` 中新增两条 violation：
  1. **节奏太平**（stdDev < 阈值 且 有 ≥1 个长 monotonous run）→ Warning。
  2. **500 字内无短句子炸弹**（如果本章超过 800 字但 0 个 ≤12 字独立短句子）→ Warning。
  3. **3 连短段已经有检测，保留**（你当前已有 `连续 3+ 短段` 检测——不要与这条重复）。

#### 修改点 3.3.2 — `agents/writer-prompts.ts`

**函数 `buildProseExecutionRules("zh")`**（`writer-prompts.ts` 导出函数）：

- 在现有内容中插入一段（在"高潮必须演出，不许概述"之前）：
  ```
  **句子级节奏。** 一句话就是一个呼吸。长短句交替写，不要连续 5 句都是 12-18 字的均匀长度——那是节拍器，读者会走神。每写 500 字，故意放一句 ≤12 字的短句独立成段——给读者一个"重击"。短句子炸弹用过一次后，下一句必须是 ≥40 字的叙事段落把节奏接回来。
  正反例：
  - ✗ 他推门走进去。房间里很暗。他看到了桌子。桌子上有东西。东西看起来很奇怪。（5 句全是 7-10 字，节拍器）
  - ✓ 他推门走进去。一股陈腐的气味从屋子深处涌出来，混着旧纸、蜡、和什么东西腐烂的甜腥气，呛得他往后退了半步。桌。（正常-长句-短句子炸弹——节奏有起伏）
  ```

**函数 `buildProseExecutionRules("en")`**（对应英文版）： 增加英文版本的同等内容。

### 3.4 验收标准

- [ ] 一段 "5 句连续 12-18 字节拍器" 的中文文本，post-write validator 返回 1 条 Warning。
- [ ] 一段 2000 字但零个 ≤12 字短句子的文本，返回 1 条 Warning。
- [ ] `npm run test:core` 中 `sentence-rhythm.test.ts`（需新建，8-10 个用例）全部通过。

---

## 4. 具体化 vs 抽象描述检测

### 4.1 问题诊断

你在 `writer-prompts.ts` 的"去 AI 味铁律"中已经有情绪外化的例子（"他感到愤怒"→"他捏碎了茶杯"）。但是检测层面缺失——**post-write validator 不会自动把"他很紧张"、"她很美丽"、"这非常重要"这种空洞形容词标记出来。**

结果是：Reviser 在收到 Auditor 的"重写这段"指令时，不知道具体要改哪些句子——它只能笼统地改进，导致经常只是把"他感到愤怒"改成"他心里涌起一阵怒火"，**换汤不换药。**

### 4.2 借鉴的方法论

khazix-writer 的 "Concrete beats Abstract" 规则：

> "每一个形容词背后都应该追问：作者如果把这个形容词换成一句具体的画面或动作，读者会不会更有感觉？'他很紧张'→'他的指节在方向盘上叩了七次'。'她很漂亮'→'前台的两个男生偷着看她，忘了给客人办入住'。"

### 4.3 具体修改

#### 修改点 4.3.1 — `agents/post-write-validator.ts`

- 新增 `ABSTRACT_ADJECTIVE_PATTERNS` 列表（中文+英文）：

  ```
  // 中文
  /(?:他|她|它|他们|她们|这|那|这个|那个|这是|那是)[\s，,]*(?:很|非常|极其|十分|特别|格外|相当|异常|无比|分外)\s*(?:紧张|愤怒|悲伤|高兴|兴奋|震惊|难过|高兴|美丽|漂亮|帅气|重要|关键|危险|安全|安静|热闹|古老|崭新|豪华|简陋|干净|脏乱|强大|弱小|聪明|愚蠢|善良|邪恶|热情|冷漠|勇敢|懦弱|神秘|普通|普通|独特|奇怪|正常|异常|真实|虚假|真诚|虚伪|满意|失望|满足|疲惫|精神|放松|紧张|轻松|沉重|轻快|温暖|寒冷|凉爽|炎热)/,
  /(?:真是|实在是|确实是|简直是|可谓是)\s*[\u4e00-\u9fa5]{2,8}(?:。|！|，|；)/,
  // 英文（将在 en 分支中使用）
  /\b(?:he|she|it|they|this|that)\s+(?:was|were|is|are|felt|seemed|looked|sounded)\s+(?:very|extremely|incredibly|remarkably|unusually|particularly|especially|surprisingly|truly|really|quite|rather|fairly|pretty|so|too|such a)\s+(?:nervous|angry|sad|happy|excited|shocked|beautiful|pretty|handsome|important|crucial|dangerous|safe|quiet|loud|old|new|ancient|modern|huge|tiny|big|small|smart|stupid|kind|evil|warm|cold|brave|cowardly|mysterious|ordinary|unique|strange|normal|real|fake|genuine|false|sincere|honest|satisfied|disappointed|tired|exhausted|relaxed|tense|calm|heavy|light)\b/i,
  ```

- 在 `validatePostWrite()` 中调用这个检测。命中时的 violation description 要给出**具体一个改写示例**——不再是"考虑更具体的描写"，而是"示例改写：'他的指节在方向盘上叩了七次'（如果上下文是驾驶场景）"。

#### 修改点 4.3.2 — `utils/ai-patterns.ts`

- 把这个检测逻辑的核心部分提取到 `ai-patterns.ts`，命名为 `analyzeAbstractDescription(content: string, language: "zh" | "en")`，让它可以被其他模块（比如 Auditor 的 prompt 生成）复用。

#### 修改点 4.3.3 — `agents/writer-prompts.ts`

**函数 `buildAntiAIExamples()`**（`writer-prompts.ts` 导出函数）：

- 在 `### 情绪描写` 正反例表后面新增一个小节 `### 空洞形容词`，表格形式：
  ```
  | ✗ "他很紧张。"                           | ✓ "他的指节在方向盘上叩了七次。"           | 具体动作外化情绪
  | ✗ "这个地方非常重要。"                    | ✓ "墙上的黄铜牌子刻着：1867。"              | 具体物件或细节代替判断词
  | ✗ "她真是个善良的好人。"                   | ✓ "她在每个乞丐的碗里都放了钱，即使她自己只剩三块。" | 行为揭示品质
  | ✗ "这是一个危险的地方。"                   | ✓ "他注意到巷口那个男人的左手一直没从口袋里拿出来过。" | 通过观察制造氛围
  ```

- 在 `buildEnglishAntiAIRules()` 中同步这些例子的英文版本。

### 4.4 验收标准

- [ ] "他很紧张。" 单独一句 → post-write validator 返回 1 条 "抽象形容词" violation，带一个具体改写建议。
- [ ] "He was very nervous." 同等触发。
- [ ] `npm run test:core` 中 `ai-patterns.test.ts` 新增 5 个用例，全部通过。

---

## 5. 角色主动判断检测

### 5.1 问题诊断

AI 写小说时常见一个问题：**主角是摄像机，不是人。** 他看到 A、听到 B、发生 C，但他自己从不"对局势下判断"。读者感受不到他有独立意志。

你当前的 `人物塑造铁律` 里有 "人设一致性" 和 "拒绝工具人"，但没有**写作层面**的可执行检测——"每章主角必须至少一次对当前局势发表明确判断"。

### 5.2 借鉴的方法论

hv-analysis 的 "纵轴信息 → 判断 → 行动" 模型（翻译+简化）：

> "一个角色在章节里应该经历三个层次：获取信息 → 对信息下判断 → 采取行动。如果只有'获取信息'没有'判断'，读者会觉得这个角色是被动的——他在被剧情推着走，而不是推着剧情走。"

### 5.3 具体修改

#### 修改点 5.3.1 — `agents/writer-prompts.ts`

**函数 `buildCoreRules(lengthSpec)`**（`writer-prompts.ts` 导出函数）：

- 在 `## 人物塑造铁律` 中新增一条（第 3 条的位置，原有第 3 条及以后顺延）：
  ```
  角色必须有判断。每章至少有一处，主角（或本章 POV 角色）对当前局势下了一个明确的判断——不是叙述者告诉你"他意识到危险"，而是他自己在台词、动作或内心独白里做出了判断（哪怕判断错了）。
  正反例：
  - ✗ "他意识到情况不对。"（叙述者代劳）
  - ✓ "不能再等了。他把手机调成静音，塞回了口袋。"（判断通过行动外化）
  - ✓ "是陷阱。"他低声对自己说，脚步已经往后退。（判断通过极短台词直接给出）
  ```

**函数 `buildPreWriteChecklist()`**（`writer-prompts.ts` 自检清单函数）：

- 在自检清单中插入一条（放在"角色行为是否符合人设"之后）：
  > **「本章主角对当前局势下了明确判断吗？」** 如果整章读完，读者说不出"主角认为当前情况是怎样的"，那就缺了判断层——补一句极短的判断台词或一个判断性的动作。

#### 修改点 5.3.2 — `agents/en-prompt-sections.ts`

- 在 `### Character Rules` 中同步加入判断规则。
- 在英文 `Pre-write checklist` 中同步同一条问题。

### 5.4 验收标准

- [ ] Writer 的 system prompt 中明确包含"角色必须有判断"这一条硬规则。
- [ ] 在 Auditor 的自检流程中，中文和英文版本都包含这个问题。
- [ ] `npm run test:core` 已有的 `integration.test.ts` 中增加一个端到端用例：让系统写一段"只有动作没有判断"的章节，Auditor 应至少返回 1 条相关 issue。

---

## 6. 英文写作规则强化

### 6.1 问题诊断

你的中文规则体系非常扎实（黄金三章、去 AI 味、段落节奏、情绪外化反例表、写作铁律、创作宪法、代入感支柱……）。英文版本有对应但力度偏弱——比如英文的 `buildEnglishAntiAIRules` 只有 7 条 Iron Laws，而中文 `buildCoreRules` 有十几条细规则。

更关键的是，**英文版本缺少中文已经有的 "短段硬阈值 / 连续短段禁令 / 高潮必须演出不许概述 / 段落形状约束" 等硬尺规则**。这些硬规则是 InkOS 比普通 LLM 写作更强的核心竞争力——但它目前只在中文场景生效。

### 6.2 借鉴的方法论

综合 GitHub 英文写作社区 (khazix-writer 英文写作规则、reddit r/writing 最佳实践、LongNovelGPT 的英文规范)，我们把 6 类硬尺规则补齐到英文版本。

### 6.3 具体修改

#### 修改点 6.3.1 — `agents/en-prompt-sections.ts`

**函数 `buildEnglishCoreRules()`**（`writer-prompts.ts` 英文规则函数）：

- 在现有内容末尾追加：
  ```
  ### Concrete over Abstract (hard rule)
  - "He was very nervous" → "He tapped the steering wheel seven times."
  - "This place was dangerous" → "He noticed the man at the alley mouth never took his left hand out of his pocket."
  - Any bare adjective standing alone as a complete thought is a soft spot — ask what a camera would show, and write that instead.

  ### Character judgment
  - Every chapter, the POV character must make at least one explicit judgment about their situation — spoken aloud, acted on, or shown through a decision.
  - ✗ "He realized something was wrong." (narrator fiat)
  - ✓ "Not safe. He slipped the phone onto silent and stuffed it back." (judgment through action)
  - ✓ "Trap," he said under his breath, already stepping back. (judgment through ultra-short dialogue)

  ### Sentence rhythm
  - Mix short and long sentences. Five sentences in a row of nearly identical length = mechanical cadence = reader fatigue.
  - Every ~500 words, drop one sentence of ≤12 words / ≤5 words as a standalone paragraph — a "short-bomb sentence" that gives the reader a beat of silence. After one short-bomb, the next paragraph must be a normal-length narrative paragraph that regathers the action.
  - Never stack 3+ one-sentence paragraphs in a row.

  ### No information dump masquerading as narration
  - Never start a paragraph with "This is a world of..." / "In this kingdom..." / "The organization was founded in..." followed by pure explanation.
  - Every worldbuilding detail must ride on an action, a line of dialogue, or an object.

  ### Climax — perform, don't summarize
  - The high-stakes beat must be written beat by beat: action, dialogue, sensory detail, pauses, pacing.
  - ✗ "Then he saved them, the police arrived, and the antagonist was arrested."
  - ✓ Write the fight, the hesitation, the mistake, the reversal — one concrete moment at a time.
  ```

**函数 `buildEnglishAntiAIRules()`**（`writer-prompts.ts` 英文去 AI 味规则函数）：

- 在现有反例表中增加若干行，让英文表的丰富度对齐中文表（目前英文表只有 5 行，中文表有 10+ 行）：
  ```
  | "It was an important moment for everyone involved." | [Write what one specific character does / says] | Authorial summary = reader skip |
  | "The room was filled with tension." | A spoon clattered off the edge of a saucer and nobody moved to catch it. | Physical detail beats abstract label |
  | "He made a decision." | He stood up. | Decision = action, not a tag-line |
  | "She was not like other girls." | She knew every constellation visible from the roof. | Show, don't tell + ban "not like other X" construction |
  ```

#### 修改点 6.3.2 — `agents/post-write-validator.ts`

- 让 `EXPOSITION_PATTERNS`、`SENTENCE_RHYTHM` 检测都支持英文语言分支（当前只有中文 pattern）。你已有 `languageOverride: "zh" | "en"` 参数，直接复用它。

### 6.4 验收标准

- [ ] 英文章节写完后，post-write validator 能对 exposition、机械节奏、空洞形容词三类问题各返回 ≥1 条 violation（如果输入文本里真的有这些问题）。
- [ ] 英文系统 prompt 的长度/规则量与中文版本大致对齐（中文≈15 条规则，英文应达到≈12+ 条规则）。
- [ ] `npm run test:core` 英文相关用例全部通过。

---

# 架构与生态层升级（v1.1 增补）

> **本部分（章节 7-10）针对的是 v1.0 之后发现的关键缺口：**
> - 当前代码库存在多套"被实现但未被使用"的角色 Agent 与信息边界子系统
> - 角色 Agent 体系只硬编码了《金箍棒》一套人物，无法适配其他作品
> - SKILL.md 数量远低于社区同类项目

---

## 7. 角色 Agent 接入写作管线（复活死代码）

### 7.1 问题诊断

经过完整代码审查，当前 `packages/core/src/agents/` 目录里存在以下**已实现但未被 `pipeline/runner.ts` 调用**的子系统：

| 子系统 | 路径 | 实现完整度 | 调用情况 |
|--------|------|----------|---------|
| 角色圆桌讨论 | `agents/character-roundtable.ts` | ✅ 完整（Moderator + CriticAgent + 圆桌结果） | ❌ 0 次调用 |
| Writers' Room 多 Agent | `agents/writers-room/*` (4 文件) | ✅ 完整（AgentGraph + DiscussionEngine + Directors + Personas） | ❌ 0 次调用 |
| 信息边界检查器 | `utils/info-boundary.ts` | ✅ 完整（InfoBoundaryChecker + 知识图谱） | ❌ 0 次调用 |
| 对话排练 | `agents/dialogue-rehearsal.ts` | ⚠️ 部分 | ❌ 0 次调用 |

`pipeline/runner.ts` 全文搜索 `writers-room`、`DiscussionEngine`、`character-roundtable`、`InfoBoundaryChecker` 关键字均**零命中**。

**这意味着**：你花时间写的多 Agent 协作架构、角色圆桌讨论引擎、信息边界检查器，**写作时一次都没启动过**——它们是"空中楼阁"。

### 7.2 借鉴的方法论

lingfengQAQ/webnovel-writer（2026-03 爆火项目）的设计核心是"Agent 三件套"：

```
Context Agent (读)  → Data Agent (写) → Reviewer (审)
```

每个 Agent 都有**明确的调用时机**和**输入输出契约**。InkOS 当前实现了多 Agent 协作的所有零件，但缺少**编排层**把它们串起来。

### 7.3 具体修改

#### 修改点 7.3.1 — `pipeline/runner.ts`：在写作前插入"角色圆桌"阶段

**位置**：`runner.ts` 的 `runChapter` 流程中（搜索 `// 1\. Write chapter` 注释定位写章节阶段），在 `writer.writeChapter()` 调用**之前**插入：

```typescript
// 0. Pre-write roundtable: 让每个登场角色从自身视角审视本章
if (this.shouldRunRoundtable(writeInput, book)) {
  const { CharacterRoundtable } = await import("../agents/character-roundtable.js");
  const activeCharacters = await this.getActiveCharactersForChapter(
    bookDir,
    chapterNumber,
  );
  if (activeCharacters.length > 0) {
    const roundtable = new CharacterRoundtable(
      activeCharacters,
      this.agentCtxFor("roundtable", bookId),
    );
    const roundtableResult = await roundtable.discuss({
      chapterNumber,
      chapterGoal: writeInput.chapterMemo?.body ?? "",
      plotLine: writeInput.contextPackage?.currentState ?? "",
    });
    // 把圆桌的 constraintsBlock 注入到 Writer 的 context
    writeInput.roleConstraints = roundtableResult.constraintsBlock;
  }
}
```

**新增的两个方法**：
- `shouldRunRoundtable(writeInput, book): boolean` — 默认 true，但允许在 `book.rules` 中配置 `disableRoundtable: true` 关闭
- `getActiveCharactersForChapter(bookDir, chapterNumber): Promise<Entity[]>` — 从 `entity-db.ts` 读取本章出场的核心角色

#### 修改点 7.3.2 — `agents/writer-prompts.ts`：消费 `roleConstraints`

**前置检查（审查后新增）**：
`buildWriterSystemPrompt()` 这个函数名是计划假设的，**实施前必须在 `writer-prompts.ts` 中确认实际的函数名**（很可能叫 `buildChapterSystemPrompt()`、`buildWriterPrompt()`，或内联在一个更大的 prompt builder 中）。
确认方法：在代码仓库里 `grep -rn "systemPrompt\|SystemPrompt\|buildChapter" packages/core/src/agents/writer-prompts.ts`。

确认实际函数名后，修改函数签名——增加一个参数 `roleConstraints: string`，并在 sections 数组开头位置插入：

```typescript
const sections = isEnglish
  ? [
      // ... 现有内容
      roleConstraints,  // ← 新增：从圆桌传过来的角色约束
      buildEnglishGenreIntro(book, genreProfile),
      // ... 其余
    ]
  : [
      // ... 现有内容
      roleConstraints,  // ← 新增
      buildGenreIntro(book, genreProfile),
      // ... 其余
    ];
```

#### 修改点 7.3.3 — `agents/character-roundtable.ts`：暴露 `discuss()` 方法

**前置检查（审查后新增）**：
实施前必须先读 `character-roundtable.ts`，确认 3 件事：
1. 类是否已经有公开方法（`run()` / `evaluate()` / ...）——如果有，直接复用那个方法，不新增；
2. 构造函数签名（constructor 接受哪些参数）——本计划假设它接受 `activeCharacters[]` + `agentCtx`；但实际上可能需要 `llmClient`、`modelName` 等；
3. `RoundtableResult` 的字段名——本计划假设它有 `constraintsBlock` 字段，实际可能叫别的名字。

**确认方法**：`cat packages/core/src/agents/character-roundtable.ts` 读开头 60 行 + 读 `RoundtableResult` 的定义。

确认完成后，在类中新增或修改：

```typescript
export class CharacterRoundtable {
  // ... 现有类

  /** 启动一轮多角色讨论，返回结构化结果 */
  async discuss(input: {
    chapterNumber: number;
    chapterGoal: string;
    plotLine: string;
  }): Promise<RoundtableResult> {
    // 1. 拆解章节意图为讨论议题
    // 2. 每个活跃角色基于自己的人设和视角做 critic
    // 3. 识别角色间冲突（同一个事件两个角色态度相反）
    // 4. 综合成 constraintsBlock
  }
}
```

#### 修改点 7.3.4 — 让 `DiscussionEngine` 作为可选路径

`writers-room/discussion-engine.ts` 是更通用的多 Agent 讨论引擎（不限小说角色，可以讨论任何话题）。**默认使用 `CharacterRoundtable`（更轻量、专为小说设计），把 `DiscussionEngine` 作为 `book.rules.advancedMode: true` 时的可选路径**。

```typescript
// pipeline/runner.ts
if (book.rules?.advancedMode) {
  const { DiscussionEngine } = await import("../agents/writers-room/discussion-engine.js");
  const agentGraph = await this.loadOrGenerateAgentGraph(bookDir, book);
  const engine = new DiscussionEngine(agentGraph, llmClient, model);
  const session = await engine.run({ topic: chapterGoal, rounds: 3 });
  writeInput.roleConstraints = session.finalDecision;
}
```

### 7.4 验收标准

- [ ] 跑一次 `inkos chapter write 1`，验证 console 输出包含 "Running character roundtable..."。
- [ ] `roundtableResult.constraintsBlock` 至少包含 3 个角色的 critique（如果有 ≥3 个 active characters）。
- [ ] 关闭 Roundtable 的开关（`book.rules.disableRoundtable: true`）时，管线不调用 `CharacterRoundtable`，行为与之前一致。
- [ ] `npm run test:core` 中新增 `roundtable.test.ts`（8-10 个用例）全部通过。

---

## 8. 信息边界检查器接入审稿管线（复活死代码）

### 8.1 问题诊断

`utils/info-boundary.ts` 实现了一个完整的 `InfoBoundaryChecker`：

- `getCharacterKnowledge(characterId, chapter)` — 查询某角色在第 N 章已知的所有信息
- `hasKnowledgePath(sourceId, targetId, chapter)` — 检查两个角色之间是否有知识传递路径（直接 / 2度 / 同一组织）
- `check(chapterContent, chapterNumber, speakingCharacters)` — 返回 `InfoBoundaryReport`，含分数和 issue 列表

**但 `pipeline/runner.ts` 没有调用它**。这意味着你的 Auditor 在审稿时**不会发现"角色知道了不该知道的信息"这类逻辑硬伤**。

### 8.2 借鉴的方法论

lingfengQAQ/webnovel-writer 的"防幻觉三定律"：

| 定律 | 说明 | 执行方式 |
|---|---|---|
| 大纲即法律 | 遵循大纲，不擅自发挥 | Context Agent 强制加载章节大纲 |
| 设定即物理 | 遵守设定，不自相矛盾 | Reviewer Agent 内置一致性审查 |
| 发明需识别 | 新实体必须入库管理 | Data Agent 自动提取并消歧 |

"设定即物理"的核心就包括**信息边界**——角色只能基于已掌握的信息行动。

### 8.3 具体修改

#### 修改点 8.3.1 — `pipeline/runner.ts`：在审稿阶段调用 InfoBoundaryChecker

**前置检查（审查后新增）**：
实施前先读 `utils/info-boundary.ts` 确认 2 件事：
1. `InfoBoundaryChecker` 的构造函数签名（是否需要传入 entityDB / bookDir / 其他）
2. `this.extractSpeakingCharacters()` 在 `runner.ts` 中**不存在**，需要**改为复用第 7 章 Roundtable 返回的角色数据**（见 8.3.2）

**位置**：审稿循环中（搜索 `validateHookLedger` 调用位置定位，在每次重写后），增加一次信息边界检查：

```typescript
// 7. 信息边界检查
const { InfoBoundaryChecker } = await import("../utils/info-boundary.js");
const entityDB = await this.loadEntityDB(bookDir);
const boundaryChecker = new InfoBoundaryChecker(entityDB);

// 复用第 7 章 Roundtable 返回的角色数据，不做二次提取
const roundtableResult = pipelineContext.get("roundtableResult");
const speakingCharacters = roundtableResult
  ? roundtableResult.agents.map((a) => a.name)
  : []; // 如果 Roundtable 未启用，退化到空数组

const boundaryReport = boundaryChecker.check(
  finalContent,
  chapterNumber,
  speakingCharacters,
);

// 把 InfoBoundaryIssue 转换为 Auditor 的 issue 格式
const boundaryIssues = boundaryReport.issues
  .filter(i => i.severity !== "low")
  .map(i => ({
    severity: i.severity === "high" ? "critical" as const : "major" as const,
    category: "info-boundary",
    description: i.description,
    suggestion: i.suggestion,
  }));
```

#### 修改点 8.3.2 — 复用第 7 章的角色数据，避免重复提取

**本处是审查后调整：不新增独立的 speaking-character-extractor.ts**。
原因是：章节 7 的 `CharacterRoundtable.discuss()` 返回的结果对象里，已经包含了本次出场的所有角色名（在 `activeCharacters` / `RoundtableResult` 中）。如果再写一份正则提取器，会遇到：

- 对话格式多样（`"XXX。"男人说`、`「XXX」`、`他低低应了一声："……"` 等），漏判率难以控制；
- 引入第二份"说话角色"数据源，需要和 Roundtable 的结果做对齐，反而会引入不一致。

**调整后的方案**：

```typescript
// pipeline/runner.ts — InfoBoundary 阶段
// 直接复用 CharacterRoundtable 产出的角色列表，不做二次提取
const { roundtableResult } = pipeline.previousStageOutput;
const speakingCharacters: string[] = roundtableResult
  ? roundtableResult.agents.map(a => a.name)
  : []; // 如果 Roundtable 未启用（book.rules.disableRoundtable=true），退化为空数组
        // Auditor 会因为空数组报 warning，但不会中断流程
```

> 这样 InfoBoundary 的角色来源与 Roundtable 的角色来源完全一致，不会出现"一边发现了这个角色、另一边没发现"的情况。

#### 修改点 8.3.3 — 让 InfoBoundaryReport 进入最终验收

在 `runner.ts` 的最终 result 对象里增加字段：

```typescript
const result: ChapterPipelineResult = {
  ...existingFields,
  infoBoundaryReport: boundaryReport,  // ← 新增
};
```

让 Studio / CLI 能把信息边界报告作为审稿的"第六维"展示给用户。

### 8.4 验收标准

- [ ] 构造一个测试场景：写一章让"张三"（已知信息：A）说出"B 知道 C"——`InfoBoundaryChecker` 至少返回 1 条 `off_screen_knowledge` 类型的 issue。
- [ ] 角色间通过对话或共同组织已经传递过的信息，不应被误报。
- [ ] `npm run test:core` 中新增 `info-boundary-pipeline.test.ts`（5-8 个用例）全部通过。

---

## 9. 动态角色 Agent 生成器（替代硬编码 default-personas）

### 9.1 问题诊断

`agents/writers-room/default-personas.ts` 中**只硬编码了《金箍棒教鬼做人》一套书的角色**：

```typescript
export const JINGUOBANG_GRAPH: AgentGraph = {
  // 孙悟空、智囊、主神、炼狱、李明、作者、读者
  // 完全绑定《金箍棒》的剧情
};
```

**这意味着**：

- 你换一本书（比如《诡秘之主》同人），这套 persona 完全用不上
- 新书的角色**不会自动成为 Agent**——除非有人手动编辑 `default-personas.ts`
- 角色 Agent 系统实际上是"一次性玩具"

### 9.2 借鉴的方法论

lingfengQAQ/webnovel-writer 的"合同系统"：

> 在 `.story-system/MASTER_SETTING.json` 中存有完整的角色设定。Data Agent 在每次写章节时**自动**从合同里读取角色，并构建 Agent 实例。每个角色就是一个"工作流节点"。

这就是我们要做的：**角色不是硬编码，而是从 entity-db + state 文件动态生成**。

### 9.3 具体修改

#### 修改点 9.3.1 — 新建 `agents/character-agent-generator.ts`

```typescript
// 约 250 行
import type { AgentGraph, AgentPersona, AgentRelationship } from "./writers-room/types.js";
import type { Entity } from "../models/entity.js";
import { EntityDB } from "../state/entity-db.js";

export class CharacterAgentGenerator {
  constructor(private entityDB: EntityDB) {}

  /**
   * 从 entity-db 动态生成 AgentGraph（分两个成熟度）。
   *
   * Phase A (v1): 仅依赖 entity 的静态字段 —— 即使 entity-db 尚未
   * 累积过任何章节也能跑通（用于第一本书、测试环境、以及任何
   * 尚未 consolidate 的章节）。
   *
   * Phase B (v2, 可选): 当 entity-db 里已累积过章节知识时，
   * 将"角色已知信息"附加到 persona prompt。
   */
  async generateGraph(
    bookDir: string,
    opts: { phase: "A" | "B" } = { phase: "A" },
  ): Promise<AgentGraph> {
    const characters = this.entityDB.getActiveCharacters();
    const agents: AgentPersona[] = characters.map(c =>
      this.entityToPersona(c, opts.phase),
    );
    const relationships: AgentRelationship[] = this.extractRelationships(
      characters,
    );
    return {
      agents,
      relationships,
      metadata: {
        name: "动态生成的角色关系图",
        description: `从 entity-db 自动生成，包含 ${agents.length} 个角色（Phase ${opts.phase}）`,
        version: "1.0.0",
        createdAt: new Date().toISOString(),
      },
    };
  }

  private entityToPersona(
    entity: Entity,
    phase: "A" | "B",
  ): AgentPersona {
    return {
      id: entity.id,
      name: entity.name,
      // Phase A 先区分主角/配角 —— 让角色在多 agent 协作中有层级
      role: entity.attributes.isProtagonist ? "protagonist" : "supporting",
      description: entity.description ?? "",
      goals: entity.attributes.goals ?? [],
      personality: {
        traits: entity.attributes.traits ?? [],
        speechStyle: entity.attributes.speechStyle ?? "正常对话",
        forbiddenBehaviors: entity.attributes.forbiddenBehaviors ?? [],
      },
      prompt: this.buildPersonaPrompt(entity, phase),
    };
  }

  private buildPersonaPrompt(entity: Entity, phase: "A" | "B"): string {
    // Phase A (v1): 仅用 entity 的静态字段 —— 不依赖章节累积
    const base = `你是 ${entity.name}。\n${entity.description ?? ""}\n` +
      `核心动机：${(entity.attributes.goals ?? []).join("、")}\n` +
      `说话风格：${entity.attributes.speechStyle ?? "正常"}\n`;

    // Phase B (v2): 当 entity-db 已有章节知识时，加入知识边界
    //   （在迭代 5 + 迭代 6 都完成后，这个分支才会有实际内容）
    if (phase === "B") {
      const known = this.buildKnowledgeBoundarySection(entity);
      return `${base}${known}`;
    }
    // Phase A: 写一个"占位的知识边界声明"，即使没累积过章节也能跑
    return `${base}\n你只能基于已有的人物设定行动，不要主动披露你没有来源的信息。`;
  }

  private buildKnowledgeBoundarySection(entity: Entity): string {
    // 依赖：entity-db 必须先通过 consolidator 累积过章节知识
    const known = this.entityDB.getEntityConnections(entity.id, 2);
    const names = known.entities.map(e => e.name).join("、");
    if (!names) {
      return ""; // 如果还没累积到任何已知信息，不写误导性内容
    }
    return `\n你目前知道的人/事：${names}。\n你不知道的事不要假装知道，不要主动提及。`;
  }
}
```

#### 修改点 9.3.2 — `agents/consolidator.ts`：章节完成后增量更新 AgentGraph

`Consolidator.consolidateChapter()` 完成时调用：

```typescript
// 1. 更新 entity-db
// 2. 重新生成 AgentGraph
const generator = new CharacterAgentGenerator(this.entityDB);
const newGraph = await generator.generateGraph(bookDir);
await saveAgentGraph(bookDir, newGraph);
```

这样每次写完一章，角色 Agent 自动更新。

#### 修改点 9.3.3 — `entities` schema 扩展：增加 persona 必需字段

在 `models/entity.ts` 的 `Entity` type 上确认或扩展（大部分应该已存在）：

```typescript
{
  attributes: {
    isProtagonist?: boolean;     // 是否主角
    goals?: string[];             // 核心目标列表
    traits?: string[];            // 性格标签
    speechStyle?: string;         // 说话风格
    forbiddenBehaviors?: string[]; // 行为禁忌
  }
}
```

如果 attributes schema 不够灵活，**在 generator 里做容错**（缺字段时使用默认空数组）。

#### 修改点 9.3.4 — ArchitectAgent 在创建角色时填入这些字段

`agents/architect.ts` 创建新角色时，把"性格 / 目标 / 说话风格"作为必填字段写入 entity——这样 generator 才能拿到足够信息。

### 9.4 验收标准

- [ ] 跑一本新书：调用 `CharacterAgentGenerator.generateGraph()`，返回的 `AgentGraph.agents.length` 等于 `entityDB.getActiveCharacters().length`。
- [ ] 每个生成的 `AgentPersona.prompt` 字段包含 `name + description + goals + speechStyle + 知识边界` 至少 5 个段落。
- [ ] 章节完成后，`bookDir/agent-graph.json` 自动更新，包含最新的角色和关系。
- [ ] `npm run test:core` 中新增 `character-agent-generator.test.ts`（8-10 个用例）全部通过。

---

## 10. 写作 Skill 扩充（从 1 个扩展到 8+ 个）

### 10.1 问题诊断

当前 `skills/SKILL.md` 数量：**1 个**。

对照表：

| 项目 | Skill 数量 |
|------|-----------|
| 你的 InkOS | **1** |
| ClawHub 平台 | 97 |
| lingfengQAQ/webnovel-writer | 7（init / plan / write / review / query / learn / dashboard） |
| khazix-skills | 多套细分 skill |

这意味着：**你花了大力气写的写作方法论（黄金三章、去 AI 味、节奏、情绪外化……），只对你自己 CLI 有效，外部 Agent 生态无法复用。**

### 10.2 借鉴的方法论

lingfengQAQ/webnovel-writer 的 7 个 Skill 设计原则：

> 每个 Skill 都有"自动触发条件"——基于用户的输入语义自动判断要不要加载。Skill 文件本身就是给 LLM 看的"专业手册"。

ClawHub 的 SKILL.md 规范（YAML frontmatter + Markdown）：

```yaml
name: skill-name
description: 何时触发
triggers:
  - 触发词1
  - 触发词2
commands:
  - inkos cmd1
prompts:
  - role: 角色名
    instructions: |
      ...核心指令...
```

### 10.3 具体修改

新建以下 8 个独立 Skill 目录（每个目录包含一个 `SKILL.md`）：

#### Skill 1 — `skill-novel-chapter/`（**最核心**）

封装 `writer-prompts.ts` 的精华规则——这是最高频使用的 Skill。

```yaml
name: inkos-novel-chapter
description: InkOS 章节写作纪律 — 基于作家方法论的章节写作 skill。当用户要求"写章节 / 续写 / 修改某章 / 起一段"时自动触发。
triggers:
  - "写第 N 章"
  - "续写"
  - "帮我写一章节"
  - "chapter"
  - "write a chapter"
commands:
  - inkos chapter write
prompts:
  - role: "章节写手"
    instructions: |
      [把 writer-prompts.ts 的核心规则：黄金三章 / 创作宪法 / 代入感六支柱 / 写作铁律 / 节奏硬尺 / 句子级节奏 / 角色判断 / 信息揭示铁律 / 钩子账本 全部转写]
```

#### Skill 2 — `skill-novel-character/`

封装 `character-roundtable.ts` 的方法论——角色视角审视。

```yaml
name: inkos-novel-character
description: 角色视角审视 — 让所有登场角色从自己的视角审视当前情节，识别 OOC 风险、逻辑漏洞、对话不合理、情感缺失。
triggers:
  - "角色分析"
  - "从 X 的角度看"
  - "X 会怎么做"
prompts:
  - role: "角色审视官"
    instructions: |
      [封装 character-roundtable 的六步走人物心理分析 + 配角设计方法论 + 角色必须有判断规则]
```

#### Skill 3 — `skill-novel-worldbuilding/`

封装 `architect.ts` 中世界观部分——以及信息揭示方式铁律。

```yaml
name: inkos-novel-worldbuilding
description: 世界观构建 + 信息揭示纪律 — 任何世界观/设定/背景信息必须附着在角色具体动作/对话/物件上。
prompts:
  - role: "世界观架构师"
    instructions: |
      [封装世界观设计方法论 + 信息揭示硬约束 + 设定即物理]
```

#### Skill 4 — `skill-novel-outline/`

封装 `planner.ts` 的卷纲设计。

```yaml
name: inkos-novel-outline
description: 大纲规划 — 拆书、设计主线支线、设计情绪节奏、设计伏笔分布。
```

#### Skill 5 — `skill-novel-review/`

封装六维审查（`ai-tells.ts` + `dual-detector.ts` + `dialogue-auditor.ts`）。

```yaml
name: inkos-novel-review
description: 章节六维审稿 — 爽点 / 一致性 / 节奏 / OOC / 连贯性 / 追读力。
```

#### Skill 6 — `skill-novel-dialogue/`

封装 `dialogue-auditor.ts` + `dialogue-rehearsal.ts` + `character-voice-extractor.ts`。

```yaml
name: inkos-novel-dialogue
description: 对话质量 — 检测机械化对话、角色区分度、对话驱动冲突。
```

#### Skill 7 — `skill-novel-emotion/`

封装 `emotional-arc.ts` + 强情绪升级法。

```yaml
name: inkos-novel-emotion
description: 情绪递进 — 强情绪升级法、欲望驱动、读者心理学。
```

#### Skill 8 — `skill-novel-hook/`

封装 hook 健康管理 + 回环呼应 + 追读力。

```yaml
name: inkos-novel-hook
description: 伏笔/钩子管理 — Chekhov's Gun 回环、追读力、伏笔兑现压力。
```

### 10.4 实现机制

**10.4.1 — 维护流程（审查后调整：TypeScript + tsx）**

**原方案（.mjs，审查后弃用）**：`.mjs` 文件无法直接 `import` TypeScript 模块。

**新方案（TypeScript + tsx，推荐）**：

```typescript
// scripts/build-skills.ts
import { buildGoldenOpeningDiscipline, buildWritingIronRules }
  from "../packages/core/src/agents/writer-prompts.ts";
import fs from "node:fs/promises";

/**
 * 自动从 writer-prompts.ts 的 buildXxx() 函数中抽取规则段落，
 * 输出为每个 skill 的 SKILL.md。
 *
 * 运行方式（package.json scripts）：
 *   npm run build:skills   # 一键生成所有 SKILL.md
 *   npm run lint:skills    # 检查 SKILL.md 与代码是否一致
 */
async function main() {
  // 1. 章节写作 skill
  const chapterContent = buildInkosNovelChapter(); // 内部调用 buildXxx()
  await fs.writeFile(
    "skills/skill-novel-chapter/SKILL.md",
    chapterContent,
    "utf8",
  );
  // 2. 其他 7 个 skill 同理...
}
void main();
```

`package.json`：

```json
{
  "scripts": {
    "build:skills": "tsx scripts/build-skills.ts",
    "lint:skills": "tsx scripts/lint-skills.ts"
  }
}
```

> **同步机制**：在 `prepublishOnly` hook 中自动执行 `npm run build:skills`，确保：
> 1. npm 发布前必跑，不会遗漏；
> 2. SKILL.md 与代码里的方法论永远对得上；
> 3. 若有人只改了 `writer-prompts.ts` 没跑脚本，`lint:skills` 会在 CI 里报警。

**备选轻量方案**：如果不想引入额外脚本文件，也可以在 `writer-prompts.ts` 中的每个 `buildXxx()` 上方加一个 `// @skill-usage: skill-novel-chapter` JSDoc 注释，然后用 `scripts/lint-skills.ts` 做**声明式检查**（检查每个 @skill-usage 对应的 SKILL.md 是否存在）。

**10.4.2 — 发布到 ClawHub（审查后增强：多 skill + 多步骤 + CI 自动化）**

```bash
# 前置：登录 ClawHub（每个开发者只需一次）
clawhub login --token <YOUR_API_TOKEN>

# 发布（每个 skill 独立发布，命名空间统一为 inkos/）
cd skills/skill-novel-chapter
clawhub publish . --name inkos/inkos-novel-chapter --tags "fiction-writing novel chapter"
cd ../skill-novel-character
clawhub publish . --name inkos/inkos-novel-character --tags "character ooc perspective"
# ... 对剩余 6 个 skill 重复相同流程
```

**CI 自动化发布（强烈推荐，避免手动遗漏）**：新增 `.github/workflows/publish-skills.yml`，监听 `release` 事件：

```yaml
name: publish-skills
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build:skills
      - run: for dir in skills/skill-novel-*/; do
             clawhub publish "$dir"
               --name "inkos/$(basename $dir)"
               --tags "fiction-writing";
           done
        env:
          CLAWHUB_TOKEN: ${{ secrets.CLAWHUB_TOKEN }}
```

**10.4.3 — InkOS CLI 集成**

`packages/cli/src/commands/skill.ts` 新增子命令：

```bash
inkos skill list                   # 列出已安装 skill
inkos skill install <name>         # 从 ClawHub 安装
inkos skill publish <name>         # 发布当前项目的方法论为 skill
inkos skill enable/disable <name>  # 启用/禁用
```

### 10.5 验收标准

- [ ] `skills/skill-novel-*` 目录下有 8 个独立目录，每个包含 `SKILL.md`。
- [ ] `clawhub.ai` 上有 InkOS 的 8 个公开 skill（自动检查或手动）。
- [ ] 在 InkOS CLI 跑 `inkos skill list` 至少返回 8 个 skill。
- [ ] 每个 SKILL.md 都能被 ClawHub 解析（YAML frontmatter 格式正确）。

---

## 实施顺序与工作量估算

### 实施顺序（8 个迭代）

```
v1.0 部分（写作方法论，章节 1-6）
─────────────────────────────
迭代 1 · 基础规则强化（1 天）
  ├── 修改点 1.3.1 (writer-prompts.ts 中信息揭示规则提升为硬约束)
  ├── 修改点 6.3.1 (英文同步)
  └── 测试：手动写 2 段 bad text，验证 prompt 能让 LLM 避开它们

迭代 2 · Hook 回环呼应（1-2 天）
  ├── 修改点 2.3.1 (HookRecordSchema 加 seedText + callbackFrom)
  ├── 修改点 2.3.2 (Writer 写 UPPD_HOOKS 时写 seed_text — Phase A)
  ├── 修改点 2.3.3 (writer-prompts.ts 加回环约束)
  ├── 修改点 2.3.4 (hook-ledger-validator.ts 检测回环)
  ├── 依赖：迭代 1 的 prompt 体系必须就绪（修改点 1.3.1 已落地）
  └── 测试：新建 hook-callback.test.ts，10-15 用例

迭代 3 · 节奏与具体化（2-3 天）
  ├── 修改点 3.3.1 (post-write-validator.ts sentence rhythm 检测)
  ├── 修改点 3.3.2 (writer-prompts.ts prose execution rules 强化)
  ├── 修改点 4.3.1 (post-write-validator.ts abstract adjective)
  ├── 修改点 4.3.2 (ai-patterns.ts analyzeAbstractDescription)
  ├── 修改点 4.3.3 (writer-prompts.ts anti-AI 正反例扩展)
  └── 测试：新建 sentence-rhythm.test.ts，ai-patterns.test.ts 扩 5 用例

迭代 4 · 英文对齐 + 角色判断（1-2 天）
  ├── 修改点 5.3.1 (writer-prompts.ts 角色判断)
  ├── 修改点 5.3.2 (en-prompt-sections.ts 同步)
  ├── 修改点 6.3.2 (post-write-validator.ts 英文化)
  └── 测试：在 integration.test.ts 中加英文端到端用例

v1.1 部分（架构与生态，章节 7-10）
─────────────────────────────
迭代 5 · 角色 Agent 接入管线（1-2 天）  ⚡ 最高优先级
  ├── 修改点 7.3.1 (runner.ts 插入角色圆桌阶段)
  ├── 修改点 7.3.2 (writer-prompts.ts 消费 roleConstraints)
  ├── 修改点 7.3.3 (character-roundtable.ts 暴露 discuss())
  ├── 修改点 7.3.4 (DiscussionEngine 作为可选路径)
  ├── 依赖：v1.0 的 writer 管线必须可调用（runner.ts 的 write chapter 阶段存在）
  └── 测试：roundtable.test.ts，8-10 用例

迭代 6 · 信息边界接入管线（1 天）
  ├── 修改点 8.3.1 (runner.ts 审稿阶段调用 InfoBoundaryChecker)
  ├── 修改点 8.3.2 (复用**第 7 章 Roundtable**输出的角色数据，不新建 speaking-character-extractor.ts)
  ├── 修改点 8.3.3 (result 新增 infoBoundaryReport)
  ├── 依赖：迭代 5 的 Roundtable 必须先跑通（产生 RoundtableResult 数据结构）
  └── 测试：info-boundary-pipeline.test.ts，5-8 用例

迭代 7 · 动态角色 Agent 生成器（2 天）  — 拆 Phase A / Phase B
  ├── 修改点 9.3.1a (Phase A：新增 character-agent-generator.ts 基础版，不依赖知识边界)
  ├── 修改点 9.3.1b (Phase B：v2 可选 — 接入 entityDB.getEntityConnections)
  ├── 修改点 9.3.2 (consolidator.ts 章节后增量更新 AgentGraph)
  ├── 修改点 9.3.3 (entities schema 扩展 isProtagonist/goals/traits/speechStyle)
  ├── 修改点 9.3.4 (architect.ts 创建角色时填字段)
  ├── 依赖：Phase A 可在任何时候做；Phase B 依赖迭代 5+6（entityDB 已经有章节知识累积）
  └── 测试：character-agent-generator.test.ts，8-10 用例

迭代 8 · SKILL 扩充与发布（2-3 天）
  ├── 创建 8 个 skills/skill-novel-*/SKILL.md
  ├── scripts/build-skills.ts + package.json 集成（审查后从 .mjs 改为 TypeScript）
  ├── packages/cli/src/commands/skill.ts CLI 集成
  ├── 依赖：writer-prompts.ts 里的 buildXxx() 系列函数必须有稳定输出（v1.0 全部完成后再跑）
  └── 验收：clawhub.ai 上 8 个 skill 公开
```

### 总工作量估算

- **代码改动**：约 2400-2900 行（其中 prompt 文本约 1000 行，检测代码约 700 行，Agent 集成约 500 行，Skill 文件约 600 行，CLI 命令约 100 行）
- **新增测试**：6 个新测试文件，约 50-70 个新用例
- **无破坏性改动**：所有 schema 变更都向后兼容（新字段 `.default([])` 或 `.optional()`）
- **预计工时**：11-15 个工作日（v1.0 部分 5-8 天，v1.1 部分 6-8 天）

---

## 验收与质量闸门

本计划的最终验收不是"代码写完了"，而是**它让 InkOS 的中文+英文小说可读性显著提升**。建议增加 3 个质量闸门：

### 闸门 1 — 规则覆盖率测试

- 把 6 类升级中的每条硬规则，写一个"bad 输入 → violation 命中"的单元测试。
- 目标：每个规则至少 3 个用例（命中 + 不命中 + 边界）。

### 闸门 2 — 双盲人工评估

- 准备 10 篇章节：5 篇用升级前引擎写的，5 篇用升级后引擎写的。
- 让 3 个独立评估者按 5 个维度打分（代入感、节奏、自然度、伏笔质量、想读下一章的意愿）。
- 目标：升级后平均分 ≥ 升级前平均分 +0.5（1-5 分制）。

### 闸门 3 — 零退化测试

- `npm run test:core` 全通过。
- 现有的 `benchmarks/` 目录里（如果有）运行章节写作 benchmark，**字数达标率 / 伏笔兑现率 / 人设一致性指标**不退化。

---

## 后续扩展方向（不在本计划范围内）

以下方向不在本计划内，属于 v2.0 候选：

- **风格 Pack 系统**：让用户可以 `inkos style switch hemingway-short` 加载一个海明威短句风格包（外置的 style.md + prompt 片段）。
- **Hook ledger 可视化**：在 Studio 前端展示每个 hook 的时间轴（seed → callback1 → callback2 → resolve），作者一眼能看到哪些 hook 在"沉睡"。
- **Async Generators 流式响应**：让 Writer 的输出逐段 emit 到 Studio（类似 ChatGPT 的打字效果），而不是整篇返回。
- **MCP Server 化**：把 InkOS 封装成一个 MCP server，让任何支持 MCP 的客户端（Claude Desktop、Cursor、Trae IDE 等）直接调用它——这是让 InkOS 方法论进入外部 Agent 生态的关键一步。
- **Benchmarks 自动化**：建立固定输入→可量化输出的质量基准，让每次 prompt 变更都有客观数字看效果。

### 补充说明：Skill 与代码同步机制

本计划第 10 章创建的 8 个 SKILL.md，需要与代码里的 `writer-prompts.ts` 方法论**永远保持同步**。

`package.json` 中加入：

```json
{
  "scripts": {
    "build:skills": "tsx scripts/build-skills.ts",
    "lint:skills": "tsx scripts/lint-skills.ts"
  }
}
```

每次发布新版本前（`prepublishOnly` hook 或 `npm version patch` 后），自动触发 `build:skills`，把 `writer-prompts.ts` 里所有 `buildXxx()` 函数的输出重新写入对应的 SKILL.md。这样确保：
1. SKILL.md 里的方法论永远与代码最新版本对齐
2. 发布到 ClawHub 的 skill 永远是最新版
3. 不会发生"代码更新了但 skill 里的规则还是旧的"的情况
