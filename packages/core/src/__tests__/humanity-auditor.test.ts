import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HumanityAuditor } from "../agents/humanity-auditor.js";
import {
  HUMANITY_DIMENSIONS,
  type HumanityDimensionLayer,
} from "../agents/humanity-dimensions.js";

// Mock chatCompletion so we can control LLM output
vi.mock("../llm/provider.js", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    chatCompletion: vi.fn(),
  };
});

// Mock rules-reader to avoid file system dependencies
vi.mock("../agents/rules-reader.js", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    readBookLanguage: vi.fn(),
    readGenreProfile: vi.fn(),
  };
});

import { chatCompletion } from "../llm/provider.js";
import { readBookLanguage, readGenreProfile } from "../agents/rules-reader.js";

const ZERO_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
} as const;

function createMockClient() {
  return {
    provider: "openai" as const,
    apiFormat: "chat" as const,
    stream: false,
    defaults: {
      temperature: 0.7,
      maxTokens: 4096,
      thinkingBudget: 0,
      extra: {},
    },
  };
}

function createAuditor(): HumanityAuditor {
  return new HumanityAuditor({
    client: createMockClient(),
    model: "test-model",
    projectRoot: "/tmp/inkos-humanity-auditor-test",
  });
}

function setupRulesMocks(language: "zh" | "en" = "zh"): void {
  vi.mocked(readBookLanguage).mockResolvedValue(language);
  vi.mocked(readGenreProfile).mockResolvedValue({
    profile: {
      name: "其他",
      id: "other",
      language,
      chapterTypes: [],
      fatigueWords: [],
      numericalSystem: false,
      powerScaling: false,
      eraResearch: false,
      pacingRule: "",
      satisfactionTypes: [],
      auditDimensions: [],
      enableHumanityAudit: true,
    },
    body: "",
  });
}

// ── 1. 维度定义完整性 ──
describe("HUMANITY_DIMENSIONS 维度定义完整性", () => {
  it("共有 27 个维度", () => {
    expect(HUMANITY_DIMENSIONS.length).toBe(27);
  });

  it("每个维度有 id/name/layer/baseNote 四个字段", () => {
    for (const dim of HUMANITY_DIMENSIONS) {
      expect(dim).toHaveProperty("id");
      expect(typeof dim.id).toBe("number");
      expect(dim).toHaveProperty("name");
      expect(typeof dim.name.zh).toBe("string");
      expect(typeof dim.name.en).toBe("string");
      expect(dim).toHaveProperty("layer");
      expect(typeof dim.layer).toBe("string");
      expect(dim).toHaveProperty("baseNote");
      expect(typeof dim.baseNote).toBe("string");
    }
  });

  it("ID 范围 38-64，无重复", () => {
    const ids = HUMANITY_DIMENSIONS.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(38);
      expect(id).toBeLessThanOrEqual(64);
    }
  });

  it("5 个层级各有正确的维度数量", () => {
    const layers: HumanityDimensionLayer[] = [
      "language",
      "immersion",
      "structure",
      "emotion",
      "narrative",
    ];
    const counts = layers.map(
      (layer) => HUMANITY_DIMENSIONS.filter((d) => d.layer === layer).length,
    );
    // language: 5, immersion: 5, structure: 5, emotion: 6, narrative: 6
    expect(counts).toEqual([5, 5, 5, 6, 6]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(27);
  });
});

// ── 2. HumanityAuditor JSON 解析 ──
describe("HumanityAuditor JSON 解析", () => {
  beforeEach(() => {
    setupRulesMocks("zh");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Mock LLM 返回合法 JSON 时，issues 正确解析", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: JSON.stringify({
        passed: false,
        overall_score: 65,
        summary: "存在真人感缺口",
        issues: [
          {
            severity: "critical",
            category: "温度切换",
            description: "紧张场景后缺少不合时宜的情绪反应",
            suggestion: "在紧张结束后加一句'他忽然想笑'",
            repair_scope: "humanity-enhance",
          },
        ],
      }),
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    const result = await auditor.auditHumanity(
      "/tmp/book",
      "章节内容",
      1,
      "other",
    );

    expect(result.passed).toBe(false);
    expect(result.overallScore).toBe(65);
    expect(result.summary).toContain("真人感缺口");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      severity: "critical",
      category: "温度切换",
      description: "紧张场景后缺少不合时宜的情绪反应",
      suggestion: "在紧张结束后加一句'他忽然想笑'",
      repairScope: "humanity-enhance",
    });
    expect(result.parseFailed).toBeUndefined();
  });

  it("Mock LLM 返回非 JSON 时，parseFailed=true", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "模型只返回了一段散文，没有任何 JSON 结构。",
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    const result = await auditor.auditHumanity(
      "/tmp/book",
      "章节内容",
      1,
      "other",
    );

    expect(result.parseFailed).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("critical");
  });

  it("Mock LLM 返回空输出时，parseFailed=true", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "",
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    const result = await auditor.auditHumanity(
      "/tmp/book",
      "章节内容",
      1,
      "other",
    );

    expect(result.parseFailed).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("Mock LLM 返回 ```json 代码块包裹的 JSON 时，正确解析", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content:
        "```json\n" +
        JSON.stringify({
          passed: true,
          overall_score: 88,
          summary: "真人感良好",
          issues: [],
        }) +
        "\n```",
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    const result = await auditor.auditHumanity(
      "/tmp/book",
      "章节内容",
      1,
      "other",
    );

    expect(result.passed).toBe(true);
    expect(result.overallScore).toBe(88);
    expect(result.summary).toContain("真人感良好");
    expect(result.issues).toHaveLength(0);
    expect(result.parseFailed).toBeUndefined();
  });
});

// ── 3. 提示词构建 ──
describe("HumanityAuditor 提示词构建", () => {
  beforeEach(() => {
    setupRulesMocks("zh");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("系统提示词包含全部 27 个维度名称", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [], summary: "ok" }),
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    await auditor.auditHumanity("/tmp/book", "章节内容", 1, "other");

    const calls = vi.mocked(chatCompletion).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messages = calls[0]![2] as ReadonlyArray<{
      role: string;
      content: string;
    }>;
    const systemPrompt =
      messages.find((m) => m.role === "system")?.content ?? "";

    // 系统提示词应包含全部 27 个维度的中文名称
    for (const dim of HUMANITY_DIMENSIONS) {
      expect(systemPrompt).toContain(dim.name.zh);
    }
  });

  it("提示词支持中文", async () => {
    vi.mocked(chatCompletion).mockResolvedValue({
      content: JSON.stringify({ passed: true, issues: [], summary: "ok" }),
      usage: ZERO_USAGE,
    });

    const auditor = createAuditor();
    await auditor.auditHumanity("/tmp/book", "章节内容", 1, "other");

    const calls = vi.mocked(chatCompletion).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messages = calls[0]![2] as ReadonlyArray<{
      role: string;
      content: string;
    }>;
    const systemPrompt =
      messages.find((m) => m.role === "system")?.content ?? "";
    const userPrompt =
      messages.find((m) => m.role === "user")?.content ?? "";

    // 系统提示词包含中文
    expect(systemPrompt).toContain("真人感");
    expect(systemPrompt).toContain("审计维度");
    expect(systemPrompt).toContain("语言表层");

    // 用户提示词包含中文
    expect(userPrompt).toContain("请对第");
    expect(userPrompt).toContain("章节正文");
  });
});
