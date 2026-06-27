// ── 偏好分析器 ────────────────────────────────────────
// 分析用户的编辑记录，提取写作风格偏好

import type {
  UserEdit,
  WritingPreference,
  StylePreference,
  SentencePreference,
  VocabularyPreference,
  EmotionPreference,
  NarrativePreference,
  WordEntry,
} from "./types.js";

/**
 * 偏好分析器
 * 从用户的编辑历史中学习写作风格偏好
 */
export class PreferenceAnalyzer {
  /**
   * 分析编辑记录，生成写作风格偏好
   */
  analyze(edits: UserEdit[]): WritingPreference {
    if (edits.length < 3) {
      return this.getDefaultPreference();
    }

    return {
      style: this.analyzeStyle(edits),
      sentence: this.analyzeSentence(edits),
      vocabulary: this.analyzeVocabulary(edits),
      emotion: this.analyzeEmotion(edits),
      narrative: this.analyzeNarrative(edits),
      meta: {
        sampleSize: edits.length,
        lastUpdated: new Date().toISOString(),
        confidence: this.calculateConfidence(edits.length),
        version: 1,
      },
    };
  }

  /**
   * 分析风格偏好
   */
  private analyzeStyle(edits: UserEdit[]): StylePreference {
    let formality = 0.5;
    let literaryLevel = 0.5;

    // 各维度关键词定义
    const humorKeywords = ["哈哈", "笑了", "调侃", "滑稽", "有趣", "好笑", "苦笑", "自嘲"];
    const darknessKeywords = ["血", "死", "尸体", "黑暗", "恐惧", "绝望", "残忍", "阴沉", "冰冷"];
    const romanceKeywords = ["爱", "喜欢", "心动", "吻", "拥抱", "温柔", "暧昧", "脸红"];
    const actionKeywords = ["打", "冲", "劈", "射", "踢", "撞", "挥", "斩", "爆"];

    for (const edit of edits) {
      // 润色操作 = 提升文学性
      if (edit.editType === "polish") {
        literaryLevel += 0.03;
      }

      // 语气调整 = 检测正式度变化
      if (edit.editType === "tone-shift") {
        const formalWords = ["您", "请", "谢谢", "抱歉"];
        const casualWords = ["你", "嘿", "哈哈", "哎", "嘛"];

        const addedText = edit.editedText;
        const hasFormal = formalWords.some((w) => addedText.includes(w));
        const hasCasual = casualWords.some((w) => addedText.includes(w));

        if (hasFormal) formality += 0.08;
        if (hasCasual) formality -= 0.08;
      }

      // 重写操作 = 检测风格变化
      if (edit.editType === "rewrite") {
        const originalComplexity = this.measureComplexity(edit.originalText);
        const editedComplexity = this.measureComplexity(edit.editedText);

        if (editedComplexity > originalComplexity) {
          literaryLevel += 0.02;
        } else {
          literaryLevel -= 0.02;
        }
      }
    }

    // 合并所有编辑后文本，计算各维度关键词密度
    const combinedEditedText = edits.map((e) => e.editedText).join("");
    const humor = this.calculateKeywordDensity(combinedEditedText, humorKeywords);
    const darkness = this.calculateKeywordDensity(combinedEditedText, darknessKeywords);
    const romance = this.calculateKeywordDensity(combinedEditedText, romanceKeywords);
    const action = this.calculateKeywordDensity(combinedEditedText, actionKeywords);

    return {
      formality: this.clamp(formality),
      literaryLevel: this.clamp(literaryLevel),
      humor: this.clamp(humor),
      darkness: this.clamp(darkness),
      romance: this.clamp(romance),
      action: this.clamp(action),
    };
  }

  /**
   * 分析句式偏好
   */
  private analyzeSentence(edits: UserEdit[]): SentencePreference {
    let totalLengthChange = 0;
    let shortSentencePreference = 0;
    let count = 0;

    for (const edit of edits) {
      const originalSentences = this.splitSentences(edit.originalText);
      const editedSentences = this.splitSentences(edit.editedText);

      const originalAvg = this.avgLength(originalSentences);
      const editedAvg = this.avgLength(editedSentences);

      totalLengthChange += editedAvg - originalAvg;

      // 用户倾向于缩短句子
      if (editedAvg < originalAvg - 3) {
        shortSentencePreference += 0.1;
      }
      count++;
    }

    const avgLengthChange = count > 0 ? totalLengthChange / count : 0;

    // 合并所有编辑后文本，计算长句比例和段落长度
    const combinedEditedText = edits.map((e) => e.editedText).join("\n\n");

    // 长句比例：按 [。！？；\n] 分句，统计 >40 字句子的比例
    const allSentences = combinedEditedText
      .split(/[。！？；\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const longSentenceCount = allSentences.filter((s) => s.length > 40).length;
    const longSentenceRatio =
      allSentences.length > 0 ? longSentenceCount / allSentences.length : 0;

    // 段落长度：按 \n\n+ 分段，统计平均段落字数
    const paragraphs = combinedEditedText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const totalParagraphChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
    const paragraphLength =
      paragraphs.length > 0 ? totalParagraphChars / paragraphs.length : 0;

    return {
      avgLength: Math.max(10, 25 - avgLengthChange),
      shortSentenceRatio: this.clamp(0.3 + shortSentencePreference),
      longSentenceRatio: this.clamp(longSentenceRatio),
      paragraphLength: Math.round(paragraphLength),
      useExclamation: 0.3,
      useEllipsis: 0.2,
    };
  }

  /**
   * 分析词汇偏好
   */
  private analyzeVocabulary(edits: UserEdit[]): VocabularyPreference {
    const preferredWords = new Map<string, number>();
    const avoidedWords = new Map<string, number>();

    for (const edit of edits) {
      const originalWords = this.tokenize(edit.originalText);
      const editedWords = this.tokenize(edit.editedText);

      // 用户添加的词 = 偏好
      for (const word of editedWords) {
        if (!originalWords.includes(word) && word.length > 1) {
          preferredWords.set(word, (preferredWords.get(word) || 0) + 1);
        }
      }

      // 用户删除的词 = 避免
      for (const word of originalWords) {
        if (!editedWords.includes(word) && word.length > 1) {
          avoidedWords.set(word, (avoidedWords.get(word) || 0) + 1);
        }
      }
    }

    return {
      preferredWords: this.sortAndLimit(preferredWords, 20),
      avoidedWords: this.sortAndLimit(avoidedWords, 20),
      wordPairs: this.extractWordPairs(edits),
    };
  }

  /**
   * 分析情感偏好
   */
  private analyzeEmotion(edits: UserEdit[]): EmotionPreference {
    let intensity = 0.5;
    let directness = 0.5;

    const strongWords = ["怒", "悲", "狂", "激动", "兴奋", "绝望", "愤怒", "狂喜"];
    const subtleWords = ["微微", "轻轻", "淡淡", "似乎", "仿佛", "隐约", "若隐若现"];

    for (const edit of edits) {
      const addedText = edit.editedText;

      if (strongWords.some((w) => addedText.includes(w))) {
        intensity += 0.08;
      }
      if (subtleWords.some((w) => addedText.includes(w))) {
        intensity -= 0.04;
        directness -= 0.04;
      }
    }

    return {
      intensity: this.clamp(intensity),
      directness: this.clamp(directness),
      subtlety: 1 - this.clamp(directness),
      preferredEmotions: [],
      avoidedEmotions: [],
    };
  }

  /**
   * 分析叙事偏好
   */
  private analyzeNarrative(edits: UserEdit[]): NarrativePreference {
    let dialogueRatio = 0.3;
    let innerMonologue = 0.3;

    for (const edit of edits) {
      const text = edit.editedText;
      const dialogueMarkers = (text.match(/[""「」]/g) || []).length;
      const totalChars = text.length;

      if (totalChars > 0) {
        dialogueRatio += (dialogueMarkers / totalChars) * 10;
      }
    }

    return {
      viewpoint: "third-limited",
      tense: "past",
      innerMonologue: this.clamp(innerMonologue),
      dialogueRatio: this.clamp(dialogueRatio),
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < 10) return 0.3;
    if (sampleSize < 30) return 0.5;
    if (sampleSize < 50) return 0.7;
    if (sampleSize < 100) return 0.85;
    return 0.95;
  }

  /**
   * 获取默认偏好
   */
  getDefaultPreference(): WritingPreference {
    return {
      style: {
        formality: 0.5,
        literaryLevel: 0.5,
        humor: 0.5,
        darkness: 0.5,
        romance: 0.5,
        action: 0.5,
      },
      sentence: {
        avgLength: 25,
        shortSentenceRatio: 0.3,
        longSentenceRatio: 0.2,
        paragraphLength: 100,
        useExclamation: 0.3,
        useEllipsis: 0.2,
      },
      vocabulary: {
        preferredWords: [],
        avoidedWords: [],
        wordPairs: [],
      },
      emotion: {
        intensity: 0.5,
        directness: 0.5,
        subtlety: 0.5,
        preferredEmotions: [],
        avoidedEmotions: [],
      },
      narrative: {
        viewpoint: "third-limited",
        tense: "past",
        innerMonologue: 0.3,
        dialogueRatio: 0.3,
      },
      meta: {
        sampleSize: 0,
        lastUpdated: new Date().toISOString(),
        confidence: 0,
        version: 0,
      },
    };
  }

  // ── 工具方法 ──

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[。！？.!?])\s*/)
      .filter((s) => s.trim().length > 0);
  }

  private avgLength(sentences: string[]): number {
    if (sentences.length === 0) return 0;
    return sentences.reduce((a, b) => a + b.length, 0) / sentences.length;
  }

  private tokenize(text: string): string[] {
    return text.match(/[一-龥a-zA-Z]{2,}|\d+/g) || [];
  }

  private measureComplexity(text: string): number {
    // 简单的复杂度衡量：平均句长 + 词汇丰富度
    const sentences = this.splitSentences(text);
    const avgLen = this.avgLength(sentences);
    const words = this.tokenize(text);
    const uniqueWords = new Set(words);
    const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 0;
    return avgLen * 0.5 + lexicalDiversity * 50;
  }

  private sortAndLimit(map: Map<string, number>, limit: number): WordEntry[] {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, freq]) => ({
        word,
        frequency: freq,
        preferenceScore: freq > 3 ? 1 : freq > 1 ? 0.5 : 0,
      }));
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * 计算关键词密度分数
   * 每千字 1 次出现映射到 0.1，结果 clamp 到 [0, 1]
   */
  private calculateKeywordDensity(text: string, keywords: string[]): number {
    if (text.length === 0) return 0;
    let count = 0;
    for (const keyword of keywords) {
      // 统计每个关键词在文本中出现的次数
      let idx = 0;
      while ((idx = text.indexOf(keyword, idx)) !== -1) {
        count++;
        idx += keyword.length;
      }
    }
    // 每千字 1 次映射到 0.1
    const density = (count * 1000) / text.length * 0.1;
    return this.clamp(density);
  }

  /**
   * 提取双字词组
   * 对每个编辑的 editedText 用 2 字滑窗提取所有双字词组，
   * 统计频率取 top-10，过滤掉包含标点/空格的词组
   */
  private extractWordPairs(edits: UserEdit[]): string[][] {
    const pairFreq = new Map<string, number>();
    // 标点与空白字符，用于过滤
    const invalidChar = /[，。！？；：、""''「」（）()【】《》\s,.\!?;:\-—…]/;

    for (const edit of edits) {
      const text = edit.editedText;
      // 用 2 字滑窗提取所有双字词组
      for (let i = 0; i < text.length - 1; i++) {
        const pair = text.substring(i, i + 2);
        // 过滤掉包含标点/空格的词组
        if (invalidChar.test(pair)) continue;
        pairFreq.set(pair, (pairFreq.get(pair) || 0) + 1);
      }
    }

    // 按频率排序，取 top-10
    return Array.from(pairFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pair]) => [pair, "positive"]);
  }
}
