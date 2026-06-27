// ── 真人感画像数据结构 ──────────────────────────────────
// 真人样本分析得到的12维写作指纹 + 风格注入参数

/**
 * 12维写作指纹
 * 从真人样本中提取的特征向量，用于描述作者的"真人感"风格
 */
export interface HumanityFingerprint {
  // ── 句法维度 ────────────────────────────────────────
  /** 句子长度标准差（字数），越高表示句长变化越大 */
  sentenceLengthStd: number;

  /** 突发性指数：长句后紧跟短句的概率，>0.15 表示真人写作特征明显 */
  burstIndex: number;

  /** 感叹号密度（每千字），真人写作通常 > 5 */
  exclamationDensity: number;

  /** 问号密度（每千字） */
  questionDensity: number;

  /** 犹豫词密度（每千字），包含"好像/大概/可能/似乎"等词 */
  hesitationWordDensity: number;

  // ── 叙事维度 ────────────────────────────────────────
  /** 对话打断率：对话中被"——"或"..."打断的比例，>0.1 表示对话不完美 */
  dialogueInterruptRate: number;

  /** 时间碎片占比：不推动剧情的过渡段落占比，真人写作通常 0.15-0.25 */
  timeFragmentRatio: number;

  /** 身体部位词汇密度（每千字），真人写作通常 > 10 */
  bodyPartDensity: number;

  /** 粗话/口语密度（每千字），包含"妈的/靠/艹"等词 */
  colloquialDensity: number;

  /** 视角偏移率：从主角视角跳出的频率，真人写作会有轻微漂移 */
  perspectiveShiftRate: number;

  // ── 角色维度 ────────────────────────────────────────
  /** 自我矛盾率：主角有自我矛盾表达的句子占比 */
  selfContradictionRate: number;

  /** 不体面道具率：非功能性道具出现频率（"有缺口的杯子"等） */
  unseemlyItemRate: number;
}

/**
 * 风格注入参数
 * 从指纹反推，用于指导 AI 写作时的风格调整
 */
export interface StyleInjection {
  /** 犹豫词出现频率 0-1，值越高 AI 会更多使用"好像/大概/可能" */
  hesitationFrequency: number;

  /** 对话打断频率 0-1，值越高对话中越容易出现打断 */
  dialogueInterruptFrequency: number;

  /** 视角漂移倾向 0-1，值越高越容易跳出主角视角 */
  perspectiveShiftTendency: number;

  /** 身体存在感程度 0-1，值越高越会写主角的身体感受 */
  bodyPresenceLevel: number;

  /** 不体面道具偏好 0-1，值越高场景中越容易出现磨损的物品 */
  unseemlyItemPreference: number;

  /** 主角缺陷偏好 0-1，值越高主角越容易做"不完美"的小事 */
  protagonistFlawPreference: number;

  /** 时间碎片偏好 0-1，值越高越会写"什么都不发生"的过渡 */
  timeFragmentPreference: number;

  /** 沉默层偏好 0-1，值越高越会用动作暗示代替显性情绪描写 */
  silenceLayerPreference: number;
}

/**
 * 真人感画像
 * 完整的用户/书籍真人感配置
 */
export interface HumanityProfile {
  /** 唯一标识 */
  id: string;

  /** 关联的书籍 ID，null 表示全局画像 */
  bookId: string | null;

  /** 12维写作指纹 */
  fingerprint: HumanityFingerprint;

  /** 风格注入参数 */
  styleInjection: StyleInjection;

  /** 学习过的样本文件名列表 */
  learnedFromSamples: string[];

  /** 画像创建时间 */
  createdAt: string;

  /** 最后更新时间 */
  updatedAt: string;
}

/**
 * 呼吸点
 * 标记在章节中需要插入"呼吸段"的位置
 */
export interface BreathingPoint {
  /** 插入在哪个场景之后 */
  afterScene: string;

  /** 呼吸段类型 */
  type: BreathingType;

  /** 优先级（用于排序） */
  priority: number;
}

/**
 * 呼吸段类型枚举
 */
export type BreathingType =
  | "physical-action"   // 身体动作（揉太阳穴、捏鼻梁）
  | "environment-sense"  // 环境感知（远处传来声音）
  | "unnecessary-dialogue" // 不必要对话（一句话的闲聊）
  | "internal-wander"   // 内心游走（想起某件无关的事）
  | "sensory-detail"   // 感官细节（嘴里的苦味）
  | "prop-interaction" // 道具互动（摸口袋里的钥匙）
  | "pure-breathing";   // 纯呼吸段（占位符，生成时替换为具体类型）

/**
 * 写作上下文
 * 用于生成呼吸段和矛盾性行为时的参考信息
 */
export interface WritingContext {
  /** 主角名称 */
  protagonistName: string;

  /** 主角性别（用于选择合适的表达） */
  protagonistGender?: "male" | "female" | "unknown";

  /** 当前章节的主要情绪基调 */
  currentEmotion?: string;

  /** 章节总字数（用于计算呼吸段密度） */
  chapterWordCount: number;

  /** 已有的身体描写数量（避免重复） */
  existingBodyDescriptions: string[];

  /** 已有的道具列表（避免重复） */
  existingProps: string[];
}

/**
 * 默认的真人感画像（用于冷启动）
 */
export const DEFAULT_HUMANITY_FINGERPRINT: HumanityFingerprint = {
  sentenceLengthStd: 15,
  burstIndex: 0.12,
  exclamationDensity: 8,
  questionDensity: 5,
  hesitationWordDensity: 10,
  dialogueInterruptRate: 0.08,
  timeFragmentRatio: 0.18,
  bodyPartDensity: 12,
  colloquialDensity: 5,
  perspectiveShiftRate: 0.05,
  selfContradictionRate: 0.03,
  unseemlyItemRate: 0.02,
};

export const DEFAULT_STYLE_INJECTION: StyleInjection = {
  hesitationFrequency: 0.15,
  dialogueInterruptFrequency: 0.1,
  perspectiveShiftTendency: 0.05,
  bodyPresenceLevel: 0.3,
  unseemlyItemPreference: 0.1,
  protagonistFlawPreference: 0.1,
  timeFragmentPreference: 0.15,
  silenceLayerPreference: 0.2,
};

/**
 * 创建默认的真人感画像
 */
export function createDefaultHumanityProfile(bookId?: string): HumanityProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    bookId: bookId || null,
    fingerprint: { ...DEFAULT_HUMANITY_FINGERPRINT },
    styleInjection: { ...DEFAULT_STYLE_INJECTION },
    learnedFromSamples: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 从指纹计算风格注入参数
 * 将 12 维指纹值映射为 0-1 的注入强度
 */
export function deriveStyleInjectionFromFingerprint(
  fp: HumanityFingerprint
): StyleInjection {
  return {
    // 犹豫词密度映射到 0.05-0.4
    hesitationFrequency: Math.min(0.4, Math.max(0.05, fp.hesitationWordDensity / 50)),

    // 对话打断率映射到 0.05-0.35
    dialogueInterruptFrequency: Math.min(0.35, Math.max(0.05, fp.dialogueInterruptRate * 3)),

    // 视角偏移率映射到 0.02-0.2
    perspectiveShiftTendency: Math.min(0.2, Math.max(0.02, fp.perspectiveShiftRate * 2)),

    // 身体部位密度映射到 0.15-0.5
    bodyPresenceLevel: Math.min(0.5, Math.max(0.15, fp.bodyPartDensity / 40)),

    // 不体面道具率映射到 0.05-0.3
    unseemlyItemPreference: Math.min(0.3, Math.max(0.05, fp.unseemlyItemRate * 8)),

    // 自我矛盾率映射到 0.05-0.25
    protagonistFlawPreference: Math.min(0.25, Math.max(0.05, fp.selfContradictionRate * 5)),

    // 时间碎片占比映射到 0.1-0.3
    timeFragmentPreference: Math.min(0.3, Math.max(0.1, fp.timeFragmentRatio)),

    // 综合犹豫词和自我矛盾计算沉默层偏好
    silenceLayerPreference: Math.min(
      0.4,
      Math.max(0.1, (fp.hesitationWordDensity / 100 + fp.selfContradictionRate * 3))
    ),
  };
}
