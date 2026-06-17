import { BaseAgent } from "./base.js";
import type { CharacterVoice } from "../utils/character-voices.js";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface DialogueRound {
  readonly round: number;
  readonly speaker: string;
  readonly line: string;
  readonly emotion: string;
  readonly infoUsed: ReadonlyArray<string>;
}

export interface DialogueConflict {
  readonly type: string;
  readonly participants: ReadonlyArray<string>;
  readonly description: string;
}

export interface InfoGap {
  readonly character: string;
  readonly unknown: ReadonlyArray<string>;
}

export interface DialogueDraft {
  readonly chapterNumber: number;
  readonly participants: ReadonlyArray<string>;
  readonly rounds: ReadonlyArray<DialogueRound>;
  readonly conflicts: ReadonlyArray<DialogueConflict>;
  readonly infoGaps: ReadonlyArray<InfoGap>;
}

export interface RehearsalInput {
  readonly chapterNumber: number;
  readonly chapterMemo: string;
  readonly characters: Record<string, CharacterVoice>;
  readonly currentContext: string;
  readonly maxRounds?: number;
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

function buildSystemPrompt(
  characters: Record<string, CharacterVoice>,
  maxRounds: number,
): string {
  const characterDescriptions = Object.values(characters)
    .map(buildCharacterDescription)
    .join("\n\n");

  return [
    "你是一个角色对话预演引擎。你的任务是模拟章节中角色之间的对话，",
    "帮助作者提前发现对话问题（如角色说话不像自己、信息越界、缺乏冲突）。\n",
    "## 角色档案\n",
    characterDescriptions,
    "\n\n## 预演规则\n",
    `1. 模拟最多 ${maxRounds} 轮对话，每轮由一个角色发言。`,
    "2. **严格遵守信息边界**：每个角色只能使用该角色已知的信息，不能引用其他角色的隐藏信息。",
    "3. **必须包含至少一条冲突**：角色之间应存在至少一处观点、立场或目标上的分歧。",
    "4. **保持角色一致性**：每个角色的台词必须符合其说话风格、用词习惯和性格特征。",
    "5. 记录每条台词引用了哪些信息点（infoUsed），便于审查信息边界。",
    "6. 识别角色之间的信息差（infoGaps）：哪些信息是某个角色不知道的。",
    "\n## 输出格式\n",
    "请严格输出以下 JSON，不要附加任何其他文字：\n",
    "```json",
    "{",
    '  "participants": ["角色A", "角色B"],',
    '  "rounds": [',
    "    {",
    '      "round": 1,',
    '      "speaker": "角色A",',
    '      "line": "台词内容",',
    '      "emotion": "情绪状态",',
    '      "infoUsed": ["引用的信息点"]',
    "    }",
    "  ],",
    '  "conflicts": [',
    "    {",
    '      "type": "冲突类型（如：立场分歧/目标矛盾/信息不对称）",',
    '      "participants": ["冲突参与方"],',
    '      "description": "冲突具体描述"',
    "    }",
    "  ],",
    '  "infoGaps": [',
    "    {",
    '      "character": "角色名",',
    '      "unknown": ["该角色不知道的信息"]',
    "    }",
    "  ]",
    "}",
    "```",
  ].join("\n");
}

function buildUserPrompt(
  chapterNumber: number,
  chapterMemo: string,
  currentContext: string,
): string {
  return [
    `## 第 ${chapterNumber} 章预演\n`,
    "### 章节大纲摘要\n",
    chapterMemo,
    "\n\n### 当前剧情上下文\n",
    currentContext,
    "\n\n请根据以上信息，模拟本章中角色之间的对话。要求角色台词自然、符合各自性格，并包含至少一处冲突。",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// DialogueRehearsal agent
// ---------------------------------------------------------------------------

export class DialogueRehearsal extends BaseAgent {
  get name(): string {
    return "dialogue-rehearsal";
  }

  async rehearse(input: RehearsalInput): Promise<DialogueDraft> {
    const maxRounds = input.maxRounds ?? 5;
    const participantNames = Object.keys(input.characters);

    this.log?.info(
      `[dialogue-rehearsal] 开始预演第 ${input.chapterNumber} 章，角色：${participantNames.join("、")}，最多 ${maxRounds} 轮`,
    );

    const systemPrompt = buildSystemPrompt(input.characters, maxRounds);
    const userPrompt = buildUserPrompt(
      input.chapterNumber,
      input.chapterMemo,
      input.currentContext,
    );

    try {
      const response = await this.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.7 },
      );

      // Extract JSON from response (handle possible markdown fences)
      const raw = response.content.trim();
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : raw;

      const parsed = JSON.parse(jsonString) as {
        participants?: string[];
        rounds?: Array<{
          round?: number;
          speaker?: string;
          line?: string;
          emotion?: string;
          infoUsed?: string[];
        }>;
        conflicts?: Array<{
          type?: string;
          participants?: string[];
          description?: string;
        }>;
        infoGaps?: Array<{
          character?: string;
          unknown?: string[];
        }>;
      };

      const draft: DialogueDraft = {
        chapterNumber: input.chapterNumber,
        participants: parsed.participants ?? participantNames,
        rounds: (parsed.rounds ?? []).map((r, i) => ({
          round: r.round ?? i + 1,
          speaker: r.speaker ?? "未知",
          line: r.line ?? "",
          emotion: r.emotion ?? "",
          infoUsed: r.infoUsed ?? [],
        })),
        conflicts: (parsed.conflicts ?? []).map((c) => ({
          type: c.type ?? "未指定",
          participants: c.participants ?? [],
          description: c.description ?? "",
        })),
        infoGaps: (parsed.infoGaps ?? []).map((g) => ({
          character: g.character ?? "未知",
          unknown: g.unknown ?? [],
        })),
      };

      this.log?.info(
        `[dialogue-rehearsal] 预演完成：${draft.rounds.length} 轮对话，${draft.conflicts.length} 处冲突，${draft.infoGaps.length} 处信息差`,
      );

      return draft;
    } catch (err) {
      this.log?.warn(
        `[dialogue-rehearsal] 预演失败：${err instanceof Error ? err.message : String(err)}`,
      );

      // Return empty draft on failure (never throw)
      return {
        chapterNumber: input.chapterNumber,
        participants: participantNames,
        rounds: [],
        conflicts: [],
        infoGaps: [],
      };
    }
  }
}
