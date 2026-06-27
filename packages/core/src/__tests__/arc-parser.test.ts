import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEmotionFromArcsFile } from "../emotional/arc-parser.js";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("arc-parser", () => {
  let tempDir: string;
  let arcsFilePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inkos-arc-test-"));
    arcsFilePath = join(tempDir, "emotional_arcs.md");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("文件不存在时返回 null", async () => {
    const result = await parseEmotionFromArcsFile(join(tempDir, "nonexistent.md"), 1);
    expect(result).toBeNull();
  });

  it("解析 markdown 表格返回正确情绪", async () => {
    const content = [
      "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
      "|------|------|----------|----------|------|----------|",
      "| 主角 | 1 | 紧张 | 发现神秘盒子 | 7 | 上升 |",
      "| 主角 | 2 | 开心 | 解开谜题 | 8 | 上升 |",
      "| 女主 | 1 | 悲伤 | 失去亲人 | 9 | 下降 |",
    ].join("\n");
    await writeFile(arcsFilePath, content, "utf-8");

    const result = await parseEmotionFromArcsFile(arcsFilePath, 1);
    expect(result).not.toBeNull();
    expect(result!.primaryEmotion).toBeDefined();
    expect(typeof result!.intensity).toBe("number");
    expect(result!.intensity).toBeGreaterThanOrEqual(0);
    expect(result!.intensity).toBeLessThanOrEqual(1);
  });

  it("强度从 1-10 归一化到 0-1", async () => {
    const content = [
      "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
      "|------|------|----------|----------|------|----------|",
      "| 主角 | 5 | 紧张 | 关键时刻 | 10 | 上升 |",
    ].join("\n");
    await writeFile(arcsFilePath, content, "utf-8");

    const result = await parseEmotionFromArcsFile(arcsFilePath, 5);
    expect(result).not.toBeNull();
    // 归一化公式：(value - 1) / 9，强度 10 → (10-1)/9 = 1.0
    expect(result!.intensity).toBeCloseTo(1.0, 1);
  });

  it("强度 5 归一化到 (5-1)/9 ≈ 0.444", async () => {
    const content = [
      "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
      "|------|------|----------|----------|------|----------|",
      "| 主角 | 3 | 开心 | 收到礼物 | 5 | 上升 |",
    ].join("\n");
    await writeFile(arcsFilePath, content, "utf-8");

    const result = await parseEmotionFromArcsFile(arcsFilePath, 3);
    expect(result).not.toBeNull();
    // 归一化公式：(value - 1) / 9，强度 5 → 4/9 ≈ 0.444
    expect(result!.intensity).toBeCloseTo(4 / 9, 2);
  });

  it("章节号不匹配时返回 null", async () => {
    const content = [
      "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
      "|------|------|----------|----------|------|----------|",
      "| 主角 | 1 | 紧张 | 发现盒子 | 7 | 上升 |",
    ].join("\n");
    await writeFile(arcsFilePath, content, "utf-8");

    const result = await parseEmotionFromArcsFile(arcsFilePath, 99);
    expect(result).toBeNull();
  });

  it("中文情绪词正确映射", async () => {
    const testCases = [
      { emotion: "紧张", chapter: 1, expected: "tension" },
      { emotion: "开心", chapter: 2, expected: "joy" },
      { emotion: "悲伤", chapter: 3, expected: "sadness" },
      { emotion: "愤怒", chapter: 4, expected: "anger" },
      { emotion: "害怕", chapter: 5, expected: "fear" },
    ];

    for (const tc of testCases) {
      const content = [
        "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
        "|------|------|----------|----------|------|----------|",
        `| 主角 | ${tc.chapter} | ${tc.emotion} | 事件 | 5 | 上升 |`,
      ].join("\n");
      await writeFile(arcsFilePath, content, "utf-8");

      const result = await parseEmotionFromArcsFile(arcsFilePath, tc.chapter);
      // "害怕" 不在 EMOTION_MAP 中（只有"恐惧"），会返回 null
      if (tc.emotion === "害怕") {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result!.primaryEmotion).toBe(tc.expected);
      }
    }
  });

  it("空文件返回 null", async () => {
    await writeFile(arcsFilePath, "", "utf-8");
    const result = await parseEmotionFromArcsFile(arcsFilePath, 1);
    expect(result).toBeNull();
  });

  it("无表格行时返回 null", async () => {
    await writeFile(arcsFilePath, "这是一段普通文本，没有表格。", "utf-8");
    const result = await parseEmotionFromArcsFile(arcsFilePath, 1);
    expect(result).toBeNull();
  });

  it("强度解析失败时返回默认值 0.5", async () => {
    const content = [
      "| 角色 | 章节 | 情绪状态 | 触发事件 | 强度 | 弧线方向 |",
      "|------|------|----------|----------|------|----------|",
      "| 主角 | 1 | 紧张 | 事件 | 无效 | 上升 |",
    ].join("\n");
    await writeFile(arcsFilePath, content, "utf-8");

    const result = await parseEmotionFromArcsFile(arcsFilePath, 1);
    expect(result).not.toBeNull();
    expect(result!.intensity).toBe(0.5);
  });
});
