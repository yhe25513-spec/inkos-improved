// ── 文体适配器 ────────────────────────────────────────
// 根据不同文体调整去AI味策略

export type GenreType = "xuanhuan" | "urban" | "romance" | "mystery" | "general";

export interface GenreAdapterConfig {
  /** 高频词替换强度 0-1 */
  replacementIntensity: number;
  /** 允许的语气词 */
  allowedInterjections: string[];
  /** 文体特征词汇 */
  characteristicWords: string[];
  /** 需要避免的词汇 */
  avoidedWords: string[];
  /** 句式偏好 */
  sentencePreference: {
    /** 短句比例 0-1 */
    shortSentenceRatio: number;
    /** 长句最大长度 */
    maxLongSentenceLength: number;
  };
}

/**
 * 文体适配器
 */
export class GenreAdapter {
  private configs: Record<GenreType, GenreAdapterConfig> = {
    xuanhuan: {
      replacementIntensity: 0.6,
      allowedInterjections: ["嘿", "哈", "喝"],
      characteristicWords: ["气势", "威压", "灵力", "修为", "功法", "意境"],
      avoidedWords: ["OK", "搞定", "溜了", "贼"],
      sentencePreference: {
        shortSentenceRatio: 0.4,
        maxLongSentenceLength: 45,
      },
    },
    urban: {
      replacementIntensity: 0.8,
      allowedInterjections: ["嗯", "啊", "呢", "嘛", "吧", "哦"],
      characteristicWords: ["手机", "公司", "咖啡", "地铁", "加班"],
      avoidedWords: ["修仙", "灵气", "丹田"],
      sentencePreference: {
        shortSentenceRatio: 0.6,
        maxLongSentenceLength: 35,
      },
    },
    romance: {
      replacementIntensity: 0.7,
      allowedInterjections: ["嗯", "呀", "啦", "哦", "嘻"],
      characteristicWords: ["心跳", "脸红", "温暖", "眼神", "温柔"],
      avoidedWords: ["战斗", "杀", "血"],
      sentencePreference: {
        shortSentenceRatio: 0.5,
        maxLongSentenceLength: 35,
      },
    },
    mystery: {
      replacementIntensity: 0.5,
      allowedInterjections: ["咦", "嗯"],
      characteristicWords: ["线索", "证据", "推理", "真相", "疑点"],
      avoidedWords: ["搞笑", "欢乐", "沙雕"],
      sentencePreference: {
        shortSentenceRatio: 0.5,
        maxLongSentenceLength: 40,
      },
    },
    general: {
      replacementIntensity: 0.6,
      allowedInterjections: ["嗯", "啊", "呢", "吧"],
      characteristicWords: [],
      avoidedWords: [],
      sentencePreference: {
        shortSentenceRatio: 0.5,
        maxLongSentenceLength: 40,
      },
    },
  };

  getConfig(genre: GenreType): GenreAdapterConfig {
    return this.configs[genre] ?? this.configs.general;
  }

  /**
   * 根据文体过滤不适合的词汇
   */
  filterByGenre(text: string, genre: GenreType): string {
    const config = this.getConfig(genre);

    let result = text;
    for (const word of config.avoidedWords) {
      const regex = new RegExp(word, "g");
      if (regex.test(result)) {
        // 不直接删除，而是在日志中标记
        // 实际处理需要人工确认
        console.warn(`[anti-ai] 文体"${genre}"中发现需避免的词汇: "${word}"`);
      }
    }

    return result;
  }
}
