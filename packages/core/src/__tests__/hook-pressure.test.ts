import { describe, it, expect } from "vitest";
import {
  analyzeHookPressure,
  analyzeAllHooksPressure,
  formatPressureReportMarkdown,
} from "../utils/hook-pressure.js";
import type { StoredHook } from "../state/memory-db.js";

describe("Hook Pressure", () => {
  const createMockHook = (overrides: Partial<StoredHook> = {}): StoredHook => ({
    hookId: "H001",
    type: "foreshadowing",
    status: "open",
    startChapter: 1,
    lastAdvancedChapter: 0,
    expectedPayoff: "第10章",
    payoffTiming: "mid-arc",
    notes: "测试伏笔",
    promoted: true,
    ...overrides,
  });

  describe("analyzeHookPressure", () => {
    it("calculates pressure based on age", () => {
      const hook = createMockHook({
        startChapter: 1,
        lastAdvancedChapter: 0,
      });
      const analysis = analyzeHookPressure(hook, 25, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(0);
      expect(analysis.reasons.length).toBeGreaterThan(0);
    });

    it("calculates pressure based on advance count", () => {
      const hook = createMockHook({
        startChapter: 1,
        lastAdvancedChapter: 0,
        advancedCount: 0,
      });
      const analysis = analyzeHookPressure(hook, 15, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(0);
      expect(analysis.reasons.some(r => r.includes("未推进"))).toBe(true);
    });

    it("calculates pressure based on last advance time", () => {
      const hook = createMockHook({
        startChapter: 1,
        lastAdvancedChapter: 5,
      });
      const analysis = analyzeHookPressure(hook, 25, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(0);
      expect(analysis.reasons.some(r => r.includes("上次推进"))).toBe(true);
    });

    it("calculates pressure for core hooks", () => {
      const hook = createMockHook({
        coreHook: true,
        startChapter: 1,
        lastAdvancedChapter: 10,
      });
      const analysis = analyzeHookPressure(hook, 15, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(0);
      expect(analysis.reasons.some(r => r.includes("核心伏笔"))).toBe(true);
    });

    it("suggests resolve for high pressure", () => {
      const hook = createMockHook({
        startChapter: 1,
        lastAdvancedChapter: 0,
        coreHook: true,
      });
      const analysis = analyzeHookPressure(hook, 35, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(70);
      expect(analysis.suggestedAction).toBe("resolve");
    });

    it("suggests advance for medium pressure", () => {
      const hook = createMockHook({
        startChapter: 10,
        lastAdvancedChapter: 5,
      });
      const analysis = analyzeHookPressure(hook, 20, "", []);

      expect(analysis.currentPressure).toBeGreaterThan(40);
      expect(analysis.currentPressure).toBeLessThanOrEqual(70);
      expect(analysis.suggestedAction).toBe("advance");
    });

    it("suggests defer for low pressure", () => {
      const hook = createMockHook({
        startChapter: 15,
        lastAdvancedChapter: 14,
      });
      const analysis = analyzeHookPressure(hook, 16, "", []);

      expect(analysis.currentPressure).toBeLessThanOrEqual(40);
      expect(analysis.suggestedAction).toBe("defer");
    });

    it("provides confidence score", () => {
      const hook = createMockHook();
      const analysis = analyzeHookPressure(hook, 10, "", []);

      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("analyzeAllHooksPressure", () => {
    it("analyzes multiple hooks", () => {
      const hooks = [
        createMockHook({ hookId: "H001", startChapter: 1 }),
        createMockHook({ hookId: "H002", startChapter: 5 }),
        createMockHook({ hookId: "H003", startChapter: 10 }),
      ];

      const report = analyzeAllHooksPressure(hooks, 20, "");

      expect(report.chapter).toBe(20);
      expect(report.analyses.length).toBe(3);
      expect(report.topPressureHooks.length).toBeLessThanOrEqual(5);
      expect(report.summary).toBeTruthy();
    });

    it("sorts by pressure", () => {
      const hooks = [
        createMockHook({ hookId: "H001", startChapter: 1, coreHook: true }),
        createMockHook({ hookId: "H002", startChapter: 15 }),
      ];

      const report = analyzeAllHooksPressure(hooks, 20, "");

      if (report.topPressureHooks.length >= 2) {
        expect(report.topPressureHooks[0].currentPressure).toBeGreaterThanOrEqual(
          report.topPressureHooks[1].currentPressure
        );
      }
    });
  });

  describe("formatPressureReportMarkdown", () => {
    it("generates markdown report", () => {
      const hooks = [
        createMockHook({ hookId: "H001", startChapter: 1 }),
      ];

      const report = analyzeAllHooksPressure(hooks, 10, "");
      const markdown = formatPressureReportMarkdown(report);

      expect(markdown).toContain("# 🪝 伏笔压力报告");
      expect(markdown).toContain("**当前章节**");
      expect(markdown).toContain("**活跃伏笔**");
    });

    it("includes pressure distribution", () => {
      const hooks = [
        createMockHook({ hookId: "H001", startChapter: 1 }),
        createMockHook({ hookId: "H002", startChapter: 10 }),
      ];

      const report = analyzeAllHooksPressure(hooks, 15, "");
      const markdown = formatPressureReportMarkdown(report);

      expect(markdown).toContain("📊 压力分布");
      expect(markdown).toContain("🔴 高");
      expect(markdown).toContain("🟡 中");
      expect(markdown).toContain("🟢 低");
    });
  });
});
