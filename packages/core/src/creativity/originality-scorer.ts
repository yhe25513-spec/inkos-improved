// ── 原创性评分器 ──────────────────────────────────────
// 评估文本的原创性程度

import { TropeDetector, type TropeDetectionResult } from "./trope-detector.js";

/**
 * 原创性评分结果
 */
export interface OriginalityResult {
  score: number; // 0-100
  tropeResult: TropeDetectionResult;
  innovation: number; // 0-1
  suggestions: string[];
}

/**
 * 原创性评分器
 */
export class OriginalityScorer {
  private detector: TropeDetector;

  constructor() {
    this.detector = new TropeDetector();
  }

  /**
   * 评分文本原创性
   */
  score(text: string, genre: string): OriginalityResult {
    // 1. 检测套路
    const tropeResult = this.detector.detect(text);

    // 2. 评估创新程度
    const innovation = this.evaluateInnovation(text, genre);

    // 3. 计算综合分数
    const score = this.calculateScore(tropeResult, innovation);

    return {
      score,
      tropeResult,
      innovation,
      suggestions: this.generateImprovementSuggestions(score, tropeResult),
    };
  }

  /**
   * 评估创新程度
   */
  private evaluateInnovation(text: string, genre: string): number {
    let innovation = 0.5; // 基础分

    // 1. 检查独特表达
    const uniqueExpressions = this.findUniqueExpressions(text);
    innovation += uniqueExpressions * 0.1;

    // 2. 检查意外转折
    const unexpectedTwists = this.findUnexpectedTwists(text);
    innovation += unexpectedTwists * 0.15;

    // 3. 检查深度描写
    const deepDescription = this.evaluateDeepDescription(text);
    innovation += deepDescription * 0.1;

    // 4. 检查情感复杂度
    const emotionalComplexity = this.evaluateEmotionalComplexity(text);
    innovation += emotionalComplexity * 0.15;

    return Math.min(1, innovation);
  }

  /**
   * 查找独特表达
   */
  private findUniqueExpressions(text: string): number {
    // 简化实现：检查是否有不常见的词汇组合
    const commonPatterns = ["他走了", "她笑了", "天很蓝", "风很大"];
    let uniqueCount = 0;

    for (const pattern of commonPatterns) {
      if (!text.includes(pattern)) {
        uniqueCount++;
      }
    }

    return uniqueCount / commonPatterns.length;
  }

  /**
   * 查找意外转折
   */
  private findUnexpectedTwists(text: string): number {
    // 简化实现：检查是否有转折词
    const twistMarkers = ["然而", "却", "没想到", "意外的是", "反转"];
    let twistCount = 0;

    for (const marker of twistMarkers) {
      if (text.includes(marker)) {
        twistCount++;
      }
    }

    return Math.min(1, twistCount * 0.3);
  }

  /**
   * 评估深度描写
   */
  private evaluateDeepDescription(text: string): number {
    // 检查五感描写
    const sensoryWords = ["看", "听", "闻", "摸", "尝"];
    let sensoryCount = 0;

    for (const word of sensoryWords) {
      if (text.includes(word)) {
        sensoryCount++;
      }
    }

    return Math.min(1, sensoryCount * 0.2);
  }

  /**
   * 评估情感复杂度
   */
  private evaluateEmotionalComplexity(text: string): number {
    // 检查复杂情感词汇
    const complexEmotions = ["苦乐参半", "五味杂陈", "百感交集", "哭笑不得"];
    let complexCount = 0;

    for (const emotion of complexEmotions) {
      if (text.includes(emotion)) {
        complexCount++;
      }
    }

    return Math.min(1, complexCount * 0.3);
  }

  /**
   * 计算综合分数
   */
  private calculateScore(tropeResult: TropeDetectionResult, innovation: number): number {
    // 原创性 = (1 - 套路使用率) * 50 + 创新度 * 50
    const tropeScore = tropeResult.overallOriginality * 50;
    const innovationScore = innovation * 50;

    return Math.round(tropeScore + innovationScore);
  }

  /**
   * 生成改进建议
   */
  private generateImprovementSuggestions(score: number, tropeResult: TropeDetectionResult): string[] {
    const suggestions: string[] = [];

    if (score < 60) {
      suggestions.push("原创性较低，建议减少常见套路的使用");
    }

    if (tropeResult.tropes.length > 3) {
      suggestions.push("检测到多个套路，建议选择性保留或创新");
    }

    suggestions.push(...tropeResult.suggestions);

    return suggestions;
  }
}
