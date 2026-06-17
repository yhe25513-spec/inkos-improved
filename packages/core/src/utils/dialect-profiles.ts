// ============================================================
// dialect-profiles.ts — 方言和口癖支持
// ============================================================

// ---- Interfaces ----

export interface DialectProfile {
  readonly name: string;
  readonly region: string;
  readonly features: {
    readonly particles: ReadonlyArray<string>;      // 语气词
    readonly sentenceEndings: ReadonlyArray<string>; // 句尾习惯
    readonly vocabulary: Record<string, string>;      // 方言词汇映射
    readonly grammarPatterns: ReadonlyArray<string>;  // 语法特征
    readonly phoneticHints: ReadonlyArray<string>;    // 发音提示
  };
  readonly examples: ReadonlyArray<{
    readonly standard: string;
    readonly dialect: string;
  }>;
}

export interface SpeechPattern {
  readonly name: string;
  readonly description: string;
  readonly habits: {
    readonly sentenceLength: "short" | "medium" | "long" | "mixed";
    readonly punctuation: ReadonlyArray<string>;
    readonly fillerWords: ReadonlyArray<string>;
    readonly interruptions: boolean;
    readonly trailingOff: boolean;
  };
  readonly transformationRules: ReadonlyArray<{
    readonly pattern: RegExp;
    readonly replacement: string;
  }>;
}

// ---- Pre-defined dialect profiles ----

export const DIALECT_PROFILES: Record<string, DialectProfile> = {
  sichuan: {
    name: "四川话",
    region: "四川",
    features: {
      particles: ["噻", "咯", "嘛", "撒"],
      sentenceEndings: ["了咯", "得很", "惨了"],
      vocabulary: { "什么": "啥子", "没有": "莫得", "这里": "这儿", "那里": "那儿" },
      grammarPatterns: ["倒装句", "省略主语"],
      phoneticHints: ["平舌音", "儿化音少"],
    },
    examples: [
      { standard: "你在干什么？", dialect: "你在干啥子咯？" },
      { standard: "这里没有人。", dialect: "这儿莫得人噻。" },
    ],
  },
  cantonese: {
    name: "粤语",
    region: "广东",
    features: {
      particles: ["㗎", "啦", "喎", "噃"],
      sentenceEndings: ["嘅", "咗", "紧"],
      vocabulary: { "什么": "乜嘢", "这里": "呢度", "很": "好", "没有": "冇" },
      grammarPatterns: ["动词前置", "双宾语"],
      phoneticHints: ["入声", "九声六调"],
    },
    examples: [
      { standard: "你在干什么？", dialect: "你喺度做乜嘢？" },
      { standard: "我没有钱。", dialect: "我冇钱。" },
    ],
  },
  northeast: {
    name: "东北话",
    region: "东北",
    features: {
      particles: ["整", "嗷", "嘎哈", "咋"],
      sentenceEndings: ["整挺好", "嘎嘎的", "嗷嗷的"],
      vocabulary: { "什么": "啥", "怎么": "咋整", "厉害": "嘎嘎", "笨": "虎" },
      grammarPatterns: ["夸张表达", "拟声词多"],
      phoneticHints: ["儿化音重", "声调夸张"],
    },
    examples: [
      { standard: "你在干什么？", dialect: "你嘎哈呢？" },
      { standard: "这太厉害了。", dialect: "这嘎嘎的！" },
    ],
  },
};

// ---- Pre-defined speech patterns ----

export const SPEECH_PATTERNS: Record<string, SpeechPattern> = {
  laconic: {
    name: "惜字如金",
    description: "说话简短，不废话",
    habits: {
      sentenceLength: "short",
      punctuation: ["。"],
      fillerWords: [],
      interruptions: false,
      trailingOff: false,
    },
    transformationRules: [
      { pattern: /我觉得(.{10,})/g, replacement: "$1" },
      { pattern: /可以吗？/g, replacement: "嗯。" },
    ],
  },
  chatterbox: {
    name: "话痨",
    description: "爱说话，细节多",
    habits: {
      sentenceLength: "long",
      punctuation: ["！", "？", "……"],
      fillerWords: ["那个", "就是说", "你知道吗"],
      interruptions: true,
      trailingOff: true,
    },
    transformationRules: [
      { pattern: /^(.{5,10})。$/g, replacement: "$1，你懂我意思吧？" },
      { pattern: /好的。/g, replacement: "好嘞好嘞，没问题！" },
    ],
  },
  scholar: {
    name: "文绉绉",
    description: "说话文雅，引经据典",
    habits: {
      sentenceLength: "medium",
      punctuation: ["。", "；"],
      fillerWords: ["窃以为", "依我看", "此言差矣"],
      interruptions: false,
      trailingOff: false,
    },
    transformationRules: [
      { pattern: /你说得对/g, replacement: "此言甚善" },
      { pattern: /我不知道/g, replacement: "愚以为此事未可知" },
    ],
  },
};

// ---- Functions ----

/**
 * Apply dialect transformation to text.
 * Replaces vocabulary according to the dialect's vocabulary map.
 */
export function applyDialect(text: string, dialectName: string): string {
  const profile = DIALECT_PROFILES[dialectName];
  if (!profile) {
    return text;
  }
  let result = text;
  const entries = Object.entries(profile.features.vocabulary);
  for (const [standard, dialect] of entries) {
    result = result.split(standard).join(dialect);
  }
  return result;
}

/**
 * Apply speech pattern transformation to text.
 * Applies all transformation rules sequentially.
 */
export function applySpeechPattern(text: string, patternName: string): string {
  const pattern = SPEECH_PATTERNS[patternName];
  if (!pattern) {
    return text;
  }
  let result = text;
  for (const rule of pattern.transformationRules) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

/** Get dialect profile by name. */
export function getDialectProfile(name: string): DialectProfile | undefined {
  return DIALECT_PROFILES[name];
}

/** Get speech pattern by name. */
export function getSpeechPattern(name: string): SpeechPattern | undefined {
  return SPEECH_PATTERNS[name];
}

/** List all available dialects. */
export function listDialects(): ReadonlyArray<string> {
  return Object.keys(DIALECT_PROFILES);
}

/** List all available speech patterns. */
export function listSpeechPatterns(): ReadonlyArray<string> {
  return Object.keys(SPEECH_PATTERNS);
}
