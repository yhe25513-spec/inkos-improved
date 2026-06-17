/**
 * Multi-Agent Writers' Room - Agent Persona Management
 * @module agents/writers-room/personas
 */

import type { AgentPersona, AgentRelationship, AgentGraph } from "./types.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const GRAPH_FILE = "agent-graph.json";

// ─── File I/O ─────────────────────────────────────────────────────────────────

/**
 * Load agent graph from a book directory.
 * Returns undefined if the file does not exist or is invalid.
 */
export async function loadAgentGraph(bookDir: string): Promise<AgentGraph | undefined> {
  const filePath = join(bookDir, GRAPH_FILE);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    // Basic structural validation
    if (!isAgentGraph(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    // File not found or parse error — return undefined
    return undefined;
  }
}

/**
 * Save agent graph to a book directory.
 * Creates the directory if it does not exist.
 */
export async function saveAgentGraph(bookDir: string, graph: AgentGraph): Promise<void> {
  await mkdir(bookDir, { recursive: true });
  const filePath = join(bookDir, GRAPH_FILE);
  await writeFile(filePath, JSON.stringify(graph, null, 2), "utf-8");
}

// ─── Graph Queries ────────────────────────────────────────────────────────────

/**
 * Get a single agent by its ID.
 */
export function getAgent(graph: AgentGraph, agentId: string): AgentPersona | undefined {
  return graph.agents.find((a) => a.id === agentId);
}

/**
 * Get all agents matching a specific role.
 */
export function getAgentsByRole(
  graph: AgentGraph,
  role: AgentPersona["role"]
): ReadonlyArray<AgentPersona> {
  return graph.agents.filter((a) => a.role === role);
}

/**
 * Get the relationship between two specific agents.
 * Checks both directions: source->target and target->source.
 */
export function getRelationship(
  graph: AgentGraph,
  agentId1: string,
  agentId2: string
): AgentRelationship | undefined {
  return graph.relationships.find(
    (r) =>
      (r.source === agentId1 && r.target === agentId2) ||
      (r.source === agentId2 && r.target === agentId1)
  );
}

/**
 * Get all relationships involving a specific agent (as source or target).
 */
export function getAgentRelationships(
  graph: AgentGraph,
  agentId: string
): ReadonlyArray<AgentRelationship> {
  return graph.relationships.filter(
    (r) => r.source === agentId || r.target === agentId
  );
}

// ─── Speaking Priority ────────────────────────────────────────────────────────

/**
 * Compute a weighted speaking priority for an agent in a discussion round.
 *
 * The priority is based on:
 *   1. Relationship strengths to other agents whose names/goals match topic keywords.
 *   2. A base weight of 10 so every agent always has some voice.
 *
 * Higher values = the agent should speak sooner or at greater length.
 * Returns a value in the range [0, 100].
 */
export function getSpeakingPriority(
  graph: AgentGraph,
  agentId: string,
  topicKeywords: ReadonlyArray<string>
): number {
  const agent = getAgent(graph, agentId);
  if (!agent) {
    return 0;
  }

  // Normalise keywords to lowercase for matching
  const keywords = topicKeywords.map((k) => k.toLowerCase());

  // Find "relevant" agents: those whose name, description, or goals match any keyword
  const relevantIds = new Set<string>();
  for (const other of graph.agents) {
    if (other.id === agentId) continue;

    const haystack = [
      other.name,
      other.description,
      ...other.goals,
    ]
      .join(" ")
      .toLowerCase();

    if (keywords.some((kw) => haystack.includes(kw))) {
      relevantIds.add(other.id);
    }
  }

  // Sum relationship strengths toward relevant agents, normalised to 0-100
  const relationships = getAgentRelationships(graph, agentId);
  let weightedSum = 0;
  let matchCount = 0;

  for (const rel of relationships) {
    const otherId = rel.source === agentId ? rel.target : rel.source;
    if (relevantIds.has(otherId)) {
      // Use the raw strength (already 0-100) with a small bonus for enemy/ally
      let bonus = 1;
      if (rel.type === "enemy" || rel.type === "ally" || rel.type === "protective") {
        bonus = 1.2;
      }
      weightedSum += rel.strength * bonus;
      matchCount++;
    }
  }

  if (matchCount === 0) {
    // No relevant relationships — give a minimal baseline
    return 10;
  }

  // Average strength with a cap at 100
  const priority = Math.min(100, (weightedSum / matchCount) + 10);
  return Math.round(priority);
}

// ─── Internal Validation ──────────────────────────────────────────────────────

function isAgentGraph(value: unknown): value is AgentGraph {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.agents) || !Array.isArray(obj.relationships)) return false;
  if (typeof obj.metadata !== "object" || obj.metadata === null) return false;

  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.name !== "string" || typeof meta.version !== "string") return false;

  return true;
}
