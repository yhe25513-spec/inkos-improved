// ── 套路检测器 ────────────────────────────────────────
// 检测文本中的常见网文套路

/**
 * 套路定义
 */
export interface Trope {
  id: string;
  name: string;
  category: "plot" | "character" | "worldbuilding" | "theme";
  description: string;
  frequency: number; // 在网文中的使用频率 0-1
  keywords: string[];
  alternatives: string[];
}

/**
 * 套路检测结果
 */
export interface TropeDetectionResult {
  tropes: Array<{
    trope: Trope;
    confidence: number;
    location: string;
  }>;
  overallOriginality: number; // 0-1，越高越原创
  suggestions: string[];
}

/**
 * 套路数据库
 */
const TROPE_DATABASE: Trope[] = [
  // 剧情套路
  {
    id: "rebirth",
    name: "重生",
    category: "plot",
    description: "主角重生回到过去",
    frequency: 0.7,
    keywords: ["重生", "回到过去", "穿越时空", "重活一世"],
    alternatives: ["时间循环", "平行世界", "预知梦", "传承记忆"],
  },
  {
    id: "system",
    name: "系统流",
    category: "plot",
    description: "主角获得神秘系统",
    frequency: 0.8,
    keywords: ["系统", "面板", "任务", "奖励", "升级"],
    alternatives: ["传承", "奇遇", "觉醒", "金手指"],
  },
  {
    id: "face-slapping",
    name: "打脸",
    category: "plot",
    description: "主角逆袭打脸反派",
    frequency: 0.6,
    keywords: ["打脸", "啪啪", "啪", "脸都绿了", "目瞪口呆"],
    alternatives: ["智取", "谈判", "合作", "感化"],
  },
  {
    id: "young-master",
    name: "纨绔少爷",
    category: "character",
    description: "反派是嚣张的富二代/世家子弟",
    frequency: 0.5,
    keywords: ["纨绔", "少爷", "世家", "公子", "嚣张"],
    alternatives: ["普通反派", "复杂反派", "灰色角色"],
  },
  {
    id: "trash-protagonist",
    name: "废柴逆袭",
    category: "character",
    description: "主角从废柴变成强者",
    frequency: 0.7,
    keywords: ["废柴", "废物", "逆袭", "觉醒", "蜕变"],
    alternatives: ["天才成长", "普通人奋斗", "已强者之路"],
  },
  {
    id: "harem",
    name: "后宫",
    category: "character",
    description: "主角有多个恋爱对象",
    frequency: 0.4,
    keywords: ["后宫", "红颜", "知己", "暧昧", "倾心"],
    alternatives: ["单女主", "无感情线", "复杂感情"],
  },
  {
    id: "tournament",
    name: "比武大会",
    category: "plot",
    description: "通过比武/比赛推进剧情",
    frequency: 0.5,
    keywords: ["比武", "大赛", "擂台", "对决", "冠军"],
    alternatives: ["任务挑战", "探索冒险", "智谋较量"],
  },
  {
    id: "realm-cultivation",
    name: "境界体系",
    category: "worldbuilding",
    description: "修炼境界从低到高",
    frequency: 0.8,
    keywords: ["境界", "突破", "修炼", "炼气", "筑基", "金丹"],
    alternatives: ["技能树", "职业等级", "能力觉醒"],
  },
  {
    id: "ancient-master",
    name: "隐世高人",
    category: "character",
    description: "遇到隐藏实力的高手",
    frequency: 0.4,
    keywords: ["隐世", "高人", "前辈", "深藏不露", "扫地僧"],
    alternatives: ["普通导师", "同龄伙伴", "竞争对手"],
  },
  {
    id: "lucky-protagonist",
    name: "气运之子",
    category: "character",
    description: "主角运气极好",
    frequency: 0.6,
    keywords: ["气运", "运气", "机缘", "巧合", "意外收获"],
    alternatives: ["实力取胜", "智谋取胜", "努力取胜"],
  },
];

/**
 * 套路检测器
 */
export class TropeDetector {
  private tropes: Trope[];

  constructor() {
    this.tropes = TROPE_DATABASE;
  }

  /**
   * 检测文本中的套路
   */
  detect(text: string): TropeDetectionResult {
    const detected: TropeDetectionResult["tropes"] = [];

    for (const trope of this.tropes) {
      const matches = this.findMatches(text, trope);
      if (matches.length > 0) {
        detected.push({
          trope,
          confidence: Math.min(1, matches.length * 0.3),
          location: matches[0],
        });
      }
    }

    return {
      tropes: detected,
      overallOriginality: this.calculateOriginality(detected),
      suggestions: this.generateSuggestions(detected),
    };
  }

  /**
   * 查找套路关键词
   */
  private findMatches(text: string, trope: Trope): string[] {
    const matches: string[] = [];

    for (const keyword of trope.keywords) {
      const regex = new RegExp(keyword, "g");
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push(`${text.slice(Math.max(0, match.index - 10), match.index + keyword.length + 10)}...`);
      }
    }

    return matches;
  }

  /**
   * 计算原创性分数
   */
  private calculateOriginality(detected: TropeDetectionResult["tropes"]): number {
    if (detected.length === 0) return 1;

    // 根据检测到的套路数量和频率计算原创性
    let penalty = 0;
    for (const { trope } of detected) {
      penalty += trope.frequency * 0.2;
    }

    return Math.max(0, 1 - penalty);
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(detected: TropeDetectionResult["tropes"]): string[] {
    const suggestions: string[] = [];

    for (const { trope } of detected) {
      if (trope.alternatives.length > 0) {
        const alternative = trope.alternatives[Math.floor(Math.random() * trope.alternatives.length)];
        suggestions.push(`考虑用"${alternative}"替代"${trope.name}"套路`);
      }
    }

    return suggestions;
  }

  /**
   * 获取所有套路
   */
  getAllTropes(): Trope[] {
    return [...this.tropes];
  }
}
