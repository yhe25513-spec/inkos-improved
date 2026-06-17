// ── 情感深度增强类型定义 ──────────────────────────────

/** 基本情感类型 */
export type EmotionType =
  | "joy"           // 快乐
  | "sadness"       // 悲伤
  | "anger"         // 愤怒
  | "fear"          // 恐惧
  | "surprise"      // 惊讶
  | "disgust"       // 厌恶
  | "trust"         // 信任
  | "anticipation"  // 期待
  | "love"          // 爱
  | "hope"          // 希望
  | "despair"       // 绝望
  | "nostalgia"     // 怀旧
  | "excitement"    // 兴奋
  | "tension"       // 紧张
  | "relief"        // 释然
  | "bittersweet";  // 苦乐参半

/** 章节情感信息 */
export interface EmotionalChapter {
  chapterNumber: number;
  primaryEmotion: EmotionType;
  intensity: number;        // 1-10
  subEmotions: EmotionType[];
  turningPoint: boolean;
  notes: string;
}

/** 情感曲线 */
export interface EmotionalArc {
  id: string;
  bookId: string;
  chapters: EmotionalChapter[];
  overallTheme: string;
  climaxChapter: number;
  resolutionChapter: number;
}

/** 故事结构分析 */
export interface StoryStructure {
  totalChapters: number;
  actBreaks: number[];      // 幕间断点
  climaxChapter: number;
  resolutionChapter: number;
  theme: string;
}

/** 情感增强结果 */
export interface EmotionEnhanceResult {
  originalText: string;
  enhancedText: string;
  emotionAdded: EmotionType[];
  intensityChange: number;
}

/** 自然度测试结果 */
export interface NaturalnessResult {
  score: number;              // 0-100
  originalPerplexity: number;
  enhancedPerplexity: number;
  originalBurstiness: number;
  enhancedBurstiness: number;
  emotionScore: number;
  passed: boolean;
}
