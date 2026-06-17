import { readFile, mkdir } from "node:fs/promises";

import { join, dirname } from "node:path";
import { robustWriteFile as writeFile } from "./robust-write.js";

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