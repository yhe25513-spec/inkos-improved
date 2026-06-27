import { readFile } from "node:fs/promises";

/**
 * 读取文件内容，文件不存在或读取失败时返回空字符串。
 *
 * 用于"文件可能不存在"的场景，避免每个调用点都写 `.catch(() => "")`。
 */
export async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}
