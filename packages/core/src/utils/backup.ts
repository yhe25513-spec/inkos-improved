import { promises as fs } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip, createGunzip } from "node:zlib";
import { join, relative } from "node:path";
import { randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";

// ── Interfaces ──────────────────────────────────────────────

export interface BackupConfig {
  readonly enabled: boolean;
  readonly maxBackups: number;
  readonly backupDir: string;
  readonly includeChapters: boolean;
  readonly includeStoryFiles: boolean;
  readonly includeTruthFiles: boolean;
}

export interface BackupMetadata {
  readonly id: string;
  readonly timestamp: number;
  readonly bookId: string;
  readonly chapterCount: number;
  readonly sizeBytes: number;
  readonly description?: string;
}

export interface BackupResult {
  readonly success: boolean;
  readonly backupId: string;
  readonly path: string;
  readonly metadata: BackupMetadata;
}

export interface RestoreResult {
  readonly success: boolean;
  readonly restoredFiles: ReadonlyArray<string>;
  readonly backupId: string;
}

// ── Helpers ─────────────────────────────────────────────────

const CHAPTERS_DIR = "chapters";
const STORY_DIR = "story";
const STATE_DIR = "state";
const METADATA_FILE = "metadata.json";

function generateBackupId(): string {
  const ts = Date.now();
  const rand = randomBytes(2).toString("hex");
  return `backup-${ts}-${rand}`;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively collect every file path under `root`, returned as
 * relative paths separated by forward slashes.
 */
async function collectFiles(root: string): Promise<string[]> {
  const result: string[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        result.push(relative(root, full).split("\\").join("/"));
      }
    }
  }

  if (await dirExists(root)) {
    await walk(root);
  }
  return result;
}

/**
 * Compress a file at `src` into a `.gz` file at `dest`, then delete `src`.
 */
async function compressFile(src: string, dest: string): Promise<void> {
  await pipeline(createReadStream(src), createGzip(), createWriteStream(dest));
  await fs.unlink(src);
}

/**
 * Decompress a `.gz` file at `src` back to its original location.
 */
async function decompressFile(src: string): Promise<void> {
  const dest = src.replace(/\.gz$/, "");
  await pipeline(createReadStream(src), createGunzip(), createWriteStream(dest));
  await fs.unlink(src);
}

/**
 * Compress every file under `dir` to `.gz` and delete originals.
 */
async function compressDir(dir: string): Promise<void> {
  if (!(await dirExists(dir))) return;
  const files = await collectFiles(dir);
  for (const rel of files) {
    const full = join(dir, rel);
    await compressFile(full, full + ".gz");
  }
}

/**
 * Decompress every `.gz` file under `dir` back and delete the gz.
 */
async function decompressDir(dir: string): Promise<void> {
  if (!(await dirExists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await decompressDir(join(dir, entry.name));
    } else if (entry.name.endsWith(".gz")) {
      await decompressFile(join(dir, entry.name));
    }
  }
}

/**
 * Recursively copy `src` into `dest` (creating directories as needed).
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get the total byte size of all files under `dir`.
 */
async function dirSize(dir: string): Promise<number> {
  let total = 0;
  if (!(await dirExists(dir))) return 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(p);
    } else {
      const stat = await fs.stat(p);
      total += stat.size;
    }
  }
  return total;
}

/**
 * Derive a bookId from the book directory name (the last segment).
 */
function deriveBookId(bookDir: string): string {
  // Use the last directory segment as the bookId.
  const parts = bookDir.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "unknown";
}

/**
 * Count chapter files (*.md) under the chapters directory.
 */
async function countChapters(chaptersDir: string): Promise<number> {
  if (!(await dirExists(chaptersDir))) return 0;
  const files = await fs.readdir(chaptersDir);
  return files.filter((f) => f.endsWith(".md")).length;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Create a backup of a book.
 */
export async function createBackup(
  bookDir: string,
  config: BackupConfig,
  description?: string,
): Promise<BackupResult> {
  const backupId = generateBackupId();
  const backupRoot = join(bookDir, config.backupDir);
  const backupPath = join(backupRoot, backupId);

  // Ensure the backup root exists.
  await fs.mkdir(backupRoot, { recursive: true });

  const chapterSource = join(bookDir, CHAPTERS_DIR);
  const storySource = join(bookDir, STORY_DIR);
  const truthSource = join(bookDir, STATE_DIR);

  // Copy included directories into the backup.
  if (config.includeChapters && (await dirExists(chapterSource))) {
    await copyDir(chapterSource, join(backupPath, CHAPTERS_DIR));
  }
  if (config.includeStoryFiles && (await dirExists(storySource))) {
    await copyDir(storySource, join(backupPath, STORY_DIR));
  }
  if (config.includeTruthFiles && (await dirExists(truthSource))) {
    await copyDir(truthSource, join(backupPath, STATE_DIR));
  }

  // Compress the copied directories.
  await compressDir(join(backupPath, CHAPTERS_DIR));
  await compressDir(join(backupPath, STORY_DIR));
  await compressDir(join(backupPath, STATE_DIR));

  // Build and write metadata.
  const chapterCount = config.includeChapters
    ? await countChapters(chapterSource)
    : 0;
  const sizeBytes = await dirSize(backupPath);

  const metadata: BackupMetadata = {
    id: backupId,
    timestamp: Date.now(),
    bookId: deriveBookId(bookDir),
    chapterCount,
    sizeBytes,
    ...(description !== undefined ? { description } : {}),
  };

  await fs.writeFile(
    join(backupPath, METADATA_FILE),
    JSON.stringify(metadata, null, 2),
    "utf-8",
  );

  return { success: true, backupId, path: backupPath, metadata };
}

/**
 * Restore from a backup.
 */
export async function restoreBackup(
  bookDir: string,
  backupId: string,
  config: BackupConfig,
): Promise<RestoreResult> {
  const backupRoot = join(bookDir, config.backupDir);
  const backupPath = join(backupRoot, backupId);

  if (!(await dirExists(backupPath))) {
    return { success: false, restoredFiles: [], backupId };
  }

  const restoredFiles: string[] = [];

  const targetMap: Array<{
    subdir: string;
    include: boolean;
    target: string;
  }> = [
    {
      subdir: CHAPTERS_DIR,
      include: config.includeChapters,
      target: join(bookDir, CHAPTERS_DIR),
    },
    {
      subdir: STORY_DIR,
      include: config.includeStoryFiles,
      target: join(bookDir, STORY_DIR),
    },
    {
      subdir: STATE_DIR,
      include: config.includeTruthFiles,
      target: join(bookDir, STATE_DIR),
    },
  ];

  for (const { subdir, include, target } of targetMap) {
    const sourceDir = join(backupPath, subdir);
    if (!include || !(await dirExists(sourceDir))) continue;

    // Decompress backed-up files.
    await decompressDir(sourceDir);

    // Copy back into the book directory.
    const files = await collectFiles(sourceDir);
    await fs.mkdir(target, { recursive: true });
    for (const rel of files) {
      const srcFile = join(sourceDir, rel);
      const destFile = join(target, rel);
      const destDir = join(target, rel.split("/").slice(0, -1).join("/"));
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(srcFile, destFile);
      restoredFiles.push(`${subdir}/${rel}`);
    }

    // Re-compress the backup copies so they stay compressed.
    await compressDir(sourceDir);
  }

  return { success: true, restoredFiles, backupId };
}

/**
 * List all backups for a book, sorted newest-first.
 */
export async function listBackups(
  bookDir: string,
): Promise<ReadonlyArray<BackupMetadata>> {
  const backupRoot = join(bookDir, "backups");
  if (!(await dirExists(backupRoot))) return [];

  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const metas: BackupMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = join(backupRoot, entry.name, METADATA_FILE);
    try {
      const raw = await fs.readFile(metaPath, "utf-8");
      const meta: BackupMetadata = JSON.parse(raw) as BackupMetadata;
      metas.push(meta);
    } catch {
      // Skip corrupted or missing metadata.
    }
  }

  metas.sort((a, b) => b.timestamp - a.timestamp);
  return metas;
}

/**
 * Delete a specific backup by ID.
 */
export async function deleteBackup(
  bookDir: string,
  backupId: string,
): Promise<void> {
  const backupDir = join(bookDir, "backups", backupId);
  await fs.rm(backupDir, { recursive: true, force: true });
}

/**
 * Auto-cleanup old backups, keeping only the `maxBackups` most recent.
 */
export async function cleanupOldBackups(
  bookDir: string,
  maxBackups: number,
): Promise<void> {
  const backups = await listBackups(bookDir);
  if (backups.length <= maxBackups) return;

  // Delete all but the first maxBackups entries (already sorted newest-first).
  const toDelete = backups.slice(maxBackups);
  for (const meta of toDelete) {
    await deleteBackup(bookDir, meta.id);
  }
}
