/**
 * 健康检查器
 * 提供一键式的世界观健康检查
 */

import { BaseAgent, type AgentContext } from "./base.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { EntityDB } from "../state/entity-db.js";
import { analyzeHookHealth } from "../utils/hook-health.js";
import { analyzeAllHooksPressure, type PressureReport } from "../utils/hook-pressure.js";
import { parsePendingHooksMarkdown } from "../utils/story-markdown.js";

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  score: number;        // 0-100
  summary: string;
  issues: string[];
  recommendations: string[];
}

export interface HealthReport {
  timestamp: number;
  bookId: string;
  chapterCount: number;
  overallScore: number;
  checks: HealthCheckResult[];
  recommendations: string[];
  pressureReport?: PressureReport;
}

export class HealthChecker extends BaseAgent {
  name = "health-checker";

  constructor(ctx: AgentContext) {
    super(ctx);
  }

  /**
   * 运行完整的健康检查
   */
  async runHealthCheck(bookId: string): Promise<HealthReport> {
    const bookDir = join(this.ctx.projectRoot, "books", bookId);
    const storyDir = join(bookDir, "story");

    // 并行运行所有检查
    const checks = await Promise.all([
      this.checkTruthFilesIntegrity(storyDir),
      this.checkHookHealth(storyDir, bookId),
      this.checkCharacterConsistency(storyDir),
      this.checkEntityHealth(bookDir),
      this.checkStyleDrift(storyDir),
    ]);

    // 计算综合评分
    const overallScore = Math.round(
      checks.reduce((sum, c) => sum + c.score, 0) / checks.length
    );

    // 生成建议
    const recommendations = this.generateRecommendations(checks);

    // 获取伏笔压力报告
    let pressureReport: PressureReport | undefined;
    try {
      const hooksPath = join(storyDir, "pending_hooks.md");
      const hooksContent = await readFile(hooksPath, "utf-8").catch(() => "");
      const hooks = parsePendingHooksMarkdown(hooksContent);

      const summariesPath = join(storyDir, "chapter_summaries.md");
      const summariesContent = await readFile(summariesPath, "utf-8").catch(() => "");

      // 获取当前章节号
      const indexPath = join(bookDir, "chapters", "index.json");
      const indexContent = await readFile(indexPath, "utf-8").catch(() => "[]");
      const index = JSON.parse(indexContent);
      const currentChapter = index.length > 0 ? Math.max(...index.map((ch: any) => ch.number)) : 0;

      pressureReport = analyzeAllHooksPressure(hooks, currentChapter, summariesContent);
    } catch (error) {
      // 伏笔压力分析失败不影响整体检查
    }

    return {
      timestamp: Date.now(),
      bookId,
      chapterCount: await this.getChapterCount(bookId),
      overallScore,
      checks,
      recommendations,
      pressureReport,
    };
  }

  /**
   * 检查真相文件完整性
   */
  private async checkTruthFilesIntegrity(storyDir: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查必要的真相文件
    const requiredFiles = [
      "current_state.md",
      "pending_hooks.md",
      "chapter_summaries.md",
      "character_matrix.md",
      "emotional_arcs.md",
    ];

    for (const file of requiredFiles) {
      try {
        await readFile(join(storyDir, file), "utf-8");
      } catch {
        issues.push(`真相文件缺失: ${file}`);
        recommendations.push(`创建 ${file}`);
      }
    }

    // 检查文件大小
    try {
      const stateContent = await readFile(join(storyDir, "current_state.md"), "utf-8");
      if (stateContent.length > 50000) {
        issues.push("current_state.md 过大（超过 50KB）");
        recommendations.push("考虑整合或压缩状态文件");
      }
    } catch {
      // 文件不存在已在上面检查
    }

    return {
      name: "真相文件完整性",
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 20),
      summary: issues.length === 0 ? "所有真相文件完整" : `发现 ${issues.length} 个问题`,
      issues,
      recommendations,
    };
  }

  /**
   * 检查伏笔健康
   */
  private async checkHookHealth(storyDir: string, bookId: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const hooksPath = join(storyDir, "pending_hooks.md");
      const hooksContent = await readFile(hooksPath, "utf-8").catch(() => "");

      if (!hooksContent.trim()) {
        return {
          name: "伏笔健康",
          passed: true,
          score: 100,
          summary: "暂无伏笔数据",
          issues: [],
          recommendations: [],
        };
      }

      const hooks = parsePendingHooksMarkdown(hooksContent);

      // 获取当前章节号
      const bookDir = join(this.ctx.projectRoot, "books", bookId);
      const indexPath = join(bookDir, "chapters", "index.json");
      const indexContent = await readFile(indexPath, "utf-8").catch(() => "[]");
      const index = JSON.parse(indexContent);
      const currentChapter = index.length > 0 ? Math.max(...index.map((ch: any) => ch.number)) : 0;

      // 分析伏笔健康
      const healthIssues = analyzeHookHealth({
        language: "zh",
        chapterNumber: currentChapter,
        hooks: hooks.map(h => ({
          hookId: h.hookId,
          type: h.type || "unknown",
          status: h.status as "open" | "progressing" | "resolved" | "deferred",
          startChapter: h.startChapter,
          lastAdvancedChapter: h.lastAdvancedChapter,
          expectedPayoff: h.expectedPayoff,
          payoffTiming: h.payoffTiming as "immediate" | "near-term" | "mid-arc" | "slow-burn" | "endgame" | undefined,
          notes: h.notes,
          promoted: h.promoted,
        })),
      });

      // 转换为健康检查结果
      for (const issue of healthIssues) {
        issues.push(issue.description);
        recommendations.push(issue.suggestion);
      }

      // 检查伏笔数量
      const activeHooks = hooks.filter(h => {
        const status = h.status?.toLowerCase();
        return status !== "resolved" && status !== "deferred";
      });

      if (activeHooks.length > 12) {
        issues.push(`活跃伏笔过多（${activeHooks.length} 个，建议不超过 12 个）`);
        recommendations.push("回收一些不重要的伏笔");
      }

    } catch (error) {
      issues.push(`伏笔检查失败: ${error}`);
    }

    return {
      name: "伏笔健康",
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 15),
      summary: issues.length === 0 ? "伏笔状态健康" : `发现 ${issues.length} 个问题`,
      issues,
      recommendations,
    };
  }

  /**
   * 检查角色一致性
   */
  private async checkCharacterConsistency(storyDir: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const characterMatrixPath = join(storyDir, "character_matrix.md");
      const characterMatrix = await readFile(characterMatrixPath, "utf-8").catch(() => "");

      if (!characterMatrix.trim()) {
        return {
          name: "角色一致性",
          passed: true,
          score: 100,
          summary: "暂无角色数据",
          issues: [],
          recommendations: [],
        };
      }

      // 解析角色矩阵
      const lines = characterMatrix.split("\n");
      const dataLines = lines.filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("角色"));

      // 统计活跃角色
      const activeCharacters = dataLines.filter(l => {
        const cells = l.split("|").map(c => c.trim());
        const status = cells[5] || ""; // status 列
        return !status.includes("退场") && !status.includes("死亡");
      });

      if (activeCharacters.length > 20) {
        issues.push(`活跃角色过多（${activeCharacters.length} 个，建议不超过 20 个）`);
        recommendations.push("考虑让一些角色退场");
      }

      // 检查角色信息完整性
      const incompleteCharacters = dataLines.filter(l => {
        const cells = l.split("|").map(c => c.trim());
        const role = cells[2] || ""; // role 列
        return role.length < 2;
      });

      if (incompleteCharacters.length > 0) {
        issues.push(`${incompleteCharacters.length} 个角色信息不完整`);
        recommendations.push("补充角色背景信息");
      }

    } catch (error) {
      issues.push(`角色检查失败: ${error}`);
    }

    return {
      name: "角色一致性",
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 20),
      summary: issues.length === 0 ? "角色状态健康" : `发现 ${issues.length} 个问题`,
      issues,
      recommendations,
    };
  }

  /**
   * 检查实体健康
   */
  private async checkEntityHealth(bookDir: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const entityDB = new EntityDB(bookDir);
      const stats = entityDB.getStats();
      entityDB.close();

      if (stats.activeCharacters > 30) {
        issues.push(`角色实体过多（${stats.activeCharacters} 个）`);
        recommendations.push("整合或删除不必要的角色");
      }

      if (stats.totalEntities > 100) {
        issues.push(`实体总数过多（${stats.totalEntities} 个）`);
        recommendations.push("清理不再使用的实体");
      }

    } catch (error) {
      // 实体数据库可能不存在，不视为错误
    }

    return {
      name: "实体健康",
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 15),
      summary: issues.length === 0 ? "实体状态健康" : `发现 ${issues.length} 个问题`,
      issues,
      recommendations,
    };
  }

  /**
   * 检查风格稳定性
   */
  private async checkStyleDrift(storyDir: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const styleGuidePath = join(storyDir, "style_guide.md");
      const styleGuide = await readFile(styleGuidePath, "utf-8").catch(() => "");

      if (!styleGuide.trim()) {
        issues.push("缺少风格指南");
        recommendations.push("创建 style_guide.md");
      }

    } catch (error) {
      // 风格检查失败不影响整体
    }

    return {
      name: "风格稳定性",
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 25),
      summary: issues.length === 0 ? "风格检查通过" : `发现 ${issues.length} 个问题`,
      issues,
      recommendations,
    };
  }

  /**
   * 获取章节数量
   */
  private async getChapterCount(bookId: string): Promise<number> {
    try {
      const bookDir = join(this.ctx.projectRoot, "books", bookId);
      const indexPath = join(bookDir, "chapters", "index.json");
      const indexContent = await readFile(indexPath, "utf-8").catch(() => "[]");
      const index = JSON.parse(indexContent);
      return index.length;
    } catch {
      return 0;
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(checks: HealthCheckResult[]): string[] {
    const recommendations: string[] = [];

    for (const check of checks) {
      if (!check.passed) {
        recommendations.push(...check.recommendations);
      }
    }

    // 去重并限制数量
    const unique = [...new Set(recommendations)];
    return unique.slice(0, 10);
  }
}
