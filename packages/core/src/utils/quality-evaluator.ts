/**
 * 小说质量评估器
 * 基于多维度评估小说写作质量
 */

export interface EvaluationDimension {
  name: string;
  weight: number;
  evaluator: (text: string, context?: EvaluationContext) => Promise<number>;
}

export interface EvaluationContext {
  genre?: string;
  previousChapters?: string[];
  characterProfiles?: Record<string, string>;
  worldSettings?: string;
  hooks?: Array<{ id: string; status: string; description: string }>;
}

export interface EvaluationResult {
  dimension: string;
  score: number;        // 0-100
  confidence: number;   // 0-1
  issues: string[];
  suggestions: string[];
}

export interface QualityEvaluation {
  overallScore: number;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  dimensions: EvaluationResult[];
  summary: string;
  detailedReport: string;
}

/**
 * 连贯性评估器
 */
export async function evaluateCoherence(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 检查段落之间的逻辑连接
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length > 1) {
    // 检查是否有突兀的转折
    for (let i = 1; i < paragraphs.length; i++) {
      const prev = paragraphs[i - 1];
      const curr = paragraphs[i];

      // 简单检查：如果两段完全没有共同词汇，可能不连贯
      const prevWords = new Set(prev.split(/\s+/));
      const currWords = new Set(curr.split(/\s+/));
      const overlap = [...prevWords].filter(w => currWords.has(w)).length;

      if (overlap === 0 && prev.length > 20 && curr.length > 20) {
        score -= 5;
        issues.push(`段落 ${i} 和 ${i + 1} 之间缺乏逻辑连接`);
        suggestions.push(`在段落之间添加过渡句`);
      }
    }
  }

  // 检查角色提及的一致性
  if (context?.characterProfiles) {
    const characterNames = Object.keys(context.characterProfiles);
    for (const name of characterNames) {
      const mentions = (text.match(new RegExp(name, "g")) || []).length;
      if (mentions === 0) {
        score -= 3;
        issues.push(`角色 "${name}" 在章节中未出现`);
      }
    }
  }

  return {
    dimension: "连贯性",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.7,
    issues,
    suggestions,
  };
}

/**
 * 一致性评估器
 */
export async function evaluateConsistency(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 检查时态一致性
  const pastTense = (text.match(/了|过|曾经|当时/g) || []).length;
  const presentTense = (text.match(/现在|此时|此刻|正在/g) || []).length;
  const total = pastTense + presentTense;

  if (total > 0) {
    const consistency = Math.max(pastTense, presentTense) / total;
    if (consistency < 0.7) {
      score -= 20;
      issues.push("时态使用不一致");
      suggestions.push("统一使用过去时或现在时");
    }
  }

  // 检查角色行为一致性
  if (context?.characterProfiles) {
    for (const [name, profile] of Object.entries(context.characterProfiles)) {
      const profileLower = profile.toLowerCase();
      const textLower = text.toLowerCase();

      // 检查是否提到角色名
      if (textLower.includes(name.toLowerCase())) {
        // 简单检查：如果角色描述说"冷静"，但文中提到"暴怒"
        if (profileLower.includes("冷静") && textLower.includes("暴怒")) {
          score -= 10;
          issues.push(`角色 "${name}" 行为与人设不符`);
          suggestions.push(`调整角色行为以符合人设`);
        }
      }
    }
  }

  // 检查设定一致性
  if (context?.worldSettings) {
    // 简单检查：是否提到世界设定中的关键词
    const settingKeywords = context.worldSettings.match(/[一-龥]{2,4}/g) || [];
    for (const keyword of settingKeywords.slice(0, 10)) {
      if (text.includes(keyword)) {
        // 如果提到设定关键词，检查是否前后一致
        const firstMention = text.indexOf(keyword);
        const lastMention = text.lastIndexOf(keyword);
        if (firstMention !== lastMention) {
          // 检查上下文是否一致
          const firstContext = text.substring(Math.max(0, firstMention - 20), firstMention + keyword.length + 20);
          const lastContext = text.substring(Math.max(0, lastMention - 20), lastMention + keyword.length + 20);

          // 简单检查：如果上下文完全不同，可能有问题
          if (firstContext !== lastContext) {
            score -= 2;
          }
        }
      }
    }
  }

  return {
    dimension: "一致性",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.8,
    issues,
    suggestions,
  };
}

/**
 * 可读性评估器
 */
export async function evaluateReadability(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  // 检查句子长度
  const avgSentenceLength = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length
    : 0;

  if (avgSentenceLength > 40) {
    score -= 15;
    issues.push(`句子平均长度 ${avgSentenceLength.toFixed(0)} 字，过长`);
    suggestions.push("拆分长句，增加句子多样性");
  } else if (avgSentenceLength < 10) {
    score -= 10;
    issues.push(`句子平均长度 ${avgSentenceLength.toFixed(0)} 字，过短`);
    suggestions.push("合并短句，增加表达丰富度");
  }

  // 检查段落长度
  const avgParagraphLength = paragraphs.length > 0
    ? paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length
    : 0;

  if (avgParagraphLength > 200) {
    score -= 10;
    issues.push("段落过长");
    suggestions.push("适当分段，增加可读性");
  }

  // 检查词汇重复
  const words = text.split(/[\s，。！？]+/).filter(w => w.length > 1);
  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  const repetitiveWords = Object.entries(wordFreq)
    .filter(([word, count]) => count > 5 && word.length > 1)
    .sort((a, b) => b[1] - a[1]);

  if (repetitiveWords.length > 3) {
    score -= 10;
    issues.push(`词汇重复较多: ${repetitiveWords.slice(0, 3).map(([w, c]) => `${w}(${c})`).join(", ")}`);
    suggestions.push("使用同义词替换重复词汇");
  }

  return {
    dimension: "可读性",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.9,
    issues,
    suggestions,
  };
}

/**
 * 对话质量评估器
 */
export async function evaluateDialogueQuality(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 提取对话
  const dialogues = text.match(/["「"[].*?["」"]/g) || [];

  if (dialogues.length === 0) {
    score -= 20;
    issues.push("章节中没有对话");
    suggestions.push("添加角色对话以增加生动性");
  } else {
    // 检查对话长度
    const avgDialogueLength = dialogues.reduce((sum, d) => sum + d.length, 0) / dialogues.length;

    if (avgDialogueLength > 50) {
      score -= 10;
      issues.push("对话过长");
      suggestions.push("精简对话，增加动作和描写");
    }

    // 检查对话标签
    const dialogueTags = text.match(/["「"[].*?["」"][^「」""，。！？]*[，。]/g) || [];
    const tagPatterns = ["说", "道", "问", "答", "喊", "叫", "笑", "叹"];
    const hasTag = dialogueTags.some(tag =>
      tagPatterns.some(pattern => tag.includes(pattern))
    );

    if (!hasTag && dialogues.length > 2) {
      score -= 5;
      issues.push("对话缺少标签");
      suggestions.push("添加对话标签以明确说话者");
    }
  }

  return {
    dimension: "对话质量",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.8,
    issues,
    suggestions,
  };
}

/**
 * 节奏评估器
 */
export async function evaluatePacing(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());

  if (sentences.length < 5) {
    return {
      dimension: "节奏",
      score: 50,
      confidence: 0.5,
      issues: ["句子数量较少，难以评估节奏"],
      suggestions: ["增加内容以获得更准确的评估"],
    };
  }

  // 检查句子长度变化
  const lengths = sentences.map(s => s.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgLength > 0 ? stdDev / avgLength : 0;

  // 变异系数过低表示节奏单调
  if (cv < 0.2) {
    score -= 20;
    issues.push("句子长度过于均匀，节奏单调");
    suggestions.push("增加长短句变化，创造节奏感");
  }

  // 检查段落长度变化
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  if (paragraphs.length > 3) {
    const paraLengths = paragraphs.map(p => p.length);
    const avgParaLength = paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length;
    const paraVariance = paraLengths.reduce((sum, l) => sum + Math.pow(l - avgParaLength, 2), 0) / paraLengths.length;
    const paraCv = avgParaLength > 0 ? Math.sqrt(paraVariance) / avgParaLength : 0;

    if (paraCv < 0.15) {
      score -= 10;
      issues.push("段落长度过于均匀");
      suggestions.push("调整段落长度，增加变化");
    }
  }

  return {
    dimension: "节奏",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.7,
    issues,
    suggestions,
  };
}

/**
 * 情感深度评估器
 */
export async function evaluateEmotionalDepth(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 检查情感词汇
  const emotionPatterns = [
    { pattern: /开心|高兴|快乐|喜悦|兴奋/g, type: "正面" },
    { pattern: /悲伤|难过|痛苦|伤心|忧愁/g, type: "负面" },
    { pattern: /愤怒|生气|恼怒|暴怒/g, type: "愤怒" },
    { pattern: /害怕|恐惧|惊恐|畏惧/g, type: "恐惧" },
    { pattern: /惊讶|震惊|吃惊|意外/g, type: "惊讶" },
  ];

  let totalEmotions = 0;
  const emotionTypes = new Set<string>();

  for (const { pattern, type } of emotionPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      totalEmotions += matches.length;
      emotionTypes.add(type);
    }
  }

  // 检查情感密度
  const density = text.length > 0 ? (totalEmotions / text.length) * 1000 : 0;

  if (density < 0.5) {
    score -= 20;
    issues.push("情感表达较少");
    suggestions.push("增加情感描写，丰富角色内心世界");
  } else if (density > 5) {
    score -= 10;
    issues.push("情感表达过多");
    suggestions.push("适当精简，避免情感堆砌");
  }

  // 检查情感多样性
  if (emotionTypes.size < 2 && totalEmotions > 0) {
    score -= 10;
    issues.push("情感类型单一");
    suggestions.push("展现更丰富的情感层次");
  }

  // 检查是否有情感转变
  const hasEmotionShift = emotionTypes.has("正面") && emotionTypes.has("负面");
  if (hasEmotionShift) {
    score += 5; // 情感转变是好的
  }

  return {
    dimension: "情感深度",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.7,
    issues,
    suggestions,
  };
}

/**
 * 描写丰富度评估器
 */
export async function evaluateDescriptionRichness(
  text: string,
  context?: EvaluationContext
): Promise<EvaluationResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 检查感官描写
  const sensoryPatterns = [
    { pattern: /看|见|视|望|瞥|瞅/g, type: "视觉" },
    { pattern: /听|闻|嗅|尝|触/g, type: "触觉" },
    { pattern: /红|蓝|绿|黄|白|黑|紫|橙/g, type: "颜色" },
    { pattern: /大|小|高|低|长|短|宽|窄/g, type: "尺寸" },
  ];

  const sensoryTypes = new Set<string>();
  let totalSensory = 0;

  for (const { pattern, type } of sensoryPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      totalSensory += matches.length;
      sensoryTypes.add(type);
    }
  }

  // 检查感官密度
  const density = text.length > 0 ? (totalSensory / text.length) * 100 : 0;

  if (density < 1) {
    score -= 25;
    issues.push("感官描写较少");
    suggestions.push("增加视觉、听觉、触觉等感官细节");
  } else if (density > 8) {
    score -= 10;
    issues.push("描写过于密集");
    suggestions.push("适当精简，保持节奏");
  }

  // 检查描写多样性
  if (sensoryTypes.size < 2) {
    score -= 10;
    issues.push("感官描写类型单一");
    suggestions.push("丰富感官描写类型");
  }

  return {
    dimension: "描写丰富度",
    score: Math.max(0, Math.min(100, score)),
    confidence: 0.8,
    issues,
    suggestions,
  };
}

/**
 * 生成综合质量评估
 */
export async function evaluateNovelQuality(
  text: string,
  context?: EvaluationContext
): Promise<QualityEvaluation> {
  const dimensions: EvaluationResult[] = [];

  // 并行评估所有维度
  const evaluations = await Promise.all([
    evaluateCoherence(text, context),
    evaluateConsistency(text, context),
    evaluateReadability(text, context),
    evaluateDialogueQuality(text, context),
    evaluatePacing(text, context),
    evaluateEmotionalDepth(text, context),
    evaluateDescriptionRichness(text, context),
  ]);

  dimensions.push(...evaluations);

  // 计算加权总分
  const weights = [0.20, 0.20, 0.15, 0.10, 0.10, 0.15, 0.10];
  let weightedScore = 0;
  for (let i = 0; i < dimensions.length; i++) {
    weightedScore += dimensions[i].score * weights[i];
  }

  // 确定等级
  let grade: "S" | "A" | "B" | "C" | "D" | "F";
  if (weightedScore >= 95) grade = "S";
  else if (weightedScore >= 85) grade = "A";
  else if (weightedScore >= 75) grade = "B";
  else if (weightedScore >= 65) grade = "C";
  else if (weightedScore >= 50) grade = "D";
  else grade = "F";

  // 生成详细报告
  const detailedReport = generateDetailedReport(dimensions, weightedScore, grade);

  // 收集所有问题和建议
  const allIssues = dimensions.flatMap(d => d.issues);
  const allSuggestions = dimensions.flatMap(d => d.suggestions);

  return {
    overallScore: Math.round(weightedScore),
    grade,
    dimensions,
    summary: `综合评分 ${Math.round(weightedScore)}/100 (${grade}) | ${allIssues.length} 个问题 | ${allSuggestions.length} 个建议`,
    detailedReport,
  };
}

/**
 * 生成详细报告
 */
function generateDetailedReport(
  dimensions: EvaluationResult[],
  overallScore: number,
  grade: string
): string {
  let report = `# 📊 小说质量评估报告\n\n`;

  report += `## 综合评分: ${overallScore}/100 (${grade})\n\n`;

  report += `## 各维度评分\n\n`;
  report += `| 维度 | 评分 | 置信度 | 问题数 |\n`;
  report += `|------|------|--------|--------|\n`;

  for (const dim of dimensions) {
    const emoji = dim.score >= 80 ? "🟢" : dim.score >= 60 ? "🟡" : "🔴";
    report += `| ${dim.dimension} | ${emoji} ${dim.score} | ${(dim.confidence * 100).toFixed(0)}% | ${dim.issues.length} |\n`;
  }

  // 问题汇总
  const allIssues = dimensions.flatMap(d => d.issues);
  if (allIssues.length > 0) {
    report += `\n## 发现的问题\n\n`;
    for (const issue of allIssues) {
      report += `- ⚠️ ${issue}\n`;
    }
  }

  // 建议汇总
  const allSuggestions = dimensions.flatMap(d => d.suggestions);
  if (allSuggestions.length > 0) {
    report += `\n## 改进建议\n\n`;
    for (const suggestion of allSuggestions) {
      report += `- 💡 ${suggestion}\n`;
    }
  }

  return report;
}
