// ── 用户偏好学习系统类型定义 ──────────────────────────

/** 编辑类型 */
export type EditType =
  | "rewrite"      // 完全重写
  | "rephrase"     // 改写（保留原意）
  | "delete"       // 删除内容
  | "add"          // 添加内容
  | "merge"        // 合并段落
  | "split"        // 拆分段落
  | "polish"       // 润色优化
  | "tone-shift";  // 语气调整

/** 编辑上下文 */
export interface EditContext {
  beforeParagraph?: string;
  afterParagraph?: string;
  sceneType?: "dialogue" | "description" | "action" | "narration";
  characterSpeaking?: string;
}

/** 用户编辑记录 */
export interface UserEdit {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string;
  originalText: string;
  editedText: string;
  editType: EditType;
  timestamp: string;
  context?: EditContext;
}

/** 风格偏好 */
export interface StylePreference {
  formality: number;        // 0-1，正式程度
  literaryLevel: number;    // 0-1，文学性水平
  humor: number;            // 0-1，幽默程度
  darkness: number;         // 0-1，暗黑程度
  romance: number;          // 0-1，浪漫程度
  action: number;           // 0-1，动作描写程度
}

/** 句式偏好 */
export interface SentencePreference {
  avgLength: number;           // 平均句长（字数）
  shortSentenceRatio: number; // 短句（<15字）比例
  longSentenceRatio: number;  // 长句（>40字）比例
  paragraphLength: number;    // 平均段落长度
  useExclamation: number;     // 感叹号使用频率
  useEllipsis: number;        // 省略号使用频率
}

/** 词汇条目 */
export interface WordEntry {
  word: string;
  frequency: number;
  preferenceScore: number;
}

/** 词汇偏好 */
export interface VocabularyPreference {
  preferredWords: WordEntry[];
  avoidedWords: WordEntry[];
  wordPairs: string[][];
}

/** 情感偏好 */
export interface EmotionPreference {
  intensity: number;
  directness: number;
  subtlety: number;
  preferredEmotions: string[];
  avoidedEmotions: string[];
}

/** 叙事偏好 */
export interface NarrativePreference {
  viewpoint: "first" | "third-limited" | "third-omniscient";
  tense: "past" | "present";
  innerMonologue: number;
  dialogueRatio: number;
}

/** 偏好元数据 */
export interface PreferenceMeta {
  sampleSize: number;
  lastUpdated: string;
  confidence: number;
  version: number;
}

/** 写作偏好（完整） */
export interface WritingPreference {
  style: StylePreference;
  sentence: SentencePreference;
  vocabulary: VocabularyPreference;
  emotion: EmotionPreference;
  narrative: NarrativePreference;
  meta: PreferenceMeta;
}

/** 学习历史 */
export interface LearningHistory {
  totalEdits: number;
  milestones: Array<{
    timestamp: string;
    editCount: number;
    confidence: number;
  }>;
}

/** 自然度测试结果 */
export interface NaturalnessResult {
  score: number;
  originalPerplexity: number;
  enhancedPerplexity: number;
  originalBurstiness: number;
  enhancedBurstiness: number;
  emotionScore: number;
  passed: boolean;
}
