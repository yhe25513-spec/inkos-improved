/**
 * 声音档案系统
 * 支持多种写作风格的检测和转换
 */

export type VoiceProfile = 'casual' | 'professional' | 'warm' | 'blunt' | 'literary' | 'webnovel';

export interface VoicePreset {
  avoid: string[];      // 避免的词汇/句式
  prefer: string[];     // 偏好的词汇/句式
  tone: string;         // 语气指导
  sentenceLength: 'short' | 'medium' | 'long';
  punctuation: 'minimal' | 'moderate' | 'rich';
  description: string;
}

/**
 * 预设声音档案
 */
export const VOICE_PRESETS: Record<VoiceProfile, VoicePreset> = {
  literary: {
    avoid: ['非常', '十分', '特别', '而且', '所以', '但是'],
    prefer: ['甚', '极', '颇', '然', '故', '然则'],
    tone: '文雅、书面化、有韵律感',
    sentenceLength: 'medium',
    punctuation: 'moderate',
    description: '文学风格，适合严肃文学、历史小说',
  },
  casual: {
    avoid: ['然而', '因此', '此外', '与此同时', '尽管如此'],
    prefer: ['但是', '所以', '还有', '这时候', '话说回来'],
    tone: '口语化、轻松、亲切',
    sentenceLength: 'short',
    punctuation: 'minimal',
    description: '口语化风格，适合都市、校园题材',
  },
  professional: {
    avoid: ['非常', '特别', '超级', '超级', '极其'],
    prefer: ['相当', '较为', '颇为', '略', '稍'],
    tone: '正式、专业、客观',
    sentenceLength: 'medium',
    punctuation: 'moderate',
    description: '专业风格，适合职场、商战题材',
  },
  warm: {
    avoid: ['但是', '然而', '不过', '尽管'],
    prefer: ['不过呢', '话是这么说', '其实', '倒是'],
    tone: '温暖、友善、有同理心',
    sentenceLength: 'short',
    punctuation: 'rich',
    description: '温暖风格，适合治愈、日常题材',
  },
  blunt: {
    avoid: ['可能', '也许', '似乎', '好像', '大概'],
    prefer: ['就是', '肯定是', '绝对', '必须', '一定'],
    tone: '直接、干脆、不绕弯',
    sentenceLength: 'short',
    punctuation: 'minimal',
    description: '直接风格，适合热血、战斗题材',
  },
  webnovel: {
    avoid: [
      '然而', '因此', '此外', '与此同时', '尽管如此',
      '但是', '不过', '可是', '只是', '然而',
      '非常', '十分', '特别', '极其', '相当',
      '几乎', '差不多', '大约', '大概', '或许',
    ],
    prefer: [
      '但是', '所以', '还有', '这时候', '话说回来',
      '特么', '卧槽', '草', '擦', '我去',
      '牛逼', '厉害', '强', '猛', '狠',
    ],
    tone: '网文风格、节奏快、爽点密集',
    sentenceLength: 'short',
    punctuation: 'minimal',
    description: '网文风格，适合玄幻、仙侠、都市题材',
  },
};

/**
 * 获取声音档案
 */
export function getVoicePreset(profile: VoiceProfile): VoicePreset {
  return VOICE_PRESETS[profile];
}

/**
 * 检测文本的声音风格
 */
export function detectVoiceStyle(text: string): {
  detectedProfile: VoiceProfile;
  confidence: number;
  reasons: string[];
} {
  const scores: Record<VoiceProfile, number> = {
    literary: 0,
    casual: 0,
    professional: 0,
    warm: 0,
    blunt: 0,
    webnovel: 0,
  };

  const reasons: string[] = [];

  // 检测文雅词汇
  const literaryWords = ['甚', '极', '颇', '然', '故', '则', '乃', '矣', '乎'];
  for (const word of literaryWords) {
    if (text.includes(word)) {
      scores.literary += 10;
      reasons.push(`发现文雅词汇: ${word}`);
    }
  }

  // 检测口语化词汇
  const casualWords = ['但是', '所以', '还有', '这时候', '话说回来'];
  for (const word of casualWords) {
    if (text.includes(word)) {
      scores.casual += 10;
      reasons.push(`发现口语化词汇: ${word}`);
    }
  }

  // 检测专业词汇
  const professionalWords = ['相当', '较为', '颇为', '略', '稍'];
  for (const word of professionalWords) {
    if (text.includes(word)) {
      scores.professional += 10;
      reasons.push(`发现专业词汇: ${word}`);
    }
  }

  // 检测温暖词汇
  const warmWords = ['其实', '倒是', '不过呢', '话是这么说'];
  for (const word of warmWords) {
    if (text.includes(word)) {
      scores.warm += 10;
      reasons.push(`发现温暖词汇: ${word}`);
    }
  }

  // 检测直接词汇
  const bluntWords = ['就是', '肯定是', '绝对', '必须', '一定'];
  for (const word of bluntWords) {
    if (text.includes(word)) {
      scores.blunt += 10;
      reasons.push(`发现直接词汇: ${word}`);
    }
  }

  // 检测网文词汇
  const webnovelWords = ['特么', '卧槽', '草', '牛逼', '厉害', '强', '猛', '狠'];
  for (const word of webnovelWords) {
    if (text.includes(word)) {
      scores.webnovel += 15;
      reasons.push(`发现网文词汇: ${word}`);
    }
  }

  // 句子长度分析
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

  if (avgSentenceLength < 10) {
    scores.casual += 5;
    scores.blunt += 5;
    scores.webnovel += 5;
    reasons.push('句子较短，偏向口语化/网文风格');
  } else if (avgSentenceLength > 30) {
    scores.literary += 5;
    scores.professional += 5;
    reasons.push('句子较长，偏向文学/专业风格');
  }

  // 找出最高分的风格
  const maxScore = Math.max(...Object.values(scores));
  const detectedProfile = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as VoiceProfile;

  return {
    detectedProfile,
    confidence: Math.min(100, maxScore),
    reasons,
  };
}

/**
 * 应用声音档案转换
 */
export function applyVoiceProfile(text: string, targetProfile: VoiceProfile): string {
  const preset = VOICE_PRESETS[targetProfile];
  let result = text;

  // 替换避免的词汇
  for (let i = 0; i < preset.avoid.length; i++) {
    const avoidWord = preset.avoid[i];
    const preferWord = preset.prefer[i % preset.prefer.length];
    result = result.replace(new RegExp(avoidWord, 'g'), preferWord);
  }

  return result;
}

/**
 * 比较两个声音档案的差异
 */
export function compareVoiceProfiles(
  text: string,
  targetProfile: VoiceProfile
): {
  originalStyle: VoiceProfile;
  targetStyle: VoiceProfile;
  differences: string[];
  suggestions: string[];
} {
  const { detectedProfile } = detectVoiceStyle(text);
  const targetPreset = VOICE_PRESETS[targetProfile];
  const differences: string[] = [];
  const suggestions: string[] = [];

  // 检查需要避免的词汇
  for (const word of targetPreset.avoid) {
    if (text.includes(word)) {
      differences.push(`包含需要避免的词汇: "${word}"`);
      const idx = targetPreset.avoid.indexOf(word);
      suggestions.push(`将 "${word}" 替换为 "${targetPreset.prefer[idx % targetPreset.prefer.length]}"`);
    }
  }

  // 检查句子长度
  const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim());
  const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

  if (targetPreset.sentenceLength === 'short' && avgLength > 20) {
    differences.push(`句子平均长度 ${avgLength.toFixed(1)} 字，目标风格偏好短句`);
    suggestions.push('考虑将长句拆分为短句');
  } else if (targetPreset.sentenceLength === 'long' && avgLength < 15) {
    differences.push(`句子平均长度 ${avgLength.toFixed(1)} 字，目标风格偏好长句`);
    suggestions.push('考虑将短句合并为长句');
  }

  return {
    originalStyle: detectedProfile,
    targetStyle: targetProfile,
    differences,
    suggestions,
  };
}
