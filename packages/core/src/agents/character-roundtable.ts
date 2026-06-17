/**
 * Character Roundtable Discussion Agent
 *
 * 角色圆桌讨论：在章节写作前，让每个主要角色从自己的视角出发，
 * 对即将发生的情节进行批判性审视，发现 OOC 风险、逻辑漏洞、
 * 对话不合理之处，输出综合结论指导写作。
 *
 * 讨论流程：
 * 1. CharacterDiscussionModerator 主持：把章节意图拆解成讨论议题
 * 2. 每个角色 CriticAgent 从自身视角审视情节
 * 3. 角色之间可能产生分歧（Moderator 识别并记录）
 * 4. Moderator 综合所有意见，输出结构化的写作指导
 */

import { BaseAgent, type AgentContext } from "./base.js";
import type { CharacterVoice } from "../utils/character-voices.js";
import type { ChapterMemo, ContextPackage } from "../models/input-governance.js";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** 单个角色对情节的审视意见 */
export interface CharacterCritique {
  readonly characterName: string;
  readonly perspective: string; // "主角视角" / "反派视角" / "旁观者视角"
  readonly oocRisks: ReadonlyArray<string>; // OOC 风险点
  readonly logicFlaws: ReadonlyArray<string>; // 逻辑漏洞
  readonly dialogueIssues: ReadonlyArray<string>; // 对话不合理之处
  readonly emotionalGaps: ReadonlyArray<string>; // 情感缺失
  readonly suggestions: ReadonlyArray<string>; // 修改建议
  readonly confidence: number; // 这个角色对这段情节的"认同度" 0-1
}

/** 角色之间的分歧 */
export interface CharacterConflict {
  readonly characterA: string;
  readonly characterB: string;
  readonly description: string;
  readonly resolution?: string; // 如果分歧可以调和，给出建议
}

/** 圆桌讨论的最终结论 */
export interface RoundtableResult {
  readonly chapterNumber: number;
  readonly totalCritiques: number;
  readonly critiques: ReadonlyArray<CharacterCritique>;
  readonly conflicts: ReadonlyArray<CharacterConflict>;
  readonly consensusIssues: ReadonlyArray<string>; // 所有角色都质疑的问题
  readonly writingGuidance: ReadonlyArray<string>; // 给写手的具体指令
  readonly dialogueGuidelines: ReadonlyArray<string>; // 对话风格调整建议
  readonly mustAvoid: ReadonlyArray<string>; // 绝对不能出现的内容
  readonly oocWarnings: ReadonlyArray<string>; // OOC 高风险点，需要特别处理
  /** 格式化后的写作约束块，可直接注入到 WriterAgent 的 system prompt */
  readonly constraintsBlock: string;
}

/** 输入参数 */
// 讨论进度事件类型
export type RoundtableEvent =
  | { type: "discussion-start"; chapterNumber: number; participants: string[] }
  | { type: "moderator-ready"; topics: ReadonlyArray<DiscussionTopic> }
  | { type: "character-speaking"; characterName: string; perspective: string; content: string }
  | { type: "character-finished"; characterName: string; critique: CharacterCritique }
  | { type: "conflict-detected"; conflict: CharacterConflict }
  | { type: "discussion-complete"; result: RoundtableResult };

export interface RoundtableInput {
  readonly chapterNumber: number;
  readonly chapterMemo: string; // 章节大纲摘要
  readonly chapterIntent: string; // 章节写作意图
  readonly characters: Record<string, CharacterVoice>; // 角色档案（说话风格、性格、信息边界等）
  readonly currentContext: string; // 当前剧情上下文
  readonly contextPackage?: ContextPackage; // 完整上下文包（可选）
  readonly excludedCharacters?: ReadonlyArray<string>; // 本章不参与讨论的角色
  readonly maxCharacters?: number; // 最多参与讨论的角色数（默认 4）
  /** 实时事件回调，用于 UI 展示讨论过程 */
  readonly onEvent?: (event: RoundtableEvent) => void;
}

export interface ModeratorInput {
  readonly chapterNumber: number;
  readonly chapterMemo: string;
  readonly chapterIntent: string;
  readonly characterProfiles: ReadonlyArray<CharacterProfile>;
  readonly currentContext: string;
}

export interface ModeratorResult {
  readonly discussionTopics: ReadonlyArray<DiscussionTopic>;
  readonly characterAssignments: ReadonlyArray<CharacterAssignment>;
  readonly sceneAnalysis: string; // 对整个场景的分析
}

export interface DiscussionTopic {
  readonly topicId: number;
  readonly topic: string; // 讨论议题
  readonly description: string; // 议题描述
  readonly relevantCharacters: ReadonlyArray<string>; // 与此议题相关的角色
  readonly perspective: string; // 应该从什么视角来讨论
}

export interface CharacterAssignment {
  readonly characterName: string;
  readonly assignedTopics: ReadonlyArray<number>; // 被分配的议题 ID
  readonly critiqueFocus: string; // 批判重点
  readonly perspective: string; // 视角定位
}

export interface CharacterProfile {
  readonly name: string;
  readonly personality: ReadonlyArray<string>;
  readonly speechStyle: string;
  readonly forbiddenTone: ReadonlyArray<string>;
  readonly infoBoundary: ReadonlyArray<string>;
  readonly emotionalExpression: string;
  readonly role: string; // "protagonist" | "antagonist" | "supporting" | "love-interest"
  readonly relationshipToOthers: Record<string, string>; // 与其他角色的关系
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildCharacterCritiqueSystemPrompt(voice: CharacterVoice, perspective: string): string {
  return [
    `你扮演的是小说中的角色「${voice.name}」，正在参与一场创作讨论会议。`,
    "",
    `## 你的角色档案`,
    `说话风格：${voice.speechStyle}`,
    `性格特征：${voice.personality.join("、")}`,
    `禁止语气：${voice.forbiddenTone.join("、")}`,
    `情感表达：${voice.emotionalExpression}`,
    `信息边界（你不知道的事）：${voice.infoBoundary.join("、")}`,
    "",
    `## 你的视角定位`,
    perspective,
    "",
    `## 你的任务`,
    '作为这个角色，你需要从"第一人称沉浸视角"审视即将发生的剧情。',
    "",
    "问自己以下问题：",
    "1. **OOC 检查**：如果我是这个角色，我会这样做/说吗？符合我的人设吗？",
    "2. **逻辑检查**：从我的立场出发，这段情节有没有不合理的地方？",
    '3. **信息边界**：这段情节里，我会不会知道一些"我根本不可能知道"的信息？',
    "4. **情感检查**：如果我是这个角色，面对这个情况，我会是什么情绪？情绪表达自然吗？",
    "5. **对话检查**：如果我要说话，会用什么语气？说哪些词？",
    "",
    "## 输出格式（严格 JSON）",
    "```json",
    "{",
    '  "characterName": "角色名",',
    '  "perspective": "视角描述",',
    '  "oocRisks": ["OOC风险点1", "OOC风险点2"],',
    '  "logicFlaws": ["逻辑漏洞1", "逻辑漏洞2"],',
    '  "dialogueIssues": ["对话问题1", "对话问题2"],',
    '  "emotionalGaps": ["情感缺失点1", "情感缺失点2"],',
    '  "suggestions": ["修改建议1", "修改建议2"],',
    '  "confidence": 0.7',
    "}",
    "```",
    "",
    "注意：",
    "- oocRisks 和 logicFlaws 是最重要的，发现问题比提建议更重要",
    '- confidence 表示"作为这个角色，我对这段情节的认同程度"（0=完全不符合，1=完全符合）',
    "- 如果角色觉得情节完全不合理，confidence 可以很低（0.2-0.3），这时 oocRisks 要详细说明为什么",
    '- 信息边界检查：角色不能"偷看"其他角色的内心，不能知道还没发生的事',
  ].join("\n");
}

function buildCharacterCritiqueUserPrompt(
  characterName: string,
  chapterMemo: string,
  chapterIntent: string,
  currentContext: string,
  critiqueFocus: string,
): string {
  return [
    `## 你是「${characterName}」`,
    `你正在参与一个创作讨论会。主持人给你分配了以下批判任务：`,
    "",
    `**批判重点**：${critiqueFocus}`,
    "",
    `## 即将发生的情节（大纲）`,
    chapterMemo,
    "",
    `## 本章的写作意图`,
    chapterIntent,
    "",
    `## 当前剧情上下文`,
    currentContext,
    "",
    '请从"' + characterName + '"的视角，审视以上情节。输出 JSON。',
  ].join("\n");
}

function buildModeratorSystemPrompt(): string {
  return [
    '你是一个创作讨论主持人。你负责主持一场"角色圆桌会议"，',
    "让即将出场的主要角色对章节情节进行批判性审视。",
    "",
    "## 你的职责",
    "1. **分析章节**：理解本章要写什么，找出核心冲突点和关键场景",
    "2. **拆解议题**：把章节分解成若干个值得讨论的议题",
    "3. **分配角色**：让最相关的角色来讨论每个议题",
    "4. **识别分歧**：注意不同角色之间可能产生的观点冲突",
    "",
    "## 讨论议题类型",
    "- 核心冲突：这个情节的核心矛盾是什么？各方立场清晰吗？",
    "- 人物动机：每个角色做这件事的内心驱动力是什么？合理吗？",
    "- 情感节点：情感高潮或转折点安排是否合理？",
    "- 对话场景：哪些对话是本章的关键？涉及哪些角色？",
    "- 逻辑链条：情节推进的因果关系是否通顺？",
    '- 信息披露：哪些信息在什么时机揭露？角色是否"知道得太多"？',
    "",
    "## 输出格式（严格 JSON）",
    "```json",
    "{",
    '  "discussionTopics": [',
    "    {",
    '      "topicId": 1,',
    '      "topic": "议题标题",',
    '      "description": "议题的具体描述",',
    '      "relevantCharacters": ["角色A", "角色B"],',
    '      "perspective": "应该从什么视角来讨论"',
    "    }",
    "  ],",
    '  "characterAssignments": [',
    "    {",
    '      "characterName": "角色名",',
    '      "assignedTopics": [1, 2],',
    '      "critiqueFocus": "这个角色的批判重点",',
    '      "perspective": "视角定位（如：第一人称沉浸视角）"',
    "    }",
    "  ],",
    '  "sceneAnalysis": "对整个场景的综合分析（1-2段）"',
    "}",
    "```",
  ].join("\n");
}

function buildModeratorUserPrompt(input: ModeratorInput): string {
  const charactersList = input.characterProfiles
    .map((c) => `- ${c.name}（${c.role}）：${c.personality.join("、")}`)
    .join("\n");

  return [
    `## 第 ${input.chapterNumber} 章 圆桌讨论准备`,
    "",
    `### 本章大纲摘要`,
    input.chapterMemo,
    "",
    `### 本章写作意图`,
    input.chapterIntent,
    "",
    `### 当前剧情上下文`,
    input.currentContext,
    "",
    `### 参与讨论的角色`,
    charactersList,
    "",
    "请主持这场讨论，准备讨论议题和角色分配。输出 JSON。",
  ].join("\n");
}

function buildSynthesisSystemPrompt(): string {
  return [
    "你是一个创作决策综合器。角色圆桌讨论已经结束，你需要综合所有角色的意见，",
    "形成一份给写手的具体写作指导。",
    "",
    "## 你的任务",
    "1. 找出所有角色都质疑的问题（consensusIssues）——这些必须优先处理",
    "2. 识别角色之间的分歧（conflicts）——有些分歧是好的（增加戏剧张力），有些需要调和",
    "3. 提取具体的写作指令（writingGuidance）——可操作的、明确的指令，不是泛泛而谈",
    "4. 整理对话风格调整建议（dialogueGuidelines）——每个角色应该怎么说话",
    "5. 列出 mustAvoid（绝对不能出现的内容）和 oocWarnings（高风险点）",
    "",
    "## 输出格式（严格 JSON）",
    "```json",
    "{",
    '  "consensusIssues": ["所有角色都质疑的问题1", "问题2"],',
    '  "conflicts": [',
    "    {",
    '      "characterA": "角色A",',
    '      "characterB": "角色B",',
    '      "description": "分歧描述",',
    '      "resolution": "建议如何处理（如果有的话）"',
    "    }",
    "  ],",
    '  "writingGuidance": ["给写手的指令1", "指令2", "指令3"],',
    '  "dialogueGuidelines": ["对话风格建议1", "建议2"],',
    '  "mustAvoid": ["绝对不能出现的内容1", "内容2"],',
    '  "oocWarnings": ["OOC高风险点1", "高风险点2"]',
    "}",
    "```",
  ].join("\n");
}

function buildSynthesisUserPrompt(
  chapterNumber: number,
  critiques: ReadonlyArray<CharacterCritique>,
  chapterMemo: string,
): string {
  const critiqueTexts = critiques
    .map(
      (c) =>
        `【${c.characterName}】\n` +
        `认同度：${c.confidence}\n` +
        `OOC风险：${c.oocRisks.join("；")}\n` +
        `逻辑漏洞：${c.logicFlaws.join("；")}\n` +
        `对话问题：${c.dialogueIssues.join("；")}\n` +
        `情感缺失：${c.emotionalGaps.join("；")}\n` +
        `建议：${c.suggestions.join("；")}`,
    )
    .join("\n\n");

  return [
    `## 第 ${chapterNumber} 章 角色讨论结论汇总`,
    "",
    `### 章节大纲`,
    chapterMemo,
    "",
    `### 角色讨论记录`,
    critiqueTexts,
    "",
    "请综合以上讨论，输出最终结论。输出 JSON。",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildCharacterProfile(voice: CharacterVoice, role: string): CharacterProfile {
  return {
    name: voice.name,
    personality: voice.personality,
    speechStyle: voice.speechStyle,
    forbiddenTone: voice.forbiddenTone,
    infoBoundary: voice.infoBoundary,
    emotionalExpression: voice.emotionalExpression,
    role,
    relationshipToOthers: {}, // 后续可以从 character matrix 填充
  };
}

function parseJsonOrFallback<T>(raw: string, fallback: T): T {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function defaultCritique(name: string, perspective: string): CharacterCritique {
  return {
    characterName: name,
    perspective,
    oocRisks: [],
    logicFlaws: [],
    dialogueIssues: [],
    emotionalGaps: [],
    suggestions: [],
    confidence: 0.5,
  };
}

function defaultRoundtableResult(chapterNumber: number): RoundtableResult {
  return {
    chapterNumber,
    totalCritiques: 0,
    critiques: [],
    conflicts: [],
    consensusIssues: [],
    writingGuidance: [],
    dialogueGuidelines: [],
    mustAvoid: [],
    oocWarnings: [],
    constraintsBlock: "",
  };
}

// ---------------------------------------------------------------------------
// DiscussionModerator agent
// ---------------------------------------------------------------------------

export class DiscussionModerator extends BaseAgent {
  get name(): string {
    return "discussion-moderator";
  }

  async prepareDiscussion(input: ModeratorInput): Promise<ModeratorResult> {
    this.log?.info(`[moderator] 准备第 ${input.chapterNumber} 章讨论`);

    try {
      const response = await this.chat(
        [
          { role: "system", content: buildModeratorSystemPrompt() },
          { role: "user", content: buildModeratorUserPrompt(input) },
        ],
        { temperature: 0.4, maxTokens: 2048 },
      );

      return parseJsonOrFallback<ModeratorResult>(response.content, {
        discussionTopics: [],
        characterAssignments: [],
        sceneAnalysis: "（场景分析未生成）",
      });
    } catch (err) {
      this.log?.warn(`[moderator] 准备讨论失败: ${err}`);
      return {
        discussionTopics: [],
        characterAssignments: [],
        sceneAnalysis: "（讨论准备失败）",
      };
    }
  }
}

// ---------------------------------------------------------------------------
// CharacterCriticAgent — 每个角色的批判视角
// ---------------------------------------------------------------------------

export class CharacterCriticAgent extends BaseAgent {
  private readonly characterName: string;
  private readonly voice: CharacterVoice;
  private readonly perspective: string;

  constructor(agentCtx: AgentContext, characterName: string, voice: CharacterVoice, perspective: string) {
    super(agentCtx);
    this.characterName = characterName;
    this.voice = voice;
    this.perspective = perspective;
  }

  get name(): string {
    return `character-critic-${this.characterName}`;
  }

  async critique(input: {
    readonly chapterMemo: string;
    readonly chapterIntent: string;
    readonly currentContext: string;
    readonly critiqueFocus: string;
  }): Promise<CharacterCritique> {
    this.log?.info(`[character-critic:${this.characterName}] 开始批判审视`);

    try {
      const response = await this.chat(
        [
          { role: "system", content: buildCharacterCritiqueSystemPrompt(this.voice, this.perspective) },
          {
            role: "user",
            content: buildCharacterCritiqueUserPrompt(
              this.characterName,
              input.chapterMemo,
              input.chapterIntent,
              input.currentContext,
              input.critiqueFocus,
            ),
          },
        ],
        { temperature: 0.6, maxTokens: 2048 },
      );

      const parsed = parseJsonOrFallback<Partial<CharacterCritique>>(response.content, {});
      return {
        characterName: this.characterName,
        perspective: this.perspective,
        oocRisks: parsed.oocRisks ?? [],
        logicFlaws: parsed.logicFlaws ?? [],
        dialogueIssues: parsed.dialogueIssues ?? [],
        emotionalGaps: parsed.emotionalGaps ?? [],
        suggestions: parsed.suggestions ?? [],
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (err) {
      this.log?.warn(`[character-critic:${this.characterName}] 批判失败: ${err}`);
      return defaultCritique(this.characterName, this.perspective);
    }
  }
}

// ---------------------------------------------------------------------------
// DiscussionSynthesizer — 综合讨论结论
// ---------------------------------------------------------------------------

export class DiscussionSynthesizer extends BaseAgent {
  get name(): string {
    return "discussion-synthesizer";
  }

  async synthesize(
    chapterNumber: number,
    critiques: ReadonlyArray<CharacterCritique>,
    chapterMemo: string,
  ): Promise<{
    readonly consensusIssues: ReadonlyArray<string>;
    readonly conflicts: ReadonlyArray<CharacterConflict>;
    readonly writingGuidance: ReadonlyArray<string>;
    readonly dialogueGuidelines: ReadonlyArray<string>;
    readonly mustAvoid: ReadonlyArray<string>;
    readonly oocWarnings: ReadonlyArray<string>;
  }> {
    this.log?.info(`[synthesizer] 综合 ${critiques.length} 个角色的讨论意见`);

    try {
      const response = await this.chat(
        [
          { role: "system", content: buildSynthesisSystemPrompt() },
          { role: "user", content: buildSynthesisUserPrompt(chapterNumber, critiques, chapterMemo) },
        ],
        { temperature: 0.3, maxTokens: 2048 },
      );

      const parsed = parseJsonOrFallback<{
        consensusIssues?: string[];
        conflicts?: Array<{ characterA?: string; characterB?: string; description?: string; resolution?: string }>;
        writingGuidance?: string[];
        dialogueGuidelines?: string[];
        mustAvoid?: string[];
        oocWarnings?: string[];
      }>(response.content, {});

      return {
        consensusIssues: parsed.consensusIssues ?? [],
        conflicts: (parsed.conflicts ?? []).map((c) => ({
          characterA: c.characterA ?? "",
          characterB: c.characterB ?? "",
          description: c.description ?? "",
          resolution: c.resolution,
        })),
        writingGuidance: parsed.writingGuidance ?? [],
        dialogueGuidelines: parsed.dialogueGuidelines ?? [],
        mustAvoid: parsed.mustAvoid ?? [],
        oocWarnings: parsed.oocWarnings ?? [],
      };
    } catch (err) {
      this.log?.warn(`[synthesizer] 综合失败: ${err}`);
      return {
        consensusIssues: [],
        conflicts: [],
        writingGuidance: [],
        dialogueGuidelines: [],
        mustAvoid: [],
        oocWarnings: [],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main: CharacterRoundtable — 圆桌讨论主入口
// ---------------------------------------------------------------------------

export class CharacterRoundtable {
  private readonly ctx: AgentContext;
  private readonly moderator: DiscussionModerator;
  private readonly synthesizer: DiscussionSynthesizer;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
    this.moderator = new DiscussionModerator(ctx);
    this.synthesizer = new DiscussionSynthesizer(ctx);
  }

  /**
   * 运行完整的角色圆桌讨论。
   *
   * 流程：
   * 1. 主持人分析章节，准备讨论议题和角色分配
   * 2. 每个角色（CriticAgent）从自身视角批判审视情节
   * 3. 综合器（Synthesizer）汇总所有意见，输出写作指导
   *
   * 讨论结果可直接注入 Writer 的 prompt，或用于后续的 Reviser 修改。
   */
  async discuss(input: RoundtableInput): Promise<RoundtableResult> {
    const { chapterNumber, chapterMemo, chapterIntent, characters, currentContext, maxCharacters = 4, onEvent } = input;

    this.ctx.logger?.info(
      `[roundtable] 第 ${chapterNumber} 章开始，${Object.keys(characters).length} 个角色参与讨论`,
    );

    // 触发讨论开始事件
    const participantNames = Object.keys(characters).slice(0, maxCharacters);
    onEvent?.({ type: "discussion-start", chapterNumber, participants: participantNames });

    // Step 1: 准备讨论（Moderator）
    const characterProfiles: CharacterProfile[] = participantNames.map((name) => {
      const voice = characters[name]!;
      const role = name.includes("主角") || name.includes("男主") || name.includes("女主")
        ? "protagonist"
        : name.includes("反派") || name.includes("Boss")
          ? "antagonist"
          : "supporting";
      return buildCharacterProfile(voice, role);
    });

    const moderatorResult = await this.moderator.prepareDiscussion({
      chapterNumber,
      chapterMemo,
      chapterIntent,
      characterProfiles,
      currentContext,
    });

    // 触发主持人准备就绪事件
    onEvent?.({ type: "moderator-ready", topics: moderatorResult.discussionTopics });

    // Step 2: 每个角色批判审视（并行，但逐个触发事件）
    const critiqueTasks: Promise<CharacterCritique>[] = [];

    for (const assignment of moderatorResult.characterAssignments) {
      const voice = characters[assignment.characterName];
      if (!voice) continue;

      const critic = new CharacterCriticAgent(
          this.ctx,
          assignment.characterName,
          voice,
          assignment.perspective,
        );

      const task = critic.critique({
        chapterMemo,
        chapterIntent,
        currentContext,
        critiqueFocus: assignment.critiqueFocus,
      }).then((critique) => {
        // 触发角色完成事件
        onEvent?.({ type: "character-finished", characterName: assignment.characterName, critique });
        return critique;
      });

      // 触发角色开始发言事件
      onEvent?.({
        type: "character-speaking",
        characterName: assignment.characterName,
        perspective: assignment.perspective,
        content: `正在审视章节大纲，评估情节合理性...`,
      });

      critiqueTasks.push(task);
    }

    // 如果 moderator 没有给出分配，就按默认方式每个角色都批判
    if (critiqueTasks.length === 0) {
      for (const name of participantNames) {
        const voice = characters[name]!;
        const critic = new CharacterCriticAgent(
          this.ctx,
          name,
          voice,
          "第一人称沉浸视角",
        );

        const task = critic.critique({
          chapterMemo,
          chapterIntent,
          currentContext,
          critiqueFocus: "从角色视角审视整段情节的合理性",
        }).then((critique) => {
          onEvent?.({ type: "character-finished", characterName: name, critique });
          return critique;
        });

        onEvent?.({
          type: "character-speaking",
          characterName: name,
          perspective: "第一人称沉浸视角",
          content: `正在从我的视角审视这段情节...`,
        });

        critiqueTasks.push(task);
      }
    }

    const critiques = await Promise.all(critiqueTasks);

    // Step 3: 综合讨论结论
    const synthesis = await this.synthesizer.synthesize(chapterNumber, critiques, chapterMemo);

    // 触发冲突检测事件
    for (const conflict of synthesis.conflicts) {
      onEvent?.({ type: "conflict-detected", conflict });
    }

    const resultData = {
      chapterNumber,
      totalCritiques: critiques.length,
      critiques,
      conflicts: synthesis.conflicts,
      consensusIssues: synthesis.consensusIssues,
      writingGuidance: synthesis.writingGuidance,
      dialogueGuidelines: synthesis.dialogueGuidelines,
      mustAvoid: synthesis.mustAvoid,
      oocWarnings: synthesis.oocWarnings,
    };

    const constraintsBlock = formatRoundtableConstraints(
      { ...resultData, constraintsBlock: "" } as RoundtableResult,
      "zh",
    );

    const result: RoundtableResult = {
      ...resultData,
      constraintsBlock,
    };

    this.ctx.logger?.info(
      `[roundtable] 第 ${chapterNumber} 章讨论完成：` +
      `${critiques.length} 个角色参与，` +
      `${synthesis.consensusIssues.length} 个共识问题，` +
      `${synthesis.oocWarnings.length} 个 OOC 警告`,
    );

    // 触发讨论完成事件
    onEvent?.({ type: "discussion-complete", result });

    return result;
  }
}

// ---------------------------------------------------------------------------
// RoundTable Constraints Formatter
// Formats RoundtableResult into a prompt block for WriterAgent
// ---------------------------------------------------------------------------

type PromptLanguage = "zh" | "en";

/**
 * Format a RoundtableResult into a structured constraints block
 * that can be injected into WriterAgent's system prompt.
 */
export function formatRoundtableConstraints(
  result: RoundtableResult,
  language: PromptLanguage = "zh",
): string {
  if (result.totalCritiques === 0) return "";

  const lines: string[] = [];

  if (language === "en") {
    lines.push("## Character Roundtable Constraints (MUST follow)");
    lines.push("");
    lines.push(`Chapter ${result.chapterNumber} roundtable discussion completed with ${result.totalCritiques} participants.`);
    lines.push("");

    if (result.writingGuidance.length > 0) {
      lines.push("### Writing Guidance from Characters");
      for (const g of result.writingGuidance) {
        lines.push(`- ${g}`);
      }
      lines.push("");
    }

    if (result.dialogueGuidelines.length > 0) {
      lines.push("### Dialogue Guidelines");
      for (const d of result.dialogueGuidelines) {
        lines.push(`- ${d}`);
      }
      lines.push("");
    }

    if (result.critiques.length > 0) {
      lines.push("### Character-Specific Constraints");
      for (const c of result.critiques) {
        lines.push(`**${c.characterName}** (${c.perspective}):`);
        if (c.oocRisks.length > 0) {
          lines.push(`  - OOC risks: ${c.oocRisks.join(", ")}`);
        }
        if (c.suggestions.length > 0) {
          lines.push(`  - Suggestions: ${c.suggestions.join(", ")}`);
        }
      }
      lines.push("");
    }

    if (result.mustAvoid.length > 0) {
      lines.push("### MUST AVOID");
      for (const a of result.mustAvoid) {
        lines.push(`- ${a}`);
      }
      lines.push("");
    }

    if (result.oocWarnings.length > 0) {
      lines.push("### OOC High-Risk Points");
      for (const w of result.oocWarnings) {
        lines.push(`- ${w}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // Chinese
  lines.push("## 角色圆桌硬约束（必须遵守）");
  lines.push("");
  lines.push(`第 ${result.chapterNumber} 章圆桌讨论完成，共 ${result.totalCritiques} 个角色参与。`);
  lines.push("");

  if (result.writingGuidance.length > 0) {
    lines.push("### 角色们给出的写作指导");
    for (const g of result.writingGuidance) {
      lines.push(`- ${g}`);
    }
    lines.push("");
  }

  if (result.dialogueGuidelines.length > 0) {
    lines.push("### 对话风格调整要求");
    for (const d of result.dialogueGuidelines) {
      lines.push(`- ${d}`);
    }
    lines.push("");
  }

  if (result.critiques.length > 0) {
    lines.push("### 各角色具体约束");
    for (const c of result.critiques) {
      lines.push(`**${c.characterName}**（${c.perspective}）：`);
      if (c.oocRisks.length > 0) {
        lines.push(`  - OOC风险：${c.oocRisks.join("；")}`);
      }
      if (c.suggestions.length > 0) {
        lines.push(`  - 建议：${c.suggestions.join("；")}`);
      }
    }
    lines.push("");
  }

  if (result.mustAvoid.length > 0) {
    lines.push("### 绝对不能出现的内容");
    for (const a of result.mustAvoid) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }

  if (result.oocWarnings.length > 0) {
    lines.push("### OOC 高风险点（需特别处理）");
    for (const w of result.oocWarnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
