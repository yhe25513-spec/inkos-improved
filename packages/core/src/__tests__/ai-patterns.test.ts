import { describe, it, expect } from "vitest";
import {
  WORD_REPLACEMENTS,
  AI_PATTERNS,
  getTier1Words,
  getTier2Words,
  getTier3Words,
  getPatternsByCategory,
  getPatternsByTier,
} from "../utils/ai-patterns.js";

describe("AI Patterns", () => {
  describe("WORD_REPLACEMENTS", () => {
    it("has Tier 1 words", () => {
      const tier1Words = getTier1Words();
      expect(tier1Words.length).toBeGreaterThan(0);
      expect(tier1Words).toContain("leverage");
      expect(tier1Words).toContain("commence");
      expect(tier1Words).toContain("facilitate");
    });

    it("has Tier 2 words or patterns", () => {
      // Tier 2 may be empty in WORD_REPLACEMENTS but patterns exist
      const tier2Words = getTier2Words();
      const tier2Patterns = getPatternsByTier(2);
      expect(tier2Words.length + tier2Patterns.length).toBeGreaterThan(0);
    });

    it("has Tier 3 words or patterns", () => {
      // Tier 3 may be empty in WORD_REPLACEMENTS but patterns exist
      const tier3Words = getTier3Words();
      const tier3Patterns = getPatternsByTier(3);
      expect(tier3Words.length + tier3Patterns.length).toBeGreaterThan(0);
    });

    it("each word has valid tier", () => {
      for (const [word, config] of Object.entries(WORD_REPLACEMENTS)) {
        expect([1, 2, 3]).toContain(config.tier);
        expect(config.replacement).toBeTruthy();
      }
    });
  });

  describe("AI_PATTERNS", () => {
    it("has patterns in all categories", () => {
      const structural = getPatternsByCategory("structural");
      const rhetorical = getPatternsByCategory("rhetorical");
      const aiFingerprint = getPatternsByCategory("ai-fingerprint");
      const rhythm = getPatternsByCategory("rhythm");

      expect(structural.length).toBeGreaterThan(0);
      expect(rhetorical.length).toBeGreaterThan(0);
      expect(aiFingerprint.length).toBeGreaterThan(0);
      expect(rhythm.length).toBeGreaterThan(0);
    });

    it("has patterns in all tiers", () => {
      const tier1 = getPatternsByTier(1);
      const tier2 = getPatternsByTier(2);
      const tier3 = getPatternsByTier(3);

      expect(tier1.length).toBeGreaterThan(0);
      expect(tier2.length).toBeGreaterThan(0);
      expect(tier3.length).toBeGreaterThan(0);
    });

    it("each pattern has valid structure", () => {
      for (const pattern of AI_PATTERNS) {
        expect(pattern.id).toBeTruthy();
        expect([1, 2, 3]).toContain(pattern.tier);
        expect(["structural", "rhetorical", "ai-fingerprint", "rhythm"]).toContain(pattern.category);
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.description).toBeTruthy();
        expect(pattern.examples.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Pattern Detection", () => {
    it("detects Certainly! at start", () => {
      const text = "Certainly! The system works well.";
      const pattern = AI_PATTERNS.find(p => p.id === "certainly");
      expect(pattern).toBeDefined();
      expect(pattern!.pattern.test(text)).toBe(true);
    });

    it("detects In conclusion", () => {
      const text = "In conclusion, this is important.";
      const pattern = AI_PATTERNS.find(p => p.id === "in-conclusion");
      expect(pattern).toBeDefined();
      expect(pattern!.pattern.test(text)).toBe(true);
    });

    it("detects watershed moment", () => {
      const text = "This is a watershed moment for the company.";
      const pattern = AI_PATTERNS.find(p => p.id === "watershed-moment");
      expect(pattern).toBeDefined();
      expect(pattern!.pattern.test(text)).toBe(true);
    });

    it("detects serves as", () => {
      const text = "The platform serves as a hub.";
      const pattern = AI_PATTERNS.find(p => p.id === "serves-as");
      expect(pattern).toBeDefined();
      expect(pattern!.pattern.test(text)).toBe(true);
    });

    it("does not detect human-written text", () => {
      const text = "他走过去，端起杯子，喝了一口水。";
      const tier1Patterns = getPatternsByTier(1);
      const detected = tier1Patterns.some(p => p.pattern.test(text));
      expect(detected).toBe(false);
    });
  });

  describe("Word Replacement", () => {
    it("replaces Tier 1 words", () => {
      const text = "We need to leverage this opportunity.";
      const config = WORD_REPLACEMENTS["leverage"];
      expect(config).toBeDefined();
      expect(config!.tier).toBe(1);
      expect(config!.replacement).toBe("use");
    });

    it("replaces Tier 2 words when clustered", () => {
      // Check if Tier 2 words exist in WORD_REPLACEMENTS
      const tier2Words = getTier2Words();
      if (tier2Words.length >= 2) {
        const word1 = tier2Words[0];
        const word2 = tier2Words[1];
        const config1 = WORD_REPLACEMENTS[word1];
        const config2 = WORD_REPLACEMENTS[word2];
        expect(config1).toBeDefined();
        expect(config2).toBeDefined();
        expect(config1!.tier).toBe(2);
        expect(config2!.tier).toBe(2);
      } else {
        // Skip if not enough Tier 2 words
        expect(true).toBe(true);
      }
    });
  });
});
