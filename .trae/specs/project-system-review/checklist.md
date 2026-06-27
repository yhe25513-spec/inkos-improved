# inkos 项目系统增强 - 验证检查清单

## 阶段 0: 代码审查前置验证（实施前确认）

- [ ] C-0.1: 确认 `packages/core/src/anti-ai/humanizer.ts` 中 `humanize()` 方法确实不调用 LLM（纯程序化）
- [ ] C-0.2: 确认 `packages/core/src/anti-ai/burstiness-adjuster.ts` 中 `adjustBurstiness()` 确实不调用 LLM
- [ ] C-0.3: 确认 `packages/core/src/humanity/scene-breaker.ts` / `silence-layer.ts` / `self-contradiction.ts` 确实不调用 LLM
- [ ] C-0.4: 确认 `packages/core/src/emotional/injector.ts` 中 `enhanceChapter()` 确实不调用 LLM
- [ ] C-0.5: 确认 `book_config.json`（或 `models/book.ts` 的 zod schema）中存在 `genre` 字段
- [ ] C-0.6: 确认 `StateManager` 有可复用的 JSON 读写接口（或需要新增）
- [ ] C-0.7: 确认 `packages/core/src/__tests__/` 目录存在且有测试框架可用（jest/vitest/other）

## 阶段 1: 用户偏好学习系统集成验证

- [ ] C-1.1: 持久化文件路径 `<bookDir>/.inkos/learning/edit_log.json` 在 1 次编辑后存在
- [ ] C-1.2: 持久化文件路径 `<bookDir>/.inkos/learning/preferences.json` 在分析后存在
- [ ] C-1.3: 第 2 次独立进程启动时，EditTracker 能读到第 1 次写入的编辑（跨会话验证）
- [ ] C-1.4: 连续 5 次 `applyChapterRevision()` 调用后，`preferences.json` 中 `meta.sampleSize ≥ 5`
- [ ] C-1.5: 新用户（sampleSize=0）写章节时，prompt 中包含基于 ColdStartHandler 的题材默认风格指南（非空字符串，grep 验证）
- [ ] C-1.6: `PreferenceAnalyzer.analyze()` 对"黑暗文本"和"幽默文本"产出不同的 `humor`/`darkness` 分数（差 ≥ 0.3）
- [ ] C-1.7: `wordPairs` 数组非空（至少 3 对词组）
- [ ] C-1.8: `PromptEnhancer.generateStyleGuide()` 的输出中包含 "情感" 或 "关系" 等 romance 相关的表达
- [ ] C-1.9: 不同 preference 输入产生不同的指南输出（不是模板化字符串）
- [ ] C-1.10: runner.ts 和 writer-prompts.ts 中不再出现 `new EditTracker()` / `new UserProfileManager()` 在每次调用时的硬新建（应改为从持久化加载/保存的单例模式）

## 阶段 2: 质量门控验证

- [ ] C-2.1: `chapter-review-cycle.ts` 中 `maxReviewIterations` 默认值 = 3（grep 验证）
- [ ] C-2.2: `isPassed()` 中存在 `numberOfErrorLevelIssues <= config.maxErrorsPerChapter` 检查
- [ ] C-2.3: 含 3 个 error 级违规的测试文本 → isPassed() 返回 false → 修复循环被触发
- [ ] C-2.4: 循环结束后要么 error 归零，要么返回明确的 `criticalFailure: true` 标记
- [ ] C-2.5: `reviser.ts` patch 解析失败时，返回结果包含 `criticalFailure: true`（而非静默返回原文）
- [ ] C-2.6: `writer.ts` 中 `analyzeAITells()` 的 issues 被合并到 `postWriteErrors`（grep 代码验证）
- [ ] C-2.7: `reviser.ts` 中不再有 `return makeResult(originalChapter, false)` 这种静默回退原文的无信号返回（应改为带 critical 标记）

## 阶段 3: anti-ai / humanity / emotion 模块接入验证

- [ ] C-3.1: `PipelineRunner.writeNextChapter()` 流程中存在调用 `Humanizer.humanize()` 的代码路径
- [ ] C-3.2: 同上，存在调用 `BurstinessAdjuster.adjustBurstiness()` 的代码路径
- [ ] C-3.3: 写一章后，日志中出现 `[anti-ai] humanize applied: X paragraphs modified`
- [ ] C-3.4: 写一章后，日志中出现 `[anti-ai] burstiness adjusted: from X to Y`
- [ ] C-3.5: anti-ai 处理前后字数差 ≤ 5%
- [ ] C-3.6: `chapter-review-cycle.ts` 中存在调用 `SceneBreaker.insertBreathing()` 的代码路径
- [ ] C-3.7: 同上，存在调用 `SilenceLayerInjector.inject()` 的代码路径
- [ ] C-3.8: 同上，存在调用 `EmotionInjector.enhanceChapter()` 的代码路径
- [ ] C-3.9: 写一章后，日志中出现 `[humanity] breathing segments inserted: N`（N>0 对高张力章节）
- [ ] C-3.10: 写一章后，日志中出现 `[humanity] silence layer injected: M replacements`
- [ ] C-3.11: 写一章后，日志中出现 `[emotion] enhanced with {emotion}({intensity}): N phrases injected`
- [ ] C-3.12: `detection-runner.ts.detectAndRewrite()` 中存在 `PerplexityAnalyzer.analyze()` 的前后两次调用
- [ ] C-3.13: anti-ai + humanity + emotion 三类程序化处理的单章总耗时 ≤ 200ms（对 3000 字章节）
- [ ] C-3.14: `book_config.json` schema 中存在 `enableAntiAI` / `enableHumanity` / `enableEmotion` 三个配置开关

## 阶段 4: PolisherAgent 去留验证

- [ ] C-4.1: 如果选择接入：`chapter-review-cycle.ts` 中存在 `finalPolish()` 步骤 → 日志中出现 `[polish] final polish applied`
- [ ] C-4.2: 如果选择弃用：`packages/core/src/index.ts` 中 grep `PolisherAgent` 无结果；`polisher.ts` 文件顶部存在 `@deprecated` 注释
- [ ] C-4.3: 不存在"既没有接入也没有弃用"的中间状态

## 阶段 5: 已知 bug 修复验证

- [ ] C-5.1: `post-write-validator.ts` 中破折号正则为 `/—+/g`（不是 `/——+/g`）
- [ ] C-5.2: 测试文本 `他看了看窗外——天灰蒙蒙的—又低下头。` 经 normalize() 后无任何 `—` 或 `——`
- [ ] C-5.3: `length-metrics.ts` 中存在 `enableLightNormalize` 配置项
- [ ] C-5.4: enableLightNormalize=true 时，2450 字（target 3000）章节被 LengthNormalizer 处理
- [ ] C-5.5: `writer-parser.ts` fallback 标题解析有额外校验：候选标题不得在正文第一句之前出现，也不得包含"夜色/缓缓/突然"等黑名单词
- [ ] C-5.6: 形如 `# 第三章 夜色降临，风吹过` 的内容不会被误识别为章节标题

## 阶段 6: 代码清理与文档验证

- [ ] C-6.1: `packages/core/src/index.ts` 中 grep `creativity` 无结果（从公共导出移除）
- [ ] C-6.2: `packages/core/src/index.ts` 中 grep `compliance` 无结果（从公共导出移除）
- [ ] C-6.3: `consistency/*` 的导出有 `/** @studio-only */` JSDoc 注释
- [ ] C-6.4: `packages/core/README.md`（或等价文档）中存在 "Quality Gate Flow" 一节，描述从写作到持久化的完整处理流程
- [ ] C-6.5: 所有新接入的模块调用都有 `try/catch` 包裹，单个模块失败不应导致整章写作失败（容错设计）

## 阶段 7: E2E 集成验证

- [ ] C-7.1: 使用同一 seed/prompt，连续写 3 章（~3000 字/章），全部成功完成
- [ ] C-7.2: 每一章的日志中都出现 `[anti-ai]` / `[humanity]` / `[emotion]` 三个标签的日志条目
- [ ] C-7.3: 每一章的 `truth/emotional_arcs.md` 中写入了该章的情绪数据
- [ ] C-7.4: 第 1 章写完后磁盘上出现 `.inkos/learning/` 目录
- [ ] C-7.5: 手动对 3 章各做 2 次编辑（共 6 次），验证 `preferences.json` 中 `sampleSize ≥ 6`
- [ ] C-7.6: 第 4 章写作时，writer prompt 中包含基于学习数据的个性化风格指南
- [ ] C-7.7: 写作总耗时对比基线（仅 writer+audit+revise）：程序化处理额外开销 ≤ 500ms/章（宽松阈值）
- [ ] C-7.8: 关闭所有新功能（`enableAntiAI=false, enableHumanity=false, enableEmotion=false, enableLearning=false`）时，写作行为与 PRD 实施前完全一致（向后兼容验证）

## 阶段 8: 测试覆盖率验证

- [ ] C-8.1: `packages/core/src/__tests__/` 目录下新增 `edit-tracker.persistence.test.ts`（或等价文件名）
- [ ] C-8.2: 新增 `user-profile.persistence.test.ts`
- [ ] C-8.3: 新增 `preference-analyzer.dimensions.test.ts`
- [ ] C-8.4: 新增 `prompt-enhancer.guide-variety.test.ts`
- [ ] C-8.5: 新增 `chapter-review-cycle.zero-error.test.ts`
- [ ] C-8.6: 新增 `anti-ai.integration.test.ts`
- [ ] C-8.7: 新增 `humanity.integration.test.ts`
- [ ] C-8.8: 新增 `emotion-injector.integration.test.ts`
- [ ] C-8.9: 新增 `post-write-validator.dash.test.ts`
- [ ] C-8.10: 运行 `npm test`（或等价命令）所有测试通过（新增 + 原有回归）

## 阶段 9: 人工评审验证（human-judgment 类 AC）

- [ ] C-9.1: **3 人背对背评审**：每人各读 2 段文本（处理前/处理后各一段，不知道哪段是哪段），对"哪段更有真人感"投票
- [ ] C-9.2: 投票结果：至少 2/3 的评审员认为处理后的版本"更像真人写的"（AC-2 的 human-judgment 部分）
- [ ] C-9.3: 至少 2/3 的评审员认为情感增强后的版本"情绪表达更细腻/更有张力"（AC-3 的 human-judgment 部分）
- [ ] C-9.4: 对 xuanhuan / urban / mystery 三种题材各生成一份 ColdStart 指南，至少 2/3 的评审员认为三份指南有可感知的风格差异
- [ ] C-9.5: 评审员一致确认：处理后的文本没有"机器味更浓"或"语义被改变"的副作用（即 NFR-1 的"不改变语义"的人工验证）

## 最终发布检查清单（Go/No-Go）

- [ ] Go-1: 所有 P0/P1 任务完成
- [ ] Go-2: 阶段 1-7 的所有检查点 `[x]` 已打勾
- [ ] Go-3: 阶段 8 的测试全部通过，无回归失败
- [ ] Go-4: 阶段 9 的人工评审无"变差"结论（即处理后文本不允许比处理前更差）
- [ ] Go-5: `npm run build`（或等价构建命令）成功，无 TypeScript 错误
- [ ] Go-6: `inkos write --book <existingBook>` 对一本已有书籍成功写一章（回归测试）
- [ ] Go-7: 所有新增配置字段有默认值，未修改 book_config.json 的用户行为不变（向后兼容）
- [ ] Go-8: 新增的日志输出（`[anti-ai]`, `[humanity]`, `[emotion]`）不污染正常使用场景（日志级别合理）
