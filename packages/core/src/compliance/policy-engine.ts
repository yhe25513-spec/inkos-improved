import type {
  Platform,
  PlatformPolicy,
  ComplianceCheckOptions,
  ComplianceReportData,
  ComplianceIssue,
  DetectorResult,
} from "./types.js";

// ── 平台策略数据库 ────────────────────────────────────

export const PLATFORM_POLICIES: Record<Platform, PlatformPolicy> = {
  qidian: {
    id: "qidian",
    name: "起点中文网",
    aiDisclosureRequired: true,
    aiContentLimit: 0.3, // AI内容不超过30%
    bannedContent: [],
    requiredLabels: ["AI辅助创作"],
    suggestedWordCount: { min: 2000, max: 4000 },
    extraRules: [
      "纯AI生成作品不予签约上架",
      "AI生成内容占比超过阈值需主动申报",
    ],
  },
  tomato: {
    id: "tomato",
    name: "番茄小说",
    aiDisclosureRequired: true,
    aiContentLimit: 0.5,
    bannedContent: [],
    requiredLabels: ["AI生成内容"],
    suggestedWordCount: { min: 1500, max: 3000 },
    extraRules: [
      "需声明是否使用AI辅助创作",
      "打击批量AI作品",
    ],
  },
  jjwxc: {
    id: "jjwxc",
    name: "晋江文学城",
    aiDisclosureRequired: true,
    aiContentLimit: 0.3,
    bannedContent: [],
    requiredLabels: ["AI辅助创作"],
    suggestedWordCount: { min: 2000, max: 5000 },
    extraRules: [
      "社区举报机制 + 编辑审核",
      "重视原创性",
    ],
  },
  "amazon-kdp": {
    id: "amazon-kdp",
    name: "Amazon KDP",
    aiDisclosureRequired: true,
    aiContentLimit: undefined, // 无明确上限但需披露
    bannedContent: [],
    requiredLabels: ["AI-generated content"],
    suggestedWordCount: { min: 2500, max: 5000 },
    extraRules: [
      "要求披露AI生成内容",
      "限制AI出版数量",
    ],
  },
  custom: {
    id: "custom",
    name: "自定义平台",
    aiDisclosureRequired: false,
    bannedContent: [],
    requiredLabels: [],
  },
};

// ── 策略引擎 ──────────────────────────────────────────

export class PolicyEngine {
  /**
   * 获取平台策略
   */
  getPolicy(platform: Platform): PlatformPolicy {
    const policy = PLATFORM_POLICIES[platform];
    if (!policy) throw new Error(`Unknown platform: ${platform}`);
    return policy;
  }

  /**
   * 检查章节内容的合规性
   */
  checkChapter(
    chapterNumber: number,
    content: string,
    hasAiLabel: boolean,
    policy: PlatformPolicy,
  ): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];

    // 1. 检查AI标识
    if (policy.aiDisclosureRequired && !hasAiLabel) {
      issues.push({
        type: "ai-disclosure",
        severity: "error",
        message: `第${chapterNumber}章缺少AI生成标识`,
        location: { chapter: chapterNumber, line: 1 },
        suggestion: `添加"${policy.requiredLabels[0] ?? "AI辅助创作"}"标识`,
      });
    }

    return issues;
  }

  /**
   * 检查AI内容占比
   */
  checkAiContentLimit(
    chapterNumber: number,
    aiPercentage: number,
    policy: PlatformPolicy,
  ): ComplianceIssue[] {
    const issues: ComplianceIssue[] = [];

    if (policy.aiContentLimit !== undefined && aiPercentage > policy.aiContentLimit) {
      issues.push({
        type: "content-limit",
        severity: "error",
        message: `第${chapterNumber}章AI内容占比 ${(aiPercentage * 100).toFixed(1)}%，超过平台限制 ${(policy.aiContentLimit * 100)}%`,
        location: { chapter: chapterNumber },
        suggestion: "增加人工编辑内容或降低AI生成比例",
      });
    } else if (policy.aiContentLimit !== undefined && aiPercentage > policy.aiContentLimit * 0.8) {
      issues.push({
        type: "content-limit",
        severity: "warning",
        message: `第${chapterNumber}章AI内容占比 ${(aiPercentage * 100).toFixed(1)}%，接近平台限制 ${(policy.aiContentLimit * 100)}%`,
        location: { chapter: chapterNumber },
        suggestion: "注意控制AI内容占比",
      });
    }

    return issues;
  }

  /**
   * 综合评估合规性
   */
  evaluate(
    bookId: string,
    platform: Platform,
    chapters: Array<{
      number: number;
      aiPercentage: number;
      hasAiLabel: boolean;
    }>,
    detectorResults: DetectorResult[],
  ): ComplianceReportData {
    const policy = this.getPolicy(platform);
    const allIssues: ComplianceIssue[] = [];
    let totalAiPercentage = 0;

    // 检查每个章节
    for (const ch of chapters) {
      allIssues.push(...this.checkChapter(ch.number, "", ch.hasAiLabel, policy));
      allIssues.push(...this.checkAiContentLimit(ch.number, ch.aiPercentage, policy));
      totalAiPercentage += ch.aiPercentage;
    }

    const avgAiPercentage = chapters.length > 0 ? totalAiPercentage / chapters.length : 0;

    // 判断是否通过：3个检测器中2个判定为人类写作
    const humanVotes = detectorResults.filter((d) => !d.isAIGenerated && !d.error).length;
    const passedDetector = detectorResults.length >= 2 ? humanVotes >= 2 : true;

    // 无error级别的合规问题 且 检测器通过
    const hasErrors = allIssues.some((i) => i.severity === "error");
    const passed = !hasErrors && passedDetector;

    return {
      bookId,
      platform,
      timestamp: new Date().toISOString(),
      overallScore: this.calculateScore(allIssues, detectorResults),
      aiContentPercentage: avgAiPercentage,
      issues: allIssues,
      recommendations: this.generateRecommendations(allIssues, policy),
      detectorResults,
      passed,
    };
  }

  private calculateScore(issues: ComplianceIssue[], detectors: DetectorResult[]): number {
    let score = 100;

    for (const issue of issues) {
      if (issue.severity === "error") score -= 20;
      else if (issue.severity === "warning") score -= 10;
      else score -= 3;
    }

    // 检测器结果影响分数
    if (detectors.length > 0) {
      const aiVotes = detectors.filter((d) => d.isAIGenerated && !d.error).length;
      if (aiVotes >= 2) score -= 30;
      else if (aiVotes === 1) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(issues: ComplianceIssue[], policy: PlatformPolicy): string[] {
    const recs: string[] = [];

    if (issues.some((i) => i.type === "ai-disclosure")) {
      recs.push(`在每章开头或结尾添加"${policy.requiredLabels[0] ?? "AI辅助创作"}"标识`);
    }
    if (issues.some((i) => i.type === "content-limit")) {
      recs.push("增加人工编辑和原创内容，降低AI生成比例");
    }
    if (policy.extraRules) {
      for (const rule of policy.extraRules) {
        recs.push(rule);
      }
    }

    return recs;
  }
}
