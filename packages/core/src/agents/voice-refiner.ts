/**
 * Voice Refiner Agent
 *
 * 角色声音动态更新：每写完若干章节后，从已写章节中提取角色实际说过的台词，
 * 对比"旧 voice profile" vs "真实说话样本"，更新角色的说话风格、常用词、
 * 情绪表达方式等，使角色声音越来越真实、独特。
 *
 * 工作流程：
 * 1. 读取已写章节（最近的 N 章）
 * 2. 对每个角色提取实际对话样本
 * 3. 分析对话样本的特征（句式长度、词汇、情绪表达模式）
 * 4. 对比旧 voice profile，更新各项属性
 * 5. 保存更新后的 voice profiles
 */

import { BaseAgent } from "./base.js";
import type { CharacterVoice, CharacterVoicesFile } from "../utils/character-voices.js";
import {
  loadCharacterVoices,
  saveCharacterVoices,
} from "../utils/character-voices.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface VoiceRefinerInput {
  readonly bookDir: string;
  /** 回顾最近的 N 章来提取对话样本（默认 5） */
  readonly recentChapters?: number;
  /** 要更新的角色列表，默认全部 */
  readonly targetCharacters?: ReadonlyArray<string>;
}

export interface VoiceRefinerOutput {
  readonly updatedCharacters: string[];
  readonly updates: Record<string, VoiceRefinement>;
}

export interface VoiceRefinement {
  readonly speechStyle?: string;
  readonly vocabulary: {
    readonly added: ReadonlyArray<string>;
    readonly removed: ReadonlyArray<string>;
  };
  readonly emotionalExpression?: string;
  readonly subtextPatterns: ReadonlyArray<string>;
  readonly speechTics: ReadonlyArray<string>;
  readonly newSampleDialogues: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a character voice analyst for fiction writing.
Given a character's existing voice profile and actual dialogue samples from recent chapters,
analyze how well the character's voice matches reality and produce refined voice attributes.

You MUST respond with a single JSON object and nothing else. Do not wrap it in markdown fences.

The JSON shape is:
{
  "speechStyle": "<updated description of how this character speaks — sentence length, rhythm, formality, based on the samples>",
  "vocabulary": {
    "added": ["<new word or phrase this character commonly uses, based on samples>", ...],
    "removed": ["<word or phrase that appears in the old profile but is NOT actually used by this character>", ...]
  },
  "emotionalExpression": "<updated description of how this character shows emotion verbally, based on samples>",
  "subtextPatterns": ["<pattern of how this character implies things without saying them directly>", ...],
  "speechTics": ["<habitual words, stutters, pauses, verbal fillers this character uses>", ...],
  "newSampleDialogues": ["<a short line of actual dialogue from the samples that sounds most authentic>", ...]
}

Rules:
- Only include vocabulary that appears in the ACTUAL dialogue samples, not invented
- subtextPatterns should describe HOW this character implies things (e.g., "deflects with questions", "uses humor to avoid serious topics")
- speechTics should be concrete verbal habits (e.g., "ends sentences with '吧'", "pauses with '……'", "starts with '我说啊'")
- newSampleDialogues should be short (under 30 characters) and authentic
- If a field doesn't need updating based on the samples, use the old value
- Output strictly valid JSON.`;

// ---------------------------------------------------------------------------
// VoiceRefinerAgent
// ---------------------------------------------------------------------------

export class VoiceRefinerAgent extends BaseAgent {
  get name(): string {
    return "voice-refiner";
  }

  /**
   * Refine character voices based on recent chapter dialogue samples.
   * Extracts actual dialogue, analyzes patterns, and updates voice profiles.
   */
  async refineVoices(input: VoiceRefinerInput): Promise<VoiceRefinerOutput> {
    const {
      bookDir,
      recentChapters = 5,
      targetCharacters,
    } = input;

    // Load existing voices
    const voices = await loadCharacterVoices(bookDir);
    if (Object.keys(voices.characters).length === 0) {
      this.log?.info("[voice-refiner] No existing voices to refine.");
      return { updatedCharacters: [], updates: {} };
    }

    // Read recent chapters
    const chapters = await this.loadRecentChapters(bookDir, recentChapters);
    if (chapters.length === 0) {
      this.log?.info("[voice-refiner] No recent chapters found.");
      return { updatedCharacters: [], updates: {} };
    }

    const allChapterText = chapters.map((c) => c.content).join("\n");

    // Determine which characters to update
    const charactersToUpdate = targetCharacters
      ?? Object.keys(voices.characters);

    const updates: Record<string, VoiceRefinement> = {};
    const updatedCharacters: string[] = [];

    // Process each character
    for (const charName of charactersToUpdate) {
      const oldVoice = voices.characters[charName];
      if (!oldVoice) continue;

      // Extract dialogue for this character
      const dialogueSamples = this.extractCharacterDialogue(
        allChapterText,
        charName,
        10, // Extract up to 10 samples per character
      );

      if (dialogueSamples.length < 3) {
        this.log?.info(
          `[voice-refiner] Skipping "${charName}" — not enough dialogue samples (${dialogueSamples.length})`,
        );
        continue;
      }

      // Analyze and refine voice
      const refinement = await this.analyzeVoice(
        charName,
        oldVoice,
        dialogueSamples,
      );

      if (refinement) {
        // Update the voice profile
        const newSpeechStyle =
          refinement.speechStyle ?? oldVoice.speechStyle;
        const newVocab = this.mergeVocabulary(
          oldVoice.vocabulary,
          refinement.vocabulary.added,
          refinement.vocabulary.removed,
        );
        const newEmotionalExpression =
          refinement.emotionalExpression ?? oldVoice.emotionalExpression;
        const newSampleDialogues = this.mergeSampleDialogues(
          oldVoice.sampleDialogues,
          refinement.newSampleDialogues,
          10, // Keep max 10 samples
        );

        voices.characters[charName] = {
          ...oldVoice,
          speechStyle: newSpeechStyle,
          vocabulary: newVocab,
          emotionalExpression: newEmotionalExpression,
          sampleDialogues: newSampleDialogues,
        };

        updates[charName] = refinement;
        updatedCharacters.push(charName);
      }
    }

    // Save updated voices
    if (updatedCharacters.length > 0) {
      await saveCharacterVoices(bookDir, voices);
      this.log?.info(
        `[voice-refiner] Updated voices for: ${updatedCharacters.join(", ")}`,
      );
    }

    return { updatedCharacters, updates };
  }

  /**
   * Extract dialogue lines for a specific character from text.
   * Simple regex-based extraction.
   */
  private extractCharacterDialogue(
    text: string,
    characterName: string,
    maxSamples: number,
  ): string[] {
    const samples: string[] = [];

    // Pattern: "CharacterName: dialogue" or "CharacterName 说：" etc.
    const patterns = [
      // Chinese dialogue patterns
      new RegExp(`${characterName}[：:]["『「](.+?)["』」]`, "g"),
      new RegExp(`${characterName}[：:](.+?)(?=\\n[A-Z]|$)`, "g"),
      // English dialogue patterns
      new RegExp(`${characterName}[,.:] "?(.+?)"?\\n`, "gi"),
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const dialogue = (match[1] ?? "").trim();
        if (dialogue.length > 5 && dialogue.length < 200) {
          samples.push(dialogue);
          if (samples.length >= maxSamples) break;
        }
      }
      if (samples.length >= maxSamples) break;
    }

    return samples;
  }

  /**
   * Analyze voice samples and produce refined voice attributes.
   */
  private async analyzeVoice(
    characterName: string,
    oldVoice: CharacterVoice,
    dialogueSamples: string[],
  ): Promise<VoiceRefinement | null> {
    const samplesText = dialogueSamples
      .map((s, i) => `Sample ${i + 1}: ${s}`)
      .join("\n");

    const prompt = `Analyze the voice for character "${characterName}" based on their actual dialogue.

## Old Voice Profile
- Speech Style: ${oldVoice.speechStyle || "(not defined)"}
- Vocabulary: ${oldVoice.vocabulary.join(", ") || "(not defined)"}
- Emotional Expression: ${oldVoice.emotionalExpression || "(not defined)"}
- Sample Dialogues: ${oldVoice.sampleDialogues.join("; ") || "(not defined)"}

## Actual Dialogue Samples from Recent Chapters
${samplesText}

Analyze these samples and produce refined voice attributes.`;

    try {
      const response = await this.chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        { temperature: 0.3 },
      );

      const raw = response.content.trim();
      return this.parseRefinementResponse(raw, dialogueSamples);
    } catch (err) {
      this.log?.warn(`[voice-refiner] Failed to analyze voice for "${characterName}": ${err}`);
      return null;
    }
  }

  /**
   * Parse the LLM response into VoiceRefinement.
   */
  private parseRefinementResponse(
    raw: string,
    originalSamples: string[],
  ): VoiceRefinement {
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (typeof parsed !== "object" || parsed === null) {
        return this.defaultRefinement(originalSamples);
      }

      const obj = parsed as Record<string, unknown>;

      const vocab = obj.vocabulary as Record<string, unknown> | undefined;

      return {
        speechStyle:
          typeof obj.speechStyle === "string" ? obj.speechStyle : undefined,
        vocabulary: {
          added: this.toStringArray(vocab?.["added"]),
          removed: this.toStringArray(vocab?.["removed"]),
        },
        emotionalExpression:
          typeof obj.emotionalExpression === "string"
            ? obj.emotionalExpression
            : undefined,
        subtextPatterns: this.toStringArray(obj.subtextPatterns),
        speechTics: this.toStringArray(obj.speechTics),
        newSampleDialogues: this.toStringArray(obj.newSampleDialogues),
      };
    } catch {
      return this.defaultRefinement(originalSamples);
    }
  }

  private defaultRefinement(samples: string[]): VoiceRefinement {
    return {
      vocabulary: { added: [], removed: [] },
      subtextPatterns: [],
      speechTics: [],
      newSampleDialogues: samples.slice(0, 5),
    };
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return value;
    }
    return [];
  }

  /**
   * Merge old vocabulary with added/removed items.
   */
  private mergeVocabulary(
    oldVocab: ReadonlyArray<string>,
    added: ReadonlyArray<string>,
    removed: ReadonlyArray<string>,
  ): string[] {
    const removedSet = new Set(removed);
    const addedSet = new Set(added);

    const merged = oldVocab
      .filter((v) => !removedSet.has(v) && !addedSet.has(v))
      .concat([...addedSet]);

    // Keep max 20 vocabulary items
    return merged.slice(0, 20);
  }

  /**
   * Merge old and new sample dialogues.
   */
  private mergeSampleDialogues(
    oldSamples: ReadonlyArray<string>,
    newSamples: ReadonlyArray<string>,
    maxSamples: number,
  ): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];

    // Add new samples first (more relevant)
    for (const s of newSamples) {
      if (!seen.has(s)) {
        seen.add(s);
        merged.push(s);
        if (merged.length >= maxSamples) break;
      }
    }

    // Add old samples that aren't duplicated
    for (const s of oldSamples) {
      if (!seen.has(s)) {
        seen.add(s);
        merged.push(s);
        if (merged.length >= maxSamples) break;
      }
    }

    return merged;
  }

  /**
   * Load recent chapters from the book directory.
   */
  private async loadRecentChapters(
    bookDir: string,
    recentChapters: number,
  ): Promise<Array<{ chapterNumber: number; content: string }>> {
    const chaptersDir = join(bookDir, "chapters");
    const chapters: Array<{ chapterNumber: number; content: string }> = [];

    try {
      const files = await readdir(chaptersDir);
      const chapterFiles = files
        .filter((f) => f.endsWith(".md") && f.startsWith("chapter-"))
        .sort()
        .slice(-recentChapters);

      for (const file of chapterFiles) {
        const content = await readFile(join(chaptersDir, file), "utf-8");
        const match = file.match(/chapter-(\d+)\.md/);
        const chapterNumber = match ? parseInt(match[1], 10) : 0;
        chapters.push({ chapterNumber, content });
      }
    } catch {
      this.log?.warn("[voice-refiner] Could not read chapters directory.");
    }

    return chapters;
  }
}
