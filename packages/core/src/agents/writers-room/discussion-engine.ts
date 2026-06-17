/**
 * Multi-Agent Writers' Room - Discussion Engine
 *
 * Orchestrates round-based multi-agent conversations. Each round every
 * participant speaks once, ordered by speaking-priority. After 3-5 rounds
 * agents may propose solutions; proposals are scored by supporter weight,
 * relationship diversity and agent role.
 *
 * @module agents/writers-room/discussion-engine
 */

import { randomUUID } from "node:crypto";
import { chatCompletion } from "../../llm/provider.js";
import type { LLMClient, LLMMessage } from "../../llm/provider.js";
import type {
  AgentGraph,
  AgentPersona,
  DiscussionMessage,
  DiscussionRound,
  DiscussionSession,
  Proposal,
} from "./types.js";
import { getAgent, getAgentRelationships, getSpeakingPriority, getRelationship } from "./personas.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum rounds before proposals can be generated. */
const MIN_ROUNDS_BEFORE_PROPOSAL = 3;

/** Maximum rounds the engine will run before forcing a wrap-up. */
const MAX_ROUNDS = 5;

/** Default temperature for creative discussion. */
const DISCUSSION_TEMPERATURE = 0.7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract naive keyword tokens from a topic string.
 * Splits on whitespace and punctuation; keeps tokens >= 2 chars.
 */
function topicKeywords(topic: string): ReadonlyArray<string> {
  return topic
    .split(/[\s,.;:!?，。；：！？、]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * Build the relationship context block for a given agent.
 */
function buildRelationshipContext(
  graph: AgentGraph,
  agentId: string,
): string {
  const relationships = getAgentRelationships(graph, agentId);
  if (relationships.length === 0) {
    return "（暂无其他角色关系）";
  }

  const lines: string[] = [];
  for (const rel of relationships) {
    const otherId = rel.source === agentId ? rel.target : rel.source;
    const other = getAgent(graph, otherId);
    if (!other) continue;

    const direction =
      rel.source === agentId
        ? `你对${other.name}`
        : `${other.name}对你`;
    lines.push(`- ${direction}：${rel.type}（强度 ${rel.strength}/100）— ${rel.description}`);
  }

  return lines.join("\n");
}

/**
 * Build the prior-messages context block.
 */
function buildMessagesContext(
  messages: ReadonlyArray<DiscussionMessage>,
): string {
  if (messages.length === 0) {
    return "（暂无之前发言）";
  }

  return messages
    .map((m) => `[${m.agentName}] ${m.content}`)
    .join("\n");
}

/**
 * Determine whether any agent has emitted a proposal-style message in the
 * latest round (simple heuristic: message contains "提议" or "方案").
 */
function roundContainsProposal(round: DiscussionRound): boolean {
  return round.messages.some(
    (m) => m.content.includes("提议") || m.content.includes("方案"),
  );
}

// ─── DiscussionEngine ─────────────────────────────────────────────────────────

export class DiscussionEngine {
  private readonly graph: AgentGraph;
  private readonly client: LLMClient;
  private readonly model: string;

  constructor(graph: AgentGraph, client: LLMClient, model: string) {
    this.graph = graph;
    this.client = client;
    this.model = model;
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  /**
   * Start a new discussion session for the given topic.
   * All graph agents participate unless they are role "director".
   */
  async startSession(topic: string): Promise<DiscussionSession> {
    const participants = this.graph.agents
      .filter((a) => a.role !== "director")
      .map((a) => a.id);

    return {
      id: randomUUID(),
      topic,
      rounds: [],
      participants,
      proposals: [],
      startedAt: Date.now(),
    };
  }

  /**
   * Run a single round of discussion: every participant speaks once,
   * ordered by speaking-priority. Returns the completed round.
   *
   * After `MIN_ROUNDS_BEFORE_PROPOSAL` rounds the engine will also
   * extract proposals from the round's messages.
   */
  async runRound(session: DiscussionSession): Promise<DiscussionRound> {
    const roundNumber = session.rounds.length + 1;
    const keywords = topicKeywords(session.topic);

    // Determine speaking order via priority
    const speakers = [...session.participants]
      .map((id) => ({
        id,
        priority: getSpeakingPriority(this.graph, id, keywords),
      }))
      .sort((a, b) => b.priority - a.priority);

    const messages: DiscussionMessage[] = [];

    for (const { id } of speakers) {
      const agent = getAgent(this.graph, id);
      if (!agent) continue;

      const previousMessages = [...session.rounds.flatMap((r) => r.messages), ...messages];
      const content = await this.getAgentResponse(
        agent,
        session.topic,
        previousMessages,
        `这是第 ${roundNumber} 轮讨论。`,
      );

      messages.push({
        agentId: id,
        agentName: agent.name,
        content,
        timestamp: Date.now(),
        round: roundNumber,
      });
    }

    // Build a brief round summary via LLM
    const summary = await this.buildRoundSummary(session.topic, messages);

    const round: DiscussionRound = {
      round: roundNumber,
      topic: session.topic,
      messages,
      summary,
    };

    return round;
  }

  /**
   * Get a single agent's response to the current discussion context.
   */
  async getAgentResponse(
    agent: AgentPersona,
    topic: string,
    previousMessages: ReadonlyArray<DiscussionMessage>,
    context: string,
  ): Promise<string> {
    const relationshipContext = buildRelationshipContext(this.graph, agent.id);
    const messagesContext = buildMessagesContext(previousMessages);

    const systemPrompt = [
      `你是${agent.name}。`,
      "",
      agent.prompt,
      "",
      `当前讨论话题：${topic}`,
      "",
      "你与其他角色的关系：",
      relationshipContext,
      "",
      "之前的讨论：",
      messagesContext,
      "",
      context,
      "",
      "请基于你的性格和目标，对这个话题发表你的看法。",
      "如果想要提出具体方案，请在发言中明确说明「提议」或「方案」。",
    ].join("\n");

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: topic },
    ];

    const response = await chatCompletion(this.client, this.model, messages, {
      temperature: DISCUSSION_TEMPERATURE,
    });

    return response.content;
  }

  // ── Proposal scoring ──────────────────────────────────────────────────────

  /**
   * Calculate proposal scores for the session.
   *
   * A "proposal" is extracted from messages that contain "提议" or "方案".
   * Each proposal is scored by:
   *   1. Weighted supporter count (relationship strength between proposer and supporters)
   *   2. Relationship diversity (supported by agents of different relationship types)
   *   3. Agent role weight (character > meta)
   */
  calculateProposalScores(session: DiscussionSession): ReadonlyArray<Proposal> {
    const proposals: Proposal[] = [];
    let proposalId = 0;

    for (const round of session.rounds) {
      for (const msg of round.messages) {
        if (!msg.content.includes("提议") && !msg.content.includes("方案")) {
          continue;
        }

        proposalId++;

        // Determine supporters and opponents from subsequent messages
        const supporters: string[] = [];
        const opponents: string[] = [];

        for (const laterRound of session.rounds) {
          if (laterRound.round <= round.round) continue;
          for (const laterMsg of laterRound.messages) {
            if (laterMsg.agentId === msg.agentId) continue;

            const lowerContent = laterMsg.content.toLowerCase();
            if (
              lowerContent.includes("支持") ||
              lowerContent.includes("同意") ||
              lowerContent.includes("赞同") ||
              lowerContent.includes("好主意")
            ) {
              supporters.push(laterMsg.agentId);
            } else if (
              lowerContent.includes("反对") ||
              lowerContent.includes("不行") ||
              lowerContent.includes("不同意") ||
              lowerContent.includes("拒绝")
            ) {
              opponents.push(laterMsg.agentId);
            }
          }
        }

        const score = this.computeScore(msg.agentId, supporters, opponents);
        const title = msg.content.slice(0, 60).replace(/\n/g, " ");
        const description = msg.content;

        proposals.push({
          id: `proposal-${proposalId}`,
          title,
          description,
          proposedBy: msg.agentId,
          supporters,
          opponents,
          score,
        });
      }
    }

    return proposals.sort((a, b) => b.score - a.score);
  }

  // ── Summarisation ─────────────────────────────────────────────────────────

  /**
   * Summarise the entire discussion session into a concise decision text.
   */
  async summarizeDiscussion(session: DiscussionSession): Promise<string> {
    const proposals = this.calculateProposalScores(session);
    const roundSummaries = session.rounds
      .map((r) => `第${r.round}轮: ${r.summary}`)
      .join("\n");

    const proposalText =
      proposals.length > 0
        ? proposals
            .map(
              (p) =>
                `- [${p.title}] 由 ${this.getAgentName(p.proposedBy)} 提出，得分 ${p.score}，支持者: ${p.supporters.map((s) => this.getAgentName(s)).join(", ") || "无"}`,
            )
            .join("\n")
        : "（无提案）";

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: [
          "你是一个讨论总结助手。请根据以下讨论记录和提案评分，给出简洁的总结和最终决策建议。",
          "",
          "讨论话题：" + session.topic,
          "",
          "各轮摘要：",
          roundSummaries,
          "",
          "提案评分：",
          proposalText,
          "",
          "请输出：",
          "1. 讨论要点总结（2-3句话）",
          "2. 最佳提案及其理由",
          "3. 最终决策建议",
        ].join("\n"),
      },
      { role: "user", content: "请总结这次讨论。" },
    ];

    const response = await chatCompletion(this.client, this.model, messages, {
      temperature: 0.3, // Lower temperature for factual summary
    });

    return response.content;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Compute a weighted score for a proposal.
   */
  private computeScore(
    proposerId: string,
    supporters: ReadonlyArray<string>,
    opponents: ReadonlyArray<string>,
  ): number {
    let score = 0;

    // 1. Weighted supporter count
    for (const supporterId of supporters) {
      const rel = getRelationship(this.graph, proposerId, supporterId);
      const strength = rel?.strength ?? 30;
      score += strength * 0.5;
    }

    // 2. Opponent penalty
    for (const opponentId of opponents) {
      const rel = getRelationship(this.graph, proposerId, opponentId);
      const strength = rel?.strength ?? 30;
      score -= strength * 0.3;
    }

    // 3. Relationship diversity bonus
    const relationshipTypes = new Set<string>();
    for (const supporterId of supporters) {
      const rel = getRelationship(this.graph, proposerId, supporterId);
      if (rel) relationshipTypes.add(rel.type);
    }
    score += relationshipTypes.size * 10;

    // 4. Agent role weight
    const proposer = getAgent(this.graph, proposerId);
    if (proposer) {
      if (proposer.role === "character") score += 15;
      else if (proposer.role === "meta") score += 10;
      else score += 5;
    }

    return Math.round(score);
  }

  /**
   * Look up an agent's display name by id; falls back to the raw id.
   */
  private getAgentName(agentId: string): string {
    return getAgent(this.graph, agentId)?.name ?? agentId;
  }

  /**
   * Build a short summary of a single round via LLM.
   */
  private async buildRoundSummary(
    topic: string,
    messages: ReadonlyArray<DiscussionMessage>,
  ): Promise<string> {
    const transcript = messages
      .map((m) => `${m.agentName}: ${m.content}`)
      .join("\n");

    const llmMessages: LLMMessage[] = [
      {
        role: "system",
        content: "你是一个讨论摘要助手。请用一两句话总结以下讨论轮次的核心观点和分歧。",
      },
      {
        role: "user",
        content: `话题：${topic}\n\n发言记录：\n${transcript}`,
      },
    ];

    const response = await chatCompletion(this.client, this.model, llmMessages, {
      temperature: 0.3,
    });

    return response.content;
  }
}
