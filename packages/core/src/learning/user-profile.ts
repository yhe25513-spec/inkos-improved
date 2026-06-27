// ── 用户画像管理器 ────────────────────────────────────
// 管理用户偏好数据的存储、更新和查询

import type { WritingPreference, WordEntry } from "./types.js";
import { PreferenceAnalyzer } from "./preference-analyzer.js";

/** 持久化存储适配器（可选） */
export interface UserProfileStorage {
  read: () => Promise<Record<string, WritingPreference>>;
  write: (data: Record<string, WritingPreference>) => Promise<void>;
}

/**
 * 用户画像管理器
 * 负责持久化用户偏好，支持平滑更新
 */
export class UserProfileManager {
  private storage: Map<string, WritingPreference> = new Map();
  private analyzer: PreferenceAnalyzer;
  private persistence?: UserProfileStorage;

  constructor(persistence?: UserProfileStorage) {
    this.analyzer = new PreferenceAnalyzer();
    this.persistence = persistence;
  }

  /**
   * 初始化：如果配置了 persistence，从持久化存储加载到内部 Map
   */
  async init(): Promise<void> {
    if (!this.persistence) return;
    try {
      const persisted = await this.persistence.read();
      if (persisted) {
        for (const [key, value] of Object.entries(persisted)) {
          this.storage.set(key, value);
        }
      }
    } catch {
      // 加载失败不影响功能，从空 Map 开始
    }
  }

  /**
   * 获取用户偏好（书籍级 > 全局 > 默认）
   */
  getPreference(userId: string, bookId?: string): WritingPreference {
    // 1. 查找书籍级偏好
    if (bookId) {
      const bookKey = `${userId}:${bookId}`;
      const bookPref = this.storage.get(bookKey);
      if (bookPref) return bookPref;
    }

    // 2. 查找全局偏好
    const globalKey = `${userId}:global`;
    const globalPref = this.storage.get(globalKey);
    if (globalPref) return globalPref;

    // 3. 返回默认偏好
    return this.analyzer.getDefaultPreference();
  }

  /**
   * 更新用户偏好（平滑更新，避免剧烈变化）
   */
  updatePreference(
    userId: string,
    bookId: string | null,
    newPreference: WritingPreference,
    weight: number = 0.3,
  ): WritingPreference {
    const key = bookId ? `${userId}:${bookId}` : `${userId}:global`;
    const existing = this.storage.get(key);

    let result: WritingPreference;
    if (existing) {
      // 平滑更新
      result = this.smoothUpdate(existing, newPreference, weight);
      this.storage.set(key, result);
    } else {
      // 首次设置
      result = newPreference;
      this.storage.set(key, newPreference);
    }

    // 持久化（如果配置了 persistence）
    if (this.persistence) {
      this.persist().catch(() => undefined);
    }

    return result;
  }

  /**
   * 将内部 Map 序列化为 Record 并持久化
   */
  private async persist(): Promise<void> {
    if (!this.persistence) return;
    const record: Record<string, WritingPreference> = {};
    for (const [key, value] of this.storage) {
      record[key] = value;
    }
    await this.persistence.write(record);
  }

  /**
   * 从编辑记录更新偏好
   */
  updateFromEdits(
    userId: string,
    bookId: string,
    edits: Array<{ originalText: string; editedText: string; editType: string }>,
  ): WritingPreference {
    const userEdits = edits.map((e, i) => ({
      id: `batch-${i}`,
      userId,
      bookId,
      chapterId: "batch",
      originalText: e.originalText,
      editedText: e.editedText,
      editType: e.editType as any,
      timestamp: new Date().toISOString(),
    }));

    const newPreference = this.analyzer.analyze(userEdits);
    return this.updatePreference(userId, bookId, newPreference);
  }

  /**
   * 获取学习进度
   */
  getLearningProgress(userId: string, bookId?: string): {
    hasData: boolean;
    confidence: number;
    sampleSize: number;
  } {
    const pref = this.getPreference(userId, bookId);
    return {
      hasData: pref.meta.sampleSize > 0,
      confidence: pref.meta.confidence,
      sampleSize: pref.meta.sampleSize,
    };
  }

  /**
   * 合并全局偏好和书籍偏好
   */
  mergePreferences(
    global: WritingPreference,
    book: WritingPreference,
    bookWeight: number = 0.6,
  ): WritingPreference {
    const globalWeight = 1 - bookWeight;

    return {
      style: {
        formality: this.lerp(global.style.formality, book.style.formality, bookWeight),
        literaryLevel: this.lerp(global.style.literaryLevel, book.style.literaryLevel, bookWeight),
        humor: this.lerp(global.style.humor, book.style.humor, bookWeight),
        darkness: this.lerp(global.style.darkness, book.style.darkness, bookWeight),
        romance: this.lerp(global.style.romance, book.style.romance, bookWeight),
        action: this.lerp(global.style.action, book.style.action, bookWeight),
      },
      sentence: {
        avgLength: this.lerp(global.sentence.avgLength, book.sentence.avgLength, bookWeight),
        shortSentenceRatio: this.lerp(global.sentence.shortSentenceRatio, book.sentence.shortSentenceRatio, bookWeight),
        longSentenceRatio: this.lerp(global.sentence.longSentenceRatio, book.sentence.longSentenceRatio, bookWeight),
        paragraphLength: this.lerp(global.sentence.paragraphLength, book.sentence.paragraphLength, bookWeight),
        useExclamation: this.lerp(global.sentence.useExclamation, book.sentence.useExclamation, bookWeight),
        useEllipsis: this.lerp(global.sentence.useEllipsis, book.sentence.useEllipsis, bookWeight),
      },
      vocabulary: {
        preferredWords: this.mergeWordLists(global.vocabulary.preferredWords, book.vocabulary.preferredWords),
        avoidedWords: this.mergeWordLists(global.vocabulary.avoidedWords, book.vocabulary.avoidedWords),
        wordPairs: book.vocabulary.wordPairs,
      },
      emotion: {
        intensity: this.lerp(global.emotion.intensity, book.emotion.intensity, bookWeight),
        directness: this.lerp(global.emotion.directness, book.emotion.directness, bookWeight),
        subtlety: this.lerp(global.emotion.subtlety, book.emotion.subtlety, bookWeight),
        preferredEmotions: book.emotion.preferredEmotions,
        avoidedEmotions: book.emotion.avoidedEmotions,
      },
      narrative: book.narrative,
      meta: {
        sampleSize: global.meta.sampleSize + book.meta.sampleSize,
        lastUpdated: new Date().toISOString(),
        confidence: Math.max(global.meta.confidence, book.meta.confidence),
        version: Math.max(global.meta.version, book.meta.version) + 1,
      },
    };
  }

  // ── 内部方法 ──

  private smoothUpdate(
    old: WritingPreference,
    newPref: WritingPreference,
    weight: number,
  ): WritingPreference {
    return {
      style: {
        formality: this.lerp(old.style.formality, newPref.style.formality, weight),
        literaryLevel: this.lerp(old.style.literaryLevel, newPref.style.literaryLevel, weight),
        humor: this.lerp(old.style.humor, newPref.style.humor, weight),
        darkness: this.lerp(old.style.darkness, newPref.style.darkness, weight),
        romance: this.lerp(old.style.romance, newPref.style.romance, weight),
        action: this.lerp(old.style.action, newPref.style.action, weight),
      },
      sentence: {
        avgLength: this.lerp(old.sentence.avgLength, newPref.sentence.avgLength, weight),
        shortSentenceRatio: this.lerp(old.sentence.shortSentenceRatio, newPref.sentence.shortSentenceRatio, weight),
        longSentenceRatio: this.lerp(old.sentence.longSentenceRatio, newPref.sentence.longSentenceRatio, weight),
        paragraphLength: this.lerp(old.sentence.paragraphLength, newPref.sentence.paragraphLength, weight),
        useExclamation: this.lerp(old.sentence.useExclamation, newPref.sentence.useExclamation, weight),
        useEllipsis: this.lerp(old.sentence.useEllipsis, newPref.sentence.useEllipsis, weight),
      },
      vocabulary: {
        preferredWords: this.mergeWordLists(old.vocabulary.preferredWords, newPref.vocabulary.preferredWords),
        avoidedWords: this.mergeWordLists(old.vocabulary.avoidedWords, newPref.vocabulary.avoidedWords),
        wordPairs: newPref.vocabulary.wordPairs,
      },
      emotion: {
        intensity: this.lerp(old.emotion.intensity, newPref.emotion.intensity, weight),
        directness: this.lerp(old.emotion.directness, newPref.emotion.directness, weight),
        subtlety: this.lerp(old.emotion.subtlety, newPref.emotion.subtlety, weight),
        preferredEmotions: newPref.emotion.preferredEmotions,
        avoidedEmotions: newPref.emotion.avoidedEmotions,
      },
      narrative: newPref.narrative,
      meta: {
        sampleSize: newPref.meta.sampleSize,
        lastUpdated: new Date().toISOString(),
        confidence: Math.min(1, old.meta.confidence + 0.05),
        version: old.meta.version + 1,
      },
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private mergeWordLists(old: WordEntry[], newWords: WordEntry[]): WordEntry[] {
    const merged = new Map<string, WordEntry>();

    for (const word of old) {
      merged.set(word.word, word);
    }

    for (const word of newWords) {
      const existing = merged.get(word.word);
      if (existing) {
        existing.frequency += word.frequency;
        existing.preferenceScore = Math.max(existing.preferenceScore, word.preferenceScore);
      } else {
        merged.set(word.word, word);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 30);
  }
}
