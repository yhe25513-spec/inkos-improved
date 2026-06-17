// ── 情感曲线规划器 ────────────────────────────────────
// 根据故事结构设计情感曲线

import type { EmotionalArc, EmotionalChapter, EmotionType, StoryStructure } from "./types.js";

/**
 * 情感曲线规划器
 */
export class ArcPlanner {
  /**
   * 规划情感曲线
   */
  planArc(
    bookId: string,
    structure: StoryStructure,
    genre: string,
  ): EmotionalArc {
    const chapters = this.designCurve(structure, genre);

    return {
      id: `arc-${bookId}-${Date.now()}`,
      bookId,
      chapters,
      overallTheme: structure.theme,
      climaxChapter: structure.climaxChapter,
      resolutionChapter: structure.resolutionChapter,
    };
  }

  /**
   * 根据类型设计情感曲线
   */
  private designCurve(structure: StoryStructure, genre: string): EmotionalChapter[] {
    const genreTemplates: Record<string, (s: StoryStructure) => EmotionalChapter[]> = {
      xuanhuan: (s) => this.designXuanhuanArc(s),
      urban: (s) => this.designUrbanArc(s),
      romance: (s) => this.designRomanceArc(s),
      mystery: (s) => this.designMysteryArc(s),
    };

    const designer = genreTemplates[genre] ?? genreTemplates.urban;
    return designer(structure);
  }

  /**
   * 玄幻情感曲线：热血-挫折-成长-高潮
   */
  private designXuanhuanArc(structure: StoryStructure): EmotionalChapter[] {
    const { totalChapters, climaxChapter } = structure;
    const chapters: EmotionalChapter[] = [];

    for (let i = 1; i <= totalChapters; i++) {
      const progress = i / totalChapters;
      let emotion: EmotionType;
      let intensity: number;
      let turningPoint = false;

      if (i <= totalChapters * 0.2) {
        // 开篇：期待+兴奋
        emotion = "anticipation";
        intensity = 4 + progress * 2;
      } else if (i <= totalChapters * 0.4) {
        // 发展：兴奋+紧张
        emotion = "excitement";
        intensity = 5 + (i / totalChapters) * 3;
      } else if (i === climaxChapter) {
        // 高潮：紧张+兴奋
        emotion = "tension";
        intensity = 10;
        turningPoint = true;
      } else if (i <= totalChapters * 0.8) {
        // 挫折：悲伤+紧张
        emotion = "sadness";
        intensity = 6;
      } else {
        // 结局：希望+快乐
        emotion = "hope";
        intensity = 7 + (i - totalChapters * 0.8) / (totalChapters * 0.2) * 3;
      }

      chapters.push({
        chapterNumber: i,
        primaryEmotion: emotion,
        intensity: Math.min(10, Math.max(1, intensity)),
        subEmotions: this.getSubEmotions(emotion),
        turningPoint,
        notes: "",
      });
    }

    return chapters;
  }

  /**
   * 都市情感曲线：平淡-冲突-和解-升华
   */
  private designUrbanArc(structure: StoryStructure): EmotionalChapter[] {
    const { totalChapters, climaxChapter } = structure;
    const chapters: EmotionalChapter[] = [];

    for (let i = 1; i <= totalChapters; i++) {
      let emotion: EmotionType;
      let intensity: number;
      let turningPoint = false;

      if (i <= totalChapters * 0.3) {
        // 平淡期
        emotion = "joy";
        intensity = 3 + (i / totalChapters) * 2;
      } else if (i <= totalChapters * 0.6) {
        // 冲突期
        emotion = "tension";
        intensity = 5 + ((i - totalChapters * 0.3) / (totalChapters * 0.3)) * 4;
        if (i === climaxChapter) {
          intensity = 10;
          turningPoint = true;
        }
      } else if (i <= totalChapters * 0.8) {
        // 和解期
        emotion = "relief";
        intensity = 6 - ((i - totalChapters * 0.6) / (totalChapters * 0.2)) * 2;
      } else {
        // 升华期
        emotion = "love";
        intensity = 5 + ((i - totalChapters * 0.8) / (totalChapters * 0.2)) * 3;
      }

      chapters.push({
        chapterNumber: i,
        primaryEmotion: emotion,
        intensity: Math.min(10, Math.max(1, intensity)),
        subEmotions: this.getSubEmotions(emotion),
        turningPoint,
        notes: "",
      });
    }

    return chapters;
  }

  /**
   * 言情情感曲线：甜蜜-误会-分离-重逢
   */
  private designRomanceArc(structure: StoryStructure): EmotionalChapter[] {
    const { totalChapters, climaxChapter } = structure;
    const chapters: EmotionalChapter[] = [];

    for (let i = 1; i <= totalChapters; i++) {
      let emotion: EmotionType;
      let intensity: number;
      let turningPoint = false;

      if (i <= totalChapters * 0.25) {
        // 甜蜜期
        emotion = "love";
        intensity = 6 + (i / totalChapters) * 4;
      } else if (i <= totalChapters * 0.5) {
        // 误会期
        emotion = "sadness";
        intensity = 5 + ((i - totalChapters * 0.25) / (totalChapters * 0.25)) * 3;
      } else if (i <= totalChapters * 0.75) {
        // 分离期
        emotion = "despair";
        intensity = 8;
        if (i === climaxChapter) {
          intensity = 10;
          turningPoint = true;
        }
      } else {
        // 重逢期
        emotion = "joy";
        intensity = 6 + ((i - totalChapters * 0.75) / (totalChapters * 0.25)) * 4;
      }

      chapters.push({
        chapterNumber: i,
        primaryEmotion: emotion,
        intensity: Math.min(10, Math.max(1, intensity)),
        subEmotions: this.getSubEmotions(emotion),
        turningPoint,
        notes: "",
      });
    }

    return chapters;
  }

  /**
   * 悬疑情感曲线：平静-发现-紧张-揭秘
   */
  private designMysteryArc(structure: StoryStructure): EmotionalChapter[] {
    const { totalChapters, climaxChapter } = structure;
    const chapters: EmotionalChapter[] = [];

    for (let i = 1; i <= totalChapters; i++) {
      let emotion: EmotionType;
      let intensity: number;
      let turningPoint = false;

      if (i <= totalChapters * 0.2) {
        // 平静期
        emotion = "trust";
        intensity = 3;
      } else if (i <= totalChapters * 0.5) {
        // 发现期
        emotion = "surprise";
        intensity = 4 + ((i - totalChapters * 0.2) / (totalChapters * 0.3)) * 4;
      } else if (i <= totalChapters * 0.8) {
        // 紧张期
        emotion = "fear";
        intensity = 7 + ((i - totalChapters * 0.5) / (totalChapters * 0.3)) * 3;
        if (i === climaxChapter) {
          intensity = 10;
          turningPoint = true;
        }
      } else {
        // 揭秘期
        emotion = "surprise";
        intensity = 8 - ((i - totalChapters * 0.8) / (totalChapters * 0.2)) * 4;
      }

      chapters.push({
        chapterNumber: i,
        primaryEmotion: emotion,
        intensity: Math.min(10, Math.max(1, intensity)),
        subEmotions: this.getSubEmotions(emotion),
        turningPoint,
        notes: "",
      });
    }

    return chapters;
  }

  /**
   * 获取次要情感
   */
  private getSubEmotions(primary: EmotionType): EmotionType[] {
    const subEmotionMap: Record<EmotionType, EmotionType[]> = {
      joy: ["love", "hope"],
      sadness: ["nostalgia", "despair"],
      anger: ["disgust", "tension"],
      fear: ["tension", "surprise"],
      surprise: ["fear", "excitement"],
      disgust: ["anger", "sadness"],
      trust: ["joy", "hope"],
      anticipation: ["excitement", "hope"],
      love: ["joy", "trust"],
      hope: ["anticipation", "trust"],
      despair: ["sadness", "fear"],
      nostalgia: ["sadness", "love"],
      excitement: ["joy", "anticipation"],
      tension: ["fear", "anger"],
      relief: ["joy", "hope"],
      bittersweet: ["sadness", "joy"],
    };
    return subEmotionMap[primary] || [];
  }
}
