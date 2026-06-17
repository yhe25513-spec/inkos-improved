// ── 词汇多样性增强器 ──────────────────────────────────
// 增强文本的词汇多样性，避免重复用词

/**
 * 词汇多样性增强器
 */
export class VocabularyEnhancer {
  /**
   * 增强词汇多样性
   */
  enhanceVocabulary(text: string): string {
    const words = this.tokenize(text);
    const wordFreq = this.calculateWordFrequency(words);

    // 找出高频词
    const highFreqWords = Object.entries(wordFreq)
      .filter(([word, freq]) => freq > 3 && word.length > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let result = text;

    for (const [word, freq] of highFreqWords) {
      const synonyms = this.getSynonyms(word);
      if (synonyms.length > 0) {
        // 随机替换一部分
        const replaceCount = Math.min(3, Math.floor(freq * 0.3));
        for (let i = 0; i < replaceCount; i++) {
          const regex = new RegExp(word, "g");
          const matches = result.match(regex);
          if (matches && matches.length > 0) {
            const randomIndex = Math.floor(Math.random() * matches.length);
            const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
            // 只替换第一个匹配
            result = result.replace(word, synonym);
          }
        }
      }
    }

    return result;
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 简单的中文分词
    return text.match(/[一-鿿]+|[a-zA-Z]+|\d+/g) || [];
  }

  /**
   * 计算词频
   */
  private calculateWordFrequency(words: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const word of words) {
      if (word.length > 1) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }
    return freq;
  }

  /**
   * 获取同义词
   */
  private getSynonyms(word: string): string[] {
    const synonymsMap: Record<string, string[]> = {
      // 常见词汇的同义词
      "非常": ["十分", "极其", "相当", "格外"],
      "开心": ["快乐", "高兴", "愉悦", "欣喜"],
      "难过": ["伤心", "悲伤", "忧伤", "心痛"],
      "愤怒": ["生气", "恼火", "气愤", "暴怒"],
      "走": ["离开", "前往", "前行", "离去"],
      "看": ["望", "眺", "凝视", "注视"],
      "说": ["道", "言", "讲", "诉"],
      "想": ["思", "念", "寻思", "琢磨"],
      "好": ["佳", "优", "良", "善"],
      "大": ["巨", "硕", "庞大", "巨大"],
      "小": ["微", "细", "渺小", "细微"],
      "快": ["迅速", "疾", "快速", "敏捷"],
      "慢": ["缓慢", "徐缓", "迟缓", "悠缓"],
      "新": ["崭新", "新颖", "新奇", "新鲜"],
      "旧": ["陈旧", "古老", "往昔", "昔日"],
      "美丽": ["漂亮", "秀丽", "优美", "绚丽"],
      "丑陋": ["难看", "丑恶", "不堪", "丑陋"],
      "聪明": ["机智", "睿智", "智慧", "伶俐"],
      "愚蠢": ["愚笨", "笨拙", "迟钝", "愚昧"],
      "勇敢": ["英勇", "无畏", "勇敢", "勇猛"],
      "害怕": ["恐惧", "畏惧", "胆怯", "惊恐"],
    };

    return synonymsMap[word] || [];
  }

  /**
   * 检查词汇多样性
   */
  checkDiversity(text: string): {
    score: number;
    uniqueWords: number;
    totalWords: number;
    suggestions: string[];
  } {
    const words = this.tokenize(text);
    const uniqueWords = new Set(words.filter((w) => w.length > 1));
    const totalWords = words.filter((w) => w.length > 1).length;

    const score = totalWords > 0 ? uniqueWords.size / totalWords : 0;
    const suggestions: string[] = [];

    if (score < 0.5) {
      suggestions.push("词汇多样性较低，建议使用更多不同的词汇");
    }

    // 检查重复词
    const freq = this.calculateWordFrequency(words);
    const repeatedWords = Object.entries(freq)
      .filter(([word, count]) => count > 5 && word.length > 1)
      .sort((a, b) => b[1] - a[1]);

    for (const [word, count] of repeatedWords.slice(0, 3)) {
      suggestions.push(`"${word}"出现了${count}次，建议使用同义词替换`);
    }

    return {
      score,
      uniqueWords: uniqueWords.size,
      totalWords,
      suggestions,
    };
  }
}
