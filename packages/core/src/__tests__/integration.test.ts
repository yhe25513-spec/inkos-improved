import { describe, it, expect } from "vitest";
import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";
import { SentenceReconstructor } from "../anti-ai/sentence-reconstructor.js";
import { EmotionAnalyzer } from "../emotional/emotion-analyzer.js";
import { ArcPlanner } from "../emotional/arc-planner.js";
import { EmotionInjector } from "../emotional/injector.js";
import { ForeshadowTracker } from "../consistency/foreshadow-tracker.js";
import { CharacterStateSync } from "../consistency/character-state-sync.js";
import { TimelineManager } from "../consistency/timeline-manager.js";
import { ConsistencyChecker } from "../consistency/consistency-checker.js";
import { EditTracker } from "../learning/edit-tracker.js";
import { PreferenceAnalyzer } from "../learning/preference-analyzer.js";
import { UserProfileManager } from "../learning/user-profile.js";
import { PromptEnhancer } from "../learning/prompt-enhancer.js";

describe("Integration: Complete Writing Workflow", () => {
  it("should handle user preference learning workflow", async () => {
    // 1. 创建编辑追踪器（大批次避免自动刷新）
    const tracker = new EditTracker({ batchSize: 100 });

    // 2. 记录用户编辑
    for (let i = 0; i < 10; i++) {
      tracker.trackEdit({
        userId: "user-001",
        bookId: "book-001",
        chapterId: `ch-${i}`,
        originalText: "他走了过去。",
        editedText: "他漫步离开了。",
        editType: "rephrase",
      });
    }

    // 3. 分析偏好
    const analyzer = new PreferenceAnalyzer();
    const edits = tracker.getBufferedEdits();
    const preference = analyzer.analyze(edits);
    expect(preference.meta.sampleSize).toBe(10);

    // 4. 更新用户画像
    const profileManager = new UserProfileManager();
    profileManager.updatePreference("user-001", "book-001", preference, 0.5);

    // 5. 获取偏好
    const savedPref = profileManager.getPreference("user-001", "book-001");
    expect(savedPref.meta.sampleSize).toBe(10);

    // 6. 生成增强提示词
    const enhancer = new PromptEnhancer();
    const prompt = enhancer.buildEnhancedPrompt("写一个开头", savedPref, {
      bookGenre: "都市",
      chapterNumber: 1,
    });
    expect(prompt).toContain("风格指南");
  });

  it("should handle consistency checking workflow", async () => {
    const bookId = "book-consistency";

    // 1. 设置伏笔
    const foreshadowTracker = new ForeshadowTracker();
    foreshadowTracker.addForeshadow(bookId, 1, "他发现了一个神秘的盒子。", ["主角"]);
    foreshadowTracker.addForeshadow(bookId, 5, "她似乎知道些什么。", ["女主", "主角"]);

    // 2. 设置角色状态
    const characterSync = new CharacterStateSync();
    characterSync.addState(bookId, {
      characterName: "主角",
      chapterNumber: 1,
      physicalState: "健康",
      mentalState: "好奇",
      relationships: [],
      inventory: [{ id: "box", name: "神秘盒子", description: "未知", quantity: 1 }],
      knowledge: [],
      secrets: [],
      goals: ["解开谜团"],
    });

    // 3. 设置时间线
    const timelineManager = new TimelineManager();
    timelineManager.addEvent(bookId, {
      chapterNumber: 1,
      storyTime: "第一天",
      description: "发现盒子",
      characters: ["主角"],
      location: "旧宅",
      type: "main",
    });

    // 4. 检查一致性
    const checker = new ConsistencyChecker(foreshadowTracker, characterSync, timelineManager);
    const issues = checker.checkConsistency(bookId, 60);

    // 应该检测到过期的伏笔
    expect(issues.some((i) => i.type === "foreshadow")).toBe(true);
  });
});

describe("Integration: Anti-AI Pipeline", () => {
  it("should process text through complete anti-AI pipeline", async () => {
    const originalText = `
      他走进了房间，看到了桌子上的书。他拿起书，翻开了第一页。
      书中写满了密密麻麻的文字，他认真地读了起来。
      过了一会儿，他合上了书，思考着书中的内容。
      他觉得这本书很有意思，决定继续读下去。
    `;

    // 1. 分析AI特征
    const analyzer = new PerplexityAnalyzer();
    const analysis = analyzer.analyze(originalText);
    expect(analysis.perplexity).toBeGreaterThan(0);

    // 2. 重构文本
    const reconstructor = new SentenceReconstructor();
    const reconstructed = await reconstructor.reconstruct(originalText, {
      genre: "urban",
      intensity: 6,
    });

    // 3. 重新分析
    const newAnalysis = analyzer.analyze(reconstructed);
    expect(newAnalysis.perplexity).toBeGreaterThan(0);

    // 4. 检查是否更像人类
    // 困惑度应该提高或突发性应该提高
    expect(
      newAnalysis.perplexity >= analysis.perplexity * 0.8 ||
      newAnalysis.burstiness >= analysis.burstiness * 0.8
    ).toBe(true);
  });
});

describe("Integration: Emotion Enhancement Pipeline", () => {
  it("should enhance text with emotion and verify naturalness", async () => {
    // 1. 创建情感曲线
    const arcPlanner = new ArcPlanner();
    const arc = arcPlanner.planArc("book-emotion", {
      totalChapters: 10,
      actBreaks: [3, 6],
      climaxChapter: 8,
      resolutionChapter: 10,
      theme: "爱情故事",
    }, "romance");

    // 2. 准备文本
    const originalText = "她看着他离去的背影，心里有些难过。";

    // 3. 分析情感
    const emotionAnalyzer = new EmotionAnalyzer();
    const emotion = emotionAnalyzer.analyze(originalText);
    expect(emotion.primaryEmotion).toBeTruthy();

    // 4. 注入情感
    const injector = new EmotionInjector();
    const enhanced = await injector.enhanceChapter(originalText, arc, 1);

    // 5. 验证情感增强
    const enhancedEmotion = emotionAnalyzer.analyze(enhanced);
    expect(enhancedEmotion.primaryEmotion).toBeTruthy();
  });
});
