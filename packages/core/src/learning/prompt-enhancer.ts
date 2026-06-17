// ── 提示词增强器 ──────────────────────────────────────
// 将用户偏好转换为风格指南，注入到AI生成提示词中

import type { WritingPreference } from "./types.js";

/**
 * 提示词增强器
 * 根据用户偏好生成个性化的创作提示词
 */
export class PromptEnhancer {
  /**
   * 构建增强后的提示词
   */
  buildEnhancedPrompt(
    basePrompt: string,
    preference: WritingPreference,
    context?: {
      bookGenre?: string;
      chapterNumber?: number;
      sceneType?: "dialogue" | "description" | "action" | "narration";
    },
  ): string {
    const styleGuide = this.generateStyleGuide(preference);
    const contextGuide = context ? this.generateContextGuide(context) : "";

    const parts = [
      "你是一位专业的中文小说作家。请严格按照以下要求创作。",
      "",
      "## 创作要求",
      basePrompt,
      "",
      "## ⚠️ 重要：个人风格指南",
      styleGuide,
    ];

    if (contextGuide) {
      parts.push("");
      parts.push(contextGuide);
    }

    parts.push("");
    parts.push("## 注意事项");
    parts.push("- 严格遵循上述风格指南");
    parts.push("- 使用偏好词汇，避免避免词汇");
    parts.push(`- 句子长度控制在${preference.sentence.avgLength}字左右`);

    if (preference.vocabulary.preferredWords.length > 0) {
      const words = preference.vocabulary.preferredWords.slice(0, 5).map((w) => w.word).join("、");
      parts.push(`- 优先使用: ${words}`);
    }

    if (preference.vocabulary.avoidedWords.length > 0) {
      const words = preference.vocabulary.avoidedWords.slice(0, 5).map((w) => w.word).join("、");
      parts.push(`- 避免使用: ${words}`);
    }

    return parts.join("\n");
  }

  /**
   * 生成风格指南
   */
  public generateStyleGuide(p: WritingPreference): string {
    const lines: string[] = [];

    lines.push("### 语言风格");
    lines.push(`- 正式程度: ${this.getFormalityDesc(p.style.formality)}`);
    lines.push(`- 文学性: ${this.getLiteraryDesc(p.style.literaryLevel)}`);
    lines.push(`- 幽默感: ${this.getHumorDesc(p.style.humor)}`);

    lines.push("");
    lines.push("### 句式要求");
    lines.push(`- 平均句长: ${p.sentence.avgLength}字`);
    lines.push(`- 短句比例: ${(p.sentence.shortSentenceRatio * 100).toFixed(0)}%`);

    if (p.vocabulary.preferredWords.length > 0) {
      lines.push("");
      lines.push("### 偏好用词");
      lines.push(`优先使用: ${p.vocabulary.preferredWords.slice(0, 10).map((w) => w.word).join("、")}`);
    }

    if (p.vocabulary.avoidedWords.length > 0) {
      lines.push("");
      lines.push("### 避免用词");
      lines.push(`不要使用: ${p.vocabulary.avoidedWords.slice(0, 10).map((w) => w.word).join("、")}`);
    }

    lines.push("");
    lines.push("### 情感表达");
    lines.push(`- 强度: ${this.getIntensityDesc(p.emotion.intensity)}`);
    lines.push(`- 方式: ${p.emotion.directness > 0.5 ? "直接表达" : "含蓄委婉"}`);

    return lines.join("\n");
  }

  /**
   * 生成场景上下文指南
   */
  private generateContextGuide(context: {
    bookGenre?: string;
    chapterNumber?: number;
    sceneType?: "dialogue" | "description" | "action" | "narration";
  }): string {
    const lines: string[] = ["## 场景上下文"];

    if (context.bookGenre) {
      lines.push(`- 小说类型: ${context.bookGenre}`);
    }
    if (context.chapterNumber) {
      lines.push(`- 当前章节: 第${context.chapterNumber}章`);
    }
    if (context.sceneType) {
      const sceneDesc: Record<string, string> = {
        dialogue: "对话场景：注重人物语气",
        description: "描写场景：注重视觉细节",
        action: "动作场景：注重节奏感",
        narration: "叙述场景：注重情节推进",
      };
      lines.push(`- 场景类型: ${sceneDesc[context.sceneType] || context.sceneType}`);
    }

    return lines.join("\n");
  }

  // ── 描述生成 ──

  private getFormalityDesc(value: number): string {
    if (value < 0.3) return "口语化（轻松自然）";
    if (value < 0.6) return "适中（平衡自然）";
    return "书面语（正式严谨）";
  }

  private getLiteraryDesc(value: number): string {
    if (value < 0.3) return "简洁直白";
    if (value < 0.6) return "适度修饰";
    return "文学性强（辞藻华丽）";
  }

  private getHumorDesc(value: number): string {
    if (value < 0.3) return "严肃认真";
    if (value < 0.6) return "适度幽默";
    return "轻松诙谐";
  }

  private getIntensityDesc(value: number): string {
    if (value < 0.3) return "平静克制";
    if (value < 0.6) return "适度表达";
    return "情感充沛";
  }
}
