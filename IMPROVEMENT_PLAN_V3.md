# InkOS 2026年改进计划 V3.1

## 📋 修订说明

基于V2.0计划的反馈，本版本进行了以下关键修正：
1. ✅ 存储方案从SQLite改为PostgreSQL
2. ✅ 去AI味逻辑从词级重构为句式级处理
3. ✅ 扩大测量样本量，使用多检测器交叉验证
4. ✅ 补充完整依赖图和关键路径
5. ✅ 补充遗漏风险和回滚流程
6. ✅ 延长时间线至12-14周
7. ✅ 为每个功能定义明确的验收标准(DoD)

---

## 🎯 项目概况

### 技术栈（修正版）
```
前端框架: React 18 + TypeScript
UI框架: Tailwind CSS + Shadcn/UI
状态管理: Zustand
构建工具: Vite
包管理: pnpm (monorepo)

后端框架: Node.js + TypeScript
数据库: PostgreSQL (主数据库) + Redis (缓存)
ORM: Prisma
API: REST + SSE (Server-Sent Events)
AI模型: 支持多模型 (OpenAI, Anthropic, 本地模型)

测试框架: Vitest + React Testing Library
E2E测试: Playwright
性能测试: k6
```

### 选择PostgreSQL的原因
1. **复杂查询性能**：支持JSONB、全文搜索、复杂JOIN
2. **扩展性**：未来支持多用户、团队协作
3. **数据完整性**：事务支持、约束、触发器
4. **生态成熟**：Prisma ORM、丰富的工具链
5. **避免迁移成本**：一次性到位，避免后期迁移

### 现有代码结构
```
inkos-dev/
├── packages/
│   ├── core/           # ✅ 已存在 - 核心逻辑
│   │   └── src/
│   │       ├── agents/      # AI代理
│   │       ├── pipeline/    # 处理管线
│   │       ├── state/       # 状态管理
│   │       └── utils/       # 工具函数
│   ├── studio/         # ✅ 已存在 - Web UI
│   │   └── src/
│   │       ├── components/  # React组件
│   │       ├── pages/       # 页面组件
│   │       ├── hooks/       # 自定义Hook
│   │       └── store/       # Zustand状态
│   └── cli/            # ✅ 已存在 - 命令行工具
├── prisma/             # 🆕 新增 - Prisma schema
│   └── schema.prisma
├── books/              # 用户书籍数据
└── docker-compose.yml  # 🆕 新增 - PostgreSQL
```

---

## 🎯 第一部分：功能改进（按优先级排序）

### 1.1 统一合规管理系统（高优先级）
**目标**：合并原1.1和1.6，建立统一的合规管理模块

**优先级**：🔴 最高
**预计时间**：3-4周
**依赖**：无（可立即开始）
**负责团队**：后端1人 + 前端0.5人

#### 1.1.1 架构设计
```
packages/core/src/
├── compliance/
│   ├── index.ts                    # 导出入口
│   ├── types.ts                    # 类型定义
│   ├── policy-engine.ts           # 策略引擎（核心）
│   ├── content-analyzer.ts        # 内容分析器
│   ├── label-generator.ts         # 标签生成器
│   ├── report-builder.ts          # 报告生成器
│   └── platforms/
│       ├── base.ts                # 平台适配基类
│       ├── qidian.ts              # 起点中文网
│       ├── tomato.ts              # 番茄小说
│       ├── jjwxc.ts               # 晋江文学城
│       └── amazon-kdp.ts          # Amazon KDP

prisma/
└── schema.prisma       # 数据库Schema
```

#### 1.1.2 数据库设计
```prisma
// schema.prisma
model Book {
  id            String    @id @default(cuid())
  title         String
  platform      String    // qidian, tomato, jjwxc, amazon-kdp
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  chapters      Chapter[]
  complianceReports ComplianceReport[]
  foreshadows   Foreshadow[]
  characterStates CharacterState[]
  timelineEvents TimelineEvent[]
}

model Chapter {
  id            String    @id @default(cuid())
  bookId        String
  book          Book      @relation(fields: [bookId], references: [id])
  number        Int
  content       String
  wordCount     Int
  aiPercentage  Float?    // AI内容占比
  hasAiLabel    Boolean   @default(false)
  createdAt     DateTime  @default(now())

  @@index([bookId, number])
}

model ComplianceReport {
  id            String    @id @default(cuid())
  bookId        String
  book          Book      @relation(fields: [bookId], references: [id])
  platform      String
  score         Int       // 0-100
  aiPercentage  Float
  passed        Boolean
  issues        Json      // ComplianceIssue[]
  recommendations String[]
  createdAt     DateTime  @default(now())

  @@index([bookId, createdAt])
}

model Foreshadow {
  id            String    @id @default(cuid())
  bookId        String
  book          Book      @relation(fields: [bookId], references: [id])
  chapterSet    Int
  content       String
  status        String    @default("pending") // pending, resolved, abandoned
  chapterResolved Int?
  importance    Json      // ForeshadowImportance
  relatedEntities String[]
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([bookId, status])
  @@index([bookId, chapterSet])
}

model CharacterState {
  id            String    @id @default(cuid())
  bookId        String
  book          Book      @relation(fields: [bookId], references: [id])
  characterId   String
  chapterNumber Int
  physicalState String
  mentalState   String
  relationships Json      // Relationship[]
  inventory     Json      // Item[]
  knowledge     String[]
  secrets       String[]
  goals         String[]
  createdAt     DateTime  @default(now())

  @@index([bookId, characterId, chapterNumber])
}

model TimelineEvent {
  id            String    @id @default(cuid())
  bookId        String
  book          Book      @relation(fields: [bookId], references: [id])
  chapterNumber Int
  timestamp     String    // 故事内时间
  duration      String?
  description   String
  characters    String[]
  location      String
  type          String    // main, side, flashback
  createdAt     DateTime  @default(now())

  @@index([bookId, chapterNumber])
  @@index([bookId, timestamp])
}
```

#### 1.1.3 核心功能实现
```typescript
// policy-engine.ts
export class PolicyEngine {
  private prisma: PrismaClient;
  private policies: Map<string, PlatformPolicy>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.policies = new Map();
    this.loadDefaultPolicies();
  }

  async analyze(bookId: string, platform: string): Promise<ComplianceReport> {
    const policy = this.policies.get(platform);
    if (!policy) throw new Error(`Unknown platform: ${platform}`);

    // 使用Prisma查询，支持复杂过滤和分页
    const chapters = await this.prisma.chapter.findMany({
      where: { bookId },
      orderBy: { number: 'asc' },
    });

    const issues: ComplianceIssue[] = [];
    let totalAiPercentage = 0;

    for (const chapter of chapters) {
      const analysis = await this.analyzeChapter(chapter);
      totalAiPercentage += analysis.aiPercentage;

      // 检查AI披露
      if (policy.aiDisclosureRequired && !chapter.hasAiLabel) {
        issues.push({
          type: 'ai-disclosure',
          severity: 'error',
          message: `第${chapter.number}章缺少AI生成标识`,
          location: { chapter: chapter.number, line: 1 },
          suggestion: '添加"本章使用AI辅助创作"标识',
        });
      }

      // 检查AI内容占比
      if (policy.aiContentLimit && analysis.aiPercentage > policy.aiContentLimit) {
        issues.push({
          type: 'content-limit',
          severity: 'warning',
          message: `第${chapter.number}章AI内容占比 ${(analysis.aiPercentage * 100).toFixed(1)}%，超过平台限制 ${(policy.aiContentLimit * 100)}%`,
          suggestion: '增加人工编辑内容或降低AI生成比例',
        });
      }
    }

    const avgAiPercentage = chapters.length > 0 ? totalAiPercentage / chapters.length : 0;

    // 存储报告
    const report = await this.prisma.complianceReport.create({
      data: {
        bookId,
        platform,
        score: this.calculateScore(issues),
        aiPercentage: avgAiPercentage,
        passed: issues.filter(i => i.severity === 'error').length === 0,
        issues: issues as any,
        recommendations: this.generateRecommendations(issues, policy),
      },
    });

    return this.formatReport(report, issues);
  }

  private async analyzeChapter(chapter: Chapter): Promise<{ aiPercentage: number }> {
    // 使用AI模型分析章节内容
    // 返回AI内容占比
    // 缓存结果避免重复计算
  }
}
```

#### 1.1.4 验收标准（DoD）
- [ ] 数据库Schema设计完成并迁移
- [ ] 支持4个主流平台（起点、番茄、晋江、Amazon KDP）
- [ ] AI内容检测准确率 > 85%（使用3个检测器交叉验证）
- [ ] 合规检查响应时间 P95 < 10秒（100章书籍）
- [ ] 生成可视化合规报告（PDF/HTML）
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] API文档完成
- [ ] 性能测试通过（100章书籍 < 10秒）

---

### 1.2 去AI味精细度提升（高优先级）
**目标**：消除AI生成文本的特征

**优先级**：🔴 高
**预计时间**：4-5周
**依赖**：无（可与1.1并行）
**负责团队**：后端1人

#### 1.2.1 架构设计
```
packages/core/src/
├── agents/
│   ├── anti-ai/
│   │   ├── index.ts
│   │   ├── perplexity-analyzer.ts    # 困惑度分析器
│   │   ├── burstiness-adjuster.ts    # 突发性调整器
│   │   ├── sentence-reconstructor.ts # 句式重构器（核心）
│   │   ├── vocabulary-enhancer.ts    # 词汇多样性增强
│   │   ├── humanizer.ts             # 人性化处理
│   │   └── genre-adapters/
│   │       ├── base.ts              # 基类
│   │       ├── xuanhuan.ts          # 玄幻适配
│   │       ├── urban.ts             # 都市适配
│   │       ├── romance.ts           # 言情适配
│   │       └── mystery.ts           # 悬疑适配
│   └── prompts/
│       └── anti-ai-prompts.ts
```

#### 1.2.2 核心算法（修正版）
```typescript
// perplexity-analyzer.ts
export class PerplexityAnalyzer {
  private tokenizer: Tokenizer;

  constructor() {
    this.tokenizer = new Tokenizer();
  }

  /**
   * 计算文本困惑度
   * AI文本困惑度通常较低（10-50），人类文本较高（50-200）
   */
  async calculatePerplexity(text: string): Promise<number> {
    const tokens = this.tokenizer.encode(text);
    let logProbSum = 0;
    let tokenCount = 0;

    // 使用简单的n-gram模型估算
    // 实际应该使用语言模型
    for (let i = 1; i < tokens.length; i++) {
      const context = tokens.slice(Math.max(0, i - 3), i);
      const target = tokens[i];
      const prob = this.estimateProbability(context, target);
      logProbSum += Math.log(prob);
      tokenCount++;
    }

    const avgLogProb = logProbSum / tokenCount;
    return Math.exp(-avgLogProb);
  }

  /**
   * 检测文本是否像AI生成
   */
  async isAIGenerated(text: string): Promise<{ isAI: boolean; confidence: number; perplexity: number }> {
    const perplexity = await this.calculatePerplexity(text);

    // AI文本通常困惑度 < 50
    const isAI = perplexity < 50;
    const confidence = isAI
      ? Math.min(1, (50 - perplexity) / 50)
      : Math.min(1, (perplexity - 50) / 150);

    return { isAI, confidence, perplexity };
  }
}

// burstiness-adjuster.ts
export class BurstinessAdjuster {
  /**
   * 计算文本突发性
   * 人类文本句子长度变化大（突发性高），AI文本句子长度均匀（突发性低）
   */
  calculateBurstiness(text: string): number {
    const sentences = this.splitSentences(text);
    const lengths = sentences.map(s => s.length);

    if (lengths.length < 2) return 0;

    // 计算句子长度的标准差
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // 突发性 = 标准差 / 平均值
    return stdDev / mean;
  }

  /**
   * 调整文本突发性
   * 目标：使突发性 > 0.5（人类水平）
   */
  async adjustBurstiness(text: string, targetBurstiness: number = 0.6): Promise<string> {
    const currentBurstiness = this.calculateBurstiness(text);

    if (currentBurstiness >= targetBurstiness) {
      return text; // 已经足够"人类化"
    }

    const sentences = this.splitSentences(text);
    const adjusted: string[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // 随机决定是否调整句子长度
      if (Math.random() < 0.3) {
        // 30%的概率调整句子长度
        if (Math.random() < 0.5) {
          // 变长：添加修饰语或细节
          adjusted.push(await this.lengthenSentence(sentence));
        } else {
          // 变短：简化表达
          adjusted.push(await this.shortenSentence(sentence));
        }
      } else {
        adjusted.push(sentence);
      }
    }

    return adjusted.join(' ');
  }

  private async lengthenSentence(sentence: string): Promise<string> {
    // 使用LLM添加修饰语、细节、五感描写
    // 例如："他走了。" → "他慢慢走了，脚步声在空旷的走廊里回荡。"
  }

  private async shortenSentence(sentence: string): Promise<string> {
    // 使用LLM简化表达
    // 例如："尽管天气很冷，但是他还是坚持出去了。" → "天冷，他还是出去了。"
  }
}

// sentence-reconstructor.ts（核心修正）
export class SentenceReconstructor {
  private perplexityAnalyzer: PerplexityAnalyzer;
  private burstinessAdjuster: BurstinessAdjuster;

  constructor() {
    this.perplexityAnalyzer = new PerplexityAnalyzer();
    this.burstinessAdjuster = new BurstinessAdjuster();
  }

  /**
   * 重构文本，去除AI特征
   * 核心：句式级处理，不只是换词
   */
  async reconstruct(text: string, genre: string): Promise<string> {
    let result = text;

    // 1. 分析当前AI特征
    const analysis = await this.analyzeAIFeatures(result);

    // 2. 句式重构（核心）
    if (analysis.perplexity < 50) {
      result = await this.reconstructSentences(result, analysis);
    }

    // 3. 调整突发性
    if (analysis.burstiness < 0.5) {
      result = await this.burstinessAdjuster.adjustBurstiness(result, 0.6);
    }

    // 4. 增强词汇多样性
    if (analysis.vocabularyDiversity < 0.7) {
      result = await this.enhanceVocabulary(result);
    }

    // 5. 人性化处理
    result = await this.humanize(result);

    // 6. 文体适配
    result = await this.adaptToGenre(result, genre);

    return result;
  }

  private async reconstructSentences(text: string, analysis: AIAnalysis): Promise<string> {
    const sentences = this.splitSentences(text);
    const reconstructed: string[] = [];

    for (const sentence of sentences) {
      // 检查句子是否像AI生成
      const isAI = await this.perplexityAnalyzer.isAIGenerated(sentence);

      if (isAI.isAI && isAI.confidence > 0.7) {
        // 高置信度AI句子，需要重构
        reconstructed.push(await this.reconstructAISentence(sentence));
      } else {
        // 低置信度，保持原样或轻微调整
        reconstructed.push(sentence);
      }
    }

    return reconstructed.join(' ');
  }

  private async reconstructAISentence(sentence: string): Promise<string> {
    // 使用LLM重构句子
    // 策略：
    // 1. 改变句式结构（主动变被动，陈述变疑问等）
    // 2. 添加口语化表达
    // 3. 插入语气词（嗯、啊、呢等）
    // 4. 调整句子节奏
    // 5. 添加适当的重复和修正

    const strategies = [
      () => this.changeSentenceStructure(sentence),
      () => this.addColloquialisms(sentence),
      () => this.insertInterjections(sentence),
      () => this.adjustRhythm(sentence),
      () => this.addRepetitionAndCorrections(sentence),
    ];

    // 随机选择2-3个策略
    const selectedStrategies = strategies
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 2);

    let result = sentence;
    for (const strategy of selectedStrategies) {
      result = await strategy();
    }

    return result;
  }

  private async addColloquialisms(sentence: string): Promise<string> {
    // 插入口头禅和语气词
    const colloquialisms = [
      { pattern: /^(.+)。$/, replacement: '$1。' }, // 保持句号
      { pattern: /^(.+)！$/, replacement: '$1！' }, // 保持感叹号
      { pattern: /^(.+)？$/, replacement: '$1？' }, // 保持问号
      // 添加语气词
      { pattern: /^(.+)。$/, replacement: '$1。' },
    ];

    // 使用LLM添加适当的语气词
    // 例如："他走了。" → "他走了呢。" 或 "他走了啊。"
  }

  private async addRepetitionAndCorrections(sentence: string): Promise<string> {
    // 人类写作常有轻微重复和修正
    // 例如："他去了...不对，应该说他去了图书馆。"
    // 但要适度，不能影响可读性
  }
}

// vocabulary-enhancer.ts
export class VocabularyEnhancer {
  /**
   * 增强词汇多样性
   * AI倾向于使用常见词，人类使用更多样化的词汇
   */
  async enhanceVocabulary(text: string): Promise<string> {
    const words = this.tokenize(text);
    const wordFreq = this.calculateWordFrequency(words);

    // 找出高频词
    const highFreqWords = Object.entries(wordFreq)
      .filter(([word, freq]) => freq > 0.05) // 出现频率 > 5%
      .map(([word]) => word);

    let result = text;
    for (const word of highFreqWords) {
      const synonyms = await this.getSynonyms(word);
      if (synonyms.length > 0) {
        // 随机替换一部分（30%）
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        result = result.replace(regex, (match) => {
          if (Math.random() < 0.3) {
            return synonyms[Math.floor(Math.random() * synonyms.length)];
          }
          return match;
        });
      }
    }

    return result;
  }
}
```

#### 1.2.3 验收标准（DoD）
- [ ] 困惑度分析器准确率 > 80%（与GPTZero对比）
- [ ] 突发性调整后文本 > 0.5
- [ ] 词汇多样性提升 > 30%
- [ ] AI检测工具通过率 > 85%（3个检测器交叉验证）
- [ ] 支持4种文体适配
- [ ] 处理速度 > 500字/秒
- [ ] 单元测试覆盖率 > 80%
- [ ] 处理1000字文本时间 < 2秒
- [ ] 人类评审自然度评分 > 4.0/5.0（30人评审团）

---

### 1.3 情感深度增强（高优先级）
**目标**：提升小说的情感表达能力

**优先级**：🔴 高
**预计时间**：3-4周
**依赖**：1.2 去AI味（增强后需要再去AI味）
**负责团队**：后端1人

#### 1.3.1 架构设计
```
packages/core/src/
├── agents/
│   ├── emotional/
│   │   ├── index.ts
│   │   ├── arc-planner.ts         # 情感曲线规划
│   │   ├── injector.ts            # 情感注入器
│   │   ├── analyzer.ts            # 情感分析器
│   │   ├── naturalness-tester.ts  # 自然度测试器（新增）
│   │   └── prompts/
│   │       └── emotional-prompts.ts
```

#### 1.3.2 核心功能
```typescript
// arc-planner.ts
export interface EmotionalArc {
  id: string;
  bookId: string;
  chapters: EmotionalChapter[];
  overallTheme: string;
  climaxChapter: number;
  resolutionChapter: number;
}

export interface EmotionalChapter {
  chapterNumber: number;
  primaryEmotion: EmotionType;
  intensity: number; // 1-10
  subEmotions: EmotionType[];
  turningPoint: boolean;
  notes: string;
}

export type EmotionType =
  | 'joy' | 'sadness' | 'anger' | 'fear'
  | 'surprise' | 'disgust' | 'trust' | 'anticipation'
  | 'love' | 'hope' | 'despair' | 'nostalgia'
  | 'excitement' | 'tension' | 'relief' | 'bittersweet';

export class EmotionalArcPlanner {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async planArc(bookId: string, outline: string, genre: string): Promise<EmotionalArc> {
    // 1. 分析故事结构
    const structure = await this.analyzeStructure(outline);

    // 2. 设计情感曲线
    const arc = await this.designCurve(structure, genre);

    // 3. 保存到数据库
    await this.saveArc(bookId, arc);

    return arc;
  }

  private async designCurve(structure: StoryStructure, genre: string): Promise<EmotionalArc> {
    // 根据类型设计情感曲线
    // 玄幻：热血-挫折-成长-高潮
    // 都市：平淡-冲突-和解-升华
    // 言情：甜蜜-误会-分离-重逢
    // 悬疑：平静-发现-紧张-揭秘

    const genreTemplates: Record<string, (structure: StoryStructure) => EmotionalChapter[]> = {
      xuanhuan: (s) => this.designXuanhuanArc(s),
      urban: (s) => this.designUrbanArc(s),
      romance: (s) => this.designRomanceArc(s),
      mystery: (s) => this.designMysteryArc(s),
    };

    const designer = genreTemplates[genre] ?? genreTemplates['urban'];
    const chapters = designer(structure);

    return {
      id: generateId(),
      bookId: '',
      chapters,
      overallTheme: structure.theme,
      climaxChapter: structure.climaxChapter,
      resolutionChapter: structure.resolutionChapter,
    };
  }
}

// injector.ts
export class EmotionalInjector {
  private prisma: PrismaClient;
  private antiAIReconstructor: SentenceReconstructor; // 去AI味重构器

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.antiAIReconstructor = new SentenceReconstructor();
  }

  async enhanceChapter(
    bookId: string,
    chapterNumber: number,
    content: string,
    arc: EmotionalArc
  ): Promise<string> {
    const chapterInfo = arc.chapters.find(c => c.chapterNumber === chapterNumber);
    if (!chapterInfo) return content;

    // 1. 识别需要增强的段落
    const paragraphs = content.split('\n\n');
    const enhanced = await Promise.all(
      paragraphs.map(p => this.enhanceParagraph(p, chapterInfo))
    );

    let result = enhanced.join('\n\n');

    // 2. 去AI味处理（关键步骤）
    result = await this.antiAIReconstructor.reconstruct(result, 'urban');

    return result;
  }

  private async enhanceParagraph(
    paragraph: string,
    chapterInfo: EmotionalChapter
  ): Promise<string> {
    // 使用LLM增强情感表达
    // 添加五感描写
    // 注入情感词汇
    // 保持自然流畅
  }
}

// naturalness-tester.ts（新增）
export class NaturalnessTester {
  /**
   * 测试增强后文本的自然度
   * 使用A/B测试：同一内容，增强版vs原版
   */
  async testNaturalness(
    original: string,
    enhanced: string,
    genre: string
  ): Promise<NaturalnessResult> {
    // 1. 计算困惑度变化
    const originalPerplexity = await this.calculatePerplexity(original);
    const enhancedPerplexity = await this.calculatePerplexity(enhanced);

    // 2. 计算突发性变化
    const originalBurstiness = this.calculateBurstiness(original);
    const enhancedBurstiness = this.calculateBurstiness(enhanced);

    // 3. 评估情感表达
    const emotionScore = await this.evaluateEmotion(enhanced, genre);

    // 4. 综合评分
    const score = this.calculateNaturalnessScore(
      originalPerplexity,
      enhancedPerplexity,
      originalBurstiness,
      enhancedBurstiness,
      emotionScore
    );

    return {
      score, // 0-100
      originalPerplexity,
      enhancedPerplexity,
      originalBurstiness,
      enhancedBurstiness,
      emotionScore,
      passed: score >= 70,
    };
  }
}
```

#### 1.3.3 验收标准（DoD）
- [ ] 情感曲线规划符合故事结构
- [ ] 支持16种基本情感类型
- [ ] 情感增强后自然度评分 > 70/100
- [ ] A/B测试显示增强版更自然
- [ ] 人类评审自然度评分 > 4.0/5.0（30人评审团）
- [ ] 分品类测试（玄幻、都市、言情分别评估）
- [ ] 单元测试覆盖率 > 80%
- [ ] 与去AI味模块集成测试通过

---

### 1.4 创意原创性增强（中优先级）
**目标**：避免套路化，提升创意

**优先级**：🟡 中
**预计时间**：3-4周
**依赖**：无（可并行）
**负责团队**：后端0.5人

#### 1.4.1 架构设计
```
packages/core/src/
├── agents/
│   ├── creativity/
│   │   ├── index.ts
│   │   ├── trope-detector.ts       # 套路检测器
│   │   ├── originality-scorer.ts   # 原创性评分
│   │   └── suggestion-engine.ts    # 建议引擎
│   └── data/
│       └── tropes.json             # 套路数据库
```

#### 1.4.2 验收标准（DoD）
- [ ] 套路检测准确率 > 80%
- [ ] 支持50+常见套路
- [ ] 原创性评分与人类判断相关性 > 0.7
- [ ] 建议引擎提供可执行的创新方案
- [ ] 单元测试覆盖率 > 80%

---

### 1.5 长篇连贯性管理（中优先级）
**目标**：保持10万+字的逻辑自洽

**优先级**：🟡 中
**预计时间**：5-6周
**依赖**：1.1 合规系统（需要存储元数据）
**负责团队**：后端1人

#### 1.5.1 架构设计
```
packages/core/src/
├── consistency/
│   ├── index.ts
│   ├── foreshadow-tracker.ts      # 伏笔追踪
│   ├── character-state-sync.ts    # 角色状态同步
│   ├── timeline-manager.ts        # 时间线管理
│   ├── detail-checker.ts          # 细节一致性检查
│   └── index-optimizer.ts         # 索引优化器（新增）
```

#### 1.5.2 性能优化
```typescript
// index-optimizer.ts
export class IndexOptimizer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 优化查询性能
   * 针对10万+字书籍的复杂查询
   */
  async optimizeQueries(bookId: string): Promise<void> {
    // 1. 创建复合索引
    await this.createCompositeIndexes();

    // 2. 使用JSONB索引优化伏笔查询
    await this.optimizeForeshadowQueries(bookId);

    // 3. 使用全文搜索优化内容查询
    await this.optimizeContentSearch(bookId);
  }

  private async createCompositeIndexes(): Promise<void> {
    // 复合索引：bookId + chapterNumber
    // 复合索引：bookId + status
    // 复合索引：bookId + characterId + chapterNumber
  }

  /**
   * 查询所有涉及角色A的伏笔
   * 使用JSONB包含查询
   */
  async findForeshadowsByCharacter(bookId: string, characterId: string): Promise<Foreshadow[]> {
    return this.prisma.foreshadow.findMany({
      where: {
        bookId,
        relatedEntities: {
          has: characterId, // PostgreSQL JSONB包含查询
        },
      },
      orderBy: { chapterSet: 'asc' },
    });
  }

  /**
   * 查询角色在指定章节的状态
   * 使用复合索引
   */
  async getCharacterStateAtChapter(
    bookId: string,
    characterId: string,
    chapterNumber: number
  ): Promise<CharacterState | null> {
    return this.prisma.characterState.findFirst({
      where: {
        bookId,
        characterId,
        chapterNumber: { lte: chapterNumber },
      },
      orderBy: { chapterNumber: 'desc' },
    });
  }
}
```

#### 1.5.3 验收标准（DoD）
- [ ] 伏笔追踪准确率 > 90%
- [ ] 角色状态同步延迟 < 1章
- [ ] 时间线冲突检测准确率 > 85%
- [ ] 10万字书籍查询响应时间 P95 < 1秒
- [ ] 复杂查询（如查找涉及角色A的所有伏笔） < 2秒
- [ ] 单元测试覆盖率 > 80%
- [ ] 性能测试通过

---

## 🎨 第二部分：UI设计改进

### 2.1 整体设计风格升级
**目标**：采用2026年最新UI设计趋势

**优先级**：🟡 中
**预计时间**：3-4周
**依赖**：无
**负责团队**：前端1人

#### 2.1.1 设计原则
1. **极简主义**：减少视觉干扰，专注内容
2. **Bento Grid**：模块化卡片布局
3. **Glassmorphism**：毛玻璃效果
4. **动态排版**：可变字体，响应式排版
5. **暗色优先**：深色模式作为默认

#### 2.1.2 样式更新
```css
/* index.css 更新 */
:root {
  /* 保持现有配色，但优化对比度 */
  --background: oklch(0.99 0.003 80);
  --foreground: oklch(0.12 0.02 60);
}

.dark {
  --background: oklch(0.11 0.012 250);
  --card: oklch(0.16 0.018 250);
}

/* 新增变量 */
--glass-bg: oklch(1 0 0 / 0.7);
--glass-border: oklch(0.8 0 0 / 0.2);
--gradient-primary: linear-gradient(135deg, var(--primary) 0%, oklch(0.55 0.15 25) 100%);

/* 动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
```

#### 2.1.3 验收标准（DoD）
- [ ] 支持暗色/亮色主题切换
- [ ] 响应式设计（桌面、平板、手机）
- [ ] 动画流畅（60fps）
- [ ] 无障碍访问（WCAG 2.1 AA）
- [ ] 浏览器兼容（Chrome, Firefox, Safari, Edge）
- [ ] 性能优化（首屏加载 < 2秒）

---

### 2.2 侧边栏重新设计
**目标**：采用Bento Grid布局

**优先级**：🟡 中
**预计时间**：2-3周
**依赖**：2.1
**负责团队**：前端0.5人

#### 2.2.1 设计稿
```
┌─────────────────────────────────────┐
│  🏠 InkOS Studio                   │
├─────────────────────────────────────┤
│  📝 快速操作                         │
│  ┌─────────┐ ┌─────────┐           │
│  │ 新建书籍 │ │ 继续写作 │           │
│  └─────────┘ └─────────┘           │
├─────────────────────────────────────┤
│  📚 我的书籍                         │
│  ┌─────────────────────────────┐   │
│  │ 书名1 ████████░░ 45/200章    │   │
│  ├─────────────────────────────┤   │
│  │ 书名2 ███░░░░░░░ 12/100章    │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ⚡ 工具                             │
│  • AI检测  • 反AI检测  • 质量审计    │
├─────────────────────────────────────┤
│  ⚙️ 设置  •  📊 数据  •  ❓ 帮助    │
└─────────────────────────────────────┘
```

#### 2.2.2 验收标准（DoD）
- [ ] Bento Grid布局实现
- [ ] 进度条可视化
- [ ] 拖拽排序支持
- [ ] 动画过渡效果
- [ ] 移动端适配

---

### 2.3 聊天界面优化
**目标**：更现代的对话体验

**优先级**：🟡 中
**预计时间**：2-3周
**依赖**：2.1
**负责团队**：前端0.5人

#### 2.3.1 设计稿
```
┌─────────────────────────────────────────────┐
│  📖 当前书籍: 《XXX》  │  🤖 模型: Claude   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 用户: 帮我写一个开头                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 🤖 AI: 好的，我来为你创作...         │   │
│  │                                     │   │
│  │ [AI生成的文本内容]                  │   │
│  │                                     │   │
│  │ ┌─────────────────────────────┐   │   │
│  │ │ 💡 建议: 可以添加更多细节    │   │   │
│  │ │ 🔄 重新生成  │ ✏️ 编辑     │   │   │
│  │ └─────────────────────────────┘   │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  💬 输入框: [输入指令...        ] [发送]    │
│  📊 AI占比: 15%  │  ✅ 合规  │  📝 字数: 1234│
└─────────────────────────────────────────────┘
```

#### 2.3.2 验收标准（DoD）
- [ ] 内联AI建议卡片
- [ ] 流式响应动画
- [ ] 合规状态显示
- [ ] 快捷操作按钮
- [ ] 上下文感知输入
- [ ] 移动端适配

---

## 📊 第三部分：质量指标定义（修正版）

### 3.1 功能质量指标

| 指标 | 定义 | 测量方法 | 目标值 |
|------|------|----------|--------|
| **AI检测通过率** | AI检测工具判定为"人类写作"的比例 | 3个检测器交叉验证（GPTZero + Originality.ai + Winston AI），500篇测试样本 | > 85%（3个检测器中2个判定为人类写作） |
| **合规检查准确率** | 与人工审核的一致性 | 抽样100本书，对比人工审核结果 | > 90% |
| **情感增强自然度** | 增强后文本的自然程度 | 人类评分（1-5分），30人评审团，分品类测试 | > 4.0/5.0 |
| **套路检测准确率** | 检测到的套路与实际套路的匹配度 | 标注数据集测试（1000篇） | > 80% |
| **连贯性检查准确率** | 检测到的不一致问题与实际问题的匹配度 | 标注数据集测试（500篇） | > 85% |

### 3.2 性能指标

| 指标 | 定义 | 测量方法 | 目标值 |
|------|------|----------|--------|
| **合规检查响应时间** | 100章书籍的合规检查时间 | k6性能测试 | P95 < 10秒 |
| **情感分析响应时间** | 单章情感分析时间 | k6性能测试 | P95 < 3秒 |
| **去AI味处理速度** | 文本处理速度 | k6性能测试 | > 500字/秒 |
| **UI响应时间** | 用户操作到界面更新的时间 | Playwright性能测试 | P95 < 200ms |
| **页面加载时间** | 首屏加载时间 | Lighthouse | < 2秒 |
| **数据库查询时间** | 复杂查询响应时间 | k6性能测试 | P95 < 1秒 |

### 3.3 测试覆盖率

| 类型 | 目标覆盖率 | 说明 |
|------|-----------|------|
| **单元测试** | > 80% | 核心业务逻辑 |
| **集成测试** | > 70% | 模块间交互 |
| **E2E测试** | > 60% | 关键用户流程 |
| **UI测试** | > 70% | 组件渲染和交互 |
| **性能测试** | 100% | 关键API端点 |

### 3.4 用户满意度

| 指标 | 定义 | 测量方法 | 目标值 |
|------|------|----------|--------|
| **NPS分数** | 净推荐值 | 用户调研（n=100） | > 40 |
| **任务完成率** | 用户成功完成核心任务的比例 | 用户测试（n=30） | > 90% |
| **用户留存率** | 7天后仍使用的用户比例 | 数据分析 | > 60% |
| **功能使用率** | 新功能的使用频率 | 数据分析 | > 50% |

---

## ⚠️ 第四部分：风险评估（修正版）

### 4.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **AI模型不稳定** | 中 | 高 | 实现降级机制，使用多个模型备选 |
| **性能瓶颈** | 中 | 高 | 实现缓存（Redis），优化算法，异步处理 |
| **数据一致性** | 低 | 高 | 使用PostgreSQL事务，实现校验机制 |
| **兼容性问题** | 中 | 中 | 充分测试，渐进式升级 |
| **安全漏洞** | 低 | 高 | 安全审计，输入验证，权限控制 |
| **PostgreSQL连接池耗尽** | 中 | 高 | 配置合适的连接池大小，实现连接监控 |

### 4.2 业务风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **API成本超支** | 高 | 高 | 实现成本监控，设置预算上限，优化调用频率 |
| **用户期望过高** | 中 | 中 | 明确功能边界，提供使用教程，收集反馈 |
| **平台政策变化** | 中 | 高 | 模块化设计，快速适配新政策 |

### 4.3 并发风险（新增）

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **多用户同时编辑同一本书** | 中 | 高 | 实现乐观锁，冲突检测，合并策略 |
| **数据库死锁** | 低 | 高 | 合理设计事务粒度，超时机制 |
| **缓存与数据库不一致** | 中 | 中 | 实现缓存失效策略，最终一致性 |

### 4.4 版本兼容风险（新增）

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **AI模型更新后行为变化** | 高 | 高 | 实现模型版本管理，A/B测试，降级机制 |
| **API不兼容** | 中 | 中 | 版本控制，向后兼容，迁移脚本 |

### 4.5 时间风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **需求变更** | 高 | 高 | 模块化设计，预留扩展接口 |
| **技术难题** | 中 | 高 | 提前调研，准备备选方案 |
| **人员变动** | 低 | 中 | 完善文档，代码审查 |
| **依赖延迟** | 中 | 中 | 提前沟通，准备本地方案 |

### 4.6 资源风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **算力不足** | 中 | 高 | 优化算法，使用缓存，批量处理 |
| **存储空间** | 低 | 中 | 数据压缩，定期清理 |
| **网络带宽** | 低 | 中 | 本地处理，压缩传输 |

---

## 🔗 第五部分：依赖关系（修正版）

### 5.1 完整依赖图
```
1.1 合规管理系统 (无依赖)
    ↓
1.2 去AI味提升 (无依赖)
    ↓
1.3 情感深度增强 (依赖1.2: 增强后需要再去AI味)
    ↓
1.4 创意原创性 (无依赖)
    ↓
1.5 长篇连贯性 (依赖1.1: 需要存储元数据)

9.1 用户偏好学习系统 (无依赖，可与1.3并行)

2.1 UI整体升级 (无依赖)
    ↓
2.2 侧边栏 (依赖2.1)
    ↓
2.3 聊天界面 (依赖2.1)

后端API ←→ 前端UI (相互依赖)
```

### 5.2 并行策略
```
并行组1: 1.1 + 1.2 + 1.4 (可同时进行)
并行组2: 1.3 + 9.1 (依赖1.2完成后开始，1.3和9.1可并行)
并行组3: 1.5 (依赖1.1完成后开始)
并行组4: 2.1 (独立进行)
并行组5: 2.2 + 2.3 (依赖2.1完成后可并行)
```

### 5.3 关键路径
```
1.1 合规管理系统 (4周) → 集成测试 (1周) = 5周
1.2 去AI味提升 (5周) → 1.3 情感深度增强 (4周) → 集成测试 (1周) = 10周
1.2 去AI味提升 (5周) → 9.1 用户偏好学习 (5周) → 集成测试 (1周) = 11周
1.5 长篇连贯性 (6周) → 集成测试 (1周) = 7周

最长路径: 11周 (1.2 → 9.1)
总工期: 12-14周 (考虑并行和缓冲)
```

### 5.4 里程碑
```
里程碑1 (第3周): 合规管理系统MVP完成
里程碑2 (第5周): 去AI味核心功能完成
里程碑3 (第7周): 情感深度增强完成
里程碑4 (第9周): 用户偏好学习系统完成
里程碑5 (第10周): UI升级完成
里程碑6 (第12周): 集成测试通过
里程碑7 (第14周): 全部功能上线
```

---

## 🔄 第六部分：回滚方案（修正版）

### 6.1 功能开关
```typescript
// feature-flags.ts
export class FeatureFlags {
  private flags: Map<string, boolean>;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.flags = new Map();
    this.loadFlags();
  }

  async isEnabled(feature: string): Promise<boolean> {
    // 1. 检查内存缓存
    if (this.flags.has(feature)) {
      return this.flags.get(feature)!;
    }

    // 2. 检查数据库
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: feature },
    });

    // 3. 缓存结果
    if (flag) {
      this.flags.set(feature, flag.enabled);
      return flag.enabled;
    }

    // 4. 默认关闭
    return false;
  }

  async toggleFeature(feature: string, enabled: boolean): Promise<void> {
    await this.prisma.featureFlag.upsert({
      where: { name: feature },
      update: { enabled },
      create: { name: feature, enabled },
    });

    this.flags.set(feature, enabled);
  }
}
```

### 6.2 完整回滚流程
```
1. 检测问题
   ├── 监控系统报警
   ├── 用户反馈
   └── 自动化测试失败

2. 评估影响
   ├── 确定影响范围（哪些用户、哪些功能）
   ├── 评估严重程度（P0-P3）
   └── 确定回滚必要性

3. 通知团队
   ├── 立即通知开发负责人
   ├── 通知运维团队
   └── 通知客服团队（如果影响用户）

4. 执行回滚
   ├── 关闭功能开关
   ├── 验证功能已禁用
   ├── 检查数据完整性
   └── 通知用户当前功能已禁用

5. 验证恢复
   ├── 确认系统恢复正常
   ├── 检查错误率下降
   └── 收集用户反馈

6. 事后分析
   ├── 创建Issue记录问题
   ├── 分析根本原因
   ├── 制定改进措施
   └── 更新监控规则
```

### 6.3 回滚触发条件
- **P0（立即回滚）**:
  - 数据丢失或损坏
  - 系统完全不可用
  - 安全漏洞

- **P1（1小时内回滚）**:
  - 核心功能不可用
  - 性能下降 > 50%
  - 错误率 > 10%

- **P2（4小时内回滚）**:
  - 非核心功能不可用
  - 性能下降 > 30%
  - 错误率 > 5%

- **P3（24小时内回滚）**:
  - 用户体验问题
  - 轻微性能下降
  - 错误率 > 1%

### 6.4 数据备份和恢复
```typescript
// backup-manager.ts
export class BackupManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createBackup(bookId: string): Promise<string> {
    // 1. 创建数据库备份
    const backup = await this.backupDatabase(bookId);

    // 2. 存储到对象存储（如S3）
    const backupId = await this.storeBackup(backup);

    // 3. 记录备份元数据
    await this.prisma.backup.create({
      data: {
        bookId,
        backupId,
        size: backup.size,
        createdAt: new Date(),
      },
    });

    return backupId;
  }

  async restoreBackup(backupId: string): Promise<void> {
    // 1. 从对象存储备份
    const backup = await this.loadBackup(backupId);

    // 2. 恢复数据库
    await this.restoreDatabase(backup);

    // 3. 验证数据完整性
    await this.validateData(backup.bookId);
  }
}
```

---

## 📅 第七部分：更新后的时间表（修正版）

### 阶段一：基础功能（1-5周）
```
周1-2: 
├── 1.1 合规管理系统 - 类型设计和数据库Schema
├── 1.2 去AI味提升 - 困惑度分析器和突发性调整器
└── 2.1 UI整体升级 - 设计系统和基础组件

周3-4:
├── 1.1 合规管理系统 - 核心实现和平台适配
├── 1.2 去AI味提升 - 句式重构器（核心）
└── 2.1 UI整体升级 - 主题系统和动画

周5:
├── 1.1 合规管理系统 - 集成测试
├── 1.2 去AI味提升 - 文体适配器
└── 2.1 UI整体升级 - 响应式设计
```

### 阶段二：核心功能（6-9周）
```
周6-7:
├── 1.3 情感深度增强 - 情感分析器和曲线规划
├── 9.1 用户偏好学习 - 数据库Schema和编辑追踪器
├── 1.4 创意原创性 - 套路检测器
└── 2.2 侧边栏 - Bento Grid布局

周8-9:
├── 1.3 情感深度增强 - 情感注入器和自然度测试
├── 9.1 用户偏好学习 - 偏好分析器和画像管理
├── 1.4 创意原创性 - 原创性评分和建议引擎
└── 2.3 聊天界面 - 现代化设计
```

### 阶段三：高级功能（10-14周）
```
周10-11:
├── 1.5 长篇连贯性 - 伏笔追踪和角色状态同步
├── 9.1 用户偏好学习 - 提示词增强器和冷启动策略
├── 集成测试
└── 性能优化

周12-13:
├── 9.1 用户偏好学习 - 集成到写作流程
├── 全面测试
└── 文档更新

周14:
├── 上线准备
└── 回滚流程演练
```

---

## ✅ 第八部分：验收清单（修正版）

### 功能验收
- [ ] 合规管理系统支持4个平台
- [ ] 去AI味支持4种文体
- [ ] 情感深度增强支持16种情感
- [ ] 创意原创性支持50+套路
- [ ] 长篇连贯性管理10万+字
- [ ] 用户偏好学习系统支持5大维度分析
- [ ] UI支持暗色/亮色主题
- [ ] 响应式设计（桌面、平板、手机）

### 性能验收
- [ ] 合规检查响应时间 P95 < 10秒
- [ ] 情感分析响应时间 P95 < 3秒
- [ ] 去AI味处理速度 > 500字/秒
- [ ] UI响应时间 P95 < 200ms
- [ ] 页面加载时间 < 2秒
- [ ] 数据库查询时间 P95 < 1秒
- [ ] 10万字书籍处理时间 < 30秒

### 质量验收
- [ ] AI检测通过率 > 85%（3个检测器交叉验证，500篇样本）
- [ ] 合规检查准确率 > 90%（100本书对比人工审核）
- [ ] 情感增强自然度 > 4.0/5.0（30人评审团，分品类测试）
- [ ] 套路检测准确率 > 80%（1000篇标注数据）
- [ ] 连贯性检查准确率 > 85%（500篇标注数据）
- [ ] 用户偏好学习：编辑追踪准确率 > 95%
- [ ] 用户偏好学习：偏好分析与实际风格相关性 > 0.8
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖率 > 70%
- [ ] E2E测试覆盖率 > 60%

### 文档验收
- [ ] API文档完整
- [ ] 用户手册更新
- [ ] 开发文档更新
- [ ] 部署文档更新
- [ ] 性能测试报告
- [ ] 安全审计报告

### 上线验收
- [ ] 功能开关配置完成
- [ ] 监控告警配置完成
- [ ] 备份策略配置完成
- [ ] 回滚流程演练通过
- [ ] 灰度发布计划制定
- [ ] 用户偏好学习系统冷启动策略验证
- [ ] 用户培训材料准备

---

## 🧠 第九部分：用户偏好学习系统（新增）

### 9.1 系统概述

**目标**：AI写作工具能够根据用户的每次修改意见，自动学习并调整写作风格，使输出越来越符合用户个人口味。

**优先级**：🔴 高
**预计时间**：4-5周
**依赖**：可与1.3情感增强并行开发
**负责团队**：后端1人

#### 核心价值
```
传统AI写作: 用户 → AI生成 → 用户大量修改 → 效率低
智能AI写作: 用户 → AI生成 → 用户少量修改 → 系统学习 → AI更懂你
```

---

### 9.2 架构设计

```
packages/core/src/
├── learning/
│   ├── index.ts
│   ├── edit-tracker.ts           # 编辑追踪器
│   ├── preference-analyzer.ts    # 偏好分析器
│   ├── user-profile.ts          # 用户画像
│   ├── prompt-enhancer.ts       # 提示词增强器
│   └── feedback-loop.ts         # 反馈循环

prisma/
└── schema.prisma       # 新增用户偏好表
```

#### 数据库设计
```prisma
// schema.prisma 新增
model UserPreference {
  id            String    @id @default(cuid())
  userId        String
  bookId        String?   // null表示全局偏好
  global        Json      // WritingPreference
  learningHistory Json    // LearningHistory
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([userId, bookId])
  @@index([userId])
}

model UserEdit {
  id            String    @id @default(cuid())
  userId        String
  bookId        String
  chapterId     String
  originalText  String
  editedText    String
  editType      String    // rewrite, rephrase, delete, add, polish, tone-shift
  context       Json?     // EditContext
  createdAt     DateTime  @default(now())

  @@index([userId, bookId])
  @@index([createdAt])
}
```

---

### 9.3 核心功能实现

#### 9.3.1 编辑追踪器 (edit-tracker.ts)

```typescript
// edit-tracker.ts
export interface UserEdit {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  originalText: string;      // AI生成的原文
  editedText: string;        // 用户修改后的文本
  editType: EditType;
  timestamp: string;
  context?: EditContext;
}

export type EditType = 
  | 'rewrite'      // 完全重写
  | 'rephrase'     // 改写（保留原意）
  | 'delete'       // 删除内容
  | 'add'          // 添加内容
  | 'merge'        // 合并段落
  | 'split'        // 拆分段落
  | 'polish'       // 润色优化
  | 'tone-shift';  // 语气调整

export interface EditContext {
  beforeParagraph?: string;
  afterParagraph?: string;
  sceneType?: 'dialogue' | 'description' | 'action' | 'narration';
  characterSpeaking?: string;
}

export class EditTracker {
  private prisma: PrismaClient;
  private batchSize = 10;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async trackEdit(edit: Omit<UserEdit, 'id' | 'timestamp'>): Promise<void> {
    const fullEdit: UserEdit = {
      ...edit,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    // 持久化存储
    await this.prisma.userEdit.create({
      data: {
        userId: fullEdit.userId,
        bookId: fullEdit.bookId,
        chapterId: fullEdit.chapterId,
        originalText: fullEdit.originalText,
        editedText: fullEdit.editedText,
        editType: fullEdit.editType,
        context: fullEdit.context as any,
      },
    });

    // 达到批次大小时触发分析
    const count = await this.prisma.userEdit.count({
      where: { userId: edit.userId, bookId: edit.bookId },
    });

    if (count % this.batchSize === 0) {
      await this.triggerAnalysis(edit.userId, edit.bookId);
    }
  }

  private async triggerAnalysis(userId: string, bookId: string): Promise<void> {
    const analyzer = new PreferenceAnalyzer(this.prisma);
    const edits = await this.prisma.userEdit.findMany({
      where: { userId, bookId },
      orderBy: { createdAt: 'desc' },
      take: 50, // 最近50次编辑
    });

    const preference = await analyzer.analyze(edits);
    
    const profileManager = new UserProfileManager(this.prisma);
    await profileManager.updatePreference(userId, bookId, preference, 'auto-analysis');
  }
}
```

#### 9.3.2 偏好分析器 (preference-analyzer.ts)

```typescript
// preference-analyzer.ts
export interface WritingPreference {
  style: StylePreference;
  sentence: SentencePreference;
  vocabulary: VocabularyPreference;
  emotion: EmotionPreference;
  narrative: NarrativePreference;
  meta: PreferenceMeta;
}

export interface StylePreference {
  formality: number;        // 0-1，正式程度
  literaryLevel: number;    // 0-1，文学性水平
  humor: number;            // 0-1，幽默程度
  darkness: number;         // 0-1，暗黑程度
  romance: number;          // 0-1，浪漫程度
  action: number;           // 0-1，动作描写程度
}

export interface SentencePreference {
  avgLength: number;        // 平均句长（字数）
  shortSentenceRatio: number; // 短句（<15字）比例
  longSentenceRatio: number;  // 长句（>40字）比例
  paragraphLength: number;    // 平均段落长度
  useExclamation: number;     // 感叹号使用频率
  useEllipsis: number;        // 省略号使用频率
}

export interface VocabularyPreference {
  preferredWords: WordEntry[];    // 偏好用词
  avoidedWords: WordEntry[];      // 避免用词
  wordPairs: string[][];          // 常用词组搭配
}

export interface WordEntry {
  word: string;
  frequency: number;
  preferenceScore: number;
}

export interface EmotionPreference {
  intensity: number;
  directness: number;
  subtlety: number;
  preferredEmotions: string[];
  avoidedEmotions: string[];
}

export interface NarrativePreference {
  viewpoint: 'first' | 'third-limited' | 'third-omniscient';
  tense: 'past' | 'present';
  innerMonologue: number;
  dialogueRatio: number;
}

export interface PreferenceMeta {
  sampleSize: number;
  lastUpdated: string;
  confidence: number;
  version: number;
}

export class PreferenceAnalyzer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async analyze(edits: any[]): Promise<WritingPreference> {
    if (edits.length < 5) {
      return this.getDefaultPreference();
    }

    return {
      style: this.analyzeStyle(edits),
      sentence: this.analyzeSentence(edits),
      vocabulary: this.analyzeVocabulary(edits),
      emotion: this.analyzeEmotion(edits),
      narrative: this.analyzeNarrative(edits),
      meta: {
        sampleSize: edits.length,
        lastUpdated: new Date().toISOString(),
        confidence: this.calculateConfidence(edits.length),
        version: 1,
      },
    };
  }

  private analyzeStyle(edits: any[]): StylePreference {
    let formality = 0.5;
    let literaryLevel = 0.5;
    let humor = 0.5;

    for (const edit of edits) {
      if (edit.editType === 'polish') {
        literaryLevel += 0.05;
      }
      if (edit.editType === 'tone-shift') {
        // 检测语气变化方向
        const formalWords = ['您', '请', '谢谢', '抱歉'];
        const casualWords = ['你', '嘿', '哈哈', '哎'];
        
        const addedText = edit.editedText;
        const hasFormal = formalWords.some(w => addedText.includes(w));
        const hasCasual = casualWords.some(w => addedText.includes(w));
        
        if (hasFormal) formality += 0.1;
        if (hasCasual) formality -= 0.1;
      }
    }

    return {
      formality: this.clamp(formality),
      literaryLevel: this.clamp(literaryLevel),
      humor: this.clamp(humor),
      darkness: 0.5,
      romance: 0.5,
      action: 0.5,
    };
  }

  private analyzeSentence(edits: any[]): SentencePreference {
    let totalLengthChange = 0;
    let shortSentencePreference = 0;
    let count = 0;

    for (const edit of edits) {
      const originalSentences = this.splitSentences(edit.originalText);
      const editedSentences = this.splitSentences(edit.editedText);

      const originalAvg = this.avgLength(originalSentences);
      const editedAvg = this.avgLength(editedSentences);

      totalLengthChange += editedAvg - originalAvg;

      if (editedAvg < originalAvg - 5) {
        shortSentencePreference += 0.1;
      }
      count++;
    }

    const avgLengthChange = count > 0 ? totalLengthChange / count : 0;

    return {
      avgLength: Math.max(10, 25 - avgLengthChange),
      shortSentenceRatio: this.clamp(0.3 + shortSentencePreference),
      longSentenceRatio: 0.2,
      paragraphLength: 100,
      useExclamation: 0.3,
      useEllipsis: 0.2,
    };
  }

  private analyzeVocabulary(edits: any[]): VocabularyPreference {
    const preferredWords = new Map<string, number>();
    const avoidedWords = new Map<string, number>();

    for (const edit of edits) {
      const originalWords = this.tokenize(edit.originalText);
      const editedWords = this.tokenize(edit.editedText);

      // 用户添加的词 = 偏好
      for (const word of editedWords) {
        if (!originalWords.includes(word)) {
          preferredWords.set(word, (preferredWords.get(word) || 0) + 1);
        }
      }

      // 用户删除的词 = 避免
      for (const word of originalWords) {
        if (!editedWords.includes(word)) {
          avoidedWords.set(word, (avoidedWords.get(word) || 0) + 1);
        }
      }
    }

    return {
      preferredWords: this.sortAndLimit(preferredWords, 20),
      avoidedWords: this.sortAndLimit(avoidedWords, 20),
      wordPairs: [],
    };
  }

  private analyzeEmotion(edits: any[]): EmotionPreference {
    let intensity = 0.5;
    let directness = 0.5;

    const strongWords = ['怒', '悲', '狂', '激动', '兴奋', '绝望'];
    const subtleWords = ['微微', '轻轻', '淡淡', '似乎', '仿佛'];

    for (const edit of edits) {
      const addedText = edit.editedText;
      
      if (strongWords.some(w => addedText.includes(w))) {
        intensity += 0.1;
      }
      if (subtleWords.some(w => addedText.includes(w))) {
        intensity -= 0.05;
      }
    }

    return {
      intensity: this.clamp(intensity),
      directness: this.clamp(directness),
      subtlety: 1 - this.clamp(directness),
      preferredEmotions: [],
      avoidedEmotions: [],
    };
  }

  private analyzeNarrative(edits: any[]): NarrativePreference {
    let dialogueRatio = 0.3;
    let innerMonologue = 0.3;

    for (const edit of edits) {
      const text = edit.editedText;
      const dialogueMarkers = (text.match(/[""「」]/g) || []).length;
      const totalChars = text.length;
      
      if (totalChars > 0) {
        dialogueRatio += dialogueMarkers / totalChars;
      }
    }

    return {
      viewpoint: 'third-limited',
      tense: 'past',
      innerMonologue: this.clamp(innerMonologue),
      dialogueRatio: this.clamp(dialogueRatio),
    };
  }

  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < 10) return 0.3;
    if (sampleSize < 30) return 0.5;
    if (sampleSize < 50) return 0.7;
    if (sampleSize < 100) return 0.85;
    return 0.95;
  }

  private splitSentences(text: string): string[] {
    return text.split(/(?<=[。！？])/).filter(s => s.trim());
  }

  private avgLength(sentences: string[]): number {
    if (sentences.length === 0) return 0;
    return sentences.reduce((a, b) => a + b.length, 0) / sentences.length;
  }

  private tokenize(text: string): string[] {
    return text.match(/[一-龥]+|[a-zA-Z]+|\d+/g) || [];
  }

  private sortAndLimit(map: Map<string, number>, limit: number): WordEntry[] {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, freq]) => ({ word, frequency: freq, preferenceScore: freq > 3 ? 1 : 0 }));
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
```

#### 9.3.3 用户画像管理 (user-profile.ts)

```typescript
// user-profile.ts
export class UserProfileManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getPreference(userId: string, bookId: string): Promise<WritingPreference> {
    // 1. 查找书籍级偏好
    const bookPref = await this.prisma.userPreference.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (bookPref) {
      return bookPref.global as WritingPreference;
    }

    // 2. 查找全局偏好
    const globalPref = await this.prisma.userPreference.findUnique({
      where: { userId_bookId: { userId, bookId: null } },
    });

    if (globalPref) {
      return globalPref.global as WritingPreference;
    }

    // 3. 返回默认偏好
    return this.getDefaultPreference();
  }

  async updatePreference(
    userId: string,
    bookId: string | null,
    newPreference: WritingPreference,
    reason: string
  ): Promise<void> {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (existing) {
      // 平滑更新（避免剧烈变化）
      const oldPreference = existing.global as WritingPreference;
      const smoothed = this.smoothUpdate(oldPreference, newPreference, 0.3);

      await this.prisma.userPreference.update({
        where: { id: existing.id },
        data: { global: smoothed as any },
      });
    } else {
      await this.prisma.userPreference.create({
        data: {
          userId,
          bookId,
          global: newPreference as any,
          learningHistory: { totalEdits: 0, milestones: [] } as any,
        },
      });
    }
  }

  private smoothUpdate(old: WritingPreference, newPref: WritingPreference, weight: number): WritingPreference {
    return {
      style: {
        formality: this.lerp(old.style.formality, newPref.style.formality, weight),
        literaryLevel: this.lerp(old.style.literaryLevel, newPref.style.literaryLevel, weight),
        humor: this.lerp(old.style.humor, newPref.style.humor, weight),
        darkness: this.lerp(old.style.darkness, newPref.style.darkness, weight),
        romance: this.lerp(old.style.romance, newPref.style.romance, weight),
        action: this.lerp(old.style.action, newPref.style.action, weight),
      },
      sentence: {
        avgLength: this.lerp(old.sentence.avgLength, newPref.sentence.avgLength, weight),
        shortSentenceRatio: this.lerp(old.sentence.shortSentenceRatio, newPref.sentence.shortSentenceRatio, weight),
        longSentenceRatio: this.lerp(old.sentence.longSentenceRatio, newPref.sentence.longSentenceRatio, weight),
        paragraphLength: this.lerp(old.sentence.paragraphLength, newPref.sentence.paragraphLength, weight),
        useExclamation: this.lerp(old.sentence.useExclamation, newPref.sentence.useExclamation, weight),
        useEllipsis: this.lerp(old.sentence.useEllipsis, newPref.sentence.useEllipsis, weight),
      },
      vocabulary: {
        preferredWords: this.mergeWordLists(old.vocabulary.preferredWords, newPref.vocabulary.preferredWords),
        avoidedWords: this.mergeWordLists(old.vocabulary.avoidedWords, newPref.vocabulary.avoidedWords),
        wordPairs: newPref.vocabulary.wordPairs,
      },
      emotion: {
        intensity: this.lerp(old.emotion.intensity, newPref.emotion.intensity, weight),
        directness: this.lerp(old.emotion.directness, newPref.emotion.directness, weight),
        subtlety: this.lerp(old.emotion.subtlety, newPref.emotion.subtlety, weight),
        preferredEmotions: newPref.emotion.preferredEmotions,
        avoidedEmotions: newPref.emotion.avoidedEmotions,
      },
      narrative: newPref.narrative,
      meta: {
        sampleSize: newPref.meta.sampleSize,
        lastUpdated: new Date().toISOString(),
        confidence: Math.min(1, old.meta.confidence + 0.05),
        version: old.meta.version + 1,
      },
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private mergeWordLists(old: WordEntry[], newWords: WordEntry[]): WordEntry[] {
    const merged = new Map<string, WordEntry>();
    
    for (const word of old) {
      merged.set(word.word, word);
    }
    
    for (const word of newWords) {
      const existing = merged.get(word.word);
      if (existing) {
        existing.frequency += word.frequency;
      } else {
        merged.set(word.word, word);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 30);
  }
}
```

#### 9.3.4 提示词增强器 (prompt-enhancer.ts)

```typescript
// prompt-enhancer.ts
export class PromptEnhancer {
  async buildEnhancedPrompt(
    basePrompt: string,
    preference: WritingPreference,
    context?: {
      bookGenre?: string;
      chapterNumber?: number;
      sceneType?: 'dialogue' | 'description' | 'action' | 'narration';
    }
  ): Promise<string> {
    const styleGuide = this.generateStyleGuide(preference);
    const contextGuide = context ? this.generateContextGuide(context) : '';

    return `
你是一位专业的中文小说作家。请严格按照以下要求创作。

## 创作要求
${basePrompt}

## ⚠️ 重要：个人风格指南
${styleGuide}

${contextGuide}

## 注意事项
- 严格遵循上述风格指南
- 使用偏好词汇，避免避免词汇
- 句子长度控制在${preference.sentence.avgLength}字左右
    `.trim();
  }

  private generateStyleGuide(p: WritingPreference): string {
    const lines: string[] = [];

    lines.push('### 语言风格');
    lines.push(`- 正式程度: ${this.getDesc(p.style.formality, 'formality')}`);
    lines.push(`- 文学性: ${this.getDesc(p.style.literaryLevel, 'literary')}`);
    lines.push(`- 幽默感: ${this.getDesc(p.style.humor, 'humor')}`);

    lines.push('\n### 句式要求');
    lines.push(`- 平均句长: ${p.sentence.avgLength}字`);
    lines.push(`- 短句比例: ${(p.sentence.shortSentenceRatio * 100).toFixed(0)}%`);

    if (p.vocabulary.preferredWords.length > 0) {
      lines.push('\n### 偏好用词');
      lines.push(`优先使用: ${p.vocabulary.preferredWords.slice(0, 10).map(w => w.word).join('、')}`);
    }

    if (p.vocabulary.avoidedWords.length > 0) {
      lines.push('\n### 避免用词');
      lines.push(`不要使用: ${p.vocabulary.avoidedWords.slice(0, 10).map(w => w.word).join('、')}`);
    }

    lines.push('\n### 情感表达');
    lines.push(`- 强度: ${p.emotion.intensity > 0.6 ? '情感充沛' : p.emotion.intensity > 0.3 ? '适度表达' : '平静克制'}`);
    lines.push(`- 方式: ${p.emotion.directness > 0.5 ? '直接表达' : '含蓄委婉'}`);

    return lines.join('\n');
  }

  private getDesc(value: number, type: string): string {
    if (type === 'formality') {
      return value < 0.3 ? '口语化' : value < 0.6 ? '适中' : '书面语';
    }
    if (type === 'literary') {
      return value < 0.3 ? '简洁直白' : value < 0.6 ? '适度修饰' : '文学性强';
    }
    if (type === 'humor') {
      return value < 0.3 ? '严肃认真' : value < 0.6 ? '适度幽默' : '轻松诙谐';
    }
    return '';
  }

  private generateContextGuide(context: any): string {
    const lines: string[] = ['## 场景上下文'];
    if (context.bookGenre) lines.push(`- 小说类型: ${context.bookGenre}`);
    if (context.chapterNumber) lines.push(`- 当前章节: 第${context.chapterNumber}章`);
    if (context.sceneType) {
      const sceneDesc: Record<string, string> = {
        dialogue: '对话场景：注重人物语气',
        description: '描写场景：注重视觉细节',
        action: '动作场景：注重节奏感',
        narration: '叙述场景：注重情节推进',
      };
      lines.push(`- 场景类型: ${sceneDesc[context.sceneType] || context.sceneType}`);
    }
    return lines.join('\n');
  }
}
```

---

### 9.4 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户编辑操作                              │
│  "AI生成的句子" → 用户修改 → "用户期望的句子"                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EditTracker (编辑追踪器)                       │
│  • 记录原文 vs 修改后文本                                        │
│  • 识别编辑类型（重写/改写/删除/添加/润色）                         │
│  • 存储到PostgreSQL                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 PreferenceAnalyzer (偏好分析器)                   │
│  • 句式分析：句长变化、段落结构                                   │
│  • 用词分析：添加的词、删除的词                                   │
│  • 风格分析：正式度、文学性、幽默感                               │
│  • 情感分析：强度、表达方式                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 UserProfileManager (画像管理器)                   │
│  • 平滑更新偏好（避免剧烈变化）                                   │
│  • 支持全局偏好 + 书籍级偏好                                     │
│  • 计算置信度                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  PromptEnhancer (提示词增强器)                    │
│  • 将用户偏好转换为风格指南                                      │
│  • 注入到AI生成提示词中                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 AI生成符合用户风格的文本                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 9.5 冷启动策略

```typescript
// cold-start.ts
export class ColdStartHandler {
  getGenreDefault(genre: string): WritingPreference {
    const defaults: Record<string, Partial<WritingPreference>> = {
      '玄幻': {
        style: { formality: 0.6, literaryLevel: 0.7, humor: 0.3, darkness: 0.4, romance: 0.2, action: 0.8 },
        sentence: { avgLength: 28, shortSentenceRatio: 0.3, longSentenceRatio: 0.3, paragraphLength: 120, useExclamation: 0.4, useEllipsis: 0.2 },
      },
      '都市': {
        style: { formality: 0.4, literaryLevel: 0.4, humor: 0.6, darkness: 0.2, romance: 0.5, action: 0.3 },
        sentence: { avgLength: 22, shortSentenceRatio: 0.5, longSentenceRatio: 0.1, paragraphLength: 80, useExclamation: 0.5, useEllipsis: 0.4 },
      },
      '言情': {
        style: { formality: 0.5, literaryLevel: 0.6, humor: 0.3, darkness: 0.2, romance: 0.9, action: 0.1 },
        sentence: { avgLength: 25, shortSentenceRatio: 0.4, longSentenceRatio: 0.2, paragraphLength: 100, useExclamation: 0.3, useEllipsis: 0.5 },
      },
      '悬疑': {
        style: { formality: 0.5, literaryLevel: 0.5, humor: 0.1, darkness: 0.7, romance: 0.1, action: 0.6 },
        sentence: { avgLength: 20, shortSentenceRatio: 0.6, longSentenceRatio: 0.1, paragraphLength: 70, useExclamation: 0.2, useEllipsis: 0.3 },
      },
    };

    return this.mergeWithDefaults(defaults[genre] || {});
  }
}
```

---

### 9.6 实施步骤

| 步骤 | 任务 | 时间 | 产出 |
|------|------|------|------|
| 1 | 数据库Schema设计 | 2天 | schema.prisma |
| 2 | 实现编辑追踪器 | 3天 | edit-tracker.ts |
| 3 | 实现偏好分析器 | 4天 | preference-analyzer.ts |
| 4 | 实现用户画像管理 | 3天 | user-profile.ts |
| 5 | 实现提示词增强器 | 3天 | prompt-enhancer.ts |
| 6 | 实现冷启动策略 | 2天 | cold-start.ts |
| 7 | 集成到写作流程 | 3天 | 集成测试 |
| 8 | 测试和调优 | 3天 | 测试报告 |

**总计**: 4-5周

---

### 9.7 验收标准（DoD）

- [ ] 数据库Schema迁移完成
- [ ] 编辑追踪准确率 > 95%
- [ ] 偏好分析与用户实际风格相关性 > 0.8
- [ ] 冷启动阶段（<20次编辑）能提供合理的默认偏好
- [ ] 稳定阶段（>50次编辑）用户修改率下降 > 30%
- [ ] 支持书籍级偏好覆盖全局偏好
- [ ] 偏好更新平滑，无剧烈波动
- [ ] 单元测试覆盖率 > 80%
- [ ] 与现有写作流程集成测试通过

---

### 9.8 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **编辑样本不足** | 高 | 中 | 冷启动使用类型默认偏好 |
| **偏好漂移** | 中 | 中 | 滑动窗口，最近编辑权重更高 |
| **过度拟合** | 中 | 高 | 偏好变化上限，保留多样性 |
| **计算开销** | 低 | 中 | 异步分析，不阻塞用户 |
| **隐私问题** | 低 | 高 | 数据本地存储（PostgreSQL） |

---

**制定时间**：2026年6月16日
**版本**：V3.1（新增用户偏好学习系统）
**预计完成**：2026年9月底（12周）→ 调整为2026年10月中旬（14周）
**负责团队**：后端2人 + 前端1人
**总工时**：约560人时（2人 × 14周 × 20小时/周）
