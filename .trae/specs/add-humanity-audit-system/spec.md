# 真人感27维度审计与修订系统 Spec

## Why

当前 InkOS 的审计系统（ContinuityAuditor）只做**结构审计**（OOC、时间线、战力崩坏等 37 维度），完全不检查**真人感质量**（口语化密度、身体存在感、温度切换、自我意识等）。导致像第1章这样"结构没问题但真人感极差"的章节能通过审计。同时，即使审计出问题，现有 ReviserAgent 的修复策略（patch/rewrite）不适用于真人感增强类问题（如"加温度切换""加自我意识"），需要新增专门的真人感修复路由。

## What Changes

- 新增 `HumanityAuditor` 类：基于 27 个真人感维度做 LLM 审计，输出与 ContinuityAuditor 相同的 `AuditResult` 接口
- 新增 `humanity-dimensions.ts`：定义 27 个真人感维度（ID 38-64），分 5 层（语言表层/沉浸层/叙事结构层/人物情感层/叙事与伏笔层）
- **MODIFIED** `ReviserAgent`：新增 `repairScope: "humanity-enhance"` 路由，新增真人感修复提示词模板，修复时结合 humanity 模块的程序化能力（SceneBreaker/SilenceLayerInjector/SelfContradictionGenerator）
- **MODIFIED** `chapter-review-cycle.ts`：在结构审计通过后、最终保存前，增加真人感审计步骤；真人感问题进入修订循环
- **MODIFIED** `GenreProfile` schema：新增 `enableHumanityAudit` 字段（默认 true）
- **MODIFIED** `continuity.ts` 的 `DIMENSION_LABELS`：追加 38-64 的真人感维度标签

## Impact

- Affected specs: project-system-review（FR-1/FR-2 的 humanity 模块接入，本 spec 在其基础上增加审计能力）
- Affected code:
  - `packages/core/src/agents/continuity.ts`（DIMENSION_LABELS 扩展）
  - `packages/core/src/agents/reviser.ts`（新增 humanity-enhance 路由 + 提示词）
  - `packages/core/src/pipeline/chapter-review-cycle.ts`（新增真人感审计步骤）
  - `packages/core/src/models/genre-profile.ts`（新增 enableHumanityAudit 字段）
  - `packages/core/src/agents/humanity-auditor.ts`（**新增**）
  - `packages/core/src/agents/humanity-dimensions.ts`（**新增**）
  - `packages/core/src/agents/humanity-reviser-prompts.ts`（**新增**）

## ADDED Requirements

### Requirement: 真人感27维度审计

系统 SHALL 提供独立的真人感审计器（HumanityAuditor），对章节进行 27 维度真人感质量评估。

#### 27维度定义（ID 38-64）

**语言表层（5维度）**：
- 38: 句子突发性 — 长短句交替程度，短句突然出现制造节奏呼吸感
- 39: 开头多样性 — 段落/句子开头是否过于单一（连续"他"开头）
- 40: 口语化密度 — "这玩意儿""哪儿懂"等口语表达的自然密度
- 41: 模糊词控制 — "似乎""好像"等模糊词是否滥用（合理比喻除外）
- 42: 词汇多样性 — 装饰词/比喻是否重复使用

**沉浸层（5维度）**：
- 43: 感官种类 — 视觉/听觉/触觉/嗅觉/味觉的覆盖广度
- 44: 身体存在感 — 主角身体感受描写（伤痛、疲惫、眼皮酸等）
- 45: 次要人物自洽 — 配角行为逻辑是否自洽（不降智、不工具人）
- 46: 不体面道具 — 场景道具是否有"磨损感"（缺口、裂缝、污渍）
- 47: 自我矛盾性 — 主角是否有"自己也不确定"的瞬间

**叙事结构层（5维度）**：
- 48: 时间碎片 — "正打算…忽然"式的时间缝隙（主角犹豫/盘算）
- 49: 对话不完美 — 对话是否"不闭环"（被打断、答非所问、重复）
- 50: 物理接触 — 物理细节是否具体到数字（"三寸"而非"什么东西"）
- 51: 节奏呼吸感 — 紧张后是否有温暖/松弛描写让读者"松下来"
- 52: 不必要重量 — 是否有故意放慢、用更多笔墨写一件事的厚度

**人物情感层（6维度）**：
- 53: 矛盾性行为 — 主角是否做"不该做但符合性格"的事
- 54: 错误余地 — 主角是否意识到"自己的借口不够好"
- 55: 情感回落期 — 情绪是否有"担心→压下去"的弧线（非立刻振作）
- 56: 特异性细节 — "半块干饼""绳头连到大树阴影"级别的精准细节
- 57: 自我意识 — 主角是否"想自己怎么想"（元认知层次）
- 58: 自我暴露 — 主角是否意识到"自己暴露了什么"

**叙事与伏笔层（6维度）**：
- 59: 信息挤牙膏 — 信息是否一个接一个出来（每步比读者快一步）
- 60: 读者预期管理 — 是否有多层预期反转（A→B→C→真相）
- 61: 污染式传递 — 信息是否被角色故意污染（撒谎/偏见/读者自行解读）
- 62: 温度切换 — 紧张结束后是否有不合时宜的情绪反应（忽然想笑）
- 63: 沉默层 — 是否有"没有人讨论但读者感觉到了"的留白
- 64: 不可靠性 — 主角是否事后修正自己的判断

#### Scenario: 真人感审计检测出口语化不足

- **WHEN** 一章节的语言过于书面化，缺少口语表达
- **THEN** 维度40（口语化密度）被标记为 warning，suggestion 包含具体的改写建议（如"将'他感到非常愤怒'改为'他骂了一声靠'"）

#### Scenario: 真人感审计检测出缺少温度切换

- **WHEN** 紧张场景结束后直接跳到新场景，缺少不合时宜的情绪反应
- **THEN** 维度62（温度切换）被标记为 warning，suggestion 包含具体的插入建议（如"在光头离开后加一句'林天忽然想笑'"）

#### Scenario: 真人感审计与结构审计独立运行

- **WHEN** 一章节结构完美但真人感极差
- **THEN** ContinuityAuditor 返回 passed=true，但 HumanityAuditor 返回 passed=false 且 issues 包含真人感维度的问题

### Requirement: 真人感修复路由

系统 SHALL 在 ReviserAgent 中新增 `humanity-enhance` 修复路由，确保真人感审计问题能被正确修复。

#### Scenario: 温度切换缺失的修复

- **WHEN** 审计发现维度62（温度切换）缺失，repairScope="humanity-enhance"
- **THEN** ReviserAgent 在紧张场景结束后插入不合时宜的情绪反应，而非做结构重写

#### Scenario: 自我意识缺失的修复

- **WHEN** 审计发现维度57（自我意识）缺失，repairScope="humanity-enhance"
- **THEN** ReviserAgent 在主角内心独白中插入"想自己怎么想"的元认知层次

#### Scenario: 真人感修复结合程序化能力

- **WHEN** 修复维度63（沉默层）或维度47（自我矛盾性）问题时
- **THEN** ReviserAgent 优先调用 humanity 模块的 SilenceLayerInjector / SelfContradictionGenerator 做程序化注入，仅在程序化处理不足时才调用 LLM

### Requirement: 审核循环集成真人感审计

系统 SHALL 在 chapter-review-cycle 中集成真人感审计，作为结构审计通过后的第二道质量门。

#### Scenario: 结构审计通过但真人感未通过

- **GIVEN** 一章节通过了 ContinuityAuditor（passed=true, score≥85）
- **WHEN** HumanityAuditor 审计返回 passed=false
- **THEN** 章节进入真人感修复循环，使用 humanity-enhance 路由修复

#### Scenario: 真人感审计可通过配置关闭

- **GIVEN** book.json 中 enableHumanityAudit=false
- **WHEN** 章节经过审核循环
- **THEN** 跳过真人感审计步骤，行为与当前系统一致

## MODIFIED Requirements

### Requirement: ReviserAgent 修复路由

现有 resolveAutoOutputMode 支持 patch-only / rewrite-only / allow-full 三种模式。新增 humanity-enhance 模式：

- **触发条件**：issues 中存在 `repairScope: "humanity-enhance"` 的问题
- **修复策略**：
  1. 优先使用 humanity 模块的程序化能力（SilenceLayerInjector、SelfContradictionGenerator、SceneBreaker）
  2. 程序化处理不足时，调用 LLM 做定向真人感增强（非全文重写，而是定点插入）
  3. 修复提示词明确要求"不改变剧情走向，只增强真人感"
- **输出模式**：类似 patch-only，以定点插入/替换为主，不做全文重写

### Requirement: chapter-review-cycle 审核流程

现有流程：assess → revise → assess（循环）→ best snapshot。

修改后流程：assess（结构）→ revise（结构）→ assess（结构）→ **assess（真人感）→ revise（真人感）→ assess（真人感）** → best snapshot。

- 真人感审计在结构审计通过后才执行（避免在结构问题未修复时浪费 LLM 调用）
- 真人感修复循环独立计数，最多 `maxHumanityIterations` 次（默认 2）
- 真人感问题的 severity 默认为 warning（不阻断章节保存），但可通过配置提升为 critical

### Requirement: DIMENSION_LABELS 扩展

在 continuity.ts 的 DIMENSION_LABELS 中追加 ID 38-64 的真人感维度标签，使 buildDimensionList 能统一管理。

### Requirement: GenreProfile 新增字段

GenreProfile schema 新增 `enableHumanityAudit: z.boolean().default(true)` 字段。
