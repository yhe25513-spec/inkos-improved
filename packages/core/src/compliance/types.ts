// ── 合规管理系统类型定义 ──────────────────────────────

/** 平台标识 */
export type Platform =
  | "qidian"      // 起点中文网
  | "tomato"      // 番茄小说
  | "jjwxc"       // 晋江文学城
  | "amazon-kdp"  // Amazon KDP
  | "custom";     // 自定义平台

/** 平台合规策略 */
export interface PlatformPolicy {
  id: Platform;
  name: string;
  /** 是否要求标注AI辅助创作 */
  aiDisclosureRequired: boolean;
  /** AI内容占比上限 (0-1)，undefined 表示无限制 */
  aiContentLimit?: number;
  /** 禁止内容关键词/类型 */
  bannedContent: string[];
  /** 必须包含的标注 */
  requiredLabels: string[];
  /** 每章字数建议范围 */
  suggestedWordCount?: { min: number; max: number };
  /** 额外规则 */
  extraRules?: string[];
}

/** 合规问题类型 */
export type ComplianceIssueType =
  | "ai-disclosure"    // 缺少AI标识
  | "content-limit"    // AI内容超限
  | "banned-content"   // 包含禁止内容
  | "label-missing"    // 缺少必要标注
  | "word-count"       // 字数不符
  | "quality";         // 质量问题

/** 问题严重度 */
export type IssueSeverity = "error" | "warning" | "info";

/** 合规问题 */
export interface ComplianceIssue {
  type: ComplianceIssueType;
  severity: IssueSeverity;
  message: string;
  location?: { chapter: number; line?: number };
  suggestion: string;
}

/** 多检测器交叉验证结果 */
export interface DetectorResult {
  detector: string;       // GPTZero | Originality.ai | Winston AI
  isAIGenerated: boolean;
  confidence: number;     // 0-1
  rawScore?: number;
  error?: string;
}

/** 合规报告 */
export interface ComplianceReportData {
  bookId: string;
  platform: Platform;
  timestamp: string;
  overallScore: number;   // 0-100
  aiContentPercentage: number;
  issues: ComplianceIssue[];
  recommendations: string[];
  detectorResults: DetectorResult[];
  /** 3个检测器中2个判定为人类写作 = 通过 */
  passed: boolean;
}

/** 合规检查选项 */
export interface ComplianceCheckOptions {
  platform: Platform;
  /** 是否运行多检测器交叉验证 */
  runDetectors?: boolean;
  /** 自定义规则 */
  customRules?: ComplianceRule[];
}

/** 自定义合规规则 */
export interface ComplianceRule {
  id: string;
  description: string;
  check: (content: string) => ComplianceIssue[];
}

/** AI使用日志 */
export interface AiUsageLogEntry {
  bookId?: string;
  sessionId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  operation: string;
  duration: number;
  success: boolean;
  errorMessage?: string;
}
