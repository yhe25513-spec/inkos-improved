# Character Dialogue Agent 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 InkOS 新增人物对话 Agent 系统，让每个角色有独立的"灵魂"，通过预写排练和后审验证确保对话质量。

**Architecture:** 新增 4 个 Agent 文件 + 1 个工具文件，修改 runner.ts 和 chapter-review-cycle.ts 集成到 Pipeline。遵循现有 BaseAgent 模式。

**Tech Stack:** TypeScript, InkOS Core (BaseAgent, AgentContext, LLMClient)

---

## 文件结构

```
新增文件:
  packages/core/src/agents/character-voice-extractor.ts  — 声音提取
  packages/core/src/agents/dialogue-rehearsal.ts         — 预写排练
  packages/core/src/agents/dialogue-auditor.ts           — 后审验证
  packages/core/src/utils/character-voices.ts            — 声音档案管理

修改文件:
  packages/core/src/pipeline/runner.ts                   — 集成新Agent
  packages/core/src/pipeline/chapter-review-cycle.ts     — 纳入对话审计评分
```

---

## Task 1: 角色声音档案管理工具

**Files:**
- Create: `packages/core/src/utils/character-voices.ts`
- Test: `packages/core/src/utils/character-voices.test.ts`

- [ ] **Step 1: 定义数据类型**

```typescript
// packages/core/src/utils/character-voices.ts

export interface CharacterVoice {
  readonly name: string;
  readonly speechStyle: string;
  readonly forbiddenTone: ReadonlyArray<string>;
  readonly vocabulary: ReadonlyArray<string>;
  readonly personality: ReadonlyArray<string>;
  readonly emotionalExpression: string;
  readonly sampleDialogues: ReadonlyArray<string>;
  readonly infoBoundary: ReadonlyArray<string>;
}

export interface CharacterVoicesFile {
  readonly version: string;
  readonly characters: Record<string, CharacterVoice>;
}
```

- [ ] **Step 2: 实现读取功能**

```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadCharacterVoices(bookDir: string): Promise<CharacterVoicesFile> {
  const voicesPath = join(bookDir, "story", "character_voices.json");
  try {
    const raw = await readFile(voicesPath, "utf-8");
    return JSON.parse(raw) as CharacterVoicesFile;
  } catch {
    return { version: "1.0", characters: {} };
  }
}

export async function saveCharacterVoices(bookDir: string, voices: CharacterVoicesFile): Promise<void> {
  const voicesDir = join(bookDir, "story");
  await mkdir(voicesDir, { recursive: true });
  const voicesPath = join(voicesDir, "character_voices.json");
  await writeFile(voicesPath, JSON.stringify(voices, null, 2), "utf-8");
}

export function getCharacterVoice(voices: CharacterVoicesFile, name: string): CharacterVoice | undefined {
  return voices.characters[name];
}
```

- [ ] **Step 3: 编写测试**

```typescript
// packages/core/src/utils/character-voices.test.ts
import { describe, it, expect } from "vitest";
import { loadCharacterVoices, saveCharacterVoices, getCharacterVoice } from "./character-voices.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("character-voices", () => {
  const testDir = join(tmpdir(), "test-voices-" + Date.now());

  it("should return empty voices when file does not exist", async () => {
    const voices = await loadCharacterVoices(join(testDir, "nonexistent"));
    expect(voices.version).toBe("1.0");
    expect(Object.keys(voices.characters)).toHaveLength(0);
  });

  it("should save and load voices", async () => {
    const testBookDir = join(testDir, "book1");
    await mkdir(join(testBookDir, "story"), { recursive: true });

    const voices: CharacterVoicesFile = {
      version: "1.0",
      characters: {
        "孙悟空": {
          name: "孙悟空",
          speechStyle: "惜字如金",
          forbiddenTone: ["感叹号"],
          vocabulary: ["就这", "嗯"],
          personality: ["散漫"],
          emotionalExpression: "用动作表达",
          sampleDialogues: ["就这？"],
          infoBoundary: ["不知道主神"],
        },
      },
    };

    await saveCharacterVoices(testBookDir, voices);
    const loaded = await loadCharacterVoices(testBookDir);
    expect(loaded.characters["孙悟空"]).toBeDefined();
    expect(loaded.characters["孙悟空"].speechStyle).toBe("惜字如金");
  });

  it("should get character voice by name", async () => {
    const voices: CharacterVoicesFile = {
      version: "1.0",
      characters: {
        "孙悟空": { name: "孙悟空", speechStyle: "惜字如金", forbiddenTone: [], vocabulary: [], personality: [], emotionalExpression: "", sampleDialogues: [], infoBoundary: [] },
      },
    };
    expect(getCharacterVoice(voices, "孙悟空")).toBeDefined();
    expect(getCharacterVoice(voices, "不存在")).toBeUndefined();
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd packages/core && npx vitest run src/utils/character-voices.test.ts
```
Expected: 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/character-voices.ts packages/core/src/utils/character-voices.test.ts
git commit -m "feat: add character voices management utility"
```

---

## Task 2: 角色声音提取器

**Files:**
- Create: `packages/core/src/agents/character-voice-extractor.ts`
- Test: `packages/core/src/agents/character-voice-extractor.test.ts`

- [ ] **Step 1: 定义接口**

```typescript
// packages/core/src/agents/character-voice-extractor.ts
import { BaseAgent } from "./base.js";
import type { CharacterVoice, CharacterVoicesFile } from "../utils/character-voices.js";

export interface ExtractVoiceInput {
  readonly roleName: string;
  readonly roleContent: string;  // markdown content of role card
}

export interface ExtractVoiceOutput {
  readonly voice: CharacterVoice;
}
```

- [ ] **Step 2: 实现提取器**

```typescript
import { loadCharacterVoices, saveCharacterVoices, type CharacterVoicesFile } from "../utils/character-voices.js";
import { readRoleCards } from "../utils/outline-paths.js";
import { join } from "node:path";

export class CharacterVoiceExtractor extends BaseAgent {
  get name(): string { return "character-voice-extractor"; }

  async extractAllVoices(bookDir: string): Promise<CharacterVoicesFile> {
    this.log?.info("Extracting character voices from role cards...");

    const roleCards = await readRoleCards(bookDir);
    const existing = await loadCharacterVoices(bookDir);
    const voices: CharacterVoicesFile = {
      version: existing.version,
      characters: { ...existing.characters },
    };

    for (const card of roleCards) {
      if (!voices.characters[card.name]) {
        const voice = await this.extractVoice({
          roleName: card.name,
          roleContent: card.content,
        });
        voices.characters[card.name] = voice.voice;
        this.log?.info(`Extracted voice for: ${card.name}`);
      }
    }

    await saveCharacterVoices(bookDir, voices);
    return voices;
  }

  async extractVoice(input: ExtractVoiceInput): Promise<ExtractVoiceOutput> {
    const systemPrompt = `你是一个角色声音分析专家。根据角色设定文件，提取该角色的说话风格。

输出JSON格式：
{
  "name": "角色名",
  "speechStyle": "一句话描述说话风格",
  "forbiddenTone": ["禁止的语气1", "禁止的语气2"],
  "vocabulary": ["口头禅1", "口头禅2"],
  "personality": ["性格标签1", "性格标签2"],
  "emotionalExpression": "情绪表达方式描述",
  "sampleDialogues": ["符合人设的样本对话1", "样本对话2"],
  "infoBoundary": ["不知道的信息1", "不知道的信息2"]
}

要求：
1. speechStyle 必须简洁，一句话概括
2. forbiddenTone 列出绝对不能出现的语气
3. vocabulary 列出角色常用的口头禅
4. sampleDialogues 必须符合角色说话风格
5. infoBoundary 根据角色设定推断不知道的信息`;

    const result = await this.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: `角色名: ${input.roleName}\n\n角色设定:\n${input.roleContent}` },
    ], { temperature: 0.3 });

    try {
      const parsed = JSON.parse(result.content);
      return { voice: parsed as CharacterVoice };
    } catch {
      // 如果解析失败，返回默认声音
      return {
        voice: {
          name: input.roleName,
          speechStyle: "正常说话",
          forbiddenTone: [],
          vocabulary: [],
          personality: [],
          emotionalExpression: "正常表达",
          sampleDialogues: [],
          infoBoundary: [],
        },
      };
    }
  }
}
```

- [ ] **Step 3: 编写测试**

```typescript
// packages/core/src/agents/character-voice-extractor.test.ts
import { describe, it, expect, vi } from "vitest";
import { CharacterVoiceExtractor } from "./character-voice-extractor.js";

describe("CharacterVoiceExtractor", () => {
  it("should have correct name", () => {
    // 模拟 AgentContext
    const mockCtx = {
      client: {} as any,
      model: "test",
      projectRoot: "/tmp",
    };
    const extractor = new CharacterVoiceExtractor(mockCtx);
    expect(extractor.name).toBe("character-voice-extractor");
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd packages/core && npx vitest run src/agents/character-voice-extractor.test.ts
```
Expected: 1 test passed

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/character-voice-extractor.ts packages/core/src/agents/character-voice-extractor.test.ts
git commit -m "feat: add character voice extractor agent"
```

---

## Task 3: 预写排练引擎

**Files:**
- Create: `packages/core/src/agents/dialogue-rehearsal.ts`
- Test: `packages/core/src/agents/dialogue-rehearsal.test.ts`

- [ ] **Step 1: 定义接口**

```typescript
// packages/core/src/agents/dialogue-rehearsal.ts
import { BaseAgent } from "./base.js";
import type { CharacterVoice } from "../utils/character-voices.js";

export interface DialogueRound {
  readonly round: number;
  readonly speaker: string;
  readonly line: string;
  readonly emotion: string;
  readonly infoUsed: ReadonlyArray<string>;
}

export interface DialogueConflict {
  readonly type: string;
  readonly participants: ReadonlyArray<string>;
  readonly description: string;
}

export interface InfoGap {
  readonly character: string;
  readonly unknown: ReadonlyArray<string>;
}

export interface DialogueDraft {
  readonly chapterNumber: number;
  readonly participants: ReadonlyArray<string>;
  readonly rounds: ReadonlyArray<DialogueRound>;
  readonly conflicts: ReadonlyArray<DialogueConflict>;
  readonly infoGaps: ReadonlyArray<InfoGap>;
}

export interface RehearsalInput {
  readonly chapterNumber: number;
  readonly chapterMemo: string;
  readonly characters: Record<string, CharacterVoice>;
  readonly currentContext: string;
  readonly maxRounds?: number;
}
```

- [ ] **Step 2: 实现排练引擎**

```typescript
export class DialogueRehearsal extends BaseAgent {
  get name(): string { return "dialogue-rehearsal"; }

  async rehearse(input: RehearsalInput): Promise<DialogueDraft> {
    const maxRounds = input.maxRounds ?? 5;
    this.log?.info(`Starting dialogue rehearsal for chapter ${input.chapterNumber} (${Object.keys(input.characters).length} characters, max ${maxRounds} rounds)`);

    const characterDescriptions = Object.entries(input.characters)
      .map(([name, v]) => `- ${name}: ${v.speechStyle}。口头禅: ${v.vocabulary.join("、")}。禁止语气: ${v.forbiddenTone.join("、")}`)
      .join("\n");

    const systemPrompt = `你是一个小说对话排练师。你将模拟多个角色之间的对话，为写作提供参考。

## 角色信息
${characterDescriptions}

## 规则
1. 每个角色必须严格遵循自己的说话风格
2. 每个角色只能基于自己知道的信息说话（信息边界）
3. 对话必须有冲突或张力，不能平淡
4. 对话轮数控制在 ${maxRounds} 轮以内
5. 输出JSON格式

## 输出格式
{
  "rounds": [
    {
      "round": 1,
      "speaker": "角色名",
      "line": "对话内容",
      "emotion": "情绪状态",
      "infoUsed": ["使用的信息1"]
    }
  ],
  "conflicts": [
    {
      "type": "冲突类型",
      "participants": ["角色1", "角色2"],
      "description": "冲突描述"
    }
  ],
  "infoGaps": [
    {
      "character": "角色名",
      "unknown": ["不知道的信息"]
    }
  ]
}`;

    const result = await this.chat([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `章节任务: ${input.chapterMemo}\n\n当前情境: ${input.currentContext}\n\n请模拟 ${Object.keys(input.characters).join("、")} 之间的对话。`,
      },
    ], { temperature: 0.7 });

    try {
      const parsed = JSON.parse(result.content);
      return {
        chapterNumber: input.chapterNumber,
        participants: Object.keys(input.characters),
        rounds: parsed.rounds ?? [],
        conflicts: parsed.conflicts ?? [],
        infoGaps: parsed.infoGaps ?? [],
      };
    } catch {
      // 解析失败时返回空草稿
      return {
        chapterNumber: input.chapterNumber,
        participants: Object.keys(input.characters),
        rounds: [],
        conflicts: [],
        infoGaps: [],
      };
    }
  }
}
```

- [ ] **Step 3: 编写测试**

```typescript
// packages/core/src/agents/dialogue-rehearsal.test.ts
import { describe, it, expect } from "vitest";
import { DialogueRehearsal } from "./dialogue-rehearsal.js";

describe("DialogueRehearsal", () => {
  it("should have correct name", () => {
    const mockCtx = { client: {} as any, model: "test", projectRoot: "/tmp" };
    const rehearsal = new DialogueRehearsal(mockCtx);
    expect(rehearsal.name).toBe("dialogue-rehearsal");
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd packages/core && npx vitest run src/agents/dialogue-rehearsal.test.ts
```
Expected: 1 test passed

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/dialogue-rehearsal.ts packages/core/src/agents/dialogue-rehearsal.test.ts
git commit -m "feat: add dialogue rehearsal agent"
```

---

## Task 4: 对话审计引擎

**Files:**
- Create: `packages/core/src/agents/dialogue-auditor.ts`
- Test: `packages/core/src/agents/dialogue-auditor.test.ts`

- [ ] **Step 1: 定义接口**

```typescript
// packages/core/src/agents/dialogue-auditor.ts
import { BaseAgent } from "./base.js";
import type { CharacterVoice } from "../utils/character-voices.js";

export interface DialogueAuditIssue {
  readonly lineNumber: number;
  readonly speaker: string;
  readonly original: string;
  readonly score: number;
  readonly issues: ReadonlyArray<string>;
  readonly suggestion: string;
}

export interface DialogueAuditSummary {
  readonly humanConsistency: number;
  readonly infoBoundary: number;
  readonly emotionReasonability: number;
  readonly dialogueRhythm: number;
  readonly characterDistinctiveness: number;
}

export interface DialogueAuditResult {
  readonly chapterNumber: number;
  readonly totalScore: number;
  readonly passed: boolean;
  readonly dialogues: ReadonlyArray<DialogueAuditIssue>;
  readonly oocIssues: ReadonlyArray<DialogueAuditIssue>;
  readonly summary: DialogueAuditSummary;
}

export interface AuditDialogueInput {
  readonly chapterNumber: number;
  readonly chapterContent: string;
  readonly characters: Record<string, CharacterVoice>;
  readonly threshold?: number;
}
```

- [ ] **Step 2: 实现审计引擎**

```typescript
export class DialogueAuditor extends BaseAgent {
  get name(): string { return "dialogue-auditor"; }

  async auditDialogues(input: AuditDialogueInput): Promise<DialogueAuditResult> {
    const threshold = input.threshold ?? 7;
    this.log?.info(`Auditing dialogues for chapter ${input.chapterNumber} (threshold: ${threshold})`);

    const characterDescriptions = Object.entries(input.characters)
      .map(([name, v]) => `- ${name}: 说话风格="${v.speechStyle}", 口头禅="${v.vocabulary.join("、")}", 禁止语气="${v.forbiddenTone.join("、")}";`)
      .join("\n");

    const systemPrompt = `你是一个小说对话审计专家。你将审查章节中的对话是否符合角色人设。

## 角色信息
${characterDescriptions}

## 审计维度（每项1-10分）
1. 人设一致性：角色说话风格是否匹配
2. 信息边界：角色是否说了不该知道的信息
3. 情绪合理性：情绪表达是否符合当前处境
4. 对话节奏：是否有太多/太少对话
5. 角色辨识度：能否通过对话区分不同角色

## 输出JSON格式
{
  "dialogues": [
    {
      "lineNumber": 15,
      "speaker": "角色名",
      "original": "原文对话",
      "score": 8,
      "issues": ["问题描述"],
      "suggestion": "修改建议"
    }
  ],
  "oocIssues": [
    {
      "lineNumber": 20,
      "speaker": "角色名",
      "original": "原文对话",
      "score": 4,
      "issues": ["OOC问题"],
      "suggestion": "修改建议"
    }
  ],
  "summary": {
    "humanConsistency": 8,
    "infoBoundary": 9,
    "emotionReasonability": 7,
    "dialogueRhythm": 8,
    "characterDistinctiveness": 9
  }
}`;

    const result = await this.chat([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `章节内容:\n\n${input.chapterContent}\n\n请审计上述章节中的所有对话。`,
      },
    ], { temperature: 0.3 });

    try {
      const parsed = JSON.parse(result.content);
      const summary = parsed.summary;
      const totalScore = Math.round(
        (summary.humanConsistency + summary.infoBoundary + summary.emotionReasonability +
         summary.dialogueRhythm + summary.characterDistinctiveness) / 5
      );

      return {
        chapterNumber: input.chapterNumber,
        totalScore,
        passed: totalScore >= threshold,
        dialogues: parsed.dialogues ?? [],
        oocIssues: parsed.oocIssues ?? [],
        summary,
      };
    } catch {
      // 解析失败时返回默认结果
      return {
        chapterNumber: input.chapterNumber,
        totalScore: 5,
        passed: false,
        dialogues: [],
        oocIssues: [],
        summary: {
          humanConsistency: 5,
          infoBoundary: 5,
          emotionReasonability: 5,
          dialogueRhythm: 5,
          characterDistinctiveness: 5,
        },
      };
    }
  }
}
```

- [ ] **Step 3: 编写测试**

```typescript
// packages/core/src/agents/dialogue-auditor.test.ts
import { describe, it, expect } from "vitest";
import { DialogueAuditor } from "./dialogue-auditor.js";

describe("DialogueAuditor", () => {
  it("should have correct name", () => {
    const mockCtx = { client: {} as any, model: "test", projectRoot: "/tmp" };
    const auditor = new DialogueAuditor(mockCtx);
    expect(auditor.name).toBe("dialogue-auditor");
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd packages/core && npx vitest run src/agents/dialogue-auditor.test.ts
```
Expected: 1 test passed

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/dialogue-auditor.ts packages/core/src/agents/dialogue-auditor.test.ts
git commit -m "feat: add dialogue auditor agent"
```

---

## Task 5: 集成到 Pipeline

**Files:**
- Modify: `packages/core/src/pipeline/runner.ts`

- [ ] **Step 1: 添加导入**

在 runner.ts 顶部的 import 区域添加：

```typescript
import { CharacterVoiceExtractor } from "../agents/character-voice-extractor.js";
import { DialogueRehearsal, type DialogueDraft } from "../agents/dialogue-rehearsal.js";
import { DialogueAuditor, type DialogueAuditResult } from "../agents/dialogue-auditor.js";
import { loadCharacterVoices, type CharacterVoicesFile } from "../utils/character-voices.js";
```

- [ ] **Step 2: 在 _writeNextChapterLocked 中插入排练**

在 Phase 1 (PlannerAgent) 之后、Phase 2 (ComposerAgent) 之前插入：

```typescript
// Phase 1.5: Dialogue Rehearsal (optional, with fallback)
let dialogueDraft: DialogueDraft | undefined;
try {
  const voices = await loadCharacterVoices(bookDir);
  if (Object.keys(voices.characters).length > 0) {
    const rehearsal = new DialogueRehearsal(this.agentCtxFor("dialogue-rehearsal", bookId));
    dialogueDraft = await rehearsal.rehearse({
      chapterNumber,
      chapterMemo: writeInput.chapterMemo?.body ?? "",
      characters: voices.characters,
      currentContext: reducedControlInput?.currentFocus ?? "",
      maxRounds: 5,
    });
    this.config.logger?.info(`[dialogue-rehearsal] Completed ${dialogueDraft.rounds.length} rounds`);
  }
} catch (err) {
  this.config.logger?.warn(`[dialogue-rehearsal] Failed, proceeding without: ${err}`);
}
```

- [ ] **Step 3: 在 Review Cycle 之后插入对话审计**

在 AntiDetectAgent 之前插入：

```typescript
// Phase 4b: Dialogue Audit (optional, with fallback)
let dialogueAudit: DialogueAuditResult | undefined;
try {
  const voices = await loadCharacterVoices(bookDir);
  if (Object.keys(voices.characters).length > 0) {
    const dialogueAuditor = new DialogueAuditor(this.agentCtxFor("dialogue-auditor", bookId));
    dialogueAudit = await dialogueAuditor.auditDialogues({
      chapterNumber,
      chapterContent: finalContent,
      characters: voices.characters,
      threshold: 7,
    });
    this.config.logger?.info(`[dialogue-auditor] Score: ${dialogueAudit.totalScore}/100, passed: ${dialogueAudit.passed}`);
    totalUsage = PipelineRunner.addUsage(totalUsage, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  }
} catch (err) {
  this.config.logger?.warn(`[dialogue-auditor] Failed, proceeding without: ${err}`);
}
```

- [ ] **Step 4: 编译验证**

```bash
cd packages/core && npx tsc 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/pipeline/runner.ts
git commit -m "feat: integrate dialogue agents into pipeline"
```

---

## Task 6: 编译和集成测试

- [ ] **Step 1: 编译整个项目**

```bash
cd packages/core && npx tsc
cd packages/cli && npx tsc
```
Expected: 0 errors

- [ ] **Step 2: 链接并测试**

```bash
cd packages/cli && npm link
inkos --version
inkos status
```
Expected: version 1.5.0, status shows 2 books

- [ ] **Step 3: 测试写一章**

```bash
cd /c/Users/ZhuanZ/Desktop/novel-project
inkos write next --book 金箍棒教鬼做人
```
Expected: 成功写一章，日志中显示 dialogue-rehearsal 和 dialogue-auditor 的输出

- [ ] **Step 4: 检查生成的文件**

```bash
ls books/金箍棒教鬼做人/story/character_voices.json
cat books/金箍棒教鬼做人/story/character_voices.json
```
Expected: 存在角色声音档案文件，包含孙悟空、叶秋等角色

- [ ] **Step 5: Final Commit**

```bash
git add -A
git commit -m "feat: complete character dialogue agent system"
```
