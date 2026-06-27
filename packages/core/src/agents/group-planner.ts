import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BaseAgent } from "./base.js";
import type { BookConfig } from "../models/book.js";
import {
  ChapterGroupIntentSchema,
  type ChapterGroupIntent,
} from "../models/chapter-group.js";
import { loadPlanningSeedMaterials } from "../utils/planning-materials.js";

export interface PlanGroupInput {
  readonly book: BookConfig;
  readonly bookDir: string;
  readonly startChapter: number;
  readonly count?: number; // 默认 3-8 章
}

export interface PlanGroupOutput {
  readonly intent: ChapterGroupIntent;
  readonly intentMarkdown: string;
  readonly runtimePath: string;
}

/**
 * 章节组规划 Agent
 *
 * 生成 3-8 章的短期情节规划，作为大纲与单章之间的中间层。
 */
export class GroupPlannerAgent extends BaseAgent {
  get name(): string {
    return "group-planner";
  }

  async planGroup(input: PlanGroupInput): Promise<PlanGroupOutput> {
    const storyDir = join(input.bookDir, "story");
    const runtimeDir = join(storyDir, "runtime");
    await mkdir(runtimeDir, { recursive: true });

    const count = input.count ?? this.estimateGroupSize(input.book);
    const endChapter = input.startChapter + count - 1;

    // 加载种子材料
    const seedMaterials = await loadPlanningSeedMaterials({
      bookDir: input.bookDir,
      chapterNumber: input.startChapter,
    });

    // 加载最近章节摘要
    const recentSummaries = await this.loadRecentSummaries(
      storyDir,
      input.startChapter,
      3,
    );

    // 加载伏笔状态
    const pendingHooks = await this.loadPendingHooks(storyDir);

    // 生成章节组意图
    const intent = await this.generateGroupIntent({
      book: input.book,
      startChapter: input.startChapter,
      endChapter,
      volumeOutline: seedMaterials.volumeOutline,
      currentFocus: seedMaterials.currentFocus,
      authorIntent: seedMaterials.authorIntent,
      recentSummaries,
      pendingHooks,
    });

    // 渲染 markdown
    const intentMarkdown = this.renderGroupIntentMarkdown(intent);
    const runtimePath = join(runtimeDir, `group-${String(intent.groupNumber).padStart(2, "0")}.intent.md`);
    await writeFile(runtimePath, intentMarkdown, "utf-8");

    return { intent, intentMarkdown, runtimePath };
  }

  /**
   * 估算章节组大小
   */
  private estimateGroupSize(book: BookConfig): number {
    // 默认 5 章，可根据题材调整
    return 5;
  }

  /**
   * 加载最近章节摘要
   */
  private async loadRecentSummaries(
    storyDir: string,
    currentChapter: number,
    count: number,
  ): Promise<string> {
    const summariesPath = join(storyDir, "chapter_summaries.md");
    try {
      const content = await readFile(summariesPath, "utf-8");
      // 简单提取最近几章的摘要
      const lines = content.split("\n");
      const relevantLines: string[] = [];
      let capturing = false;
      let captured = 0;

      for (const line of lines) {
        if (line.match(new RegExp(`第${currentChapter - 1}章|第${currentChapter - 2}章|第${currentChapter - 3}章`))) {
          capturing = true;
          captured = 0;
        }
        if (capturing) {
          relevantLines.push(line);
          if (line.trim() === "" && captured > 0) {
            capturing = false;
          }
          captured++;
        }
      }

      return relevantLines.join("\n").trim() || "暂无近期章节摘要";
    } catch {
      return "暂无近期章节摘要";
    }
  }

  /**
   * 加载待处理伏笔
   */
  private async loadPendingHooks(storyDir: string): Promise<string> {
    const hooksPath = join(storyDir, "pending_hooks.md");
    try {
      return await readFile(hooksPath, "utf-8");
    } catch {
      return "暂无待处理伏笔";
    }
  }

  /**
   * 调用 LLM 生成章节组意图
   */
  private async generateGroupIntent(input: {
    readonly book: BookConfig;
    readonly startChapter: number;
    readonly endChapter: number;
    readonly volumeOutline: string;
    readonly currentFocus: string;
    readonly authorIntent: string;
    readonly recentSummaries: string;
    readonly pendingHooks: string;
  }): Promise<ChapterGroupIntent> {
    const systemPrompt = this.buildSystemPrompt(input.book.language ?? "zh");
    const userMessage = this.buildUserMessage(input);

    const response = await this.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { temperature: 0.7 },
    );

    const responseText = response.content;

    // 解析 JSON 响应
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("无法解析章节组意图 JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return ChapterGroupIntentSchema.parse({
      groupNumber: Math.ceil(input.startChapter / 5),
      startChapter: input.startChapter,
      endChapter: input.endChapter,
      goal: parsed.goal,
      conflictCurve: parsed.conflictCurve,
      chapterPlans: parsed.chapterPlans,
      foreshadowPlan: parsed.foreshadowPlan,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(language: string): string {
    if (language === "en") {
      return `You are a chapter group planner for long-form fiction.
Your task is to create a 3-8 chapter group plan that bridges the gap between the overall outline and individual chapter plans.

Output a JSON object with this structure:
{
  "goal": "1-2 sentence goal for this chapter group",
  "conflictCurve": {
    "setup": "initial situation",
    "escalation": "rising tension",
    "twist": "key turning point",
    "resolution": "group ending state"
  },
  "chapterPlans": [
    {
      "chapterNumber": N,
      "goal": "chapter goal",
      "conflict": "chapter conflict",
      "hookPayoff": "optional hook payoff"
    }
  ],
  "foreshadowPlan": {
    "toPlant": ["foreshadows to plant"],
    "toAdvance": ["foreshadows to advance"],
    "toResolve": ["foreshadows to resolve"]
  }
}

Keep the total output under 1000 words. Focus on短期情节连贯性和伏笔管理。`;
    }

    return `你是一个长篇小说的章节组规划师。
你的任务是创建 3-8 章的短期情节规划，作为整体大纲与单章规划之间的中间层。

输出一个 JSON 对象，结构如下：
{
  "goal": "本章节组的1-2句目标",
  "conflictCurve": {
    "setup": "起点情境",
    "escalation": "升级冲突",
    "twist": "关键转折",
    "resolution": "组结束状态"
  },
  "chapterPlans": [
    {
      "chapterNumber": N,
      "goal": "本章目标",
      "conflict": "本章冲突",
      "hookPayoff": "可选的伏笔回收"
    }
  ],
  "foreshadowPlan": {
    "toPlant": ["要埋设的伏笔"],
    "toAdvance": ["要推进的伏笔"],
    "toResolve": ["要回收的伏笔"]
  }
}

总输出控制在 1000 字以内。重点是短期情节连贯性和伏笔管理。`;
  }

  /**
   * 构建用户消息
   */
  private buildUserMessage(input: {
    readonly book: BookConfig;
    readonly startChapter: number;
    readonly endChapter: number;
    readonly volumeOutline: string;
    readonly currentFocus: string;
    readonly authorIntent: string;
    readonly recentSummaries: string;
    readonly pendingHooks: string;
  }): string {
    const language = input.book.language ?? "zh";
    const title = input.book.title;

    return language === "en"
      ? `Book: ${title}
Chapters: ${input.startChapter}-${input.endChapter}

## Overall Outline
${input.volumeOutline.slice(0, 2000)}

## Current Focus
${input.currentFocus}

## Author Intent
${input.authorIntent}

## Recent Chapter Summaries
${input.recentSummaries}

## Pending Hooks
${input.pendingHooks}

Please create a chapter group plan for chapters ${input.startChapter}-${input.endChapter}.`
      : `书籍：${title}
章节范围：第${input.startChapter}章 - 第${input.endChapter}章

## 整体大纲
${input.volumeOutline.slice(0, 2000)}

## 当前聚焦
${input.currentFocus}

## 作者意图
${input.authorIntent}

## 近期章节摘要
${input.recentSummaries}

## 待处理伏笔
${input.pendingHooks}

请为第${input.startChapter}章到第${input.endChapter}章创建章节组规划。`;
  }

  /**
   * 渲染章节组意图为 Markdown
   */
  private renderGroupIntentMarkdown(intent: ChapterGroupIntent): string {
    const lines: string[] = [];

    lines.push(`# 第${intent.groupNumber}组章节细纲`);
    lines.push(`**范围**: 第${intent.startChapter}章 - 第${intent.endChapter}章`);
    lines.push(`**状态**: ${statusLabel(intent.status)}`);
    lines.push("");

    lines.push("## 组目标");
    lines.push(intent.goal);
    lines.push("");

    lines.push("## 冲突曲线");
    lines.push(`- **起点**: ${intent.conflictCurve.setup}`);
    lines.push(`- **升级**: ${intent.conflictCurve.escalation}`);
    lines.push(`- **转折**: ${intent.conflictCurve.twist}`);
    lines.push(`- **落点**: ${intent.conflictCurve.resolution}`);
    lines.push("");

    lines.push("## 逐章安排");
    for (const plan of intent.chapterPlans) {
      lines.push(`### 第${plan.chapterNumber}章`);
      lines.push(`- **目标**: ${plan.goal}`);
      lines.push(`- **冲突**: ${plan.conflict}`);
      if (plan.hookPayoff) {
        lines.push(`- **伏笔回收**: ${plan.hookPayoff}`);
      }
      lines.push("");
    }

    lines.push("## 伏笔计划");
    if (intent.foreshadowPlan.toPlant.length > 0) {
      lines.push("### 要埋设的伏笔");
      for (const item of intent.foreshadowPlan.toPlant) {
        lines.push(`- ${item}`);
      }
    }
    if (intent.foreshadowPlan.toAdvance.length > 0) {
      lines.push("### 要推进的伏笔");
      for (const item of intent.foreshadowPlan.toAdvance) {
        lines.push(`- ${item}`);
      }
    }
    if (intent.foreshadowPlan.toResolve.length > 0) {
      lines.push("### 要回收的伏笔");
      for (const item of intent.foreshadowPlan.toResolve) {
        lines.push(`- ${item}`);
      }
    }

    return lines.join("\n");
  }
}

function statusLabel(status: ChapterGroupIntent["status"]): string {
  switch (status) {
    case "draft": return "草稿";
    case "confirmed": return "已确认";
    case "in-progress": return "进行中";
    case "completed": return "已完成";
  }
}
