import { z } from "zod";

// 章节组意图 Schema
export const ChapterGroupIntentSchema = z.object({
  groupNumber: z.number().int().positive(),
  startChapter: z.number().int().positive(),
  endChapter: z.number().int().positive(),
  goal: z.string().min(1),
  conflictCurve: z.object({
    setup: z.string(),
    escalation: z.string(),
    twist: z.string(),
    resolution: z.string(),
  }),
  chapterPlans: z.array(z.object({
    chapterNumber: z.number().int().positive(),
    goal: z.string(),
    conflict: z.string(),
    hookPayoff: z.string().optional(),
  })),
  foreshadowPlan: z.object({
    toPlant: z.array(z.string()),
    toAdvance: z.array(z.string()),
    toResolve: z.array(z.string()),
  }),
  status: z.enum(["draft", "confirmed", "in-progress", "completed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChapterGroupIntent = z.infer<typeof ChapterGroupIntentSchema>;

// 章节组状态 Schema
export const ChapterGroupStatusSchema = z.object({
  currentGroupNumber: z.number().int().positive(),
  totalGroups: z.number().int().positive(),
  lastUpdatedGroup: z.number().int().positive(),
});

export type ChapterGroupStatus = z.infer<typeof ChapterGroupStatusSchema>;

/**
 * 渲染章节组意图为 Markdown
 */
export function renderGroupIntentMarkdown(intent: ChapterGroupIntent): string {
  const lines: string[] = [];

  lines.push(`# 第${intent.groupNumber}组章节细纲`);
  lines.push(`**范围**: 第${intent.startChapter}章 - 第${intent.endChapter}章`);
  lines.push(`**状态**: ${statusLabel(intent.status)}`);
  lines.push("");

  // 组目标
  lines.push("## 组目标");
  lines.push(intent.goal);
  lines.push("");

  // 冲突曲线
  lines.push("## 冲突曲线");
  lines.push(`- **起点**: ${intent.conflictCurve.setup}`);
  lines.push(`- **升级**: ${intent.conflictCurve.escalation}`);
  lines.push(`- **转折**: ${intent.conflictCurve.twist}`);
  lines.push(`- **落点**: ${intent.conflictCurve.resolution}`);
  lines.push("");

  // 逐章安排
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

  // 伏笔计划
  lines.push("## 伏笔计划");
  if (intent.foreshadowPlan.toPlant.length > 0) {
    lines.push(`### 要埋设的伏笔`);
    for (const item of intent.foreshadowPlan.toPlant) {
      lines.push(`- ${item}`);
    }
  }
  if (intent.foreshadowPlan.toAdvance.length > 0) {
    lines.push(`### 要推进的伏笔`);
    for (const item of intent.foreshadowPlan.toAdvance) {
      lines.push(`- ${item}`);
    }
  }
  if (intent.foreshadowPlan.toResolve.length > 0) {
    lines.push(`### 要回收的伏笔`);
    for (const item of intent.foreshadowPlan.toResolve) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join("\n");
}

function statusLabel(status: ChapterGroupIntent["status"]): string {
  switch (status) {
    case "draft": return "草稿";
    case "confirmed": return "已确认";
    case "in-progress": return "进行中";
    case "completed": return "已完成";
  }
}
