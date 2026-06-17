/**
 * 双轨 AI 检测器
 * 支持两轮检测：第一轮检测+修复，第二轮验证修复效果
 */

import { BaseAgent, type AgentContext } from './base.js';
import { AI_PATTERNS, WORD_REPLACEMENTS, type DetectionRule } from '../utils/ai-patterns.js';
import { type VoiceProfile, applyVoiceProfile, detectVoiceStyle } from '../utils/voice-profiles.js';

export interface DetectionIssue {
  ruleId: string;
  category: string;
  tier: 1 | 2 | 3;
  matchedText: string;
  position: number;
  suggestion: string;
  confidence: number;
}

export interface DetectionReport {
  original: string;
  rewritten: string;
  firstPassIssues: DetectionIssue[];
  secondPassIssues: DetectionIssue[];
  score: number;  // 0-100，越低越好
  summary: string;
  voiceProfile?: VoiceProfile;
  detectedStyle?: string;
}

export interface DualDetectorOptions {
  voiceProfile?: VoiceProfile;
  enableSecondPass?: boolean;
  maxFixes?: number;
}

export class DualDetector extends BaseAgent {
  name = 'dual-detector';

  constructor(ctx: AgentContext) {
    super(ctx);
  }

  /**
   * 双轨检测：第一轮检测+修复，第二轮验证
   */
  async detect(text: string, options: DualDetectorOptions = {}): Promise<DetectionReport> {
    const { voiceProfile, enableSecondPass = true, maxFixes = 50 } = options;

    // 检测原始文本的风格
    const { detectedProfile } = detectVoiceStyle(text);

    // 第一轮：检测 + 修复
    const firstPass = await this.scanAndFix(text, voiceProfile, maxFixes);

    // 第二轮：验证修复效果（可选）
    let secondPass = { issues: [] as DetectionIssue[], rewritten: firstPass.rewritten };
    if (enableSecondPass) {
      secondPass = await this.verify(firstPass.rewritten);
    }

    return {
      original: text,
      rewritten: secondPass.rewritten,
      firstPassIssues: firstPass.issues,
      secondPassIssues: secondPass.issues,
      score: this.calculateScore(secondPass.issues),
      summary: this.generateSummary(firstPass.issues, secondPass.issues),
      voiceProfile,
      detectedStyle: detectedProfile,
    };
  }

  /**
   * 第一轮：扫描并修复
   */
  private async scanAndFix(
    text: string,
    voiceProfile?: VoiceProfile,
    maxFixes: number = 50
  ): Promise<{ issues: DetectionIssue[]; rewritten: string }> {
    const issues: DetectionIssue[] = [];
    let rewritten = text;
    let fixCount = 0;

    // 1. 应用词替换表
    for (const [word, config] of Object.entries(WORD_REPLACEMENTS)) {
      if (fixCount >= maxFixes) break;

      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(rewritten)) {
        // 根据 tier 决定是否替换
        if (config.tier === 1 || this.shouldReplaceTier(rewritten, word, config.tier)) {
          issues.push({
            ruleId: `word-${word}`,
            category: 'word-replacement',
            tier: config.tier,
            matchedText: word,
            position: rewritten.toLowerCase().indexOf(word.toLowerCase()),
            suggestion: config.replacement,
            confidence: config.tier === 1 ? 0.9 : 0.7,
          });
          rewritten = rewritten.replace(regex, config.replacement);
          fixCount++;
        }
      }
    }

    // 2. 应用模式规则
    for (const rule of AI_PATTERNS) {
      if (fixCount >= maxFixes) break;

      const matches = rewritten.matchAll(rule.pattern);
      for (const match of matches) {
        if (fixCount >= maxFixes) break;

        issues.push({
          ruleId: rule.id,
          category: rule.category,
          tier: rule.tier,
          matchedText: match[0],
          position: match.index || 0,
          suggestion: rule.replacement || '',
          confidence: rule.tier === 1 ? 0.9 : 0.7,
        });
        rewritten = rewritten.replace(match[0], rule.replacement || '');
        fixCount++;
      }
    }

    // 3. 应用声音档案转换
    if (voiceProfile) {
      rewritten = applyVoiceProfile(rewritten, voiceProfile);
    }

    return { issues, rewritten };
  }

  /**
   * 第二轮：验证修复效果
   */
  private async verify(text: string): Promise<{ issues: DetectionIssue[]; rewritten: string }> {
    const issues: DetectionIssue[] = [];

    // 重新扫描残留问题
    for (const rule of AI_PATTERNS) {
      const matches = text.matchAll(rule.pattern);
      for (const match of matches) {
        issues.push({
          ruleId: rule.id,
          category: rule.category,
          tier: rule.tier,
          matchedText: match[0],
          position: match.index || 0,
          suggestion: rule.replacement || '',
          confidence: 0.8,
        });
      }
    }

    // 重新扫描词替换表残留
    for (const [word, config] of Object.entries(WORD_REPLACEMENTS)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(text)) {
        issues.push({
          ruleId: `word-${word}`,
          category: 'word-replacement',
          tier: config.tier,
          matchedText: word,
          position: text.toLowerCase().indexOf(word.toLowerCase()),
          suggestion: config.replacement,
          confidence: config.tier === 1 ? 0.9 : 0.7,
        });
      }
    }

    return { issues, rewritten: text };
  }

  /**
   * 判断 Tier 2/3 词汇是否需要替换
   */
  private shouldReplaceTier(text: string, word: string, tier: 2 | 3): boolean {
    if (tier === 2) {
      // Tier 2: 聚类时改（同一段落出现 2+ 个 Tier 2 词）
      const paragraphs = text.split(/\n\n+/);
      for (const paragraph of paragraphs) {
        const tier2Count = Object.keys(WORD_REPLACEMENTS)
          .filter(w => WORD_REPLACEMENTS[w].tier === 2)
          .filter(w => paragraph.toLowerCase().includes(w.toLowerCase()))
          .length;
        if (tier2Count >= 2) return true;
      }
      return false;
    }

    if (tier === 3) {
      // Tier 3: 高密度时改（全文 3+ 个 Tier 3 词）
      const tier3Count = Object.keys(WORD_REPLACEMENTS)
        .filter(w => WORD_REPLACEMENTS[w].tier === 3)
        .filter(w => text.toLowerCase().includes(w.toLowerCase()))
        .length;
      return tier3Count >= 3;
    }

    return false;
  }

  /**
   * 计算 AI 检测分数（0-100，越低越好）
   */
  private calculateScore(issues: DetectionIssue[]): number {
    if (issues.length === 0) return 0;

    // 按 tier 加权计算
    const weightedSum = issues.reduce((sum, issue) => {
      const weight = issue.tier === 1 ? 3 : issue.tier === 2 ? 2 : 1;
      return sum + weight * issue.confidence;
    }, 0);

    // 归一化到 0-100
    return Math.min(100, Math.round(weightedSum * 5));
  }

  /**
   * 生成检测摘要
   */
  private generateSummary(
    firstPassIssues: DetectionIssue[],
    secondPassIssues: DetectionIssue[]
  ): string {
    const totalIssues = firstPassIssues.length + secondPassIssues.length;
    const tier1Count = firstPassIssues.filter(i => i.tier === 1).length +
                       secondPassIssues.filter(i => i.tier === 1).length;

    if (totalIssues === 0) {
      return '未检测到 AI 写作痕迹';
    }

    if (tier1Count > 0) {
      return `检测到 ${totalIssues} 个 AI 痕迹（其中 ${tier1Count} 个为高优先级），已修复`;
    }

    if (totalIssues < 5) {
      return `检测到少量 AI 痕迹（${totalIssues} 个），已修复`;
    }

    if (totalIssues < 15) {
      return `检测到中等数量 AI 痕迹（${totalIssues} 个），已修复`;
    }

    return `检测到较多 AI 痕迹（${totalIssues} 个），已修复`;
  }

  /**
   * 仅检测不修复（用于审计）
   */
  async detectOnly(text: string): Promise<DetectionIssue[]> {
    const issues: DetectionIssue[] = [];

    // 扫描词替换表
    for (const [word, config] of Object.entries(WORD_REPLACEMENTS)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(text)) {
        issues.push({
          ruleId: `word-${word}`,
          category: 'word-replacement',
          tier: config.tier,
          matchedText: word,
          position: text.toLowerCase().indexOf(word.toLowerCase()),
          suggestion: config.replacement,
          confidence: config.tier === 1 ? 0.9 : 0.7,
        });
      }
    }

    // 扫描模式规则
    for (const rule of AI_PATTERNS) {
      const matches = text.matchAll(rule.pattern);
      for (const match of matches) {
        issues.push({
          ruleId: rule.id,
          category: rule.category,
          tier: rule.tier,
          matchedText: match[0],
          position: match.index || 0,
          suggestion: rule.replacement || '',
          confidence: rule.tier === 1 ? 0.9 : 0.7,
        });
      }
    }

    return issues;
  }
}
