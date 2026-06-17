// ── 自然度测试器 ──────────────────────────────────────
// 测试增强后文本的自然度，使用A/B测试

import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";
import type { NaturalnessResult } from "./types.js";

/**
 * 自然度测试器
 */
export class NaturalnessTester {
  private analyzer: PerplexityAnalyzer;

  constructor() {
    this.analyzer = new PerplexityAnalyzer();
  }

  /**
   * 测试增强后文本的自然度
   */
  testNaturalness(
    original: string,
    enhanced: string,
  ): NaturalnessResult {
    // 1. 计算困惑度变化
    const originalAnalysis = this.analyzer.analyze(original);
    const enhancedAnalysis = this.analyzer.analyze(enhanced);

    // 2. 计算情感增强分数
    const emotionScore = this.evaluateEmotionEnhancement(original, enhanced);

    // 3. 综合评分
    const score = this.calculateNaturalnessScore(
      originalAnalysis.perplexity,
      enhancedAnalysis.perplexity,
      originalAnalysis.burstiness,
      enhancedAnalysis.burstiness,
      emotionScore,
    );

    return {
      score,
      originalPerplexity: originalAnalysis.perplexity,
      enhancedPerplexity: enhancedAnalysis.perplexity,
      originalBurstiness: originalAnalysis.burstiness,
      enhancedBurstiness: enhancedAnalysis.burstiness,
      emotionScore,
      passed: score >= 60,
    };
  }

  /**
   * 评估情感增强效果
   */
  private evaluateEmotionEnhancement(original: string, enhanced: string): number {
    // 检查增强后是否添加了情感元素
    const emotionMarkers = ["（", "）", "心里", "眼中", "声音"];
    let emotionCount = 0;

    for (const marker of emotionMarkers) {
      const regex = new RegExp(marker, "g");
      const matches = enhanced.match(regex);
      if (matches) {
        emotionCount += matches.length;
      }
    }

    // 计算情感增强分数 (0-100)
    // 添加了1-3个情感元素 = 60-80分
    // 添加了4+个情感元素 = 80-100分
    if (emotionCount === 0) return 50;
    if (emotionCount <= 3) return 60 + emotionCount * 6.67;
    return Math.min(100, 80 + (emotionCount - 3) * 5);
  }

  /**
   * 计算自然度分数
   */
  private calculateNaturalnessScore(
    originalPerplexity: number,
    enhancedPerplexity: number,
    originalBurstiness: number,
    enhancedBurstiness: number,
    emotionScore: number,
  ): number {
    let score = 50; // 基础分

    // 1. 困惑度变化 (0-25分)
    // 增强后困惑度应该适当提高（更像人类）
    const perplexityChange = enhancedPerplexity - originalPerplexity;
    if (perplexityChange > 0) {
      score += Math.min(25, perplexityChange * 0.5);
    } else {
      score += Math.max(0, 25 + perplexityChange * 0.3);
    }

    // 2. 突发性变化 (0-25分)
    // 增强后突发性应该适当提高
    const burstinessChange = enhancedBurstiness - originalBurstiness;
    if (burstinessChange > 0) {
      score += Math.min(25, burstinessChange * 50);
    } else {
      score += Math.max(0, 25 + burstinessChange * 30);
    }

    // 3. 情感增强分数 (0-50分)
    score += emotionScore * 0.5;

    return Math.max(0, Math.min(100, score));
  }
}
