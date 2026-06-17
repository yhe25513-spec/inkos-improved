// ── 建议引擎 ──────────────────────────────────────────
// 基于检测结果生成创新建议

import type { TropeDetectionResult } from "./trope-detector.js";

/**
 * 建议类型
 */
export type SuggestionType =
  | "replace-trope"      // 替换套路
  | "add-unique"         // 添加独特元素
  | "deepen-character"   // 深化角色
  | "add-twist"          // 添加转折
  | "enhance-emotion";   // 增强情感

/**
 * 建议
 */
export interface Suggestion {
  type: SuggestionType;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

/**
 * 建议引擎
 */
export class SuggestionEngine {
  /**
   * 生成创新建议
   */
  generateSuggestions(
    tropeResult: TropeDetectionResult,
    text: string,
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 1. 基于套路检测的建议
    if (tropeResult.tropes.length > 0) {
      suggestions.push(...this.generateTropeSuggestions(tropeResult));
    }

    // 2. 基于原创性分数的建议
    if (tropeResult.overallOriginality < 0.5) {
      suggestions.push(this.generateLowOriginalitySuggestion());
    }

    // 3. 基于文本内容的建议
    suggestions.push(...this.generateContentSuggestions(text));

    // 按优先级排序
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 生成套路相关建议
   */
  private generateTropeSuggestions(tropeResult: TropeDetectionResult): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const { trope, confidence } of tropeResult.tropes) {
      if (confidence > 0.5) {
        suggestions.push({
          type: "replace-trope",
          title: `替换"${trope.name}"套路`,
          description: `检测到高置信度的"${trope.name}"套路（${(confidence * 100).toFixed(0)}%）。建议考虑：${trope.alternatives.join("、")}`,
          priority: "high",
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成低原创性建议
   */
  private generateLowOriginalitySuggestion(): Suggestion {
    return {
      type: "add-unique",
      title: "提升原创性",
      description: "当前文本原创性较低。建议添加独特的世界观设定、创新的能力体系或非典型的角色发展路径。",
      priority: "high",
    };
  }

  /**
   * 生成内容相关建议
   */
  private generateContentSuggestions(text: string): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 检查是否有足够的角色深度
    if (!this.hasCharacterDepth(text)) {
      suggestions.push({
        type: "deepen-character",
        title: "深化角色塑造",
        description: "建议为角色添加更多内心独白、背景故事或独特的性格特征，使角色更加立体。",
        priority: "medium",
      });
    }

    // 检查是否有转折
    if (!this.hasTwist(text)) {
      suggestions.push({
        type: "add-twist",
        title: "添加情节转折",
        description: "建议在剧情中添加意外转折，避免平铺直叙，增强读者的阅读兴趣。",
        priority: "medium",
      });
    }

    // 检查情感表达
    if (!this.hasEmotionalDepth(text)) {
      suggestions.push({
        type: "enhance-emotion",
        title: "增强情感表达",
        description: "建议添加更多情感描写，如五感体验、内心活动或环境烘托，增强情感共鸣。",
        priority: "low",
      });
    }

    return suggestions;
  }

  private hasCharacterDepth(text: string): boolean {
    const depthMarkers = ["心里想", "内心", "回忆", "过去", "梦想", "目标"];
    return depthMarkers.some((m) => text.includes(m));
  }

  private hasTwist(text: string): boolean {
    const twistMarkers = ["然而", "却", "没想到", "意外", "反转", "突然"];
    return twistMarkers.some((m) => text.includes(m));
  }

  private hasEmotionalDepth(text: string): boolean {
    const emotionMarkers = ["感觉", "心情", "情绪", "感动", "温暖", "心痛"];
    return emotionMarkers.some((m) => text.includes(m));
  }
}
