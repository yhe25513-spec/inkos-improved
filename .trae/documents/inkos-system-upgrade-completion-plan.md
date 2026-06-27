# inkos 系统升级收尾计划（Phase 7 + 关键缺口修复）

## 一、Summary

前序对话已完成 Phase 1-6（共 15 个文件修改已落盘验证）。本计划聚焦三块剩余工作：

1. **Phase 7：配置化与代码清理** — BookConfigSchema 新增字段、PolisherAgent 弃用、index.ts 清理
2. **Phase 8（关键缺口）：小说数据与真人感画像未接入** — `loadOrCreateHumanityProfile` 已导入但从未调用，`humanityEngine.initialize()` 从未调用，引擎运行在默认画像上，用户投喂的小说数据完全未生效
3. **Phase 9（关键缺口）：enhanceSystemPrompt 与 profileManager 未接入写作流程** — `buildWriterSystemPrompt` 调用时未传 `profileManager`（Phase 3 学习系统未真正连接），`humanityEngine.enhanceSystemPrompt()` 从未调用（真人感画像不影响 LLM 生成，仅后处理生效）

---

## 二、Current State Analysis

### 2.1 已完成（Phase 1-6，已验证落盘）

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | Bug 修复（破折号检测、AITells 合并、标题校验） | ✅ 已落盘 |
| 2 | 质量门禁（maxReviewIterations=3、零错误检查、criticalFailure） | ✅ 已落盘 |
| 3 | 学习系统持久化（EditTracker/UserProfileManager 持久化、ColdStartHandler） | ✅ 已落盘 |
| 4+5 | 模块集成（HumanityEngine、EmotionInjector、PerplexityAnalyzer 接入 runner） | ✅ 已落盘 |
| 6 | PreferenceAnalyzer 维度扩展（humor/darkness/romance/action/paragraphLength） | ✅ 已落盘 |

### 2.2 未完成（Phase 7）

- `packages/core/src/models/book.ts` 第 55-68 行：BookConfigSchema 无新字段
- `packages/core/src/agents/polisher.ts`：无 `@deprecated` JSDoc
- `packages/core/src/index.ts`：第 425 行导出 PolisherAgent；第 552-562、564-570 行导出 compliance；第 606-613、615-619 行导出 creativity

### 2.3 关键缺口 1：小说数据未接入（Phase 8）

**问题**：
- `runner.ts` 第 76 行导入了 `loadOrCreateHumanityProfile`，但全文件无任何调用
- `runner.ts` 第 530 行 `this.humanityEngine = new HumanityEngine()` 仅用默认画像初始化
- `humanityEngine.initialize()` 方法（humanity-engine.ts 第 84 行）从未被调用
- `postProcessChapter()`（runner.ts 第 2098 行）调用 `humanityEngine.postProcessWrittenText()`，但引擎运行在 `createDefaultHumanityProfile()` 上
- **结论**：用户投喂的小说数据完全未生效，真人感引擎运行在通用默认值上

**小说样本现状**：
- `docs/novel-design/` 下仅 3 个 .txt 文件（12-系统面板、13-无敌流设定、14-现实世界视角），均为设定文档非小说正文
- `profile-initializer.ts` 的 `initializeHumanityProfileFromSamples()` 需要小说正文 .txt 来提取 12 维写作指纹
- 桌面及项目内未找到其他小说正文 .txt 文件

**设计决策**：采用双模式——无样本时用默认画像运行 + 后续可配置样本路径自动学习。samples 路径通过 BookConfigSchema 配置，默认指向 `books/<bookId>/.inkos/samples/`。

### 2.4 关键缺口 2：enhanceSystemPrompt 与 profileManager 未接入写作流程（Phase 9）

**问题 A — profileManager 未传入 writer**：
- `writer.ts` 第 223-229 行调用 `buildWriterSystemPrompt()` 时未传 `profileManager` 参数
- Phase 3 已让 `buildWriterSystemPrompt` 接受 `profileManager?: UserProfileManager`，但 writer 从不传入
- `WriteChapterInput` 接口（writer.ts 第 73-88 行）无 `profileManager` 字段
- **结论**：用户偏好学习系统（Phase 3）的数据无法影响 LLM 提示词

**问题 B — enhanceSystemPrompt 未调用**：
- `HumanityEngine.enhanceSystemPrompt()`（humanity-engine.ts 第 141 行）从未在写作流程中调用
- 只有 `postProcessWrittenText()`（后处理）被接入
- **结论**：真人感画像的预 LLM 增强（身体存在感、时间碎片、矛盾性行为等提示词注入）完全未生效

---

## 三、Proposed Changes

### Phase 7：配置化与代码清理

#### 7.1 BookConfigSchema 新增字段

**文件**：`packages/core/src/models/book.ts`（第 55-68 行）

在 `BookConfigSchema` 的 `fanficMode` 字段后新增 7 个可选字段：

```typescript
export const BookConfigSchema = z.object({
  // ... 现有字段 ...
  parentBookId: z.string().optional(),
  fanficMode: FanficModeSchema.optional(),
  // ── 系统开关（可选，缺省时按默认行为运行）──
  enableAntiAI: z.boolean().optional().default(true),
  enableHumanity: z.boolean().optional().default(true),
  enableEmotion: z.boolean().optional().default(true),
  enableLearning: z.boolean().optional().default(true),
  // ── 质量门禁参数 ──
  maxErrorsPerChapter: z.number().int().min(0).optional().default(0),
  maxReviewIterations: z.number().int().min(1).max(5).optional().default(3),
  // ── 真人感/去AI味强度 ──
  humanizerIntensity: z.number().min(0).max(1).optional().default(0.3),
  // ── 小说样本目录（相对项目根，用于真人感画像初始化）──
  humanitySamplesDir: z.string().optional(),
});
```

**原因**：让用户可按书籍级别开关各子系统、调整质量门禁严格度与去 AI 味强度，并配置小说样本路径。

#### 7.2 PolisherAgent 弃用

**文件**：`packages/core/src/agents/polisher.ts`

在 `PolisherAgent` 类声明前添加 `@deprecated` JSDoc：

```typescript
/**
 * @deprecated 自 inkos v0.x 起，PolisherAgent 的职责已被 chapter-review-cycle
 *（结构修订）+ postProcessChapter（anti-ai/humanity/emotion 后处理）取代。
 * 新代码不应使用此类；保留仅为向后兼容。迁移指南：
 *   - 表面润色 → postProcessChapter 的 anti-ai 阶段（Humanizer + BurstinessAdjuster）
 *   - 结构修订 → chapter-review-cycle 的 reviser
 *   - 情感注入 → postProcessChapter 的 emotional 阶段（EmotionInjector）
 */
export class PolisherAgent extends BaseAgent {
```

**原因**：PolisherAgent 的功能已被新流水线完全覆盖，标记弃用避免新代码误用。

#### 7.3 index.ts 清理

**文件**：`packages/core/src/index.ts`

| 行号 | 操作 | 内容 |
|------|------|------|
| 425 | 修改 | PolisherAgent 导出行添加 `@deprecated` 注释（不删除导出，保持向后兼容） |
| 552-562 | 删除 | compliance 类型导出块 |
| 564-570 | 删除 | compliance 值导出块 |
| 606-613 | 删除 | creativity 类型导出块 |
| 615-619 | 删除 | creativity 值导出块 |
| 621-642 | 保留+注释 | consistency 导出添加 `@studio-only` 注释（仅 Studio 使用，不从 core 公共 API 暴露） |

**原因**：compliance 和 creativity 子系统已废弃（功能被 anti-ai + humanity 取代），不应从 core 公共 API 暴露。consistency 保留但标注仅 Studio 使用。

---

### Phase 8：接入小说数据与真人感画像（关键缺口 1）

#### 8.1 runner.ts 初始化 HumanityEngine 时加载画像

**文件**：`packages/core/src/pipeline/runner.ts`

**当前代码**（第 526-531 行）：
```typescript
constructor(config: PipelineConfig) {
  this.config = config;
  this.state = new StateManager(config.projectRoot);
  this.humanityEngine = new HumanityEngine();
}
```

**修改为**：构造函数保持轻量（仅 new），新增 `initHumanityEngineForBook()` 方法在首次写章节时按书籍初始化：

```typescript
private humanityProfilesLoaded = new Set<string>();

private async ensureHumanityEngineReady(bookId: string, bookConfig: BookConfig): Promise<void> {
  if (this.humanityProfilesLoaded.has(bookId)) return;
  this.humanityProfilesLoaded.add(bookId);

  // 画像持久化路径：books/<bookId>/.inkos/humanity_profile.json
  const profileRelPath = `books/${bookId}/.inkos/humanity_profile.json`;
  const profileAbsPath = join(this.config.projectRoot, profileRelPath);

  try {
    const profile = await loadOrCreateHumanityProfile(profileAbsPath);

    // 如果配置了样本目录且画像仍是默认画像，尝试从样本初始化
    const samplesDir = bookConfig.humanitySamplesDir
      ? join(this.config.projectRoot, bookConfig.humanitySamplesDir)
      : undefined;

    if (samplesDir) {
      const { initializeHumanityProfileFromSamples } = await import("../humanity/profile-initializer.js");
      const derivedProfile = await initializeHumanityProfileFromSamples(samplesDir, profileAbsPath);
      this.humanityEngine.updateProfile(derivedProfile);
      this.config.logger?.info(`[humanity] 从样本目录 ${samplesDir} 初始化画像成功`);
    } else {
      this.humanityEngine.updateProfile(profile);
      this.config.logger?.info(`[humanity] 加载已有画像（无样本目录，使用默认或已存画像）`);
    }
  } catch (e) {
    this.config.logger?.warn(`[humanity] 画像初始化失败，使用默认画像: ${e}`);
    // 失败时保持默认画像，不阻断写作
  }
}
```

**调用点**：在 `_writeNextChapterLocked()` 中，`prepareWriteInput` 之后、`writer.writeChapter` 之前调用：
```typescript
await this.ensureHumanityEngineReady(bookId, book);
```

**原因**：让真人感引擎按书籍加载/创建画像，支持从小说样本提取指纹，失败时优雅降级到默认画像。

#### 8.2 postProcessChapter 受配置开关控制

**文件**：`packages/core/src/pipeline/runner.ts`（第 2098 行 `postProcessChapter`）

在方法开头添加配置检查：
```typescript
private async postProcessChapter(
  content: string, bookDir: string, bookConfig: BookConfig,
  chapterNumber: number, lengthSpec: LengthSpec,
): Promise<string> {
  // 按配置开关跳过各阶段
  const enableAntiAI = bookConfig.enableAntiAI ?? true;
  const enableHumanity = bookConfig.enableHumanity ?? true;
  const enableEmotion = bookConfig.enableEmotion ?? true;

  let result = content;
  // 1. anti-ai 处理
  if (enableAntiAI) { /* 现有 humanizer + burstinessAdjuster 逻辑 */ }
  // 2. humanity 处理
  if (enableHumanity) { /* 现有 humanityEngine.postProcessWrittenText 逻辑 */ }
  // 3. emotional 处理
  if (enableEmotion) { /* 现有 EmotionInjector 逻辑 */ }
  return result;
}
```

同时将 `humanizer.humanize(result, 0.3)` 的强度改为 `bookConfig.humanizerIntensity ?? 0.3`。

**原因**：让用户可按需开关各后处理阶段，并调整去 AI 味强度。

---

### Phase 9：接入 enhanceSystemPrompt 与 profileManager（关键缺口 2）

#### 9.1 WriteChapterInput 新增字段

**文件**：`packages/core/src/agents/writer.ts`（第 73-88 行）

在 `WriteChapterInput` 接口末尾新增：
```typescript
export interface WriteChapterInput {
  // ... 现有字段 ...
  readonly roleConstraints?: string;
  /** 用户偏好画像管理器（Phase 3 学习系统），用于增强系统提示词 */
  readonly profileManager?: UserProfileManager;
  /** 真人感引擎引用，用于在 LLM 调用前增强系统提示词 */
  readonly humanityEngine?: HumanityEngine;
}
```

需在 writer.ts 顶部添加导入：
```typescript
import type { UserProfileManager } from "../learning/user-profile.js";
import type { HumanityEngine } from "../humanity/humanity-engine.js";
```

#### 9.2 writer.ts 调用 buildWriterSystemPrompt 时传入 profileManager

**文件**：`packages/core/src/agents/writer.ts`（第 223-229 行）

```typescript
const creativeSystemPrompt = buildWriterSystemPrompt(
  book, genreProfile, bookRules, bookRulesBody, genreBody, styleGuide, styleFingerprint,
  chapterNumber, "creative", fanficContext, resolvedLanguage,
  input.chapterMemo ? "governed" : "legacy",
  resolvedLengthSpec,
  input.roleConstraints,
  input.profileManager,  // ← 新增：传入用户偏好画像
);
```

#### 9.3 writer.ts 调用 enhanceSystemPrompt 增强 prompt

**文件**：`packages/core/src/agents/writer.ts`（第 223-229 行之后）

在 `buildWriterSystemPrompt` 返回后、传入 LLM 前，调用真人感引擎增强：

```typescript
let creativeSystemPrompt = buildWriterSystemPrompt(
  book, genreProfile, bookRules, bookRulesBody, genreBody, styleGuide, styleFingerprint,
  chapterNumber, "creative", fanficContext, resolvedLanguage,
  input.chapterMemo ? "governed" : "legacy",
  resolvedLengthSpec,
  input.roleConstraints,
  input.profileManager,
);

// 真人感提示词增强（预 LLM 阶段）
if (input.humanityEngine) {
  try {
    creativeSystemPrompt = input.humanityEngine.enhanceSystemPrompt(creativeSystemPrompt);
  } catch (e) {
    this.ctx.logger?.warn(`[humanity] enhanceSystemPrompt 失败，使用原始提示词: ${e}`);
  }
}
```

**注意**：需检查 writer.ts 中是否有第二个 `buildWriterSystemPrompt` 调用（如 settler/observer 模式），如有也需同步修改。从 grep 结果看，settler 和 observer 有独立的 prompt builder，不受影响。

#### 9.4 runner.ts 传入 profileManager 和 humanityEngine

**文件**：`packages/core/src/pipeline/runner.ts`（第 2299 行 `writer.writeChapter` 调用）

```typescript
const output = await writer.writeChapter({
  book,
  bookDir,
  chapterNumber,
  ...writeInput,
  lengthSpec,
  ...(wordCount ? { wordCountOverride: wordCount } : {}),
  ...(temperatureOverride ? { temperatureOverride } : {}),
  ...(roleConstraints ? { roleConstraints } : {}),
  profileManager: this.getProfileManager(bookId),   // ← 新增
  humanityEngine: this.humanityEngine,               // ← 新增
});
```

同样修改第 1280 行的另一个 `writer.writeChapter` 调用（`writeDraft` 方法内）。

**原因**：让 Phase 3 学习系统和真人感画像真正影响 LLM 提示词，而非仅后处理。

---

## 四、Assumptions & Decisions

1. **小说样本数据**：用户取消了关于样本位置的提问。采用双模式设计——无样本时用默认画像运行 + 可配置 `humanitySamplesDir` 字段供后续放入样本。不强制要求样本存在。
2. **PolisherAgent 不删除导出**：仅添加 `@deprecated` 注释，保持向后兼容，避免破坏现有调用方。
3. **compliance/creativity 导出直接删除**：这两个子系统已被 anti-ai + humanity 完全取代，且为内部模块，删除公共导出不影响核心流水线。
4. **consistency 导出保留**：仅添加 `@studio-only` 注释，因为 ConsistencyChecker 仍被 Studio 使用。
5. **humanityEngine 初始化时机**：在 `_writeNextChapterLocked` 中按需初始化（首次写章节时），而非构造函数中（构造函数无法访问 bookId）。
6. **失败优雅降级**：所有新增的 humanity/profile 初始化均包裹 try/catch，失败时记录 warning 并使用默认画像，不阻断写作流程。

---

## 五、Verification Steps

### 5.1 构建验证
```bash
pnpm -r build
```
确认无编译错误。

### 5.2 类型检查
```bash
pnpm -r typecheck
```
确认无类型错误。注意：`src/humanity/` 目录下可能存在前序对话遗留的类型错误（非本次引入），需区分。

### 5.3 测试
```bash
pnpm -r test
```
确认现有测试通过。注意：前序对话中已知 "should handle consistency checking workflow" 测试在修改前就已失败（ConsistencyChecker 返回值问题），非本次引入。

### 5.4 手动验证点
- BookConfigSchema 新字段有默认值，旧配置文件不传新字段时按默认行为运行
- `enhanceSystemPrompt` 失败时 writer 仍能正常生成章节
- `loadOrCreateHumanityProfile` 失败时引擎使用默认画像
- `postProcessChapter` 各阶段受配置开关控制

---

## 六、实施顺序

1. **Phase 7.1**：BookConfigSchema 新增字段（models/book.ts）
2. **Phase 7.2**：PolisherAgent 弃用（agents/polisher.ts）
3. **Phase 7.3**：index.ts 清理
4. **Phase 8.1**：runner.ts 新增 ensureHumanityEngineReady 方法 + 调用点
5. **Phase 8.2**：postProcessChapter 受配置开关控制
6. **Phase 9.1**：WriteChapterInput 新增字段（writer.ts）
7. **Phase 9.2-9.3**：writer.ts 传入 profileManager + 调用 enhanceSystemPrompt
8. **Phase 9.4**：runner.ts 传入 profileManager 和 humanityEngine
9. **最终验证**：build + typecheck + test
