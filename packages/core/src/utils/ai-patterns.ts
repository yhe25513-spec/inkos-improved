/**
 * AI 写作模式检测规则库
 * 基于 avoid-ai-writing 的 49 种模式检测
 */

export interface DetectionRule {
  id: string;
  tier: 1 | 2 | 3;        // 1=必改, 2=聚类时改, 3=高密度时改
  category: 'structural' | 'rhetorical' | 'ai-fingerprint' | 'rhythm';
  pattern: RegExp;
  replacement?: string;
  description: string;
  examples: Array<{ before: string; after: string }>;
}

export interface WordReplacement {
  tier: 1 | 2 | 3;
  replacement: string;
  description?: string;
}

/**
 * 109 词替换表
 * Tier 1: 必改
 * Tier 2: 聚类时改（同一段落出现 2+ 个 Tier 2 词时改）
 * Tier 3: 高密度时改（全文 3+ 个 Tier 3 词时改）
 */
export const WORD_REPLACEMENTS: Record<string, WordReplacement> = {
  // Tier 1: 必改 - AI 高频词
  'commence': { tier: 1, replacement: 'start', description: '开始' },
  'facilitate': { tier: 1, replacement: 'help', description: '促进' },
  'utilize': { tier: 1, replacement: 'use', description: '使用' },
  'demonstrate': { tier: 1, replacement: 'show', description: '展示' },
  'endeavor': { tier: 1, replacement: 'try', description: '努力' },
  'furthermore': { tier: 1, replacement: 'also', description: '此外' },
  'moreover': { tier: 1, replacement: 'also', description: '而且' },
  'consequently': { tier: 1, replacement: 'so', description: '因此' },
  'nevertheless': { tier: 1, replacement: 'but', description: '然而' },
  'subsequently': { tier: 1, replacement: 'then', description: '随后' },
  'henceforth': { tier: 1, replacement: 'from now', description: '从今以后' },
  'aforementioned': { tier: 1, replacement: 'mentioned', description: '前述的' },
  'whereby': { tier: 1, replacement: 'by which', description: '凭此' },
  'thereby': { tier: 1, replacement: 'by that', description: '借此' },
  'herein': { tier: 1, replacement: 'here', description: '在此' },
  'thereof': { tier: 1, replacement: 'of that', description: '其' },
  'hereby': { tier: 1, replacement: 'by this', description: '特此' },

  // Tier 1: AI 偏好词
  'vibrant': { tier: 1, replacement: 'lively', description: '充满活力的' },
  'thriving': { tier: 1, replacement: 'growing', description: '蓬勃发展的' },
  'nestled': { tier: 1, replacement: 'located', description: '坐落于' },
  'watershed': { tier: 1, replacement: 'turning point', description: '转折点' },
  'poised': { tier: 1, replacement: 'ready', description: '准备好的' },
  'robust': { tier: 1, replacement: 'strong', description: '强大的' },
  'seamless': { tier: 1, replacement: 'smooth', description: '无缝的' },
  'comprehensive': { tier: 1, replacement: 'complete', description: '全面的' },
  'unprecedented': { tier: 1, replacement: 'never before seen', description: '前所未有的' },
  'pivotal': { tier: 1, replacement: 'key', description: '关键的' },
  'nuanced': { tier: 1, replacement: 'detailed', description: '细致的' },
  'multifaceted': { tier: 1, replacement: 'complex', description: '多方面的' },
  'holistic': { tier: 1, replacement: 'complete', description: '整体的' },
  'synergy': { tier: 1, replacement: 'cooperation', description: '协同' },
  'leverage': { tier: 1, replacement: 'use', description: '利用' },
  'streamline': { tier: 1, replacement: 'simplify', description: '简化' },
  'optimize': { tier: 1, replacement: 'improve', description: '优化' },
  'enhance': { tier: 1, replacement: 'improve', description: '增强' },
  'foster': { tier: 1, replacement: 'encourage', description: '培养' },
  'cultivate': { tier: 1, replacement: 'develop', description: '培养' },
  'embrace': { tier: 1, replacement: 'accept', description: '拥抱' },
  'navigate': { tier: 1, replacement: 'deal with', description: '应对' },
  'landscape': { tier: 1, replacement: 'area', description: '领域' },
  'realm': { tier: 1, replacement: 'area', description: '领域' },
  'delve': { tier: 1, replacement: 'explore', description: '深入' },
  'embark': { tier: 1, replacement: 'begin', description: '开始' },
  'unfold': { tier: 1, replacement: 'develop', description: '展开' },
  'weave': { tier: 1, replacement: 'combine', description: '编织' },
  'paint': { tier: 1, replacement: 'describe', description: '描绘' },
  'craft': { tier: 1, replacement: 'create', description: '创作' },
  'journey': { tier: 1, replacement: 'trip', description: '旅程' },
  'odyssey': { tier: 1, replacement: 'journey', description: '冒险' },
  'tapestry': { tier: 1, replacement: 'mix', description: '织锦' },
  'mosaic': { tier: 1, replacement: 'mix', description: '马赛克' },
  'symphony': { tier: 1, replacement: 'combination', description: '交响曲' },
  'orchestrate': { tier: 1, replacement: 'organize', description: '精心策划' },
  'galvanize': { tier: 1, replacement: 'inspire', description: '激励' },
  'catalyst': { tier: 1, replacement: 'cause', description: '催化剂' },
  'propel': { tier: 1, replacement: 'push', description: '推动' },
  'spearhead': { tier: 1, replacement: 'lead', description: '带头' },
  'champion': { tier: 1, replacement: 'support', description: '支持' },
  'pioneer': { tier: 1, replacement: 'start', description: '开拓' },
  'innovative': { tier: 1, replacement: 'new', description: '创新的' },
  'cutting-edge': { tier: 1, replacement: 'advanced', description: '前沿的' },
  'state-of-the-art': { tier: 1, replacement: 'latest', description: '最先进的' },
  'groundbreaking': { tier: 1, replacement: 'new', description: '突破性的' },
  'transformative': { tier: 1, replacement: 'changing', description: '变革性的' },
  'revolutionary': { tier: 1, replacement: 'new', description: '革命性的' },
  'paradigm': { tier: 1, replacement: 'model', description: '范式' },
  'ecosystem': { tier: 1, replacement: 'system', description: '生态系统' },
  'stakeholder': { tier: 1, replacement: 'person', description: '利益相关者' },
  'bandwidth': { tier: 1, replacement: 'capacity', description: '带宽' },
  'scalable': { tier: 1, replacement: 'expandable', description: '可扩展的' },
  'actionable': { tier: 1, replacement: 'useful', description: '可执行的' },
  'impactful': { tier: 1, replacement: 'effective', description: '有影响力的' },
  'proactive': { tier: 1, replacement: 'active', description: '积极的' },
  'synergize': { tier: 1, replacement: 'combine', description: '协同' },
  'incentivize': { tier: 1, replacement: 'motivate', description: '激励' },
  'monetize': { tier: 1, replacement: 'earn from', description: '变现' },
  'disruptive': { tier: 1, replacement: 'changing', description: '颠覆性的' },
  'empower': { tier: 1, replacement: 'enable', description: '赋能' },
  'capture': { tier: 1, replacement: 'get', description: '捕捉' },
  'maximize': { tier: 1, replacement: 'increase', description: '最大化' },
  'minimize': { tier: 1, replacement: 'reduce', description: '最小化' },
  'prioritize': { tier: 1, replacement: 'focus on', description: '优先考虑' },
  'implement': { tier: 1, replacement: 'use', description: '实施' },
  'terminate': { tier: 1, replacement: 'end', description: '终止' },
  'ascertain': { tier: 1, replacement: 'find out', description: '查明' },
  'procure': { tier: 1, replacement: 'get', description: '获得' },
  'commensurate': { tier: 1, replacement: 'proportional', description: '相称的' },
  'expedite': { tier: 1, replacement: 'speed up', description: '加速' },
  'exacerbate': { tier: 1, replacement: 'worsen', description: '加剧' },
  'mitigate': { tier: 1, replacement: 'reduce', description: '减轻' },
  'alleviate': { tier: 1, replacement: 'relieve', description: '缓解' },
  'ameliorate': { tier: 1, replacement: 'improve', description: '改善' },
  'underscore': { tier: 1, replacement: 'emphasize', description: '强调' },
  'highlight': { tier: 1, replacement: 'show', description: '突出' },
  'necessitate': { tier: 1, replacement: 'require', description: '需要' },
  'enumerate': { tier: 1, replacement: 'list', description: '列举' },
  'elucidate': { tier: 1, replacement: 'explain', description: '阐明' },
  'explicate': { tier: 1, replacement: 'explain', description: '解释' },
  'delineate': { tier: 1, replacement: 'describe', description: '描述' },
  'substantiate': { tier: 1, replacement: 'prove', description: '证实' },
  'corroborate': { tier: 1, replacement: 'confirm', description: '证实' },
  'subsequent': { tier: 1, replacement: 'later', description: '随后的' },
  'preceding': { tier: 1, replacement: 'earlier', description: '之前的' },
  'concurrent': { tier: 1, replacement: 'simultaneous', description: '同时的' },
  'thereafter': { tier: 1, replacement: 'after that', description: '此后' },
  'hereafter': { tier: 1, replacement: 'from now', description: '此后' },
  'forthwith': { tier: 1, replacement: 'immediately', description: '立即' },
  'notwithstanding': { tier: 1, replacement: 'despite', description: '尽管' },
  'hitherto': { tier: 1, replacement: 'until now', description: '至今' },
  'whilst': { tier: 1, replacement: 'while', description: '当...时' },
  'amongst': { tier: 1, replacement: 'among', description: '在...之中' },
  'amidst': { tier: 1, replacement: 'amid', description: '在...之中' },
  'unto': { tier: 1, replacement: 'to', description: '到' },
  'nigh': { tier: 1, replacement: 'near', description: '接近' },
  'betimes': { tier: 1, replacement: 'early', description: '早' },
  'anon': { tier: 1, replacement: 'soon', description: '不久' },
  'perchance': { tier: 1, replacement: 'perhaps', description: '也许' },
  'ere': { tier: 1, replacement: 'before', description: '在...之前' },
  'oft': { tier: 1, replacement: 'often', description: '经常' },
  'betwixt': { tier: 1, replacement: 'between', description: '在...之间' },
  'hence': { tier: 1, replacement: 'so', description: '因此' },
  'thus': { tier: 1, replacement: 'so', description: '因此' },
  'therein': { tier: 1, replacement: 'there', description: '在那里' },
  'wherein': { tier: 1, replacement: 'in which', description: '在其中' },
  'wherewith': { tier: 1, replacement: 'with which', description: '用以' },
  'whereto': { tier: 1, replacement: 'to which', description: '向何处' },
  'herewith': { tier: 1, replacement: 'with this', description: '随此' },
  'aforesaid': { tier: 1, replacement: 'mentioned', description: '上述的' },
  'hereinafter': { tier: 1, replacement: 'below', description: '以下' },
  'hereinbefore': { tier: 1, replacement: 'above', description: '以上' },
  'thereinabove': { tier: 1, replacement: 'above', description: '以上' },
  'thereinbelow': { tier: 1, replacement: 'below', description: '以下' },
};

/**
 * 49 种 AI 写作模式
 */
export const AI_PATTERNS: DetectionRule[] = [
  // 结构性模式 (Structural)
  {
    id: 'certainly',
    tier: 1,
    category: 'structural',
    pattern: /^Certainly[!.]?\s/im,
    replacement: '',
    description: 'AI 开头语 "Certainly!"',
    examples: [
      { before: 'Certainly! The system works...', after: 'The system works...' },
    ],
  },
  {
    id: 'in-conclusion',
    tier: 1,
    category: 'structural',
    pattern: /In conclusion[,!]?\s/gi,
    replacement: '',
    description: 'AI 结尾语 "In conclusion"',
    examples: [
      { before: 'In conclusion, this is important.', after: 'This is important.' },
    ],
  },
  {
    id: 'it-is-important',
    tier: 1,
    category: 'structural',
    pattern: /It is important to (?:note|understand|remember|consider)[^.]*\./gi,
    replacement: '',
    description: 'AI 强调语 "It is important to..."',
    examples: [
      { before: 'It is important to note that this works.', after: 'This works.' },
    ],
  },
  {
    id: 'it-is-worth',
    tier: 1,
    category: 'structural',
    pattern: /It is worth (?:noting|mentioning|pointing out)[^.]*\./gi,
    replacement: '',
    description: 'AI 强调语 "It is worth noting..."',
    examples: [
      { before: 'It is worth noting that this is true.', after: 'This is true.' },
    ],
  },
  {
    id: 'dive-into',
    tier: 1,
    category: 'structural',
    pattern: /(?:let(?:'s| us)|we(?:'ll| will)) dive into/gi,
    replacement: 'look at',
    description: 'AI 过渡语 "Let\'s dive into"',
    examples: [
      { before: "Let's dive into the details.", after: 'Look at the details.' },
    ],
  },
  {
    id: 'delve-into',
    tier: 1,
    category: 'structural',
    pattern: /(?:let(?:'s| us)|we(?:'ll| will)) delve into/gi,
    replacement: 'explore',
    description: 'AI 过渡语 "Let\'s delve into"',
    examples: [
      { before: "Let's delve into the topic.", after: 'Explore the topic.' },
    ],
  },
  {
    id: 'explore-the-world',
    tier: 1,
    category: 'structural',
    pattern: /explore the world of/gi,
    replacement: 'learn about',
    description: 'AI 过渡语 "explore the world of"',
    examples: [
      { before: 'Explore the world of AI.', after: 'Learn about AI.' },
    ],
  },
  {
    id: 'in-this-article',
    tier: 1,
    category: 'structural',
    pattern: /In this (?:article|essay|piece|post)[,.]?\s/gi,
    replacement: '',
    description: 'AI 开头语 "In this article"',
    examples: [
      { before: 'In this article, we discuss...', after: 'We discuss...' },
    ],
  },
  {
    id: 'in-summary',
    tier: 1,
    category: 'structural',
    pattern: /In summary[,!]?\s/gi,
    replacement: '',
    description: 'AI 结尾语 "In summary"',
    examples: [
      { before: 'In summary, this is the case.', after: 'This is the case.' },
    ],
  },
  {
    id: 'to-summarize',
    tier: 1,
    category: 'structural',
    pattern: /To summarize[,!]?\s/gi,
    replacement: '',
    description: 'AI 结尾语 "To summarize"',
    examples: [
      { before: 'To summarize, this is true.', after: 'This is true.' },
    ],
  },

  // 修辞模式 (Rhetorical)
  {
    id: 'watershed-moment',
    tier: 1,
    category: 'rhetorical',
    pattern: /watershed moment/gi,
    replacement: 'turning point',
    description: '夸大修辞 "watershed moment"',
    examples: [
      { before: 'This is a watershed moment.', after: 'This is a turning point.' },
    ],
  },
  {
    id: 'game-changer',
    tier: 1,
    category: 'rhetorical',
    pattern: /game[- ]?changer/gi,
    replacement: 'important change',
    description: '夸大修辞 "game-changer"',
    examples: [
      { before: 'This is a game-changer.', after: 'This is an important change.' },
    ],
  },
  {
    id: 'paradigm-shift',
    tier: 1,
    category: 'rhetorical',
    pattern: /paradigm shift/gi,
    replacement: 'big change',
    description: '夸大修辞 "paradigm shift"',
    examples: [
      { before: 'This is a paradigm shift.', after: 'This is a big change.' },
    ],
  },
  {
    id: 'cutting-edge',
    tier: 1,
    category: 'rhetorical',
    pattern: /cutting[- ]?edge/gi,
    replacement: 'advanced',
    description: '夸大修辞 "cutting-edge"',
    examples: [
      { before: 'This is cutting-edge technology.', after: 'This is advanced technology.' },
    ],
  },
  {
    id: 'state-of-the-art',
    tier: 1,
    category: 'rhetorical',
    pattern: /state[- ]of[- ]the[- ]art/gi,
    replacement: 'latest',
    description: '夸大修辞 "state-of-the-art"',
    examples: [
      { before: 'This is state-of-the-art.', after: 'This is the latest.' },
    ],
  },
  {
    id: 'groundbreaking',
    tier: 1,
    category: 'rhetorical',
    pattern: /\bgroundbreaking\b/gi,
    replacement: 'new',
    description: '夸大修辞 "groundbreaking"',
    examples: [
      { before: 'This is groundbreaking research.', after: 'This is new research.' },
    ],
  },
  {
    id: 'revolutionary',
    tier: 1,
    category: 'rhetorical',
    pattern: /\brevolutionary\b/gi,
    replacement: 'new',
    description: '夸大修辞 "revolutionary"',
    examples: [
      { before: 'This is a revolutionary approach.', after: 'This is a new approach.' },
    ],
  },
  {
    id: 'unprecedented',
    tier: 1,
    category: 'rhetorical',
    pattern: /\bunprecedented\b/gi,
    replacement: 'new',
    description: '夸大修辞 "unprecedented"',
    examples: [
      { before: 'This is an unprecedented event.', after: 'This is a new event.' },
    ],
  },
  {
    id: 'transformative',
    tier: 1,
    category: 'rhetorical',
    pattern: /\btransformative\b/gi,
    replacement: 'changing',
    description: '夸大修辞 "transformative"',
    examples: [
      { before: 'This is a transformative experience.', after: 'This is a changing experience.' },
    ],
  },

  // AI 指纹 (AI Fingerprint)
  {
    id: 'serves-as',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bserves as\b/gi,
    replacement: 'is',
    description: 'AI 系动词回避 "serves as"',
    examples: [
      { before: 'The platform serves as a hub.', after: 'The platform is a hub.' },
    ],
  },
  {
    id: 'functions-as',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bfunctions as\b/gi,
    replacement: 'is',
    description: 'AI 系动词回避 "functions as"',
    examples: [
      { before: 'The tool functions as a bridge.', after: 'The tool is a bridge.' },
    ],
  },
  {
    id: 'acts-as',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bacts as\b/gi,
    replacement: 'is',
    description: 'AI 系动词回避 "acts as"',
    examples: [
      { before: 'This acts as a filter.', after: 'This is a filter.' },
    ],
  },
  {
    id: 'boasting',
    tier: 2,
    category: 'ai-fingerprint',
    pattern: /\bboasting\b/gi,
    replacement: 'with',
    description: 'AI 系动词回避 "boasting"',
    examples: [
      { before: 'featuring dashboards, boasting queries', after: 'with dashboards, with queries' },
    ],
  },
  {
    id: 'featuring',
    tier: 2,
    category: 'ai-fingerprint',
    pattern: /\bfeaturing\b/gi,
    replacement: 'with',
    description: 'AI 系动词回避 "featuring"',
    examples: [
      { before: 'The product featuring AI capabilities', after: 'The product with AI capabilities' },
    ],
  },
  {
    id: 'offering',
    tier: 2,
    category: 'ai-fingerprint',
    pattern: /\boffering\b/gi,
    replacement: 'with',
    description: 'AI 系动词回避 "offering"',
    examples: [
      { before: 'A platform offering various tools', after: 'A platform with various tools' },
    ],
  },
  {
    id: 'providing',
    tier: 2,
    category: 'ai-fingerprint',
    pattern: /\bproviding\b/gi,
    replacement: 'with',
    description: 'AI 系动词回避 "providing"',
    examples: [
      { before: 'A service providing solutions', after: 'A service with solutions' },
    ],
  },
  {
    id: 'leveraging',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bleveraging\b/gi,
    replacement: 'using',
    description: 'AI 偏好词 "leveraging"',
    examples: [
      { before: 'Leveraging AI technology', after: 'Using AI technology' },
    ],
  },
  {
    id: 'harnessing',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bharnessing\b/gi,
    replacement: 'using',
    description: 'AI 偏好词 "harnessing"',
    examples: [
      { before: 'Harnessing the power of data', after: 'Using the power of data' },
    ],
  },
  {
    id: 'empowering',
    tier: 1,
    category: 'ai-fingerprint',
    pattern: /\bempowering\b/gi,
    replacement: 'helping',
    description: 'AI 偏好词 "empowering"',
    examples: [
      { before: 'Empowering users to succeed', after: 'Helping users succeed' },
    ],
  },

  // 节奏模式 (Rhythm)
  {
    id: 'over-polished',
    tier: 3,
    category: 'rhythm',
    pattern: /^(?:Moreover|Additionally|Furthermore|Consequently)[,!]?\s/gm,
    replacement: '',
    description: '过渡词堆叠',
    examples: [
      { before: 'Moreover, X. Furthermore, Y.', after: 'X. Also, Y.' },
    ],
  },
  {
    id: 'uniform-sentences',
    tier: 3,
    category: 'rhythm',
    pattern: /(?:^|\.\s+)(?:The|This|That|These|Those) [a-z]+ (?:is|are|was|were|has|have|had) [a-z]+/gm,
    replacement: '',
    description: '句式单调（主语+be+形容词）',
    examples: [
      { before: 'The system is powerful. The platform is fast.', after: 'The system is powerful. It runs fast.' },
    ],
  },
  {
    id: 'passive-voice',
    tier: 2,
    category: 'rhythm',
    pattern: /\b(?:is|are|was|were|be|been|being) (?:\w+ed|built|created|designed|developed|implemented|established|founded|launched|introduced|established)\b/gi,
    replacement: '',
    description: '被动语态过多',
    examples: [
      { before: 'The system was built by the team.', after: 'The team built the system.' },
    ],
  },
];

/**
 * 获取所有 Tier 1 词汇
 */
export function getTier1Words(): string[] {
  return Object.entries(WORD_REPLACEMENTS)
    .filter(([_, config]) => config.tier === 1)
    .map(([word, _]) => word);
}

/**
 * 获取所有 Tier 2 词汇
 */
export function getTier2Words(): string[] {
  return Object.entries(WORD_REPLACEMENTS)
    .filter(([_, config]) => config.tier === 2)
    .map(([word, _]) => word);
}

/**
 * 获取所有 Tier 3 词汇
 */
export function getTier3Words(): string[] {
  return Object.entries(WORD_REPLACEMENTS)
    .filter(([_, config]) => config.tier === 3)
    .map(([word, _]) => word);
}

/**
 * 按类别获取模式
 */
export function getPatternsByCategory(category: DetectionRule['category']): DetectionRule[] {
  return AI_PATTERNS.filter(p => p.category === category);
}

/**
 * 按 tier 获取模式
 */
export function getPatternsByTier(tier: 1 | 2 | 3): DetectionRule[] {
  return AI_PATTERNS.filter(p => p.tier === tier);
}
