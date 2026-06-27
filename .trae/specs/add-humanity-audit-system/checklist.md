# 真人感27维度审计与修订系统 - 验收清单

## 维度定义

- [x] HUMANITY_DIMENSIONS 包含 27 个维度，ID 范围 38-64
- [x] 每个维度有 id / name(zh+en) / layer / baseNote 四个字段
- [x] 5 个层级各有正确的维度数量：语言表层5 + 沉浸层5 + 叙事结构层5 + 人物情感层6 + 叙事与伏笔层6 = 27
- [x] DIMENSION_LABELS 中 38-64 的标签与 HUMANITY_DIMENSIONS 一致

## HumanityAuditor

- [x] HumanityAuditor 继承 BaseAgent
- [x] auditHumanity() 方法签名与 ContinuityAuditor.auditChapter() 兼容
- [x] 返回 AuditResult 接口（passed/issues/summary/overallScore）
- [x] 系统提示词包含全部 27 个维度的检测说明
- [x] 提示词支持中英文双语
- [x] JSON 解析能处理正常输出、代码块包裹、非 JSON 输出
- [x] parseFailed 时返回 critical 错误结果（不误改正文）
- [x] issues 中的 suggestion 包含可直接执行的改写内容

## ReviserAgent 升级

- [x] AuditIssue.repairScope 类型包含 "humanity-enhance"
- [x] resolveAutoOutputMode() 能识别 humanity-enhance 并路由
- [x] 真人感修复提示词明确"不改变剧情走向，只增强真人感"
- [x] 修复提示词按维度分组提供修复策略
- [ ] 修复流程优先使用 humanity 模块程序化能力（SilenceLayerInjector/SelfContradictionGenerator）
- [x] 程序化处理不足时才调用 LLM
- [x] 修复后内容字数变化 ≤ 15%
- [x] 修复输出包含 FIXED_ISSUES 逐条对应

## chapter-review-cycle 集成

- [x] 结构审计通过后才执行真人感审计
- [x] 真人感审计结果独立于结构审计结果
- [x] 真人感修复循环独立计数（maxHumanityIterations，默认 2）
- [x] enableHumanityAudit=false 时跳过真人感步骤
- [x] ChapterReviewCycleResult 包含 humanityAuditResult 和 humanityRevised 字段
- [x] 真人感问题不阻断章节保存（severity 默认 warning）
- [x] 最佳快照选择考虑真人感审计结果

## runner.ts 接入

- [x] writeNextChapter() 实例化 HumanityAuditor
- [x] humanityAuditor 传入 runChapterReviewCycle()
- [x] 从 book config 读取 enableHumanityAudit 配置
- [x] 日志输出 [humanity-audit] 前缀
- [x] GenreProfile schema 包含 enableHumanityAudit 字段（默认 true）

## 配置与开关

- [x] enableHumanityAudit 默认 true（向后兼容）
- [x] maxHumanityIterations 默认 2
- [ ] humanityAuditSeverity 支持 strict/normal/lenient 三档
- [x] book.json 中可配置以上字段

## 导出与集成

- [x] index.ts 导出 HumanityAuditor
- [x] index.ts 导出 HUMANITY_DIMENSIONS
- [x] index.ts 导出 getHumanityDimensionConfig
- [x] 集成测试验证完整流程：结构审计→真人感审计→真人感修复

## 测试覆盖

- [x] humanity-auditor.test.ts 覆盖维度定义、提示词构建、JSON 解析
- [x] humanity-reviser.test.ts 覆盖路由、提示词、输出解析
- [ ] humanity-audit-integration.test.ts 覆盖完整流程
- [x] Mock LLM 返回异常时不会崩溃
- [x] enableHumanityAudit=false 时行为与当前系统一致
