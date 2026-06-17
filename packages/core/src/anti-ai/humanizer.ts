// ── 人性化处理器 ──────────────────────────────────────
// 为文本添加人类写作特征

/**
 * 人性化处理器
 */
export class Humanizer {
  /**
   * 人性化处理文本
   */
  humanize(text: string, intensity: number = 0.5): string {
    let result = text;

    // 1. 添加口语化表达
    if (intensity > 0.3) {
      result = this.addColloquialisms(result);
    }

    // 2. 添加轻微不完美
    if (intensity > 0.5) {
      result = this.addImperfections(result);
    }

    // 3. 添加语气词
    if (intensity > 0.7) {
      result = this.addInterjections(result);
    }

    return result;
  }

  /**
   * 添加口语化表达
   */
  private addColloquialisms(text: string): string {
    const colloquialisms = [
      { regex: /他走了/g, replacement: "他走了" },
      { regex: /她笑了/g, replacement: "她笑了" },
      { regex: /非常/g, replacement: "挺" },
      { regex: /十分/g, replacement: "特别" },
    ];

    let result = text;
    for (const { regex, replacement } of colloquialisms) {
      if (Math.random() < 0.2) {
        result = result.replace(regex, replacement);
      }
    }

    return result;
  }

  /**
   * 添加轻微不完美
   */
  private addImperfections(text: string): string {
    const sentences = text.split(/(?<=[。！？])\s*/);
    const result: string[] = [];

    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue;

      // 随机在句子中添加重复词
      if (Math.random() < 0.1) {
        const words = sentence.split("");
        if (words.length > 5) {
          const repeatIndex = Math.floor(Math.random() * (words.length - 2)) + 1;
          words.splice(repeatIndex, 0, words[repeatIndex]);
          result.push(words.join(""));
          continue;
        }
      }

      result.push(sentence);
    }

    return result.join("");
  }

  /**
   * 添加语气词
   */
  private addInterjections(text: string): string {
    const sentences = text.split(/(?<=[。！？])\s*/);
    const result: string[] = [];

    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue;

      // 随机在句末添加语气词
      if (Math.random() < 0.15) {
        const interjections = ["呢", "啊", "吧", "哦", "嘛"];
        const interjection = interjections[Math.floor(Math.random() * interjections.length)];

        if (sentence.endsWith("。")) {
          result.push(sentence.slice(0, -1) + interjection + "。");
          continue;
        }
      }

      result.push(sentence);
    }

    return result.join("");
  }

  /**
   * 检查文本的人性化程度
   */
  checkHumanization(text: string): {
    score: number;
    features: string[];
    suggestions: string[];
  } {
    const features: string[] = [];
    const suggestions: string[] = [];
    let score = 50; // 基础分

    // 检查口语化表达
    const colloquialPatterns = ["挺", "特别", "嘿", "哎", "嘛"];
    for (const pattern of colloquialPatterns) {
      if (text.includes(pattern)) {
        features.push(`包含口语化表达"${pattern}"`);
        score += 5;
      }
    }

    // 检查语气词
    const interjections = ["呢", "啊", "吧", "哦"];
    for (const interjection of interjections) {
      if (text.includes(interjection)) {
        features.push(`包含语气词"${interjection}"`);
        score += 3;
      }
    }

    // 检查句子长度变化
    const sentences = text.split(/(?<=[。！？])\s*/);
    const lengths = sentences.map((s) => s.length).filter((l) => l > 0);
    if (lengths.length > 0) {
      const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 10) {
        features.push("句子长度变化明显");
        score += 10;
      }
    }

    // 生成建议
    if (score < 70) {
      suggestions.push("可以添加更多口语化表达");
      suggestions.push("可以适当添加语气词");
      suggestions.push("可以调整句子长度变化");
    }

    return {
      score: Math.min(100, score),
      features,
      suggestions,
    };
  }
}
