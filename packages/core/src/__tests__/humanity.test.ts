import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HumanityEngine } from "../humanity/humanity-engine.js";
import { SampleAnalyzer } from "../humanity/sample-analyzer.js";
import { SceneBreaker } from "../humanity/scene-breaker.js";
import { SilenceLayerInjector } from "../humanity/silence-layer.js";
import { SelfContradictionGenerator } from "../humanity/self-contradiction.js";
import {
  BREATHING_TEMPLATES,
  SILENCE_REPLACEMENTS,
  getRandomTemplate,
  getRandomBreathingText,
  getRandomSilenceReplacement,
} from "../humanity/templates.js";
import {
  loadOrCreateHumanityProfile,
} from "../humanity/profile-initializer.js";
import { createDefaultHumanityProfile } from "../models/humanity-profile.js";
import { join } from "node:path";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("HumanityEngine", () => {
  let engine: HumanityEngine;

  beforeEach(() => {
    engine = new HumanityEngine({ enablePostProcess: true, enablePromptEnhancement: true });
  });

  it("initialize 返回 HumanityProfile", async () => {
    const profile = await engine.initialize({});
    expect(profile).toBeDefined();
    expect(profile.fingerprint).toBeDefined();
    expect(profile.styleInjection).toBeDefined();
  });

  it("initialize 后 getProfile 返回同一画像", async () => {
    const profile = await engine.initialize({});
    expect(engine.getProfile()).toEqual(profile);
  });

  it("updateProfile 更新画像", async () => {
    await engine.initialize({});
    const newProfile = createDefaultHumanityProfile();
    engine.updateProfile(newProfile);
    expect(engine.getProfile()).toEqual(newProfile);
  });

  it("enhanceSystemPrompt 返回包含原提示词的增强字符串", async () => {
    await engine.initialize({});
    const basePrompt = "你是一个小说写作助手。";
    const enhanced = engine.enhanceSystemPrompt(basePrompt);
    expect(enhanced).toContain("你是一个小说写作助手。");
    expect(typeof enhanced).toBe("string");
  });

  it("postProcessWrittenText 返回字符串", async () => {
    await engine.initialize({});
    const text = "他走进了房间。他看到了一本书。他拿起了书。";
    const result = engine.postProcessWrittenText(text);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("postProcessWrittenText 处理空文本", async () => {
    await engine.initialize({});
    const result = engine.postProcessWrittenText("");
    expect(typeof result).toBe("string");
  });
});

describe("SampleAnalyzer", () => {
  let analyzer: SampleAnalyzer;

  beforeEach(() => {
    analyzer = new SampleAnalyzer();
  });

  it("analyzeFromFiles 从样本提取指纹", async () => {
    const samples = [
      { name: "sample1.txt", content: "他走进了房间，看到了桌上的书。窗外下着雨。" },
      { name: "sample2.txt", content: "她站在门口，犹豫了一下。风吹过她的头发。" },
    ];
    const fingerprint = await analyzer.analyzeFromFiles(samples);
    expect(fingerprint).toBeDefined();
    expect(typeof fingerprint.sentenceLengthStd).toBe("number");
    expect(typeof fingerprint.burstIndex).toBe("number");
  });

  it("analyze 处理空数组返回默认指纹", async () => {
    const fingerprint = await analyzer.analyze([]);
    expect(fingerprint).toBeDefined();
    expect(fingerprint.sentenceLengthStd).toBeGreaterThanOrEqual(0);
  });

  it("analyze 处理短文本不崩溃", async () => {
    const fingerprint = await analyzer.analyze(["短。"]);
    expect(fingerprint).toBeDefined();
  });
});

describe("SceneBreaker", () => {
  let sceneBreaker: SceneBreaker;

  beforeEach(() => {
    const profile = createDefaultHumanityProfile();
    sceneBreaker = new SceneBreaker(profile);
  });

  it("planBreathingPoints 返回数组", () => {
    const outline = {
      id: "ch1",
      title: "第一章",
      scenes: [
        { id: "s1", description: "场景一", tension: 5 },
        { id: "s2", description: "场景二", tension: 8 },
      ],
    };
    const points = sceneBreaker.planBreathingPoints(outline);
    expect(Array.isArray(points)).toBe(true);
  });

  it("generateBreathingText 返回非空字符串", () => {
    const outline = {
      id: "ch1",
      title: "第一章",
      scenes: [{ id: "s1", description: "场景一", tension: 5 }],
    };
    const points = sceneBreaker.planBreathingPoints(outline);
    if (points.length > 0) {
      const context = { chapterNumber: 1, protagonist: "主角" };
      const text = sceneBreaker.generateBreathingText(points[0]!, context);
      expect(typeof text).toBe("string");
    }
  });

  it("updateProfile 更新画像", () => {
    const newProfile = createDefaultHumanityProfile();
    expect(() => sceneBreaker.updateProfile(newProfile)).not.toThrow();
  });
});

describe("SilenceLayerInjector", () => {
  let injector: SilenceLayerInjector;

  beforeEach(() => {
    const profile = createDefaultHumanityProfile();
    injector = new SilenceLayerInjector(profile);
  });

  it("injectSilence 返回字符串", () => {
    const text = "他很紧张。他走进了房间。";
    const result = injector.injectSilence(text);
    expect(typeof result).toBe("string");
  });

  it("replaceExplanationWithImplication 返回字符串", () => {
    const text = "他非常生气，因为事情没有按计划进行。";
    const result = injector.replaceExplanationWithImplication(text);
    expect(typeof result).toBe("string");
  });

  it("updateProfile 更新画像", () => {
    const newProfile = createDefaultHumanityProfile();
    expect(() => injector.updateProfile(newProfile)).not.toThrow();
  });
});

describe("SelfContradictionGenerator", () => {
  let generator: SelfContradictionGenerator;

  beforeEach(() => {
    const profile = createDefaultHumanityProfile();
    generator = new SelfContradictionGenerator(profile);
  });

  it("injectContradictions 返回字符串", () => {
    const text = "他决定去北京。他收拾好了行李。";
    const context = { chapterNumber: 1, protagonist: "主角" };
    const result = generator.injectContradictions(text, context);
    expect(typeof result).toBe("string");
  });

  it("generateInnerContradiction 返回字符串", () => {
    const result = generator.generateInnerContradiction();
    expect(typeof result).toBe("string");
  });

  it("updateProfile 更新画像", () => {
    const newProfile = createDefaultHumanityProfile();
    expect(() => generator.updateProfile(newProfile)).not.toThrow();
  });
});

describe("templates", () => {
  it("BREATHING_TEMPLATES 包含所有呼吸类型", () => {
    expect(BREATHING_TEMPLATES["physical-action"]).toBeDefined();
    expect(BREATHING_TEMPLATES["environment-sense"]).toBeDefined();
    expect(BREATHING_TEMPLATES["unnecessary-dialogue"]).toBeDefined();
    expect(BREATHING_TEMPLATES["internal-wander"]).toBeDefined();
    expect(BREATHING_TEMPLATES["sensory-detail"]).toBeDefined();
    expect(BREATHING_TEMPLATES["prop-interaction"]).toBeDefined();
  });

  it("SILENCE_REPLACEMENTS 包含替换规则", () => {
    expect(SILENCE_REPLACEMENTS.length).toBeGreaterThan(0);
    expect(SILENCE_REPLACEMENTS[0]!.pattern).toBeInstanceOf(RegExp);
    expect(SILENCE_REPLACEMENTS[0]!.replacements.length).toBeGreaterThan(0);
  });

  it("getRandomTemplate 从非空数组返回字符串", () => {
    const templates = ["模板一", "模板二"];
    const result = getRandomTemplate(templates);
    expect(templates).toContain(result);
  });

  it("getRandomBreathingText 返回字符串", () => {
    const result = getRandomBreathingText("physical-action");
    expect(typeof result).toBe("string");
  });

  it("getRandomSilenceReplacement 对匹配文本返回替换结果", () => {
    const result = getRandomSilenceReplacement("他很紧张");
    expect(result.replaced).toBe(true);
    expect(typeof result.text).toBe("string");
  });
});

describe("profile-initializer", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inkos-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("loadOrCreateHumanityProfile 文件不存在时返回默认画像", async () => {
    const profilePath = join(tempDir, "nonexistent.json");
    const profile = await loadOrCreateHumanityProfile(profilePath);
    expect(profile).toBeDefined();
    expect(profile.fingerprint).toBeDefined();
    expect(profile.styleInjection).toBeDefined();
  });

  it("loadOrCreateHumanityProfile 文件存在时加载画像", async () => {
    const profilePath = join(tempDir, "profile.json");
    const defaultProfile = createDefaultHumanityProfile();
    await writeFile(profilePath, JSON.stringify(defaultProfile), "utf-8");
    const loaded = await loadOrCreateHumanityProfile(profilePath);
    expect(loaded).toBeDefined();
    expect(loaded.fingerprint).toBeDefined();
  });
});
