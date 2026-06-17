/**
 * Multi-Agent Writers' Room - Director Agents
 *
 * Quality-check directors that review chapter content for consistency
 * across plot, worldbuilding, power systems, and reader satisfaction.
 * Each director performs an LLM-based analysis and returns a structured
 * DirectorCheck with pass/fail, issues, and a 0-100 score.
 *
 * @module agents/writers-room/directors
 */

import { chatCompletion } from "../../llm/provider.js";
import type { LLMClient, LLMMessage } from "../../llm/provider.js";
import type {
  AgentGraph,
  DirectorCheck,
  DirectorReport,
} from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Temperature for factual / consistency checks. */
const CHECK_TEMPERATURE = 0.3;

/** Weight for each category in the overall score. */
const CATEGORY_WEIGHTS: Record<DirectorCheck["category"], number> = {
  "plot": 0.30,
  "worldbuilding": 0.25,
  "power-system": 0.25,
  "reader-satisfaction": 0.20,
};

/** Minimum overall score to pass all checks. */
const PASS_THRESHOLD = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the raw LLM text into a structured DirectorCheck.
 * Expects the LLM to return JSON with `passed`, `issues`, and `score`.
 */
function parseDirectorResponse(
  raw: string,
  directorName: string,
  category: DirectorCheck["category"],
): DirectorCheck {
  try {
    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      passed?: boolean;
      issues?: Array<{
        severity?: string;
        message?: string;
        suggestion?: string;
      }>;
      score?: number;
    };

    return {
      director: directorName,
      category,
      passed: Boolean(parsed.passed),
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.map((issue) => ({
            severity: validateSeverity(issue.severity),
            message: String(issue.message ?? ""),
            ...(issue.suggestion ? { suggestion: String(issue.suggestion) } : {}),
          }))
        : [],
      score: clampScore(parsed.score),
    };
  } catch {
    // Fallback: treat parse failure as a warning-level issue
    return {
      director: directorName,
      category,
      passed: false,
      issues: [
        {
          severity: "warning",
          message: `${directorName} 返回的 JSON 解析失败，原始输出已跳过`,
        },
      ],
      score: 50,
    };
  }
}

function validateSeverity(raw: string | undefined): "error" | "warning" | "info" {
  if (raw === "error" || raw === "warning" || raw === "info") return raw;
  return "info";
}

function clampScore(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Call the LLM with a director system prompt and chapter content.
 */
async function callDirectorLLM(
  client: LLMClient,
  model: string,
  systemPrompt: string,
  chapterContent: string,
  chapterSummary: string,
  graph: AgentGraph,
): Promise<string> {
  const graphContext = formatGraphContext(graph);

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content:
        `## 作品元数据\n${graphContext}\n\n` +
        `## 章节摘要\n${chapterSummary}\n\n` +
        `## 章节正文\n${chapterContent}\n\n` +
        `请对以上内容进行审查，输出 JSON 格式的检查结果。`,
    },
  ];

  const response = await chatCompletion(client, model, messages, {
    temperature: CHECK_TEMPERATURE,
    maxTokens: 2048,
  });

  return response.content;
}

/**
 * Format the AgentGraph metadata into a context block for the LLM.
 */
function formatGraphContext(graph: AgentGraph): string {
  const lines: string[] = [];
  lines.push(`作品名称：${graph.metadata.name}`);
  lines.push(`作品描述：${graph.metadata.description}`);
  lines.push(`角色数量：${graph.agents.length}`);

  if (graph.agents.length > 0) {
    lines.push("角色列表：");
    for (const agent of graph.agents) {
      lines.push(
        `  - ${agent.name}（${agent.role}）：${agent.description.slice(0, 100)}`,
      );
    }
  }

  if (graph.relationships.length > 0) {
    lines.push("角色关系：");
    for (const rel of graph.relationships) {
      const source = graph.agents.find((a) => a.id === rel.source);
      const target = graph.agents.find((a) => a.id === rel.target);
      if (source && target) {
        lines.push(
          `  - ${source.name} → ${target.name}：${rel.type}（${rel.strength}/100）`,
        );
      }
    }
  }

  return lines.join("\n");
}

// ─── Base Director ────────────────────────────────────────────────────────────

/**
 * Base class for all director agents.
 *
 * Each director performs a specific quality check on chapter content.
 * Subclasses must define `name`, `category`, and implement `check()`.
 */
export abstract class BaseDirector {
  protected readonly client: LLMClient;
  protected readonly model: string;

  abstract readonly name: string;
  abstract readonly category: DirectorCheck["category"];

  constructor(client: LLMClient, model: string) {
    this.client = client;
    this.model = model;
  }

  /**
   * Run the quality check and return a structured DirectorCheck.
   */
  abstract check(
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<DirectorCheck>;

  /**
   * Convenience wrapper: call the LLM with this director's system prompt.
   */
  protected async queryLLM(
    systemPrompt: string,
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<string> {
    return callDirectorLLM(
      this.client,
      this.model,
      systemPrompt,
      chapterContent,
      chapterSummary,
      graph,
    );
  }
}

// ─── Plot Director ────────────────────────────────────────────────────────────

const PLOT_SYSTEM_PROMPT = `你是剧情总监，负责审查小说章节的剧情一致性。

审查要点：
1. 是否存在剧情漏洞（事件因果链断裂、逻辑不通）？
2. 时间线是否正确（时间顺序、间隔是否合理）？
3. 角色动机是否合理（行为是否符合其性格和处境）？
4. 是否有未解决的伏笔或悬念需要跟进？

输出严格的 JSON 格式（不要包含 markdown 围栏）：
{
  "passed": true 或 false,
  "issues": [
    {
      "severity": "error 或 warning 或 info",
      "message": "问题描述",
      "suggestion": "改进建议（可选）"
    }
  ],
  "score": 0 到 100 的整数
}

评分标准：
- 90-100：剧情逻辑严密，无明显问题
- 70-89：整体合理，存在少量小问题
- 50-69：有较明显的剧情问题需要修正
- 0-49：存在严重剧情漏洞`;

export class PlotDirector extends BaseDirector {
  readonly name = "剧情总监";
  readonly category = "plot" as const;

  async check(
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<DirectorCheck> {
    const raw = await this.queryLLM(
      PLOT_SYSTEM_PROMPT,
      chapterContent,
      chapterSummary,
      graph,
    );
    return parseDirectorResponse(raw, this.name, this.category);
  }
}

// ─── Worldbuilding Director ───────────────────────────────────────────────────

const WORLDBUILDING_SYSTEM_PROMPT = `你是世界观总监，负责审查小说章节的世界观一致性。

审查要点：
1. 场景设定是否与已建立的世界观矛盾？
2. 魔法/修炼体系是否违反已设定的规则？
3. 文化背景、社会结构是否前后一致？
4. 地理、历史等设定信息是否准确？

输出严格的 JSON 格式（不要包含 markdown 围栏）：
{
  "passed": true 或 false,
  "issues": [
    {
      "severity": "error 或 warning 或 info",
      "message": "问题描述",
      "suggestion": "改进建议（可选）"
    }
  ],
  "score": 0 到 100 的整数
}

评分标准：
- 90-100：世界观完全自洽，无矛盾
- 70-89：整体一致，存在少量细节偏差
- 50-69：有较明显的世界观设定冲突
- 0-49：存在严重的世界观崩坏`;

export class WorldbuildingDirector extends BaseDirector {
  readonly name = "世界观总监";
  readonly category = "worldbuilding" as const;

  async check(
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<DirectorCheck> {
    const raw = await this.queryLLM(
      WORLDBUILDING_SYSTEM_PROMPT,
      chapterContent,
      chapterSummary,
      graph,
    );
    return parseDirectorResponse(raw, this.name, this.category);
  }
}

// ─── Power System Director ────────────────────────────────────────────────────

const POWER_SYSTEM_SYSTEM_PROMPT = `你是战力总监，负责审查小说章节的战力体系一致性。

审查要点：
1. 角色战力是否出现崩坏（实力忽高忽低、不符合设定）？
2. 能力使用是否合理（能力范围、消耗、限制是否一致）？
3. 战斗场景是否逻辑自洽（胜负是否合理、战术是否可信）？
4. 角色成长是否符合修炼体系的进度规律？

输出严格的 JSON 格式（不要包含 markdown 围栏）：
{
  "passed": true 或 false,
  "issues": [
    {
      "severity": "error 或 warning 或 info",
      "message": "问题描述",
      "suggestion": "改进建议（可选）"
    }
  ],
  "score": 0 到 100 的整数
}

评分标准：
- 90-100：战力体系严谨，战斗逻辑清晰
- 70-89：整体合理，存在少量战力设定偏差
- 50-69：有较明显的战力崩坏问题
- 0-49：战力体系严重混乱`;

export class PowerSystemDirector extends BaseDirector {
  readonly name = "战力总监";
  readonly category = "power-system" as const;

  async check(
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<DirectorCheck> {
    const raw = await this.queryLLM(
      POWER_SYSTEM_SYSTEM_PROMPT,
      chapterContent,
      chapterSummary,
      graph,
    );
    return parseDirectorResponse(raw, this.name, this.category);
  }
}

// ─── Reader Satisfaction Director ─────────────────────────────────────────────

const READER_SATISFACTION_SYSTEM_PROMPT = `你是爽点总监，负责预测读者对这一章的满意度。

审查要点：
1. 节奏是否合适（是否有拖沓或过于仓促的部分）？
2. 张力是否足够（悬念、冲突、紧迫感是否到位）？
3. 情感是否有回报（读者的情感投入是否得到满足）？
4. 是否太容易预测（情节转折是否出人意料）？
5. 爽点是否到位（主角高光、逆袭、打脸等是否令人满足）？

输出严格的 JSON 格式（不要包含 markdown 围栏）：
{
  "passed": true 或 false,
  "issues": [
    {
      "severity": "error 或 warning 或 info",
      "message": "问题描述",
      "suggestion": "改进建议（可选）"
    }
  ],
  "score": 0 到 100 的整数
}

评分标准：
- 90-100：读者会非常满意，节奏和爽点完美
- 70-89：整体体验良好，有提升空间
- 50-69：部分读者可能会感到无聊或失望
- 0-49：读者体验很差，需要大幅改进`;

export class ReaderSatisfactionDirector extends BaseDirector {
  readonly name = "爽点总监";
  readonly category = "reader-satisfaction" as const;

  async check(
    chapterContent: string,
    chapterSummary: string,
    graph: AgentGraph,
  ): Promise<DirectorCheck> {
    const raw = await this.queryLLM(
      READER_SATISFACTION_SYSTEM_PROMPT,
      chapterContent,
      chapterSummary,
      graph,
    );
    return parseDirectorResponse(raw, this.name, this.category);
  }
}

// ─── runAllDirectorChecks ─────────────────────────────────────────────────────

/**
 * Run all four director checks in parallel and produce a unified DirectorReport.
 *
 * @param chapterContent - The full chapter text to review.
 * @param chapterSummary - A brief summary of the chapter.
 * @param graph          - The agent graph with characters, relationships and metadata.
 * @param client         - LLM client for API calls.
 * @param model          - Model identifier to use for all director calls.
 * @returns A DirectorReport with per-category checks, overall score, and recommendations.
 */
export async function runAllDirectorChecks(
  chapterContent: string,
  chapterSummary: string,
  graph: AgentGraph,
  client: LLMClient,
  model: string,
): Promise<DirectorReport> {
  const directors: BaseDirector[] = [
    new PlotDirector(client, model),
    new WorldbuildingDirector(client, model),
    new PowerSystemDirector(client, model),
    new ReaderSatisfactionDirector(client, model),
  ];

  // Run all director checks in parallel for efficiency
  const checks = await Promise.all(
    directors.map((director) =>
      director.check(chapterContent, chapterSummary, graph),
    ),
  );

  // Calculate weighted overall score
  let weightedSum = 0;
  let totalWeight = 0;
  for (const check of checks) {
    const weight = CATEGORY_WEIGHTS[check.category] ?? 0;
    weightedSum += check.score * weight;
    totalWeight += weight;
  }
  const overallScore =
    totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

  // Determine pass/fail: all checks must pass individually, and overall score must meet threshold
  const allPassed = checks.every((c) => c.passed);
  const passed = allPassed && overallScore >= PASS_THRESHOLD;

  // Collect recommendations from non-passing checks and high-severity issues
  const recommendations: string[] = [];
  for (const check of checks) {
    if (!check.passed) {
      recommendations.push(
        `${check.director}未通过（${check.score}分），建议重点修改`,
      );
    }
    for (const issue of check.issues) {
      if (issue.severity === "error" && issue.suggestion) {
        recommendations.push(`[${check.director}] ${issue.suggestion}`);
      }
    }
  }

  // If no specific recommendations, add a generic positive note
  if (recommendations.length === 0) {
    recommendations.push("所有维度检查通过，章节质量良好");
  }

  return {
    chapterNumber: 0, // Caller should set this based on context
    checks,
    overallScore,
    passed,
    recommendations,
  };
}
