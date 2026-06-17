export interface FanqieDimensionScore {
  readonly name: string;
  readonly score: number; // 0-100, higher = more human-like
  readonly weight: number;
  readonly details: string;
}

export interface FanqieScoreResult {
  readonly totalScore: number; // 0-100
  readonly passed: boolean; // totalScore >= 80
  readonly dimensions: ReadonlyArray<FanqieDimensionScore>;
  readonly leDensity: number; // "了"字 per 1000 chars
  readonly aiWordCount: number;
}

const AI_WORDS = [
  "综上所述",
  "值得注意的是",
  "在此基础上",
  "不可否认",
  "毋庸置疑",
  "一方面",
  "另一方面",
  "首先",
  "其次",
  "再次",
  "最后",
  "然而",
  "不过",
  "与此同时",
];

const TRANSITION_WORDS = [
  "然而",
  "不过",
  "与此同时",
  "但是",
  "因此",
  "所以",
  "接着",
  "随后",
  "于是",
  "此外",
];

const COLLOQUIAL_MARKERS = ["吧", "呢", "嘛", "靠", "嗯"];

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, "");
  const sentences = cleaned.split(/[。！？\n]+/).filter((s) => s.length > 0);
  return sentences;
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const variance =
    arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function scoreSentenceUniformity(sentences: string[]): FanqieDimensionScore {
  if (sentences.length === 0) {
    return {
      name: "句子结构工整性",
      score: 50,
      weight: 0.3,
      details: "无有效句子",
    };
  }
  const lengths = sentences.map((s) => s.length);
  const avg = average(lengths);
  const sd = standardDeviation(lengths);
  const cv = avg > 0 ? sd / avg : 0;

  let score: number;
  let detail: string;
  if (cv < 0.2) {
    score = 30;
    detail = `CV=${cv.toFixed(3)} (过于工整，AI痕迹重)`;
  } else if (cv < 0.3) {
    score = 60;
    detail = `CV=${cv.toFixed(3)} (中等工整)`;
  } else {
    score = 90;
    detail = `CV=${cv.toFixed(3)} (句长变化自然)`;
  }

  return { name: "句子结构工整性", score, weight: 0.3, details: detail };
}

function scoreLogicSmoothness(sentences: string[]): FanqieDimensionScore {
  if (sentences.length === 0) {
    return {
      name: "逻辑推进平滑度",
      score: 50,
      weight: 0.25,
      details: "无有效句子",
    };
  }

  let transitionCount = 0;
  for (const s of sentences) {
    for (const tw of TRANSITION_WORDS) {
      if (s.includes(tw)) {
        transitionCount++;
        break;
      }
    }
  }

  const transPerSentence = transitionCount / sentences.length;

  let score: number;
  if (transPerSentence > 0.3) {
    score = 30;
  } else if (transPerSentence > 0.15) {
    score = 60;
  } else {
    score = 90;
  }

  return {
    name: "逻辑推进平滑度",
    score,
    weight: 0.25,
    details: `转折词${transitionCount}个，每句${(transPerSentence * 100).toFixed(1)}%`,
  };
}

function scoreVocabularyStandardization(content: string): {
  score: FanqieDimensionScore;
  aiWordCount: number;
} {
  let count = 0;
  for (const word of AI_WORDS) {
    const regex = new RegExp(word, "g");
    const matches = content.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  let score: number;
  if (count <= 2) {
    score = 90;
  } else if (count <= 5) {
    score = 60;
  } else {
    score = 30;
  }

  return {
    score: {
      name: "词汇标准化程度",
      score,
      weight: 0.25,
      details: `AI套话${count}处`,
    },
    aiWordCount: count,
  };
}

function scoreLeDensity(content: string): FanqieDimensionScore {
  const charCount = content.replace(/\s/g, "").length;
  if (charCount === 0) {
    return {
      name: "了字密度",
      score: 50,
      weight: 0.1,
      details: "无有效字数",
    };
  }

  const leMatches = content.match(/了/g);
  const leCount = leMatches ? leMatches.length : 0;
  const density = (leCount / charCount) * 1000;

  let score: number;
  if (density >= 8 && density <= 12) {
    score = 90;
  } else if (density >= 5 && density <= 15) {
    score = 60;
  } else {
    score = 30;
  }

  return {
    name: "了字密度",
    score,
    weight: 0.1,
    details: `密度${density.toFixed(1)}/千字 (目标8-12)`,
  };
}

function scoreColloquialLevel(content: string): FanqieDimensionScore {
  let count = 0;
  for (const marker of COLLOQUIAL_MARKERS) {
    const regex = new RegExp(marker, "g");
    const matches = content.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  let score: number;
  if (count >= 5) {
    score = 90;
  } else if (count >= 2) {
    score = 60;
  } else {
    score = 30;
  }

  return {
    name: "口语化程度",
    score,
    weight: 0.1,
    details: `口语标记${count}处`,
  };
}

export function calculateFanqieScore(content: string): FanqieScoreResult {
  const sentences = splitSentences(content);

  const uniformity = scoreSentenceUniformity(sentences);
  const smoothness = scoreLogicSmoothness(sentences);
  const vocab = scoreVocabularyStandardization(content);
  const le = scoreLeDensity(content);
  const colloquial = scoreColloquialLevel(content);

  const dimensions: FanqieDimensionScore[] = [
    uniformity,
    smoothness,
    vocab.score,
    le,
    colloquial,
  ];

  let totalScore = 0;
  for (const d of dimensions) {
    totalScore += d.score * d.weight;
  }
  totalScore = Math.round(totalScore * 10) / 10;

  const charCount = content.replace(/\s/g, "").length;
  const leCount = (content.match(/了/g) || []).length;
  const leDensity = charCount > 0 ? (leCount / charCount) * 1000 : 0;

  return {
    totalScore,
    passed: totalScore >= 80,
    dimensions,
    leDensity: Math.round(leDensity * 10) / 10,
    aiWordCount: vocab.aiWordCount,
  };
}
