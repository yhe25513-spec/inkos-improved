/**
 * 健康报告生成器
 * 生成 Markdown 格式的健康报告
 */

import type { HealthReport, HealthCheckResult } from "../agents/health-checker.js";

/**
 * 生成 Markdown 格式的健康报告
 */
export function generateHealthReportMarkdown(report: HealthReport): string {
  const scoreEmoji = (score: number) => {
    if (score >= 80) return "🟢";
    if (score >= 60) return "🟡";
    return "🔴";
  };

  const statusEmoji = (passed: boolean) => passed ? "✅" : "❌";

  let md = `# 🏥 世界观健康报告\n\n`;

  // 基本信息
  md += `**检查时间**: ${new Date(report.timestamp).toLocaleString("zh-CN")}\n`;
  md += `**书籍 ID**: ${report.bookId}\n`;
  md += `**章节数量**: ${report.chapterCount}\n`;
  md += `**综合评分**: ${scoreEmoji(report.overallScore)} ${report.overallScore}/100\n\n`;

  // 检查项表格
  md += `## 📊 检查项\n\n`;
  md += `| 检查项 | 状态 | 评分 | 说明 |\n`;
  md += `|--------|------|------|------|\n`;

  for (const check of report.checks) {
    md += `| ${check.name} | ${statusEmoji(check.passed)} | ${scoreEmoji(check.score)} ${check.score}/100 | ${check.summary} |\n`;
  }

  // 发现的问题
  const failedChecks = report.checks.filter(c => !c.passed);
  if (failedChecks.length > 0) {
    md += `\n## 🔍 发现的问题\n\n`;

    for (const check of failedChecks) {
      md += `### ${statusEmoji(false)} ${check.name}\n\n`;
      for (const issue of check.issues) {
        md += `- ⚠️ ${issue}\n`;
      }
      md += `\n`;
    }
  }

  // 伏笔压力报告
  if (report.pressureReport && report.pressureReport.topPressureHooks.length > 0) {
    md += `## 🪝 伏笔压力分析\n\n`;

    for (const analysis of report.pressureReport.topPressureHooks) {
      const pressureEmoji = analysis.currentPressure > 70 ? "🔴" :
                           analysis.currentPressure > 40 ? "🟡" : "🟢";
      const actionText = analysis.suggestedAction === "resolve" ? "回收" :
                        analysis.suggestedAction === "advance" ? "推进" : "延后";

      md += `- ${pressureEmoji} **${analysis.hookText}**\n`;
      md += `  - 压力值: ${analysis.currentPressure}/100\n`;
      md += `  - 建议: ${actionText}（第 ${analysis.suggestedChapter} 章）\n`;
    }
    md += `\n`;
  }

  // 建议
  if (report.recommendations.length > 0) {
    md += `## 💡 建议\n\n`;
    for (let i = 0; i < report.recommendations.length; i++) {
      md += `${i + 1}. ${report.recommendations[i]}\n`;
    }
    md += `\n`;
  }

  // 评分说明
  md += `## 📈 评分说明\n\n`;
  md += `- 🟢 80-100 分：优秀\n`;
  md += `- 🟡 60-79 分：良好，有改进空间\n`;
  md += `- 🔴 0-59 分：需要关注，建议立即修复\n\n`;

  md += `---\n`;
  md += `*报告由 InkOS 健康检查系统生成*\n`;

  return md;
}

/**
 * 生成简洁的健康摘要
 */
export function generateHealthSummary(report: HealthReport): string {
  const scoreEmoji = report.overallScore >= 80 ? "🟢" :
                    report.overallScore >= 60 ? "🟡" : "🔴";

  const failedCount = report.checks.filter(c => !c.passed).length;

  if (failedCount === 0) {
    return `${scoreEmoji} 健康检查通过（${report.overallScore}/100）`;
  }

  return `${scoreEmoji} 健康检查发现问题（${report.overallScore}/100）：${failedCount} 个检查未通过`;
}

/**
 * 生成 JSON 格式的健康报告
 */
export function generateHealthReportJSON(report: HealthReport): object {
  return {
    timestamp: report.timestamp,
    bookId: report.bookId,
    chapterCount: report.chapterCount,
    overallScore: report.overallScore,
    checks: report.checks.map(check => ({
      name: check.name,
      passed: check.passed,
      score: check.score,
      summary: check.summary,
      issueCount: check.issues.length,
    })),
    recommendations: report.recommendations,
    pressureSummary: report.pressureReport?.summary,
  };
}
