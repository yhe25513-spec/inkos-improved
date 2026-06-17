import { BaseAgent } from "./base.js";
import type { CharacterVoice } from "../utils/character-voices.js";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface DialogueAuditIssue {
  readonly lineNumber: number;
  readonly speaker: string;
  readonly original: string;
  readonly score: number;
  readonly issues: ReadonlyArray<string>;
  readonly suggestion: string;
}

export interface DialogueAuditSummary {
  readonly humanConsistency: number;
  readonly infoBoundary: number;
  readonly emotionReasonability: number;
  readonly dialogueRhythm: number;
  readonly characterDistinctiveness: number;
}

export interface DialogueAuditResult {
  readonly chapterNumber: number;
  readonly totalScore: number;
  readonly passed: boolean;
  readonly dialogues: ReadonlyArray<DialogueAuditIssue>;
  readonly oocIssues: ReadonlyArray<DialogueAuditIssue>;
  readonly summary: DialogueAuditSummary;
}

export interface AuditDialogueInput {
  readonly chapterNumber: number;
  readonly chapterContent: string;
  readonly characters: Record<string, CharacterVoice>;
  readonly threshold?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCharacterDescription(voice: CharacterVoice): string {
  const lines: string[] = [];
  lines.push(`### ${voice.name}`);
  lines.push(`说话风格：${voice.speechStyle}`);
  lines.push(`常用词汇：${voice.vocabulary.join("、")}`);
  lines.push(`禁止语气：${voice.forbiddenTone.join("、")}`);
  lines.push(`性格特征：${voice.personality.join("、")}`);
  lines.push(`情感表达：${voice.emotionalExpression}`);
  if (voice.sampleDialogues.length > 0) {
    lines.push(`示例台词：${voice.sampleDialogues.map((d) => `"${d}"`).join("；")}`);
  }
  if (voice.infoBoundary.length > 0) {
    lines.push(`信息边界（不可透露）：${voice.infoBoundary.join("、")}`);
  }
  return lines.join("\n");
}

function buildSystemPrompt(characters: Record<string, CharacterVoice>): string {
  const characterDescriptions = Object.values(characters)
    .map(buildCharacterDescription)
    .join("\n\n");

  return [
    "你是一个专业的对话审计引擎。你的任务是审查章节正文中的所有对话，",
    "从5个维度评估对话质量，并标记任何不符合角色设定的问题。\n",
    "## 角色档案\n",
    characterDescriptions,
    "\n\n## 审计维度（每项1-10分）\n",
    "1. **人感一致性（humanConsistency）**：对话是否像真人在说话，而非AI生成。检查：语气自然度、口语化程度、是否过于书面/工整、是否有冗余的解释性台词。",
    "2. **信息边界（infoBoundary）**：角色是否泄露了不该知道的信息。检查：角色是否引用了超出其认知范围的信息、是否偷看了其他角色的内心独白或隐藏信息。",
    "3. **情绪合理性（emotionReasonability）**：角色的情绪表达是否与当前情境匹配。检查：情绪转换是否突兀、是否有过度反应或反应不足、情感层次是否合理。",
    "4. **对话节奏（dialogueRhythm）**：对话的长短搭配和停顿是否自然。检查：是否连续多句都是同一角色的长台词、是否有合理的短句/长句交替、是否有恰当的沉默或省略。",
    "5. **角色区分度（characterDistinctiveness）**：不同角色的对话是否有明显的个人特征。检查：是否所有角色说话风格雷同、是否有标志性的口头禅或句式、用词习惯是否有差异。\n",
    "## 输出格式\n",
    "请严格输出以下JSON，不要附加任何其他文字：\n",
    "```json",
    "{",
    '  "dialogues": [',
    "    {",
    '      "lineNumber": 1,',
    '      "speaker": "角色名",',
    '      "original": "原始台词",',
    '      "score": 7,',
    '      "issues": ["存在的问题"],',
    '      "suggestion": "改进建议"',
    "    }",
    "  ],",
    '  "oocIssues": [',
    "    {",
    '      "lineNumber": 1,',
    '      "speaker": "角色名",',
    '      "original": "原始台词",',
    '      "score": 5,',
    '      "issues": ["OOC具体问题"],',
    '      "suggestion": "符合角色的改写建议"',
    "    }",
    "  ],",
    '  "summary": {',
    '    "humanConsistency": 7,',
    '    "infoBoundary": 8,',
    '    "emotionReasonability": 6,',
    '    "dialogueRhythm": 7,',
    '    "characterDistinctiveness": 8',
    "  }",
    "}",
    "```",
    "\n## 说明\n",
    "- dialogues：列出所有有问题的对话行（得分低于7分的才列出）。",
    "- oocIssues：专门列出角色严重OOC（Out Of Character）的对话行。",
    "- summary：5个维度的整体评分（1-10）。",
    "- 每个issue需要指出具体问题，suggestion需要给出可直接替换的改写方案。",
  ].join("\n");
}

function buildUserPrompt(chapterNumber: number, chapterContent: string): string {
  return [
    `## 审计第 ${chapterNumber} 章对话\n`,
    "请审计以下章节正文中所有对话的质量，按照5个维度评分并给出改进建议。\n",
    "### 章节正文\n",
    chapterContent,
  ].join("\n");
}

function defaultResult(chapterNumber: number): DialogueAuditResult {
  return {
    chapterNumber,
    totalScore: 5,
    passed: false,
    dialogues: [],
    oocIssues: [],
    summary: {
      humanConsistency: 5,
      infoBoundary: 5,
      emotionReasonability: 5,
      dialogueRhythm: 5,
      characterDistinctiveness: 5,
    },
  };
}

// ---------------------------------------------------------------------------
// DialogueAuditor agent
// ---------------------------------------------------------------------------

export class DialogueAuditor extends BaseAgent {
  get name(): string {
    return "dialogue-auditor";
  }

  async auditDialogues(input: AuditDialogueInput): Promise<DialogueAuditResult> {
    const threshold = input.threshold ?? 7;
    const characterNames = Object.keys(input.characters);

    this.log?.info(
      `[dialogue-auditor] 开始审计第 ${input.chapterNumber} 章对话，角色：${characterNames.join("、")}，阈值：${threshold}`,
    );

    const systemPrompt = buildSystemPrompt(input.characters);
    const userPrompt = buildUserPrompt(input.chapterNumber, input.chapterContent);

    try {
      const response = await this.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.3 },
      );

      // Extract JSON from response (handle possible markdown fences)
      const raw = response.content.trim();
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : raw;

      const parsed = JSON.parse(jsonString) as {
        dialogues?: Array<{
          lineNumber?: number;
          speaker?: string;
          original?: string;
          score?: number;
          issues?: string[];
          suggestion?: string;
        }>;
        oocIssues?: Array<{
          lineNumber?: number;
          speaker?: string;
          original?: string;
          score?: number;
          issues?: string[];
          suggestion?: string;
        }>;
        summary?: {
          humanConsistency?: number;
          infoBoundary?: number;
          emotionReasonability?: number;
          dialogueRhythm?: number;
          characterDistinctiveness?: number;
        };
      };

      const summary: DialogueAuditSummary = {
        humanConsistency: parsed.summary?.humanConsistency ?? 5,
        infoBoundary: parsed.summary?.infoBoundary ?? 5,
        emotionReasonability: parsed.summary?.emotionReasonability ?? 5,
        dialogueRhythm: parsed.summary?.dialogueRhythm ?? 5,
        characterDistinctiveness: parsed.summary?.characterDistinctiveness ?? 5,
      };

      const totalScore =
        (summary.humanConsistency +
          summary.infoBoundary +
          summary.emotionReasonability +
          summary.dialogueRhythm +
          summary.characterDistinctiveness) /
        5;

      const dialogues: DialogueAuditIssue[] = (parsed.dialogues ?? []).map((d) => ({
        lineNumber: d.lineNumber ?? 0,
        speaker: d.speaker ?? "未知",
        original: d.original ?? "",
        score: d.score ?? 5,
        issues: d.issues ?? [],
        suggestion: d.suggestion ?? "",
      }));

      const oocIssues: DialogueAuditIssue[] = (parsed.oocIssues ?? []).map((d) => ({
        lineNumber: d.lineNumber ?? 0,
        speaker: d.speaker ?? "未知",
        original: d.original ?? "",
        score: d.score ?? 5,
        issues: d.issues ?? [],
        suggestion: d.suggestion ?? "",
      }));

      const result: DialogueAuditResult = {
        chapterNumber: input.chapterNumber,
        totalScore: Math.round(totalScore * 100) / 100,
        passed: totalScore >= threshold,
        dialogues,
        oocIssues,
        summary,
      };

      this.log?.info(
        `[dialogue-auditor] 审计完成：总分 ${result.totalScore}，${result.passed ? "通过" : "未通过"}，${dialogues.length} 处问题，${oocIssues.length} 处OOC`,
      );

      return result;
    } catch (err) {
      this.log?.warn(
        `[dialogue-auditor] 审计失败：${err instanceof Error ? err.message : String(err)}`,
      );

      return defaultResult(input.chapterNumber);
    }
  }
}
