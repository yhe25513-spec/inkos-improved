import { describe, it, expect } from "vitest";
import { TropeDetector } from "../creativity/trope-detector.js";
import { OriginalityScorer } from "../creativity/originality-scorer.js";
import { SuggestionEngine } from "../creativity/suggestion-engine.js";

describe("TropeDetector", () => {
  const detector = new TropeDetector();

  it("should detect rebirth trope", () => {
    const result = detector.detect("他重生回到了十年前，决定改变命运。");
    expect(result.tropes.some((t) => t.trope.id === "rebirth")).toBe(true);
  });

  it("should detect system trope", () => {
    const result = detector.detect("叮！系统激活，获得新手大礼包。");
    expect(result.tropes.some((t) => t.trope.id === "system")).toBe(true);
  });

  it("should detect face-slapping trope", () => {
    const result = detector.detect("那些看不起他的人，现在脸都绿了，目瞪口呆。");
    expect(result.tropes.some((t) => t.trope.id === "face-slapping")).toBe(true);
  });

  it("should return high originality for unique text", () => {
    const result = detector.detect("一个普通的下午，他在咖啡馆里写着代码。");
    expect(result.overallOriginality).toBeGreaterThan(0.8);
  });

  it("should return low originality for trope-heavy text", () => {
    const result = detector.detect("他重生了，获得了系统，开始逆袭打脸。");
    expect(result.overallOriginality).toBeLessThan(0.5);
  });

  it("should generate suggestions for tropes", () => {
    const result = detector.detect("他重生了，获得了系统。");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("should get all tropes", () => {
    const tropes = detector.getAllTropes();
    expect(tropes.length).toBeGreaterThan(0);
  });
});

describe("OriginalityScorer", () => {
  const scorer = new OriginalityScorer();

  it("should score high for unique text", () => {
    const result = scorer.score("一个普通的下午，他在咖啡馆里写着代码，窗外阳光明媚。", "urban");
    expect(result.score).toBeGreaterThan(60);
  });

  it("should score low for trope-heavy text", () => {
    const result = scorer.score("他重生了，获得了系统，开始逆袭打脸。", "xuanhuan");
    expect(result.score).toBeLessThan(60);
  });

  it("should evaluate innovation", () => {
    const result = scorer.score("他没想到，这个意外的转折改变了他的一生。", "general");
    expect(result.innovation).toBeGreaterThan(0);
  });

  it("should generate improvement suggestions", () => {
    const result = scorer.score("他重生了，获得了系统。", "xuanhuan");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe("SuggestionEngine", () => {
  const engine = new SuggestionEngine();

  it("should generate suggestions for trope-heavy text", () => {
    const tropeResult = {
      tropes: [{
        trope: {
          id: "rebirth",
          name: "重生",
          category: "plot" as const,
          description: "主角重生回到过去",
          frequency: 0.7,
          keywords: ["重生"],
          alternatives: ["时间循环"],
        },
        confidence: 0.8,
        location: "他重生了...",
      }],
      overallOriginality: 0.3,
      suggestions: [],
    };

    const suggestions = engine.generateSuggestions(tropeResult, "他重生了。");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.type === "replace-trope")).toBe(true);
  });

  it("should generate suggestions for low originality", () => {
    const tropeResult = {
      tropes: [],
      overallOriginality: 0.2,
      suggestions: [],
    };

    const suggestions = engine.generateSuggestions(tropeResult, "他走了。");
    expect(suggestions.some((s) => s.type === "add-unique")).toBe(true);
  });

  it("should generate content suggestions", () => {
    const tropeResult = {
      tropes: [],
      overallOriginality: 0.8,
      suggestions: [],
    };

    const suggestions = engine.generateSuggestions(tropeResult, "他走了。");
    // 应该有内容相关建议
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
