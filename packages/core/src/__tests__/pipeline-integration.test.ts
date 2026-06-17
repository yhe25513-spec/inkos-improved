import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the base agent
vi.mock("../agents/base.js", () => ({
  BaseAgent: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({ content: "test response" }),
    chatWithSearch: vi.fn().mockResolvedValue({ content: "test response" }),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  })),
}));

// Mock the state manager
vi.mock("../state/manager.js", () => ({
  StateManager: vi.fn().mockImplementation(() => ({
    bookDir: vi.fn().mockReturnValue("/test/books/test-book"),
    loadBookConfig: vi.fn().mockResolvedValue({
      id: "test-book",
      title: "测试书籍",
      genre: "xianxia",
      language: "zh",
    }),
    loadChapterIndex: vi.fn().mockResolvedValue([
      { number: 1, title: "第一章", wordCount: 3000 },
      { number: 2, title: "第二章", wordCount: 2500 },
    ]),
    getNextChapterNumber: vi.fn().mockResolvedValue(3),
    readTruthFile: vi.fn().mockResolvedValue("test content"),
    snapshotState: vi.fn().mockResolvedValue(undefined),
    acquireBookLock: vi.fn().mockResolvedValue(() => {}),
    ensureControlDocuments: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the agents
vi.mock("../agents/planner.js", () => ({
  PlannerAgent: vi.fn().mockImplementation(() => ({
    planChapter: vi.fn().mockResolvedValue({
      chapterNumber: 3,
      intent: { goal: "测试目标" },
      memo: { goal: "测试目标", body: "测试内容" },
    }),
  })),
}));

vi.mock("../agents/composer.js", () => ({
  ComposerAgent: vi.fn().mockImplementation(() => ({
    composeChapter: vi.fn().mockResolvedValue({
      contextPackage: {},
      ruleStack: {},
    }),
  })),
}));

vi.mock("../agents/writer.js", () => ({
  WriterAgent: vi.fn().mockImplementation(() => ({
    writeChapter: vi.fn().mockResolvedValue({
      chapterNumber: 3,
      title: "第三章",
      content: "测试内容",
      wordCount: 1000,
      updatedState: "",
      updatedLedger: "",
      updatedHooks: "",
    }),
  })),
}));

vi.mock("../agents/continuity.js", () => ({
  ContinuityAuditor: vi.fn().mockImplementation(() => ({
    auditChapter: vi.fn().mockResolvedValue({
      passed: true,
      issues: [],
      score: 95,
    }),
  })),
}));

describe("Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PipelineRunner structure", () => {
    it("can be imported", async () => {
      const { PipelineRunner } = await import("../pipeline/runner.js");
      expect(PipelineRunner).toBeDefined();
    });

    it("can be instantiated", async () => {
      const { PipelineRunner } = await import("../pipeline/runner.js");
      const pipeline = new PipelineRunner({
        projectRoot: "/test",
        bookId: "test-book",
        llm: {
          provider: "openai",
          model: "gpt-4",
          apiKey: "test-key",
        },
      });

      expect(pipeline).toBeDefined();
    });
  });

  describe("Agent modules", () => {
    it("can import ai-patterns", async () => {
      const module = await import("../utils/ai-patterns.js");
      expect(module.WORD_REPLACEMENTS).toBeDefined();
      expect(module.AI_PATTERNS).toBeDefined();
    });

    it("can import voice-profiles", async () => {
      const module = await import("../utils/voice-profiles.js");
      expect(module.VOICE_PRESETS).toBeDefined();
      expect(module.detectVoiceStyle).toBeDefined();
    });

    it("can import hook-pressure", async () => {
      const module = await import("../utils/hook-pressure.js");
      expect(module.analyzeHookPressure).toBeDefined();
      expect(module.analyzeAllHooksPressure).toBeDefined();
    });

    it("can import quality-evaluator", async () => {
      const module = await import("../utils/quality-evaluator.js");
      expect(module.evaluateNovelQuality).toBeDefined();
      expect(module.evaluateCoherence).toBeDefined();
    });

    it("can import novel-quality", async () => {
      const module = await import("../utils/novel-quality.js");
      expect(module.generateQualityReport).toBeDefined();
      expect(module.calculateReadability).toBeDefined();
    });

    it("can import health-report", async () => {
      const module = await import("../utils/health-report.js");
      expect(module.generateHealthReportMarkdown).toBeDefined();
      expect(module.generateHealthSummary).toBeDefined();
    });
  });

  describe("Entity system", () => {
    it("can import entity types", async () => {
      const module = await import("../models/entity.js");
      expect(module.RELATIONSHIP_TYPES).toBeDefined();
      expect(module.ENTITY_TYPE_COLORS).toBeDefined();
    });

    it("can import entity-db", async () => {
      const module = await import("../state/entity-db.js");
      expect(module.EntityDB).toBeDefined();
    });
  });

  describe("Module system", () => {
    it("can import module-registry", async () => {
      const module = await import("../modules/module-registry.js");
      expect(module.ModuleRegistry).toBeDefined();
    });

    it("can import context-builder", async () => {
      const module = await import("../utils/context-builder.js");
      expect(module.ContextBuilder).toBeDefined();
      expect(module.AGENT_MODULE_REQUIREMENTS).toBeDefined();
    });
  });
});
