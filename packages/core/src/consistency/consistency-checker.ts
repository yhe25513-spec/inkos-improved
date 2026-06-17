// ── 一致性检查器 ──────────────────────────────────────
// 综合检查小说的一致性

import type { ConsistencyIssue, Foreshadow, CharacterState, TimelineEvent } from "./types.js";
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
   * 检查书籍的一致性
   */
  checkConsistency(
    bookId: string,
    currentChapter: number,
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // 1. 检查伏笔
    issues.push(...this.checkForeshadows(bookId, currentChapter));

    // 2. 检查角色状态
    issues.push(...this.checkCharacterStates(bookId, currentChapter));

    // 3. 检查时间线
    issues.push(...this.checkTimeline(bookId));

    return issues;
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
