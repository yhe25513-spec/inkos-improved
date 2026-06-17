// ── 标签生成器 ────────────────────────────────────────
// 生成合规标签和声明

import type { Platform } from "./types.js";

/**
 * 标签配置
 */
interface LabelConfig {
  /** 平台名称 */
  platformName: string;
  /** AI辅助声明 */
  aiAssistedLabel: string;
  /** AI生成声明 */
  aiGeneratedLabel: string;
  /** 声明模板 */
  declarationTemplate: string;
}

/**
 * 平台标签配置
 */
const LABEL_CONFIGS: Record<Platform, LabelConfig> = {
  qidian: {
    platformName: "起点中文网",
    aiAssistedLabel: "本作品使用AI辅助创作",
    aiGeneratedLabel: "本作品部分章节由AI生成",
    declarationTemplate: "【AI创作声明】本作品使用AI辅助创作工具，已进行人工审核和编辑。",
  },
  tomato: {
    platformName: "番茄小说",
    aiAssistedLabel: "AI辅助创作",
    aiGeneratedLabel: "AI生成内容",
    declarationTemplate: "本作品使用AI辅助创作，内容已通过人工审核。",
  },
  jjwxc: {
    platformName: "晋江文学城",
    aiAssistedLabel: "AI辅助创作",
    aiGeneratedLabel: "AI生成内容",
    declarationTemplate: "【AI创作声明】本作品使用AI辅助创作，已进行人工编辑和润色。",
  },
  "amazon-kdp": {
    platformName: "Amazon KDP",
    aiAssistedLabel: "AI-assisted content",
    aiGeneratedLabel: "AI-generated content",
    declarationTemplate: "This book was created with AI assistance and has been reviewed and edited by a human author.",
  },
  custom: {
    platformName: "自定义平台",
    aiAssistedLabel: "AI辅助创作",
    aiGeneratedLabel: "AI生成内容",
    declarationTemplate: "本作品使用AI辅助创作。",
  },
};

/**
 * 标签生成器
 */
export class LabelGenerator {
  /**
   * 生成章节AI声明
   */
  generateChapterDeclaration(
    platform: Platform,
    aiPercentage: number,
    hasHumanEdit: boolean = true,
  ): string {
    const config = LABEL_CONFIGS[platform] ?? LABEL_CONFIGS.custom;

    if (aiPercentage < 0.1) {
      return ""; // AI含量很低，不需要声明
    }

    if (aiPercentage > 0.5 && hasHumanEdit) {
      return `[${config.aiGeneratedLabel}] ${config.declarationTemplate}`;
    }

    return `[${config.aiAssistedLabel}] ${config.declarationTemplate}`;
  }

  /**
   * 生成书籍级声明
   */
  generateBookDeclaration(platform: Platform): string {
    const config = LABEL_CONFIGS[platform] ?? LABEL_CONFIGS.custom;
    return config.declarationTemplate;
  }

  /**
   * 生成元数据标签
   */
  generateMetadataLabels(
    platform: Platform,
    aiPercentage: number,
  ): Record<string, string> {
    const config = LABEL_CONFIGS[platform] ?? LABEL_CONFIGS.custom;

    return {
      "ai-usage": aiPercentage > 0.5 ? "generated" : "assisted",
      "ai-percentage": `${(aiPercentage * 100).toFixed(1)}%`,
      "platform": platform,
      "platform-name": config.platformName,
      "declaration": this.generateChapterDeclaration(platform, aiPercentage),
    };
  }

  /**
   * 获取平台支持的标签列表
   */
  getSupportedLabels(platform: Platform): string[] {
    const config = LABEL_CONFIGS[platform] ?? LABEL_CONFIGS.custom;
    return [config.aiAssistedLabel, config.aiGeneratedLabel];
  }
}
