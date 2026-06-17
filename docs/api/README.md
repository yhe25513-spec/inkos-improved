# InkOS API 文档

## 概述

InkOS 提供了一套完整的AI写作辅助API，包含以下核心模块：

- **合规管理系统** - 平台合规检查与报告
- **去AI味系统** - 消除AI生成文本特征
- **情感深度增强** - 提升小说情感表达
- **创意原创性系统** - 检测和避免套路
- **长篇连贯性管理** - 追踪伏笔、角色状态、时间线
- **用户偏好学习** - 个性化写作风格

---

## 1. 合规管理系统

### PolicyEngine

策略引擎，负责平台合规检查。

```typescript
import { PolicyEngine } from '@inkos/core/compliance';

const engine = new PolicyEngine();

// 获取平台策略
const policy = engine.getPolicy('qidian');

// 评估合规性
const report = engine.evaluate(
  'book-001',
  'qidian',
  [
    { number: 1, aiPercentage: 0.2, hasAiLabel: true },
    { number: 2, aiPercentage: 0.4, hasAiLabel: true },
  ],
  [
    { detector: 'GPTZero', isAIGenerated: false, confidence: 0.85 },
    { detector: 'Originality.ai', isAIGenerated: false, confidence: 0.78 },
  ]
);

console.log(report.passed); // true/false
console.log(report.score);  // 0-100
```

### 支持的平台

| 平台ID | 名称 | AI内容限制 |
|--------|------|-----------|
| `qidian` | 起点中文网 | 30% |
| `tomato` | 番茄小说 | 50% |
| `jjwxc` | 晋江文学城 | 30% |
| `amazon-kdp` | Amazon KDP | 无限制(需披露) |

---

## 2. 去AI味系统

### PerplexityAnalyzer

困惑度分析器，检测文本的AI特征。

```typescript
import { PerplexityAnalyzer } from '@inkos/core/anti-ai';

const analyzer = new PerplexityAnalyzer();

const result = analyzer.analyze('他走进了房间，看到了桌子上的书。');

console.log(result.perplexity);         // 困惑度值
console.log(result.isAIGenerated);      // 是否AI生成
console.log(result.burstiness);         // 突发性
console.log(result.vocabularyDiversity); // 词汇多样性
```

### SentenceReconstructor

句式重构器，去除AI特征。

```typescript
import { SentenceReconstructor } from '@inkos/core/anti-ai';

const reconstructor = new SentenceReconstructor();

const result = await reconstructor.reconstruct(
  '因为天气很好，所以他决定出去走走。',
  {
    genre: 'urban',      // 文体类型
    intensity: 6,        // 重构强度 1-10
    targetPerplexity: 80, // 目标困惑度
    targetBurstiness: 0.5, // 目标突发性
  }
);

console.log(result); // 重构后的文本
```

### 支持的文体

| 文体ID | 名称 | 特点 |
|--------|------|------|
| `xuanhuan` | 玄幻 | 四字词语多，战斗描写热血 |
| `urban` | 都市 | 现代口语，生活化 |
| `romance` | 言情 | 情感细腻，浪漫表达 |
| `mystery` | 悬疑 | 节奏紧凑，悬念设置 |
| `general` | 通用 | 平衡风格 |

---

## 3. 情感深度增强

### EmotionAnalyzer

情感分析器，分析文本情感内容。

```typescript
import { EmotionAnalyzer } from '@inkos/core/emotional';

const analyzer = new EmotionAnalyzer();

const result = analyzer.analyze('她非常开心，快乐得像只小鸟。');

console.log(result.primaryEmotion);     // 'joy'
console.log(result.intensity);          // 0.8
console.log(result.emotionDistribution); // 各情感分布
```

### ArcPlanner

情感曲线规划器。

```typescript
import { ArcPlanner } from '@inkos/core/emotional';

const planner = new ArcPlanner();

const arc = planner.planArc(
  'book-001',
  {
    totalChapters: 20,
    actBreaks: [5, 10, 15],
    climaxChapter: 15,
    resolutionChapter: 20,
    theme: '都市成长',
  },
  'urban' // 文体类型
);

console.log(arc.chapters); // 20个章节的情感规划
```

### EmotionInjector

情感注入器，为文本添加情感元素。

```typescript
import { EmotionInjector } from '@inkos/core/emotional';

const injector = new EmotionInjector();

const enhanced = await injector.enhanceChapter(
  '他走进了房间。',
  arc,      // 情感曲线
  1         // 章节号
);

console.log(enhanced); // 增强后的文本
```

---

## 4. 创意原创性系统

### TropeDetector

套路检测器。

```typescript
import { TropeDetector } from '@inkos/core/creativity';

const detector = new TropeDetector();

const result = detector.detect('他重生了，获得了系统，开始逆袭打脸。');

console.log(result.tropes);              // 检测到的套路
console.log(result.overallOriginality);  // 0.3 (原创性低)
console.log(result.suggestions);         // 改进建议
```

### OriginalityScorer

原创性评分器。

```typescript
import { OriginalityScorer } from '@inkos/core/creativity';

const scorer = new OriginalityScorer();

const result = scorer.score(
  '一个普通的下午，他在咖啡馆里写着代码。',
  'urban'
);

console.log(result.score);        // 75 (原创性高)
console.log(result.innovation);   // 0.7
console.log(result.suggestions);  // 改进建议
```

---

## 5. 长篇连贯性管理

### ForeshadowTracker

伏笔追踪器。

```typescript
import { ForeshadowTracker } from '@inkos/core/consistency';

const tracker = new ForeshadowTracker();

// 添加伏笔
const fs = tracker.addForeshadow(
  'book-001',
  5,                    // 设置章节
  '他发现了一个神秘的盒子。',
  ['主角']              // 相关角色
);

// 解决伏笔
tracker.resolveForeshadow(fs.id, 20, '在第20章揭示了真相。');

// 检查过期伏笔
const stale = tracker.checkStaleForeshadows('book-001', 60, 50);
```

### CharacterStateSync

角色状态同步器。

```typescript
import { CharacterStateSync } from '@inkos/core/consistency';

const sync = new CharacterStateSync();

// 添加状态
sync.addState('book-001', {
  characterName: '李明',
  chapterNumber: 1,
  physicalState: '健康',
  mentalState: '平静',
  relationships: [],
  inventory: [{ id: 'sword', name: '长剑', description: '一把剑', quantity: 1 }],
  knowledge: [],
  secrets: [],
  goals: ['成为强者'],
});

// 获取状态
const state = sync.getStateAtChapter('book-001', 'char-李明', 5);
```

### TimelineManager

时间线管理器。

```typescript
import { TimelineManager } from '@inkos/core/consistency';

const manager = new TimelineManager();

// 添加事件
manager.addEvent('book-001', {
  chapterNumber: 1,
  storyTime: '第一天清晨',
  description: '主角出发',
  characters: ['主角'],
  location: '村庄',
  type: 'main',
});

// 检查冲突
const conflicts = manager.checkConflicts('book-001');
```

---

## 6. 用户偏好学习

### EditTracker

编辑追踪器。

```typescript
import { EditTracker } from '@inkos/core/learning';

const tracker = new EditTracker({ batchSize: 10 });

// 记录编辑
tracker.trackEdit({
  userId: 'user-001',
  bookId: 'book-001',
  chapterId: 'ch-1',
  originalText: '他走了过去。',
  editedText: '他漫步离开了。',
  editType: 'rephrase',
});
```

### PreferenceAnalyzer

偏好分析器。

```typescript
import { PreferenceAnalyzer } from '@inkos/core/learning';

const analyzer = new PreferenceAnalyzer();

const edits = tracker.getBufferedEdits();
const preference = analyzer.analyze(edits);

console.log(preference.style.formality);     // 0.3 (口语化)
console.log(preference.sentence.avgLength);   // 22 (平均句长)
console.log(preference.vocabulary.preferredWords); // 偏好用词
```

### PromptEnhancer

提示词增强器。

```typescript
import { PromptEnhancer } from '@inkos/core/learning';

const enhancer = new PromptEnhancer();

const prompt = enhancer.buildEnhancedPrompt(
  '写一个开头',
  preference,
  {
    bookGenre: '都市',
    chapterNumber: 1,
    sceneType: 'description',
  }
);

console.log(prompt); // 包含个性化风格指南的提示词
```

---

## 性能指标

| 操作 | 目标 | 实际 |
|------|------|------|
| 困惑度分析 (1000字符) | <100ms | ~50ms |
| 句式重构 (500字符) | <200ms | ~150ms |
| 情感分析 | <50ms | ~30ms |
| 套路检测 | <100ms | ~80ms |
| 缓存操作 (10000次) | <200ms | ~150ms |

---

## 类型导出

所有类型定义都可以从对应模块导入：

```typescript
import type {
  // 合规系统
  Platform,
  PlatformPolicy,
  ComplianceReportData,
  
  // 去AI味
  PerplexityResult,
  ReconstructOptions,
  
  // 情感增强
  EmotionType,
  EmotionalArc,
  NaturalnessResult,
  
  // 创意原创
  Trope,
  OriginalityResult,
  
  // 长篇连贯
  Foreshadow,
  CharacterState,
  TimelineEvent,
  
  // 用户偏好
  WritingPreference,
  UserEdit,
} from '@inkos/core';
```
