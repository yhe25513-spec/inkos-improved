# inkos 项目深度审查与系统增强 - PRD

## Overview

- **Summary**: 对 inkos 写作系统进行的一次全面代码审查，发现以下关键问题：(1) **6 个子模块（anti-ai / emotional / creativity / consistency / compliance / humanity）实现完整但从未接入主写作流程**，形成"有接口但无接线"的死代码群；(2) **用户偏好学习系统因实例化和存储策略问题，实际运行中完全失效**（每次 new 新实例导致编辑记录无法积累）；(3) **后处理质量门是"建议式"而非"门控式"**，章节可以零修改直接保存；(4) **多个 Agent（PolisherAgent）和功能维度（humor/darkness/romance/action 学习）有完整类型定义但无实现**。本 PRD 定义了这些问题的修复与增强范围、验收标准和实施约束。

- **Purpose**: 让 inkos 写出的章节真正经过完整的反 AI 检测、情感润色、风格指纹注入、偏好学习闭环——从"有代码"变成"有效果"。同时修复质量门的执行强度，确保输出质量下限。

- **Target Users**: inkos 的核心使用者（CLI 用户、Studio 用户），以及在 agent-session 中调用 inkos 工具的 AI 代理。

## Goals

1. **将 anti-ai / emotional / humanity 三个子模块真正串入主写作流程**，使每一章节在输出前至少经过一次 humanize + emotion-enhance + burstiness-adjust。
2. **修复用户偏好学习系统的集成缺陷**，使 EditTracker 的编辑记录能跨会话积累、ColdStartHandler 为新用户提供题材级默认偏好、PromptEnhancer 的输出能真正影响写作 prompt。
3. **将"建议式"质量门升级为"门控式"**，规定 error 级违规达到阈值时必须进入修复循环，禁止"写好就返回原文"。
4. **将 PolisherAgent 接入 pipeline**（或明确标记为弃用），消除"导出但不调用"的结构性误导。
5. **修复 post-write 验证的已知正则 bug**（破折号 / 长度阈值），确保规则层一致性。

## Non-Goals (Out of Scope)

- **不重写整个写作 pipeline 的架构**。修复遵循现有 runner.ts + chapter-review-cycle.ts 的结构，不做从 WriterAgent→ComposerAgent 的流控级重构。
- **不引入新的 LLM 模型或切换底层 provider**。本 PRD 不涉及 provider 选择。
- **不增加 play 模块与写作 pipeline 的联动**。play 作为独立子系统，本次只确认二者不互相干扰，不做数据桥接。
- **不重做 StateManager 的持久化层**。其 markdown-based 存储设计本 PRD 不触碰。
- **不创建新的 UI / CLI 命令**，除非是为暴露已有模块（如 polish 命令接入 PolisherAgent）。

## Background & Context

### 发现一：V3.1 / V4 模块群的"出口但不调用"状态

`packages/core/src/index.ts` 的 V3.1/V4 区（第 495–667 行）导出了 6 个子目录的 12+ 个类，但：

| 模块 | 状态 |
|------|------|
| `anti-ai/*`（Humanizer, BurstinessAdjuster, PerplexityAnalyzer） | ❌ 从未在 `runner.ts` 或任何 writer/reviser 中实例化 |
| `emotional/*`（EmotionInjector, EmotionAnalyzer） | ❌ 从未被调用；`emotional_arcs.md` 仅作为 prompt 的文字上下文 |
| `humanity/*`（HumanityEngine, SceneBreaker, SilenceLayerInjector, SelfContradictionGenerator） | ❌ 从未被调用 |
| `creativity/*` | ❌ 仅测试用 |
| `compliance/*` | ❌ 仅测试用 |
| `consistency/*` | ⚠️ 仅 Studio 的一个 API handler 动态 import，不在 pipeline 内 |

实际上 pipeline 真正使用的质量模块只有：ContinuityAuditor（LLM 审计）、analyzeAITells（规则层 AI 痕迹检测）、post-write-validator（句式规则）。humanize / emotion-inject / burstiness-adjust 这种**程序化**（低成本、不依赖 LLM）的增强，在主流程里完全缺席。

### 发现二：用户偏好学习系统的"骨架完美、肉全空"

```
EditTracker (记录编辑) → PreferenceAnalyzer (分析偏好) → UserProfileManager (存储画像) → PromptEnhancer (注入 prompt)
                                                              ↑
                                                      ColdStartHandler (新用户兜底)
```

这个 5 模块链路设计非常完整，`types.ts` 定义了 20+ 个偏好维度。但实际运行中：

- `runner.ts:1843-1877` 里**每次修订都 `new EditTracker()` / `new PreferenceAnalyzer()` / `new UserProfileManager()`**，导致编辑记录永远只有 1 条，batch 阈值（≥5）永远不满足，偏好更新代码是**死代码**。
- `writer-prompts.ts:115-131` 的读侧同样每次 `new UserProfileManager()`，内存 Map 永远空，读不到真实偏好。
- `ColdStartHandler` 在 `cold-start.ts` 中实现了 5 种题材的默认偏好，但主流程**从未 import 或调用**。
- `PreferenceAnalyzer` 的 humor/darkness/romance/action 维度全部硬编码 `0.5`，wordPairs/preferredEmotions 为空数组——类型定义是实的，分析逻辑是空的。

### 发现三：后处理质量门是"建议式"的

`chapter-review-cycle.ts:201-211` 的 `isPassed()` 逻辑只检查 (a) LLM 审计分数 ≥85，(b) 长度在 hard 范围内，(c) 没有违禁词。而 `post-write-validator` 产出的 error 级违规（比如禁用的 `——` 破折号、空洞形容词、句式重复），只被加入 `issues` 列表，**不会阻止章节保存**。

再加上 `maxReviewIterations = 1` 的默认值，修复循环只跑一轮，很多情况下修复失败会**静默返回原文**（`reviser.ts:357-366`）。

### 发现四：已知的小 bug

- `post-write-validator.ts:25` 的破折号正则 `/——+/g` 只能匹配连续双破折号，但 `—`（单 em-dash）不会被清理，`reviser.ts:197` 又对 `—` 报错，形成"反复报 error 但不修"的循环。
- `length-metrics.ts:86-93` 的 soft-range 计算：如果目标是 3000 字，soft 范围是 2700–3300，hard 是 2400–3600。`length-normalizer.ts:31-43` 在 soft 内直接跳过。意味着 2450 字也不会被触发扩展——离目标差 18% 也不纠正。
- `writer-parser.ts:96-118` 的标题回退链过宽：当 LLM 没按规范输出 `=== CHAPTER_TITLE ===` 时，解析器会在正文中找任何 `# 第N章` 作为标题，可能误抽"第三章 夜色降临"这种正文内容作为章节标题。

### 技术约束

- 项目是 **monorepo**（`core/`, `cli/`, `studio/`）。修改 core 后 CLI/Studio 会通过 npm workspace 自动感知。
- 核心 agent 驱动架构是 **`BaseAgent` + 具体子类**（WriterAgent/ComposerAgent/...），所有 LLM 调用统一走 `agentCtx.chat()`。
- 持久化通过 `StateManager`（markdown/JSON）和 `PlayDB`（SQLite for play 世界）两层分别管理。
- 现有测试覆盖：部分 `__tests__/` 目录有单元测试，无 E2E/集成测试。

## Functional Requirements

### FR-1: anti-ai / humanity 模块接入主写作流程

- **FR-1.1**: `PipelineRunner.writeNextChapter()` 在章节完成草稿后、`persistChapterArtifacts` 之前，**调用 `Humanizer.humanize()`** + **`BurstinessAdjuster.adjustBurstiness()`** 做程序化表面润色。
- **FR-1.2**: `chapter-review-cycle.ts` 在修订循环的 `reviseChapter()` 返回后、快照评估之前，**调用 `SceneBreaker.insertBreathing()`** 和 **`SilenceLayerInjector.inject()`** 对高张力段落做"呼吸段+沉默层"处理。
- **FR-1.3**: `detection-runner.ts` 的 `detectAndRewrite()` 循环中，在 LLM 重写前、后各调用一次 `PerplexityAnalyzer.analyze()` 做本地快速打分，减少外部检测 API 的依赖。

### FR-2: emotional 模块接入主写作流程

- **FR-2.1**: `chapter-review-cycle.ts` 的表面处理阶段（audit 后、revise 前）**调用 `EmotionInjector.enhanceChapter()`**，使用 `emotional_arcs.md` 中已有的 primaryEmotion/intensity 数据做程序化情感增强。
- **FR-2.2**: `WriterAgent.writeChapter()` 的 output 中，emotional_arcs 条目必须在章节 settle 阶段写入 `truth/emotional_arcs.md`，确保 FR-2.1 有数据可读。（此条目前已实现，需保持不变。）

### FR-3: 用户偏好学习系统修复

- **FR-3.1**: `EditTracker` 和 `UserProfileManager` 的内部存储（`Map`/`Array`）必须替换为**可持久化存储**（使用 `StateManager` 已有接口或 `play/` 风格的本地文件 JSON），确保**跨请求、跨会话的数据保留**。
- **FR-3.2**: `runner.ts:1843-1877` 的 `applyChapterRevision()` 不再每次 `new EditTracker()`，而应从**持久化存储加载/保存**同一实例。batch 阈值（当前 `>=5`）必须与 `EditTracker` 内部 `batchSize` 一致。
- **FR-3.3**: `ColdStartHandler.getGenreDefault(genre)` 必须在 `buildUserPreferenceGuide()` 中被调用：当 `preference.meta.sampleSize < 5` 时，优先使用题材默认偏好作为风格指南（而非空字符串）。
- **FR-3.4**: `PreferenceAnalyzer.analyze()` 至少对 humor/darkness/romance/action 中的 **2 个核心维度**实现真实分析逻辑（而非硬编码 0.5），wordPairs/preferredEmotions 至少一个要有填充逻辑。
- **FR-3.5**: `PromptEnhancer.generateStyleGuide()` 必须使用 `preference.style.darkness/romance/action` 三个维度（当前被忽略的）转化为 prompt 内容。

### FR-4: 质量门控强化

- **FR-4.1**: `chapter-review-cycle.ts` 的 `isPassed()` 增加条件：**error 级违规数量必须为 0**（或 ≤ 可配置阈值，默认 0），否则强制进入修复循环。
- **FR-4.2**: `maxReviewIterations` 默认值从 1 提升至 3。
- **FR-4.3**: `reviser.ts` 在 `patch` 解析失败 / 重写失败时，**不得静默返回原文**。应记录一个 `critical` 级 issue 并返回"修复失败但原文保留"的明确信号；调用方根据 FR-4.1 的 zero-error 规则会自然触发重新进入修复循环。
- **FR-4.4**: `writer.ts:393` 中 `analyzeAITells()` 的结果必须被**合并到 `postWriteErrors`**，而不是只记录 logger。

### FR-5: 已知 bug 修复

- **FR-5.1**: `post-write-validator.ts` 的破折号正则从 `/——+/g` 改为 `/—+/g`，确保单破折号也被规范化。同时在 `postWriteCritical` 中保留 `—` 检测，避免被规范化后又报 error。
- **FR-5.2**: `length-metrics.ts` 新增 "light-normalize" 逻辑：当章节长度离 target 在 ±25% 之外时，`LengthNormalizerAgent` 至少给出"建议压缩/扩展"信号（即便 soft 范围内也可配置是否强制）。
- **FR-5.3**: `writer-parser.ts` 的标题回退逻辑增加校验：候选标题必须不在正文第一句之前出现，且不包含"夜色降临"这类典型正文片段。

### FR-6: PolisherAgent 接入或弃用

- **FR-6.1**: 如果 PolisherAgent 功能与 reviser+humanizer 有显著差异（需先分析 `polisher.ts` 的实现），则将其接入 `chapter-review-cycle.ts` 作为 "final polish" 阶段（audit 完全通过后调用）。否则，从 `index.ts` 导出中移除并添加 `@deprecated` 注释。

## Non-Functional Requirements

- **NFR-1 (Token Efficiency)**: anti-ai / emotional / humanity 模块的程序化处理（humanize/burstiness-adjust/silence-layer）**不得**调用 LLM，必须是纯文本变换。目标零 token 成本。
- **NFR-2 (Backward Compatibility)**: 所有新接入的模块必须作为**可选步骤**（通过 `config.enableAntiAI`, `config.enableHumanity` 等配置开关），默认开启，但允许通过 `book_config.json` 关闭，确保已有项目行为不被意外改变。
- **NFR-3 (Observability)**: 新增的处理步骤必须在 `PipelineRunner` 的 logger 中输出 `[humanity]`, `[emotion]` 等带标签的日志，包含处理前/后字数差、修改段落数等基础指标。
- **NFR-4 (Testability)**: anti-ai / emotional / humanity 模块的核心方法（humanize, adjustBurstiness, enhanceChapter, insertBreathing, injectSilenceLayer）必须有可复现输入输出，便于写单元测试。
- **NFR-5 (Performance)**: 程序化处理（humanize/burstiness/silence-layer/emotion-inject）对 3000 字章节的总耗时 ≤ 50ms。LLM 驱动步骤不计入此阈值。

## Constraints

- **Technical**: 不引入新的第三方运行时依赖（新增 devDeps 如测试框架可以，运行时 deps 不行）。
- **Business**: 不改变用户命令的名称和参数格式（`inkos write`, `inkos plan`, `inkos quick` 等保持一致）。
- **Dependencies**: `StateManager` 是偏好持久化的首选底层，避免引入与 `PlayDB` 同量级的新数据库。

## Assumptions

- 假设 `StateManager.writeJSON()` / `StateManager.readJSON()`（或类似接口）可以被复用为偏好的持久化层。如果没有现成的 JSON 接口，需要新增一个极简方法（不是重写 StateManager）。
- 假设 `humanity/*` 模块的核心算法（SceneBreaker/SilenceLayerInjector）可以直接作用于中文正文而无需重新训练或重调参数（上一轮对话已经验证了这些算法的基础合理性）。
- 假设 `maxReviewIterations = 3` 的增加不会导致写入耗时不可接受（p95 增加 ≤ 2x LLM 调用延迟）。

## Acceptance Criteria

### AC-1: anti-ai 模块在章节写作中被正确调用

- **Given**: 用户执行 `inkos write` 写一章，book_config.json 中 `enableAntiAI: true`
- **When**: 写作完成后检查运行日志和产物
- **Then**: 
  - 日志中出现 `[anti-ai] humanize applied: X paragraphs modified`
  - 日志中出现 `[anti-ai] burstiness adjusted: from X to Y`
  - 最终 `final_chapter.md` 字数与草稿字数差 ≤ 5%（程序化处理不应大幅改变长度）
- **Verification**: `programmatic`（grep 日志 + diff 字数）

### AC-2: humanity 模块在章节审核循环中被调用

- **Given**: 章节经过 audit 后进入 revise 循环
- **When**: revise 返回后进入 snapshot 评估之前
- **Then**:
  - 日志中出现 `[humanity] breathing segments inserted: N`
  - 日志中出现 `[humanity] silence layer injected: M replacements`
  - N+M > 0（高张力章节应有效果）
- **Verification**: `programmatic` + `human-judgment`（对一段 500 字高张力描写做 side-by-side 检查）

### AC-3: EmotionInjector 使用 emotional_arcs.md 的数据

- **Given**: book 中存在 `truth/emotional_arcs.md`，该章的 primaryEmotion 为 "anxiety"，intensity=0.7
- **When**: 章节写作完成后
- **Then**:
  - 日志中出现 `[emotion] enhanced with anxiety(0.7): N phrases injected`
  - 增强后的正文比草稿多了 ≥ 2 处情绪相关词汇（需人工抽查）
- **Verification**: `programmatic`（日志检查）+ `human-judgment`（人工抽查）

### AC-4: 用户偏好学习系统跨会话有效

- **Given**: 新用户，book genre="xuanhuan"，没有任何编辑历史
- **When**:
  1. 第 1 次调用 `applyChapterRevision`（第一次编辑）
  2. 第 2-5 次连续调用（累计 5 次编辑）
  3. 第 6 次调用 `inkos write` 写新章节
- **Then**:
  - 第 1 次写作时，writer prompt 中包含基于 `ColdStartHandler` 的"xuanhuan"题材默认风格指南（非空字符串）
  - 第 6 次写作时，writer prompt 中包含基于用户编辑历史的个性化风格指南
  - 在磁盘 `.inkos/state/user_preferences.json`（或等价路径）中可以找到累计 ≥ 5 条编辑记录和对应的偏好画像
- **Verification**: `programmatic`（检查持久化文件 + prompt 关键字 grep）

### AC-5: 质量门对 error 级违规强制执行

- **Given**: 一段故意包含 3 个 `—` 破折号（禁用符号）的测试文本
- **When**: 提交给 `chapter-review-cycle.runReviewCycle()`
- **Then**:
  - audit 结果中 issue 列表包含 ≥ 1 条 severity=error 的违规
  - isPassed() 返回 false
  - 修复循环被触发至少 1 次
  - 修复后（或修复失败时）error 级违规被清零或被明确标记为 `critical-failure-but-continued`
  - 最终章节保存时 error 级违规数量 = 0（或符合配置阈值）
- **Verification**: `programmatic`（集成测试）

### AC-6: 破折号正则 bug 修复

- **Given**: 测试文本 `他看了看窗外——天灰蒙蒙的—又低下头。`
- **When**: `post-write-validator.normalize()` / `humanizer.humanize()` 处理
- **Then**: `—` 和 `——` 均被规范化为 `，`（或其它一致符号），不会残留单破折号导致 reviser 反复报错
- **Verification**: `programmatic`（单元测试）

### AC-7: PolisherAgent 明确接入或弃用

- **Given**: `packages/core/src/agents/polisher.ts`
- **When**: 审查其实现与 ReviserAgent/Humanizer 的功能重叠度
- **Then**: 二选一：(a) 在 `chapter-review-cycle.ts` 中新增 `polishFinal()` 步骤并通过日志验证被调用；或 (b) 在 `polisher.ts` 文件顶部添加 `@deprecated` 注释并从 `index.ts` 的公共导出中移除
- **Verification**: `programmatic`（grep 代码）

### AC-8: 整体性能不显著退化

- **Given**: 使用同一 prompt/seed 连续写 3 章（每章 ~3000 字）
- **When**: 对比修复前后的总耗时（从 `inkos write` 到文件写入完成）
- **Then**: 程序化处理额外耗时 ≤ 200ms/章（NFR-5 的 ~4x 安全余量）
- **Verification**: `programmatic`（timing 日志对比）

## Open Questions

- [ ] **Q1**: `creativity/*` 和 `compliance/*` 两个子模块——它们和 anti-ai/emotional 类似也是"实现了但没接线"。但前者涉及原创性评分/套路检测/合规分析，这些是否应在本 PRD 中一起接入？还是作为后续版本？（当前默认：本次 PRD 不接入，留待下一阶段评估，因为它们对"真人感"的直接贡献低于 anti-ai/emotional/humanity。）
- [ ] **Q2**: `consistency/*` 模块（ForeshadowTracker / CharacterStateSync / TimelineManager）仅在 Studio 的一个 API handler 中被动态 import。这些功能应不应该作为写作 pipeline 的"前置检查"（写新章节前读一致性）？还是保持现状（仅显式命令触发）？（当前默认：保持现状，不自动接入到 write 主流程，避免大幅增加写作延迟。）
- [ ] **Q3**: 用户偏好学习系统中 `classifyEdit()` 的相似度算法现在是字符级 jaccard，建议替换为 token 级 edit distance。这个替换的工作量如何评估？是否需要专门的任务？（当前默认：作为 FR-3 的子任务，不需要独立 PRD。）
- [ ] **Q4**: `PolisherAgent` 的去留——需要先有人快速读一遍 `polisher.ts` 判断它和 ReviserAgent 的功能差异有多大。如果只是"更激进的重写"，那就和 reviser 重叠了；如果有独特算法（比如专门的文学风格迁移），那就值得保留。（当前默认：本次 PRD 实施前做一次快速代码阅读评估，再决定。）
- [ ] **Q5**: `detector.ts`（外部 AIGC 检测）是否应该作为 `writeNextChapter` 的**自动步骤**（写完自动检测，失败则重写）？还是保持现状（用户显式 `inkos detect`）？（当前默认：保持现状，外部 API 不稳定时会拖垮整个写流程。）
