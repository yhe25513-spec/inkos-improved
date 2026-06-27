// ── 长篇连贯性管理类型定义 ────────────────────────────

/** 伏笔重要性级别 */
export type ForeshadowImportance = "critical" | "high" | "medium" | "low";

/** 伏笔状态 */
export type ForeshadowStatus = "pending" | "resolved" | "abandoned";

/** 伏笔 */
export interface Foreshadow {
  id: string;
  bookId: string;
  chapterSet: number;
  content: string;
  status: ForeshadowStatus;
  chapterResolved?: number;
  importance: ForeshadowImportance;
  importanceReason: string;
  relatedEntities: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** 角色状态 */
export interface CharacterState {
  characterId: string;
  characterName: string;
  chapterNumber: number;
  physicalState: string;
  mentalState: string;
  relationships: Relationship[];
  inventory: Item[];
  knowledge: string[];
  secrets: string[];
  goals: string[];
}

/** 关系 */
export interface Relationship {
  targetId: string;
  targetName: string;
  type: string; // friend, enemy, lover, family, etc.
  description: string;
}

/** 物品 */
export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
  acquiredChapter?: number;
}

/** 时间线事件 */
export interface TimelineEvent {
  id: string;
  bookId: string;
  chapterNumber: number;
  storyTime: string;
  duration?: string;
  description: string;
  characters: string[];
  location: string;
  type: "main" | "side" | "flashback";
}

/** 修复方案 */
export interface FixProposal {
  id: string;
  name: string;
  description: string;
  actions: FixAction[];
  priority: "P0" | "P1" | "P2";
}

/** 修复动作 */
export interface FixAction {
  type: "edit_file" | "update_setting" | "add_content";
  targetFile: string;
  oldValue?: string;
  newValue: string;
  description: string;
}

/** 一致性检查结果 */
export interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  proposals: FixProposal[];
  summary: string;
}

/** 一致性问题 */
export interface ConsistencyIssue {
  type: "foreshadow" | "character" | "timeline" | "detail";
  severity: "error" | "warning";
  message: string;
  location: { chapter: number; element: string };
  suggestion: string;
  relatedProposals?: string[];
}

/** 时间线冲突 */
export interface TimelineConflict {
  event1: TimelineEvent;
  event2: TimelineEvent;
  reason: string;
}
