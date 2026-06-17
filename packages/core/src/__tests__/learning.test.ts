import { describe, it, expect } from "vitest";
import { EditTracker } from "../learning/edit-tracker.js";
import { PreferenceAnalyzer } from "../learning/preference-analyzer.js";
import { UserProfileManager } from "../learning/user-profile.js";
import { PromptEnhancer } from "../learning/prompt-enhancer.js";
import { ColdStartHandler } from "../learning/cold-start.js";
import type { UserEdit, WritingPreference } from "../learning/types.js";

describe("EditTracker", () => {
  it("should classify edits correctly", () => {
    // 删除
    expect(EditTracker.classifyEdit("一些文字", "")).toBe("delete");

    // 添加
    expect(EditTracker.classifyEdit("", "新文字")).toBe("add");

    // 润色（高相似度，小变化）
    expect(EditTracker.classifyEdit("他走了过去", "他走了过去")).toBe("polish");

    // 重写（低相似度 < 30%）
    expect(EditTracker.classifyEdit("今天天气不错。", "夜幕降临城市的霓虹灯开始闪烁。")).toBe("rewrite");
  });

  it("should track edits and trigger batch callback", async () => {
    let batchTriggered = false;
    let batchUserId = "";
    let batchBookId = "";

    const tracker = new EditTracker({ batchSize: 3 });
    tracker.onBatch(async (userId, bookId) => {
      batchTriggered = true;
      batchUserId = userId;
      batchBookId = bookId;
    });

    tracker.trackEdit({
      userId: "user1",
      bookId: "book1",
      chapterId: "ch1",
      originalText: "原文1",
      editedText: "修改1",
      editType: "polish",
    });

    tracker.trackEdit({
      userId: "user1",
      bookId: "book1",
      chapterId: "ch1",
      originalText: "原文2",
      editedText: "修改2",
      editType: "rephrase",
    });

    expect(batchTriggered).toBe(false);

    tracker.trackEdit({
      userId: "user1",
      bookId: "book1",
      chapterId: "ch1",
      originalText: "原文3",
      editedText: "修改3",
      editType: "rewrite",
    });

    // Should trigger batch after 3 edits
    expect(batchTriggered).toBe(true);
    expect(batchUserId).toBe("user1");
    expect(batchBookId).toBe("book1");
  });

  it("should buffer edits when no batch callback", () => {
    const tracker = new EditTracker();

    tracker.trackEdit({
      userId: "user1",
      bookId: "book1",
      chapterId: "ch1",
      originalText: "原文",
      editedText: "修改",
      editType: "polish",
    });

    expect(tracker.getBufferedEdits()).toHaveLength(1);
  });
});

describe("PreferenceAnalyzer", () => {
  const analyzer = new PreferenceAnalyzer();

  it("should return default preference for empty edits", () => {
    const pref = analyzer.analyze([]);
    expect(pref.meta.sampleSize).toBe(0);
    expect(pref.meta.confidence).toBe(0);
    expect(pref.style.formality).toBe(0.5);
  });

  it("should return default preference for few edits", () => {
    // With < 3 edits, returns default preference (sampleSize = 0)
    const pref = analyzer.analyze([
      createEdit("polish", "原文", "修改后"),
    ]);
    expect(pref.meta.sampleSize).toBe(0); // default preference
    expect(pref.meta.confidence).toBe(0);

    // With 3+ edits, should start analyzing
    const pref3 = analyzer.analyze([
      createEdit("polish", "原文1", "修改后1"),
      createEdit("rephrase", "原文2", "修改后2"),
      createEdit("rewrite", "原文3", "修改后3"),
    ]);
    expect(pref3.meta.sampleSize).toBe(3);
    expect(pref3.meta.confidence).toBe(0.3);
  });

  it("should analyze style from tone-shift edits", () => {
    const edits = Array.from({ length: 10 }, () =>
      createEdit("tone-shift", "你去哪？", "您去哪里？"),
    );

    const pref = analyzer.analyze(edits);
    // Formal words should increase formality
    expect(pref.style.formality).toBeGreaterThan(0.5);
  });

  it("should analyze vocabulary preferences", () => {
    const edits = Array.from({ length: 5 }, () =>
      createEdit("rewrite", "他走了。", "他漫步离开了地方。"),
    );

    const pref = analyzer.analyze(edits);
    // "漫步" or "离开" or "地方" should appear in preferred words
    expect(pref.vocabulary.preferredWords.length).toBeGreaterThan(0);
  });

  it("should calculate confidence based on sample size", () => {
    const edits10 = Array.from({ length: 10 }, (_, i) =>
      createEdit("polish", `原文${i}`, `修改${i}`),
    );
    const edits100 = Array.from({ length: 100 }, (_, i) =>
      createEdit("polish", `原文${i}`, `修改${i}`),
    );

    const pref10 = analyzer.analyze(edits10);
    const pref100 = analyzer.analyze(edits100);

    expect(pref100.meta.confidence).toBeGreaterThan(pref10.meta.confidence);
  });
});

describe("UserProfileManager", () => {
  it("should return default preference for new user", () => {
    const manager = new UserProfileManager();
    const pref = manager.getPreference("user1");

    expect(pref.meta.sampleSize).toBe(0);
    expect(pref.style.formality).toBe(0.5);
  });

  it("should return book-specific preference", () => {
    const manager = new UserProfileManager();

    const bookPref: WritingPreference = {
      ...manager.getPreference("user1"),
      style: { ...manager.getPreference("user1").style, formality: 0.8 },
    };

    manager.updatePreference("user1", "book1", bookPref, 1.0);

    expect(manager.getPreference("user1", "book1").style.formality).toBe(0.8);
    // Global should remain default
    expect(manager.getPreference("user1").style.formality).toBe(0.5);
  });

  it("should smooth update preferences", () => {
    const manager = new UserProfileManager();

    const pref1: WritingPreference = {
      ...manager.getPreference("user1"),
      style: { ...manager.getPreference("user1").style, formality: 0.3 },
    };
    manager.updatePreference("user1", null, pref1, 1.0);

    const pref2: WritingPreference = {
      ...manager.getPreference("user1"),
      style: { ...manager.getPreference("user1").style, formality: 0.9 },
    };
    manager.updatePreference("user1", null, pref2, 0.3); // 30% weight

    const result = manager.getPreference("user1");
    // Should be between 0.3 and 0.9, closer to 0.3 (existing)
    expect(result.style.formality).toBeGreaterThan(0.3);
    expect(result.style.formality).toBeLessThan(0.9);
  });

  it("should report learning progress", () => {
    const manager = new UserProfileManager();

    expect(manager.getLearningProgress("user1").hasData).toBe(false);

    manager.updatePreference("user1", "book1", {
      ...manager.getPreference("user1"),
      meta: { ...manager.getPreference("user1").meta, sampleSize: 50, confidence: 0.7 },
    });

    expect(manager.getLearningProgress("user1", "book1").hasData).toBe(true);
    expect(manager.getLearningProgress("user1", "book1").confidence).toBe(0.7);
  });

  it("should merge global and book preferences", () => {
    const manager = new UserProfileManager();

    const global: WritingPreference = {
      ...manager.getPreference("user1"),
      style: { ...manager.getPreference("user1").style, formality: 0.3 },
    };
    const book: WritingPreference = {
      ...manager.getPreference("user1"),
      style: { ...manager.getPreference("user1").style, formality: 0.9 },
    };

    const merged = manager.mergePreferences(global, book, 0.6);
    // 0.3 + (0.9 - 0.3) * 0.6 = 0.3 + 0.36 = 0.66
    expect(merged.style.formality).toBeCloseTo(0.66, 1);
  });
});

describe("PromptEnhancer", () => {
  const enhancer = new PromptEnhancer();

  it("should build enhanced prompt", () => {
    const pref: WritingPreference = {
      style: { formality: 0.2, literaryLevel: 0.7, humor: 0.5, darkness: 0.4, romance: 0.3, action: 0.6 },
      sentence: { avgLength: 22, shortSentenceRatio: 0.5, longSentenceRatio: 0.1, paragraphLength: 80, useExclamation: 0.4, useEllipsis: 0.3 },
      vocabulary: {
        preferredWords: [{ word: "漫步", frequency: 5, preferenceScore: 1 }],
        avoidedWords: [{ word: "然而", frequency: 3, preferenceScore: 1 }],
        wordPairs: [],
      },
      emotion: { intensity: 0.6, directness: 0.4, subtlety: 0.6, preferredEmotions: [], avoidedEmotions: [] },
      narrative: { viewpoint: "third-limited", tense: "past", innerMonologue: 0.3, dialogueRatio: 0.3 },
      meta: { sampleSize: 50, lastUpdated: "", confidence: 0.7, version: 1 },
    };

    const prompt = enhancer.buildEnhancedPrompt("写一个开头", pref, {
      bookGenre: "都市",
      chapterNumber: 1,
      sceneType: "description",
    });

    expect(prompt).toContain("创作要求");
    expect(prompt).toContain("风格指南");
    expect(prompt).toContain("口语化（轻松自然）");
    expect(prompt).toContain("漫步");
    expect(prompt).toContain("然而");
    expect(prompt).toContain("都市");
    expect(prompt).toContain("第1章");
  });
});

describe("ColdStartHandler", () => {
  const handler = new ColdStartHandler();

  it("should return genre-specific defaults", () => {
    const xuanhuan = handler.getGenreDefault("xuanhuan");
    expect(xuanhuan.style?.action).toBe(0.8);
    expect(xuanhuan.sentence?.avgLength).toBe(28);

    const urban = handler.getGenreDefault("urban");
    expect(urban.style?.humor).toBe(0.6);

    const romance = handler.getGenreDefault("romance");
    expect(romance.style?.romance).toBe(0.9);

    const mystery = handler.getGenreDefault("mystery");
    expect(mystery.style?.darkness).toBe(0.7);
  });

  it("should return general defaults for unknown genre", () => {
    const general = handler.getGenreDefault("unknown");
    expect(general.style?.formality).toBe(0.5);
  });

  it("should merge partial with defaults", () => {
    const partial: Partial<WritingPreference> = {
      style: { formality: 0.8, literaryLevel: 0.5, humor: 0.5, darkness: 0.5, romance: 0.5, action: 0.5 },
    };

    const merged = handler.mergeWithDefaults(partial, "urban");
    expect(merged.style.formality).toBe(0.8); // overridden by partial
    // humor: partial has 0.5, urban default has 0.6 → partial takes precedence
    expect(merged.style.humor).toBe(0.5); // from partial
    expect(merged.sentence.avgLength).toBe(22); // from urban default (no partial)
  });
});

// ── Helper ──

function createEdit(type: string, original: string, edited: string): UserEdit {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    userId: "test-user",
    bookId: "test-book",
    chapterId: "test-chapter",
    originalText: original,
    editedText: edited,
    editType: type as UserEdit["editType"],
    timestamp: new Date().toISOString(),
  };
}
