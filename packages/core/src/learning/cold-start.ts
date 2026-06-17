// ── 冷启动策略 ────────────────────────────────────────
// 为新用户提供基于小说类型的默认偏好

import type { WritingPreference, StylePreference, SentencePreference } from "./types.js";

/**
 * 冷启动处理器
 * 根据小说类型提供合理的默认偏好
 */
export class ColdStartHandler {
  /**
   * 获取类型默认偏好
   */
  getGenreDefault(genre: string): Partial<WritingPreference> {
    const defaults: Record<string, Partial<WritingPreference>> = {
      xuanhuan: {
        style: {
          formality: 0.6,
          literaryLevel: 0.7,
          humor: 0.3,
          darkness: 0.4,
          romance: 0.2,
          action: 0.8,
        },
        sentence: {
          avgLength: 28,
          shortSentenceRatio: 0.3,
          longSentenceRatio: 0.3,
          paragraphLength: 120,
          useExclamation: 0.4,
          useEllipsis: 0.2,
        },
      },
      urban: {
        style: {
          formality: 0.4,
          literaryLevel: 0.4,
          humor: 0.6,
          darkness: 0.2,
          romance: 0.5,
          action: 0.3,
        },
        sentence: {
          avgLength: 22,
          shortSentenceRatio: 0.5,
          longSentenceRatio: 0.1,
          paragraphLength: 80,
          useExclamation: 0.5,
          useEllipsis: 0.4,
        },
      },
      romance: {
        style: {
          formality: 0.5,
          literaryLevel: 0.6,
          humor: 0.3,
          darkness: 0.2,
          romance: 0.9,
          action: 0.1,
        },
        sentence: {
          avgLength: 25,
          shortSentenceRatio: 0.4,
          longSentenceRatio: 0.2,
          paragraphLength: 100,
          useExclamation: 0.3,
          useEllipsis: 0.5,
        },
      },
      mystery: {
        style: {
          formality: 0.5,
          literaryLevel: 0.5,
          humor: 0.1,
          darkness: 0.7,
          romance: 0.1,
          action: 0.6,
        },
        sentence: {
          avgLength: 20,
          shortSentenceRatio: 0.6,
          longSentenceRatio: 0.1,
          paragraphLength: 70,
          useExclamation: 0.2,
          useEllipsis: 0.3,
        },
      },
      general: {
        style: {
          formality: 0.5,
          literaryLevel: 0.5,
          humor: 0.4,
          darkness: 0.4,
          romance: 0.4,
          action: 0.4,
        },
        sentence: {
          avgLength: 24,
          shortSentenceRatio: 0.4,
          longSentenceRatio: 0.2,
          paragraphLength: 90,
          useExclamation: 0.3,
          useEllipsis: 0.3,
        },
      },
    };

    return defaults[genre] ?? defaults.general;
  }

  /**
   * 合并默认偏好和用户偏好
   */
  mergeWithDefaults(partial: Partial<WritingPreference>, genre: string = "general"): WritingPreference {
    const defaults = this.getGenreDefault(genre);

    return {
      style: { ...this.getDefaultStyle(), ...defaults.style, ...partial.style },
      sentence: { ...this.getDefaultSentence(), ...defaults.sentence, ...partial.sentence },
      vocabulary: partial.vocabulary ?? { preferredWords: [], avoidedWords: [], wordPairs: [] },
      emotion: partial.emotion ?? {
        intensity: 0.5,
        directness: 0.5,
        subtlety: 0.5,
        preferredEmotions: [],
        avoidedEmotions: [],
      },
      narrative: partial.narrative ?? {
        viewpoint: "third-limited",
        tense: "past",
        innerMonologue: 0.3,
        dialogueRatio: 0.3,
      },
      meta: partial.meta ?? {
        sampleSize: 0,
        lastUpdated: new Date().toISOString(),
        confidence: 0.3,
        version: 0,
      },
    };
  }

  private getDefaultStyle(): StylePreference {
    return {
      formality: 0.5,
      literaryLevel: 0.5,
      humor: 0.5,
      darkness: 0.5,
      romance: 0.5,
      action: 0.5,
    };
  }

  private getDefaultSentence(): SentencePreference {
    return {
      avgLength: 25,
      shortSentenceRatio: 0.3,
      longSentenceRatio: 0.2,
      paragraphLength: 100,
      useExclamation: 0.3,
      useEllipsis: 0.2,
    };
  }
}
