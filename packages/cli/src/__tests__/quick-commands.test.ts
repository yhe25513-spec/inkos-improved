import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";

// Mock the utils
vi.mock("../utils.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    llm: {
      provider: "openai",
      model: "gpt-4",
      apiKey: "test-key",
    },
  }),
  buildPipelineConfig: vi.fn().mockReturnValue({
    projectRoot: "/test",
    bookId: "test-book",
  }),
  findProjectRoot: vi.fn().mockReturnValue("/test"),
  resolveBookId: vi.fn().mockResolvedValue("test-book"),
  log: vi.fn(),
  logError: vi.fn(),
}));

// Mock the core module
vi.mock("@actalk/inkos-core", () => ({
  PipelineRunner: vi.fn().mockImplementation(() => ({
    getBookStatus: vi.fn().mockResolvedValue({
      chapterCount: 10,
      totalWordCount: 30000,
      activeHooks: 5,
      characterCount: 8,
    }),
    writeNextChapter: vi.fn().mockResolvedValue({
      chapterNumber: 11,
      title: "第十一章",
      wordCount: 3000,
      auditResult: { passed: true, issues: [] },
      revised: false,
      status: "approved",
    }),
    planChapter: vi.fn().mockResolvedValue({
      chapterNumber: 11,
      intent: { goal: "测试目标" },
    }),
  })),
  StateManager: vi.fn().mockImplementation(() => ({
    readTruthFile: vi.fn().mockResolvedValue("| 章节 | 状态 |\n|------|------|\n| 1 | 完成 |"),
  })),
  parsePendingHooksMarkdown: vi.fn().mockReturnValue([
    { hookId: "H001", status: "active", startChapter: 1 },
  ]),
}));

describe("Quick Commands Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("quick command", () => {
    it("has correct command structure", async () => {
      const { quickCommand } = await import("../commands/quick.js");

      expect(quickCommand.name()).toBe("quick");
      expect(quickCommand.description()).toContain("快捷指令");
    });

    it("has list option", async () => {
      const { quickCommand } = await import("../commands/quick.js");

      const options = quickCommand.options;
      const listOption = options.find(opt => opt.long === "--list");
      expect(listOption).toBeDefined();
    });
  });

  describe("hooks command", () => {
    it("has correct command structure", async () => {
      const { hooksCommand } = await import("../commands/hooks.js");

      expect(hooksCommand.name()).toBe("hooks");
      expect(hooksCommand.description()).toContain("伏笔管理");
    });

    it("has status subcommand", async () => {
      const { hooksCommand } = await import("../commands/hooks.js");

      const statusCmd = hooksCommand.commands.find(cmd => cmd.name() === "status");
      expect(statusCmd).toBeDefined();
    });

    it("has pressure subcommand", async () => {
      const { hooksCommand } = await import("../commands/hooks.js");

      const pressureCmd = hooksCommand.commands.find(cmd => cmd.name() === "pressure");
      expect(pressureCmd).toBeDefined();
    });

    it("has list subcommand", async () => {
      const { hooksCommand } = await import("../commands/hooks.js");

      const listCmd = hooksCommand.commands.find(cmd => cmd.name() === "list");
      expect(listCmd).toBeDefined();
    });

    it("has resolve subcommand", async () => {
      const { hooksCommand } = await import("../commands/hooks.js");

      const resolveCmd = hooksCommand.commands.find(cmd => cmd.name() === "resolve");
      expect(resolveCmd).toBeDefined();
    });
  });

  describe("health command", () => {
    it("has correct command structure", async () => {
      const { healthCommand } = await import("../commands/health.js");

      expect(healthCommand.name()).toBe("health");
      expect(healthCommand.description()).toContain("健康检查");
    });

    it("has check subcommand", async () => {
      const { healthCommand } = await import("../commands/health.js");

      const checkCmd = healthCommand.commands.find(cmd => cmd.name() === "check");
      expect(checkCmd).toBeDefined();
    });
  });

  describe("detect command", () => {
    it("has correct command structure", async () => {
      const { detectCommand } = await import("../commands/detect.js");

      expect(detectCommand.name()).toBe("detect");
      expect(detectCommand.description()).toContain("AIGC detection");
    });

    it("has local option", async () => {
      const { detectCommand } = await import("../commands/detect.js");

      const options = detectCommand.options;
      const localOption = options.find(opt => opt.long === "--local");
      expect(localOption).toBeDefined();
    });

    it("has voice option", async () => {
      const { detectCommand } = await import("../commands/detect.js");

      const options = detectCommand.options;
      const voiceOption = options.find(opt => opt.long === "--voice");
      expect(voiceOption).toBeDefined();
    });

    it("has fix option", async () => {
      const { detectCommand } = await import("../commands/detect.js");

      const options = detectCommand.options;
      const fixOption = options.find(opt => opt.long === "--fix");
      expect(fixOption).toBeDefined();
    });
  });
});
