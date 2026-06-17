// ── 角色状态同步器 ────────────────────────────────────
// 同步和追踪角色状态变化

import type { CharacterState, Relationship, Item } from "./types.js";

/**
 * 角色状态同步器
 */
export class CharacterStateSync {
  private storage: Map<string, CharacterState[]> = new Map();

  /**
   * 添加角色状态
   */
  addState(
    bookId: string,
    state: Omit<CharacterState, "characterId"> & { characterId?: string },
  ): CharacterState {
    const characterId = state.characterId ?? this.generateId(state.characterName);
    const fullState: CharacterState = { ...state, characterId };

    const key = `${bookId}:${characterId}`;
    const states = this.storage.get(key) ?? [];
    states.push(fullState);
    this.storage.set(key, states);

    return fullState;
  }

  /**
   * 获取角色在指定章节的状态
   */
  getStateAtChapter(
    bookId: string,
    characterId: string,
    chapterNumber: number,
  ): CharacterState | null {
    const key = `${bookId}:${characterId}`;
    const states = this.storage.get(key) ?? [];

    // 找到最近的、不大于指定章节的状态
    const sorted = states
      .filter((s) => s.chapterNumber <= chapterNumber)
      .sort((a, b) => b.chapterNumber - a.chapterNumber);

    return sorted[0] ?? null;
  }

  /**
   * 获取角色的最新状态
   */
  getLatestState(bookId: string, characterId: string): CharacterState | null {
    const key = `${bookId}:${characterId}`;
    const states = this.storage.get(key) ?? [];

    const sorted = states.sort((a, b) => b.chapterNumber - a.chapterNumber);
    return sorted[0] ?? null;
  }

  /**
   * 获取所有角色在指定章节的状态
   */
  getAllStatesAtChapter(bookId: string, chapterNumber: number): CharacterState[] {
    const result: CharacterState[] = [];
    const processed = new Set<string>();

    for (const [key, states] of this.storage) {
      if (!key.startsWith(`${bookId}:`)) continue;

      const characterId = key.split(":")[1];
      if (processed.has(characterId)) continue;
      processed.add(characterId);

      const sorted = states
        .filter((s) => s.chapterNumber <= chapterNumber)
        .sort((a, b) => b.chapterNumber - a.chapterNumber);

      if (sorted[0]) {
        result.push(sorted[0]);
      }
    }

    return result;
  }

  /**
   * 更新角色状态
   */
  updateState(
    bookId: string,
    characterId: string,
    chapterNumber: number,
    updates: Partial<Omit<CharacterState, "characterId" | "chapterNumber">>,
  ): CharacterState | null {
    const currentState = this.getStateAtChapter(bookId, characterId, chapterNumber);
    if (!currentState) return null;

    const newState: CharacterState = {
      ...currentState,
      ...updates,
      characterId,
      chapterNumber,
    };

    return this.addState(bookId, newState);
  }

  /**
   * 检查状态一致性
   */
  checkConsistency(
    bookId: string,
    chapterNumber: number,
  ): Array<{
    characterId: string;
    issue: string;
    previous: string;
    current: string;
  }> {
    const issues: Array<{
      characterId: string;
      issue: string;
      previous: string;
      current: string;
    }> = [];

    const currentStates = this.getAllStatesAtChapter(bookId, chapterNumber);
    const previousStates = this.getAllStatesAtChapter(bookId, chapterNumber - 1);

    const previousMap = new Map(previousStates.map((s) => [s.characterId, s]));

    for (const current of currentStates) {
      const previous = previousMap.get(current.characterId);
      if (!previous) continue;

      // 检查物品变化
      const lostItems = previous.inventory.filter(
        (item) => !current.inventory.some((i) => i.id === item.id),
      );
      for (const item of lostItems) {
        issues.push({
          characterId: current.characterId,
          issue: `物品"${item.name}"消失`,
          previous: `拥有${item.name}`,
          current: `没有${item.name}`,
        });
      }

      // 检查关系变化
      const lostRelationships = previous.relationships.filter(
        (rel) => !current.relationships.some((r) => r.targetId === rel.targetId),
      );
      for (const rel of lostRelationships) {
        issues.push({
          characterId: current.characterId,
          issue: `与"${rel.targetName}"的关系消失`,
          previous: `${rel.type}: ${rel.description}`,
          current: "无此关系",
        });
      }
    }

    return issues;
  }

  private generateId(name: string): string {
    return `char-${name.toLowerCase().replace(/[^a-z0-9一-鿿]/g, "-")}`;
  }
}
