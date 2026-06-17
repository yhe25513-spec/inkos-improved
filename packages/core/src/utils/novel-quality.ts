/**
 * 小说写作质量评估工具
 * 提供多维度的小说质量评估指标
 */

export interface QualityMetric {
  name: string;
  score: number;        // 0-100
  weight: number;       // 权重
  description: string;
  suggestions: string[];
}

export interface QualityReport {
  overallScore: number;
  metrics: QualityMetric[];
  summary: string;
  grade: "A" | "B" | "C" | "D" | "F";
}

/**
 * 计算可读性分数 (Flesch-Kincaid 简化版)
 */
export function calculateReadability(text: string): QualityMetric {
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const characters = text.replace(/\s/g, "").length;

  // 平均每句字数
  const avgCharsPerSentence = sentences.length > 0 ? characters / sentences.length : 0;

  // 评分：理想的中文小说句子长度在 15-25 字
  let score = 100;
  if (avgCharsPerSentence < 10) {
    score -= 20; // 太短
  } else if (avgCharsPerSentence > 40) {
    score -= 30; // 太长
  } else if (avgCharsPerSentence > 30) {
    score -= 10; // 略长
  }

  const suggestions: string[] = [];
  if (avgCharsPerSentence < 10) {
    suggestions.push("句子过短，考虑合并短句");
  } else if (avgCharsPerSentence > 30) {
    suggestions.push("句子过长，考虑拆分长句");
  }

  return {
    name: "可读性",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.15,
    description: `平均每句 ${avgCharsPerSentence.toFixed(1)} 字`,
    suggestions,
  };
}

/**
 * 计算词汇丰富度 (Type-Token Ratio)
 */
export function calculateLexicalDiversity(text: string): QualityMetric {
  const words = text.split(/[\s，。！？、；：""''（）\[\]]+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      name: "词汇丰富度",
      score: 0,
      weight: 0.15,
      description: "无词汇数据",
      suggestions: ["增加内容"],
    };
  }

  const uniqueWords = new Set(words);
  const ttr = uniqueWords.size / words.length;

  // 评分：TTR > 0.6 为优秀
  let score = Math.min(100, Math.round(ttr * 120));

  const suggestions: string[] = [];
  if (ttr < 0.4) {
    suggestions.push("词汇重复率高，尝试使用同义词");
  }
  if (ttr < 0.5) {
    suggestions.push("增加词汇多样性");
  }

  return {
    name: "词汇丰富度",
    score,
    weight: 0.15,
    description: `TTR: ${ttr.toFixed(3)} (${uniqueWords.size}/${words.length})`,
    suggestions,
  };
}

/**
 * 计算段落结构分数
 */
export function calculateParagraphStructure(text: string): QualityMetric {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  if (paragraphs.length === 0) {
    return {
      name: "段落结构",
      score: 0,
      weight: 0.1,
      description: "无段落数据",
      suggestions: ["增加内容"],
    };
  }

  // 计算段落长度变化
  const lengths = paragraphs.map(p => p.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // 变异系数 (CV) - 衡量段落长度变化
  const cv = avgLength > 0 ? stdDev / avgLength : 0;

  // 评分：CV 在 0.3-0.7 之间为理想
  let score = 100;
  if (cv < 0.2) {
    score -= 30; // 太单调
  } else if (cv > 0.8) {
    score -= 20; // 太混乱
  }

  const suggestions: string[] = [];
  if (cv < 0.2) {
    suggestions.push("段落长度过于均匀，增加变化");
  }
  if (cv > 0.8) {
    suggestions.push("段落长度差异过大，适当调整");
  }
  if (paragraphs.length < 3) {
    suggestions.push("段落数量较少，考虑分段");
  }

  return {
    name: "段落结构",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `${paragraphs.length} 段, 变异系数 ${cv.toFixed(2)}`,
    suggestions,
  };
}

/**
 * 计算对话质量分数
 */
export function calculateDialogueQuality(text: string): QualityMetric {
  // 检测对话标记
  const dialoguePatterns = [
    /["「"[].*?["」"]/g,
    /said|said|say|says/gi,
    /说|道|问|答|喊|叫|笑|叹/g,
  ];

  let dialogueCount = 0;
  for (const pattern of dialoguePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dialogueCount += matches.length;
    }
  }

  // 计算对话占比
  const totalChars = text.length;
  const dialogueChars = (text.match(/["「"[].*?["」"]/g) || []).join("").length;
  const dialogueRatio = totalChars > 0 ? dialogueChars / totalChars : 0;

  // 评分：对话占比 10-30% 为理想
  let score = 100;
  if (dialogueRatio < 0.05) {
    score -= 30; // 对话太少
  } else if (dialogueRatio > 0.5) {
    score -= 20; // 对话太多
  }

  const suggestions: string[] = [];
  if (dialogueRatio < 0.05) {
    suggestions.push("对话较少，考虑增加对话");
  }
  if (dialogueRatio > 0.5) {
    suggestions.push("对话过多，考虑增加叙述");
  }

  return {
    name: "对话质量",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `对话占比 ${(dialogueRatio * 100).toFixed(1)}%`,
    suggestions,
  };
}

/**
 * 计算节奏分数
 */
export function calculatePacing(text: string): QualityMetric {
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());

  if (sentences.length < 5) {
    return {
      name: "节奏",
      score: 50,
      weight: 0.1,
      description: "句子较少，难以评估",
      suggestions: ["增加内容"],
    };
  }

  // 计算句子长度变化
  const lengths = sentences.map(s => s.length);

  // 检测长短句交替
  let alternations = 0;
  for (let i = 1; i < lengths.length; i++) {
    if ((lengths[i] > lengths[i - 1] && lengths[i - 1] < 15) ||
        (lengths[i] < lengths[i - 1] && lengths[i - 1] > 25)) {
      alternations++;
    }
  }

  const alternationRate = alternations / (lengths.length - 1);

  // 评分：交替率 0.3-0.6 为理想
  let score = Math.min(100, Math.round(alternationRate * 150 + 30));

  const suggestions: string[] = [];
  if (alternationRate < 0.2) {
    suggestions.push("句子节奏较单调，增加长短句变化");
  }

  return {
    name: "节奏",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `句子交替率 ${(alternationRate * 100).toFixed(1)}%`,
    suggestions,
  };
}

/**
 * 计算描写丰富度
 */
export function calculateDescription(text: string): QualityMetric {
  // 检测描写词汇
  const descriptionPatterns = [
    /看|见|视|望|瞥|瞅/g,  // 视觉
    /听|闻|嗅|尝|触/g,      // 感官
    /红|蓝|绿|黄|白|黑|紫|橙/g,  // 颜色
    /大|小|高|低|长|短|宽|窄/g,  // 尺寸
  ];

  let descriptionCount = 0;
  for (const pattern of descriptionPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      descriptionCount += matches.length;
    }
  }

  // 计算描写密度（每 100 字）
  const density = text.length > 0 ? (descriptionCount / text.length) * 100 : 0;

  // 评分：密度 2-5 为理想
  let score = 100;
  if (density < 1) {
    score -= 40; // 描写太少
  } else if (density > 8) {
    score -= 20; // 描写过多
  }

  const suggestions: string[] = [];
  if (density < 1) {
    suggestions.push("描写较少，增加感官细节");
  }
  if (density > 8) {
    suggestions.push("描写过多，适当精简");
  }

  return {
    name: "描写丰富度",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `描写密度 ${density.toFixed(2)}%`,
    suggestions,
  };
}

/**
 * 计算情感表达分数
 */
export function calculateEmotionalExpression(text: string): QualityMetric {
  // 检测情感词汇
  const emotionPatterns = [
    /开心|高兴|快乐|喜悦|兴奋/g,  // 正面情绪
    /悲伤|难过|痛苦|伤心|忧愁/g,  // 负面情绪
    /愤怒|生气|恼怒|暴怒|愤恨/g,  // 愤怒
    /害怕|恐惧|惊恐|畏惧|胆怯/g,  // 恐惧
    /惊讶|震惊|吃惊|意外|诧异/g,  // 惊讶
  ];

  let emotionCount = 0;
  for (const pattern of emotionPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      emotionCount += matches.length;
    }
  }

  // 计算情感密度
  const density = text.length > 0 ? (emotionCount / text.length) * 1000 : 0;

  // 评分：密度 1-3 为理想
  let score = 100;
  if (density < 0.5) {
    score -= 30; // 情感表达太少
  } else if (density > 5) {
    score -= 20; // 情感表达过多
  }

  const suggestions: string[] = [];
  if (density < 0.5) {
    suggestions.push("情感表达较少，增加情感描写");
  }
  if (density > 5) {
    suggestions.push("情感表达过多，适当精简");
  }

  return {
    name: "情感表达",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `情感密度 ${density.toFixed(2)}‰`,
    suggestions,
  };
}

/**
 * 计算叙事一致性分数
 */
export function calculateNarrativeConsistency(text: string): QualityMetric {
  // 检测时态一致性
  const pastTense = (text.match(/了|过|曾经|当时|那时/g) || []).length;
  const presentTense = (text.match(/现在|此时|此刻|正在/g) || []).length;

  const total = pastTense + presentTense;
  const consistency = total > 0 ? Math.max(pastTense, presentTense) / total : 0.5;

  // 评分：一致性 > 0.7 为优秀
  let score = Math.round(consistency * 100);

  const suggestions: string[] = [];
  if (consistency < 0.7) {
    suggestions.push("时态使用不够一致，检查时态");
  }

  return {
    name: "叙事一致性",
    score: Math.max(0, Math.min(100, score)),
    weight: 0.1,
    description: `时态一致性 ${(consistency * 100).toFixed(1)}%`,
    suggestions,
  };
}

/**
 * 计算原创性分数 (基于 AI 检测)
 */
export function calculateOriginality(text: string): QualityMetric {
  // 简化版：检测常见 AI 写作模式
  const aiPatterns = [
    /然而/g,
    /因此/g,
    /此外/g,
    /与此同时/g,
    /尽管如此/g,
    /非常/g,
    /十分/g,
    /特别/g,
  ];

  let aiPatternCount = 0;
  for (const pattern of aiPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      aiPatternCount += matches.length;
    }
  }

  // 计算 AI 模式密度
  const density = text.length > 0 ? (aiPatternCount / text.length) * 100 : 0;

  // 评分：密度 < 1 为优秀
  let score = Math.max(0, Math.min(100, Math.round(100 - density * 50)));

  const suggestions: string[] = [];
  if (density > 1) {
    suggestions.push("AI 写作痕迹较多，进行去 AI 味处理");
  }

  return {
    name: "原创性",
    score,
    weight: 0.1,
    description: `AI 模式密度 ${density.toFixed(2)}%`,
    suggestions,
  };
}

/**
 * 生成综合质量报告
 */
export function generateQualityReport(text: string): QualityReport {
  const metrics = [
    calculateReadability(text),
    calculateLexicalDiversity(text),
    calculateParagraphStructure(text),
    calculateDialogueQuality(text),
    calculatePacing(text),
    calculateDescription(text),
    calculateEmotionalExpression(text),
    calculateNarrativeConsistency(text),
    calculateOriginality(text),
  ];

  // 计算加权总分
  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
  const weightedScore = metrics.reduce((sum, m) => sum + m.score * m.weight, 0) / totalWeight;

  // 确定等级
  let grade: "A" | "B" | "C" | "D" | "F";
  if (weightedScore >= 90) grade = "A";
  else if (weightedScore >= 80) grade = "B";
  else if (weightedScore >= 70) grade = "C";
  else if (weightedScore >= 60) grade = "D";
  else grade = "F";

  // 收集所有建议
  const allSuggestions = metrics.flatMap(m => m.suggestions);

  return {
    overallScore: Math.round(weightedScore),
    metrics,
    summary: `综合评分 ${Math.round(weightedScore)}/100 (${grade})`,
    grade,
  };
}
