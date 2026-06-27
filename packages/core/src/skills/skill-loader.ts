import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseSkillFile, type SkillFile } from "./skill-schema.js";

// 内置 Skills 目录（相对于 core 包）
const BUILTIN_SKILLS_DIR = join(import.meta.dirname, "..", "..", "..", "skills");

/**
 * 加载项目级 Skills
 */
export async function loadProjectSkills(projectRoot: string): Promise<SkillFile[]> {
  const skillsDir = join(projectRoot, ".inkos", "skills");
  return loadSkillsFromDir(skillsDir, "project");
}

/**
 * 加载内置 Skills
 */
export async function loadBuiltinSkills(): Promise<SkillFile[]> {
  return loadSkillsFromDir(BUILTIN_SKILLS_DIR, "builtin");
}

/**
 * 加载所有 Skills（内置 + 项目级）
 */
export async function loadAllSkills(projectRoot: string): Promise<SkillFile[]> {
  const [builtin, project] = await Promise.all([
    loadBuiltinSkills(),
    loadProjectSkills(projectRoot),
  ]);
  return [...builtin, ...project];
}

/**
 * 从目录加载 Skills
 */
async function loadSkillsFromDir(dir: string, source: "builtin" | "project"): Promise<SkillFile[]> {
  const skills: SkillFile[] = [];

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const entryPath = join(dir, entry);
      const entryStat = await stat(entryPath);

      if (entryStat.isDirectory()) {
        // 检查目录中是否有 SKILL.md
        const skillMdPath = join(entryPath, "SKILL.md");
        try {
          await stat(skillMdPath);
          const content = await readFile(skillMdPath, "utf-8");
          const skill = parseSkillFile(content, skillMdPath, source);
          if (skill) {
            skills.push(skill);
          }
        } catch {
          // 没有 SKILL.md，跳过
        }
      }
    }
  } catch {
    // 目录不存在，返回空数组
  }

  return skills;
}

/**
 * 根据名称查找 Skill
 */
export async function findSkillByName(
  projectRoot: string,
  name: string,
): Promise<SkillFile | undefined> {
  const allSkills = await loadAllSkills(projectRoot);
  return allSkills.find((s) => s.definition.name === name);
}

/**
 * 根据触发词查找 Skill
 */
export async function findSkillByTrigger(
  projectRoot: string,
  trigger: string,
): Promise<SkillFile | undefined> {
  const allSkills = await loadAllSkills(projectRoot);
  const lowerTrigger = trigger.toLowerCase();

  for (const skill of allSkills) {
    for (const t of skill.definition.triggers) {
      if (lowerTrigger.includes(t.toLowerCase())) {
        return skill;
      }
    }
  }

  return undefined;
}

/**
 * 获取所有可用的斜杠命令
 */
export async function getSlashCommands(projectRoot: string): Promise<Array<{
  name: string;
  description: string;
  source: "builtin" | "project";
}>> {
  const allSkills = await loadAllSkills(projectRoot);
  return allSkills.map((s) => ({
    name: s.definition.name,
    description: s.definition.description,
    source: s.source,
  }));
}
