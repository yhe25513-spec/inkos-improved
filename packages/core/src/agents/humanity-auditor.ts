// ── 真人感27维度审计器（HumanityAuditor） ───────────────────
// 独立于 ContinuityAuditor（结构审计），专做真人感质量审计

import { BaseAgent } from "./base.js";
import type { AuditResult, AuditIssue } from "./continuity.js";
import {
  HUMANITY_DIMENSIONS,
  HUMANITY_LAYER_LABELS,
  type HumanityDimensionLayer,
} from "./humanity-dimensions.js";
import { readBookLanguage } from "./rules-reader.js";
import { readGenreProfile } from "./rules-reader.js";

type PromptLanguage = "zh" | "en";

function normalizeRepairScope(value: unknown): AuditIssue["repairScope"] {
  if (value === "local" || value === "structural" || value === "unknown" || value === "humanity-enhance") {
    return value;
  }
  return undefined;
}

export interface HumanityAuditOptions {
  readonly temperature?: number;
  readonly chapterIntent?: string;
}

export class HumanityAuditor extends BaseAgent {
  get name(): string {
    return "humanity-auditor";
  }

  /**
   * 对章节进行27维度真人感审计
   */
  async auditHumanity(
    bookDir: string,
    chapterContent: string,
    chapterNumber: number,
    genre?: string,
    options?: HumanityAuditOptions,
  ): Promise<AuditResult> {
    const genreId = genre ?? "other";
    const [{ profile: gp }, bookLanguage] = await Promise.all([
      readGenreProfile(this.ctx.projectRoot, genreId),
      readBookLanguage(bookDir),
    ]);
    const language: PromptLanguage = (bookLanguage ?? gp.language) === "en" ? "en" : "zh";

    const systemPrompt = this.buildSystemPrompt(language);
    const userPrompt = this.buildUserPrompt(chapterContent, chapterNumber, language);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: options?.temperature ?? 0.2 },
    );

    const result = this.parseAuditResult(response.content, language);
    return { ...result, tokenUsage: response.usage };
  }

  private buildSystemPrompt(language: PromptLanguage): string {
    const en = language === "en";

    const dimensionList = this.formatDimensionList(language);

    return en
      ? `You are a professional fiction editor specializing in "human feel" quality assessment. You audit chapters across 27 dimensions organized in 5 layers.

## Your Task
Read the chapter carefully and evaluate each of the 27 dimensions below. For each dimension, determine:
- ✅ PASS: The dimension is well-executed
- ⚠️ BASIC PASS: The dimension is present but has minor issues
- ❌ FAIL: The dimension is missing or poorly executed

## Audit Dimensions (27 total)

${dimensionList}

## Output Format
Return a JSON object with this exact structure:
\`\`\`json
{
  "passed": true/false,
  "overall_score": 0-100,
  "summary": "Brief overall assessment",
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "Dimension name (e.g., 'Temperature Switch')",
      "description": "What's wrong, citing specific text from the chapter",
      "suggestion": "Concrete, actionable fix — include the exact text to insert/replace",
      "repair_scope": "humanity-enhance"
    }
  ]
}
\`\`\`

## Scoring Rules
- passed = true when overall_score >= 80 AND no critical issues
- Only output issues for dimensions that are ⚠️ or ❌ (don't list passing dimensions)
- severity "critical" for completely missing dimensions (especially Self-Awareness and Temperature Switch)
- severity "warning" for partially present dimensions
- severity "info" for minor suggestions
- repair_scope MUST be "humanity-enhance" for all issues
- suggestion MUST contain specific, executable text (not vague advice like "add more detail")

## Key Principle
You are auditing for HUMAN FEEL, not structural correctness. A chapter can be structurally perfect but feel "too clean", "too logical", "too AI-like". Your job is to catch these human-feel gaps.`
      : `你是一位专业的小说编辑，专精于"真人感"质量评估。你将对章节进行27个维度的审计，分5个层级。

## 你的任务
仔细阅读章节，对以下27个维度逐一评估。每个维度给出：
- ✅ 通过：该维度执行良好
- ⚠️ 基本通过：该维度存在但有 minor 问题
- ❌ 未通过：该维度缺失或执行很差

## 审计维度（共27个）

${dimensionList}

## 输出格式
返回一个 JSON 对象，结构如下：
\`\`\`json
{
  "passed": true/false,
  "overall_score": 0-100,
  "summary": "简要总体评价",
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "维度名称（如'温度切换'）",
      "description": "问题是什么，引用章节中的具体原文",
      "suggestion": "具体可执行的修复建议——包含要插入/替换的确切文字",
      "repair_scope": "humanity-enhance"
    }
  ]
}
\`\`\`

## 评分规则
- passed = true 当 overall_score >= 80 且无 critical 问题
- 只输出 ⚠️ 和 ❌ 的维度问题（不要列出通过的维度）
- severity "critical" 用于完全缺失的维度（特别是"自我意识"和"温度切换"）
- severity "warning" 用于部分存在的维度
- severity "info" 用于轻微建议
- repair_scope 必须为 "humanity-enhance"
- suggestion 必须包含具体可执行的文字（不要模糊建议如"增加细节"）

## 核心原则
你审计的是"真人感"，不是结构正确性。一章可以结构完美但感觉"太干净""太逻辑""太AI"。你的任务是抓住这些真人感缺口。`;
  }

  private formatDimensionList(language: PromptLanguage): string {
    const layers: HumanityDimensionLayer[] = ["language", "immersion", "structure", "emotion", "narrative"];
    const parts: string[] = [];

    for (const layer of layers) {
      const label = HUMANITY_LAYER_LABELS[layer][language];
      const dims = HUMANITY_DIMENSIONS.filter((d) => d.layer === layer);
      const dimLines = dims
        .map((d) => `  - [${d.id}] ${d.name[language]}: ${d.baseNote}`)
        .join("\n");
      parts.push(`### ${label}（${dims.length}维度）\n${dimLines}`);
    }

    return parts.join("\n\n");
  }

  private buildUserPrompt(
    chapterContent: string,
    chapterNumber: number,
    language: PromptLanguage,
  ): string {
    const en = language === "en";
    return en
      ? `Please audit chapter ${chapterNumber} for human-feel quality across all 27 dimensions.

## Chapter Content
${chapterContent}

## Instructions
1. Read the entire chapter carefully
2. Evaluate each of the 27 dimensions
3. For dimensions that are ⚠️ or ❌, create an issue with specific, actionable suggestions
4. Provide an overall_score (0-100) reflecting the chapter's human-feel quality
5. Set passed=true only if overall_score >= 80 AND no critical issues

Return ONLY the JSON object.`
      : `请对第${chapterNumber}章进行27维度真人感审计。

## 章节正文
${chapterContent}

## 要求
1. 仔细阅读整章内容
2. 对27个维度逐一评估
3. 对 ⚠️ 或 ❌ 的维度，创建包含具体可执行建议的 issue
4. 给出 overall_score（0-100），反映章节的真人感质量
5. 仅当 overall_score >= 80 且无 critical 问题时，passed=true

只返回 JSON 对象。`;
  }

  private parseAuditResult(content: string, language: PromptLanguage): AuditResult {
    // Strategy 1: Find balanced JSON object
    const balanced = this.extractBalancedJson(content);
    if (balanced) {
      const result = this.tryParseAuditJson(balanced, language);
      if (result) return result;
    }

    // Strategy 2: Try the whole content as JSON
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      const result = this.tryParseAuditJson(trimmed, language);
      if (result) return result;
    }

    // Strategy 3: Look for ```json code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      const result = this.tryParseAuditJson(codeBlockMatch[1]!.trim(), language);
      if (result) return result;
    }

    // Strategy 4: Regex field extraction (last resort)
    const passedMatch = content.match(/"passed"\s*:\s*(true|false)/);
    const issuesMatch = content.match(/"issues"\s*:\s*\[([\s\S]*?)\]/);
    const summaryMatch = content.match(/"summary"\s*:\s*"([^"]*)"/);
    if (passedMatch) {
      const issues: AuditIssue[] = [];
      if (issuesMatch) {
        const issuePattern = /\{[^{}]*"severity"\s*:\s*"[^"]*"[^{}]*\}/g;
        let match: RegExpExecArray | null;
        while ((match = issuePattern.exec(issuesMatch[1]!)) !== null) {
          try {
            const issue = JSON.parse(match[0]);
            issues.push({
              severity: issue.severity ?? "warning",
              category: issue.category ?? (language === "en" ? "Uncategorized" : "未分类"),
              description: issue.description ?? "",
              suggestion: issue.suggestion ?? "",
              repairScope: normalizeRepairScope(issue.repair_scope ?? issue.repairScope) ?? "humanity-enhance",
            });
          } catch {
            // skip malformed individual issue
          }
        }
      }
      return {
        passed: passedMatch[1] === "true",
        issues,
        summary: summaryMatch?.[1] ?? "",
      };
    }

    // All strategies failed
    return {
      passed: false,
      parseFailed: true,
      issues: [{
        severity: "critical",
        category: language === "en" ? "System Error" : "系统错误",
        description: language === "en"
          ? "Humanity audit output format was invalid and could not be parsed as JSON."
          : "真人感审计输出格式异常，无法解析为 JSON",
        suggestion: language === "en"
          ? "The model may not support reliable structured output. Try a stronger model."
          : "可能是模型不支持结构化输出。尝试换一个更大的模型。",
        repairScope: "humanity-enhance",
      }],
      summary: language === "en" ? "Audit output parsing failed" : "审计输出解析失败",
    };
  }

  private extractBalancedJson(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
  }

  private tryParseAuditJson(json: string, language: PromptLanguage = "zh"): AuditResult | null {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed.passed !== "boolean" && parsed.passed !== undefined) return null;
      const rawScore = parsed.overall_score ?? parsed.overallScore;
      const overallScore = typeof rawScore === "number" && Number.isFinite(rawScore)
        ? Math.round(Math.max(0, Math.min(100, rawScore)))
        : undefined;
      return {
        passed: Boolean(parsed.passed ?? false),
        issues: Array.isArray(parsed.issues)
          ? parsed.issues.map((i: Record<string, unknown>) => ({
              severity: (i.severity as string) ?? "warning",
              category: (i.category as string) ?? (language === "en" ? "Uncategorized" : "未分类"),
              description: (i.description as string) ?? "",
              suggestion: (i.suggestion as string) ?? "",
              repairScope: normalizeRepairScope(i.repair_scope ?? i.repairScope) ?? "humanity-enhance",
            }))
          : [],
        summary: String(parsed.summary ?? ""),
        overallScore,
      };
    } catch {
      return null;
    }
  }
}
