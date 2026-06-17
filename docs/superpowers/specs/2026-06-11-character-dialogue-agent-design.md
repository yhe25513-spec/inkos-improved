# InkOS Pro 升级设计文档（完整版 v2）

> **目标**：在 InkOS v1.4.1 基础上全面升级，解决四大核心问题：AI味太重、情节不连贯、情节老套、缺少互动控制。
>
> **版本**：v2.0 — 修复版，包含验收标准、数据契约、回退策略、性能预算

---

## 文档结构

```
Part 1: 已完成改动（Phase 1-2）        ← 已落地的代码
Part 2: 人物对话 Agent（Phase 2.5）     ← 核心新功能
Part 3: 连贯性增强（Phase 3）
Part 4: 反老套（Phase 4）
Part 5: 番茄/朱雀AI检测（Phase 5）
Part 6: 交互控制（Phase 5.5）
Part 7: 数据文件优化（Phase 6）
Part 8: 多模型策略
Part 9: 可视化检测报告
附录A: 完整 Pipeline 流程
附录B: 验收标准总表
附录C: 数据契约定义
附录D: 失败回退策略
附录E: 性能预算
附录F: 回归测试计划
```

---

# Part 1: 已完成改动（Phase 1-2）✅

## 1.1 Phase 1: Fork + 环境搭建 ✅

| 改动 | 文件 | 状态 |
|------|------|------|
| Fork inkos 仓库 | `inkos-dev/` | ✅ |
| npm link 替换原版 | 全局 inkos 命令 | ✅ |
| 版本升级 | 1.4.1 → 1.5.0 | ✅ |

**验收标准**：
- [x] `inkos --version` 输出 1.5.0
- [x] `inkos status` 能正常读取现有项目
- [x] 现有章节数据完好

## 1.2 Phase 2: 写作质量提升 ✅

| 改动 | 文件 | 状态 |
|------|------|------|
| AI检测增强（+4维度） | `agents/ai-tells.ts` | ✅ |
| Writer Prompt 增强 | `agents/writer-prompts.ts` | ✅ |
| AntiDetectAgent 新建 | `agents/anti-detect.ts` | ✅ |
| Pipeline 集成 | `pipeline/runner.ts` | ✅ |

**验收标准**：
- [x] TypeScript 编译通过（0 error）
- [x] `inkos --version` 正常
- [x] `inkos status` 正常
- [ ] 实际写一章测试（待执行）

---

# Part 2: 人物对话 Agent（Phase 2.5）📋

## 2.1 目标

让每个角色有独立的"灵魂"，通过预写排练和后审验证确保对话质量。

## 2.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 对话审计分 | ≥ 7/10 | `inkos audit` 输出 |
| OOC问题数 | 0 个 critical | 审计结果 |
| 角色辨识度 | ≥ 8/10 | 人工评估 |
| 声音提取准确率 | ≥ 80% | 与手动定义对比 |
| 每章额外耗时 | ≤ 30秒 | 计时测试 |
| 每章额外token | ≤ 10k | token统计 |

## 2.3 数据契约

### 2.3.1 角色声音档案 (character_voices.json)

```json
{
  "version": "1.0",
  "characters": {
    "孙悟空": {
      "speechStyle": "惜字如金，不超过两句话",
      "forbiddenTone": ["感叹号", "长篇大论", "热情洋溢"],
      "vocabulary": ["就这", "嗯", "走"],
      "personality": ["散漫", "极度理性", "不废话"],
      "emotionalExpression": "用动作而非语言表达情绪",
      "sampleDialogues": ["就这？", "嗯。", "走。"],
      "infoBoundary": ["不知道主神的存在", "不知道叶秋的过去"],
      "extractedFrom": "roles/孙悟空.md",
      "extractedAt": "2026-06-11T10:00:00Z"
    }
  }
}
```

### 2.3.2 对话草稿 (dialogue_draft.json)

```json
{
  "chapterNumber": 4,
  "participants": ["孙悟空", "叶秋"],
  "rounds": [
    {
      "round": 1,
      "speaker": "孙悟空",
      "line": "就这？",
      "emotion": "平静",
      "infoUsed": ["当前身处主神空间"]
    },
    {
      "round": 2,
      "speaker": "叶秋",
      "line": "靠，你认真的？这地方连个坐的都没有。",
      "emotion": "烦躁",
      "infoUsed": ["环境恶劣"]
    }
  ],
  "conflicts": [
    {
      "type": "态度冲突",
      "participants": ["孙悟空", "叶秋"],
      "description": "叶秋对环境不满，悟空漠不关心"
    }
  ],
  "infoGaps": [
    {
      "character": "叶秋",
      "unknown": ["主神的存在", "悟空的真实实力"]
    }
  ]
}
```

### 2.3.3 对话审计结果 (dialogue_audit.json)

```json
{
  "chapterNumber": 4,
  "totalScore": 87,
  "passed": true,
  "dialogues": [
    {
      "lineNumber": 15,
      "speaker": "叶秋",
      "original": "好的，我知道了。",
      "score": 6,
      "issues": ["语气偏软，不符合嘴硬人设"],
      "suggestion": "行行行，知道了。"
    }
  ],
  "oocIssues": [],
  "summary": {
    "humanConsistency": 8,
    "infoBoundary": 9,
    "emotionReasonability": 7,
    "dialogueRhythm": 8,
    "characterDistinctiveness": 9
  }
}
```

## 2.4 失败回退策略

| 失败场景 | 回退策略 | 降级输出 |
|---------|---------|---------|
| 声音提取失败 | 使用默认模板 | 空声音档案，Writer用原始设定 |
| 排练超时（>60秒） | 限制最大3轮，强制结束 | 部分对话草稿 |
| 排练LLM调用失败 | 跳过排练，直接写作 | 无对话草稿，Writer自由发挥 |
| 审计LLM调用失败 | 跳过对话审计 | 无对话评分，不影响其他审计 |
| 审计分<7但>5 | 标记warning，不阻断 | 带警告的章节 |
| 审计分≤5 | 触发ReviserAgent修订 | 修订后的章节 |

## 2.5 Pipeline 集成

```
Phase 1: PlannerAgent → chapter memo
Phase 1.5: DialogueRehearsal → 对话草稿（失败则跳过）
Phase 2: ComposerAgent → context package（含对话草稿，如有）
Phase 3: WriterAgent → 章节正文
Phase 4: Review Cycle
  4a: ContinuityAuditor
  4b: DialogueAuditor（失败则跳过）
  4c: ReviserAgent（如有问题）
Phase 4.5: AntiDetectAgent
Phase 5: Persistence
```

## 2.6 新增文件

| 文件 | 作用 | 优先级 |
|------|------|--------|
| `agents/character-agent.ts` | CharacterAgent 核心类 | P0 |
| `agents/character-voice-extractor.ts` | 声音提取 | P0 |
| `agents/dialogue-rehearsal.ts` | 预写排练 | P0 |
| `agents/dialogue-auditor.ts` | 后审验证 | P0 |
| `utils/character-voices.ts` | 声音档案管理 | P0 |

## 2.7 修改文件

| 文件 | 改动 | 风险 |
|------|------|------|
| `pipeline/runner.ts` | 插入排练和审计调用 | 中 — 需确保不影响现有流程 |
| `pipeline/chapter-review-cycle.ts` | 纳入对话审计评分 | 中 — 需修改评分逻辑 |
| `agents/planner.ts` | 传递对话草稿 | 低 — 只是添加字段 |
| `agents/writer.ts` | 注入对话草稿 | 低 — 只是添加上下文 |

---

# Part 3: 连贯性增强（Phase 3）📋

## 3.1 目标

解决情节不连贯问题（如第1章审计失败：写成了新开始但状态卡显示第36章结束）。

## 3.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 章节审计critical问题 | 0 个 | `inkos audit` |
| 状态漂移检测 | 100%捕获 | 单元测试 |
| 角色在场验证 | 100%通过 | 单元测试 |
| 时间线一致性 | 100%通过 | 单元测试 |

## 3.3 数据契约

### 3.3.1 前置检查结果 (pre_write_check.json)

```json
{
  "passed": true,
  "conflicts": [],
  "warnings": [],
  "characterPresence": {
    "expected": ["孙悟空", "叶秋"],
    "found": ["孙悟空", "叶秋"],
    "missing": []
  },
  "timelineConsistency": true
}
```

## 3.4 失败回退策略

| 失败场景 | 回退策略 |
|---------|---------|
| 前置检查发现冲突 | 阻断写作，返回错误信息 |
| 角色在场验证失败 | 阻断写作，提示缺少角色 |
| 时间线不一致 | 阻断写作，提示时间线问题 |

## 3.5 新增文件

| 文件 | 作用 |
|------|------|
| `utils/pre-write-validator.ts` | 前置检查工具 |

## 3.6 修改文件

| 文件 | 改动 |
|------|------|
| `agents/composer.ts` | 添加前置检查调用 |
| `state/manager.ts` | 添加双向验证 |

---

# Part 4: 反老套（Phase 4）📋

## 4.1 目标

解决情节老套问题，让故事更有惊喜。

## 4.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 每章惊喜元素 | ≥ 1 个 | 人工评估 |
| 套路指数 | < 30/100 | 本地检测 |
| 蝴蝶效应触发 | ≥ 1 次/5章 | 日志检查 |

## 4.3 失败回退策略

| 失败场景 | 回退策略 |
|---------|---------|
| CreativityAgent 失败 | 跳过，使用原始chapter memo |
| PatternBreaker 失败 | 跳过，不检查套路重复 |

## 4.4 新增文件

| 文件 | 作用 |
|------|------|
| `agents/creativity.ts` | CreativityAgent |
| `utils/pattern-breaker.ts` | 套路检测工具 |

---

# Part 5: 番茄/朱雀AI检测（Phase 5）📋

## 5.1 目标

让生成的内容能通过番茄小说平台的AI检测。

## 5.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 番茄检测预估分 | ≥ 80/100 | `inkos audit` |
| AI味词数量 | ≤ 1 个/章 | `inkos audit` |
| 了字密度 | 8-12 次/千字 | 本地检测 |
| 句子CV | ≥ 0.2 | 本地检测 |

## 5.3 失败回退策略

| 失败场景 | 回退策略 |
|---------|---------|
| 番茄评分<80 | 触发AntiDetectAgent重新打磨 |
| AntiDetectAgent失败 | 使用原版内容，标记warning |

## 5.4 新增文件

| 文件 | 作用 |
|------|------|
| `utils/fanqie-score.ts` | 番茄检测评分 |

---

# Part 6: 交互控制（Phase 5.5）📋

## 6.1 目标

增加人工干预能力，让作者能实时调整写作方向。

## 6.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| Web Studio 启动 | 成功 | `inkos studio` |
| 人工审批流程 | 可用 | 手动测试 |
| Daemon 控制 | 可用 | 手动测试 |

## 6.3 失败回退策略

| 失败场景 | 回退策略 |
|---------|---------|
| Web Studio 启动失败 | 降级为CLI模式 |
| 人工审批超时 | 自动跳过审批，继续写作 |

---

# Part 7: 数据文件优化（Phase 6）📋

## 7.1 目标

优化现有的数据文件，提升输入质量。

## 7.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| style_guide 规则数 | ≥ 30 条 | 文件检查 |
| story_frame 禁令数 | ≥ 10 条 | 文件检查 |

---

# Part 8: 多模型策略 📋

## 8.1 目标

不同 Agent 用不同模型，平衡质量和成本。

## 8.2 配置方案

```json
{
  "llm": {
    "modelOverrides": {
      "writer": { "model": "deepseek-v4" },
      "planner": { "model": "deepseek-v4" },
      "auditor": { "model": "deepseek-v4-flash" },
      "reviser": { "model": "deepseek-v4-flash" },
      "antiDetect": { "model": "deepseek-v4-flash" },
      "characterAgent": { "model": "deepseek-v4" }
    }
  }
}
```

## 8.3 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 模型配置生效 | 是 | 日志检查 |
| 成本降低 | ≥ 30% | token统计 |

---

# Part 9: 可视化检测报告 📋

## 9.1 目标

在 `inkos audit` 输出中增强报告格式。

## 9.2 验收标准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| AI味评分显示 | 是 | `inkos audit` |
| 雷达图显示 | 是 | `inkos audit` |
| HTML导出 | 是 | `inkos audit --export html` |

---

# 附录A: 完整 Pipeline 流程（升级后）

```
writeNextChapter 流程：

Phase 0: Setup
  ├─ 加载 book.json, genre profile, book rules
  └─ 构建 length spec

Phase 1: PlannerAgent → chapter memo
  ├─ 输入: story_frame, volume_map, current_state, hooks, summaries
  └─ 输出: chapter_memo.json

Phase 1.5: DialogueRehearsal → 对话草稿
  ├─ 输入: chapter_memo, character_voices, current_state
  ├─ 处理: 3-5轮角色对话
  ├─ 输出: dialogue_draft.json
  └─ 失败回退: 跳过，使用原始chapter memo

Phase 2: ComposerAgent → context package
  ├─ 输入: chapter_memo, dialogue_draft, truth_files
  ├─ 处理: 组装上下文包
  ├─ 输出: context_package.json
  └─ 失败回退: 使用简化上下文

Phase 2.5: PreWriteValidator → 连贯性预检
  ├─ 输入: chapter_memo, current_state, character_voices
  ├─ 处理: 检查冲突、角色在场、时间线
  ├─ 输出: pre_write_check.json
  └─ 失败回退: 阻断写作，返回错误

Phase 3: WriterAgent → 章节正文
  ├─ 输入: context_package, dialogue_draft, style_guide
  ├─ 处理: 创作写作 + 状态结算
  ├─ 输出: chapter_content.json
  └─ 失败回退: 重试1次，失败则报错

Phase 4: Review Cycle
  ├─ 4a: ContinuityAuditor (7维度)
  │   ├─ 输入: chapter_content, truth_files
  │   └─ 输出: audit_result.json
  ├─ 4b: DialogueAuditor
  │   ├─ 输入: chapter_content, character_voices, dialogue_draft
  │   ├─ 处理: 逐句审查对话
  │   ├─ 输出: dialogue_audit.json
  │   └─ 失败回退: 跳过，不影响其他审计
  ├─ 4c: ReviserAgent (如有问题)
  │   ├─ 输入: chapter_content, audit_issues
  │   └─ 输出: revised_content.json
  └─ 评分: 综合 audit_result + dialogue_audit

Phase 4.5: AntiDetectAgent → 去AI味打磨
  ├─ 输入: final_content
  ├─ 处理: 打断工整句式、口语化、减"了"字
  ├─ 输出: polished_content.json
  └─ 失败回退: 使用原版内容

Phase 4.6: FanqieScore → 番茄检测预估
  ├─ 输入: polished_content
  ├─ 处理: 本地评分
  ├─ 输出: fanqie_score.json
  └─ 失败回退: 跳过，不影响落盘

Phase 5: Persistence
  ├─ 输入: polished_content, truth_updates, dialogue_audit
  ├─ 处理: 双向验证 + 写入文件
  ├─ 输出: chapter file, truth files, snapshots
  └─ 失败回退: 回滚到上一个snapshot

Phase 6: 可视化报告生成
  ├─ 输入: audit_result, dialogue_audit, fanqie_score
  └─ 输出: report.json (可选HTML)
```

---

# 附录B: 验收标准总表

| Phase | 指标 | 目标值 | 测试方法 |
|-------|------|--------|---------|
| 1 | inkos --version | 1.5.0 | 命令测试 |
| 1 | inkos status | 正常 | 命令测试 |
| 2 | TypeScript编译 | 0 error | tsc |
| 2 | AI检测维度 | 7个 | 单元测试 |
| 2.5 | 对话审计分 | ≥ 7/10 | inkos audit |
| 2.5 | OOC问题 | 0 critical | inkos audit |
| 2.5 | 额外耗时 | ≤ 30秒 | 计时 |
| 2.5 | 额外token | ≤ 10k | 统计 |
| 3 | critical问题 | 0 | inkos audit |
| 3 | 状态漂移 | 100%捕获 | 单元测试 |
| 4 | 惊喜元素 | ≥ 1/章 | 人工评估 |
| 4 | 套路指数 | < 30 | 本地检测 |
| 5 | 番茄预估分 | ≥ 80 | inkos audit |
| 5 | AI味词 | ≤ 1 | inkos audit |
| 5 | 了字密度 | 8-12 | 本地检测 |
| 6 | Web Studio | 可用 | 手动测试 |
| 8 | 成本降低 | ≥ 30% | 统计 |
| 9 | HTML导出 | 可用 | 命令测试 |

---

# 附录C: 数据契约定义

## C.1 Agent 输入输出格式

| Agent | 输入 | 输出 | 格式 |
|-------|------|------|------|
| PlannerAgent | truth_files | chapter_memo | JSON |
| CreativityAgent | chapter_memo, prev_chapters | surprise_factors | JSON |
| DialogueRehearsal | chapter_memo, character_voices | dialogue_draft | JSON |
| ComposerAgent | chapter_memo, dialogue_draft | context_package | JSON |
| PreWriteValidator | chapter_memo, current_state | pre_write_check | JSON |
| WriterAgent | context_package | chapter_content | JSON |
| ContinuityAuditor | chapter_content, truth_files | audit_result | JSON |
| DialogueAuditor | chapter_content, character_voices | dialogue_audit | JSON |
| ReviserAgent | chapter_content, audit_issues | revised_content | JSON |
| AntiDetectAgent | final_content | polished_content | JSON |
| FanqieScore | polished_content | fanqie_score | JSON |

## C.2 错误格式

```json
{
  "error": true,
  "agent": "DialogueRehearsal",
  "code": "TIMEOUT",
  "message": "排练超时（>60秒）",
  "fallback": "跳过排练，使用原始chapter memo"
}
```

---

# 附录D: 失败回退策略总表

| Agent | 失败类型 | 回退策略 | 降级输出 |
|-------|---------|---------|---------|
| PlannerAgent | LLM失败 | 重试1次 | 报错 |
| CreativityAgent | LLM失败 | 跳过 | 原始chapter memo |
| CreativityAgent | 超时 | 跳过 | 原始chapter memo |
| DialogueRehearsal | LLM失败 | 跳过 | 无对话草稿 |
| DialogueRehearsal | 超时(>60s) | 限制3轮 | 部分对话草稿 |
| ComposerAgent | LLM失败 | 重试1次 | 简化上下文 |
| PreWriteValidator | 冲突检测 | 阻断 | 错误信息 |
| WriterAgent | LLM失败 | 重试1次 | 报错 |
| ContinuityAuditor | LLM失败 | 跳过 | 无审计结果 |
| DialogueAuditor | LLM失败 | 跳过 | 无对话评分 |
| DialogueAuditor | 分数≤5 | 触发修订 | 修订后章节 |
| ReviserAgent | LLM失败 | 跳过 | 原版内容 |
| AntiDetectAgent | LLM失败 | 跳过 | 原版内容 |
| FanqieScore | 计算失败 | 跳过 | 无评分 |
| Persistence | 写入失败 | 回滚snapshot | 上一个版本 |

---

# 附录E: 性能预算

## E.1 每章时间预算

| Phase | 预估耗时 | 最大耗时 |
|-------|---------|---------|
| Planner | 5秒 | 10秒 |
| Creativity | 3秒 | 5秒 |
| DialogueRehearsal | 10秒 | 30秒 |
| Composer | 3秒 | 5秒 |
| PreWriteValidator | 1秒 | 2秒 |
| Writer | 15秒 | 30秒 |
| Audit (7维度) | 10秒 | 20秒 |
| DialogueAudit | 5秒 | 15秒 |
| Reviser (如有) | 10秒 | 20秒 |
| AntiDetect | 5秒 | 10秒 |
| FanqieScore | 1秒 | 2秒 |
| Persistence | 2秒 | 5秒 |
| **总计** | **~70秒** | **~150秒** |

## E.2 每章Token预算

| Phase | 预估token | 最大token |
|-------|----------|----------|
| Planner | 3k | 5k |
| Creativity | 1k | 2k |
| DialogueRehearsal | 5k | 10k |
| Composer | 2k | 3k |
| Writer | 8k | 12k |
| Audit | 5k | 8k |
| DialogueAudit | 3k | 6k |
| Reviser (如有) | 5k | 8k |
| AntiDetect | 3k | 5k |
| **总计** | **~35k** | **~59k** |

## E.3 Daemon 模式限制

| 配置 | 值 | 说明 |
|------|-----|------|
| maxConcurrentBooks | 3 | 最多同时写3本书 |
| 写作间隔 | 15分钟 | 每15分钟写一章 |
| 每日上限 | 50章 | 防止过度消耗 |
| 失败暂停 | 连续3次失败暂停该书 | 避免无限重试 |

---

# 附录F: 回归测试计划

## F.1 测试范围

| 改动文件 | 影响范围 | 测试重点 |
|---------|---------|---------|
| `runner.ts` | 整个Pipeline | 端到端写一章 |
| `chapter-review-cycle.ts` | 审计流程 | 审计结果正确性 |
| `planner.ts` | 规划阶段 | chapter memo格式 |
| `writer.ts` | 写作阶段 | 输出格式兼容 |
| `ai-tells.ts` | 检测阶段 | 新维度检测正确 |
| `anti-detect.ts` | 后处理 | 不改变内容含义 |
| `writer-prompts.ts` | Writer指令 | 输出质量提升 |

## F.2 测试用例

### TC1: 基础功能测试
```
输入: 现有项目（金箍棒教鬼做人）
操作: inkos write next
预期: 成功写一章，audit通过
```

### TC2: 回归测试
```
输入: 现有项目
操作: inkos audit 1
预期: 审计结果与改动前一致（除了新增维度）
```

### TC3: 失败回退测试
```
输入: 模拟DialogueRehearsal超时
操作: 写一章
预期: 跳过排练，正常完成写作
```

### TC4: 性能测试
```
输入: 新项目
操作: 连续写5章
预期: 每章耗时≤150秒，总token≤59k/章
```

### TC5: UI测试
```
操作: inkos studio
预期: Web界面正常启动，所有页面可访问
```

## F.3 测试执行顺序

```
1. TypeScript编译 (tsc)
2. 单元测试 (vitest)
3. TC1: 基础功能
4. TC2: 回归测试
5. TC3: 失败回退
6. TC4: 性能测试
7. TC5: UI测试
```
