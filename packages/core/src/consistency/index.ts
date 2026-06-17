// ── 长篇连贯性管理模块 ────────────────────────────────

export type {
  ForeshadowImportance,
  ForeshadowStatus,
  Foreshadow,
  CharacterState,
  Relationship,
  Item,
  TimelineEvent,
  ConsistencyIssue,
  TimelineConflict,
} from "./types.js";

export { ForeshadowTracker } from "./foreshadow-tracker.js";
export { CharacterStateSync } from "./character-state-sync.js";
export { TimelineManager } from "./timeline-manager.js";
export { ConsistencyChecker } from "./consistency-checker.js";
