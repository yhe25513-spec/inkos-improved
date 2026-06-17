import { BaseAgent } from "./base.js";
import type {
  CharacterVoice,
  CharacterVoicesFile,
} from "../utils/character-voices.js";
import {
  loadCharacterVoices,
  saveCharacterVoices,
} from "../utils/character-voices.js";
import { readRoleCards } from "../utils/outline-paths.js";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface ExtractVoiceInput {
  readonly roleName: string;
  readonly roleContent: string;
}

export interface ExtractVoiceOutput {
  readonly voice: CharacterVoice;
}

// ---------------------------------------------------------------------------
// Default voice returned on parse failure
// ---------------------------------------------------------------------------

function defaultVoice(name: string): CharacterVoice {
  return {
    name,
    speechStyle: "",
    forbiddenTone: [],
    vocabulary: [],
    personality: [],
    emotionalExpression: "",
    sampleDialogues: [],
    infoBoundary: [],
  };
}

// ---------------------------------------------------------------------------
// LLM system prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a character voice analyst for fiction writing.
Given a character's role card, extract the character's unique "voice" profile — the distinctive way they speak, think, and express themselves.

You MUST respond with a single JSON object and nothing else. Do not wrap it in markdown fences.

The JSON shape is:
{
  "name": "<character name>",
  "speechStyle": "<one-paragraph description of how they typically speak — sentence length, rhythm, formality>",
  "forbiddenTone": ["<tone or expression this character would NEVER use>", ...],
  "vocabulary": ["<word or phrase this character commonly uses>", ...],
  "personality": ["<trait that shapes their speech, e.g. 'blunt and direct'>", ...],
  "emotionalExpression": "<one-paragraph description of how they show emotion verbally>",
  "sampleDialogues": ["<a short line of sample dialogue that sounds like this character>", ...],
  "infoBoundary": ["<topic or information this character would refuse to reveal or deflect>", ...]
}

Rules:
- forbiddenTone, vocabulary, personality, sampleDialogues, and infoBoundary are arrays of strings.
- speechStyle and emotionalExpression are plain strings.
- Keep each array item concise (one short sentence or phrase).
- Extract ONLY what can be reasonably inferred from the role card; do not invent details that contradict it.
- Output strictly valid JSON.`;

// ---------------------------------------------------------------------------
// CharacterVoiceExtractor
// ---------------------------------------------------------------------------

export class CharacterVoiceExtractor extends BaseAgent {
  get name(): string {
    return "character-voice-extractor";
  }

  /**
   * Read every role card in `story/roles/`, extract voices for any character
   * not yet present in the voices file, persist the result, and return it.
   */
  async extractAllVoices(bookDir: string): Promise<CharacterVoicesFile> {
    const voices = await loadCharacterVoices(bookDir);
    const roleCards = await readRoleCards(bookDir);

    const updatedCharacters: Record<string, CharacterVoice> = {
      ...voices.characters,
    };

    for (const card of roleCards) {
      if (updatedCharacters[card.name] != null) {
        // Voice already extracted — skip.
        this.log?.info(
          `[voice-extractor] Skipping "${card.name}" — voice already exists.`,
        );
        continue;
      }

      this.log?.info(
        `[voice-extractor] Extracting voice for "${card.name}" (${card.tier})...`,
      );

      const { voice } = await this.extractVoice({
        roleName: card.name,
        roleContent: card.content,
      });

      updatedCharacters[card.name] = voice;
    }

    const updated: CharacterVoicesFile = {
      ...voices,
      characters: updatedCharacters,
    };

    await saveCharacterVoices(bookDir, updated);
    this.log?.info(
      `[voice-extractor] Saved voices for ${Object.keys(updatedCharacters).length} character(s).`,
    );

    return updated;
  }

  /**
   * Extract a single character's voice profile from a role card via LLM.
   */
  async extractVoice(
    input: ExtractVoiceInput,
  ): Promise<ExtractVoiceOutput> {
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Extract the voice profile for the character "${input.roleName}" from the following role card:\n\n${input.roleContent}`,
      },
    ];

    try {
      const response = await this.chat(messages, { temperature: 0.3 });
      const raw = response.content.trim();

      const voice = parseVoiceResponse(raw, input.roleName);
      return { voice };
    } catch {
      // Any error (network, parse, etc.) — return default voice.
      return { voice: defaultVoice(input.roleName) };
    }
  }
}

// ---------------------------------------------------------------------------
// Parsing helper
// ---------------------------------------------------------------------------

function parseVoiceResponse(raw: string, fallbackName: string): CharacterVoice {
  // Strip markdown code fences if present.
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (typeof parsed !== "object" || parsed === null) {
    return defaultVoice(fallbackName);
  }

  const obj = parsed as Record<string, unknown>;

  return {
    name: typeof obj.name === "string" ? obj.name : fallbackName,
    speechStyle:
      typeof obj.speechStyle === "string" ? obj.speechStyle : "",
    forbiddenTone: toStringArray(obj.forbiddenTone),
    vocabulary: toStringArray(obj.vocabulary),
    personality: toStringArray(obj.personality),
    emotionalExpression:
      typeof obj.emotionalExpression === "string"
        ? obj.emotionalExpression
        : "",
    sampleDialogues: toStringArray(obj.sampleDialogues),
    infoBoundary: toStringArray(obj.infoBoundary),
  };
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value;
  }
  return [];
}
