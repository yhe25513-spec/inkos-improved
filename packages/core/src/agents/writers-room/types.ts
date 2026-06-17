/**
 * Multi-Agent Writers' Room - Core Type Definitions
 * @module agents/writers-room/types
 */

// ─── Agent Types ──────────────────────────────────────────────────────────────

export interface AgentPersona {
  readonly id: string;
  readonly name: string;
  readonly role: "character" | "meta" | "director";
  readonly description: string;
  readonly goals: ReadonlyArray<string>;
  readonly personality: {
    readonly traits: ReadonlyArray<string>;
    readonly speechStyle: string;
    readonly forbiddenBehaviors: ReadonlyArray<string>;
  };
  readonly prompt: string; // The system prompt for this agent
}

export interface AgentRelationship {
  readonly source: string; // agent id
  readonly target: string; // agent id
  readonly type: "ally" | "enemy" | "neutral" | "superior" | "subordinate" | "protective" | "suspicious";
  readonly strength: number; // 0-100
  readonly description: string;
  readonly lastInteraction?: string;
}

export interface AgentGraph {
  readonly agents: ReadonlyArray<AgentPersona>;
  readonly relationships: ReadonlyArray<AgentRelationship>;
  readonly metadata: {
    readonly name: string;
    readonly description: string;
    readonly version: string;
    readonly createdAt: string;
  };
}

// ─── Discussion Types ─────────────────────────────────────────────────────────

export interface DiscussionMessage {
  readonly agentId: string;
  readonly agentName: string;
  readonly content: string;
  readonly timestamp: number;
  readonly round: number;
  readonly replyTo?: string; // agent id being replied to
  readonly support?: ReadonlyArray<string>; // agents this message supports
  readonly oppose?: ReadonlyArray<string>; // agents this message opposes
}

export interface DiscussionRound {
  readonly round: number;
  readonly topic: string;
  readonly messages: ReadonlyArray<DiscussionMessage>;
  readonly summary: string;
}

export interface DiscussionSession {
  readonly id: string;
  readonly topic: string;
  readonly rounds: ReadonlyArray<DiscussionRound>;
  readonly participants: ReadonlyArray<string>;
  readonly proposals: ReadonlyArray<Proposal>;
  readonly finalDecision?: string;
  readonly startedAt: number;
  readonly endedAt?: number;
}

export interface Proposal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly proposedBy: string;
  readonly supporters: ReadonlyArray<string>;
  readonly opponents: ReadonlyArray<string>;
  readonly score: number; // calculated from votes and relationship weights
}

// ─── Director Types ───────────────────────────────────────────────────────────

export interface DirectorCheck {
  readonly director: string;
  readonly category: "plot" | "worldbuilding" | "power-system" | "reader-satisfaction";
  readonly passed: boolean;
  readonly issues: ReadonlyArray<{
    readonly severity: "error" | "warning" | "info";
    readonly message: string;
    readonly suggestion?: string;
  }>;
  readonly score: number; // 0-100
}

export interface DirectorReport {
  readonly chapterNumber: number;
  readonly checks: ReadonlyArray<DirectorCheck>;
  readonly overallScore: number;
  readonly passed: boolean;
  readonly recommendations: ReadonlyArray<string>;
}
