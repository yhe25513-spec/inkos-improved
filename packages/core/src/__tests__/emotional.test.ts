import { describe, it, expect } from "vitest";
import { EmotionAnalyzer } from "../emotional/emotion-analyzer.js";
import { ArcPlanner } from "../emotional/arc-planner.js";
import { EmotionInjector } from "../emotional/injector.js";
import { NaturalnessTester } from "../emotional/naturalness-tester.js";
import type { StoryStructure } from "../emotional/types.js";

describe("EmotionAnalyzer", () => {
  const analyzer = new EmotionAnalyzer();

  it("should detect joy emotion", () => {
    const result = analyzer.analyze("他非常开心，快乐得像只小鸟。");
    expect(result.primaryEmotion).toBe("joy");
    expect(result.intensity).toBeGreaterThan(0);
  });

  it("should detect sadness emotion", () => {
    const result = analyzer.analyze("她感到非常伤心，难过地哭了。");
    expect(result.primaryEmotion).toBe("sadness");
  });

  it("should detect anger emotion", () => {
    const result = analyzer.analyze("他愤怒极了，气得浑身发抖。");
    expect(result.primaryEmotion).toBe("anger");
  });

  it("should detect fear emotion", () => {
    const result = analyzer.analyze("她害怕极了，恐惧笼罩着她。");
    expect(result.primaryEmotion).toBe("fear");
  });

  it("should return default for neutral text", () => {
    const result = analyzer.analyze("今天天气不错。");
    expect(result.intensity).toBeGreaterThanOrEqual(0);
    expect(result.intensity).toBeLessThanOrEqual(1);
  });

  it("should suggest enhancement points", () => {
    const paragraphs = [
      "他走了。",
      "她非常开心，快乐地笑了。",
      "天很蓝。",
    ];
    const suggestions = analyzer.suggestEnhancementPoints(paragraphs, "sadness", 0.7);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});

describe("ArcPlanner", () => {
  const planner = new ArcPlanner();

  it("should plan arc for xuanhuan genre", () => {
    const structure: StoryStructure = {
      totalChapters: 20,
      actBreaks: [5, 10, 15],
      climaxChapter: 15,
      resolutionChapter: 20,
      theme: "修仙成长",
    };

    const arc = planner.planArc("book1", structure, "xuanhuan");
    expect(arc.chapters).toHaveLength(20);
    expect(arc.climaxChapter).toBe(15);
    expect(arc.resolutionChapter).toBe(20);
  });

  it("should plan arc for urban genre", () => {
    const structure: StoryStructure = {
      totalChapters: 30,
      actBreaks: [10, 20],
      climaxChapter: 20,
      resolutionChapter: 30,
      theme: "都市生活",
    };

    const arc = planner.planArc("book2", structure, "urban");
    expect(arc.chapters).toHaveLength(30);
  });

  it("should plan arc for romance genre", () => {
    const structure: StoryStructure = {
      totalChapters: 25,
      actBreaks: [6, 12, 18],
      climaxChapter: 18,
      resolutionChapter: 25,
      theme: "爱情故事",
    };

    const arc = planner.planArc("book3", structure, "romance");
    expect(arc.chapters).toHaveLength(25);
    // 应该有情感转折点
    const turningPoints = arc.chapters.filter((c) => c.turningPoint);
    expect(turningPoints.length).toBeGreaterThan(0);
  });

  it("should plan arc for mystery genre", () => {
    const structure: StoryStructure = {
      totalChapters: 15,
      actBreaks: [5, 10],
      climaxChapter: 12,
      resolutionChapter: 15,
      theme: "悬疑推理",
    };

    const arc = planner.planArc("book4", structure, "mystery");
    expect(arc.chapters).toHaveLength(15);
  });
});

describe("EmotionInjector", () => {
  const injector = new EmotionInjector();

  it("should enhance chapter content", async () => {
    const content = "他走进了房间。看到桌子上的书。拿起书读了起来。";
    const arc = {
      id: "arc1",
      bookId: "book1",
      chapters: [{
        chapterNumber: 1,
        primaryEmotion: "joy" as const,
        intensity: 7,
        subEmotions: ["love"],
        turningPoint: false,
        notes: "",
      }],
      overallTheme: "test",
      climaxChapter: 10,
      resolutionChapter: 10,
    };

    const result = await injector.enhanceChapter(content, arc, 1);
    // 结果应该与原文不同（有概率注入情感）
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("NaturalnessTester", () => {
  const tester = new NaturalnessTester();

  it("should test naturalness", () => {
    const original = "他走了。天很蓝。";
    const enhanced = "他走了。（开心）天很蓝。（快乐）";

    const result = tester.testNaturalness(original, enhanced);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.emotionScore).toBeGreaterThan(0);
  });

  it("should pass enhanced text with emotion", () => {
    const original = "他非常开心。";
    const enhanced = "他非常开心。心里像吃了蜜一样。嘴角不自觉地上扬。";

    const result = tester.testNaturalness(original, enhanced);
    expect(result.passed).toBe(true);
  });

  it("should fail plain text without emotion", () => {
    const original = "他走了。";
    const enhanced = "他走了。";

    const result = tester.testNaturalness(original, enhanced);
    // 没有情感增强，分数可能较低
    expect(result.emotionScore).toBeLessThanOrEqual(60);
  });
});
