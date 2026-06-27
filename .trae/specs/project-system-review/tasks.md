# inkos 项目系统增强 - 实施任务清单

## [ ] Task 1: 阅读并评估 PolisherAgent（决定接入或弃用）

- **Priority**: P0（阻塞 Task 10）
- **Depends On**: None
- **Description**:
  - 阅读 `packages/core/src/agents/polisher.ts` 完整实现
  - 对比 `agents/reviser.ts` 和 `anti-ai/humanizer.ts`，判断功能重叠度
  - 输出一份 1-2 页的评估文档：PolisherAgent 是弃用还是接入作为 final polish 阶段
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` T1.1: 完成一份评估文档，明确给出"弃用"或"接入"二选一的结论和理由
  - `human-judgment` T1.2: 评估文档需列出 PolisherAgent 的 3 个核心方法及其与 ReviserAgent 的差异
- **Notes**: 本任务是决策任务，不是代码任务。结论决定了 Task 10 的方向。

---

## [ ] Task 2: StateManager 偏好持久化层（JSON 接口 + EditTracker/UserProfileManager 改造）

- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 `state/manager.ts` 中新增 2 个方法：`writeJSON(key, data)` / `readJSON(key)`（如果已有等价方法则复用）
  - 改造 `learning/edit-tracker.ts`：将内部 `private edits: UserEdit[] = []` 改为从持久化存储加载；`trackEdit()` 后自动保存
  - 改造 `learning/user-profile.ts`：将内部 `private storage: Map<string, WritingPreference>` 改为从持久化存储加载；`updatePreference()` 后自动保存
  - 持久化文件路径：`<bookDir>/.inkos/learning/edit_log.json` 和 `<bookDir>/.inkos/learning/preferences.json`
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` T2.1: 写一个单元测试：2 次独立进程分别 `new EditTracker().trackEdit(...)`，第 2 次能读到第 1 次写入的编辑
  - `programmatic` T2.2: `UserProfileManager.getPreference(userId, bookId)` 在跨进程调用时能读到之前写入的画像
  - `programmatic` T2.3: 磁盘上确实存在 `<bookDir>/.inkos/learning/` 目录和 JSON 文件
- **Notes**: 不重写 StateManager 的整体架构，只新增 2 个轻量方法。

---

## [ ] Task 3: runner.ts 中偏好学习的实例化策略修复

- **Priority**: P0
- **Depends On**: Task 2
- **Description**:
  - 修改 `packages/core/src/pipeline/runner.ts:1843-1877` 的 `applyChapterRevision()`：
    - 不再每次 `new EditTracker()` / `new PreferenceAnalyzer()` / `new UserProfileManager()`
    - 改为从持久化存储加载（Task 2 的新接口），分析后保存
    - batch 阈值统一为 `EditTracker.batchSize`（不再硬编码 5）
  - 修改 `packages/core/src/agents/writer-prompts.ts:115-131`：同样改为从持久化加载
  - 在两处都绑定 `onBatch` 回调，不再手动检查缓冲区
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` T3.1: mock 5 次 `applyChapterRevision()` 调用后，验证 EditTracker 的 edit log 有 5 条记录（而非 1 条）
  - `programmatic` T3.2: 第 6 次调用时，PreferenceAnalyzer 被触发且 UserProfileManager 的 preference.meta.sampleSize ≥ 5
  - `programmatic` T3.3: `writer-prompts.ts.buildUserPreferenceGuide()` 在 sampleSize≥5 时返回非空字符串（包含个性化词汇）
- **Notes**: 这是用户偏好系统从"死代码"变"活着"的核心任务。

---

## [ ] Task 4: ColdStartHandler 接入写前 prompt

- **Priority**: P1
- **Depends On**: Task 3
- **Description**:
  - 修改 `agents/writer-prompts.ts` 的 `buildUserPreferenceGuide()`：
    - 当 `preference.meta.sampleSize < 5` 时，**不返回空字符串**
    - 改为调用 `new ColdStartHandler().getGenreDefault(bookGenre)` 获取题材默认偏好
    - 将题材默认偏好通过 `PromptEnhancer.generateStyleGuide()` 转为文字指南
  - 需要从 book config 中读取 genre 字段（确认当前 book_config.json 有 genre 配置）
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` T4.1: 构造一个 sampleSize=0 的 preference，调用 `buildUserPreferenceGuide()`，返回字符串非空且包含题材关键词（如 "玄幻" / "xuanhuan"）
  - `human-judgment` T4.2: 对 xuanhuan / urban / mystery 三种题材各生成一份指南，检查是否有区分度
- **Notes**: 这是"新用户也能获得个性化"的关键。

---

## [ ] Task 5: PreferenceAnalyzer 分析维度补全（至少 2 个新增维度 + wordPairs）

- **Priority**: P1
- **Depends On**: Task 2（但可并行开发，只需在 Task 3 之前提交）
- **Description**:
  - `humor` 维度：基于编辑文本中的"哈哈/笑了/调侃/滑稽"等关键词做基础打分
  - `darkness` 维度：基于"血/死/尸体/黑暗/恐惧"等关键词做基础打分
  - `romance` 维度：基于"爱/喜欢/心动/吻/拥抱"等关键词做基础打分（任选上述 3 个中至少 2 个实现真实分析）
  - `wordPairs`：从编辑文本中提取高频双字词组（对删除的词记 negative，对新增的词记 positive），取 top-N 作为 wordPairs
  - `longSentenceRatio` / `paragraphLength`：从句子长度分布中计算比例（之前是硬编码）
  - 保持 `avgLength` 的已有逻辑不变
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` T5.1: 构造一段"黑暗气氛"文本 vs "轻松幽默"文本，两个 preference 的 `humor` / `darkness` 分数差绝对值 ≥ 0.3
  - `programmatic` T5.2: `wordPairs` 非空（至少 3 对），且是从文本中实际出现的词组
  - `programmatic` T5.3: `longSentenceRatio` 对"全部短句"测试文本返回 ≤ 0.1，对"全部长句"测试文本返回 ≥ 0.9
- **Notes**: 不追求 NLP 级精度，目标是从"硬编码 0.5"升级为"有基础信号"。

---

## [ ] Task 6: PromptEnhancer 使用更多维度

- **Priority**: P1
- **Depends On**: Task 5
- **Description**:
  - 修改 `learning/prompt-enhancer.ts` 的 `generateStyleGuide()`：
    - 新增 `darkness` 维度：高 darkness → 暗示"氛围阴暗、情感沉重"；低 → "氛围明快、情感轻松"
    - 新增 `romance` 维度：高 romance → "情感张力强、人物关系细腻"
    - 新增 `action` 维度：高 action → "节奏快、动作描写直接"
    - 新增 `paragraphLength` 维度：短段落 → "多用短句段落制造紧张感"
  - 保持 `formality` / `literaryLevel` / `avgLength` 原有逻辑
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` T6.1: 高 romance preference 生成的指南字符串中包含"情感"或"关系"关键词
  - `programmatic` T6.2: 不同 preference 输入产生不同的指南输出（不是模板化复制）
- **Notes**: 现在 generateStyleGuide() 只用了 3 个维度，要扩展到 7+ 个。

---

## [ ] Task 7: 质量门控强化（zero-error 通过规则）

- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 修改 `pipeline/chapter-review-cycle.ts` 的 `isPassed()`：
    - 新增检查：`numberOfErrorLevelIssues <= config.maxErrorsPerChapter`（默认 0）
    - 不通过则强制进入修复循环
  - 修改 `maxReviewIterations` 默认值从 1 到 3
  - 修改 `agents/reviser.ts`：`patch` 解析失败时，不静默返回原文，而要记录 `critical` issue 并返回带 `revised: false, criticalFailure: true` 标记的结果
  - 修改 `agents/writer.ts:393`：将 `analyzeAITells()` 的 issues 合并到 `postWriteErrors` 而非仅 log
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` T7.1: 构造含 3 个 error 级违规的测试文本，调 `runReviewCycle()`，验证循环至少进入 1 次
  - `programmatic` T7.2: 循环最终要么 error 归零，要么达到 maxIterations 时返回明确的 `criticalFailure` 标记
  - `programmatic` T7.3: `maxReviewIterations = 3` 的默认值在 `chapter-review-cycle.ts` 顶部常量中可验证
- **Notes**: 这是"成品质量下限"的核心保障。

---

## [ ] Task 8: anti-ai 模块接入主写作流程

- **Priority**: P0
- **Depends On**: None
- **Description**:
  - 在 `pipeline/runner.ts.writeNextChapter()` 的 `settle` 阶段之后、`persistChapterArtifacts` 之前，新增一个 `postProcess()` 方法：
    - 调用 `Humanizer.humanize(content, { intensity: 0.3 })`（低强度，避免改变语义）
    - 调用 `BurstinessAdjuster.adjustBurstiness(content, { targetCV: 0.6 })`
    - 以 `[anti-ai]` 前缀记录日志
  - 在 `pipeline/detection-runner.ts.detectAndRewrite()` 的 LLM 重写前后各调用一次 `PerplexityAnalyzer.analyze(content)`，作为本地快速判断
  - 通过 `book_config.json` 中的 `enableAntiAI: boolean` 配置开关（默认 true）
- **Acceptance Criteria Addressed**: AC-1, AC-8
- **Test Requirements**:
  - `programmatic` T8.1: 对一段 1000 字文本调 postProcess()，日志中出现 `[anti-ai] humanize applied` 和 `[anti-ai] burstiness adjusted`
  - `programmatic` T8.2: 处理后字数变化 ≤ 5%
  - `programmatic` T8.3: `detectAndRewrite()` 的本地 perplexity 分数在处理后比处理前降低（或保持）
  - `programmatic` T8.4: 单章程序化处理总耗时 ≤ 200ms
- **Notes**: Humanizer 是程序化（无 LLM 调用），对 token 成本零影响。

---

## [ ] Task 9: humanity + emotional 模块接入章节审核循环

- **Priority**: P0
- **Depends On**: Task 8 完成框架（两个任务的调用点不同，可并行开发）
- **Description**:
  - 在 `pipeline/chapter-review-cycle.ts` 的 `reviseChapter()` 返回后、`bestSnapshot` 评估之前，新增表面处理阶段：
    - 读取 `emotional_arcs.md` 中该章节的 primaryEmotion/intensity
    - 调用 `EmotionInjector.enhanceChapter(content, emotion, intensity)`
    - 调用 `SceneBreaker.insertBreathing(content, { sceneTypes: ['climax', 'revelation'] })`
    - 调用 `SilenceLayerInjector.inject(content, { intensity: 0.4 })`
  - 以 `[humanity]` / `[emotion]` 前缀记录日志
  - 在 `book_config.json` 中新增 `enableHumanity` / `enableEmotion` 开关（默认 true）
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-8
- **Test Requirements**:
  - `programmatic` T9.1: 构造一段高张力文本 + emotional_arcs.md（anxiety/0.7），调新流程后日志中出现 `[humanity] breathing segments inserted: N`（N>0）和 `[emotion] enhanced with anxiety(0.7)`
  - `human-judgment` T9.2: side-by-side 对比处理前后文本，判断是否"更有真人感"（3 名评审 ≥ 2 人同意有改进）
  - `programmatic` T9.3: 单章程序化处理总耗时 ≤ 200ms
- **Notes**: 这些模块的核心算法无需 LLM 调用，是纯文本变换。

---

## [ ] Task 10: PolisherAgent 接入或弃用（基于 Task 1 的结论）

- **Priority**: P2
- **Depends On**: Task 1（必须等决策结论）
- **Description**:
  - **方案 A（接入）**：在 `chapter-review-cycle.ts` 的所有循环结束后、`persistChapterArtifacts` 之前，新增 `finalPolish()` 步骤：调用 `PolisherAgent.polish(chapter, context)`
  - **方案 B（弃用）**：在 `polisher.ts` 文件顶部添加 `/** @deprecated Use ReviserAgent + Humanizer instead */` 注释，从 `index.ts` 的公共导出中移除 `PolisherAgent` 及其相关类型
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` T10.1: 如果选接入，`grep -r "finalPolish"` 能找到调用点；如果选弃用，`grep "PolisherAgent" index.ts` 应找不到
  - `programmatic` T10.2: 接入方案下，写一章后日志中出现 `[polish] final polish applied`
- **Notes**: 这是 Task 1 的后续执行任务。

---

## [ ] Task 11: 已知小 bug 修复（破折号 / 长度 / 标题解析）

- **Priority**: P1
- **Depends On**: None
- **Description**:
  - **破折号**：`post-write-validator.ts` 的破折号正则从 `/——+/g` 改为 `/—+/g`
  - **长度规范化**：`length-metrics.ts` 新增配置 `enableLightNormalize: boolean`（默认 false），当开启时，章节长度离 target 超过 ±25% 时即使在 soft 范围内也触发 LengthNormalizer
  - **标题解析**：`writer-parser.ts` 的 fallback 标题解析增加校验：候选标题不得是章节正文第一句之前出现的内容，且不得包含正则黑名单词（如"夜色/缓缓/突然"等典型正文副词）
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` T11.1: 含 `—` 和 `——` 的测试文本经 normalize() 后不再有破折号
  - `programmatic` T11.2: 2450 字章节（target 3000，light-normalize 开启）应被 LengthNormalizer 处理（log 中出现 length-normalize 调用）
  - `programmatic` T11.3: 形如"第三章 夜色降临，风吹过"的内容不会被误判为章节标题
- **Notes**: 轻量级修复，但对成品的观感影响不小。

---

## [ ] Task 12: index.ts 死代码导出清理 + 文档

- **Priority**: P2
- **Depends On**: Task 8, Task 9, Task 10 完成后
- **Description**:
  - 从 `index.ts` 的公共导出中移除：`creativity/*`, `compliance/*`（本次 PRD 不接入的模块，避免外部消费者误以为可用）
  - 保留 `consistency/*` 的导出（Studio 的 API handler 使用），但添加 JSDoc `/** @studio-only */` 注释
  - 对 `humanity/*`, `anti-ai/*`, `emotional/*` 三个模块的导出：确保本次 PRD 新增的调用点都能正确 import
  - 在 `packages/core/README.md`（如果存在）新增 "Quality Gate Flow" 一节，概述从写作 → audit → revise → anti-ai → humanity → emotion → persist 的完整流程
- **Acceptance Criteria Addressed**: 隐式（文档/结构清理）
- **Test Requirements**:
  - `programmatic` T12.1: `grep "creativity\|compliance" packages/core/src/index.ts` 应无命中
  - `human-judgment` T12.2: README 中的流程图应清晰表达 7 步质量门
- **Notes**: 本任务的核心价值是"不误导"——让 index.ts 的导出和实际功能匹配。

---

## 任务依赖图（DAG）

```
  Task 1 ──→ Task 10 (depends on Task 1 decision)
  Task 2 ──┐
           ├─→ Task 3 ──┬─→ Task 4
           │             └─→ Task 5 ──→ Task 6
           │
           └─ (Task 2 独立完成后 Task 3 才能验证)

  Task 7 (质量门) ── 独立，无依赖
  Task 8 (anti-ai 接入) ──┐
                           ├─ 可并行开发
  Task 9 (humanity/emotion) ─┘

  Task 11 (小 bug) ── 独立
  Task 12 (清理/文档) ── 依赖 Task 8/9/10 完成

  关键路径（决定总时长）：Task 2 → Task 3 → Task 4 → Task 5 → Task 6
  并行路径 A: Task 7 + Task 11
  并行路径 B: Task 8 + Task 9
  决策路径: Task 1 → Task 10
  收尾: Task 12
```

## 全局配置变量建议

建议在 `book_config.json` 的 schema 中新增以下字段（全部有默认值，向后兼容）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableAntiAI` | boolean | true | 是否启用 anti-ai 程序化处理 |
| `enableHumanity` | boolean | true | 是否启用 humanity（呼吸段+沉默层）处理 |
| `enableEmotion` | boolean | true | 是否启用 EmotionInjector 情感增强 |
| `enableLearning` | boolean | true | 是否启用用户偏好学习系统 |
| `maxErrorsPerChapter` | number | 0 | 允许通过的 error 级违规数量（0 = 零容忍） |
| `maxReviewIterations` | number | 3 | 最大修复循环次数 |
| `enableLightNormalize` | boolean | false | 是否在 soft 范围内也触发轻度长度规范化 |
| `humanizerIntensity` | number | 0.3 | Humanizer 的修改强度（0-1） |
| `silenceLayerIntensity` | number | 0.4 | SilenceLayerInjector 的修改强度（0-1） |

这些配置字段应该由 `models/book.ts` 的 zod schema 定义，并在 `pipeline/runner.ts` 构造时读入 `this.config`。
