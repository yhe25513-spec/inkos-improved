// ── 突发性调整器 ──────────────────────────────────────
// 调整文本的句子长度变化，使其更像人类写作

/**
 * 突发性调整器
 */
export class BurstinessAdjuster {
  /**
   * 计算文本突发性
   */
  calculateBurstiness(text: string): number {
    const sentences = this.splitSentences(text);
    if (sentences.length < 2) return 0.5;

    const lengths = sentences.map((s) => s.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (mean === 0) return 0;

    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    return stdDev / mean;
  }

  /**
   * 调整文本突发性
   */
  adjustBurstiness(
    text: string,
    targetBurstiness: number = 0.6,
  ): string {
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
        if (Math.random() < 0.5) {
          // 变长：添加修饰语或细节
          adjusted.push(this.lengthenSentence(sentence));
        } else {
          // 变短：简化表达
          adjusted.push(this.shortenSentence(sentence));
        }
      } else {
        adjusted.push(sentence);
      }
    }

    return adjusted.join("");
  }

  /**
   * 拆分句子
   */
  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[。！？.!?])\s*/)
      .filter((s) => s.trim().length > 0);
  }

  /**
   * 拉长句子
   */
  private lengthenSentence(sentence: string): string {
    const trimSentence = sentence.trim();

    // 在句号前添加修饰语
    if (trimSentence.endsWith("。")) {
      const modifiers = [
        "，静静地",
        "，慢慢地",
        "，轻轻地",
        "，认真地",
        "，仔细地",
      ];
      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      return trimSentence.slice(0, -1) + modifier + "。";
    }

    return trimSentence;
  }

  /**
   * 缩短句子
   */
  private shortenSentence(sentence: string): string {
    const trimSentence = sentence.trim();

    // 移除一些修饰语
    const patterns = [
      { regex: /非常/g, replacement: "" },
      { regex: /十分/g, replacement: "" },
      { regex: /极其/g, replacement: "" },
      { regex: /相当/g, replacement: "" },
    ];

    let result = trimSentence;
    for (const pattern of patterns) {
      if (Math.random() < 0.3) {
        result = result.replace(pattern.regex, pattern.replacement);
      }
    }

    return result;
  }
}
