# inkos 系统修复与升级计划

## Summary

对 inkos 写作系统进行 7 个阶段的修复与升级：(1) 修复已知 bug；(2) 强化质量门控；(3) 修复用户偏好学习系统的持久化缺陷；(4) 用桌面上的 14 本真人小说初始化 HumanityProfile；(5) 将 anti-ai / humanity / emotional 三个模块群接入主写作流程；(6) 补全 PreferenceAnalyzer 的分析维度；(7) 配置化与代码清理。所有新增功能默认开启但可配置关闭，确保向后兼容。

## Current State Analysis

### 问题一：6 个模块"实现了但没接线"
- `anti-ai/*`（Humanizer, BurstinessAdjuster, PerplexityAnalyzer）：完整实现，纯本地计算，零 LLM 依赖，但 `pipeline/runner.ts` 从未实例化
- `humanity/*`（HumanityEngine, SceneBreaker, SilenceLayerInjector, SelfContradictionGenerator）：HumanityEngine 已有 `postProcessWrittenText()` 编排方法，但从未被 runner 调用
- `emotional/*`（EmotionInjector）：`enhanceChapter()` 是伪 async（无 await），纯本地计算，但从未被调用
- `PolisherAgent`：仅导出但无调用点

### 问题二：用户偏好学习系统"骨架完美、肉全空"
- `runner.ts:1843-1877` 的 `reviseDraft()` 方法中每次 `new EditTracker()` → 编辑记录永远只有 1 条 → batch 阈值（≥5）永不满足 → 偏好更新是死代码
- `writer-prompts.ts:115-131` 的 `buildUserPreferenceGuide()` 同样每次 `new UserProfileManager()` → 内存 Map 永远空
- `EditTracker.editBuffer`（内存数组）和 `UserProfileManager.storage`（内存 Map）均无持久化
- `ColdStartHandler` 实现了 5 种题材默认偏好但从未被调用
- `PreferenceAnalyzer` 的 humor/darkness/romance/action 全硬编码 0.5，wordPairs 永远空数组

### 问题三：质量门是"建议式"的
- `chapter-review-cycle.ts:214-215` 的 `isPassed()` 只检查 LLM 审计分≥85 + 长度在 hard 范围内 + 无违禁词
- error 级违规（破折号、空洞形容词等）只进 issues 列表，不阻止章节保存
- `maxReviewIterations` 默认值 = 1（第 34 行）
- `reviser.ts` 的 `ReviseOutput` 无 `criticalFailure` 字段，所有失败路径静默返回原文
- `writer.ts:393` 的 `analyzeAITells()` 结果仅写日志，未合并到 `postWriteErrors`

### 问题四：已知 bug
- `post-write-validator.ts:25` 破折号正则 `/——+/g` 只匹配双破折号，单 `—` 不被清理
- `length-metrics.ts` 的 soft 范围计算：target=3000 时 soft 范围 [2591, 3409]，2450 字也不触发规范化
- `writer-parser.ts:96-118` 标题 fallback 解析过宽

### 问题五：小说数据未利用
- 桌面上有 14 本真人小说（`C:\Users\ZhuanZ\Desktop\*.txt`），`SampleAnalyzer` 可以从中提取 12 维 HumanityFingerprint
- 但系统从未用这些数据初始化 HumanityEngine

## Proposed Changes

### Phase 1: 已知 Bug 修复（独立，无依赖）

#### 1.1 破折号正则修复
- **文件**: `packages/core/src/agents/post-write-validator.ts`
- **位置**: 第 25 行
- **改动**: `/——+/g` → `/—+/g`
- **原因**: 单 em-dash `—` 也需要被规范化为中文逗号
- **注意**: 第 157 行的 `content.includes("——")` 检测需同步改为 `content.includes("—")`，但需确认调用顺序——如果 normalize 先于 validate 执行，检测不会触发（因为已被替换），这是正确行为

#### 1.2 analyzeAITells 结果合并到 postWriteErrors
- **文件**: `packages/core/src/agents/writer.ts`
- **位置**: 第 393-415 行
- **改动**: 将 `aiTellIssues` 中 severity 为 "error" 的项合并到 `postWriteErrors`，"warning" 的合并到 `postWriteWarnings`
- **原因**: 当前 aiTellIssues 仅写日志，下游 review 循环无法感知 AI 味问题

#### 1.3 标题 fallback 解析加固
- **文件**: `packages/core/src/agents/writer-parser.ts`
- **位置**: 第 96-118 行 `fallbackExtractTitle()`
- **改动**: 在 headingMatch 返回前增加校验——候选标题不得包含逗号/句号等标点（标题不会含这些），长度 ≤ 20 字符
- **原因**: 防止正文中的 "第三章 夜色降临，风吹过" 被误抽为标题

---

### Phase 2: 质量门控强化（独立，无依赖）

#### 2.1 isPassed() 增加 zero-error 规则
- **文件**: `packages/core/src/pipeline/chapter-review-cycle.ts`
- **位置**: 第 214-215 行
- **改动**: 在现有三个 AND 条件基础上增加第四个：`assessment.auditResult.issues.filter(i => i.severity === "error").length <= maxErrorsPerChapter`
- **新增常量**: `const DEFAULT_MAX_ERRORS_PER_CHAPTER = 0;`（第 37 行附近）
- **参数化**: `maxErrorsPerChapter` 从 `params` 中读取，默认 0

#### 2.2 maxReviewIterations 默认值提升
- **文件**: `packages/core/src/pipeline/chapter-review-cycle.ts`
- **位置**: 第 34 行
- **改动**: `const DEFAULT_MAX_REVIEW_ITERATIONS = 1;` → `const DEFAULT_MAX_REVIEW_ITERATIONS = 3;`

#### 2.3 ReviseOutput 增加 criticalFailure 标记
- **文件**: `packages/core/src/agents/reviser.ts`
- **位置**: 第 38-50 行（ReviseOutput 接口）+ 第 357-366 行（makeResult 函数）
- **改动**:
  - 接口新增 `readonly criticalFailure?: boolean` 字段
  - `makeResult` 增加可选参数 `criticalFailure?: boolean`
  - 所有 `return makeResult(originalChapter, false)` 调用点（第 382、392、410、422 行）改为 `return makeResult(originalChapter, false, true)`
- **原因**: 让调用方能区分"修复成功"和"修复失败但保留原文"

---

### Phase 3: 用户偏好学习系统持久化（核心修复）

#### 3.1 StateManager 新增通用 JSON 读写方法
- **文件**: `packages/core/src/state/manager.ts`
- **位置**: 类内部新增两个方法
- **新增**:
  ```typescript
  async readJSON<T>(relativePath: string): Promise<T | null> {
    // 读取 projectRoot/relativePath，JSON.parse，失败返回 null
  }
  async writeJSON<T>(relativePath: string, data: T): Promise<void> {
    // JSON.stringify + writeFile，自动创建目录
  }
  ```
- **原因**: EditTracker 和 UserProfileManager 需要持久化，复用 StateManager 的 projectRoot

#### 3.2 EditTracker 持久化改造
- **文件**: `packages/core/src/learning/edit-tracker.ts`
- **改动**:
  - 构造函数新增可选参数 `storage?: { read: () => Promise<UserEdit[]>; write: (edits: UserEdit[]) => Promise<void> }`
  - 初始化时从 storage 加载已有编辑到 `editBuffer`
  - `trackEdit()` 后自动调用 `storage.write()` 持久化
  - `clearBuffer()` 后也持久化（清空文件）
- **修复 onBatch 回调缺陷**: `flushBuffer()` 先保存当前 buffer 引用，再清空，再回调（修复第 125-130 行的数据丢失问题）

#### 3.3 UserProfileManager 持久化改造
- **文件**: `packages/core/src/learning/user-profile.ts`
- **改动**:
  - 构造函数新增可选参数 `storage?: { read: () => Promise<Map<string, WritingPreference>>; write: (map: Map<string, WritingPreference>) => Promise<void> }`
  - 初始化时从 storage 加载
  - `updatePreference()` 后自动持久化
- **持久化路径**: `<bookDir>/.inkos/learning/preferences.json`（序列化 Map 为 JSON 对象）

#### 3.4 runner.ts 实例化策略修复
- **文件**: `packages/core/src/pipeline/runner.ts`
- **位置**: 第 1843-1877 行（`reviseDraft()` 方法内）
- **改动**:
  - 不再每次 `new EditTracker()`，改为在 PipelineRunner 构造函数中创建单例（带持久化 storage）
  - 不再每次 `new UserProfileManager()`，同样改为单例
  - batch 阈值从硬编码 `>= 5` 改为 `EditTracker.batchSize`（默认 10）
  - 绑定 `onBatch` 回调，不再手动检查缓冲区

#### 3.5 writer-prompts.ts 实例化策略修复
- **文件**: `packages/core/src/agents/writer-prompts.ts`
- **位置**: 第 115-131 行 `buildUserPreferenceGuide()`
- **改动**:
  - 接收 `UserProfileManager` 实例作为参数（由调用方传入单例），不再自己 `new`
  - 当 `sampleSize < 5` 时，调用 `ColdStartHandler.getGenreDefault(bookGenre)` 获取题材默认偏好
  - 用 `mergeWithDefaults()` 补全为完整 `WritingPreference`
  - 通过 `PromptEnhancer.generateStyleGuide()` 转为文字指南
- **需要**: 从 book config 读取 `genre` 字段（已确认存在于 `models/book.ts:59`）

#### 3.6 ColdStartHandler 接入
- **文件**: `packages/core/src/agents/writer-prompts.ts`
- **改动**: import `ColdStartHandler`，在 `buildUserPreferenceGuide()` 中当 sampleSize < 5 时使用
- **依赖**: `cold-start.ts:14` 的 `getGenreDefault(genre)` 返回 `Partial<WritingPreference>`，需配合 `mergeWithDefaults()`（第 114-141 行）

---

### Phase 4: 小说数据集成（HumanityProfile 初始化）

#### 4.1 创建 HumanityProfile 初始化脚本/方法
- **文件**: `packages/core/src/humanity/profile-initializer.ts`（新建）
- **功能**:
  - 读取指定目录下的 `.txt` 小说文件
  - 调用 `SampleAnalyzer.analyzeFromFiles()` 提取 12 维 HumanityFingerprint
  - 调用 `deriveStyleInjectionFromFingerprint()` 反推 StyleInjection 参数
  - 调用 `createDefaultHumanityProfile()` 创建基础 profile，覆盖 fingerprint 和 styleInjection
  - 持久化到 `<projectRoot>/.inkos/humanity/default-profile.json`
- **数据源**: `C:\Users\ZhuanZ\Desktop\*.txt`（14 本小说）
- **注意**: `SampleAnalyzer.analyze()` 是 async 但纯本地计算（正则+统计），无 LLM 依赖

#### 4.2 HumanityEngine 接入 runner.ts
- **文件**: `packages/core/src/pipeline/runner.ts`
- **改动**:
  - 构造函数中创建 `HumanityEngine` 单例
  - 初始化时检查 `<projectRoot>/.inkos/humanity/default-profile.json` 是否存在
  - 若存在，加载已有 profile；若不存在，用默认 profile（后续可通过 CLI 命令初始化）
  - 在 `writeNextChapter()` 流程中：
    - **LLM 前**: 调用 `humanityEngine.enhanceSystemPrompt(systemPrompt, writingContext)` 增强提示词
    - **LLM 后**: 调用 `humanityEngine.postProcessWrittenText(finalContent, writingContext)` 做后处理
  - WritingContext 构造：从 book config 读取 protagonistName 等，chapterWordCount 从 lengthSpec 获取

#### 4.3 构建 WritingContext 的辅助方法
- **文件**: `packages/core/src/pipeline/runner.ts`
- **新增私有方法**: `buildWritingContext(bookConfig, chapterNumber, lengthSpec): WritingContext`
- **字段映射**:
  - `protagonistName`: 从 book_rules 或 character_matrix 中读取主角名
  - `chapterWordCount`: `lengthSpec.target`
  - `existingBodyDescriptions` / `existingProps`: 从 truth 文件中读取（可选，空数组也可）
  - `currentEmotion`: 从 emotional_arcs.md 中解析当前章节的情绪

---

### Phase 5: anti-ai + emotional 模块接入主流程

#### 5.1 新增 postProcess() 方法到 runner.ts
- **文件**: `packages/core/src/pipeline/runner.ts`
- **位置**: `_writeNextChapterLocked()` 的步骤 5（review cycle）之后、步骤 11（persistChapterArtifacts）之前
- **新增方法**: `private async postProcessChapter(content: string, bookConfig: BookConfig, chapterNumber: number): Promise<string>`
- **流程**:
  1. 若 `enableAntiAI`（默认 true）:
     - `new Humanizer().humanize(content, humanizerIntensity)` — 口语化+不完美+语气词
     - `new BurstinessAdjuster().adjustBurstiness(content, 0.6)` — 句子长度突发性调整
     - 日志: `[anti-ai] humanize applied: N chars changed` / `[anti-ai] burstiness adjusted: from X to Y`
  2. 若 `enableHumanity`（默认 true）:
     - `humanityEngine.postProcessWrittenText(content, writingContext)` — 沉默层+矛盾+呼吸段+不体面道具
     - 日志: `[humanity] post-process applied`
  3. 若 `enableEmotion`（默认 true）:
     - 从 `emotional_arcs.md` 解析当前章节的 primaryEmotion 和 intensity
     - 构造最小 `EmotionalArc` 对象（只含当前章节信息）
     - `new EmotionInjector().enhanceChapter(content, arc, chapterNumber)`
     - 日志: `[emotion] enhanced with {emotion}({intensity}): N phrases injected`
  4. 所有步骤用 try/catch 包裹，单个失败不阻断流程，记录 warning

#### 5.2 emotional_arcs.md 解析器
- **文件**: `packages/core/src/emotional/arc-parser.ts`（新建）
- **功能**: 从 emotional_arcs.md 的 markdown 表格中提取指定章节的情绪信息
- **解析规则**（基于 `planner-context.ts:166-183` 的现有逻辑）:
  - 使用 `parseMarkdownTableRows()` 解析表格
  - 列布局: `角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向`
  - 章节号在 column index 1
  - 返回 `{ primaryEmotion: EmotionType, intensity: number }` 或 null
- **EmotionType 映射**: 将中文情绪词（如"紧张"/"愤怒"）映射到 `EmotionType` 联合类型（如 "tension"/"anger"）

#### 5.3 PerplexityAnalyzer 接入 detection-runner
- **文件**: `packages/core/src/pipeline/detection-runner.ts`
- **位置**: `detectAndRewrite()` 方法内（第 83-119 行的循环中）
- **改动**:
  - 在每次 `detectAIContent()` 调用前，先调用 `new PerplexityAnalyzer().analyze(currentContent)` 获取本地 perplexity 分数
  - 日志记录本地分数与外部检测分数的对比
  - 若本地 perplexity 已低于阈值，可跳过外部 API 调用（节省成本）
- **原因**: PerplexityAnalyzer 是纯本地计算（字符级 bigram 熵），零 API 成本

---

### Phase 6: PreferenceAnalyzer 维度补全

#### 6.1 实现 humor / darkness / romance 分析
- **文件**: `packages/core/src/learning/preference-analyzer.ts`
- **位置**: 第 86-89 行（当前硬编码 0.5 的位置）
- **改动**:
  - `humor`: 统计编辑文本中"哈哈/笑了/调侃/滑稽/有趣/好笑"等关键词密度，映射到 0-1
  - `darkness`: 统计"血/死/尸体/黑暗/恐惧/绝望/残忍"等关键词密度
  - `romance`: 统计"爱/喜欢/心动/吻/拥抱/温柔"等关键词密度
  - 每个维度基于关键词出现频率 / 总字数，乘以缩放因子，clamp 到 [0, 1]

#### 6.2 实现 wordPairs 提取
- **文件**: `packages/core/src/learning/preference-analyzer.ts`
- **位置**: 第 158 行（当前空数组）
- **改动**:
  - 从编辑文本中提取所有双字词组（中文按 2 字滑窗）
  - 对新增文本中的词组记 positive，对删除文本中的词组记 negative
  - 按频率排序，取 top-10 作为 wordPairs

#### 6.3 实现 longSentenceRatio / paragraphLength
- **文件**: `packages/core/src/learning/preference-analyzer.ts`
- **位置**: 第 122-123 行（当前硬编码）
- **改动**:
  - `longSentenceRatio`: 统计编辑后文本中 >40 字句子的比例
  - `paragraphLength`: 统计编辑后文本的平均段落字数

#### 6.4 PromptEnhancer 扩展维度
- **文件**: `packages/core/src/learning/prompt-enhancer.ts`
- **位置**: 第 63-93 行 `generateStyleGuide()`
- **改动**: 在"语言风格"章节新增:
  - `darkness > 0.6` → "氛围阴暗、情感沉重"
  - `darkness < 0.3` → "氛围明快、情感轻松"
  - `romance > 0.6` → "情感张力强、人物关系细腻"
  - `action > 0.6` → "节奏快、动作描写直接"
  - `paragraphLength < 80` → "多用短段落制造紧张感"
- **原因**: 当前 generateStyleGuide 只用了 formality/literaryLevel/humor 3 个维度

---

### Phase 7: 配置化与代码清理

#### 7.1 BookConfig 新增配置字段
- **文件**: `packages/core/src/models/book.ts`
- **位置**: 第 55-68 行 BookConfigSchema
- **新增字段**（全部 optional + default，向后兼容）:
  ```typescript
  enableAntiAI: z.boolean().optional().default(true),
  enableHumanity: z.boolean().optional().default(true),
  enableEmotion: z.boolean().optional().default(true),
  enableLearning: z.boolean().optional().default(true),
  maxErrorsPerChapter: z.number().int().min(0).optional().default(0),
  maxReviewIterations: z.number().int().min(0).optional().default(3),
  humanizerIntensity: z.number().min(0).max(1).optional().default(0.3),
  ```
- **注意**: zod 的 `.optional().default()` 模式确保旧 book.json 不含这些字段时自动使用默认值

#### 7.2 PolisherAgent 决策
- **文件**: `packages/core/src/agents/polisher.ts`
- **决策**: 弃用（基于探索发现其功能与 ReviserAgent + Humanizer 重叠）
- **改动**:
  - 文件顶部添加 `@deprecated` JSDoc 注释
  - 从 `packages/core/src/index.ts` 的公共导出中移除 `PolisherAgent` 及其类型

#### 7.3 index.ts 死代码清理
- **文件**: `packages/core/src/index.ts`
- **改动**:
  - 移除 `creativity/*` 的公共导出（仅测试用，不在 pipeline 中）
  - 移除 `compliance/*` 的公共导出（仅测试用）
  - 保留 `consistency/*` 导出（Studio API handler 使用），添加 `@studio-only` JSDoc
  - 保留 `anti-ai/*`、`emotional/*`、`humanity/*`、`learning/*` 导出（Phase 5 接入后会被 pipeline 使用）

---

## Assumptions & Decisions

1. **所有新增模块调用都用 try/catch 包裹**，单个模块失败只记录 warning 不阻断写作流程
2. **HumanityEngine 使用默认 HumanityProfile 初始化**（Phase 4 的小说数据初始化作为可选增强，不阻塞核心接入）
3. **EmotionInjector 通过新建的 arc-parser.ts 从 emotional_arcs.md 获取数据**，而非修改 EmotionInjector 的接口
4. **PolisherAgent 决定弃用**（与 ReviserAgent + Humanizer 功能重叠）
5. **creativity/* 和 compliance/* 暂不接入**（对"真人感"直接贡献低于 anti-ai/emotional/humanity）
6. **detector.ts 保持现状**（外部 API 不稳定，不自动接入 write 主流程）
7. **所有配置字段默认开启新功能**，但允许通过 book.json 关闭，确保向后兼容
8. **持久化路径统一在 `<bookDir>/.inkos/learning/` 下**，与现有 `.inkos/` 目录结构一致

## Verification Steps

### Phase 1 验证
- [ ] 单元测试: 含 `—` 和 `——` 的文本经 `normalizePostWriteSurface()` 后无破折号残留
- [ ] 单元测试: `analyzeAITells()` 的 error 级 issues 出现在 `postWriteErrors` 中
- [ ] 单元测试: `fallbackExtractTitle()` 对含逗号的标题行返回默认标题

### Phase 2 验证
- [ ] 单元测试: 含 error 级违规的文本 → `isPassed()` 返回 false
- [ ] grep 验证: `DEFAULT_MAX_REVIEW_ITERATIONS = 3`
- [ ] 单元测试: `ReviseOutput` 包含 `criticalFailure: true` 当 patch 解析失败时

### Phase 3 验证
- [ ] 单元测试: 2 次独立 `new EditTracker({storage})` 调用，第 2 次能读到第 1 次的编辑
- [ ] 单元测试: `UserProfileManager` 跨实例读取到之前写入的偏好
- [ ] 集成测试: 5 次 `reviseDraft()` 调用后，`preferences.json` 中 `sampleSize ≥ 5`
- [ ] 集成测试: 新用户（sampleSize=0）的 writer prompt 包含题材默认风格指南（非空）

### Phase 4 验证
- [ ] 单元测试: `profile-initializer.ts` 能从 txt 文件提取 HumanityFingerprint
- [ ] 集成测试: HumanityEngine 初始化后 profile 的 fingerprint 非全默认值
- [ ] grep 验证: `runner.ts` 中存在 `humanityEngine.postProcessWrittenText()` 调用

### Phase 5 验证
- [ ] 集成测试: 写一章后日志中出现 `[anti-ai]`、`[humanity]`、`[emotion]` 标签
- [ ] 集成测试: 处理前后字数差 ≤ 5%
- [ ] 性能测试: 程序化处理单章总耗时 ≤ 200ms
- [ ] grep 验证: `detection-runner.ts` 中存在 `PerplexityAnalyzer.analyze()` 调用

### Phase 6 验证
- [ ] 单元测试: "黑暗文本" vs "幽默文本"的 darkness/humor 分数差 ≥ 0.3
- [ ] 单元测试: wordPairs 非空（≥ 3 对）
- [ ] 单元测试: 高 romance preference 的指南包含"情感"或"关系"关键词

### Phase 7 验证
- [ ] grep 验证: `index.ts` 中无 `creativity`/`compliance` 导出
- [ ] grep 验证: `polisher.ts` 顶部有 `@deprecated`
- [ ] 构建验证: `pnpm -r build` 成功
- [ ] 类型检查: `pnpm -r typecheck` 无错误
- [ ] 回归测试: `pnpm -r test` 全部通过

### 最终 E2E 验证
- [ ] 关闭所有新功能时（`enableAntiAI=false` 等），写作行为与修改前一致
- [ ] 开启所有新功能时，写一章的日志包含全部标签
- [ ] 桌面小说数据初始化后，HumanityProfile 的 fingerprint 有真实值
