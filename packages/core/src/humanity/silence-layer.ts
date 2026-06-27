// ── 沉默层注入器（SilenceLayerInjector） ───────────────────
// 把显性情绪描写替换为动作暗示，减少"说明式写作"

import type { HumanityProfile, WritingContext } from "../models/humanity-profile.js";
import { SILENCE_REPLACEMENTS, getRandomTemplate } from "./templates.js";

/**
 * 沉默层注入器
 *
 * 职责：
 * 1. 将显性情绪描写替换为动作暗示
 * 2. 在对话中注入未完成的话语
 * 3. 在章节末尾注入沉默切
 */
export class SilenceLayerInjector {
  private profile: HumanityProfile;

  constructor(profile: HumanityProfile) {
    this.profile = profile;
  }

  /**
   * 在文本中注入沉默层
   *
   * @param text 原始文本
   * @param context 写作上下文
   * @returns 注入沉默层后的文本
   */
  injectSilence(text: string, context?: WritingContext): string {
    // 检查是否启用沉默层
    if (this.profile.styleInjection.silenceLayerPreference < 0.1) {
      return text;
    }

    let result = text;
    let injectionCount = 0;
    const maxInjections = Math.ceil(
      text.length / 1000 * this.profile.styleInjection.silenceLayerPreference * 2
    );

    // 规则1：将显性情绪描写替换为动作暗示（15%概率）
    result = this.replaceExplicitEmotions(result, maxInjections);

    // 规则2：在对话中注入未完成的话语（如果概率允许）
    if (Math.random() < this.profile.styleInjection.dialogueInterruptFrequency * 2) {
      result = this.injectUnfinishedDialogue(result);
    }

    // 规则3：在适当位置注入沉默（只对短段落操作）
    if (Math.random() < this.profile.styleInjection.silenceLayerPreference * 0.5) {
      result = this.injectSilenceAction(result);
    }

    return result;
  }

  /**
   * 将显性情绪描写替换为动作暗示
   */
  private replaceExplicitEmotions(text: string, maxInjections: number): string {
    let result = text;
    let count = 0;

    for (const rule of SILENCE_REPLACEMENTS) {
      if (count >= maxInjections) break;

      // 找到所有匹配
      const matches = result.match(rule.pattern);
      if (!matches) continue;

      for (const match of matches) {
        if (count >= maxInjections) break;

        // 15% 概率替换
        if (Math.random() < 0.15) {
          const replacement = getRandomTemplate(rule.replacements);
          result = result.replace(match, replacement);
          count++;
        }
      }
    }

    return result;
  }

  /**
   * 在对话中注入未完成的话语
   */
  private injectUnfinishedDialogue(text: string): string {
    // 查找对话句子
    const dialoguePattern = /"[^"]*"/g;
    const dialogues = text.match(dialoguePattern);

    if (!dialogues || dialogues.length === 0) {
      return text;
    }

    // 选择一个对话注入未完成
    const targetDialogue = dialogues[Math.floor(Math.random() * dialogues.length)];

    // 未完成对话模板
    const unfinishedTemplates = [
      (speaker: string, content: string) =>
        `"${content}——"${speaker}顿了一下，"算了，没什么。"`,
      (speaker: string, content: string) =>
        `"${content}……"${speaker}没有说下去。`,
      (speaker: string, content: string) =>
        `"${content}"${speaker}说到一半，声音低了下去。`,
      (speaker: string, content: string) =>
        `"${content}"${speaker}张了张嘴，又闭上了。`,
      (speaker: string, content: string) =>
        `"${content}"${speaker}欲言又止。`,
    ];

    const template = unfinishedTemplates[Math.floor(Math.random() * unfinishedTemplates.length)];

    // 提取对话内容和可能的说话者
    const contentMatch = targetDialogue.match(/"([^"]+)"/);
    if (!contentMatch) return text;

    const content = contentMatch[1];
    // 尝试找说话者
    const beforeDialogue = text.substring(
      Math.max(0, text.indexOf(targetDialogue) - 50),
      text.indexOf(targetDialogue)
    );
    const speaker = this.extractSpeaker(beforeDialogue) || "他";

    const unfinished = template(speaker, content);
    return text.replace(targetDialogue, unfinished);
  }

  /**
   * 提取说话者
   */
  private extractSpeaker(text: string): string | null {
    // 常见说话者标记
    const patterns = [
      /([^，,。\s]+)说/,
      /([^，,。\s]+)道/,
      /([^，,。\s]+)回答/,
      /([^，,。\s]+)问/,
      /([^，,。\s]+)喊/,
      /([^，,。\s]+)叫/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 注入沉默动作
   * 在短段落中注入暗示性沉默
   */
  private injectSilenceAction(text: string): string {
    const paragraphs = text.split(/\n\n+/);

    // 找到较短的段落（暗示性沉默更适合短段落）
    const shortParagraphIndices: number[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].length > 30 && paragraphs[i].length < 150) {
        shortParagraphIndices.push(i);
      }
    }

    if (shortParagraphIndices.length === 0) {
      return text;
    }

    // 选择一个短段落注入沉默
    const targetIndex =
      shortParagraphIndices[Math.floor(Math.random() * shortParagraphIndices.length)];
    const targetParagraph = paragraphs[targetIndex];

    // 检查是否已经有沉默暗示
    if (
      targetParagraph.includes("很久") ||
      targetParagraph.includes("没有说话") ||
      targetParagraph.includes("沉默")
    ) {
      return text;
    }

    // 沉默动作模板
    const silenceActions = [
      "他站了很久，没有说话。",
      "没有人说话。",
      "一时间，没有人开口。",
      "他张了张嘴，又闭上了。",
      "他把想说的话咽了回去。",
      "她没有接话。",
      "沉默了一会儿。",
      "他看着窗外，没有说话。",
      "她低着头，没有看他。",
      "他盯着地面，不知道在想什么。",
    ];

    const silenceAction =
      silenceActions[Math.floor(Math.random() * silenceActions.length)];

    // 在段落末尾添加沉默动作
    paragraphs[targetIndex] = targetParagraph.trimEnd() + "\n" + silenceAction;

    return paragraphs.join("\n\n");
  }

  /**
   * 在章节末尾注入沉默切
   * 在关键时刻直接切到下一幕，不解释
   */
  injectSilenceCut(text: string): string {
    if (Math.random() > this.profile.styleInjection.silenceLayerPreference * 0.3) {
      return text;
    }

    const paragraphs = text.split(/\n\n+/);
    if (paragraphs.length < 5) {
      return text;
    }

    // 沉默切模板
    const silenceCuts = [
      // 直接切到第二天
      (p: string) =>
        p +
        "\n\n第二天。",
      // 直接切到另一个场景
      (p: string) =>
        p +
        "\n\n同一时间。",
      // 直接切到想法
      (p: string) =>
        p +
        "\n\n他一直在想这件事。",
      // 直接切到沉默
      (p: string) =>
        p +
        "\n\n剩下的，只有沉默。",
      // 直接切到行动
      (p: string) =>
        p +
        "\n\n他转身走了出去。",
    ];

    const template =
      silenceCuts[Math.floor(Math.random() * silenceCuts.length)];

    // 在倒数第二段末尾添加沉默切
    const lastParagraphIndex = paragraphs.length - 1;
    const lastParagraph = paragraphs[lastParagraphIndex];

    // 如果最后一段已经很长，就不加
    if (lastParagraph.length > 100) {
      return text;
    }

    paragraphs[lastParagraphIndex] = template(lastParagraph);

    return paragraphs.join("\n\n");
  }

  /**
   * 替换解释为暗示
   * 将"A是B"这种解释性语句替换为具体的暗示
   */
  replaceExplanationWithImplication(text: string): string {
    // 解释性语句模式
    const explanationPatterns: Array<{
      pattern: RegExp;
      implications: string[];
    }> = [
      // 他很孤独
      {
        pattern: /他很孤独/g,
        implications: [
          "他一个人在房间里坐了很久。",
          "他看着窗外，窗外的路灯一盏盏亮了又灭。",
          "他的影子在墙上拖得很长。",
        ],
      },
      // 她很孤独
      {
        pattern: /她很孤独/g,
        implications: [
          "她靠在窗边，看着外面的雨。",
          "她把音乐开得很大声。",
          "她缩在沙发角落里，抱着一只旧枕头。",
        ],
      },
      // 他很无奈
      {
        pattern: /他很无奈/g,
        implications: [
          "他叹了口气，摇了摇头。",
          "他什么也没说。",
          "他看着天花板，不知道在想什么。",
        ],
      },
      // 她很无奈
      {
        pattern: /她很无奈/g,
        implications: [
          "她只能笑笑。",
          "她把想说的话咽了回去。",
          "她低着头，不看任何人。",
        ],
      },
      // 他很期待
      {
        pattern: /他很期待/g,
        implications: [
          "他的眼睛亮了一下。",
          "他忍不住往门口看了好几眼。",
          "他攥了攥拳头，又松开。",
        ],
      },
      // 她很期待
      {
        pattern: /她很期待/g,
        implications: [
          "她的嘴角忍不住翘起来。",
          "她把礼物盒拿起来又放下，放下又拿起来。",
          "她的手指在裙角上轻轻绞着。",
        ],
      },
    ];

    let result = text;

    for (const rule of explanationPatterns) {
      const match = result.match(rule.pattern);
      if (match && Math.random() < 0.2) {
        const implication =
          rule.implications[Math.floor(Math.random() * rule.implications.length)];
        result = result.replace(rule.pattern, implication);
      }
    }

    return result;
  }

  /**
   * 更新画像
   */
  updateProfile(profile: HumanityProfile): void {
    this.profile = profile;
  }
}
