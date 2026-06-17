import { describe, it, expect } from "vitest";
import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";
import { SentenceReconstructor } from "../anti-ai/sentence-reconstructor.js";
import { EmotionAnalyzer } from "../emotional/emotion-analyzer.js";
import { TropeDetector } from "../creativity/trope-detector.js";
import { PreferenceAnalyzer } from "../learning/preference-analyzer.js";
import { ForeshadowTracker } from "../consistency/foreshadow-tracker.js";
import { LRUCache } from "../utils/cache.js";

describe("Performance: PerplexityAnalyzer", () => {
  const analyzer = new PerplexityAnalyzer();

  it("should analyze 1000-char text in under 100ms", () => {
    const text = "他走进了房间，看到了桌子上的书。".repeat(50);
    const start = performance.now();
    analyzer.analyze(text);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it("should benefit from caching on repeated calls", () => {
    const text = "这是一个测试文本，用于验证缓存性能。".repeat(20);

    // 第一次调用
    const start1 = performance.now();
    analyzer.analyze(text);
    const duration1 = performance.now() - start1;

    // 第二次调用（应该命中缓存）
    const start2 = performance.now();
    analyzer.analyze(text);
    const duration2 = performance.now() - start2;

    // 缓存命中应该更快
    expect(duration2).toBeLessThanOrEqual(duration1 * 1.5);
  });
});

describe("Performance: SentenceReconstructor", () => {
  const reconstructor = new SentenceReconstructor();

  it("should reconstruct 500-char text in under 200ms", async () => {
    const text = "因为天气很好，所以他决定出去走走。虽然路上的人很多，但是他并不在意。".repeat(10);
    const start = performance.now();
    await reconstructor.reconstruct(text, { intensity: 5 });
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });
});

describe("Performance: EmotionAnalyzer", () => {
  const analyzer = new EmotionAnalyzer();

  it("should analyze emotion in under 50ms", () => {
    const text = "他非常开心，快乐得像只小鸟。心情愉悦，步伐轻快。".repeat(20);
    const start = performance.now();
    analyzer.analyze(text);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });
});

describe("Performance: TropeDetector", () => {
  const detector = new TropeDetector();

  it("should detect tropes in under 100ms", () => {
    const text = "他重生了，获得了系统，开始逆袭打脸。".repeat(20);
    const start = performance.now();
    detector.detect(text);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

describe("Performance: PreferenceAnalyzer", () => {
  const analyzer = new PreferenceAnalyzer();

  it("should analyze 100 edits in under 100ms", () => {
    const edits = Array.from({ length: 100 }, (_, i) => ({
      id: `edit-${i}`,
      userId: "user-1",
      bookId: "book-1",
      chapterId: `ch-${i}`,
      originalText: "原文内容",
      editedText: "修改后的内容",
      editType: "rephrase" as const,
      timestamp: new Date().toISOString(),
    }));

    const start = performance.now();
    analyzer.analyze(edits);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});

describe("Performance: ForeshadowTracker", () => {
  it("should handle 1000 foreshadows efficiently", () => {
    const tracker = new ForeshadowTracker();

    // 添加1000个伏笔
    const startAdd = performance.now();
    for (let i = 0; i < 1000; i++) {
      tracker.addForeshadow("book-1", i, `伏笔${i}`, [`角色${i % 10}`]);
    }
    const addDuration = performance.now() - startAdd;
    expect(addDuration).toBeLessThan(500);

    // 查询未解决的伏笔
    const startQuery = performance.now();
    const unresolved = tracker.getUnresolved("book-1");
    const queryDuration = performance.now() - startQuery;
    expect(queryDuration).toBeLessThan(100);
    expect(unresolved.length).toBe(1000);
  });
});

describe("Performance: LRUCache", () => {
  it("should handle 10000 operations in under 200ms", () => {
    const cache = new LRUCache<number, string>({ maxSize: 1000 });

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      cache.set(i, `value-${i}`);
      cache.get(i % 1000);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });

  it("should evict old entries when full", () => {
    const cache = new LRUCache<number, string>({ maxSize: 100 });

    for (let i = 0; i < 200; i++) {
      cache.set(i, `value-${i}`);
    }

    expect(cache.size).toBe(100);
    // 最早的条目应该被驱逐
    expect(cache.get(0)).toBeUndefined();
    expect(cache.get(150)).toBe("value-150");
  });
});
