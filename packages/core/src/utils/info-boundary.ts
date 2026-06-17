/**
 * 信息边界检查器
 * 检查角色是否知道不应该知道的信息
 */

import { EntityDB } from "../state/entity-db.js";
import type { Entity, Edge } from "../models/entity.js";

export interface InfoBoundaryIssue {
  type: "secret_leak" | "knowledge_gap" | "impossible_knowledge" | "off_screen_knowledge";
  character: string;
  description: string;
  chapter: number;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

export interface InfoBoundaryReport {
  chapter: number;
  issues: InfoBoundaryIssue[];
  score: number;  // 0-100，越高越好
  summary: string;
}

export class InfoBoundaryChecker {
  private entityDB: EntityDB;

  constructor(entityDB: EntityDB) {
    this.entityDB = entityDB;
  }

  /**
   * 检查章节中的信息边界问题
   */
  check(
    chapterContent: string,
    chapterNumber: number,
    speakingCharacters: string[]
  ): InfoBoundaryReport {
    const issues: InfoBoundaryIssue[] = [];

    // 检查每个说话的角色
    for (const charName of speakingCharacters) {
      const character = this.findCharacter(charName);
      if (!character) continue;

      // 获取该角色已知的信息
      const knownInfo = this.getCharacterKnowledge(character.id, chapterNumber);

      // 检查角色是否说出了不应该知道的信息
      const charIssues = this.checkCharacterKnowledge(
        character,
        chapterContent,
        chapterNumber,
        knownInfo
      );
      issues.push(...charIssues);
    }

    return {
      chapter: chapterNumber,
      issues,
      score: this.calculateScore(issues),
      summary: this.generateSummary(issues),
    };
  }

  /**
   * 查找角色
   */
  private findCharacter(name: string): Entity | null {
    const characters = this.entityDB.getActiveCharacters();
    return characters.find(c =>
      c.name === name || c.aliases.includes(name)
    ) || null;
  }

  /**
   * 获取角色已知的信息
   */
  private getCharacterKnowledge(characterId: string, upToChapter: number): string[] {
    const knowledge: string[] = [];

    // 获取角色参与的关系
    const outgoingEdges = this.entityDB.getEdgesFrom(characterId);
    const incomingEdges = this.entityDB.getEdgesTo(characterId);

    // 从关系中推断知识
    for (const edge of [...outgoingEdges, ...incomingEdges]) {
      if (edge.since <= upToChapter) {
        // 角色知道关系的另一方
        const otherId = edge.source === characterId ? edge.target : edge.source;
        const other = this.entityDB.getEntity(otherId);
        if (other) {
          knowledge.push(other.name);
        }

        // 从关系属性中获取更多信息
        if (edge.attributes.knows) {
          knowledge.push(...(Array.isArray(edge.attributes.knows) ? edge.attributes.knows : [edge.attributes.knows]));
        }
      }
    }

    // 获取角色的状态历史
    const history = this.entityDB.getEntityHistory(characterId);
    for (const change of history) {
      if (change.chapter <= upToChapter && change.newValue) {
        knowledge.push(`${change.field}: ${JSON.stringify(change.newValue)}`);
      }
    }

    return knowledge;
  }

  /**
   * 检查角色知识是否合理
   */
  private checkCharacterKnowledge(
    character: Entity,
    chapterContent: string,
    chapterNumber: number,
    knownInfo: string[]
  ): InfoBoundaryIssue[] {
    const issues: InfoBoundaryIssue[] = [];

    // 检查是否有关于其他角色的秘密信息
    // 这里简化处理：检查角色是否提到了不应该知道的其他角色信息
    const otherCharacters = this.entityDB.getActiveCharacters();

    for (const other of otherCharacters) {
      if (other.id === character.id) continue;

      // 检查角色是否知道其他角色的状态
      const otherState = Object.values(other.state).join(" ");
      if (otherState && chapterContent.includes(other.name) && chapterContent.includes(otherState)) {
        // 检查角色是否有途径知道这些信息
        const hasKnowledgePath = this.hasKnowledgePath(character.id, other.id, chapterNumber);
        if (!hasKnowledgePath) {
          issues.push({
            type: "off_screen_knowledge",
            character: character.name,
            description: `${character.name} 知道 ${other.name} 的状态"${otherState}"，但没有合理的途径`,
            chapter: chapterNumber,
            severity: "medium",
            suggestion: `添加角色获取信息的途径，或删除不合理的知识`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 检查两个角色之间是否有知识传递路径
   */
  private hasKnowledgePath(sourceId: string, targetId: string, chapter: number): boolean {
    // 直接认识
    const directEdges = this.entityDB.getEdgesFrom(sourceId);
    if (directEdges.some(e => e.target === targetId && e.since <= chapter)) {
      return true;
    }

    // 通过共同认识的人（2度关系）
    const sourceConnections = this.entityDB.getEntityConnections(sourceId, 2);
    if (sourceConnections.entities.some(e => e.id === targetId)) {
      return true;
    }

    // 同一组织
    const sourceOrgs = directEdges
      .filter(e => e.type === "member_of")
      .map(e => e.target);
    const targetEdges = this.entityDB.getEdgesFrom(targetId);
    const targetOrgs = targetEdges
      .filter(e => e.type === "member_of")
      .map(e => e.target);

    if (sourceOrgs.some(org => targetOrgs.includes(org))) {
      return true;
    }

    return false;
  }

  /**
   * 计算分数
   */
  private calculateScore(issues: InfoBoundaryIssue[]): number {
    if (issues.length === 0) return 100;

    const penalty = issues.reduce((sum, issue) => {
      switch (issue.severity) {
        case "high": return sum + 20;
        case "medium": return sum + 10;
        case "low": return sum + 5;
        default: return sum;
      }
    }, 0);

    return Math.max(0, 100 - penalty);
  }

  /**
   * 生成摘要
   */
  private generateSummary(issues: InfoBoundaryIssue[]): string {
    if (issues.length === 0) {
      return "未发现信息边界问题";
    }

    const highIssues = issues.filter(i => i.severity === "high");
    const mediumIssues = issues.filter(i => i.severity === "medium");
    const lowIssues = issues.filter(i => i.severity === "low");

    const parts: string[] = [];
    if (highIssues.length > 0) {
      parts.push(`${highIssues.length} 个高优先级问题`);
    }
    if (mediumIssues.length > 0) {
      parts.push(`${mediumIssues.length} 个中优先级问题`);
    }
    if (lowIssues.length > 0) {
      parts.push(`${lowIssues.length} 个低优先级问题`);
    }

    return `发现 ${issues.length} 个信息边界问题：${parts.join("、")}`;
  }

  /**
   * 获取角色的知识边界报告
   */
  getCharacterKnowledgeReport(characterId: string, chapter: number): {
    character: Entity | null;
    knownEntities: Entity[];
    knownFacts: string[];
    missingKnowledge: string[];
  } {
    const character = this.entityDB.getEntity(characterId);
    if (!character) {
      return { character: null, knownEntities: [], knownFacts: [], missingKnowledge: [] };
    }

    const knownInfo = this.getCharacterKnowledge(characterId, chapter);
    const knownEntityIds = new Set<string>();

    // 从关系中获取已知实体
    const edges = [...this.entityDB.getEdgesFrom(characterId), ...this.entityDB.getEdgesTo(characterId)];
    for (const edge of edges) {
      if (edge.since <= chapter) {
        const otherId = edge.source === characterId ? edge.target : edge.source;
        knownEntityIds.add(otherId);
      }
    }

    const knownEntities = Array.from(knownEntityIds)
      .map(id => this.entityDB.getEntity(id))
      .filter(Boolean) as Entity[];

    return {
      character,
      knownEntities,
      knownFacts: knownInfo,
      missingKnowledge: [], // TODO: 实现缺失知识检测
    };
  }
}
