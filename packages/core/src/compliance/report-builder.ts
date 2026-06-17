import type { ComplianceReportData, ComplianceIssue, DetectorResult } from "./types.js";

/**
 * 合规报告生成器
 * 生成人类可读的合规报告
 */
export class ReportBuilder {
  /**
   * 生成 Markdown 格式的合规报告
   */
  buildMarkdown(report: ComplianceReportData): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# 合规检查报告`);
    lines.push("");
    lines.push(`- **书籍ID**: ${report.bookId}`);
    lines.push(`- **平台**: ${report.platform}`);
    lines.push(`- **检查时间**: ${report.timestamp}`);
    lines.push(`- **综合评分**: ${report.overallScore}/100`);
    lines.push(`- **AI内容占比**: ${(report.aiContentPercentage * 100).toFixed(1)}%`);
    lines.push(`- **检查结果**: ${report.passed ? "✅ 通过" : "❌ 未通过"}`);
    lines.push("");

    // 检测器结果
    if (report.detectorResults.length > 0) {
      lines.push("## 多检测器交叉验证");
      lines.push("");
      lines.push("| 检测器 | 判定 | 置信度 |");
      lines.push("|--------|------|--------|");
      for (const dr of report.detectorResults) {
        const verdict = dr.error ? "⚠️ 错误" : dr.isAIGenerated ? "🤖 AI" : "👤 人类";
        const conf = dr.error ? "-" : `${(dr.confidence * 100).toFixed(0)}%`;
        lines.push(`| ${dr.detector} | ${verdict} | ${conf} |`);
      }
      lines.push("");
    }

    // 问题列表
    if (report.issues.length > 0) {
      lines.push("## 发现的问题");
      lines.push("");
      for (const issue of report.issues) {
        const icon = issue.severity === "error" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
        lines.push(`### ${icon} ${issue.message}`);
        lines.push(`- **类型**: ${issue.type}`);
        lines.push(`- **严重度**: ${issue.severity}`);
        if (issue.location) {
          lines.push(`- **位置**: 第${issue.location.chapter}章`);
        }
        lines.push(`- **建议**: ${issue.suggestion}`);
        lines.push("");
      }
    } else {
      lines.push("## ✅ 未发现问题");
      lines.push("");
    }

    // 建议
    if (report.recommendations.length > 0) {
      lines.push("## 改进建议");
      lines.push("");
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 生成 JSON 格式的报告摘要
   */
  buildSummary(report: ComplianceReportData): Record<string, unknown> {
    return {
      bookId: report.bookId,
      platform: report.platform,
      passed: report.passed,
      score: report.overallScore,
      aiPercentage: report.aiContentPercentage,
      issueCount: report.issues.length,
      errorCount: report.issues.filter((i) => i.severity === "error").length,
      warningCount: report.issues.filter((i) => i.severity === "warning").length,
      detectorVerdict: this.aggregateDetectorVerdict(report.detectorResults),
      timestamp: report.timestamp,
    };
  }

  private aggregateDetectorVerdict(detectors: DetectorResult[]): string {
    if (detectors.length === 0) return "no-detector";
    const humanVotes = detectors.filter((d) => !d.isAIGenerated && !d.error).length;
    const aiVotes = detectors.filter((d) => d.isAIGenerated && !d.error).length;
    if (humanVotes >= 2) return "human";
    if (aiVotes >= 2) return "ai";
    return "mixed";
  }
}
