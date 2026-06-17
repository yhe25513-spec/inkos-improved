/**
 * 伏笔压力分析器
 * 分析伏笔的处理压力，建议回收/推进时机
 */

import type { StoredHook } from "../state/memory-db.js";
import type { HookPayoffTiming } from "../models/runtime-state.js";
import {
  normalizeStoredHookStatus,
  filterActiveHooks,
} from "./hook-lifecycle.js";

export interface HookPressureAnalysis {
  hookId: string;
  hookText: string;
  currentPressure: number;      // 0-100，越高越需要处理
  reasons: string[];            // 压力原因
  suggestedAction: 'advance' | 'resolve' | 'defer';
  suggestedChapter: number;     // 建议处理的章节
  confidence: number;           // 置信度
  timing: HookPayoffTiming | undefined;
}

export interface PressureReport {
  chapter: number;
  analyses: HookPressureAnalysis[];
  topPressureHooks: HookPressureAnalysis[];
  summary: string;
}

/**
 * 分析单个伏笔的压力
 */
export function analyzeHookPressure(
  hook: StoredHook,
  currentChapter: number,
  chapterSummaries: string,
  allHooks: StoredHook[]
): HookPressureAnalysis {
  let pressure = 0;
  const reasons: string[] = [];

  // 因素 1：年龄（埋了多久）
  const age = currentChapter - hook.startChapter;
  if (age > 30) {
    pressure += 35;
    reasons.push(`伏笔已埋 ${age} 章，超过 30 章阈值`);
  } else if (age > 20) {
    pressure += 25;
    reasons.push(`伏笔已埋 ${age} 章，接近处理时机`);
  } else if (age > 10) {
    pressure += 15;
    reasons.push(`伏笔已埋 ${age} 章，需要关注`);
  }

  // 因素 2：推进次数
  const advanceCount = hook.advancedCount || 0;
  if (advanceCount === 0 && age > 10) {
    pressure += 20;
    reasons.push(`埋了 ${age} 章但未推进`);
  } else if (advanceCount > 0 && advanceCount < 2 && age > 15) {
    pressure += 10;
    reasons.push(`只推进了 ${advanceCount} 次`);
  }

  // 因素 3：最后推进时间
  if (hook.lastAdvancedChapter > 0) {
    const chaptersSinceAdvance = currentChapter - hook.lastAdvancedChapter;
    if (chaptersSinceAdvance > 15) {
      pressure += 25;
      reasons.push(`上次推进在 ${chaptersSinceAdvance} 章前`);
    } else if (chaptersSinceAdvance > 10) {
      pressure += 15;
      reasons.push(`上次推进在 ${chaptersSinceAdvance} 章前`);
    }
  }

  // 因素 4：核心伏笔
  if (hook.coreHook) {
    pressure += 15;
    reasons.push('核心伏笔，读者期待值高');
  }

  // 因素 5：依赖关系
  if (hook.dependsOn && hook.dependsOn.length > 0) {
    pressure += 10;
    reasons.push(`依赖 ${hook.dependsOn.length} 个其他伏笔`);
  }

  // 因素 6：同类伏笔过多
  const sameTypeHooks = allHooks.filter(h =>
    h.type === hook.type && h.hookId !== hook.hookId
  );
  if (sameTypeHooks.length > 3) {
    pressure += 10;
    reasons.push(`同类伏笔过多（${sameTypeHooks.length} 个）`);
  }

  // 因素 7：预期回收时机
  if (hook.expectedPayoff) {
    const timingMatch = hook.expectedPayoff.match(/第(\d+)章/);
    if (timingMatch) {
      const expectedChapter = parseInt(timingMatch[1], 10);
      const diff = expectedChapter - currentChapter;
      if (diff < 0) {
        pressure += 30;
        reasons.push(`已超过预期回收章节 ${Math.abs(diff)} 章`);
      } else if (diff <= 5) {
        pressure += 15;
        reasons.push(`接近预期回收章节`);
      }
    }
  }

  // 计算建议操作
  let suggestedAction: 'advance' | 'resolve' | 'defer';
  let suggestedChapter: number;

  if (pressure > 70) {
    suggestedAction = 'resolve';
    suggestedChapter = currentChapter + 1;
  } else if (pressure > 40) {
    suggestedAction = 'advance';
    suggestedChapter = currentChapter + Math.ceil((100 - pressure) / 20);
  } else {
    suggestedAction = 'defer';
    suggestedChapter = currentChapter + 10;
  }

  return {
    hookId: hook.hookId,
    hookText: hook.notes || hook.expectedPayoff || hook.type,
    currentPressure: Math.min(100, pressure),
    reasons,
    suggestedAction,
    suggestedChapter,
    confidence: calculateConfidence(reasons.length),
    timing: hook.payoffTiming as HookPayoffTiming | undefined,
  };
}

/**
 * 分析所有活跃伏笔的压力
 */
export function analyzeAllHooksPressure(
  hooks: ReadonlyArray<StoredHook>,
  currentChapter: number,
  chapterSummaries: string
): PressureReport {
  const activeHooks = filterActiveHooks([...hooks]);

  const analyses = activeHooks.map(hook =>
    analyzeHookPressure(hook, currentChapter, chapterSummaries, [...hooks])
  );

  // 按压力值排序
  const sorted = [...analyses].sort((a, b) => b.currentPressure - a.currentPressure);

  // 取压力最高的 5 个
  const topPressureHooks = sorted.slice(0, 5);

  return {
    chapter: currentChapter,
    analyses,
    topPressureHooks,
    summary: generatePressureSummary(analyses),
  };
}

/**
 * 计算置信度
 */
function calculateConfidence(reasonCount: number): number {
  if (reasonCount >= 5) return 0.9;
  if (reasonCount >= 3) return 0.7;
  if (reasonCount >= 1) return 0.5;
  return 0.3;
}

/**
 * 生成压力摘要
 */
function generatePressureSummary(analyses: HookPressureAnalysis[]): string {
  if (analyses.length === 0) {
    return "没有需要处理的活跃伏笔";
  }

  const highPressure = analyses.filter(a => a.currentPressure > 70);
  const mediumPressure = analyses.filter(a => a.currentPressure > 40 && a.currentPressure <= 70);
  const lowPressure = analyses.filter(a => a.currentPressure <= 40);

  const parts: string[] = [];
  if (highPressure.length > 0) {
    parts.push(`${highPressure.length} 个需要立即处理`);
  }
  if (mediumPressure.length > 0) {
    parts.push(`${mediumPressure.length} 个需要关注`);
  }
  if (lowPressure.length > 0) {
    parts.push(`${lowPressure.length} 个暂可延后`);
  }

  return `共 ${analyses.length} 个活跃伏笔：${parts.join("、")}`;
}

/**
 * 获取伏笔压力报告的 Markdown 格式
 */
export function formatPressureReportMarkdown(report: PressureReport): string {
  let md = `# 🪝 伏笔压力报告\n\n`;
  md += `**当前章节**: ${report.chapter}\n`;
  md += `**活跃伏笔**: ${report.analyses.length} 个\n\n`;

  if (report.topPressureHooks.length > 0) {
    md += `## 🔥 需要关注的伏笔\n\n`;

    for (const analysis of report.topPressureHooks) {
      const pressureEmoji = analysis.currentPressure > 70 ? "🔴" :
                           analysis.currentPressure > 40 ? "🟡" : "🟢";
      const actionEmoji = analysis.suggestedAction === "resolve" ? "♻️" :
                         analysis.suggestedAction === "advance" ? "➡️" : "⏳";

      md += `### ${pressureEmoji} ${analysis.hookText}\n\n`;
      md += `- **压力值**: ${analysis.currentPressure}/100\n`;
      md += `- **建议操作**: ${actionEmoji} ${analysis.suggestedAction === "resolve" ? "回收" : analysis.suggestedAction === "advance" ? "推进" : "延后"}\n`;
      md += `- **建议章节**: 第 ${analysis.suggestedChapter} 章\n`;
      md += `- **置信度**: ${(analysis.confidence * 100).toFixed(0)}%\n`;

      if (analysis.reasons.length > 0) {
        md += `- **原因**:\n`;
        for (const reason of analysis.reasons) {
          md += `  - ${reason}\n`;
        }
      }
      md += `\n`;
    }
  }

  md += `## 📊 压力分布\n\n`;
  md += `| 压力等级 | 数量 | 比例 |\n`;
  md += `|----------|------|------|\n`;

  const high = report.analyses.filter(a => a.currentPressure > 70).length;
  const medium = report.analyses.filter(a => a.currentPressure > 40 && a.currentPressure <= 70).length;
  const low = report.analyses.filter(a => a.currentPressure <= 40).length;
  const total = report.analyses.length || 1;

  md += `| 🔴 高 (>70) | ${high} | ${(high / total * 100).toFixed(0)}% |\n`;
  md += `| 🟡 中 (40-70) | ${medium} | ${(medium / total * 100).toFixed(0)}% |\n`;
  md += `| 🟢 低 (<40) | ${low} | ${(low / total * 100).toFixed(0)}% |\n`;

  md += `\n---\n`;
  md += `*报告由 InkOS 伏笔压力分析系统生成*\n`;

  return md;
}
