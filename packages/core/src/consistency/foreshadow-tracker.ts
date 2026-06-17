// ── 伏笔追踪器 ────────────────────────────────────────
// 追踪伏笔的设置与回收

import type { Foreshadow, ForeshadowImportance, ForeshadowStatus } from "./types.js";

/**
 * 伏笔追踪器
 */
export class ForeshadowTracker {
  private storage: Map<string, Foreshadow> = new Map();
  private idCounter = 0;

  /**
   * 添加伏笔
   */
  addForeshadow(
    bookId: string,
    chapterSet: number,
    content: string,
    relatedEntities: string[] = [],
    importance?: ForeshadowImportance,
    importanceReason?: string,
  ): Foreshadow {
    const id = `fs-${++this.idCounter}`;
    const now = new Date().toISOString();

    // 自动评估重要性
    const assessedImportance = importance ?? this.assessImportance(content, relatedEntities);
    const assessedReason = importanceReason ?? this.assessImportanceReason(content, relatedEntities);

    const foreshadow: Foreshadow = {
      id,
      bookId,
      chapterSet,
      content,
      status: "pending",
      importance: assessedImportance,
      importanceReason: assessedReason,
      relatedEntities,
      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    this.storage.set(id, foreshadow);
    return foreshadow;
  }

  /**
   * 解决伏笔
   */
  resolveForeshadow(
    foreshadowId: string,
    chapterResolved: number,
    notes?: string,
  ): Foreshadow | null {
    const foreshadow = this.storage.get(foreshadowId);
    if (!foreshadow) return null;

    foreshadow.status = "resolved";
    foreshadow.chapterResolved = chapterResolved;
    if (notes) foreshadow.notes = notes;
    foreshadow.updatedAt = new Date().toISOString();

    return foreshadow;
  }

  /**
   * 放弃伏笔
   */
  abandonForeshadow(
    foreshadowId: string,
    notes?: string,
  ): Foreshadow | null {
    const foreshadow = this.storage.get(foreshadowId);
    if (!foreshadow) return null;

    foreshadow.status = "abandoned";
    if (notes) foreshadow.notes = notes;
    foreshadow.updatedAt = new Date().toISOString();

    return foreshadow;
  }

  /**
   * 获取所有未解决的伏笔
   */
  getUnresolved(bookId: string): Foreshadow[] {
    return Array.from(this.storage.values())
      .filter((f) => f.bookId === bookId && f.status === "pending")
      .sort((a, b) => this.importanceWeight(b.importance) - this.importanceWeight(a.importance));
  }

  /**
   * 获取所有伏笔
   */
  getAll(bookId: string): Foreshadow[] {
    return Array.from(this.storage.values())
      .filter((f) => f.bookId === bookId)
      .sort((a, b) => a.chapterSet - b.chapterSet);
  }

  /**
   * 获取涉及特定角色的伏笔
   */
  getByCharacter(bookId: string, characterId: string): Foreshadow[] {
    return Array.from(this.storage.values())
      .filter((f) => f.bookId === bookId && f.relatedEntities.includes(characterId));
  }

  /**
   * 检查是否有长时间未解决的伏笔
   */
  checkStaleForeshadows(
    bookId: string,
    currentChapter: number,
    staleThreshold: number = 50,
  ): Foreshadow[] {
    return Array.from(this.storage.values())
      .filter(
        (f) =>
          f.bookId === bookId &&
          f.status === "pending" &&
          currentChapter - f.chapterSet > staleThreshold,
      )
      .sort((a, b) => this.importanceWeight(b.importance) - this.importanceWeight(a.importance));
  }

  /**
   * 评估伏笔重要性
   */
  private assessImportance(content: string, relatedEntities: string[]): ForeshadowImportance {
    let score = 0;

    // 内容长度评分
    if (content.length > 100) score += 3;
    else if (content.length > 50) score += 2;
    else score += 1;

    // 相关实体数量评分
    if (relatedEntities.length > 3) score += 3;
    else if (relatedEntities.length > 1) score += 2;
    else score += 1;

    // 关键词评分
    const importantKeywords = ["秘密", "真相", "阴谋", "背叛", "命运", "宿命", "诅咒", "预言"];
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        score += 2;
        break;
      }
    }

    // 根据分数确定重要性
    if (score >= 8) return "critical";
    if (score >= 6) return "high";
    if (score >= 4) return "medium";
    return "low";
  }

  /**
   * 评估重要性原因
   */
  private assessImportanceReason(content: string, relatedEntities: string[]): string {
    const reasons: string[] = [];

    if (content.length > 100) reasons.push("详细描述");
    if (relatedEntities.length > 2) reasons.push("涉及多个角色");

    const importantKeywords = ["秘密", "真相", "阴谋", "背叛", "命运", "宿命"];
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        reasons.push(`包含"${keyword}"关键词`);
        break;
      }
    }

    return reasons.join(", ") || "自动评估";
  }

  private importanceWeight(importance: ForeshadowImportance): number {
    const weights: Record<ForeshadowImportance, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return weights[importance];
  }
}
