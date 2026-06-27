import { z } from "zod";

// Skill 定义 Schema
export const SkillDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  targetAgent: z.enum(["writer", "architect", "planner", "composer", "all"]),
  triggers: z.array(z.string()).default([]),
  version: z.string().default("1.0"),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// Skill 文件解析结果
export interface SkillFile {
  readonly definition: SkillDefinition;
  readonly body: string;
  readonly filePath: string;
  readonly source: "builtin" | "project";
}

/**
 * 解析 SKILL.md 文件
 */
export function parseSkillFile(content: string, filePath: string, source: "builtin" | "project"): SkillFile | null {
  // 尝试提取 YAML frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) {
    return null;
  }

  try {
    // 简单解析 YAML frontmatter（不依赖 js-yaml）
    const frontmatterStr = fmMatch[1];
    const body = fmMatch[2].trim();

    // 提取字段
    const nameMatch = frontmatterStr.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatterStr.match(/^description:\s*(.+)$/m);
    const agentMatch = frontmatterStr.match(/^target_agent:\s*(.+)$/m);
    const triggersMatch = frontmatterStr.match(/^triggers:\s*\n((?:\s*-\s*.+\n?)*)/m);

    if (!nameMatch || !descMatch || !agentMatch) {
      return null;
    }

    const triggers: string[] = [];
    if (triggersMatch) {
      const triggerLines = triggersMatch[1].split("\n");
      for (const line of triggerLines) {
        const triggerMatch = line.match(/^\s*-\s*(.+)$/);
        if (triggerMatch) {
          triggers.push(triggerMatch[1].trim());
        }
      }
    }

    const definition = SkillDefinitionSchema.parse({
      name: nameMatch[1].trim(),
      description: descMatch[1].trim(),
      targetAgent: agentMatch[1].trim(),
      triggers,
    });

    return { definition, body, filePath, source };
  } catch {
    return null;
  }
}

/**
 * 渲染 Skill 定义为 Markdown
 */
export function renderSkillMarkdown(skill: SkillFile): string {
  const lines: string[] = [];

  lines.push(`# ${skill.definition.name}`);
  lines.push(skill.definition.description);
  lines.push("");
  lines.push(`**目标 Agent**: ${skill.definition.targetAgent}`);
  if (skill.definition.triggers.length > 0) {
    lines.push(`**触发词**: ${skill.definition.triggers.join(", ")}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(skill.body);

  return lines.join("\n");
}
