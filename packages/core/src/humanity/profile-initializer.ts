// ── 真人感画像初始化器 ──────────────────────────────────
// 从小说样本目录读取 .txt 文件，提取 12 维 HumanityFingerprint，
// 反推 StyleInjection 参数，创建并持久化 HumanityProfile

import { SampleAnalyzer } from "./sample-analyzer.js";
import {
  createDefaultHumanityProfile,
  deriveStyleInjectionFromFingerprint,
  type HumanityProfile,
} from "../models/humanity-profile.js";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname, extname } from "node:path";

/**
 * 从指定目录下的 .txt 小说样本初始化真人感画像
 *
 * 流程：
 * 1. 读取 samplesDir 下所有 .txt 文件
 * 2. 调用 SampleAnalyzer.analyzeFromFiles() 提取 12 维指纹
 * 3. 调用 deriveStyleInjectionFromFingerprint() 反推注入参数
 * 4. 创建默认 profile，覆盖 fingerprint 和 styleInjection
 * 5. 持久化到 outputPath
 *
 * @param samplesDir 样本文件所在目录
 * @param outputPath 画像输出路径（JSON）
 * @returns 初始化后的 HumanityProfile
 */
export async function initializeHumanityProfileFromSamples(
  samplesDir: string,
  outputPath: string,
): Promise<HumanityProfile> {
  // 1. 读取 samplesDir 下所有 .txt 文件
  const entries = await readdir(samplesDir, { withFileTypes: true });
  const txtFiles = entries
    .filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".txt")
    .map((e) => e.name)
    .sort();

  if (txtFiles.length === 0) {
    throw new Error(
      `[humanity] 样本目录 ${samplesDir} 下未找到任何 .txt 文件，无法初始化画像`,
    );
  }

  // 读取每个文件内容，组装为 SampleAnalyzer 所需的入参
  const files: Array<{ name: string; content: string }> = [];
  for (const name of txtFiles) {
    const content = await readFile(join(samplesDir, name), "utf-8");
    files.push({ name, content });
  }

  // 2. 提取 12 维指纹
  const analyzer = new SampleAnalyzer();
  const fingerprint = await analyzer.analyzeFromFiles(files);

  // 3. 反推风格注入参数
  const styleInjection = deriveStyleInjectionFromFingerprint(fingerprint);

  // 4. 创建默认 profile 并覆盖指纹与注入参数
  const profile = createDefaultHumanityProfile();
  profile.fingerprint = fingerprint;
  profile.styleInjection = styleInjection;
  profile.learnedFromSamples = files.map((f) => f.name);
  profile.updatedAt = new Date().toISOString();

  // 5. 持久化到 outputPath
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(profile, null, 2), "utf-8");

  return profile;
}

/**
 * 加载已有的真人感画像，失败则返回默认画像
 *
 * @param profilePath 画像文件路径（JSON）
 * @returns 加载到的画像，或默认画像
 */
export async function loadOrCreateHumanityProfile(
  profilePath: string,
): Promise<HumanityProfile> {
  try {
    const raw = await readFile(profilePath, "utf-8");
    const parsed = JSON.parse(raw) as HumanityProfile;
    // 基本字段校验，缺失关键字段则回退到默认画像
    if (
      parsed &&
      parsed.fingerprint &&
      parsed.styleInjection &&
      typeof parsed.fingerprint.sentenceLengthStd === "number"
    ) {
      return parsed;
    }
  } catch {
    // 文件不存在或解析失败，回退到默认画像
  }
  return createDefaultHumanityProfile();
}
