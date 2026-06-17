import { describe, it, expect } from "vitest";
import {
  VOICE_PRESETS,
  getVoicePreset,
  detectVoiceStyle,
  applyVoiceProfile,
  compareVoiceProfiles,
} from "../utils/voice-profiles.js";
import type { VoiceProfile } from "../utils/voice-profiles.js";

describe("Voice Profiles", () => {
  describe("VOICE_PRESETS", () => {
    it("has all voice profiles", () => {
      expect(VOICE_PRESETS.literary).toBeDefined();
      expect(VOICE_PRESETS.casual).toBeDefined();
      expect(VOICE_PRESETS.professional).toBeDefined();
      expect(VOICE_PRESETS.warm).toBeDefined();
      expect(VOICE_PRESETS.blunt).toBeDefined();
      expect(VOICE_PRESETS.webnovel).toBeDefined();
    });

    it("each profile has required fields", () => {
      for (const [name, preset] of Object.entries(VOICE_PRESETS)) {
        expect(preset.avoid).toBeInstanceOf(Array);
        expect(preset.prefer).toBeInstanceOf(Array);
        expect(preset.tone).toBeTruthy();
        expect(preset.sentenceLength).toMatch(/^(short|medium|long)$/);
        expect(preset.punctuation).toMatch(/^(minimal|moderate|rich)$/);
        expect(preset.description).toBeTruthy();
      }
    });
  });

  describe("getVoicePreset", () => {
    it("returns correct preset for literary", () => {
      const preset = getVoicePreset("literary");
      expect(preset).toBe(VOICE_PRESETS.literary);
      expect(preset.tone).toContain("文雅");
    });

    it("returns correct preset for casual", () => {
      const preset = getVoicePreset("casual");
      expect(preset).toBe(VOICE_PRESETS.casual);
      expect(preset.tone).toContain("口语化");
    });

    it("returns correct preset for webnovel", () => {
      const preset = getVoicePreset("webnovel");
      expect(preset).toBe(VOICE_PRESETS.webnovel);
      expect(preset.tone).toContain("网文");
    });
  });

  describe("detectVoiceStyle", () => {
    it("detects literary style", () => {
      const text = "他甚为惊讶，颇感意外。然则此事已成定局，故而不再多言。";
      const result = detectVoiceStyle(text);
      expect(result.detectedProfile).toBe("literary");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("detects casual style", () => {
      const text = "但是这件事情没有那么简单，所以我们还需要再想想。";
      const result = detectVoiceStyle(text);
      expect(result.detectedProfile).toBe("casual");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("detects webnovel style", () => {
      const text = "卧槽，这也太牛逼了吧！特么的，这也太强了！";
      const result = detectVoiceStyle(text);
      expect(result.detectedProfile).toBe("webnovel");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("provides reasons for detection", () => {
      const text = "他甚为惊讶，颇感意外。";
      const result = detectVoiceStyle(text);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe("applyVoiceProfile", () => {
    it("applies literary profile", () => {
      const text = "他非常惊讶，十分意外。";
      const result = applyVoiceProfile(text, "literary");
      expect(result).not.toContain("非常");
      expect(result).not.toContain("十分");
    });

    it("applies casual profile", () => {
      const text = "然而事情并没有那么简单，因此我们需要再想想。";
      const result = applyVoiceProfile(text, "casual");
      expect(result).not.toContain("然而");
      expect(result).not.toContain("因此");
    });

    it("applies webnovel profile", () => {
      const text = "然而事情并没有那么简单，因此我们需要再想想。";
      const result = applyVoiceProfile(text, "webnovel");
      // Webnovel profile should replace some words
      expect(result).not.toContain("然而");
    });
  });

  describe("compareVoiceProfiles", () => {
    it("compares original and target styles", () => {
      const text = "他非常惊讶，十分意外。";
      const result = compareVoiceProfiles(text, "literary");
      expect(result.originalStyle).toBeTruthy();
      expect(result.targetStyle).toBe("literary");
      expect(result.differences).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
    });

    it("provides suggestions for improvement", () => {
      const text = "然而事情并没有那么简单。";
      const result = compareVoiceProfiles(text, "casual");
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
