import { describe, it, expect } from "vitest";
import {
  generateHealthReportMarkdown,
  generateHealthSummary,
  generateHealthReportJSON,
} from "../utils/health-report.js";
import type { HealthReport, HealthCheckResult } from "../agents/health-checker.js";

describe("Health Report", () => {
  const createMockReport = (overrides: Partial<HealthReport> = {}): HealthReport => ({
    timestamp: Date.now(),
    bookId: "test-book",
    chapterCount: 10,
    overallScore: 85,
    checks: [
      {
        name: "真相文件完整性",
        passed: true,
        score: 100,
        summary: "所有真相文件完整",
        issues: [],
        recommendations: [],
      },
      {
        name: "伏笔健康",
        passed: false,
        score: 70,
        summary: "发现 1 个问题",
        issues: ["活跃伏笔过多"],
        recommendations: ["回收一些不重要的伏笔"],
      },
    ],
    recommendations: ["回收一些不重要的伏笔"],
    ...overrides,
  });

  describe("generateHealthReportMarkdown", () => {
    it("generates markdown report", () => {
      const report = createMockReport();
      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("# 🏥 世界观健康报告");
      expect(markdown).toContain("**检查时间**");
      expect(markdown).toContain("**书籍 ID**: test-book");
      expect(markdown).toContain("**章节数量**: 10");
      expect(markdown).toContain("85/100");
    });

    it("includes check items table", () => {
      const report = createMockReport();
      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("📊 检查项");
      expect(markdown).toContain("| 检查项 | 状态 | 评分 | 说明 |");
      expect(markdown).toContain("真相文件完整性");
      expect(markdown).toContain("伏笔健康");
    });

    it("includes issues when checks fail", () => {
      const report = createMockReport();
      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("🔍 发现的问题");
      expect(markdown).toContain("伏笔健康");
      expect(markdown).toContain("活跃伏笔过多");
    });

    it("includes recommendations", () => {
      const report = createMockReport();
      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("💡 建议");
      expect(markdown).toContain("回收一些不重要的伏笔");
    });

    it("includes score explanation", () => {
      const report = createMockReport();
      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("📈 评分说明");
      expect(markdown).toContain("🟢 80-100 分：优秀");
      expect(markdown).toContain("🟡 60-79 分：良好");
      expect(markdown).toContain("🔴 0-59 分：需要关注");
    });

    it("includes pressure report when available", () => {
      const report = createMockReport({
        pressureReport: {
          chapter: 10,
          analyses: [],
          topPressureHooks: [
            {
              hookId: "H001",
              hookText: "测试伏笔",
              currentPressure: 80,
              reasons: ["压力原因"],
              suggestedAction: "resolve",
              suggestedChapter: 11,
              confidence: 0.9,
            },
          ],
          summary: "1 个高压力伏笔",
        },
      });

      const markdown = generateHealthReportMarkdown(report);

      expect(markdown).toContain("🪝 伏笔压力分析");
      expect(markdown).toContain("测试伏笔");
      expect(markdown).toContain("压力值: 80/100");
    });
  });

  describe("generateHealthSummary", () => {
    it("generates passing summary", () => {
      const report = createMockReport({ overallScore: 85 });
      const summary = generateHealthSummary(report);

      expect(summary).toContain("🟢");
      expect(summary).toContain("85/100");
    });

    it("generates warning summary", () => {
      const report = createMockReport({ overallScore: 65 });
      const summary = generateHealthSummary(report);

      expect(summary).toContain("🟡");
      expect(summary).toContain("65/100");
    });

    it("generates failing summary", () => {
      const report = createMockReport({ overallScore: 50 });
      const summary = generateHealthSummary(report);

      expect(summary).toContain("🔴");
      expect(summary).toContain("50/100");
    });

    it("includes failed check count", () => {
      const report = createMockReport();
      const summary = generateHealthSummary(report);

      expect(summary).toContain("1 个检查未通过");
    });
  });

  describe("generateHealthReportJSON", () => {
    it("generates JSON report", () => {
      const report = createMockReport();
      const json = generateHealthReportJSON(report) as any;

      expect(json.timestamp).toBe(report.timestamp);
      expect(json.bookId).toBe("test-book");
      expect(json.chapterCount).toBe(10);
      expect(json.overallScore).toBe(85);
      expect(json.checks.length).toBe(2);
      expect(json.recommendations.length).toBe(1);
    });

    it("simplifies check objects", () => {
      const report = createMockReport();
      const json = generateHealthReportJSON(report) as any;

      expect(json.checks[0].name).toBe("真相文件完整性");
      expect(json.checks[0].passed).toBe(true);
      expect(json.checks[0].score).toBe(100);
      expect(json.checks[0].issueCount).toBe(0);
    });
  });
});
