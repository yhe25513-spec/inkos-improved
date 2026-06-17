// ── 内容分析器 ────────────────────────────────────────
// 分析文本内容，检测AI生成特征

import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";

/**
 * 内容分析结果
 */
export interface ContentAnalysisResult {
  /** AI内容占比 0-1 */
  aiPercentage: number;
  /** 困惑度 */
  perplexity: number;
  /** 突发性 */
  burstiness: number;
  /** 词汇多样性 */
  vocabularyDiversity: number;
  /** 是否为AI生成 */
  isAIGenerated: boolean;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 内容分析器
 */
export class ContentAnalyzer {
  private perplexityAnalyzer: PerplexityAnalyzer;

  constructor() {
    this.perplexityAnalyzer = new PerplexityAnalyzer();
  }

  /**
   * 分析文本内容
   */
  analyze(text: string): ContentAnalysisResult {
    const analysis = this.perplexityAnalyzer.analyze(text);

    return {
      aiPercentage: analysis.isAIGenerated ? analysis.confidence : 1 - analysis.confidence,
      perplexity: analysis.perplexity,
      burstiness: analysis.burstiness,
      vocabularyDiversity: analysis.vocabularyDiversity,
      isAIGenerated: analysis.isAIGenerated,
      confidence: analysis.confidence,
    };
  }

  /**
   * 批量分析多个文本
   */
  analyzeBatch(texts: string[]): ContentAnalysisResult[] {
    return texts.map((text) => this.analyze(text));
  }

  /**
   * 计算整本书的AI内容占比
   */
  calculateBookAIPercentage(chapters: string[]): number {
    if (chapters.length === 0) return 0;

    const analyses = this.analyzeBatch(chapters);
    const totalAiPercentage = analyses.reduce((sum, a) => sum + a.aiPercentage, 0);

    return totalAiPercentage / chapters.length;
  }
}
