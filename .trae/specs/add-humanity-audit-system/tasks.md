# 真人感27维度审计与修订系统 - 实施任务清单

## [ ] Task 1: 创建真人感维度定义文件

- **Priority**: P0（阻塞 Task 2/3/4）
- **Depends On**: None
- **Description**:
  - 创建 `packages/core/src/agents/humanity-dimensions.ts`
  - 定义 27 个真人感维度（ID 38-64），每个维度包含：id、name（中英文）、layer（所属层级）、baseNote（检测说明）
  - 分 5 层：语言表层（38-42）、沉浸层（43-47）、叙事结构层（48-52）、人物情感层（53-58）、叙事与伏笔层（59-64）
  - 导出 `HUMANITY_DIMENSIONS` 常量和 `getHumanityDimensionConfig()` 函数
  - 导出 `HUMANITY_DIMENSION_IDS` 数组（用于激活）
- **Acceptance Criteria**: 维度定义完整，TypeScript 编译通过
- **Test Requirements**:
  - `programmatic` T1.1: HUMANITY_DIMENSIONS.length === 27
  - `programmatic` T1.2: 每个维度有 id/name/layer/baseNote 四个字段
  - `programmatic` T1.3: ID 范围 38-64，无重复

---

## [ ] Task 2: 扩展 DIMENSION_LABELS 并创建 HumanityAuditor

- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - 在 `packages/core/src/agents/continuity.ts` 的 `DIMENSION_LABELS` 中追加 ID 38-64 的中英文标签
  - 创建 `packages/core/src/agents/humanity-auditor.ts`
  - `HumanityAuditor` 继承 `BaseAgent`，实现 `auditHumanity()` 方法
  - 方法签名：`async auditHumanity(bookDir, chapterContent, chapterNumber, genre?, options?): Promise<AuditResult>`
  - 复用 `AuditResult` 和 `AuditIssue` 接口
  - 构建 27 维度审计提示词（中文/英文双语支持）
  - 提示词要求 LLM 对每个维度给出 ✅通过/⚠️基本通过/❌未通过 的判定，并给出具体改写建议
  - 输出格式与 ContinuityAuditor 一致（JSON: passed/overall_score/issues/summary）
  - 复用 `parseAuditResult` 的 JSON 解析逻辑（提取为共享方法或复制）
  - severity 默认为 warning，仅维度57（自我意识）和维度62（温度切换）在完全缺失时为 critical
- **Acceptance Criteria**: HumanityAuditor 能对章节内容输出完整的 AuditResult
- **Test Requirements**:
  - `programmatic` T2.1: 对一段测试文本调用 auditHumanity()，返回的 AuditResult 有 issues 数组
  - `programmatic` T2.2: issues 中的 category 字段包含维度名称（如"温度切换""自我意识"）
  - `programmatic` T2.3: suggestion 字段非空且包含具体改写建议

---

## [ ] Task 3: 升级 ReviserAgent 支持真人感修复

- **Priority**: P0
- **Depends On**: Task 1
- **Description**:
  - 在 `packages/core/src/agents/reviser.ts` 中：
    - `AuditIssue.repairScope` 类型扩展：新增 `"humanity-enhance"` 选项
    - `resolveAutoOutputMode()` 新增 humanity-enhance 路由：当 issues 含 humanity-enhance 时返回 `"humanity-enhance"` 模式
    - 新增 `buildHumanityEnhancePrompt()` 方法：构建真人感修复提示词
    - 提示词要求 LLM 做定点插入/替换，不改变剧情走向，只增强真人感
    - 提示词中明确列出需要修复的维度及具体建议
    - 新增 `parseHumanityEnhanceOutput()` 方法：解析定点插入/替换的输出
  - 创建 `packages/core/src/agents/humanity-reviser-prompts.ts`：
    - 真人感修复提示词模板（中文/英文）
    - 按维度分组的修复策略指南（如温度切换→插入不合时宜情绪；自我意识→插入元认知独白）
  - 修复流程：
    1. 检查 issues 中是否有可程序化处理的维度（63沉默层→SilenceLayerInjector，47自我矛盾→SelfContradictionGenerator）
    2. 程序化处理后再调用 LLM 做剩余维度的定点增强
    3. 输出格式：REVISED_CONTENT（完整正文，含插入内容）+ FIXED_ISSUES
- **Acceptance Criteria**: ReviserAgent 能接收真人感 issues 并输出修复后的内容
- **Test Requirements**:
  - `programmatic` T3.1: 传入 repairScope="humanity-enhance" 的 issues，resolveAutoOutputMode 返回 "humanity-enhance"
  - `programmatic` T3.2: 修复后的内容字数变化 ≤ 15%（定点插入不应大幅改变长度）
  - `programmatic` T3.3: 修复后的内容包含 suggestion 中提到的关键改写

---

## [ ] Task 4: 集成真人感审计到 chapter-review-cycle

- **Priority**: P0
- **Depends On**: Task 2, Task 3
- **Description**:
  - 修改 `packages/core/src/pipeline/chapter-review-cycle.ts`：
    - 在结构审计循环完成后（结构 passed=true 或达到 maxReviewIterations），增加真人感审计步骤
    - 新增 `assessHumanity()` 内部函数：调用 HumanityAuditor.auditHumanity()
    - 新增 `isHumanityPassed()` 判定：humanityAudit.passed 或 humanityIterations >= maxHumanityIterations
    - 真人感修复循环独立计数，最多 `maxHumanityIterations` 次（默认 2）
    - 真人感修复使用 ReviserAgent 的 humanity-enhance 模式
    - 真人感审计结果合并到最终返回的 auditResult 中
  - 修改 `runChapterReviewCycle` 的参数：
    - 新增可选参数 `humanityAuditor?: { auditHumanity: ... }`
    - 新增可选参数 `enableHumanityAudit?: boolean`（默认 true）
    - 新增可选参数 `maxHumanityIterations?: number`（默认 2）
  - 修改 `ChapterReviewCycleResult`：
    - 新增 `humanityAuditResult?: AuditResult`
    - 新增 `humanityRevised?: boolean`
- **Acceptance Criteria**: 审核循环能执行结构审计→真人感审计→真人感修复的完整流程
- **Test Requirements**:
  - `programmatic` T4.1: enableHumanityAudit=true 时，结果中包含 humanityAuditResult
  - `programmatic` T4.2: enableHumanityAudit=false 时，跳过真人感审计，结果中无 humanityAuditResult
  - `programmatic` T4.3: 真人感审计未通过时，humanityRevised=true

---

## [x] Task 5: runner.ts 接入真人感审计

- **Priority**: P0
- **Depends On**: Task 4
- **Description**:
  - 修改 `packages/core/src/pipeline/runner.ts`：
    - 在 `writeNextChapter()` 中实例化 HumanityAuditor
    - 将 humanityAuditor 传入 `runChapterReviewCycle()`
    - 从 book config 读取 `enableHumanityAudit` 配置
    - 在日志中输出 `[humanity-audit]` 前缀的审计结果
  - 修改 `packages/core/src/models/genre-profile.ts`：
    - GenreProfileSchema 新增 `enableHumanityAudit: z.boolean().default(true)`
  - 修改 `packages/core/src/models/book.ts`（如有 book config schema）：
    - 新增 `enableHumanityAudit` 和 `maxHumanityIterations` 字段
- **Acceptance Criteria**: inkos write next 命令能自动执行真人感审计
- **Test Requirements**:
  - `programmatic` T5.1: book.json 中 enableHumanityAudit=true 时，日志出现 [humanity-audit]
  - `programmatic` T5.2: book.json 中 enableHumanityAudit=false 时，无 [humanity-audit] 日志

---

## [x] Task 6: 真人感审计提示词优化与测试

- **Priority**: P1
- **Depends On**: Task 2
- **Description**:
  - 优化 HumanityAuditor 的系统提示词：
    - 明确每个维度的判定标准（✅/⚠️/❌ 的阈值）
    - 要求 LLM 引用原文具体位置
    - 要求 suggestion 必须包含可直接执行的改写内容
    - 提示词中加入"真人感写作方法论"参考（复用 writing-methodology.ts 的核心原则）
  - 编写单元测试 `packages/core/src/__tests__/humanity-auditor.test.ts`：
    - 测试维度定义完整性
    - 测试提示词构建（中英文）
    - 测试 JSON 解析（正常/异常/空输出）
    - Mock LLM 返回，验证 AuditResult 解析
- **Acceptance Criteria**: 提示词质量足够让 LLM 给出可操作的审计结果
- **Test Requirements**:
  - `programmatic` T6.1: 27 个维度在提示词中全部出现
  - `programmatic` T6.2: Mock LLM 返回非 JSON 时，parseFailed=true
  - `programmatic` T6.3: Mock LLM 返回合法 JSON 时，issues 正确解析

---

## [ ] Task 7: 真人感修复提示词优化与测试

- **Priority**: P1
- **Depends On**: Task 3
- **Description**:
  - 优化真人感修复提示词：
    - 按维度分组提供修复策略（温度切换→插入位置+示例；自我意识→独白模板）
    - 明确"不改变剧情走向，只增强真人感"的约束
    - 要求 LLM 输出 FIXED_ISSUES 逐条对应
  - 编写单元测试 `packages/core/src/__tests__/humanity-reviser.test.ts`：
    - 测试 resolveAutoOutputMode 的 humanity-enhance 路由
    - 测试修复提示词构建
    - 测试输出解析
    - Mock LLM 返回，验证修复后内容
- **Acceptance Criteria**: 修复提示词能指导 LLM 做定点真人感增强
- **Test Requirements**:
  - `programmatic` T7.1: 传入 humanity-enhance issues 时，提示词包含维度名称和修复策略
  - `programmatic` T7.2: 修复后 FIXED_ISSUES 非空且与输入 issues 对应

---

## [x] Task 8: index.ts 导出与集成测试

- **Priority**: P2
- **Depends On**: Task 5
- **Description**:
  - 在 `packages/core/src/index.ts` 中导出：
    - `HumanityAuditor`
    - `HUMANITY_DIMENSIONS`
    - `getHumanityDimensionConfig`
  - 编写集成测试 `packages/core/src/__tests__/humanity-audit-integration.test.ts`：
    - Mock LLM，模拟完整的 结构审计→真人感审计→真人感修复 流程
    - 验证 humanityAuditResult 出现在最终结果中
    - 验证 enableHumanityAudit=false 时跳过真人感步骤
- **Acceptance Criteria**: 公共 API 可用，集成流程验证通过
- **Test Requirements**:
  - `programmatic` T8.1: `import { HumanityAuditor } from "@actalk/inkos"` 可成功
  - `programmatic` T8.2: 集成测试模拟完整流程，humanityRevised=true

---

# Task Dependencies

```
Task 1 (维度定义) ──┬─→ Task 2 (HumanityAuditor) ──┬─→ Task 4 (review-cycle) ──→ Task 5 (runner.ts) ──→ Task 8 (集成)
                    │                                │
                    └─→ Task 3 (ReviserAgent升级) ──┘
                                                     
Task 2 ──→ Task 6 (审计提示词优化)
Task 3 ──→ Task 7 (修复提示词优化)

关键路径: Task 1 → Task 2 → Task 4 → Task 5 → Task 8
并行路径: Task 2 || Task 3 (都依赖 Task 1)
优化路径: Task 6 || Task 7 (分别依赖 Task 2/3)
```

## 全局配置变量

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableHumanityAudit` | boolean | true | 是否启用真人感27维度审计 |
| `maxHumanityIterations` | number | 2 | 真人感修复循环最大次数 |
| `humanityAuditSeverity` | "strict" \| "normal" \| "lenient" | "normal" | 真人感审计严格度（strict=缺失即critical，normal=缺失warning，lenient=仅记录info） |
