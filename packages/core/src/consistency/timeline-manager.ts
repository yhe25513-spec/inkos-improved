// ── 时间线管理器 ──────────────────────────────────────
// 管理故事时间线，检测时间冲突

import type { TimelineEvent, TimelineConflict } from "./types.js";

/**
 * 时间线管理器
 */
export class TimelineManager {
  private storage: Map<string, TimelineEvent[]> = new Map();
  private idCounter = 0;

  /**
   * 添加时间线事件
   */
  addEvent(
    bookId: string,
    event: Omit<TimelineEvent, "id">,
  ): TimelineEvent {
    const id = `evt-${++this.idCounter}`;
    const fullEvent: TimelineEvent = { ...event, id };

    const events = this.storage.get(bookId) ?? [];
    events.push(fullEvent);
    this.storage.set(bookId, events);

    return fullEvent;
  }

  /**
   * 获取完整时间线
   */
  getTimeline(bookId: string): TimelineEvent[] {
    const events = this.storage.get(bookId) ?? [];
    return [...events].sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * 获取指定章节的事件
   */
  getEventsAtChapter(bookId: string, chapterNumber: number): TimelineEvent[] {
    const events = this.storage.get(bookId) ?? [];
    return events.filter((e) => e.chapterNumber === chapterNumber);
  }

  /**
   * 获取涉及特定角色的事件
   */
  getEventsByCharacter(bookId: string, characterId: string): TimelineEvent[] {
    const events = this.storage.get(bookId) ?? [];
    return events.filter((e) => e.characters.includes(characterId));
  }

  /**
   * 检查时间线冲突
   */
  checkConflicts(bookId: string): TimelineConflict[] {
    const events = this.getTimeline(bookId);
    const conflicts: TimelineConflict[] = [];

    // 检查同一章节中的事件顺序
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];

        // 检查同一角色在同一时间出现在不同地点
        if (event1.chapterNumber === event2.chapterNumber) {
          const commonCharacters = event1.characters.filter((c) =>
            event2.characters.includes(c),
          );

          if (
            commonCharacters.length > 0 &&
            event1.location !== event2.location &&
            event1.type !== "flashback" &&
            event2.type !== "flashback"
          ) {
            conflicts.push({
              event1,
              event2,
              reason: `角色${commonCharacters.join("、")}在第${event1.chapterNumber}章同时出现在"${event1.location}"和"${event2.location}"`,
            });
          }
        }

        // 检查时间顺序矛盾
        if (event1.chapterNumber > event2.chapterNumber) {
          // event1发生在event2之后，但event1的storyTime可能在event2之前
          // 这需要更复杂的时间解析，这里简化处理
        }
      }
    }

    return conflicts;
  }

  /**
   * 获取角色的时间线
   */
  getCharacterTimeline(bookId: string, characterId: string): TimelineEvent[] {
    return this.getEventsByCharacter(bookId, characterId).sort(
      (a, b) => a.chapterNumber - b.chapterNumber,
    );
  }

  /**
   * 获取地点的时间线
   */
  getLocationTimeline(bookId: string, location: string): TimelineEvent[] {
    const events = this.storage.get(bookId) ?? [];
    return events
      .filter((e) => e.location === location)
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * 删除指定章节的所有事件
   */
  deleteEventsAtChapter(bookId: string, chapterNumber: number): void {
    const events = this.storage.get(bookId) ?? [];
    const filtered = events.filter((e) => e.chapterNumber !== chapterNumber);
    this.storage.set(bookId, filtered);
  }
}
