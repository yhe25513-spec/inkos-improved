/**
 * PatternBreaker - Detects cliché patterns in chapter plans and suggests alternatives.
 *
 * Pure utility function with no LLM calls. Uses heuristic fuzzy matching
 * to detect common narrative clichés and provide actionable suggestions.
 */

export interface PatternMatch {
  readonly pattern: string;
  readonly similarity: number; // 0-1
  readonly location: string;
}

export interface PatternBreakerResult {
  readonly clichéIndex: number; // 0-100, higher = more cliché
  readonly matches: ReadonlyArray<PatternMatch>;
  readonly suggestions: ReadonlyArray<string>;
}

interface ClichéPatternDef {
  readonly pattern: string;
  readonly keywords: ReadonlyArray<string>;
  readonly alternatives: ReadonlyArray<string>;
}

/**
 * Common Chinese web novel cliché patterns with detection keywords and alternatives.
 */
const CLICHE_PATTERNS: ReadonlyArray<ClichéPatternDef> = [
  {
    pattern: "主角突然觉醒",
    keywords: ["突然觉醒", "顿悟", "忽然开窍", "瞬间领悟", "猛然顿悟", "觉醒了", "一下子明白"],
    alternatives: ["缓慢成长", "意外获得线索", "在挫折中逐渐领悟", "通过实践慢慢掌握"],
  },
  {
    pattern: "反派排队送死",
    keywords: ["反派送死", "一个一个来", "轮流挑战", "逐个击败", "排着队", "一个接一个"],
    alternatives: ["反派有策略", "反派撤退", "反派联合行动", "反派设置陷阱"],
  },
  {
    pattern: "美女救英雄",
    keywords: ["美女救", "女的救了", "被女子所救", "她来救他", "美人相救", "女子搭救"],
    alternatives: ["英雄自救", "配角帮忙", "主角自救成功", "意外脱险"],
  },
  {
    pattern: "误会-和好-误会",
    keywords: ["误会了", "和好如初", "再次误会", "重归于好", "又一次误会", "反复误会", "冰释前嫌"],
    alternatives: ["持续张力", "共同目标", "部分和解", "带着分歧合作"],
  },
  {
    pattern: "低谷-觉醒-逆袭",
    keywords: ["跌入谷底", "绝地反击", "触底反弹", "从最低谷", "一蹶不振后", "最低点"],
    alternatives: ["渐进成长", "有代价的胜利", "小步前进", "螺旋式上升"],
  },
  {
    pattern: "主角光环",
    keywords: ["主角光环", "运气好到", "偏偏是主角", "冥冥之中", "恰好遇到", "机缘巧合", "天选之人"],
    alternatives: ["实力赢得", "提前布局", "长期准备的结果", "合理的情节铺垫"],
  },
  {
    pattern: "强行降智",
    keywords: ["脑子短路", "突然变蠢", "智商下线", "莫名其妙", "为什么不用", "明明可以"],
    alternatives: ["角色有合理考量", "信息不对称导致误判", "角色性格使然", "留下后手"],
  },
  {
    pattern: "剧情杀",
    keywords: ["剧情需要", "不得不死", "为了推动剧情", "被剧情杀死", "强行领便当", "无意义牺牲"],
    alternatives: ["角色主动选择", "有预兆的牺牲", "战术性撤退", "意外存活但付出代价"],
  },
  {
    pattern: "脸谱化反派",
    keywords: ["坏到骨子里", "纯恶", "没有理由的坏", "天生坏种", "邪恶到底"],
    alternatives: ["有动机的反派", "灰色地带角色", "反派有苦衷", "理念冲突"],
  },
  {
    pattern: "套路化战斗",
    keywords: ["大招", "爆发", "绝招", "最后一击", "关键时刻", "爆种", "燃烧小宇宙"],
    alternatives: ["智谋取胜", "团队配合", "环境利用", "以弱胜强的策略"],
  },
  {
    pattern: "无脑后宫",
    keywords: ["都爱上了", "争风吃醋", "都倾心", "后宫", "女人都喜欢", "魅力无法挡"],
    alternatives: ["单线感情", "复杂的感情关系", "友情与爱情的区分", "角色有独立感情线"],
  },
  {
    pattern: "开挂升级",
    keywords: ["一夜之间", "瞬间突破", "直接飞升", "跳级", "突飞猛进", "一日千里"],
    alternatives: ["稳步提升", "有瓶颈的突破", "突破后遗症", "循序渐进的成长"],
  },
];

/**
 * Simple fuzzy matching score between text and pattern.
 * Returns 0-1 similarity score.
 */
function fuzzyMatchScore(text: string, pattern: string): number {
  if (text.includes(pattern)) {
    return 1.0;
  }

  // For longer patterns, check if most characters appear in order
  if (pattern.length >= 3) {
    let matchCount = 0;
    let patternIdx = 0;

    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        matchCount++;
        patternIdx++;
      }
    }

    if (matchCount >= pattern.length * 0.8) {
      return 0.7 + (matchCount / pattern.length) * 0.3;
    }
  }

  // Check for partial keyword overlap
  const patternChars = [...pattern];
  let matchedChars = 0;
  for (const char of patternChars) {
    if (text.includes(char)) {
      matchedChars++;
    }
  }

  return matchedChars / patternChars.length * 0.6;
}

/**
 * Calculate similarity between two text blocks for repetition detection.
 */
function calculateRepetitionScore(text1: string, text2: string): number {
  const normalized1 = normalizeForComparison(text1);
  const normalized2 = normalizeForComparison(text2);

  if (normalized1 === normalized2) return 1.0;
  if (normalized1.length < 5 || normalized2.length < 5) return 0;

  return diceCoefficient(normalized1, normalized2);
}

/**
 * Normalize text for comparison by removing punctuation and whitespace.
 */
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\s，。！？；："''（）《》、\-—…·]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Dice coefficient for bigram similarity comparison.
 */
function diceCoefficient(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  let overlap = 0;

  for (const [bigram, count] of leftBigrams) {
    overlap += Math.min(count, rightBigrams.get(bigram) ?? 0);
  }

  const leftCount = [...leftBigrams.values()].reduce((sum, value) => sum + value, 0);
  const rightCount = [...rightBigrams.values()].reduce((sum, value) => sum + value, 0);
  return (2 * overlap) / (leftCount + rightCount);
}

/**
 * Build bigram frequency map for a string.
 */
function buildBigrams(value: string): Map<string, number> {
  const result = new Map<string, number>();
  for (let index = 0; index < value.length - 1; index++) {
    const bigram = value.slice(index, index + 2);
    result.set(bigram, (result.get(bigram) ?? 0) + 1);
  }
  return result;
}

/**
 * Detect cliché patterns in chapter plan and recent summaries.
 *
 * @param chapterMemo - The chapter plan/memo to analyze
 * @param recentSummaries - Recent chapter summaries for repetition detection
 * @returns PatternBreakerResult with cliché index, matches, and suggestions
 */
export function detectClichéPatterns(
  chapterMemo: string,
  recentSummaries: string,
): PatternBreakerResult {
  const matches: PatternMatch[] = [];
  const suggestions: string[] = [];
  const matchedPatterns = new Set<string>();

  // 1. Scan chapterMemo for cliché patterns
  for (const clichéDef of CLICHE_PATTERNS) {
    let bestSimilarity = 0;
    let bestKeyword = "";

    for (const keyword of clichéDef.keywords) {
      const similarity = fuzzyMatchScore(chapterMemo, keyword);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestKeyword = keyword;
      }
    }

    if (bestSimilarity >= 0.6) {
      matches.push({
        pattern: clichéDef.pattern,
        similarity: bestSimilarity,
        location: `章节大纲中发现 "${bestKeyword}"`,
      });
      matchedPatterns.add(clichéDef.pattern);

      // Add alternatives as suggestions
      for (const alt of clichéDef.alternatives) {
        if (!suggestions.includes(alt)) {
          suggestions.push(alt);
        }
      }
    }
  }

  // 2. Compare with recent summaries for repetition
  if (recentSummaries.length > 0) {
    const summarySections = recentSummaries
      .split(/(?<=。|！|\?|!)\s+/)
      .filter((section) => section.trim().length > 10);

    for (const section of summarySections) {
      const repetitionScore = calculateRepetitionScore(chapterMemo, section);

      if (repetitionScore >= 0.5) {
        matches.push({
          pattern: "剧情重复",
          similarity: repetitionScore,
          location: "与近期章节存在剧情重复",
        });

        if (!suggestions.includes("引入新变数或角色")) {
          suggestions.push("引入新变数或角色");
        }
        if (!suggestions.includes("切换场景或视角")) {
          suggestions.push("切换场景或视角");
        }
      }
    }
  }

  // 3. Calculate clichéIndex based on matches
  const totalPatterns = CLICHE_PATTERNS.length;
  const uniquePatternMatches = matchedPatterns.size;
  const clichéIndex = Math.min(
    100,
    Math.round((uniquePatternMatches / totalPatterns) * 100 +
      (matches.filter((m) => m.pattern === "剧情重复").length * 10))
  );

  return {
    clichéIndex,
    matches,
    suggestions,
  };
}
