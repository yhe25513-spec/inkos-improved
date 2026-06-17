// ── 情感注入器 ────────────────────────────────────────
// 为文本注入情感元素，增强情感表达

import type { EmotionalArc, EmotionType } from "./types.js";

/**
 * 情感词汇库
 */
const EMOTION_VOCABULARY: Record<EmotionType, { words: string[]; phrases: string[] }> = {
  joy: {
    words: ["开心", "快乐", "喜悦", "欣喜", "愉快", "欢乐"],
    phrases: ["心里像吃了蜜一样", "嘴角不自觉地上扬", "脚步都轻快了许多"],
  },
  sadness: {
    words: ["难过", "悲伤", "忧伤", "心痛", "落寞"],
    phrases: ["心里像压了块石头", "眼眶湿润了", "声音有些哽咽"],
  },
  anger: {
    words: ["愤怒", "恼火", "气愤", "盛怒"],
    phrases: ["拳头攥得紧紧的", "青筋暴起", "声音都在发抖"],
  },
  fear: {
    words: ["害怕", "恐惧", "惊恐", "畏惧"],
    phrases: ["后背一阵发凉", "心跳加速", "手心冒汗"],
  },
  surprise: {
    words: ["惊讶", "震惊", "意外", "吃惊"],
    phrases: ["瞪大了眼睛", "一时没反应过来", "愣在原地"],
  },
  disgust: {
    words: ["厌恶", "反感", "嫌弃"],
    phrases: ["皱了皱眉头", "别过脸去", "胃里一阵翻涌"],
  },
  trust: {
    words: ["信任", "信赖", "放心", "安心"],
    phrases: ["心里踏实了", "松了口气", "悬着的心放下了"],
  },
  anticipation: {
    words: ["期待", "盼望", "期盼", "渴望"],
    phrases: ["心里痒痒的", "迫不及待", "盼星星盼月亮"],
  },
  love: {
    words: ["爱", "喜欢", "钟爱", "深爱"],
    phrases: ["心里暖暖的", "眼里只有他/她", "心跳漏了一拍"],
  },
  hope: {
    words: ["希望", "期盼", "渴望", "憧憬"],
    phrases: ["看到了曙光", "心里燃起了希望", "未来可期"],
  },
  despair: {
    words: ["绝望", "无助", "崩溃", "心碎"],
    phrases: ["世界都灰暗了", "万念俱灰", "心如死灰"],
  },
  nostalgia: {
    words: ["怀念", "回忆", "思念", "追忆"],
    phrases: ["仿佛回到了当年", "往事历历在目", "恍如昨日"],
  },
  excitement: {
    words: ["兴奋", "激动", "振奋", "澎湃"],
    phrases: ["热血沸腾", "心潮澎湃", "浑身充满了力量"],
  },
  tension: {
    words: ["紧张", "焦虑", "不安", "忐忑"],
    phrases: ["心提到了嗓子眼", "大气都不敢喘", "手心都是汗"],
  },
  relief: {
    words: ["释然", "轻松", "舒畅", "畅快"],
    phrases: ["如释重负", "长舒一口气", "整个人都轻松了"],
  },
  bittersweet: {
    words: ["苦涩", "酸楚", "感慨", "唏嘘"],
    phrases: ["五味杂陈", "百感交集", "哭笑不得"],
  },
};

/**
 * 情感注入器
 */
export class EmotionInjector {
  /**
   * 增强章节的情感表达
   */
  async enhanceChapter(
    content: string,
    arc: EmotionalArc,
    chapterNumber: number,
  ): Promise<string> {
    const chapterInfo = arc.chapters.find((c) => c.chapterNumber === chapterNumber);
    if (!chapterInfo) return content;

    const paragraphs = content.split(/\n\n+/);
    const enhanced: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (paragraph.trim().length === 0) {
        enhanced.push(paragraph);
        continue;
      }

      // 在30%的段落中注入情感（避免过度）
      if (Math.random() < 0.3) {
        enhanced.push(this.injectEmotion(paragraph, chapterInfo.primaryEmotion, chapterInfo.intensity));
      } else {
        enhanced.push(paragraph);
      }
    }

    return enhanced.join("\n\n");
  }

  /**
   * 为段落注入情感
   */
  private injectEmotion(
    paragraph: string,
    emotion: EmotionType,
    intensity: number,
  ): string {
    const vocabulary = EMOTION_VOCABULARY[emotion];
    if (!vocabulary) return paragraph;

    // 根据强度选择注入方式
    if (intensity >= 7) {
      // 高强度：添加情感词汇 + 五感描写
      return this.injectWithSensory(paragraph, vocabulary, intensity);
    } else if (intensity >= 4) {
      // 中强度：添加情感词汇
      return this.injectWithWords(paragraph, vocabulary);
    } else {
      // 低强度：轻微调整
      return this.injectSubtle(paragraph, vocabulary);
    }
  }

  /**
   * 注入情感词汇 + 五感描写（高强度）
   */
  private injectWithSensory(
    paragraph: string,
    vocabulary: { words: string[]; phrases: string[] },
    intensity: number,
  ): string {
    const sentences = paragraph.split(/(?<=[。！？])\s*/);
    const enhanced: string[] = [];

    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue;

      // 在50%的句子中添加情感短语
      if (Math.random() < 0.5 && vocabulary.phrases.length > 0) {
        const phrase = vocabulary.phrases[Math.floor(Math.random() * vocabulary.phrases.length)];
        enhanced.push(`${sentence.trim()}${phrase}。`);
      } else {
        enhanced.push(sentence.trim());
      }
    }

    return enhanced.join("");
  }

  /**
   * 注入情感词汇（中强度）
   */
  private injectWithWords(
    paragraph: string,
    vocabulary: { words: string[]; phrases: string[] },
  ): string {
    const sentences = paragraph.split(/(?<=[。！？])\s*/);
    const enhanced: string[] = [];

    for (const sentence of sentences) {
      if (sentence.trim().length === 0) continue;

      // 在30%的句子中添加情感词汇
      if (Math.random() < 0.3 && vocabulary.words.length > 0) {
        const word = vocabulary.words[Math.floor(Math.random() * vocabulary.words.length)];
        enhanced.push(`（${word}）${sentence.trim()}`);
      } else {
        enhanced.push(sentence.trim());
      }
    }

    return enhanced.join("");
  }

  /**
   * 轻微注入（低强度）
   */
  private injectSubtle(
    paragraph: string,
    vocabulary: { words: string[]; phrases: string[] },
  ): string {
    // 仅在10%的段落中添加轻微情感标记
    if (Math.random() < 0.1 && vocabulary.words.length > 0) {
      const word = vocabulary.words[Math.floor(Math.random() * vocabulary.words.length)];
      return `${paragraph}（${word}）`;
    }
    return paragraph;
  }
}
