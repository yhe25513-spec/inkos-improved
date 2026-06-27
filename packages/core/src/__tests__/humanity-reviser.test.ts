import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReviserAgent } from "../agents/reviser.js";
import {
  buildHumanityEnhanceSystemPrompt,
  buildHumanityEnhanceUserPrompt,
} from "../agents/humanity-reviser-prompts.js";
import type { AuditIssue } from "../agents/continuity.js";

const ZERO_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
} as const;

function makeAgent(projectRoot: string): ReviserAgent {
  return new ReviserAgent({
    client: {
      provider: "openai",
      apiFormat: "chat",
      stream: false,
      defaults: {
        temperature: 0.7,
        maxTokens: 4096,
        thinkingBudget: 0,
        extra: {},
      },
    },
    model: "test-model",
    projectRoot,
  });
}

async function makeBookDir(): Promise<{ root: string; bookDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "inkos-humanity-reviser-test-"));
  const bookDir = join(root, "book");
  await mkdir(join(bookDir, "story"), { recursive: true });
  return { root, bookDir };
}

const HUMANITY_ISSUE: AuditIssue = {
  severity: "warning",
  category: "句子突发性",
  description: "句长过于均匀，缺乏节奏突变",
  suggestion: "在长句段落中插入短句",
  repairScope: "humanity-enhance",
};

const STRUCTURAL_ISSUE: AuditIssue = {
  severity: "critical",
  category: "Outline Drift Check",
  description: "整章结构偏离大纲",
  suggestion: "重写全章",
  repairScope: "structural",
};

const LOCAL_ISSUE: AuditIssue = {
  severity: "warning",
  category: "套话密度",
  description: "'不禁' 密度过高",
  suggestion: "替换成具体动作",
  repairScope: "local",
};

describe("humanity-reviser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── resolveAutoOutputMode 的 humanity-enhance 路由 ──
  describe("resolveAutoOutputMode humanity-enhance routing", () => {
    it("routes to humanity-enhance when all non-info issues have repairScope=humanity-enhance", async () => {
      const { root, bookDir } = await makeBookDir();
      try {
        const agent = makeAgent(root);
        const chatSpy = vi.spyOn(ReviserAgent.prototype as never, "chat" as never).mockResolvedValue({
          content: [
            "=== FIXED_ISSUES ===",
            "- 增强了真人感",
            "",
            "=== REVISED_CONTENT ===",
            "修订后的正文。",
            "",
            "=== UPDATED_STATE ===",
            "状态卡",
            "",
            "=== UPDATED_HOOKS ===",
            "伏笔池",
          ].join("\n"),
          usage: ZERO_USAGE,
        });

        const issues: AuditIssue[] = [
          HUMANITY_ISSUE,
          {
            severity: "info",
            category: "词汇多样性",
            description: "装饰词略有重复",
            suggestion: "替换部分修饰词",
          },
        ];

        await agent.reviseChapter(bookDir, "原始正文。", 1, issues, "auto", "xuanhuan");

        const messages = chatSpy.mock.calls[0]?.[0] as
          | ReadonlyArray<{ content: string }>
          | undefined;
        const systemPrompt = messages?.[0]?.content ?? "";

        // humanity-enhance 系统提示词包含"真人感"关键词
        expect(systemPrompt).toContain("真人感");
        // 不应包含普通 auto 模式的分流指令
        expect(systemPrompt).not.toContain("分流指令");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("does not route to humanity-enhance when issues mix humanity-enhance with other scopes", async () => {
      const { root, bookDir } = await makeBookDir();
      try {
        const agent = makeAgent(root);
        const chatSpy = vi.spyOn(ReviserAgent.prototype as never, "chat" as never).mockResolvedValue({
          content: [
            "=== FIXED_ISSUES ===",
            "- 修复了结构问题",
            "",
            "=== REVISED_CONTENT ===",
            "修订后的正文。",
            "",
            "=== UPDATED_STATE ===",
            "状态卡",
            "",
            "=== UPDATED_HOOKS ===",
            "伏笔池",
          ].join("\n"),
          usage: ZERO_USAGE,
        });

        const issues: AuditIssue[] = [HUMANITY_ISSUE, STRUCTURAL_ISSUE];

        await agent.reviseChapter(bookDir, "原始正文。", 1, issues, "auto", "xuanhuan");

        const messages = chatSpy.mock.calls[0]?.[0] as
          | ReadonlyArray<{ content: string }>
          | undefined;
        const systemPrompt = messages?.[0]?.content ?? "";

        // 不应走 humanity-enhance（不含"真人感增强"标识）
        expect(systemPrompt).not.toContain("专精于");
        // 应走 structural 路由（rewrite-only）
        expect(systemPrompt).toContain("分流指令");
        expect(systemPrompt).toContain("必须输出 REVISED_CONTENT");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("uses original routing when no humanity-enhance issues are present", async () => {
      const { root, bookDir } = await makeBookDir();
      try {
        const agent = makeAgent(root);
        const chatSpy = vi.spyOn(ReviserAgent.prototype as never, "chat" as never).mockResolvedValue({
          content: [
            "=== FIXED_ISSUES ===",
            "- 修复了局部问题",
            "",
            "=== PATCHES ===",
            "--- PATCH 1 ---",
            "TARGET_TEXT:",
            "原始正文。",
            "REPLACEMENT_TEXT:",
            "修订后的正文。",
            "--- END PATCH ---",
            "",
            "=== UPDATED_STATE ===",
            "状态卡",
            "",
            "=== UPDATED_HOOKS ===",
            "伏笔池",
          ].join("\n"),
          usage: ZERO_USAGE,
        });

        const issues: AuditIssue[] = [LOCAL_ISSUE];

        await agent.reviseChapter(bookDir, "原始正文。", 1, issues, "auto", "xuanhuan");

        const messages = chatSpy.mock.calls[0]?.[0] as
          | ReadonlyArray<{ content: string }>
          | undefined;
        const systemPrompt = messages?.[0]?.content ?? "";

        // 不应走 humanity-enhance
        expect(systemPrompt).not.toContain("专精于");
        // 应走 patch-only 路由
        expect(systemPrompt).toContain("分流指令");
        expect(systemPrompt).toContain("必须只输出 PATCHES");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  // ── 真人感修复提示词构建 ──
  describe("buildHumanityEnhanceSystemPrompt", () => {
    it("returns a prompt containing '真人感' keyword for Chinese", () => {
      const prompt = buildHumanityEnhanceSystemPrompt("zh");
      expect(prompt).toContain("真人感");
    });

    it("returns a prompt containing 'human feel' keyword for English", () => {
      const prompt = buildHumanityEnhanceSystemPrompt("en");
      expect(prompt).toContain("human feel");
    });

    it("includes '不改变剧情走向' constraint in the prompt", () => {
      const prompt = buildHumanityEnhanceSystemPrompt("zh");
      // 系统提示词包含"不得改变剧情走向"约束
      expect(prompt).toContain("改变剧情走向");
    });
  });

  describe("buildHumanityEnhanceUserPrompt", () => {
    it("includes dimension name and repair strategy in the prompt", () => {
      const issues = [
        {
          category: "句子突发性",
          description: "句长过于均匀，缺乏节奏突变",
          suggestion: "在长句段落中插入短句",
        },
      ];
      const prompt = buildHumanityEnhanceUserPrompt("章节正文。", 5, issues, "zh");

      // 包含维度名称
      expect(prompt).toContain("句子突发性");
      // 包含修复策略标签
      expect(prompt).toContain("修复策略");
      // 维度38（句子突发性）的修复策略包含"短句"关键词
      expect(prompt).toContain("短句");
      // 包含章节号
      expect(prompt).toContain("第5章");
    });

    it("includes '不改变剧情走向' constraint when humanity-enhance issues are passed", () => {
      // 传入 humanity-enhance issues 时，系统提示词包含"不改变剧情走向"约束
      const systemPrompt = buildHumanityEnhanceSystemPrompt("zh");
      expect(systemPrompt).toContain("改变剧情走向");
    });
  });

  // ── 输出解析 ──
  describe("output parsing", () => {
    it("correctly parses REVISED_CONTENT when LLM returns it", async () => {
      const { root, bookDir } = await makeBookDir();
      try {
        const agent = makeAgent(root);
        vi.spyOn(ReviserAgent.prototype as never, "chat" as never).mockResolvedValue({
          content: [
            "=== FIXED_ISSUES ===",
            "- 增强了句子突发性",
            "",
            "=== REVISED_CONTENT ===",
            "这是真人感增强后的正文。",
            "",
            "=== UPDATED_STATE ===",
            "状态卡",
            "",
            "=== UPDATED_HOOKS ===",
            "伏笔池",
          ].join("\n"),
          usage: ZERO_USAGE,
        });

        const issues: AuditIssue[] = [HUMANITY_ISSUE];

        const result = await agent.reviseChapter(bookDir, "原始正文。", 1, issues, "auto", "xuanhuan");

        expect(result.revisedContent).toBe("这是真人感增强后的正文。");
        expect(result.fixedIssues).toEqual(["- 增强了句子突发性"]);
        expect(result.criticalFailure).toBeFalsy();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("returns criticalFailure when LLM returns empty output", async () => {
      const { root, bookDir } = await makeBookDir();
      try {
        const agent = makeAgent(root);
        vi.spyOn(ReviserAgent.prototype as never, "chat" as never).mockResolvedValue({
          content: [
            "=== FIXED_ISSUES ===",
            "- 无法生成修订",
            "",
            "=== UPDATED_STATE ===",
            "状态卡",
            "",
            "=== UPDATED_HOOKS ===",
            "伏笔池",
          ].join("\n"),
          usage: ZERO_USAGE,
        });

        const originalContent = "原始正文。";
        const issues: AuditIssue[] = [HUMANITY_ISSUE];

        const result = await agent.reviseChapter(bookDir, originalContent, 1, issues, "auto", "xuanhuan");

        // REVISED_CONTENT 为空 → criticalFailure 应为 true
        expect(result.criticalFailure).toBe(true);
        // 返回原始正文
        expect(result.revisedContent).toBe(originalContent);
        // fixedIssues 应为空（applied=false）
        expect(result.fixedIssues).toEqual([]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
