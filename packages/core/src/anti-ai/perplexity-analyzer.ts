// ── 困惑度分析器 ──────────────────────────────────────
// AI文本困惑度通常较低（10-50），人类文本较高（50-200）
// 基于字符级 n-gram 模型估算，无需外部LLM

import { LRUCache } from "../utils/cache.js";

/**
 * 困惑度分析结果
 */
export interface PerplexityResult {
  /** 困惑度值：越低越像AI */
  perplexity: number;
  /** 是否判定为AI生成 */
  isAIGenerated: boolean;
  /** 置信度 0-1 */
  confidence: number;
  /** 突发性：越高越像人类（句子长度变化大） */
  burstiness: number;
  /** 词汇多样性：type-token ratio */
  vocabularyDiversity: number;
}

/**
 * 困惑度分析器
 * 使用字符级 bigram/trigram 模型估算文本困惑度
 */
export class PerplexityAnalyzer {
  private cache: LRUCache<string, PerplexityResult>;

  constructor() {
    this.cache = new LRUCache<string, PerplexityResult>({ maxSize: 500, ttlMs: 10 * 60 * 1000 });
  }

  /**
   * 分析文本的AI特征（带缓存）
   */
  analyze(text: string): PerplexityResult {
    // 对于短文本直接计算，不缓存
    if (text.length < 50) {
      return this.computeAnalysis(text);
    }

    // 对于长文本使用缓存（取前200字符作为key）
    const cacheKey = text.slice(0, 200);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = this.computeAnalysis(text);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 计算分析结果
   */
  private computeAnalysis(text: string): PerplexityResult {
    const perplexity = this.calculatePerplexity(text);
    const burstiness = this.calculateBurstiness(text);
    const vocabularyDiversity = this.calculateVocabularyDiversity(text);

    // 综合判断
    const isAI =
      perplexity < 50 ||
      (perplexity < 80 && burstiness < 0.3);

    const confidence = isAI
      ? Math.min(1, (50 - Math.min(perplexity, 50)) / 50 + (0.3 - Math.min(burstiness, 0.3)) / 0.3 * 0.3)
      : Math.min(1, (perplexity - 50) / 150 + burstiness * 0.5);

    return {
      perplexity,
      isAIGenerated: isAI,
      confidence: Math.max(0, Math.min(1, confidence)),
      burstiness,
      vocabularyDiversity,
    };
  }

  /**
   * 字符级 bigram 困惑度估算
   *
   * 原理：统计相邻字符对的频率分布。
   * AI文本倾向于使用高概率的字符组合（困惑度低），
   * 人类文本包含更多罕见组合（困惑度高）。
   */
  calculatePerplexity(text: string): number {
    if (text.length < 10) return 100; // 太短无法判断

    const clean = text.replace(/\s+/g, "");
    if (clean.length < 5) return 100;

    // 统计 bigram 频率
    const bigramCounts = new Map<string, number>();
    const totalBigrams = clean.length - 1;

    for (let i = 0; i < totalBigrams; i++) {
      const bigram = clean[i] + clean[i + 1];
      bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
    }

    // 计算熵
    let entropy = 0;
    for (const count of bigramCounts.values()) {
      const prob = count / totalBigrams;
      entropy -= prob * Math.log2(prob);
    }

    // 困惑度 = 2^entropy
    // 注意：这是近似值，真实困惑度需要语言模型
    // 经验校准：字符级bigram熵的典型范围 3-7 bits
    // 对应困惑度 8-128
    const perplexity = Math.pow(2, entropy);

    // 中文文本的特殊处理：
    // 中文字符集大，bigram天然更分散，困惑度偏高
    // 需要校准
    const chineseChars = (text.match(/[一-鿿]/g) ?? []).length;
    const chineseRatio = chineseChars / text.length;

    if (chineseRatio > 0.5) {
      // 中文文本校准：AI中文困惑度通常 15-40，人类 40-100
      return perplexity * 0.8;
    }

    return perplexity;
  }

  /**
   * 突发性分析
   *
   * 原理：人类写作句子长度变化大（有长有短），
   * AI生成的句子长度趋于均匀。
   * 突发性 = 句子长度标准差 / 平均值
   */
  calculateBurstiness(text: string): number {
    const sentences = this.splitSentences(text);
    if (sentences.length < 3) return 0.5; // 太少无法判断

    const lengths = sentences.map((s) => s.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (mean === 0) return 0;

    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) /
      lengths.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  /**
   * 词汇多样性（Type-Token Ratio）
   *
   * 原理：人类使用更多样的词汇，AI倾向于重复常见词。
   */
  calculateVocabularyDiversity(text: string): number {
    // 分词（简单按空格和标点分割）
    const tokens = text
      .replace(/[，。！？、；：""''（）\[\]【】《》\s]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 0);

    if (tokens.length === 0) return 0;

    const uniqueTokens = new Set(tokens);
    return uniqueTokens.size / tokens.length;
  }

  /**
   * 按句子分割文本
   */
  private splitSentences(text: string): string[] {
    // 支持中英文标点
    const raw = text.split(/(?<=[。！？.!?])\s*/);
    return raw.filter((s) => s.trim().length > 0);
  }
}
