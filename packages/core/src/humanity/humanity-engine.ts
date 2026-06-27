// ── 真人感引擎（HumanityEngine） ────────────────────────────
// 核心引擎，编排所有子模块，协调真人感系统的工作流程

import type {
  HumanityProfile,
  HumanityFingerprint,
  WritingContext,
  BreathingPoint,
} from "../models/humanity-profile.js";
import {
  createDefaultHumanityProfile,
  deriveStyleInjectionFromFingerprint,
} from "../models/humanity-profile.js";
import { SampleAnalyzer } from "./sample-analyzer.js";
import { SceneBreaker, type ChapterOutline } from "./scene-breaker.js";
import { SilenceLayerInjector } from "./silence-layer.js";
import { SelfContradictionGenerator } from "./self-contradiction.js";

/**
 * 引擎配置
 */
export interface HumanityEngineConfig {
  /** 是否启用后处理 */
  enablePostProcess?: boolean;
  /** 是否启用提示词增强 */
  enablePromptEnhancement?: boolean;
  /** 后处理强度 0-1 */
  postProcessStrength?: number;
}

/**
 * 初始化选项
 */
export interface InitializeOptions {
  /** 书籍 ID */
  bookId?: string;
  /** 真人样本文件列表 */
  samples?: Array<{ name: string; content: string }>;
  /** 现有的真人感画像（用于融合） */
  existingProfile?: HumanityProfile;
  /** 自定义指纹（可选） */
  customFingerprint?: HumanityFingerprint;
}

/**
 * 真人感引擎
 *
 * 核心功能：
 * 1. 初始化真人感画像（从样本分析或默认）
 * 2. 增强系统提示词
 * 3. 后处理已生成的文本
 */
export class HumanityEngine {
  private profile: HumanityProfile;
  private sampleAnalyzer: SampleAnalyzer;
  private sceneBreaker: SceneBreaker;
  private silenceInjector: SilenceLayerInjector;
  private contradictionGenerator: SelfContradictionGenerator;
  private config: Required<HumanityEngineConfig>;

  constructor(config?: HumanityEngineConfig) {
    this.config = {
      enablePostProcess: config?.enablePostProcess ?? true,
      enablePromptEnhancement: config?.enablePromptEnhancement ?? true,
      postProcessStrength: config?.postProcessStrength ?? 1.0,
    };

    // 初始化默认画像
    this.profile = createDefaultHumanityProfile();
    this.sampleAnalyzer = new SampleAnalyzer();

    // 初始化子模块
    this.sceneBreaker = new SceneBreaker(this.profile);
    this.silenceInjector = new SilenceLayerInjector(this.profile);
    this.contradictionGenerator = new SelfContradictionGenerator(this.profile);
  }

  /**
   * 初始化真人感画像
   *
   * 从样本分析提取指纹，或使用默认/现有画像
   */
  async initialize(options: InitializeOptions = {}): Promise<HumanityProfile> {
    const { bookId, samples, existingProfile, customFingerprint } = options;

    // 更新书籍 ID
    if (bookId) {
      this.profile.bookId = bookId;
    }

    // 1. 如果有自定义指纹，直接使用
    if (customFingerprint) {
      this.profile.fingerprint = customFingerprint;
      this.profile.styleInjection = deriveStyleInjectionFromFingerprint(customFingerprint);
    }
    // 2. 如果有样本，分析并提取指纹
    else if (samples && samples.length > 0) {
      const fingerprint = await this.sampleAnalyzer.analyzeFromFiles(samples);
      this.profile.fingerprint = fingerprint;
      this.profile.styleInjection = deriveStyleInjectionFromFingerprint(fingerprint);
      this.profile.learnedFromSamples = samples.map((s) => s.name);
    }
    // 3. 如果有现有画像，融合
    else if (existingProfile) {
      this.profile = this.mergeProfile(existingProfile, this.profile);
    }

    // 更新时间戳
    this.profile.updatedAt = new Date().toISOString();

    // 更新子模块的画像
    this.updateSubModules();

    return this.profile;
  }

  /**
   * 获取当前画像
   */
  getProfile(): HumanityProfile {
    return { ...this.profile };
  }

  /**
   * 更新画像
   */
  updateProfile(profile: HumanityProfile): void {
    this.profile = profile;
    this.updateSubModules();
  }

  /**
   * 增强系统提示词
   * 在 LLM 调用之前，注入真人感写作原则
   *
   * @param basePrompt 原始系统提示词
   * @param context 写作上下文
   * @returns 增强后的系统提示词
   */
  enhanceSystemPrompt(
    basePrompt: string,
    context?: WritingContext
  ): string {
    if (!this.config.enablePromptEnhancement) {
      return basePrompt;
    }

    const additions: string[] = [];
    const { styleInjection } = this.profile;

    // 1. 身体存在感
    if (styleInjection.bodyPresenceLevel > 0.2) {
      additions.push(this.getBodyPresenceGuideline());
    }

    // 2. 时间碎片
    if (styleInjection.timeFragmentPreference > 0.15) {
      additions.push(this.getTimeFragmentGuideline());
    }

    // 3. 矛盾性行为
    if (styleInjection.protagonistFlawPreference > 0.1) {
      additions.push(this.getContradictionGuideline());
    }

    // 4. 沉默层
    if (styleInjection.silenceLayerPreference > 0.15) {
      additions.push(this.getSilenceLayerGuideline());
    }

    // 5. 不体面道具
    if (styleInjection.unseemlyItemPreference > 0.1) {
      additions.push(this.getUnseemlyItemGuideline());
    }

    // 6. 口语化对话
    additions.push(this.getColloquialDialogueGuideline());

    // 如果没有需要添加的内容，直接返回
    if (additions.length === 0) {
      return basePrompt;
    }

    const enhancementSection = `
## 写作风格微调

${additions.map((a, i) => `${i + 1}. ${a}`).join("\n")}

**注意**：以上要求不要过度使用，保持适度。
`;

    return basePrompt + "\n\n" + enhancementSection;
  }

  /**
   * 后处理已生成的文本
   * 在文本上做轻度真人感微调
   *
   * @param text 原始文本
   * @param context 写作上下文
   * @returns 后处理后的文本
   */
  postProcessWrittenText(
    text: string,
    context?: WritingContext
  ): string {
    if (!this.config.enablePostProcess) {
      return text;
    }

    const strength = this.config.postProcessStrength;
    let result = text;

    // 1. 沉默层注入（15-30%概率）
    if (Math.random() < this.profile.styleInjection.silenceLayerPreference * strength) {
      result = this.silenceInjector.injectSilence(result, context);
    }

    // 2. 矛盾性行为注入（10-25%概率）
    if (Math.random() < this.profile.styleInjection.protagonistFlawPreference * strength) {
      result = this.contradictionGenerator.injectContradictions(result, context || {
        protagonistName: "他",
        chapterWordCount: text.length,
        existingBodyDescriptions: [],
        existingProps: [],
      });
    }

    // 3. 呼吸段注入（根据时间碎片偏好）
    if (Math.random() < this.profile.styleInjection.timeFragmentPreference * strength * 0.5) {
      result = this.sceneBreaker.injectRandomBreathing(result, context || {
        protagonistName: "他",
        chapterWordCount: text.length,
        existingBodyDescriptions: [],
        existingProps: [],
      });
    }

    // 4. 不体面道具注入（15-30%概率）
    if (Math.random() < this.profile.styleInjection.unseemlyItemPreference * strength) {
      result = this.sceneBreaker.injectUnseemlyItem(result, context || {
        protagonistName: "他",
        chapterWordCount: text.length,
        existingBodyDescriptions: [],
        existingProps: [],
      });
    }

    return result;
  }

  /**
   * 规划章节的呼吸点
   *
   * @param outline 章节大纲
   * @returns 呼吸点列表
   */
  planBreathingPoints(outline: ChapterOutline): BreathingPoint[] {
    return this.sceneBreaker.planBreathingPoints(outline);
  }

  /**
   * 生成呼吸段文本
   */
  generateBreathingText(point: BreathingPoint, context: WritingContext): string {
    return this.sceneBreaker.generateBreathingText(point, context);
  }

  /**
   * 融合两个画像
   * 加权平均
   */
  private mergeProfile(
    base: HumanityProfile,
    incoming: HumanityProfile
  ): HumanityProfile {
    const mergedFingerprint = this.mergeFingerprint(
      base.fingerprint,
      incoming.fingerprint
    );
    const mergedStyleInjection = this.mergeStyleInjection(
      base.styleInjection,
      incoming.styleInjection
    );

    return {
      ...base,
      fingerprint: mergedFingerprint,
      styleInjection: mergedStyleInjection,
      learnedFromSamples: [
        ...base.learnedFromSamples,
        ...incoming.learnedFromSamples,
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 融合指纹
   */
  private mergeFingerprint(
    a: HumanityFingerprint,
    b: HumanityFingerprint
  ): HumanityFingerprint {
    return {
      sentenceLengthStd: (a.sentenceLengthStd + b.sentenceLengthStd) / 2,
      burstIndex: (a.burstIndex + b.burstIndex) / 2,
      exclamationDensity: (a.exclamationDensity + b.exclamationDensity) / 2,
      questionDensity: (a.questionDensity + b.questionDensity) / 2,
      hesitationWordDensity: (a.hesitationWordDensity + b.hesitationWordDensity) / 2,
      dialogueInterruptRate: (a.dialogueInterruptRate + b.dialogueInterruptRate) / 2,
      timeFragmentRatio: (a.timeFragmentRatio + b.timeFragmentRatio) / 2,
      bodyPartDensity: (a.bodyPartDensity + b.bodyPartDensity) / 2,
      colloquialDensity: (a.colloquialDensity + b.colloquialDensity) / 2,
      perspectiveShiftRate: (a.perspectiveShiftRate + b.perspectiveShiftRate) / 2,
      selfContradictionRate: (a.selfContradictionRate + b.selfContradictionRate) / 2,
      unseemlyItemRate: (a.unseemlyItemRate + b.unseemlyItemRate) / 2,
    };
  }

  /**
   * 融合风格注入参数
   */
  private mergeStyleInjection(
    a: HumanityProfile["styleInjection"],
    b: HumanityProfile["styleInjection"]
  ): HumanityProfile["styleInjection"] {
    return {
      hesitationFrequency: (a.hesitationFrequency + b.hesitationFrequency) / 2,
      dialogueInterruptFrequency:
        (a.dialogueInterruptFrequency + b.dialogueInterruptFrequency) / 2,
      perspectiveShiftTendency:
        (a.perspectiveShiftTendency + b.perspectiveShiftTendency) / 2,
      bodyPresenceLevel: (a.bodyPresenceLevel + b.bodyPresenceLevel) / 2,
      unseemlyItemPreference:
        (a.unseemlyItemPreference + b.unseemlyItemPreference) / 2,
      protagonistFlawPreference:
        (a.protagonistFlawPreference + b.protagonistFlawPreference) / 2,
      timeFragmentPreference:
        (a.timeFragmentPreference + b.timeFragmentPreference) / 2,
      silenceLayerPreference:
        (a.silenceLayerPreference + b.silenceLayerPreference) / 2,
    };
  }

  /**
   * 更新子模块的画像引用
   */
  private updateSubModules(): void {
    this.sceneBreaker.updateProfile(this.profile);
    this.silenceInjector.updateProfile(this.profile);
    this.contradictionGenerator.updateProfile(this.profile);
  }

  // ── 写作原则生成 ────────────────────────────────────

  private getBodyPresenceGuideline(): string {
    return `注意穿插主角的身体感受描写。当主角紧张时，不写"他很紧张"，而是写具体的身体反应，如"他的手指在桌下轻轻敲击""他的后背绷得很紧"。当主角疲惫时，写"他的眼皮有点沉"，而不是"他很累"。`;
  }

  private getTimeFragmentGuideline(): string {
    return `每写2-3个推动剧情的段落后，可以插入一个不推动剧情的小段落——可以是主角的某个无意识动作（揉了揉太阳穴、捏了捏鼻梁）、环境中一个无关的细节（远处传来鸟叫、风停了）、或者主角走神想起某件无关的事。这个段落的唯一作用是给读者"喘口气"的机会。`;
  }

  private getContradictionGuideline(): string {
    return `允许主角做一些"不完美"的小事。犹豫一下、走错一步、说一句事后后悔的话、说了"不在乎"但目光一直没移开。这些小错不影响剧情走向，但让角色更像真人。主角不是全知全能的，他会有判断失误，会有私心，会有想藏起来的东西。`;
  }

  private getSilenceLayerGuideline(): string {
    return `用动作和暗示代替直接的情绪形容词。例如：写"他的手指在桌下轻轻敲击"代替"他很紧张"；写"他对着自己的影子站了很久"代替"他很悲伤"。对话中允许有未完成的话："我想告诉你——""什么？""……算了，没什么。"`;
  }

  private getUnseemlyItemGuideline(): string {
    return `场景中的道具和物品可以有"磨损感"——有缺口的水杯、断了一根弦的弓、沾了污渍的桌子、窗户玻璃上有一道裂纹。这些东西不推动剧情，但让世界更真实。真人的世界里，没有什么是崭新的。`;
  }

  private getColloquialDialogueGuideline(): string {
    return `对话要像真人说话——可以有重复、停顿、被打断、语气词（嗯、啊、哦、这个、那个）、以及答非所问。避免"标准书面语"式的对话。主角说"我想——"然后顿住，或者"吃饭了吗？""啊？"这种真实的对话反应。`;
  }
}
