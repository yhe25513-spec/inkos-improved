// ── 真人样本分析器 ──────────────────────────────────────
// 从真人小说样本中提取12维写作指纹

import type {
  HumanityFingerprint,
  WritingContext,
} from "../models/humanity-profile.js";

/**
 * 犹豫词列表（用于检测文本中的犹豫表达）
 */
const HESITATION_WORDS = [
  "好像", "大概", "似乎", "可能", "也许", "差不多", "估计", "或许",
  "应该", "说不定", "好像", "仿佛", "似乎", "大约", "左右", "大体",
  "基本上", "总体来说", "看起来", "看上去", "看来", "感觉", "觉得",
];

/**
 * 粗话/口语词汇列表
 */
const COLLOQUIAL_WORDS = [
  "妈的", "操", "靠", "草", "艹", "尼玛", "鬼知道", "见了鬼",
  "见鬼了", "日", "滚", "老子", "老娘", "丫的", "他妈的", "我操",
  "卧槽", "我靠", "我艹", "妈的", "麻了", "绝了", "真绝",
];

/**
 * 身体部位词汇列表
 */
const BODY_PARTS = [
  "手", "脚", "肩", "背", "脸", "眼", "眉", "唇", "指", "腿",
  "头", "耳", "鼻", "嘴", "牙", "胸", "腰", "腹", "心", "胃",
  "喉咙", "脖子", "下巴", "额头", "太阳穴", "掌心", "指尖",
];

/**
 * 自我矛盾词对（用于检测文本中的自我矛盾表达）
 */
const SELF_CONTRADICTION_PATTERNS = [
  { positive: /不(.+)怕/g, negative: /怕/g },
  { positive: /不(.+)在乎/g, negative: /在乎/g },
  { positive: /不(.+)在意/g, negative: /在意/g },
  { positive: /不(.+)想/g, negative: /想/g },
  { positive: /不(.+)喜欢/g, negative: /喜欢/g },
  { positive: /不(.+)爱/g, negative: /爱/g },
];

/**
 * 不体面道具关键词
 */
const UNSEEMLY_ITEM_KEYWORDS = [
  "缺口", "裂缝", "磨损", "旧", "破", "脏", "污渍", "褪色",
  "掉漆", "生锈", "卷边", "缺角", "断了", "裂开", "沾了",
  "皱巴巴", "毛边", "起毛", "划痕", "缺口", "缺损",
];

/**
 * 视角偏移标记（用于检测叙事视角变化）
 */
const PERSPECTIVE_SHIFT_MARKERS = [
  "他/她想", "他/她觉得", "他/她知道", "他/她明白",
  "从他的角度看", "从她的角度看", "在他/她看来",
];

/**
 * 真人样本分析器
 * 分析文本样本，提取12维写作指纹
 */
export class SampleAnalyzer {
  /**
   * 分析多个样本，返回综合的写作指纹
   */
  async analyze(samples: string[]): Promise<HumanityFingerprint> {
    if (samples.length === 0) {
      return this.getDefaultFingerprint();
    }

    const fingerprints = samples.map((s) => this.analyzeSingle(s));
    return this.aggregateFingerprints(fingerprints);
  }

  /**
   * 分析单个样本文本
   */
  private analyzeSingle(text: string): HumanityFingerprint {
    const sentences = this.splitSentences(text);
    const paragraphs = this.splitParagraphs(text);
    const totalText = samplesFlat([text]);
    const charCount = totalText.length;

    return {
      // ── 句法维度 ────────────────────────────────────────
      sentenceLengthStd: this.calculateSentenceLengthStd(sentences),
      burstIndex: this.calculateBurstIndex(sentences),
      exclamationDensity: this.calculateExclamationDensity(totalText, charCount),
      questionDensity: this.calculateQuestionDensity(totalText, charCount),
      hesitationWordDensity: this.calculateHesitationWordDensity(totalText, charCount),

      // ── 叙事维度 ────────────────────────────────────────
      dialogueInterruptRate: this.calculateDialogueInterruptRate(totalText),
      timeFragmentRatio: this.calculateTimeFragmentRatio(paragraphs, text),
      bodyPartDensity: this.calculateBodyPartDensity(totalText, charCount),
      colloquialDensity: this.calculateColloquialDensity(totalText, charCount),
      perspectiveShiftRate: this.calculatePerspectiveShiftRate(totalText, paragraphs.length),

      // ── 角色维度 ────────────────────────────────────────
      selfContradictionRate: this.calculateSelfContradictionRate(totalText, sentences.length),
      unseemlyItemRate: this.calculateUnseemlyItemRate(totalText, paragraphs.length),
    };
  }

  /**
   * 计算句子长度标准差
   */
  private calculateSentenceLengthStd(sentences: string[]): number {
    if (sentences.length < 2) return 0;
    const lengths = sentences.map((s) => s.length).filter((l) => l > 0);
    if (lengths.length < 2) return 0;
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    return Math.sqrt(variance);
  }

  /**
   * 计算突发性指数
   * 长句后紧跟短句的概率
   */
  private calculateBurstIndex(sentences: string[]): number {
    if (sentences.length < 2) return 0;
    let burstCount = 0;
    for (let i = 1; i < sentences.length; i++) {
      const prevLen = sentences[i - 1].length;
      const currLen = sentences[i].length;
      if (prevLen === 0 || currLen === 0) continue;
      const ratio = Math.max(prevLen, currLen) / Math.min(prevLen, currLen);
      // 句子长度比超过 2.5 视为"突发"
      if (ratio > 2.5) {
        burstCount++;
      }
    }
    return burstCount / (sentences.length - 1);
  }

  /**
   * 计算感叹号密度（每千字）
   */
  private calculateExclamationDensity(text: string, charCount: number): number {
    if (charCount === 0) return 0;
    const count = (text.match(/[！!]/g) || []).length;
    return (count / charCount) * 1000;
  }

  /**
   * 计算问号密度（每千字）
   */
  private calculateQuestionDensity(text: string, charCount: number): number {
    if (charCount === 0) return 0;
    const count = (text.match(/[？？?]/g) || []).length;
    return (count / charCount) * 1000;
  }

  /**
   * 计算犹豫词密度（每千字）
   */
  private calculateHesitationWordDensity(text: string, charCount: number): number {
    if (charCount === 0) return 0;
    let count = 0;
    for (const word of HESITATION_WORDS) {
      const regex = new RegExp(word, "g");
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return (count / charCount) * 1000;
  }

  /**
   * 计算对话打断率
   */
  private calculateDialogueInterruptRate(text: string): number {
    // 统计对话行数（包含引号的句子）
    const dialogueMatches = text.match(/"[^"]*"/g) || [];
    if (dialogueMatches.length === 0) return 0;

    // 统计被打断的对话（包含 —— 或 ... 或 …）
    let interruptedCount = 0;
    for (const dialogue of dialogueMatches) {
      if (dialogue.includes("——") || dialogue.includes("...") || dialogue.includes("…")) {
        interruptedCount++;
      }
    }
    return interruptedCount / dialogueMatches.length;
  }

  /**
   * 计算时间碎片占比
   * 不推动剧情的过渡段落占比
   */
  private calculateTimeFragmentRatio(paragraphs: string[], fullText: string): number {
    if (paragraphs.length === 0) return 0;

    // 简化判断：段落较短（<50字）且主要是描写性文字（非对话/动作）
    let timeFragmentCount = 0;
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length === 0) continue;
      if (trimmed.length < 50) {
        // 检查是否主要是环境/状态描写
        const hasDialogue = /[""][^""]*[""]/.test(trimmed);
        const hasAction = /^(他|她|它|我).{0,10}(走|跑|坐|站|躺|停)/.test(trimmed);
        if (!hasDialogue && !hasAction) {
          timeFragmentCount++;
        }
      }
    }
    return timeFragmentCount / paragraphs.length;
  }

  /**
   * 计算身体部位词汇密度（每千字）
   */
  private calculateBodyPartDensity(text: string, charCount: number): number {
    if (charCount === 0) return 0;
    let count = 0;
    for (const part of BODY_PARTS) {
      const regex = new RegExp(part, "g");
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return (count / charCount) * 1000;
  }

  /**
   * 计算粗话/口语密度（每千字）
   */
  private calculateColloquialDensity(text: string, charCount: number): number {
    if (charCount === 0) return 0;
    let count = 0;
    for (const word of COLLOQUIAL_WORDS) {
      const regex = new RegExp(word, "g");
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return (count / charCount) * 1000;
  }

  /**
   * 计算视角偏移率
   */
  private calculatePerspectiveShiftRate(text: string, paragraphCount: number): number {
    if (paragraphCount === 0) return 0;
    let shiftCount = 0;
    for (const marker of PERSPECTIVE_SHIFT_MARKERS) {
      const regex = new RegExp(marker, "g");
      const matches = text.match(regex);
      if (matches) {
        shiftCount += matches.length;
      }
    }
    return shiftCount / paragraphCount;
  }

  /**
   * 计算自我矛盾率
   */
  private calculateSelfContradictionRate(
    text: string,
    sentenceCount: number
  ): number {
    if (sentenceCount === 0) return 0;
    let contradictionCount = 0;
    for (const pattern of SELF_CONTRADICTION_PATTERNS) {
      // 检测"不+动词"后面是否紧跟"动词"的否定或相反表达
      const positiveMatches = text.match(pattern.positive) || [];
      contradictionCount += positiveMatches.length;
    }
    return Math.min(1, contradictionCount / sentenceCount);
  }

  /**
   * 计算不体面道具率
   */
  private calculateUnseemlyItemRate(text: string, paragraphCount: number): number {
    if (paragraphCount === 0) return 0;
    let itemCount = 0;
    for (const keyword of UNSEEMLY_ITEM_KEYWORDS) {
      const regex = new RegExp(keyword, "g");
      const matches = text.match(regex);
      if (matches) {
        itemCount += matches.length;
      }
    }
    // 归一化到段落数
    return Math.min(1, itemCount / paragraphCount);
  }

  /**
   * 聚合多个指纹为综合指纹
   */
  private aggregateFingerprints(fingerprints: HumanityFingerprint[]): HumanityFingerprint {
    if (fingerprints.length === 1) return fingerprints[0];

    const count = fingerprints.length;
    return {
      sentenceLengthStd:
        fingerprints.reduce((sum, fp) => sum + fp.sentenceLengthStd, 0) / count,
      burstIndex:
        fingerprints.reduce((sum, fp) => sum + fp.burstIndex, 0) / count,
      exclamationDensity:
        fingerprints.reduce((sum, fp) => sum + fp.exclamationDensity, 0) / count,
      questionDensity:
        fingerprints.reduce((sum, fp) => sum + fp.questionDensity, 0) / count,
      hesitationWordDensity:
        fingerprints.reduce((sum, fp) => sum + fp.hesitationWordDensity, 0) / count,
      dialogueInterruptRate:
        fingerprints.reduce((sum, fp) => sum + fp.dialogueInterruptRate, 0) / count,
      timeFragmentRatio:
        fingerprints.reduce((sum, fp) => sum + fp.timeFragmentRatio, 0) / count,
      bodyPartDensity:
        fingerprints.reduce((sum, fp) => sum + fp.bodyPartDensity, 0) / count,
      colloquialDensity:
        fingerprints.reduce((sum, fp) => sum + fp.colloquialDensity, 0) / count,
      perspectiveShiftRate:
        fingerprints.reduce((sum, fp) => sum + fp.perspectiveShiftRate, 0) / count,
      selfContradictionRate:
        fingerprints.reduce((sum, fp) => sum + fp.selfContradictionRate, 0) / count,
      unseemlyItemRate:
        fingerprints.reduce((sum, fp) => sum + fp.unseemlyItemRate, 0) / count,
    };
  }

  /**
   * 获取默认指纹（用于冷启动）
   */
  private getDefaultFingerprint(): HumanityFingerprint {
    return {
      sentenceLengthStd: 15,
      burstIndex: 0.12,
      exclamationDensity: 8,
      questionDensity: 5,
      hesitationWordDensity: 10,
      dialogueInterruptRate: 0.08,
      timeFragmentRatio: 0.18,
      bodyPartDensity: 12,
      colloquialDensity: 5,
      perspectiveShiftRate: 0.05,
      selfContradictionRate: 0.03,
      unseemlyItemRate: 0.02,
    };
  }

  /**
   * 分割句子
   */
  private splitSentences(text: string): string[] {
    // 按中文标点分割
    return text
      .split(/[。！？；\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * 分割段落
   */
  private splitParagraphs(text: string): string[] {
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * 合并多个样本文本
   */
  analyzeFromFiles(files: Array<{ name: string; content: string }>): Promise<HumanityFingerprint> {
    const samples = files.map((f) => f.content);
    return this.analyze(samples);
  }
}

// 辅助函数
function samplesFlat(texts: string[]): string {
  return texts.join("");
}
