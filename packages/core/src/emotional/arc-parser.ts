// ── 情感弧线解析器 ──────────────────────────────────────
// 从 emotional_arcs.md 的 markdown 表格中提取指定章节的情绪信息
//
// 表格列布局（与 architect.ts 生成的种子文件一致）：
//   中文: | 角色 | 章节 | 情绪状态 | 触发事件 | 强度(1-10) | 弧线方向 |
//   英文: | Character | Chapter | Emotional State | Trigger Event | Intensity (1-10) | Arc Direction |

import type { EmotionType } from "./types.js";
import { readFile } from "node:fs/promises";

/**
 * 中文情绪词到 EmotionType 的映射
 */
const EMOTION_MAP: Record<string, EmotionType> = {
  "紧张": "tension",
  "恐惧": "fear",
  "愤怒": "anger",
  "悲伤": "sadness",
  "喜悦": "joy",
  "开心": "joy",
  "高兴": "joy",
  "快乐": "joy",
  "兴奋": "excitement",
  "绝望": "despair",
  "希望": "hope",
  "爱": "love",
  "信任": "trust",
  "厌恶": "disgust",
  "惊讶": "surprise",
  "期待": "anticipation",
  "怀念": "nostalgia",
  "苦涩": "bittersweet",
  "释然": "relief",
  "苦乐参半": "bittersweet",
};

/**
 * 英文情绪词到 EmotionType 的映射（兼容英文表格）
 */
const EMOTION_MAP_EN: Record<string, EmotionType> = {
  "tension": "tension",
  "fear": "fear",
  "anger": "anger",
  "sadness": "sadness",
  "joy": "joy",
  "excitement": "excitement",
  "despair": "despair",
  "hope": "hope",
  "love": "love",
  "trust": "trust",
  "disgust": "disgust",
  "surprise": "surprise",
  "anticipation": "anticipation",
  "nostalgia": "nostalgia",
  "bittersweet": "bittersweet",
  "relief": "relief",
};

export interface ParsedEmotion {
  /** 主情绪类型 */
  primaryEmotion: EmotionType;
  /** 归一化后的强度 0-1（原始 1-10 映射到 0-1） */
  intensity: number;
}

/**
 * 从情绪状态文本中提取首个可识别的情绪类型
 *
 * @param emotionText 情绪状态单元格原文（可能包含多个情绪词或修饰语）
 * @returns 匹配到的 EmotionType，未匹配到则返回 null
 */
function extractEmotionType(emotionText: string): EmotionType | null {
  const text = emotionText.trim();
  if (!text) return null;

  // 优先精确匹配中文情绪词
  for (const [word, type] of Object.entries(EMOTION_MAP)) {
    if (text.includes(word)) {
      return type;
    }
  }

  // 兼容英文情绪词（小写匹配）
  const lowered = text.toLowerCase();
  for (const [word, type] of Object.entries(EMOTION_MAP_EN)) {
    if (lowered.includes(word)) {
      return type;
    }
  }

  return null;
}

/**
 * 从强度单元格文本中提取数字并归一化到 0-1
 *
 * @param intensityText 强度单元格原文（如 "7" / "7/10" / "强度: 8"）
 * @returns 归一化后的强度 0-1，解析失败返回 0.5（中等强度）
 */
function extractIntensity(intensityText: string): number {
  const match = intensityText.match(/\d+(\.\d+)?/);
  if (!match) return 0.5;

  const value = parseFloat(match[0]);
  // 原始范围 1-10，归一化到 0-1
  const normalized = (value - 1) / 9;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * 从 emotional_arcs.md 文件中解析指定章节的情绪信息
 *
 * @param arcsFilePath emotional_arcs.md 文件绝对路径
 * @param chapterNumber 目标章节号
 * @returns 解析到的情绪信息，未找到则返回 null
 */
export async function parseEmotionFromArcsFile(
  arcsFilePath: string,
  chapterNumber: number,
): Promise<ParsedEmotion | null> {
  // 1. 读取文件
  let raw: string;
  try {
    raw = await readFile(arcsFilePath, "utf-8");
  } catch {
    return null;
  }

  if (!raw.trim()) return null;

  const lines = raw.split(/\r?\n/);

  // 2. 逐行解析 markdown 表格行（按 | 分割）
  //    跳过表头分隔行（如 |---|---|...）
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    // 跳过分隔行
    if (/^\|[\s:-]+\|/.test(trimmed)) continue;

    // 分割单元格并去除首尾空元素（markdown 表格行首尾的 | 会产生空字符串）
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c, idx, arr) => {
        // 仅去除首尾空字符串，保留中间的空单元格
        if (idx === 0 && c === "") return false;
        if (idx === arr.length - 1 && c === "") return false;
        return true;
      });

    // 列布局（0-based）：
    //   0: 角色 / Character
    //   1: 章节 / Chapter
    //   2: 情绪状态 / Emotional State
    //   3: 触发事件 / Trigger Event
    //   4: 强度(1-10) / Intensity (1-10)
    //   5: 弧线方向 / Arc Direction
    if (cells.length < 5) continue;

    // 跳过表头行（章节列不是数字）
    const chapterCell = cells[1];
    const parsedChapter = parseInt(chapterCell, 10);
    if (Number.isNaN(parsedChapter)) continue;

    // 5. 找到匹配 chapterNumber 的行
    if (parsedChapter !== chapterNumber) continue;

    // 6. 从情绪状态列提取情绪词
    const emotionType = extractEmotionType(cells[2]);
    if (!emotionType) continue;

    // 7. 从强度列提取数字并归一化
    const intensity = extractIntensity(cells[4]);

    return { primaryEmotion: emotionType, intensity };
  }

  return null;
}
