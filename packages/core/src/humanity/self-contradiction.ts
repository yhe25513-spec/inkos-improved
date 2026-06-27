// ── 矛盾性行为生成器 ─────────────────────────────────
// 给主角注入"不完美"的小行为，增加角色真实感

import type {
  HumanityProfile,
  WritingContext,
} from "../models/humanity-profile.js";
import { SELF_CONTRADICTION_TEMPLATES, getRandomTemplate } from "./templates.js";

/**
 * 矛盾类型
 */
export type ContradictionType =
  | "decision-hesitation" // 犹豫后反悔
  | "say-do-mismatch"     // 言行不一
  | "detail-expose"       // 细节暴露
  | "opposite-action";    // 相反的小动作

/**
 * 决定/动作对
 */
interface DecisionAction {
  decision: string;
  action: string;
  opposite?: string;
}

/**
 * 矛盾性行为生成器
 *
 * 职责：
 * 1. 在决定时刻注入犹豫和反悔
 * 2. 注入言行不一的小细节
 * 3. 用细节暴露主角的真实情绪
 * 4. 注入相反的小动作
 */
export class SelfContradictionGenerator {
  private profile: HumanityProfile;

  constructor(profile: HumanityProfile) {
    this.profile = profile;
  }

  /**
   * 在文本中注入矛盾性行为
   *
   * @param text 原始文本
   * @param context 写作上下文
   * @returns 注入矛盾性行为后的文本
   */
  injectContradictions(
    text: string,
    context: WritingContext
  ): string {
    // 检查是否启用
    if (this.profile.styleInjection.protagonistFlawPreference < 0.05) {
      return text;
    }

    const pref = this.profile.styleInjection.protagonistFlawPreference;
    let result = text;

    // 规则1：犹豫后反悔（8%概率）
    if (Math.random() < pref * 0.8) {
      result = this.injectDecisionHesitation(result, context);
    }

    // 规则2：言行不一（12%概率）
    if (Math.random() < pref * 1.2) {
      result = this.injectSayDoMismatch(result);
    }

    // 规则3：相反的小动作（10%概率）
    if (Math.random() < pref) {
      result = this.injectOppositeAction(result, context);
    }

    return result;
  }

  /**
   * 注入犹豫后反悔
   * 在决定时刻，主角先犹豫然后做相反的选择
   */
  private injectDecisionHesitation(
    text: string,
    context: WritingContext
  ): string {
    // 常见的决定/动作对
    const decisionActionPairs: DecisionAction[] = [
      { decision: "往左走", action: "往左走", opposite: "往右拐了" },
      { decision: "留下来", action: "留下来", opposite: "还是走了" },
      { decision: "开口说话", action: "开口说话", opposite: "闭上了嘴" },
      { decision: "追上去", action: "追上去", opposite: "站在原地没动" },
      { decision: "伸手拿", action: "伸手拿", opposite: "又缩了回来" },
      { decision: "点头", action: "点头", opposite: "摇了摇头" },
      { decision: "道歉", action: "道歉", opposite: "把话咽了回去" },
      { decision: "拒绝", action: "拒绝", opposite: "还是答应了" },
      { decision: "动手", action: "动手", opposite: "收回了手" },
      { decision: "转身", action: "转身", opposite: "又转了回来" },
    ];

    // 选择一对
    const pair =
      decisionActionPairs[
        Math.floor(Math.random() * decisionActionPairs.length)
      ];

    // 生成犹豫文本
    const templates = SELF_CONTRADICTION_TEMPLATES.decisionHesitation;
    const template = getRandomTemplate(templates);

    const hesitationText = template.format(pair.decision, pair.opposite || pair.action);

    // 找到合适的位置插入
    // 优先在包含"决定""选择""犹豫"等词的句子附近插入
    const patterns = [
      /他想了想要?([，。])/,
      /他犹豫了([，。])/,
      /他不知道要?([，。])/,
      /他\(/,
      /她\(/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const insertIndex = text.indexOf(match[0]) + match[0].length;
        // 在匹配位置后插入
        const before = text.slice(0, insertIndex);
        const after = text.slice(insertIndex);
        return before + "。" + hesitationText + after;
      }
    }

    // 如果没找到合适位置，在句子中间插入
    const insertAt = Math.floor(text.length / 2);
    const sentences = text.split(/([。！？])/);
    let currentLength = 0;
    for (let i = 0; i < sentences.length; i++) {
      currentLength += sentences[i].length;
      if (currentLength > insertAt) {
        sentences[i] = sentences[i] + hesitationText;
        break;
      }
    }

    return sentences.join("");
  }

  /**
   * 注入言行不一
   * 主角嘴上说一套，实际做另一套
   */
  private injectSayDoMismatch(text: string): string {
    const templates = SELF_CONTRADICTION_TEMPLATES.sayDoMismatch;
    const mismatchText = getRandomTemplate(templates);

    // 在对话附近插入
    const dialoguePattern = /"[^"]+"/g;
    const dialogues = text.match(dialoguePattern);

    if (!dialogues || dialogues.length === 0) {
      // 如果没有对话，在句子中间插入
      return this.insertInMiddle(text, mismatchText);
    }

    // 在最后一个对话后插入
    const lastDialogue = dialogues[dialogues.length - 1];
    const insertIndex = text.lastIndexOf(lastDialogue) + lastDialogue.length;

    const before = text.slice(0, insertIndex);
    const after = text.slice(insertIndex);

    // 检查是否已经插入过类似的
    if (before.includes("但") && before.includes("说")) {
      return text;
    }

    return before + "。" + mismatchText + after;
  }

  /**
   * 注入相反的小动作
   * 主角应该做某事，但做了相反的小事
   */
  private injectOppositeAction(
    text: string,
    context: WritingContext
  ): string {
    const templates = SELF_CONTRADICTION_TEMPLATES.oppositeAction;

    // 相反动作对
    const oppositePairs = [
      ["想吃", "忍住了"],
      ["想说", "没说出口"],
      ["想动", "没动"],
      ["想笑", "忍住了"],
      ["想问", "没问"],
      ["想哭", "忍住了"],
      ["想骂", "咽了回去"],
      ["想跑", "没跑"],
      ["想回头", "忍住了"],
      ["想伸手", "又缩回来"],
    ];

    const pair = oppositePairs[Math.floor(Math.random() * oppositePairs.length)];
    const template = getRandomTemplate(templates);
    const contradictionText = template.format(pair[0], pair[1]);

    return this.insertInMiddle(text, contradictionText);
  }

  /**
   * 注入细节暴露
   * 通过小细节暗示主角的真实情绪，而非直接说出来
   */
  injectDetailExpose(text: string): string {
    const templates = SELF_CONTRADICTION_TEMPLATES.detailExpose;
    const exposeText = getRandomTemplate(templates);

    // 在对话附近插入
    const dialogues = text.match(/"[^"]+"/g);
    if (!dialogues || dialogues.length === 0) {
      return this.insertInMiddle(text, exposeText);
    }

    const firstDialogue = dialogues[0];
    const insertIndex = text.indexOf(firstDialogue) + firstDialogue.length;

    const before = text.slice(0, insertIndex);
    const after = text.slice(insertIndex);

    return before + "。" + exposeText + after;
  }

  /**
   * 在文本中间位置插入文本
   */
  private insertInMiddle(original: string, insert: string): string {
    const paragraphs = original.split(/\n\n+/);
    if (paragraphs.length === 0) {
      return original;
    }

    // 在中间段落插入
    const insertIndex = Math.floor(paragraphs.length / 2);
    paragraphs[insertIndex] = paragraphs[insertIndex] + "。" + insert;

    return paragraphs.join("\n\n");
  }

  /**
   * 在决策点注入不确定性
   * 让主角的决策看起来不是100%确定的
   */
  injectDecisionUncertainty(
    text: string,
    context: WritingContext
  ): string {
    if (this.profile.styleInjection.hesitationFrequency < 0.1) {
      return text;
    }

    // 犹豫词模板
    const uncertaintyTemplates = [
      "他{},但又不确定{}。",
      "他{},但又觉得{}。",
      "{},他{}。",
      "他{},好像在考虑什么。",
      "他{},其实{}。",
    ];

    // 犹豫词
    const hesitations = [
      "停了一下",
      "犹豫了",
      "迟疑了",
      "愣了一秒",
      "脚步顿了一下",
      "手停在半空中",
      "话到嘴边又咽了回去",
    ];

    // 不确定的内容
    const uncertainties = [
      "这样对不对",
      "是不是应该这样",
      "这样做后果会怎样",
      "这样做好不好",
      "这样行不行",
      "这样会不会有问题",
      "这样做是不是太冲动了",
    ];

    const template =
      uncertaintyTemplates[
        Math.floor(Math.random() * uncertaintyTemplates.length)
      ];
    const hesitation =
      hesitations[Math.floor(Math.random() * hesitations.length)];
    const uncertainty =
      uncertainties[Math.floor(Math.random() * uncertainties.length)];

    const uncertaintyText = template.format(hesitation, uncertainty);

    // 在有决策行为的句子附近插入
    const decisionPatterns = [
      /他\(/,
      /她\(/,
      /然后/,
      /于是/,
      /最后/,
    ];

    for (const pattern of decisionPatterns) {
      const match = text.match(pattern);
      if (match) {
        const insertIndex = text.indexOf(match[0]) + match[0].length;
        const before = text.slice(0, insertIndex);
        const after = text.slice(insertIndex);
        return before + "，" + uncertaintyText + after;
      }
    }

    return text;
  }

  /**
   * 生成主角的内心独白矛盾
   * 让主角自己意识到自己的矛盾
   */
  generateInnerContradiction(context?: WritingContext): string {
    const templates = [
      "他{},但他不知道{}。",
      "他{},但他不确定{}。",
      "他{},他自己也说不清楚{}。",
      "{},他自己都搞不懂自己。",
    ];

    // 内心矛盾对
    const innerContradictions = [
      ["想留下来", "为什么想留下来"],
      ["想离开", "为什么想离开"],
      ["在乎", "为什么在乎"],
      ["害怕", "在害怕什么"],
      ["担心", "在担心什么"],
      ["期待", "在期待什么"],
      ["后悔", "后悔什么"],
      ["想念", "在想念谁"],
    ];

    const pair =
      innerContradictions[
        Math.floor(Math.random() * innerContradictions.length)
      ];
    const template = templates[Math.floor(Math.random() * templates.length)];

    return template.format(pair[0], pair[1]);
  }

  /**
   * 更新画像
   */
  updateProfile(profile: HumanityProfile): void {
    this.profile = profile;
  }
}
