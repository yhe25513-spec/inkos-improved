/**
 * Atomic file write via temp-file-then-rename with direct-write fallback.
 *
 * This is the single canonical implementation used across the codebase.
 * All files that previously defined their own `robustWriteFile` should
 * import from this module instead.
 */
import { writeFile as _origWrite, rename, unlink } from "node:fs/promises";

export async function robustWriteFile(
  path: string,
  data: string,
  encoding: BufferEncoding = "utf-8",
): Promise<void> {
  const tmpPath = `${path}.inkos-tmp-${process.pid}-${Date.now()}`;
  try {
    await _origWrite(tmpPath, data, encoding);
    await rename(tmpPath, path);
  } catch {
    // Atomic write failed (e.g., cross-device rename, permissions).
    // Fall back to direct write — best-effort, caller cannot recover.
    try { await unlink(tmpPath); } catch { /* temp file may not exist */ }
    try { await _origWrite(path, data, encoding); } catch { /* last resort */ }
  }
}

/** Convenience alias — callers that used `writeFile(...)` locally can keep using it. */
export const writeFile = robustWriteFile;
