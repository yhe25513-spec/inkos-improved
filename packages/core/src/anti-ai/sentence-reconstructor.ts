// ── 句式重构器（核心）────────────────────────────────
// 不只是换词，而是从句式结构层面去除AI特征
//
// AI检测器主要检测:
// 1. 困惑度(Perplexity): AI文本困惑度低
// 2. 突发性(Burstiness): AI文本句子长度均匀
// 3. 词汇多样性: AI倾向于使用常见词

import { PerplexityAnalyzer, type PerplexityResult } from "./perplexity-analyzer.js";

/**
 * 重构策略枚举
 */
export type ReconstructStrategy =
  | "split-long-sentences"    // 拆分过长句子
  | "merge-short-sentences"   // 合并过短句子
  | "add-colloquialisms"      // 添加口语化表达
  | "insert-interjections"    // 插入语气词
  | "vary-sentence-length"    // 调整句子长度多样性
  | "add-rhythm-breaks"       // 添加节奏变化
  | "restructure-clauses"     // 重构从句结构
  | "add-imperfections";      // 添加人类不完美特征

/**
 * 重构选项
 */
export interface ReconstructOptions {
  /** 目标困惑度（默认80） */
  targetPerplexity?: number;
  /** 目标突发性（默认0.5） */
  targetBurstiness?: number;
  /** 文体类型 */
  genre?: "xuanhuan" | "urban" | "romance" | "mystery" | "general";
  /** 应用策略列表（默认全部） */
  strategies?: ReconstructStrategy[];
  /** 重构强度 1-10（默认5） */
  intensity?: number;
}

/**
 * 句式重构器
 */
export class SentenceReconstructor {
  private analyzer: PerplexityAnalyzer;

  constructor() {
    this.analyzer = new PerplexityAnalyzer();
  }

  /**
   * 重构文本，去除AI特征
   */
  async reconstruct(
    text: string,
    options: ReconstructOptions = {},
  ): Promise<string> {
    const {
      targetPerplexity = 80,
      targetBurstiness = 0.5,
      genre = "general",
      intensity = 5,
    } = options;

    // 1. 分析当前AI特征
    const analysis = this.analyzer.analyze(text);

    // 如果困惑度已经足够高，不需要重构
    if (analysis.perplexity >= targetPerplexity && analysis.burstiness >= targetBurstiness) {
      return text;
    }

    // 2. 拆分为段落和句子
    const paragraphs = text.split(/\n\n+/);
    const reconstructed: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) {
        reconstructed.push(paragraph);
        continue;
      }

      let result = paragraph;

      // 3. 逐步应用重构策略
      // 3.1 拆分过长句子（影响突发性）
      if (analysis.burstiness < targetBurstiness || intensity >= 3) {
        result = this.splitLongSentences(result, intensity);
      }

      // 3.2 重构从句结构（影响困惑度）
      if (analysis.perplexity < targetPerplexity || intensity >= 4) {
        result = this.restructureClauses(result, genre, intensity);
      }

      // 3.3 添加口语化表达（影响困惑度和突发性）
      if (analysis.perplexity < targetPerplexity || intensity >= 5) {
        result = this.addColloquialisms(result, genre, intensity);
      }

      // 3.4 插入语气词（影响困惑度）
      if (analysis.perplexity < targetPerplexity * 0.8 || intensity >= 6) {
        result = this.insertInterjections(result, intensity);
      }

      // 3.5 添加节奏变化（影响突发性）
      if (analysis.burstiness < targetBurstiness * 0.8 || intensity >= 5) {
        result = this.addRhythmBreaks(result, intensity);
      }

      // 3.6 添加人类不完美特征（影响困惑度）
      if (analysis.perplexity < targetPerplexity || intensity >= 7) {
        result = this.addImperfections(result, intensity);
      }

      reconstructed.push(result);
    }

    return reconstructed.join("\n\n");
  }

  /**
   * 拆分过长句子
   * AI倾向于写又长又均匀的句子
   */
  private splitLongSentences(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    const threshold = intensity >= 7 ? 30 : intensity >= 5 ? 40 : 50;
    const result: string[] = [];

    for (const sentence of sentences) {
      if (sentence.length > threshold) {
        // 在逗号、分号处拆分
        const parts = sentence.split(/(?<=[，,；;])\s*/);
        if (parts.length > 1) {
          // 随机决定是否拆分（避免过度处理）
          if (Math.random() < 0.4 * (intensity / 10)) {
            for (const part of parts) {
              if (part.trim().length > 0) {
                result.push(part.trim());
              }
            }
            continue;
          }
        }
      }
      result.push(sentence);
    }

    return result.join("");
  }

  /**
   * 重构从句结构
   * AI倾向于使用"主语+谓语+宾语"的标准结构
   */
  private restructureClauses(text: string, genre: string, intensity: number): string {
    // 中文从句重构模式
    const patterns: Array<{ regex: RegExp; restructure: (match: string) => string }> = [
      // "虽然A，但是B" → 随机替换为其他表达
      {
        regex: /虽然(.+?)，但是(.+?)(?:。|$)/g,
        restructure: (m) => {
          const [, a, b] = m.match(/虽然(.+?)，但是(.+?)(?:。|$)/) ?? [];
          if (!a || !b) return m;
          const transforms = [
            `${a}，不过${b}`,
            `虽说${a}，可${b}`,
            `${b}，尽管${a}`,
          ];
          return transforms[Math.floor(Math.random() * transforms.length)] + "。";
        },
      },
      // "因为A，所以B" → 简化
      {
        regex: /因为(.+?)，所以(.+?)(?:。|$)/g,
        restructure: (m) => {
          const [, a, b] = m.match(/因为(.+?)，所以(.+?)(?:。|$)/) ?? [];
          if (!a || !b) return m;
          const transforms = [
            `${a}，${b}`,
            `既然${a}，那就${b}`,
            `${b}，毕竟${a}`,
          ];
          return transforms[Math.floor(Math.random() * transforms.length)] + "。";
        },
      },
      // "不仅A，而且B" → 多种替换
      {
        regex: /不仅(.+?)，而且(.+?)(?:。|$)/g,
        restructure: (m) => {
          const [, a, b] = m.match(/不仅(.+?)，而且(.+?)(?:。|$)/) ?? [];
          if (!a || !b) return m;
          const transforms = [
            `${a}，还${b}`,
            `${a}，更${b}`,
            `不光${a}，连${b}`,
          ];
          return transforms[Math.floor(Math.random() * transforms.length)] + "。";
        },
      },
    ];

    let result = text;
    for (const pattern of patterns) {
      if (Math.random() < 0.3 * (intensity / 10)) {
        result = result.replace(pattern.regex, pattern.restructure);
      }
    }
    return result;
  }

  /**
   * 添加口语化表达
   * 人类写作会使用更多口语化词汇
   */
  private addColloquialisms(text: string, genre: string, intensity: number): string {
    if (intensity < 4) return text;

    const colloquialReplacements: Array<{ pattern: RegExp; replacements: string[] }> = [
      { pattern: /说道/g, replacements: ["说", "开口道", "嘟囔道"] },
      { pattern: /想到/g, replacements: ["琢磨", "寻思", "心里盘算"] },
      { pattern: /十分/g, replacements: ["挺", "相当", "特别"] },
      { pattern: /非常/g, replacements: ["特", "格外", "贼"] },
      { pattern: /立刻/g, replacements: ["马上", "赶紧", "麻溜"] },
      { pattern: /立即/g, replacements: ["这就", "当下", "二话不说"] },
      { pattern: /突然/g, replacements: ["猛地", "冷不丁", "一下子"] },
      { pattern: /随即/g, replacements: ["接着", "然后", "跟着"] },
      { pattern: /此时/g, replacements: ["这会儿", "这时候", "当下"] },
      { pattern: /彼时/g, replacements: ["那时候", "当时", "那会儿"] },
    ];

    let result = text;
    for (const { pattern, replacements } of colloquialReplacements) {
      if (Math.random() < 0.2 * (intensity / 10)) {
        result = result.replace(pattern, () => {
          return replacements[Math.floor(Math.random() * replacements.length)];
        });
      }
    }

    // 根据文体调整
    if (genre === "urban") {
      // 都市文更口语化
      const urbanPatterns: Array<{ pattern: RegExp; replacements: string[] }> = [
        { pattern: /离开/g, replacements: ["走了", "溜了", "闪人"] },
        { pattern: /愤怒/g, replacements: ["气炸了", "火大", "怒了"] },
        { pattern: /高兴/g, replacements: ["乐了", "美了", "开心"] },
      ];
      for (const { pattern, replacements } of urbanPatterns) {
        if (Math.random() < 0.15 * (intensity / 10)) {
          result = result.replace(pattern, () =>
            replacements[Math.floor(Math.random() * replacements.length)],
          );
        }
      }
    }

    return result;
  }

  /**
   * 插入语气词
   * 人类写作会使用"嗯、啊、呢、嘛"等语气词
   */
  private insertInterjections(text: string, intensity: number): string {
    if (intensity < 5) return text;

    const sentences = this.splitSentences(text);
    const result: string[] = [];

    for (const sentence of sentences) {
      // 只在20%的句子中插入语气词（避免过度）
      if (Math.random() < 0.12 * (intensity / 10)) {
        const trimmed = sentence.trimEnd();
        const interjections = ["呢", "啊", "嘛", "吧", "哦", "噢", "嘿"];
        const interjection = interjections[Math.floor(Math.random() * interjections.length)];

        // 在句号前插入
        if (trimmed.endsWith("。")) {
          result.push(trimmed.slice(0, -1) + interjection + "。");
          continue;
        }
      }
      result.push(sentence);
    }

    return result.join("");
  }

  /**
   * 添加节奏变化
   * 人类写作有长有短，AI写作趋于均匀
   */
  private addRhythmBreaks(text: string, intensity: number): string {
    const sentences = this.splitSentences(text);
    if (sentences.length < 3) return text;

    const result: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // 随机在长句后插入短句（增强突发性）
      if (
        sentence.length > 30 &&
        Math.random() < 0.15 * (intensity / 10) &&
        i < sentences.length - 1
      ) {
        // 添加一个简短的过渡句
        const transitions = ["说来也怪。", "谁也没想到。", "就这么巧。", "谁能想到呢。"];
        const shortBreak = transitions[Math.floor(Math.random() * transitions.length)];
        result.push(sentence);
        result.push(shortBreak);
      } else {
        result.push(sentence);
      }
    }

    return result.join("");
  }

  /**
   * 添加人类不完美特征
   * 人类写作有轻微重复、口语化、不完美
   */
  private addImperfections(text: string, intensity: number): string {
    if (intensity < 7) return text;

    let result = text;

    // 随机添加轻微重复（人类写作常见）
    if (Math.random() < 0.05 * (intensity / 10)) {
      // 在句首添加重复词
      const repetitionPatterns = [
        { regex: /(^|[。！？])他/g, replacement: "$1他他" },
        { regex: /(^|[。！？])这/g, replacement: "$1这这" },
      ];
      const pattern = repetitionPatterns[Math.floor(Math.random() * repetitionPatterns.length)];
      if (pattern) {
        result = result.replace(pattern.regex, pattern.replacement);
      }
    }

    return result;
  }

  /**
   * 按句子分割（支持中英文标点）
   */
  private splitSentences(text: string): string[] {
    const parts = text.split(/(?<=[。！？.!?])\s*/);
    return parts.filter((s) => s.trim().length > 0);
  }
}
