import { describe, it, expect, beforeEach } from "vitest";
import { BurstinessAdjuster } from "../anti-ai/burstiness-adjuster.js";
import { Humanizer } from "../anti-ai/humanizer.js";
import { VocabularyEnhancer } from "../anti-ai/vocabulary-enhancer.js";

describe("BurstinessAdjuster", () => {
  let adjuster: BurstinessAdjuster;

  beforeEach(() => {
    adjuster = new BurstinessAdjuster();
  });

  it("calculateBurstiness 返回 0-1 之间的数值", () => {
    const text = "他走进了房间。看到了一本书。他拿起了书，翻开了第一页。窗外下着雨，打湿了窗台。";
    const burstiness = adjuster.calculateBurstiness(text);
    expect(typeof burstiness).toBe("number");
    expect(burstiness).toBeGreaterThanOrEqual(0);
    expect(burstiness).toBeLessThanOrEqual(1);
  });

  it("calculateBurstiness 处理空文本返回 0.5（单句不足）", () => {
    const burstiness = adjuster.calculateBurstiness("");
    expect(burstiness).toBe(0.5);
  });

  it("calculateBurstiness 处理单句文本", () => {
    const burstiness = adjuster.calculateBurstiness("这是一个短句。");
    expect(typeof burstiness).toBe("number");
    expect(burstiness).toBeGreaterThanOrEqual(0);
  });

  it("adjustBurstiness 返回字符串", () => {
    const text = "他走进了房间。他看到了一本书。他拿起了书。他翻开了第一页。";
    const result = adjuster.adjustBurstiness(text, 0.6);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("adjustBurstiness 处理空文本", () => {
    const result = adjuster.adjustBurstiness("");
    expect(typeof result).toBe("string");
  });

  it("adjustBurstiness 使用默认目标值", () => {
    const text = "短句。长句长句长句长句长句长句。短句。";
    const result = adjuster.adjustBurstiness(text);
    expect(typeof result).toBe("string");
  });
});

describe("Humanizer", () => {
  let humanizer: Humanizer;

  beforeEach(() => {
    humanizer = new Humanizer();
  });

  it("humanize 返回字符串", () => {
    const text = "他走进了房间，看到了桌子上的书。他拿起书，翻开了第一页。";
    const result = humanizer.humanize(text);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("humanize 处理不同强度参数", () => {
    const text = "他走进了房间，看到了桌子上的书。";
    const lowIntensity = humanizer.humanize(text, 0.1);
    const highIntensity = humanizer.humanize(text, 0.9);
    expect(typeof lowIntensity).toBe("string");
    expect(typeof highIntensity).toBe("string");
  });

  it("humanize 处理空文本", () => {
    const result = humanizer.humanize("");
    expect(typeof result).toBe("string");
  });

  it("humanize 使用默认强度", () => {
    const text = "他走进了房间。";
    const result = humanizer.humanize(text);
    expect(typeof result).toBe("string");
  });

  it("checkHumanization 返回评分和特征", () => {
    const text = "他走进了房间，看到了桌子上的书。他拿起书，翻开了第一页。";
    const result = humanizer.checkHumanization(text);
    expect(result).toBeDefined();
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.features)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

describe("VocabularyEnhancer", () => {
  let enhancer: VocabularyEnhancer;

  beforeEach(() => {
    enhancer = new VocabularyEnhancer();
  });

  it("enhanceVocabulary 返回字符串", () => {
    const text = "他非常开心。他非常快乐。他非常高兴。";
    const result = enhancer.enhanceVocabulary(text);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("enhanceVocabulary 处理空文本", () => {
    const result = enhancer.enhanceVocabulary("");
    expect(typeof result).toBe("string");
  });

  it("checkDiversity 返回多样性指标", () => {
    const text = "他走进了房间，看到了一本书。他拿起了书，开始阅读。";
    const result = enhancer.checkDiversity(text);
    expect(result).toBeDefined();
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(typeof result.uniqueWords).toBe("number");
    expect(typeof result.totalWords).toBe("number");
    expect(result.uniqueWords).toBeLessThanOrEqual(result.totalWords);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it("checkDiversity 处理重复词汇文本", () => {
    // tokenize 将连续中文字符作为一个词，所以用标点分隔以产生多个词
    const text = "非常。非常。非常。非常。非常。非常。";
    const result = enhancer.checkDiversity(text);
    expect(result.totalWords).toBe(6);
    expect(result.uniqueWords).toBe(1);
    expect(result.score).toBeLessThan(1);
  });
});
