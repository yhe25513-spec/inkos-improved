import { z } from "zod";

// 叙事风格规则 Schema
export const StyleRuleSchema = z.object({
  scenePattern: z.string(), // 场景模式（正则）
  style: z.string(),        // 风格指令
  tone: z.string().optional(), // 语气指令
  pacing: z.string().optional(), // 节奏指令
});

// 上下文策略 Schema
export const ContextStrategySchema = z.object({
  authorIntent: z.enum(["always", "relevant", "never"]),
  currentFocus: z.enum(["always", "relevant", "never"]),
  chapterSummary: z.enum(["always", "relevant", "never"]),
  hooks: z.enum(["always", "relevant", "never"]),
});

// 叙事编排 Schema
export const NarrativeProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  styleRules: z.array(StyleRuleSchema),
  contextStrategy: ContextStrategySchema,
  promptSlots: z.object({
    beforeWriting: z.string().optional(),
    afterRules: z.string().optional(),
  }).optional(),
});

export type NarrativeProfile = z.infer<typeof NarrativeProfileSchema>;
export type StyleRule = z.infer<typeof StyleRuleSchema>;
export type ContextStrategy = z.infer<typeof ContextStrategySchema>;

/**
 * 根据场景类型解析叙事风格
 */
export function resolveNarrativeStyle(
  profile: NarrativeProfile,
  sceneType: string,
): StyleRule | undefined {
  for (const rule of profile.styleRules) {
    try {
      const regex = new RegExp(rule.scenePattern, "i");
      if (regex.test(sceneType)) {
        return rule;
      }
    } catch {
      // 正则无效，跳过
    }
  }
  return undefined;
}

/**
 * 渲染叙事编排为 Markdown
 */
export function renderNarrativeProfileMarkdown(profile: NarrativeProfile): string {
  const lines: string[] = [];

  lines.push(`# ${profile.name}`);
  lines.push(profile.description);
  lines.push("");

  lines.push("## 风格规则");
  for (const rule of profile.styleRules) {
    lines.push(`### 场景模式: ${rule.scenePattern}`);
    lines.push(`- **风格**: ${rule.style}`);
    if (rule.tone) lines.push(`- **语气**: ${rule.tone}`);
    if (rule.pacing) lines.push(`- **节奏**: ${rule.pacing}`);
    lines.push("");
  }

  lines.push("## 上下文策略");
  lines.push(`- **作者意图**: ${profile.contextStrategy.authorIntent}`);
  lines.push(`- **当前聚焦**: ${profile.contextStrategy.currentFocus}`);
  lines.push(`- **章节摘要**: ${profile.contextStrategy.chapterSummary}`);
  lines.push(`- **伏笔状态**: ${profile.contextStrategy.hooks}`);

  return lines.join("\n");
}
