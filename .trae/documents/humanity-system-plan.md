# 真人感系统（Humanity System）实施计划

## 一、Summary

在 inkos 项目中新增 **Humanity System（真人感系统）**，让 AI 写作具有真人的特征。系统通过分析真人样本提取12维"写作指纹"，在学习用户偏好的基础上，在写作过程中注入"真人感"特征：时间碎片、矛盾性行为、沉默层、情感暗示替代显性表达等。

**核心价值**：现有系统告诉 AI "别写得像 AI"，真人感系统告诉 AI "像真人一样感受和写作"——从"减法"升级为"加法"。

---

## 二、Current State Analysis

### 2.1 现有架构

```
packages/core/src/
├── anti-ai/                    ✅ 已存在
│   ├── humanizer.ts            基础人性化处理（口语化、不完美、语气词）
│   ├── perplexity-analyzer.ts   困惑度分析
│   ├── burstiness-adjuster.ts  句子突发性调整
│   ├── vocabulary-enhancer.ts  词汇多样性增强
│   └── sentence-reconstructor.ts 句式重构
│
├── emotional/                   ✅ 已存在
│   ├── injector.ts             情感词汇注入（joy/sadness/anger/fear等16种）
│   ├── emotion-analyzer.ts    情感分析
│   ├── arc-planner.ts         情感曲线规划
│   └── naturalness-tester.ts   自然度测试
│
├── learning/                    ✅ 已存在
│   ├── edit-tracker.ts        编辑追踪
│   ├── preference-analyzer.ts  偏好分析
│   ├── user-profile.ts        用户画像管理
│   └── prompt-enhancer.ts     提示词增强
│
└── pipeline/runner.ts          ✅ 已存在（主编排引擎）
```

### 2.2 现有模块的局限

| 模块 | 当前能力 | 局限 |
|------|---------|------|
| anti-ai | 句子结构重组 | 仅处理"句法层面"，不处理"叙事层面" |
| emotional | 情感词汇注入 | 仍用"他很紧张"这种显性表达，真人用动作暗示 |
| learning | 用户编辑追踪 | 追踪"改了哪里"，不追踪"用户怎么思考" |

### 2.3 缺失的能力

真人小说有以下特征，现有系统均未覆盖：

1. **时间碎片**：紧张场景之间有"什么都不发生"的过渡段
2. **矛盾性行为**：主角做"不该做"的小错事
3. **沉默层**：不直接写情绪，用动作暗示
4. **不体面道具**：世界是"磨损的"，物品有瑕疵
5. **自我矛盾性**：主角连自己都不确定真正想要什么
6. **对话不完美**：打断、沉默、答非所问
7. **视角漂移**：偶尔跳出主角视角

---

## 三、Proposed Changes

### 3.1 新增模块架构

```
packages/core/src/
├── humanity/                        ← 新增目录
│   ├── index.ts                    # 入口，导出所有公共类型和类
│   ├── humanity-engine.ts          # 核心引擎（编排所有子模块）
│   ├── sample-analyzer.ts          # 真人样本分析器（12维指纹提取）
│   ├── humanity-profile.ts         # 真人感画像（数据结构）
│   ├── scene-breaker.ts            # 场景断裂处理（时间碎片/呼吸段）
│   ├── self-contradiction.ts      # 矛盾性行为生成器
│   ├── silence-layer.ts            # 沉默层注入器（情感暗示替代）
│   └── templates.ts               # 真人感模板库（辅助生成）
│
└── models/
    └── humanity-profile.ts         # 真人感画像数据结构（扩展现有）
```

### 3.2 核心数据结构

**HumanityFingerprint（12维写作指纹）**

```typescript
// packages/core/src/models/humanity-profile.ts
export interface HumanityFingerprint {
  // 句法维度
  sentenceLengthStd: number;       // 句子长度标准差
  burstIndex: number;               // 突发性指数（长句后跟短句的概率）
  exclamationDensity: number;      // 感叹号密度（每千字）
  questionDensity: number;         // 问号密度
  hesitationWordDensity: number;    // 犹豫词密度（好像/大概/可能）

  // 叙事维度
  dialogueInterruptRate: number;   // 对话打断率
  timeFragmentRatio: number;       // 时间碎片占比（不推动剧情的段落）
  bodyPartDensity: number;         // 身体部位词汇密度
  colloquialDensity: number;       // 粗话/口语密度
  perspectiveShiftRate: number;     // 视角偏移率

  // 角色维度
  selfContradictionRate: number;  // 自我矛盾率
  unseemlyItemRate: number;        // 不体面道具率
}
```

**HumanityProfile（真人感画像）**

```typescript
export interface HumanityProfile {
  id: string;
  bookId: string | null;                    // null = 全局画像
  fingerprint: HumanityFingerprint;

  // 从样本分析得到的风格注入参数
  styleInjection: {
    hesitationFrequency: number;            // 犹豫词出现频率 0-1
    dialogueInterruptFrequency: number;     // 对话打断频率
    perspectiveShiftTendency: number;        // 视角漂移倾向
    bodyPresenceLevel: number;              // 身体存在感程度
    unseemlyItemPreference: number;          // 不体面道具偏好
    protagonistFlawPreference: number;       // 主角缺陷偏好
    timeFragmentPreference: number;          // 时间碎片偏好
    silenceLayerPreference: number;          // 沉默层偏好
  };

  learnedFromSamples: string[];            // 学习过的样本文件名
}
```

### 3.3 各模块详细设计

#### 3.3.1 SampleAnalyzer（真人样本分析器）

**职责**：分析用户上传的真人小说样本，提取12维写作指纹

**核心算法**：

```typescript
// packages/core/src/humanity/sample-analyzer.ts
export class SampleAnalyzer {
  async analyze(samples: string[]): Promise<HumanityFingerprint> {
    // 1. 句子长度分布 → sentenceLengthStd
    // 2. 突发性指数（长句后跟短句概率）→ burstIndex
    // 3. 感叹号/问号密度 → exclamationDensity / questionDensity
    // 4. 犹豫词密度（好像/大概/可能）→ hesitationWordDensity
    // 5. 对话打断率 → dialogueInterruptRate
    // 6. 时间碎片占比 → timeFragmentRatio
    // 7. 身体部位词汇密度 → bodyPartDensity
    // 8. 粗话密度 → colloquialDensity
    // 9-12. 其他维度统计...

    return fingerprint;
  }
}
```

**提取规则示例**：

| 特征 | 检测方法 | 真人典型值 | AI典型值 |
|------|---------|-----------|---------|
| burstIndex | 句子长度比>2.5的连续句子对占比 | >0.15 | <0.05 |
| hesitationWordDensity | 犹豫词/总字数*1000 | 8-15 | <3 |
| timeFragmentRatio | 非剧情段落/总段落 | 0.15-0.25 | <0.05 |
| bodyPartDensity | 身体部位词/总字数*1000 | 12-20 | <5 |

#### 3.3.2 SceneBreaker（场景断裂处理器）

**职责**：在高张力场景之间自动插入"呼吸段"，让紧张的剧情有喘息空间

**注入时机**：

1. 每个 tension >= 7 的场景之后
2. 整章至少1个纯呼吸段（不跟任何剧情相关）
3. 章节总长 > 3000字时，至少2-3个呼吸段

**呼吸段类型**：

| 类型 | 示例 | 作用 |
|------|------|------|
| physical-action | 他揉了揉太阳穴。 | 身体存在感 |
| environment-sense | 远处传来一声鸟鸣。 | 环境真实感 |
| unnecessary-dialogue | "今天天真好。" | 对话留白 |
| internal-wander | 他忽然想起昨天的事。 | 内心游走 |
| sensory-detail | 嘴里有点苦。 | 感官细节 |
| prop-interaction | 他摸了摸口袋里的钥匙。 | 道具互动 |

#### 3.3.3 SelfContradictionGenerator（矛盾性行为生成器）

**职责**：给主角注入"不完美"的小行为，增加角色真实感

**注入时机**：

1. 主角做"决定"的时刻 → 犹豫一下然后做相反的选择
2. 主角说"不害怕" → 手在抖（说的和做的不一致）
3. 主角应该做某事 → 做了相反的小事

**示例模板**：

```
# 犹豫后反悔
他本来想往左走。犹豫了一秒，他还是往右拐了。

# 言行不一
"我不怕。"他说。但他攥紧的拳头出卖了他。

# 细节暴露
他嘴上说不在乎。但他的目光一直没从那个人身上移开。
```

#### 3.3.4 SilenceLayerInjector（沉默层注入器）

**职责**：把显性情绪描写替换为动作暗示，减少"说明式写作"

**替换规则**：

| 显性表达 | 替换为 | 原理 |
|---------|--------|------|
| 他很紧张 | 他的手指在桌下轻轻敲击 | 用动作暗示情绪 |
| 他很悲伤 | 他对着自己的影子坐了很久 | 用行为暗示状态 |
| 他很生气 | 他把茶杯放得很轻，轻得几乎没有声音 | 用反常行为暗示 |
| 她喜欢他 | 她的手指在那封信上停留了三秒 | 用细节暗示 |

**注入概率**：根据用户偏好设置，一般 15-30%

### 3.4 集成点设计

#### 3.4.1 集成点1：WriterAgent 调用 LLM 之前

**位置**：`packages/core/src/agents/writer.ts`

```typescript
// 在 buildWriterSystemPrompt 之后，调用 LLM 之前
if (humanityProfile) {
  prompt = humanityEngine.enhanceSystemPrompt(prompt, context);
}
```

**作用**：在系统提示词末尾追加真人感写作原则

```markdown
## 写作风格微调

1. 在紧张场景之间穿插主角的身体感受描写
2. 允许主角做"不完美"的小事——犹豫、走错一步
3. 用动作和暗示代替直接的情绪形容词
4. 场景中的物品可以有"磨损感"
5. 对话要像真人说话——有打断、沉默、语气词
```

#### 3.4.2 集成点2：AntiAI Humanizer 处理之后

**位置**：`packages/core/src/pipeline/runner.ts` 或 `anti-ai/humanizer.ts` 之后

```typescript
// 在 humanize() 之后，emotional injector 之前
if (humanityProfile) {
  text = humanityEngine.postProcessWrittenText(text, context);
}
```

**作用**：对已生成的文本做轻度后处理（不改变剧情，只加小细节）

---

## 四、Implementation Steps

### 阶段1：核心基础设施（第1-2周）

#### Step 1.1: 创建模块目录和入口文件

**文件**：`packages/core/src/humanity/index.ts`

```typescript
export { SampleAnalyzer } from "./sample-analyzer.js";
export { HumanityEngine } from "./humanity-engine.js";
export { SceneBreaker } from "./scene-breaker.js";
export { SelfContradictionGenerator } from "./self-contradiction.js";
export { SilenceLayerInjector } from "./silence-layer.js";
export type { HumanityProfile, HumanityFingerprint } from "./humanity-profile.js";
```

#### Step 1.2: 创建数据结构

**文件**：`packages/core/src/models/humanity-profile.ts`

定义 HumanityFingerprint 和 HumanityProfile 接口。

#### Step 1.3: 实现 SampleAnalyzer

**文件**：`packages/core/src/humanity/sample-analyzer.ts`

实现12维指纹提取算法。

### 阶段2：核心生成器（第2-3周）

#### Step 2.1: 实现 SceneBreaker

**文件**：`packages/core/src/humanity/scene-breaker.ts`

- planBreathingPoints()：规划呼吸点位置
- generateBreathingText()：生成呼吸段文本

#### Step 2.2: 实现 SilenceLayerInjector

**文件**：`packages/core/src/humanity/silence-layer.ts`

- injectSilence()：注入沉默层
- replaceExplanationWithAction()：显性情绪→动作暗示

#### Step 2.3: 实现 SelfContradictionGenerator

**文件**：`packages/core/src/humanity/self-contradiction.ts`

- injectContradictions()：注入矛盾性行为
- injectDecisionHesitation()：犹豫后反悔
- injectSayDoMismatch()：言行不一

### 阶段3：引擎集成（第3-4周）

#### Step 3.1: 实现 HumanityEngine

**文件**：`packages/core/src/humanity/humanity-engine.ts`

- initialize()：初始化画像
- enhanceSystemPrompt()：注入写作原则到提示词
- postProcessWrittenText()：后处理已生成文本

#### Step 3.2: 集成到 WriterAgent

**修改文件**：`packages/core/src/agents/writer.ts`

在系统提示词构建后、LLM调用前插入 humanization。

#### Step 3.3: 导出到核心入口

**修改文件**：`packages/core/src/index.ts`

添加 humanity 模块的导出。

### 阶段4：测试和迭代（第4-5周）

#### Step 4.1: 单元测试

为每个子模块编写测试用例，覆盖核心路径。

#### Step 4.2: 集成测试

测试 humanity 系统在完整 pipeline 中的表现。

#### Step 4.3: 人工评审

邀请用户对生成结果进行评审，收集反馈。

---

## 五、File Changes Summary

### 新增文件

| 文件路径 | 描述 | 预估行数 |
|---------|------|---------|
| `packages/core/src/models/humanity-profile.ts` | 真人感画像数据结构 | ~80 |
| `packages/core/src/humanity/index.ts` | 模块入口 | ~20 |
| `packages/core/src/humanity/sample-analyzer.ts` | 样本分析器 | ~200 |
| `packages/core/src/humanity/scene-breaker.ts` | 场景断裂处理 | ~250 |
| `packages/core/src/humanity/self-contradiation.ts` | 矛盾性生成器 | ~200 |
| `packages/core/src/humanity/silence-layer.ts` | 沉默层注入器 | ~180 |
| `packages/core/src/humanity/templates.ts` | 模板库 | ~150 |
| `packages/core/src/humanity/humanity-engine.ts` | 核心引擎 | ~300 |
| `packages/core/src/humanity/__tests__/*.test.ts` | 测试文件 | ~400 |

### 修改文件

| 文件路径 | 修改内容 | 预估行数 |
|---------|---------|---------|
| `packages/core/src/index.ts` | 导出 humanity 模块 | +10 |
| `packages/core/src/agents/writer.ts` | 集成 humanization 到提示词 | +20 |
| `packages/core/src/learning/user-profile.ts` | 扩展偏好结构 | +30 |
| `IMPROVEMENT_PLAN_V3.md` | 添加 V4 真人感系统计划 | +500 |

**总计新增约 1780 行代码**

---

## 六、Assumptions & Decisions

### 假设

1. **用户样本格式**：支持 txt 和 markdown 格式
2. **性能要求**：样本分析 < 5秒/万字，后处理 < 100ms/千字
3. **集成优先级**：先集成到 writer（提示词层），后处理作为可选功能

### 决策

1. **指纹维度**：12维覆盖句法、叙事、角色三个层面，足够区分真人与AI
2. **注入概率**：默认 20%，用户可调整
3. **后处理时机**：在 anti-ai 之后、emotional 之前
4. **学习方式**：样本分析 + 用户编辑追踪融合

---

## 七、Verification Steps

### 7.1 单元测试

```bash
# 运行 humanity 模块测试
pnpm test humanity
```

**验收标准**：
- SampleAnalyzer 12维指纹提取准确率 > 80%
- SceneBreaker 呼吸段生成通过率 > 90%
- 各模块覆盖率 > 80%

### 7.2 集成测试

```bash
# 运行完整 pipeline 集成测试
pnpm test:integration
```

**验收标准**：
- humanity 系统不影响现有 pipeline 功能
- 端到端延迟增加 < 5%

### 7.3 人工评审

生成一批测试章节，邀请用户评审：

| 评审项 | 评分标准 |
|-------|---------|
| 时间碎片 | 每章至少有1-2个"什么都不发生"的过渡段 |
| 矛盾性行为 | 主角至少有1处"犹豫/做错"的细节 |
| 沉默层 | 至少有1处"动作暗示情绪"而非"直接写情绪" |
| 整体真人感 | 用户评分 > 3.5/5.0 |

---

## 八、Risk & Mitigation

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 注入过多导致剧情拖沓 | 中 | 中 | 设置注入上限（每章最多3个呼吸段） |
| 与现有 emotional 模块冲突 | 低 | 中 | silence-layer 控制在 15-30% 概率 |
| 样本分析不准确 | 中 | 中 | 提供默认指纹，允许用户手动调整 |
| 性能影响 | 低 | 低 | 后处理异步化，超时跳过 |

---

## 九、Dependencies

```
阶段1 (无依赖)
    ↓
阶段2 (依赖阶段1)
    ↓
阶段3 (依赖阶段2)
    ↓
阶段4 (无依赖)
```

**与现有模块的关系**：
- `anti-ai`: 后处理在 humanize() 之后
- `emotional`: 前置于 emotion injector
- `learning`: 复用 UserPreference 结构扩展
