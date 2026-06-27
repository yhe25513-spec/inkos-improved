// ── 一致性检查器 ──────────────────────────────────────
// 综合检查小说的一致性

import type { ConsistencyIssue, ConsistencyCheckResult, FixProposal, FixAction } from "./types.js";
import { ForeshadowTracker } from "./foreshadow-tracker.js";
import { CharacterStateSync } from "./character-state-sync.js";
import { TimelineManager } from "./timeline-manager.js";

/**
 * 一致性检查器
 */
export class ConsistencyChecker {
  private foreshadowTracker: ForeshadowTracker;
  private characterSync: CharacterStateSync;
  private timelineManager: TimelineManager;

  constructor(
    foreshadowTracker: ForeshadowTracker,
    characterSync: CharacterStateSync,
    timelineManager: TimelineManager,
  ) {
    this.foreshadowTracker = foreshadowTracker;
    this.characterSync = characterSync;
    this.timelineManager = timelineManager;
  }

  /**
   * 检查书籍的一致性（返回完整结果，包含修复方案）
   */
  checkConsistency(
    bookId: string,
    currentChapter: number,
  ): ConsistencyCheckResult {
    const issues: ConsistencyIssue[] = [];
    const proposals: FixProposal[] = [];

    // 1. 检查伏笔
    const foreshadowIssues = this.checkForeshadows(bookId, currentChapter);
    issues.push(...foreshadowIssues);

    // 2. 检查角色状态
    const characterIssues = this.checkCharacterStates(bookId, currentChapter);
    issues.push(...characterIssues);

    // 3. 检查时间线
    const timelineIssues = this.checkTimeline(bookId);
    issues.push(...timelineIssues);

    // 4. 生成修复方案
    proposals.push(...this.generateProposals(bookId, issues));

    // 5. 关联问题和方案
    for (const proposal of proposals) {
      for (const issue of issues) {
        if (!issue.relatedProposals) issue.relatedProposals = [];
        issue.relatedProposals.push(proposal.id);
      }
    }

    // 生成摘要
    const summary = this.generateSummary(issues, proposals);

    return { issues, proposals, summary };
  }

  /**
   * 生成修复方案
   */
  private generateProposals(bookId: string, issues: ConsistencyIssue[]): FixProposal[] {
    const proposals: FixProposal[] = [];
    const issueIndex = new Map<string, number>();

    issues.forEach((issue, index) => {
      const key = `${issue.type}-${issue.location.chapter}-${issue.location.element}`;
      issueIndex.set(key, index);
    });

    // 为严重问题生成方案
    const criticalIssues = issues.filter(i => i.severity === "error");
    
    if (criticalIssues.length > 0) {
      const actions: FixAction[] = criticalIssues.map(issue => ({
        type: "update_setting" as const,
        targetFile: `story/outline/volume_map.md`,
        description: `修复第${issue.location.chapter}章的${issue.location.element}问题`,
        newValue: `// 自动修复: ${issue.message}\n// 建议: ${issue.suggestion}`,
      }));

      proposals.push({
        id: `proposal-${Date.now()}-A`,
        name: "方案A",
        description: "修复所有严重一致性问题",
        actions,
        priority: "P0",
      });
    }

    // 为警告问题生成方案
    const warningIssues = issues.filter(i => i.severity === "warning");
    
    if (warningIssues.length > 0) {
      proposals.push({
        id: `proposal-${Date.now()}-B`,
        name: "方案B",
        description: "修复所有警告级别问题",
        actions: warningIssues.map(issue => ({
          type: "update_setting" as const,
          targetFile: `story/story_bible.md`,
          description: `优化第${issue.location.chapter}章的${issue.location.element}`,
          newValue: `// 优化建议: ${issue.message}\n// ${issue.suggestion}`,
        })),
        priority: "P1",
      });
    }

    return proposals;
  }

  /**
   * 生成检查摘要
   */
  private generateSummary(issues: ConsistencyIssue[], proposals: FixProposal[]): string {
    const errorCount = issues.filter(i => i.severity === "error").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;
    
    if (issues.length === 0) {
      return "未发现一致性问题";
    }

    return `发现 ${issues.length} 个一致性问题（${errorCount} 个严重，${warningCount} 个警告），已生成 ${proposals.length} 个修复方案`;
  }

  /**
   * 检查伏笔
   */
  private checkForeshadows(bookId: string, currentChapter: number): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // 检查长时间未解决的伏笔
    const staleForeshadows = this.foreshadowTracker.checkStaleForeshadows(
      bookId,
      currentChapter,
      50,
    );

    for (const fs of staleForeshadows) {
      issues.push({
        type: "foreshadow",
        severity: fs.importance === "critical" || fs.importance === "high" ? "error" : "warning",
        message: `伏笔"${fs.content.slice(0, 30)}..."已设置${currentChapter - fs.chapterSet}章仍未解决`,
        location: { chapter: fs.chapterSet, element: "伏笔" },
        suggestion: `考虑在后续章节中解决此伏笔，或标记为"放弃"`,
      });
    }

    return issues;
  }

  /**
   * 检查角色状态
   */
  private checkCharacterStates(bookId: string, currentChapter: number): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    const stateIssues = this.characterSync.checkConsistency(bookId, currentChapter);

    for (const issue of stateIssues) {
      issues.push({
        type: "character",
        severity: "warning",
        message: `角色"${issue.characterId}": ${issue.issue}`,
        location: { chapter: currentChapter, element: "角色状态" },
        suggestion: `检查第${currentChapter}章中该角色的状态描述`,
      });
    }

    return issues;
  }

  /**
   * 检查时间线
   */
  private checkTimeline(bookId: string): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    const conflicts = this.timelineManager.checkConflicts(bookId);

    for (const conflict of conflicts) {
      issues.push({
        type: "timeline",
        severity: "error",
        message: conflict.reason,
        location: {
          chapter: conflict.event1.chapterNumber,
          element: "时间线",
        },
        suggestion: `调整事件顺序或修改角色出场逻辑`,
      });
    }

    return issues;
  }
}
