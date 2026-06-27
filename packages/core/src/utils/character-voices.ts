import { readFile, mkdir } from "node:fs/promises";

import { join, dirname } from "node:path";
import { robustWriteFile as writeFile } from "./robust-write.js";
import type { Entity } from "../models/entity.js";
import { readRoleCards } from "./outline-paths.js";

/**
 * A single character's voice profile.
 */
export interface CharacterVoice {
  readonly name: string;
  readonly speechStyle: string;
  readonly forbiddenTone: ReadonlyArray<string>;
  readonly vocabulary: ReadonlyArray<string>;
  readonly personality: ReadonlyArray<string>;
  readonly emotionalExpression: string;
  readonly sampleDialogues: ReadonlyArray<string>;
  readonly infoBoundary: ReadonlyArray<string>;
}

/**
 * The top-level shape of `story/character_voices.json`.
 */
export interface CharacterVoicesFile {
  readonly version: string;
  readonly characters: Record<string, CharacterVoice>;
}

/**
 * Path (relative to bookDir) where voice profiles are stored.
 */
const VOICES_REL_PATH = "story/character_voices.json" as const;

/**
 * Default (empty) file structure returned when the file does not yet exist.
 */
function emptyVoicesFile(): CharacterVoicesFile {
  return { version: "1.0", characters: {} };
}

/**
 * Load the character voices file from disk.
 *
 * Returns an empty file structure when the file does not exist.
 */
export async function loadCharacterVoices(
  bookDir: string,
): Promise<CharacterVoicesFile> {
  try {
    const raw = await readFile(join(bookDir, VOICES_REL_PATH), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "characters" in parsed
    ) {
      return parsed as CharacterVoicesFile;
    }
    // File exists but has unexpected shape – return empty defaults.
    return emptyVoicesFile();
  } catch {
    // File does not exist or cannot be parsed – return empty defaults.
    return emptyVoicesFile();
  }
}

/**
 * Persist the character voices file to disk.
 *
 * Creates intermediate directories if they do not yet exist.
 */
export async function saveCharacterVoices(
  bookDir: string,
  voices: CharacterVoicesFile,
): Promise<void> {
  const filePath = join(bookDir, VOICES_REL_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(voices, null, 2) + "\n", "utf-8");
}

/**
 * Look up a single character voice by name.
 *
 * Returns `undefined` when no profile with the given name exists.
 */
export function getCharacterVoice(
  voices: CharacterVoicesFile,
  name: string,
): CharacterVoice | undefined {
  return voices.characters[name];
}

/**
 * Convert a list of character entities from the entity database into
 * CharacterVoice profiles suitable for the roundtable discussion agent.
 *
 * Missing personality / tone fields are filled in with sensible defaults so
 * every character can still participate in the discussion.
 */
/**
 * 从 story/roles/*.md 的角色卡解析为 CharacterVoice 档案。
 *
 * 角色卡通常是自由格式的 Markdown，这里做一些启发式的抽取：
 * - 一级标题 = 角色名
 * - "说话风格 / 语气 / speech style" → speechStyle
 * - "性格 / personality / 标签" → personality（按顿号/逗号切分）
 * - "常用词 / 口癖 / vocabulary" → vocabulary
 * - "情绪表达 / emotional expression" → emotionalExpression
 * - "示例对话 / sample dialogues" → 每一行作为一条 sampleDialogues
 * - "信息边界 / 已知信息 / info boundary" → infoBoundary
 *
 * 任何无法识别的段落都被塞进 personality 的"其他描述"里兜底，
 * 保证下游 roundtable 依然能拿到足够信息。
 */
export async function parseRoleCardsToVoices(
  bookDir: string,
): Promise<Record<string, CharacterVoice>> {
  const cards = await readRoleCards(bookDir);
  const voices: Record<string, CharacterVoice> = {};

  for (const card of cards) {
    voices[card.name] = parseRoleCardContentToVoice(card.content, card.name);
  }
  return voices;
}

function parseRoleCardContentToVoice(content: string, name: string): CharacterVoice {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  let speechStyle = "正常对话";
  const personality: string[] = [];
  const vocabulary: string[] = [];
  let emotionalExpression = "通过动作和对话表达情绪";
  const sampleDialogues: string[] = [];
  const infoBoundary: string[] = [];

  let currentSection: string | null = null;
  let freeTextBuffer: string[] = [];

  for (const raw of lines) {
    const lower = raw.toLowerCase();
    const trimmed = raw.replace(/^[-*•#]+\s*/, "").trim();

    // 识别"键：值"的单行字段
    const kvMatch = trimmed.match(
      /^(说话风格|语气|speech\s*style)\s*[:：]\s*(.+)$/i,
    );
    if (kvMatch) {
      speechStyle = kvMatch[2].trim();
      currentSection = null;
      continue;
    }

    const personalityMatch = trimmed.match(
      /^(性格|personality|标签|特征|特质)\s*[:：]\s*(.+)$/i,
    );
    if (personalityMatch) {
      personality.push(
        ...personalityMatch[2].split(/[、，,;；]/).map((s) => s.trim()).filter(Boolean),
      );
      currentSection = "personality-list";
      continue;
    }

    const vocabMatch = trimmed.match(
      /^(常用词|口癖|vocabulary|用词)\s*[:：]\s*(.+)$/i,
    );
    if (vocabMatch) {
      vocabulary.push(
        ...vocabMatch[2].split(/[、，,;；]/).map((s) => s.trim()).filter(Boolean),
      );
      currentSection = "vocabulary-list";
      continue;
    }

    const emoMatch = trimmed.match(
      /^(情绪表达|emotional\s*expression|情绪表现)\s*[:：]\s*(.+)$/i,
    );
    if (emoMatch) {
      emotionalExpression = emoMatch[2].trim();
      currentSection = null;
      continue;
    }

    const boundaryMatch = trimmed.match(
      /^(信息边界|已知信息|info\s*boundary|他知道|她知道|知道)\s*[:：]\s*(.+)$/i,
    );
    if (boundaryMatch) {
      infoBoundary.push(
        ...boundaryMatch[2].split(/[、，,;；]/).map((s) => s.trim()).filter(Boolean),
      );
      currentSection = "boundary-list";
      continue;
    }

    const dialogueMatch = trimmed.match(
      /^(示例对话|sample\s*dialogues|例句|台词)\s*[:：]\s*(.*)$/i,
    );
    if (dialogueMatch) {
      const rest = dialogueMatch[2].trim();
      if (rest) sampleDialogues.push(rest);
      currentSection = "dialogue";
      continue;
    }

    // 列表延续
    if (currentSection === "personality-list" && /^[-*•]\s+/.test(raw)) {
      personality.push(trimmed);
      continue;
    }
    if (currentSection === "vocabulary-list" && /^[-*•]\s+/.test(raw)) {
      vocabulary.push(trimmed);
      continue;
    }
    if (currentSection === "boundary-list" && /^[-*•]\s+/.test(raw)) {
      infoBoundary.push(trimmed);
      continue;
    }
    if (currentSection === "dialogue") {
      sampleDialogues.push(trimmed.replace(/^["「『]|["」』]$/g, ""));
      continue;
    }

    // 看起来像一个二级标题的行（### xxx）：重置 section，
    // 但不要把标题自身塞到 free-text，以免污染。
    if (/^#{2,}\s+/.test(raw)) {
      currentSection = null;
      continue;
    }

    // 其余文本收集起来做兜底描述
    freeTextBuffer.push(trimmed);
  }

  // 兜底：将无法结构化的自由文本压缩成 1–2 条 personality 条目
  if (freeTextBuffer.length > 0 && personality.length < 6) {
    const joined = freeTextBuffer.join(" ");
    if (joined.length > 12) {
      personality.push(`角色描述：${joined.slice(0, 120)}${joined.length > 120 ? "…" : ""}`);
    }
  }

  // 保证 infoBoundary 至少有一条"只知当前章节已知信息"的约束提示，
  // 这样 roundtable 即使角色卡没写这部分，也依然能约束角色不剧透。
  if (infoBoundary.length === 0) {
    infoBoundary.push("只知道该角色在当前章节之前已亲身经历或被告知的信息");
  }

  return {
    name,
    speechStyle,
    forbiddenTone: [],
    vocabulary,
    personality: personality.length > 0 ? personality : ["待进一步刻画"],
    emotionalExpression,
    sampleDialogues: sampleDialogues.slice(0, 5),
    infoBoundary,
  };
}

export function entitiesToCharacterVoices(
  entities: readonly Entity[],
): Record<string, CharacterVoice> {
  const result: Record<string, CharacterVoice> = {};

  for (const entity of entities) {
    if (!entity || entity.type !== "character") continue;

    const name = entity.name?.trim() || entity.id;
    if (!name) continue;

    const attrs = entity.attributes ?? {};
    const state = entity.state ?? {};
    const tags = entity.tags ?? [];
    const aliases = entity.aliases ?? [];

    // Pull the richest free-form fields available.
    const personalityHints: string[] = [];
    const vocabularyHints: string[] = [];
    let speechStyle = "正常对话";
    let emotionalExpression = "通过动作和对话表达情绪";

    for (const [key, value] of Object.entries(attrs)) {
      const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
      if (!raw) continue;

      const lower = key.toLowerCase();
      if (lower.includes("personality") || lower.includes("性格") || lower.includes("特质")) {
        personalityHints.push(raw);
      } else if (lower.includes("speech") || lower.includes("口癖") || lower.includes("说话") || lower.includes("语气")) {
        speechStyle = raw;
      } else if (lower.includes("emotion") || lower.includes("情绪") || lower.includes("情感")) {
        emotionalExpression = raw;
      } else if (lower.includes("vocabulary") || lower.includes("用词") || lower.includes("词汇")) {
        vocabularyHints.push(raw);
      } else if (personalityHints.length < 6) {
        personalityHints.push(`${key}：${raw}`);
      }
    }

    for (const [key, value] of Object.entries(state)) {
      const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
      if (!raw) continue;
      if (personalityHints.length < 8) personalityHints.push(`${key}：${raw}`);
    }

    for (const tag of tags) {
      const trimmed = tag.trim();
      if (trimmed && personalityHints.length < 10 && !personalityHints.includes(trimmed)) {
        personalityHints.push(trimmed);
      }
    }

    // Build an info-boundary block from what this character should NOT know.
    const infoBoundary: string[] = [];
    if (aliases.length > 0) {
      infoBoundary.push(`以「${name}」为第一视角称呼自己；其他角色请使用对应名称`);
    }
    infoBoundary.push("只知道该角色在当前章节之前已经亲身经历或被告知的信息");
    infoBoundary.push("不得直接或间接转述后续章节或上帝视角才知道的设定");

    result[name] = {
      name,
      speechStyle,
      forbiddenTone: [],
      vocabulary: vocabularyHints,
      personality: personalityHints.length > 0 ? personalityHints : ["待进一步刻画"],
      emotionalExpression,
      sampleDialogues: [],
      infoBoundary,
    };
  }

  return result;
}