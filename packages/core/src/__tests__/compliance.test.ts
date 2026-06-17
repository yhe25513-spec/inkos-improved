import { describe, it, expect } from "vitest";
import { PolicyEngine, PLATFORM_POLICIES } from "../compliance/policy-engine.js";
import { ReportBuilder } from "../compliance/report-builder.js";
import type { DetectorResult } from "../compliance/types.js";

describe("PolicyEngine", () => {
  const engine = new PolicyEngine();

  it("should return correct policy for each platform", () => {
    const qidian = engine.getPolicy("qidian");
    expect(qidian.name).toBe("起点中文网");
    expect(qidian.aiDisclosureRequired).toBe(true);
    expect(qidian.aiContentLimit).toBe(0.3);

    const tomato = engine.getPolicy("tomato");
    expect(tomato.name).toBe("番茄小说");
    expect(tomato.aiContentLimit).toBe(0.5);

    const jjwxc = engine.getPolicy("jjwxc");
    expect(jjwxc.name).toBe("晋江文学城");

    const kdp = engine.getPolicy("amazon-kdp");
    expect(kdp.name).toBe("Amazon KDP");
  });

  it("should throw for unknown platform", () => {
    expect(() => engine.getPolicy("unknown" as any)).toThrow("Unknown platform");
  });

  it("should detect missing AI label", () => {
    const policy = engine.getPolicy("qidian");
    const issues = engine.checkChapter(1, "测试内容", false, policy);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("ai-disclosure");
    expect(issues[0].severity).toBe("error");
  });

  it("should not flag when AI label is present", () => {
    const policy = engine.getPolicy("qidian");
    const issues = engine.checkChapter(1, "测试内容", true, policy);
    expect(issues).toHaveLength(0);
  });

  it("should detect AI content over limit", () => {
    const policy = engine.getPolicy("qidian");
    const issues = engine.checkAiContentLimit(1, 0.5, policy); // 50% > 30% limit
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("content-limit");
    expect(issues[0].severity).toBe("error");
  });

  it("should warn when AI content is near limit", () => {
    const policy = engine.getPolicy("qidian");
    const issues = engine.checkAiContentLimit(1, 0.28, policy); // 28% near 30% limit
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("should pass when AI content is under limit", () => {
    const policy = engine.getPolicy("qidian");
    const issues = engine.checkAiContentLimit(1, 0.1, policy); // 10% < 30% limit
    expect(issues).toHaveLength(0);
  });

  it("should evaluate full report correctly", () => {
    const detectors: DetectorResult[] = [
      { detector: "GPTZero", isAIGenerated: false, confidence: 0.85 },
      { detector: "Originality.ai", isAIGenerated: false, confidence: 0.78 },
      { detector: "Winston AI", isAIGenerated: true, confidence: 0.6 },
    ];

    const chapters = [
      { number: 1, aiPercentage: 0.15, hasAiLabel: true },
      { number: 2, aiPercentage: 0.25, hasAiLabel: true },
    ];

    const report = engine.evaluate("book-1", "qidian", chapters, detectors);

    expect(report.passed).toBe(true); // 2/3检测器判定人类 + 无error
    expect(report.overallScore).toBeGreaterThan(70);
    expect(report.aiContentPercentage).toBeCloseTo(0.2);
    expect(report.detectorResults).toHaveLength(3);
  });

  it("should fail when too many AI detectors flag", () => {
    const detectors: DetectorResult[] = [
      { detector: "GPTZero", isAIGenerated: true, confidence: 0.9 },
      { detector: "Originality.ai", isAIGenerated: true, confidence: 0.85 },
      { detector: "Winston AI", isAIGenerated: false, confidence: 0.6 },
    ];

    const chapters = [
      { number: 1, aiPercentage: 0.1, hasAiLabel: true },
    ];

    const report = engine.evaluate("book-1", "qidian", chapters, detectors);
    expect(report.passed).toBe(false);
  });

  it("should fail when AI label is missing", () => {
    const detectors: DetectorResult[] = [
      { detector: "GPTZero", isAIGenerated: false, confidence: 0.85 },
    ];

    const chapters = [
      { number: 1, aiPercentage: 0.1, hasAiLabel: false },
    ];

    const report = engine.evaluate("book-1", "qidian", chapters, detectors);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.type === "ai-disclosure")).toBe(true);
  });
});

describe("ReportBuilder", () => {
  const builder = new ReportBuilder();

  it("should build markdown report", () => {
    const report = {
      bookId: "test-book",
      platform: "qidian" as const,
      timestamp: "2026-06-16T10:00:00Z",
      overallScore: 85,
      aiContentPercentage: 0.15,
      issues: [
        {
          type: "ai-disclosure" as const,
          severity: "error" as const,
          message: "第1章缺少AI标识",
          location: { chapter: 1 },
          suggestion: "添加AI辅助创作标识",
        },
      ],
      recommendations: ["在每章添加AI辅助创作标识"],
      detectorResults: [
        { detector: "GPTZero", isAIGenerated: false, confidence: 0.85 },
      ],
      passed: false,
    };

    const md = builder.buildMarkdown(report);
    expect(md).toContain("合规检查报告");
    expect(md).toContain("test-book");
    expect(md).toContain("85/100");
    expect(md).toContain("❌ 未通过");
    expect(md).toContain("第1章缺少AI标识");
  });

  it("should build summary", () => {
    const report = {
      bookId: "test-book",
      platform: "qidian" as const,
      timestamp: "2026-06-16T10:00:00Z",
      overallScore: 85,
      aiContentPercentage: 0.15,
      issues: [
        { type: "ai-disclosure" as const, severity: "error" as const, message: "test", suggestion: "test" },
        { type: "content-limit" as const, severity: "warning" as const, message: "test", suggestion: "test" },
      ],
      recommendations: [],
      detectorResults: [],
      passed: false,
    };

    const summary = builder.buildSummary(report);
    expect(summary.passed).toBe(false);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(1);
  });
});
