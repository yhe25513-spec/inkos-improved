import { readFile, mkdir } from "node:fs/promises";

import { dirname, join } from "node:path";
import { robustWriteFile as writeFile } from "./robust-write.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CharacterMemoryEntry {
  readonly chapterNumber: number;
  readonly timestamp: number;
  readonly type: "dialogue" | "action" | "emotion" | "knowledge";
  readonly content: string;
  readonly participants?: ReadonlyArray<string>;
  readonly emotion?: string;
}

export interface CharacterMemory {
  readonly characterName: string;
  readonly entries: ReadonlyArray<CharacterMemoryEntry>;
  readonly knownFacts: ReadonlyArray<string>;
  readonly relationships: Record<string, string>; // character name -> relationship description
}

export interface MemoryStore {
  readonly version: string;
  readonly characters: Record<string, CharacterMemory>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEMORY_VERSION = "1.0.0";
const MAX_ENTRIES_PER_CHARACTER = 20;
const MEMORY_FILENAME = "character_memory.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyCharacterMemory(characterName: string): CharacterMemory {
  return {
    characterName,
    entries: [],
    knownFacts: [],
    relationships: {},
  };
}

function ensureCharacter(store: MemoryStore, characterName: string): CharacterMemory {
  return store.characters[characterName] ?? emptyCharacterMemory(characterName);
}

function memoryFilePath(bookDir: string): string {
  return join(bookDir, "story", MEMORY_FILENAME);
}

/**
 * Trim entries to keep only the most recent MAX_ENTRIES_PER_CHARACTER items.
 * Older entries are discarded. Known facts are preserved regardless.
 */
function trimEntries(memory: CharacterMemory): CharacterMemory {
  if (memory.entries.length <= MAX_ENTRIES_PER_CHARACTER) return memory;
  const trimmed = memory.entries.slice(-MAX_ENTRIES_PER_CHARACTER);
  return { ...memory, entries: trimmed };
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/**
 * Load the character memory store from `story/character_memory.json`.
 * Returns a fresh empty store if the file does not exist or cannot be parsed.
 */
export async function loadCharacterMemory(bookDir: string): Promise<MemoryStore> {
  const filePath = memoryFilePath(bookDir);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MemoryStore;
    if (parsed && typeof parsed.version === "string" && parsed.characters) {
      return parsed;
    }
  } catch {
    // File missing or corrupt – fall through to default.
  }
  return { version: MEMORY_VERSION, characters: {} };
}

/**
 * Save the character memory store to `story/character_memory.json`.
 * Creates the directory if it does not exist.
 */
export async function saveCharacterMemory(bookDir: string, store: MemoryStore): Promise<void> {
  const filePath = memoryFilePath(bookDir);
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const serialised = JSON.stringify(store, null, 2);
  await writeFile(filePath, serialised, "utf-8");
}

// ---------------------------------------------------------------------------
// Query / Mutation
// ---------------------------------------------------------------------------

/**
 * Add a new memory entry for a character.
 * Automatically trims old entries when the per-character limit is exceeded.
 * If the entry type is "knowledge", its content is also appended to `knownFacts`.
 * Returns a **new** MemoryStore (immutable update).
 */
export function addMemoryEntry(
  store: MemoryStore,
  characterName: string,
  entry: CharacterMemoryEntry
): MemoryStore {
  const existing = ensureCharacter(store, characterName);

  const newEntries = [...existing.entries, entry];

  let newKnownFacts = [...existing.knownFacts];
  if (entry.type === "knowledge" && !newKnownFacts.includes(entry.content)) {
    newKnownFacts = [...newKnownFacts, entry.content];
  }

  const updated: CharacterMemory = trimEntries({
    ...existing,
    entries: newEntries,
    knownFacts: newKnownFacts,
  });

  return {
    ...store,
    characters: {
      ...store.characters,
      [characterName]: updated,
    },
  };
}

/**
 * Get recent memories for a character filtered by the last N chapters.
 * The `lastNChapters` parameter is relative to the highest chapter number
 * present in the character's entries. For example, `lastNChapters = 2` returns
 * entries whose `chapterNumber` is >= (maxChapter - 1).
 */
export function getRecentMemories(
  store: MemoryStore,
  characterName: string,
  lastNChapters: number
): ReadonlyArray<CharacterMemoryEntry> {
  const memory = ensureCharacter(store, characterName);
  if (memory.entries.length === 0) return [];

  const chapters = memory.entries.map((e) => e.chapterNumber);
  const maxChapter = Math.max(...chapters);
  const threshold = maxChapter - (lastNChapters - 1);

  return memory.entries.filter((e) => e.chapterNumber >= threshold);
}

/**
 * Get accumulated knowledge for a character.
 */
export function getCharacterKnowledge(
  store: MemoryStore,
  characterName: string
): ReadonlyArray<string> {
  const memory = ensureCharacter(store, characterName);
  return memory.knownFacts;
}

/**
 * Get the relationship string between two characters.
 * Relationships are bidirectional: the function checks both directions.
 */
export function getRelationship(
  store: MemoryStore,
  character1: string,
  character2: string
): string | undefined {
  const mem1 = store.characters[character1];
  if (mem1?.relationships[character2]) return mem1.relationships[character2];

  const mem2 = store.characters[character2];
  if (mem2?.relationships[character1]) return mem2.relationships[character1];

  return undefined;
}

/**
 * Update the relationship between two characters.
 * Sets the description in **both** characters' records for bidirectional consistency.
 * Returns a new MemoryStore.
 */
export function updateRelationship(
  store: MemoryStore,
  character1: string,
  character2: string,
  description: string
): MemoryStore {
  const mem1 = ensureCharacter(store, character1);
  const mem2 = ensureCharacter(store, character2);

  const updated1: CharacterMemory = {
    ...mem1,
    relationships: { ...mem1.relationships, [character2]: description },
  };
  const updated2: CharacterMemory = {
    ...mem2,
    relationships: { ...mem2.relationships, [character1]: description },
  };

  return {
    ...store,
    characters: {
      ...store.characters,
      [character1]: updated1,
      [character2]: updated2,
    },
  };
}
