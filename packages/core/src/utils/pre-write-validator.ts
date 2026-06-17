/**
 * Pre-write validation utility.
 *
 * Validates a chapter memo against current state BEFORE writing begins,
 * catching coherence issues early (missing characters, timeline gaps,
 * obvious conflicts).
 *
 * This is a heuristic check — not an exhaustive audit. It runs without
 * LLM calls so it is fast and deterministic.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface PreWriteCheckResult {
  readonly passed: boolean;
  readonly conflicts: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly characterPresence: {
    readonly expected: ReadonlyArray<string>;
    readonly found: ReadonlyArray<string>;
    readonly missing: ReadonlyArray<string>;
  };
  readonly timelineConsistency: boolean;
}

export interface PreWriteCheckInput {
  /** The raw chapter memo text (may be markdown). */
  readonly chapterMemo: string;
  /** The current_state.md content at the time of the check. */
  readonly currentState: string;
  /** The chapter_summaries.md content at the time of the check. */
  readonly chapterSummaries: string;
  /** Known character names from character_matrix / cast list. */
  readonly characterNames: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Character presence helpers
// ---------------------------------------------------------------------------

/**
 * Extract character names from free-text by scanning for each known name
 * as a substring. Returns the subset of `names` that appear at least once
 * in `text`.
 */
function findMentionedNames(
  text: string,
  names: ReadonlyArray<string>,
): string[] {
  const found: string[] = [];
  for (const name of names) {
    if (name.length >= 2 && text.includes(name)) {
      found.push(name);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Timeline helpers
// ---------------------------------------------------------------------------

/**
 * Parse chapter numbers from a markdown table (chapter_summaries format).
 *
 * Expected format per row: `| <number> | ...`
 * Returns the highest chapter number found, or 0 if no rows are present.
 */
function latestChapterInSummaries(summaries: string): number {
  let latest = 0;
  const rowPattern = /^\|\s*(\d+)\s*\|/gm;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(summaries)) !== null) {
    const num = parseInt(match[1]!, 10);
    if (num > latest) latest = num;
  }
  return latest;
}

/**
 * Extract the chapter number from a memo body.
 *
 * Looks for patterns like "# 第 5 章", "# Chapter 5", or "第5章", "Chapter 5".
 * Returns null if no chapter number is found.
 */
function extractMemoChapterNumber(memo: string): number | null {
  const patterns = [
    /#\s*第\s*(\d+)\s*章/,
    /#\s*Chapter\s+(\d+)/i,
    /第\s*(\d+)\s*章/,
    /Chapter\s+(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = memo.match(pattern);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Conflict detection helpers
// ---------------------------------------------------------------------------

/** Keywords that signal the memo references the current chapter's state. */
const STATE_REFERENCE_PATTERNS: ReadonlyArray<{ pattern: RegExp; description: string }> = [
  {
    pattern: /[上一章本章]章[的]?[结][尾局]/,
    description: "references previous/this chapter ending",
  },
  {
    pattern: /[上一章本章]章[的]?[剧]?情/,
    description: "references previous/this chapter plot",
  },
  {
    pattern: /[此时此刻]的?[当]?[前].*[状状态]/,
    description: "references current state",
  },
  {
    pattern: /当前任务.*?的/,
    description: "current task section references prior context",
  },
];

/**
 * Scan for patterns that suggest the memo may conflict with or duplicate
 * information from the current state. Returns human-readable conflict
 * descriptions.
 */
function detectPotentialConflicts(
  memo: string,
  currentState: string,
): string[] {
  const conflicts: string[] = [];

  // Heuristic 1: memo re-states something already resolved in current state
  const resolvedPattern = /已?[完成解决收回收束]/;
  if (resolvedPattern.test(currentState)) {
    const resolvedItems = extractResolvedItems(currentState);
    for (const item of resolvedItems) {
      const idx = memo.indexOf(item);
      if (idx !== -1 && !/新|重新|再次/.test(memo.slice(idx, idx + 10))) {
        conflicts.push(
          `memo may reference already-resolved item: "${item.slice(0, 20)}"`,
        );
      }
    }
  }

  // Heuristic 2: memo and current state both claim to resolve the same open hook
  const openHooks = extractOpenHooks(currentState);
  const memoGoals = extractGoalPhrases(memo);
  for (const hook of openHooks) {
    for (const goal of memoGoals) {
      if (goal.includes(hook) || hook.includes(goal)) {
        conflicts.push(
          `memo goal "${goal.slice(0, 30)}" may overlap with open hook "${hook.slice(0, 30)}"`,
        );
      }
    }
  }

  return conflicts;
}

/**
 * Extract items described as completed/resolved from current state text.
 */
function extractResolvedItems(text: string): string[] {
  const items: string[] = [];
  const linePattern = /^[^\n]*已?[完成解决收回收束][^\n]*$/gm;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(text)) !== null) {
    const cleaned = match[0].replace(/^[\s\-*|]+/, "").trim();
    if (cleaned.length >= 4 && cleaned.length <= 80) {
      items.push(cleaned);
    }
  }
  return items;
}

/**
 * Extract open (unresolved) hooks from current state.
 * Hooks are typically lines with markers like "- [ ]", "TODO", "待", "open".
 */
function extractOpenHooks(text: string): string[] {
  const hooks: string[] = [];
  const patterns = [
    /^\s*[-*]\s*\[[ x]\]\s*(.+)$/gm,   // - [ ] hook text
    /^.*TODO[:\s]+(.+)$/gim,             // TODO: hook text
    /^.*待[完成解决确认][:\s]+(.+)$/gm,  // 待完成: hook text
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const content = (match[1] ?? match[0]).trim();
      if (content.length >= 2 && content.length <= 100) {
        hooks.push(content);
      }
    }
  }
  return hooks;
}

/**
 * Extract short goal phrases from the memo's "## 本章目标" / "## Chapter goal"
 * section. Falls back to scanning for lines with goal-like language.
 */
function extractGoalPhrases(memo: string): string[] {
  const goals: string[] = [];

  // Try explicit goal headings
  const goalHeadings = ["## 本章目标", "## Chapter goal"];
  for (const heading of goalHeadings) {
    const idx = memo.indexOf(heading);
    if (idx >= 0) {
      const after = memo.slice(idx + heading.length);
      const nextSection = after.match(/\n##\s/);
      const block = nextSection ? after.slice(0, nextSection.index) : after;
      // Take first sentence of the goal block
      const firstSentence = block.split(/[。\n.]/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 4) {
        goals.push(firstSentence);
      }
      break;
    }
  }

  // Also scan for "当前任务" / "Current task" section first sentence
  const taskHeadings = ["## 当前任务", "## Current task"];
  for (const heading of taskHeadings) {
    const idx = memo.indexOf(heading);
    if (idx >= 0) {
      const after = memo.slice(idx + heading.length);
      const nextSection = after.match(/\n##\s/);
      const block = nextSection ? after.slice(0, nextSection.index) : after;
      const firstSentence = block.split(/[。\n.]/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 4) {
        goals.push(firstSentence);
      }
      break;
    }
  }

  return goals;
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

/**
 * Run pre-write validation on a chapter memo against the current book state.
 *
 * Checks performed:
 * 1. **Character presence** — expected characters mentioned in the memo
 *    actually exist in the cast list.
 * 2. **Timeline consistency** — chapter number in the memo is sequential
 *    relative to the latest chapter in summaries.
 * 3. **Conflict detection** — heuristic scan for contradictions between
 *    memo goals and current state (resolved items, overlapping hooks).
 *
 * Returns a structured result. `passed` is true only when there are zero
 * conflicts. Warnings are non-blocking hints.
 */
export function runPreWriteValidation(
  input: PreWriteCheckInput,
): PreWriteCheckResult {
  const { chapterMemo, currentState, chapterSummaries, characterNames } = input;

  const conflicts: string[] = [];
  const warnings: string[] = [];

  // ---- 1. Character presence ----
  const found = findMentionedNames(chapterMemo, characterNames);
  const allMentioned = extractAllCharacterMentions(chapterMemo);
  const missingFromList = allMentioned.filter(
    (name) => !characterNames.includes(name),
  );

  const characterPresence = {
    expected: characterNames.filter((n) => n.length >= 2),
    found: found,
    missing: missingFromList,
  };

  if (missingFromList.length > 0) {
    warnings.push(
      `memo mentions characters not in cast list: ${missingFromList.join(", ")}`,
    );
  }

  // ---- 2. Timeline consistency ----
  const latestChapter = latestChapterInSummaries(chapterSummaries);
  const memoChapter = extractMemoChapterNumber(chapterMemo);

  let timelineConsistency = true;
  if (memoChapter !== null) {
    if (memoChapter <= latestChapter) {
      timelineConsistency = false;
      conflicts.push(
        `chapter number ${memoChapter} in memo does not advance past latest chapter ${latestChapter} in summaries`,
      );
    } else if (memoChapter > latestChapter + 1) {
      warnings.push(
        `chapter number ${memoChapter} skips ahead from latest chapter ${latestChapter} (gap of ${memoChapter - latestChapter - 1})`,
      );
    }
  } else {
    warnings.push("could not extract chapter number from memo for timeline check");
  }

  // ---- 3. Conflict detection ----
  const detectedConflicts = detectPotentialConflicts(chapterMemo, currentState);
  conflicts.push(...detectedConflicts);

  // ---- 4. Additional warnings ----
  if (chapterMemo.trim().length < 100) {
    warnings.push("chapter memo is very short (< 100 chars) — may lack sufficient planning detail");
  }

  if (latestChapter === 0 && chapterSummaries.trim().length > 0) {
    warnings.push("no chapter rows found in summaries — chapter table may be malformed");
  }

  return {
    passed: conflicts.length === 0,
    conflicts,
    warnings,
    characterPresence,
    timelineConsistency,
  };
}

// ---------------------------------------------------------------------------
// Additional helper: extract character-like mentions from memo
// ---------------------------------------------------------------------------

/**
 * Extract character-like mentions from memo text. Looks for Chinese names
 * (2-4 characters before punctuation/whitespace) that also appear in the
 * character list or are prominent enough to be names.
 *
 * This is a simple heuristic — for a fuller solution you would cross-reference
 * with the character_matrix.
 */
function extractAllCharacterMentions(text: string): string[] {
  const mentions = new Set<string>();

  // Look for quoted dialogue speakers: 「XXX」said / "XXX"说
  const speakerPattern = /[「""]([^「""]{1,10})[」""]/g;
  let match: RegExpExecArray | null;
  while ((match = speakerPattern.exec(text)) !== null) {
    const name = match[1]!.trim();
    if (name.length >= 2 && name.length <= 8) {
      mentions.add(name);
    }
  }

  // Look for lines like "XXX说", "XXX道", "XXX看着" (dialogue attribution)
  const attrPattern = /([一-鿿]{2,4})(?:说|道|看着|问道|说道|答道|叹道|笑道|冷声道)/g;
  while ((match = attrPattern.exec(text)) !== null) {
    const name = match[1]!;
    if (name.length >= 2 && name.length <= 4) {
      mentions.add(name);
    }
  }

  return [...mentions];
}
