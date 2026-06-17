import { describe, it, expect } from "vitest";
import { ForeshadowTracker } from "../consistency/foreshadow-tracker.js";
import { CharacterStateSync } from "../consistency/character-state-sync.js";
import { TimelineManager } from "../consistency/timeline-manager.js";
import { ConsistencyChecker } from "../consistency/consistency-checker.js";

describe("ForeshadowTracker", () => {
  const tracker = new ForeshadowTracker();

  it("should add foreshadow", () => {
    const fs = tracker.addForeshadow(
      "book1",
      5,
      "他发现了一个神秘的盒子，里面似乎藏着什么秘密。",
      ["主角"],
    );

    expect(fs.id).toBeTruthy();
    expect(fs.status).toBe("pending");
    expect(fs.importance).toBeTruthy();
  });

  it("should resolve foreshadow", () => {
    const fs = tracker.addForeshadow("book1", 10, "这个谜团一直困扰着他。");
    const resolved = tracker.resolveForeshadow(fs.id, 20, "在第20章揭示了真相。");

    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe("resolved");
    expect(resolved!.chapterResolved).toBe(20);
  });

  it("should abandon foreshadow", () => {
    const fs = tracker.addForeshadow("book1", 15, "这条线索后来不再重要。");
    const abandoned = tracker.abandonForeshadow(fs.id, "剧情调整，不再需要");

    expect(abandoned).not.toBeNull();
    expect(abandoned!.status).toBe("abandoned");
  });

  it("should get unresolved foreshadows", () => {
    tracker.addForeshadow("book2", 1, "第一个伏笔。");
    tracker.addForeshadow("book2", 5, "第二个伏笔。");

    const unresolved = tracker.getUnresolved("book2");
    expect(unresolved.length).toBeGreaterThanOrEqual(2);
  });

  it("should check stale foreshadows", () => {
    // 添加一个在第1章设置的伏笔
    const fs = tracker.addForeshadow("book3", 1, "很早设置的伏笔。");

    // 在第60章检查，应该被标记为过期
    const stale = tracker.checkStaleForeshadows("book3", 60, 50);
    expect(stale.some((s) => s.id === fs.id)).toBe(true);
  });
});

describe("CharacterStateSync", () => {
  const sync = new CharacterStateSync();

  it("should add character state", () => {
    const state = sync.addState("book1", {
      characterName: "李明",
      chapterNumber: 1,
      physicalState: "健康",
      mentalState: "平静",
      relationships: [],
      inventory: [{ id: "sword1", name: "长剑", description: "一把普通的剑", quantity: 1 }],
      knowledge: [],
      secrets: [],
      goals: ["成为强者"],
    });

    expect(state.characterId).toBeTruthy();
    expect(state.characterName).toBe("李明");
  });

  it("should get state at chapter", () => {
    sync.addState("book2", {
      characterName: "张伟",
      chapterNumber: 1,
      physicalState: "受伤",
      mentalState: "焦虑",
      relationships: [],
      inventory: [],
      knowledge: [],
      secrets: [],
      goals: [],
    });

    sync.addState("book2", {
      characterName: "张伟",
      chapterNumber: 5,
      physicalState: "康复",
      mentalState: "放松",
      relationships: [],
      inventory: [],
      knowledge: [],
      secrets: [],
      goals: [],
    });

    const state1 = sync.getStateAtChapter("book2", "char-张伟", 1);
    expect(state1?.physicalState).toBe("受伤");

    const state5 = sync.getStateAtChapter("book2", "char-张伟", 5);
    expect(state5?.physicalState).toBe("康复");

    const state3 = sync.getStateAtChapter("book2", "char-张伟", 3);
    expect(state3?.physicalState).toBe("受伤"); // 最近的状态
  });

  it("should check consistency", () => {
    sync.addState("book3", {
      characterName: "王五",
      chapterNumber: 1,
      physicalState: "健康",
      mentalState: "平静",
      relationships: [{ targetId: "char-赵六", targetName: "赵六", type: "friend", description: "好友" }],
      inventory: [{ id: "item1", name: "宝剑", description: "传家宝", quantity: 1 }],
      knowledge: [],
      secrets: [],
      goals: [],
    });

    sync.addState("book3", {
      characterName: "王五",
      chapterNumber: 2,
      physicalState: "健康",
      mentalState: "平静",
      relationships: [], // 关系丢失
      inventory: [], // 物品丢失
      knowledge: [],
      secrets: [],
      goals: [],
    });

    const issues = sync.checkConsistency("book3", 2);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("TimelineManager", () => {
  const manager = new TimelineManager();

  it("should add event", () => {
    const event = manager.addEvent("book1", {
      chapterNumber: 1,
      storyTime: "第一天清晨",
      description: "主角出发",
      characters: ["主角"],
      location: "村庄",
      type: "main",
    });

    expect(event.id).toBeTruthy();
    expect(event.chapterNumber).toBe(1);
  });

  it("should get timeline", () => {
    manager.addEvent("book2", {
      chapterNumber: 5,
      storyTime: "第五天下午",
      description: "到达城镇",
      characters: ["主角"],
      location: "城镇",
      type: "main",
    });

    manager.addEvent("book2", {
      chapterNumber: 1,
      storyTime: "第一天",
      description: "出发",
      characters: ["主角"],
      location: "村庄",
      type: "main",
    });

    const timeline = manager.getTimeline("book2");
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].chapterNumber).toBe(1); // 按章节排序
  });

  it("should detect conflicts", () => {
    manager.addEvent("book3", {
      chapterNumber: 10,
      storyTime: "第十天",
      description: "在城镇开会",
      characters: ["主角"],
      location: "城镇",
      type: "main",
    });

    manager.addEvent("book3", {
      chapterNumber: 10,
      storyTime: "第十天",
      description: "在森林冒险",
      characters: ["主角"], // 同一角色
      location: "森林", // 不同地点
      type: "main",
    });

    const conflicts = manager.checkConflicts("book3");
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("should get character timeline", () => {
    manager.addEvent("book4", {
      chapterNumber: 1,
      storyTime: "第一天",
      description: "出发",
      characters: ["主角", "配角"],
      location: "村庄",
      type: "main",
    });

    const timeline = manager.getCharacterTimeline("book4", "主角");
    expect(timeline.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ConsistencyChecker", () => {
  it("should check consistency", () => {
    const foreshadowTracker = new ForeshadowTracker();
    const characterSync = new CharacterStateSync();
    const timelineManager = new TimelineManager();
    const checker = new ConsistencyChecker(foreshadowTracker, characterSync, timelineManager);

    // 添加一些数据
    foreshadowTracker.addForeshadow("book1", 1, "一个很早的伏笔。");
    timelineManager.addEvent("book1", {
      chapterNumber: 1,
      storyTime: "第一天",
      description: "开始",
      characters: ["主角"],
      location: "起点",
      type: "main",
    });

    const issues = checker.checkConsistency("book1", 60);
    // 应该检测到过期的伏笔
    expect(issues.some((i) => i.type === "foreshadow")).toBe(true);
  });
});
