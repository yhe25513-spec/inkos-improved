// ── 情感分析器 ────────────────────────────────────────
// 分析文本的情感内容和强度

import type { EmotionType } from "./types.js";

/**
 * 情感词典
 */
const EMOTION_WORDS: Record<EmotionType, string[]> = {
  joy: ["开心", "快乐", "高兴", "喜悦", "欢喜", "愉快", "欢乐", "欣喜", "欣慰", "满足"],
  sadness: ["伤心", "难过", "悲伤", "忧伤", "哀愁", "心痛", "落寞", "惆怅", "凄凉", "悲凉"],
  anger: ["愤怒", "生气", "恼火", "暴怒", "愤恨", "怒火", "气愤", "恼怒", "盛怒", "狂怒"],
  fear: ["害怕", "恐惧", "惊恐", "畏惧", "胆怯", "惊慌", "恐慌", "惧怕", "畏缩", "胆寒"],
  surprise: ["惊讶", "震惊", "意外", "吃惊", "惊叹", "愕然", "诧异", "惊奇", "惊奇", "错愕"],
  disgust: ["厌恶", "讨厌", "恶心", "反感", "嫌弃", "鄙视", "蔑视", "憎恶", "厌烦", "不屑"],
  trust: ["信任", "信赖", "放心", "安心", "踏实", "可靠", "信服", "确信", "坚信", "笃定"],
  anticipation: ["期待", "盼望", "期盼", "渴望", "向往", "憧憬", "企盼", "翘首", "等待", "期盼"],
  love: ["爱", "喜欢", "钟爱", "深爱", "挚爱", "迷恋", "倾心", "爱慕", "眷恋", "依恋"],
  hope: ["希望", "期盼", "渴望", "憧憬", "向往", "指望", "奢望", "企盼", "愿景", "曙光"],
  despair: ["绝望", "无助", "崩溃", "心碎", "万念俱灰", "心死", "无望", "黯然", "凄惨", "悲惨"],
  nostalgia: ["怀念", "回忆", "思念", "追忆", "眷念", "缅怀", "感怀", "旧日", "往昔", "当年"],
  excitement: ["兴奋", "激动", "振奋", "澎湃", "热血", "沸腾", "高昂", "亢奋", "激昂", "振奋"],
  tension: ["紧张", "焦虑", "不安", "忐忑", "惶恐", "担忧", "忧虑", "紧绷", "危机", "紧迫"],
  relief: ["释然", "轻松", "安心", "放心", "舒畅", "畅快", "如释重负", "安心", "宽慰", "松了口气"],
  bittersweet: ["苦涩", "酸楚", "五味杂陈", "百感交集", "啼笑皆非", "哭笑不得", "感慨", "唏嘘", "无奈", "遗憾"],
};

/**
 * 情感分析器
 */
export class EmotionAnalyzer {
  /**
   * 分析文本的情感内容
   */
  analyze(text: string): {
    primaryEmotion: EmotionType;
    intensity: number;
    emotionDistribution: Record<EmotionType, number>;
  } {
    const distribution = this.getEmotionDistribution(text);
    const totalScore = Object.values(distribution).reduce((a, b) => a + b, 0);

    if (totalScore === 0) {
      return {
        primaryEmotion: "joy",
        intensity: 0.5,
        emotionDistribution: distribution,
      };
    }

    // 找到主要情感
    let maxEmotion: EmotionType = "joy";
    let maxScore = 0;
    for (const [emotion, score] of Object.entries(distribution)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion as EmotionType;
      }
    }

    // 计算强度 (0-1)
    const intensity = Math.min(1, maxScore / 5);

    return {
      primaryEmotion: maxEmotion,
      intensity,
      emotionDistribution: distribution,
    };
  }

  /**
   * 获取情感分布
   */
  private getEmotionDistribution(text: string): Record<EmotionType, number> {
    const distribution: Record<EmotionType, number> = {} as any;

    for (const [emotion, words] of Object.entries(EMOTION_WORDS)) {
      let score = 0;
      for (const word of words) {
        const regex = new RegExp(word, "g");
        const matches = text.match(regex);
        if (matches) {
          score += matches.length;
        }
      }
      distribution[emotion as EmotionType] = score;
    }

    return distribution;
  }

  /**
   * 建议情感增强点
   */
  suggestEnhancementPoints(
    paragraphs: string[],
    targetEmotion: EmotionType,
    targetIntensity: number,
  ): Array<{ paragraphIndex: number; suggestion: string }> {
    const suggestions: Array<{ paragraphIndex: number; suggestion: string }> = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const analysis = this.analyze(paragraphs[i]);

      // 如果当前段落情感强度低于目标
      if (analysis.intensity < targetIntensity * 0.7) {
        const suggestion = this.generateEnhancementSuggestion(
          paragraphs[i],
          targetEmotion,
          targetIntensity,
        );
        suggestions.push({ paragraphIndex: i, suggestion });
      }
    }

    return suggestions;
  }

  /**
   * 生成增强建议
   */
  private generateEnhancementSuggestion(
    text: string,
    targetEmotion: EmotionType,
    targetIntensity: number,
  ): string {
    const emotionName = this.getEmotionName(targetEmotion);
    const intensityDesc = targetIntensity > 0.7 ? "强烈" : targetIntensity > 0.4 ? "适中" : "轻微";

    return `建议增强${intensityDesc}的${emotionName}情感。可以通过添加情感词汇、五感描写或内心独白来实现。`;
  }

  /**
   * 获取情感中文名
   */
  private getEmotionName(emotion: EmotionType): string {
    const names: Record<EmotionType, string> = {
      joy: "快乐",
      sadness: "悲伤",
      anger: "愤怒",
      fear: "恐惧",
      surprise: "惊讶",
      disgust: "厌恶",
      trust: "信任",
      anticipation: "期待",
      love: "爱",
      hope: "希望",
      despair: "绝望",
      nostalgia: "怀旧",
      excitement: "兴奋",
      tension: "紧张",
      relief: "释然",
      bittersweet: "苦乐参半",
    };
    return names[emotion] || emotion;
  }
}
