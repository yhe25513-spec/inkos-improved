// ── 场景断裂处理器（SceneBreaker） ───────────────────────
// 在高张力场景之间自动插入"呼吸段"，让紧张的剧情有喘息空间

import type {
  BreathingPoint,
  BreathingType,
  HumanityProfile,
  WritingContext,
} from "../models/humanity-profile.js";
import {
  getRandomBreathingText,
  getRandomTemplate,
} from "./templates.js";

/**
 * 场景信息
 */
export interface SceneInfo {
  id: string;
  /** 场景描述 */
  description: string;
  /** 张力等级 0-10，>=7 视为高张力场景 */
  tension: number;
  /** 场景字数 */
  wordCount?: number;
  /** 是否是战斗/对抗场景 */
  isCombat?: boolean;
}

/**
 * 章节大纲
 */
export interface ChapterOutline {
  /** 章节 ID */
  id: string;
  /** 章节标题 */
  title: string;
  /** 场景列表 */
  scenes: SceneInfo[];
  /** 章节总字数 */
  totalWordCount?: number;
}

/**
 * 场景断裂处理器
 *
 * 职责：
 * 1. 规划呼吸点位置（在高张力场景之后）
 * 2. 生成呼吸段文本
 * 3. 在适当位置插入呼吸段
 */
export class SceneBreaker {
  private profile: HumanityProfile;

  constructor(profile: HumanityProfile) {
    this.profile = profile;
  }

  /**
   * 根据章节大纲，规划呼吸点位置
   *
   * @param outline 章节大纲
   * @returns 呼吸点列表
   */
  planBreathingPoints(outline: ChapterOutline): BreathingPoint[] {
    const points: BreathingPoint[] = [];
    const { scenes } = outline;

    // 规则1：每个高张力场景（tension >= 7）之后至少有一个呼吸点
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.tension >= 7) {
        // 检查下一个场景是否是低张力的
        const nextScene = scenes[i + 1];
        if (!nextScene || nextScene.tension >= 5) {
          // 下一个场景张力也很高，需要插入呼吸点
          points.push({
            afterScene: scene.id,
            type: this.pickBreathingType(scene),
            priority: 1,
          });
        }
      }
    }

    // 规则2：整章至少有一个纯呼吸段
    const totalWordCount = outline.totalWordCount || this.estimateWordCount(scenes);
    if (points.length === 0) {
      // 如果没有任何高张力场景，就在中间插入一个
      const middleScene = scenes[Math.floor(scenes.length / 2)] || scenes[0];
      points.push({
        afterScene: middleScene.id,
        type: "pure-breathing",
        priority: 0,
      });
    }

    // 规则3：章节总字数 > 3000 字时，至少2-3个呼吸点
    if (totalWordCount > 3000 && points.length < 2) {
      // 在章节后半段找一个合适的场景插入
      const laterScene = scenes[Math.floor(scenes.length * 0.6)] || scenes[scenes.length - 1];
      if (!points.find((p) => p.afterScene === laterScene.id)) {
        points.push({
          afterScene: laterScene.id,
          type: "internal-wander",
          priority: 0,
        });
      }
    }

    // 规则4：战斗场景之后必须有呼吸段
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (scene.isCombat) {
        // 战斗场景之后必须有呼吸段
        if (!points.find((p) => p.afterScene === scene.id)) {
          points.push({
            afterScene: scene.id,
            type: "physical-action",
            priority: 2, // 高优先级
          });
        }
      }
    }

    // 按优先级排序
    return points.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 生成呼吸段文本
   *
   * @param point 呼吸点
   * @param context 写作上下文
   * @returns 呼吸段文本
   */
  generateBreathingText(point: BreathingPoint, context: WritingContext): string {
    // 如果是纯呼吸段，选择一个适合的默认类型
    let type: BreathingType = point.type;
    if (type === "pure-breathing") {
      type = this.pickDefaultBreathingType(context);
    }

    // 根据上下文调整呼吸段内容
    return this.adjustBreathingText(type, context);
  }

  /**
   * 在文本中插入呼吸段
   *
   * @param text 原始文本
   * @param breathingPoints 呼吸点列表
   * @param context 写作上下文
   * @returns 插入呼吸段后的文本
   */
  injectBreathingTexts(
    text: string,
    breathingPoints: BreathingPoint[],
    context: WritingContext
  ): string {
    if (breathingPoints.length === 0) {
      return text;
    }

    const paragraphs = text.split(/\n\n+/);
    let result: string[] = [];
    let pointIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i]);

      // 查找是否有呼吸点需要插入
      const sceneMatch = paragraphs[i].match(/场景[：:]?([^\n。]+)/);
      const sceneId = sceneMatch ? sceneMatch[1] : `scene-${i}`;

      while (
        pointIndex < breathingPoints.length &&
        breathingPoints[pointIndex].afterScene === sceneId
      ) {
        const point = breathingPoints[pointIndex];
        const breathingText = this.generateBreathingText(point, context);

        // 插入呼吸段（作为独立段落）
        result.push("\n" + breathingText);
        pointIndex++;
      }
    }

    return result.join("\n\n");
  }

  /**
   * 在文本中随机注入一个呼吸段
   * 用于当没有章节大纲时的简单注入
   *
   * @param text 原始文本
   * @param context 写作上下文
   * @param probability 注入概率 0-1
   * @returns 可能的注入结果
   */
  injectRandomBreathing(
    text: string,
    context: WritingContext,
    probability?: number
  ): string {
    const injectProbability =
      probability ?? this.profile.styleInjection.timeFragmentPreference;

    if (Math.random() > injectProbability) {
      return text;
    }

    // 在文本中间找一个合适的位置插入
    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length < 3) {
      return text;
    }

    // 选择中间位置插入
    const insertIndex = Math.floor(paragraphs.length / 2);
    const type = this.pickDefaultBreathingType(context);
    const breathingText = this.adjustBreathingText(type, context);

    paragraphs.splice(insertIndex, 0, breathingText);
    return paragraphs.join("\n\n");
  }

  /**
   * 在文本中注入不体面道具细节
   */
  injectUnseemlyItem(text: string, context: WritingContext): string {
    if (Math.random() > this.profile.styleInjection.unseemlyItemPreference) {
      return text;
    }

    const unseemlyDetails = [
      "桌上放着一个缺口的水杯。",
      "墙角的椅子腿有点歪，坐上去会晃。",
      "窗户的玻璃有一道裂纹，不知道是谁弄的。",
      "地上有一滩水渍，像是漏了很久。",
      "门把手上缠着一圈胶带，粘粘的。",
      "墙上有几个钉子眼，不知道挂过什么东西。",
      "桌子边缘有点毛糙，摸上去刺刺的。",
      "天花板上有一块水印，黄黄的。",
      "窗帘褪了色，边角有点破。",
      "地上散落着几张废纸，踩上去会响。",
    ];

    // 在描述环境的段落中插入
    const templates = [
      (detail: string) => `${detail}\n${this.adjustBreathingText("prop-interaction", context)}`,
      (detail: string) => `${this.adjustBreathingText("physical-action", context)}\n${detail}`,
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const detail = unseemlyDetails[Math.floor(Math.random() * unseemlyDetails.length)];

    return template(detail);
  }

  /**
   * 选择呼吸段类型
   */
  private pickBreathingType(scene: SceneInfo): BreathingType {
    const types: BreathingType[] = [
      "physical-action",
      "environment-sense",
      "internal-wander",
      "sensory-detail",
      "prop-interaction",
    ];

    // 战斗场景之后优先选择物理动作
    if (scene.isCombat) {
      return "physical-action";
    }

    // 高张力场景之后优先选择感官细节或内部游走
    if (scene.tension >= 8) {
      const tenseTypes: BreathingType[] = ["sensory-detail", "internal-wander"];
      return tenseTypes[Math.floor(Math.random() * tenseTypes.length)];
    }

    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 选择默认呼吸段类型
   */
  private pickDefaultBreathingType(context: WritingContext): BreathingType {
    const types: BreathingType[] = [
      "physical-action",
      "environment-sense",
      "internal-wander",
      "sensory-detail",
    ];

    // 如果之前已经有过身体描写，优先选择环境感知
    if (
      context.existingBodyDescriptions &&
      context.existingBodyDescriptions.length > 2
    ) {
      const filtered = types.filter((t) => t !== "physical-action");
      return filtered[Math.floor(Math.random() * filtered.length)];
    }

    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * 调整呼吸段文本，使其符合上下文
   */
  private adjustBreathingText(type: BreathingType, context: WritingContext): string {
    let text = getRandomBreathingText(type);

    // 如果有主角名称，替换通用"他"为具体名称
    if (context.protagonistName) {
      const protagonist = context.protagonistName;
      text = text.replace(/^他([，。])/gm, `${protagonist}$1`);
      text = text.replace(/^(他)(?!在|的|那|这|像)/gm, protagonist);
    }

    // 避免重复已有的身体描写
    if (context.existingBodyDescriptions && context.existingBodyDescriptions.length > 0) {
      for (const existing of context.existingBodyDescriptions) {
        if (text.includes(existing)) {
          // 如果包含已有描写，替换为另一个
          return this.adjustBreathingText(type, context);
        }
      }
    }

    return text;
  }

  /**
   * 估算章节总字数
   */
  private estimateWordCount(scenes: SceneInfo[]): number {
    return scenes.reduce((sum, scene) => sum + (scene.wordCount || 500), 0);
  }

  /**
   * 更新画像（用于动态调整）
   */
  updateProfile(profile: HumanityProfile): void {
    this.profile = profile;
  }
}
