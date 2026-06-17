import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

/**
 * Category of a lore entry – flexible string, with recommended values:
 *   "物品" | "角色能力" | "机制" | "世界规则" | "反派机制" | "资源" | "地点" | "角色类型" | "其他"
 */
export type LoreCategory = string;
/**
 * A single lore entry in the canon registry.
 */
export interface LoreEntry {
  readonly displayName: string;
  /**
   * Category tag – flexible string. Recommended values:
   *   "物品" | "角色能力" | "机制" | "世界规则" | "反派机制" | "资源" | "地点" | "角色类型" | "其他"
   */
  readonly category: LoreCategory;
  readonly definition: string;
  readonly functions: ReadonlyArray<string>;
  readonly locked: boolean;
  readonly reason?: string;
  readonly updatedAtChapter?: number;
}

/**
 * The top-level shape of `story/canon_registry.json`.
 */
export interface CanonRegistryFile {
  readonly version: number;
  readonly updatedAtChapter: number;
  readonly loreEntries: Record<string, LoreEntry>;
}

/**
 * Path (relative to bookDir) where canon registry is stored.
 */
const CANON_REL_PATH = "story/canon_registry.json" as const;

/**
 * Default (empty) file structure returned when the file does not yet exist.
 */
function emptyCanonRegistry(): CanonRegistryFile {
  return { version: 1, updatedAtChapter: 0, loreEntries: {} };
}

/**
 * Load the canon registry file from disk.
 *
 * Returns an empty file structure when the file does not exist.
 */
export async function loadCanonRegistry(
  bookDir: string,
): Promise<CanonRegistryFile> {
  try {
    const raw = await readFile(join(bookDir, CANON_REL_PATH), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      "loreEntries" in parsed
    ) {
      return parsed as CanonRegistryFile;
    }
    // File exists but has unexpected shape – return empty defaults.
    return emptyCanonRegistry();
  } catch {
    // File does not exist or cannot be parsed – return empty defaults.
    return emptyCanonRegistry();
  }
}

/**
 * Persist the canon registry file to disk.
 *
 * Creates intermediate directories if they do not yet exist.
 */
export async function saveCanonRegistry(
  bookDir: string,
  registry: CanonRegistryFile,
): Promise<void> {
  const filePath = join(bookDir, CANON_REL_PATH);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(registry, null, 2) + "\n", "utf-8");
}

/**
 * Look up a single lore entry by key.
 *
 * Returns `undefined` when no entry with the given key exists.
 */
export function getLoreEntry(
  registry: CanonRegistryFile,
  key: string,
): LoreEntry | undefined {
  return registry.loreEntries[key];
}

/**
 * Get all locked lore entries.
 */
export function getLockedEntries(
  registry: CanonRegistryFile,
): ReadonlyArray<LoreEntry> {
  return Object.values(registry.loreEntries).filter((entry) => entry.locked);
}

/**
 * Get all lore entries matching a category.
 */
export function getEntriesByCategory(
  registry: CanonRegistryFile,
  category: LoreCategory,
): ReadonlyArray<LoreEntry> {
  return Object.values(registry.loreEntries).filter(
    (entry) => entry.category === category,
  );
}

/**
 * Create a **template** canon registry – an empty, well-structured file
 * with documentation of each field. Used by the CLI to scaffold a new book.
 *
 * This template is GENERIC – it works for any novel (玄幻 / 都市 / 悬疑
 * / 末世 / 修仙 …). The entries below are commented-out examples showing
 * you HOW to write each category. Copy the ones that match your book and
 * fill in your own names and rules.
 *
 * The key idea: for every item / mechanism / ability the AI will touch,
 * write BOTH what it CAN do AND what it CANNOT do. "不能做什么"才是防
 *止 AI 乱写的关键。
 */
export function createCanonRegistryTemplate(): CanonRegistryFile {
  return {
    version: 1,
    updatedAtChapter: 0,
    loreEntries: {
      // =====================================================================
      // 如何使用本文件（给作者看的说明）
      // =====================================================================
      //
      // 这是一个通用的设定档案模板——适用于任何小说。
      //
      // 核心原则：每一个"可能被 AI 扩展功能"的对象，都应该在这里占一条。
      // 一条标准条目 = 定义 + 能做什么 + 不能做什么 + 锁定标记。
      //
      // locked = true  → AI 在写作时绝对不能给它加新功能（违反即整章作废）
      // locked = false → AI 可以在合理范围内扩展，但必须有明确前置铺垫
      //
      // 记住："不能做什么"才是最有价值的部分。写得越具体，AI 越不敢乱加。
      // 宁可多写 3 条"不能…"，也不要漏写一条。
      //
      // 下方每一类都给了一个"可复制的骨架"——把注释去掉，换成你自己的内容即可。
      // =====================================================================

      // ---------------------------------------------------------------------
      // 【1】物品类 —— 神秘的钥匙 / 铁片 / 令牌 / 系统道具 ...
      //      最容易被 AI 乱写：从"只能开门"变成"能融合进主角身体+看因果+提示实力"
      // ---------------------------------------------------------------------
      // "你的关键物品名（如：青铜钥匙）": {
      //   "displayName": "青铜钥匙",
      //   "category": "物品",
      //   "definition": "一句话说清楚它是什么——不要写任何功能。",
      //   "functions": [
      //     "能做什么 1：……",
      //     "能做什么 2：……",
      //     "- 不能：融合进人体 / 与灵魂绑定",
      //     "- 不能：吸收任何能量（灵脉、灵气、主角的力量）",
      //     "- 不能：提示或增强持有者的实力 / 境界",
      //     "- 不能：看到因果、命运、气息、因果线、未来、过去",
      //     "- 不能：作为武器 / 盾牌 / 交通工具",
      //     "- 不能：发光 / 发热 / 主动发出任何信号",
      //     "- 不能：复制 / 重铸 / 伪造",
      //     "- 不能：打开除 XXX 之外的任何东西"
      //   ],
      //   "locked": true,
      //   "reason": "这个物品的功能边界是核心悬念。AI 不能为推进剧情而随手给它加新功能。"
      // },

      // ---------------------------------------------------------------------
      // 【2】能量/资源类 —— 铁片吸收什么 / 灵石 / 丹药 / 因果碎片 ...
      //      容易被 AI 乱写：从"吸收战斗残留"变成"吸收灵脉本源+主角能量"
      // ---------------------------------------------------------------------
      // "你的资源名（如：元婴气机吸收铁片）": {
      //   "displayName": "吸收铁片",
      //   "category": "物品",
      //   "definition": "它吸收的是战斗场景中敌人释放后残留的 XX 能量。",
      //   "functions": [
      //     "功能：吸收战斗中直接残留的敌人能量——具体是 XX（如：C 级轮回者的元婴气机）",
      //     "吸收条件：必须在战斗现场、能量释放后不久才能吸收",
      //     "- 不能：主动吸取任何东西（它被动吸收，不是主动吞噬）",
      //     "- 不能：吸收灵脉、灵脉本源、天地灵气",
      //     "- 不能：吸收主角 / 友方角色的任何能量",
      //     "- 不能：转化吸收到的能量给持有者使用（它只吸收，不转化）",
      //     "- 不能：变成生命体 / 产生意识 / 与人对话",
      //     "- 不能：增强持有者的实力、境界、感知"
      //   ],
      //   "locked": true,
      //   "reason": "它的能量来源必须严格受限，否则会把'战斗中残留'写成'吸收全世界'。"
      // },

      // ---------------------------------------------------------------------
      // 【3】反派机制 —— 反派的威胁方式
      //      容易被 AI 乱写：从"吸收世界本源导致灵气不足"变成"用黑色丝线主动封锁个人突破"
      // ---------------------------------------------------------------------
      // "反派威胁机制": {
      //   "displayName": "反派的世界本源吸收",
      //   "category": "反派机制",
      //   "definition": "反派通过某种方式吸收世界本源，导致环境性影响。",
      //   "functions": [
      //     "效果：世界灵气总量不足 → 修炼者无法突破境界",
      //     "性质：被动的、持续的、宏观的环境变化",
      //     "- 反派不能：针对某个个体主动进行封锁（如：用丝线 / 咒语 / 标记阻止个人突破）",
      //     "- 反派不能：直接干涉某个个体的修炼进程",
      //     "- 反派不能：感知或定位单个修炼者的突破时刻",
      //     "- 反派不能：拥有可被打断的'施法过程'（威胁是环境性的，不是个人攻击）"
      //   ],
      //   "locked": true,
      //   "reason": "反派的威胁方式已确定为环境性。防止把反派写成有能力对个体施法的法师。"
      // },

      // ---------------------------------------------------------------------
      // 【4】主角能力体系 —— 防止"突然悟出新神通 / 觉醒新血脉"
      // ---------------------------------------------------------------------
      // "主角能力边界": {
      //   "displayName": "主角的能力体系",
      //   "category": "角色能力",
      //   "definition": "主角当前拥有的所有能力构成。成长必须在已确立的体系内。",
      //   "functions": [
      //     "战斗力上限：……（写清楚，例如：元婴期）",
      //     "资源体系：列出主角可用的资源类型（如：因果碎片、世界本源…）",
      //     "成长路径：他如何变强（修炼 / 资源炼化 / 战斗领悟）",
      //     "- 不能：在没有前置铺垫的情况下突然获得新神通 / 新血脉 / 新传承",
      //     "- 不能：突然懂得他不可能知道的功法 / 秘诀",
      //     "- 不能：觉醒任何未在设定中出现过的血统",
      //     "- 任何新能力的获得：必须有至少 2 章的前置线索铺垫"
      //   ],
      //   "locked": true,
      //   "reason": "防止为推进剧情而给主角随手加一个'正好能解决当前困难'的新能力。"
      // },

      // ---------------------------------------------------------------------
      // 【5】世界规则 —— 修炼体系 / 境界 / 飞升 / 资源体系
      // ---------------------------------------------------------------------
      // "世界规则-修炼体系": {
      //   "displayName": "修炼体系",
      //   "category": "世界规则",
      //   "definition": "本书的修炼体系和境界划分。",
      //   "functions": [
      //     "境界体系：列出境界（从低到高）",
      //     "能量体系：灵气 / 真气 / 魂力 …",
      //     "- 不能：在大纲未规划的情况下新增境界",
      //     "- 不能：让本土修士突然获得域外传承",
      //     "- 不能：让普通人突然觉醒血统"
      //   ],
      //   "locked": true,
      //   "reason": "世界规则不能由 AI 随意扩展——它是全书的骨架。"
      // },

      // ---------------------------------------------------------------------
      // 【6】角色类型 —— 例如轮回者 / 土著 / 穿越者
      // ---------------------------------------------------------------------
      // "轮回者": {
      //   "displayName": "轮回者",
      //   "category": "角色类型",
      //   "definition": "主神向本世界投放的外部力量。",
      //   "functions": [
      //     "分级体系：C、B、A…",
      //     "C 级能量特征：……",
      //     "- 不能：越级战斗（C 级不能打出 A 级实力）",
      //     "- 不能：掌握本土修炼体系的传承",
      //     "- 不能：突然升级（评级改变必须有明确剧情节点）"
      //   ],
      //   "locked": true,
      //   "reason": "……"
      // },

      // ---------------------------------------------------------------------
      // 【7】资源 / 货币 —— 例如：因果坐标碎片、世界本源
      // ---------------------------------------------------------------------
      // "因果坐标碎片": {
      //   "displayName": "因果坐标碎片",
      //   "category": "资源",
      //   "definition": "推动剧情发展的一种资源。",
      //   "functions": [
      //     "用途：用于……（具体写）",
      //     "- 不是万能的——列出它不能解决的问题"
      //   ],
      //   "locked": false
      // }

      // =====================================================================
      // 以上模板——根据你的小说，挑出真正核心的 5-15 个对象来填。
      // 不必每一类都填。只填那些"AI 一写就可能乱加功能"的东西。
      // =====================================================================
    },
  };
}

/**
 * Return a compact human-readable template as a string. Useful when the
 * CLI tells a user "how to write canon entries for your book".
 *
 * This is NOT machine JSON – it's plain-text guidance.
 */
export function describeEntryWritingGuide(language: "zh" | "en" = "zh"): string {
  if (language === "en") {
    return [
      "CANON ENTRY WRITING GUIDE",
      "=========================",
      "",
      "An entry is a contract between you and the AI: what this thing is,",
      "what it can do, and -- most importantly -- what it CANNOT do.",
      "",
      "The 7 categories you should consider locking:",
      "  1. Key items (keys, tokens, medallions, system items) --",
      "     AI loves to turn them into talking, glowing, fusion-able MacGuffins",
      "  2. Energy / resources (what gets absorbed, what a currency is)",
      "  3. Villain threat mechanics (environmental vs. individual attack)",
      "  4. Protagonist's ability ceiling (prevent deus-ex-machina new powers)",
      "  5. World rules (cultivation realms, energy systems, ascension)",
      "  6. Character types (their grading, what they cannot learn)",
      "  7. Plot-critical resources (what they can / cannot solve)",
      "",
      "Pattern for each entry:",
      "  definition      -- one plain line: what it IS, not what it DOES",
      "  functions       -- list what it CAN do",
      "                    then list what it CANNOT do (prefix with dash)",
      "  locked          -- true for anything whose scope is plot-critical",
      "  reason          -- one short sentence why you are locking it",
      "",
      "You need 5-15 locked entries. Not more, not less.",
      "Too few  → AI invents functionality freely.",
      "Too many → file becomes unwieldy and you stop maintaining it.",
    ].join("\n");
  }

  return [
    "设定档案写作指南",
    "=================",
    "",
    "每一条目 = 你和 AI 之间的一份合同：这是什么，能做什么，最重要的是——不能做什么。",
    "",
    "建议锁定的 7 类对象（AI 最喜欢给这些东西乱加功能）：",
    "  1. 关键物品（钥匙 / 令牌 / 系统道具）——AI 最喜欢让它们发光、会说话、能融合",
    "  2. 能量 / 资源（吸收什么 / 货币是什么）——AI 最喜欢把『吸收战斗残留』写成『吸收全世界』",
    "  3. 反派威胁机制——AI 最喜欢把被动环境封锁改成主动个体攻击",
    "  4. 主角能力上限——防止『正好解决当前困难』的新神通从天而降",
    "  5. 世界规则（修炼体系 / 境界 / 飞升）——AI 最喜欢随手加新境界",
    "  6. 角色类型（分级 / 能力特征 / 他们不能学什么）",
    "  7. 剧情关键资源（它能解决什么，不能解决什么）",
    "",
    "每条目的写法：",
    "  definition   —— 一句话：它是什么（不要写任何功能）",
    "  functions    —— 先写『能做什么』，然后用 - 开头写『不能做什么』（这部分最重要）",
    "  locked       —— 对任何功能边界与剧情相关的东西设为 true",
    "  reason       —— 一句话：为什么锁定（写给未来的你自己看）",
    "",
    "填多少？建议 5-15 个锁定条目：",
    "  太少 → AI 自由发挥，功能越写越离谱",
    "  太多 → 文件太大你不会维护，最终形同虚设",
  ].join("\n");
}

/**
 * Quick helper – build a registry from a compact list of "item → functions" pairs.
 * Useful when you have a clear idea what your book's items do and don't want
 * to hand-write the full JSON structure.
 */
export function buildRegistryFromItems(
  items: ReadonlyArray<{
    key: string;
    displayName: string;
    category: LoreCategory;
    definition: string;
    functions: ReadonlyArray<string>;
    locked?: boolean;
    reason?: string;
  }>,
): CanonRegistryFile {
  const entries: Record<string, LoreEntry> = {};
  for (const item of items) {
    entries[item.key] = {
      displayName: item.displayName,
      category: item.category,
      definition: item.definition,
      functions: [...item.functions],
      locked: item.locked !== false, // default LOCKED – safer default
      reason: item.reason,
    };
  }
  return { version: 1, updatedAtChapter: 0, loreEntries: entries };
}

/**
 * Return a compact, human-readable summary of the registry – used for UI
 * and for injecting the "hard constraints" section into the writer prompt.
 */
export function describeRegistry(
  registry: CanonRegistryFile,
): string {
  const entries = Object.values(registry.loreEntries);
  if (entries.length === 0) return "(未设定 – 为空)";
  const locked = entries.filter((e) => e.locked).length;
  return `共 ${entries.length} 条设定，其中 ${locked} 条已锁定 [LOCKED]`;
}

/**
 * Count entries in a registry.
 */
export function countEntries(registry: CanonRegistryFile): number {
  return Object.keys(registry.loreEntries).length;
}


/**
 * Build a brief of lore entries that are likely to be used in a chapter.
 * This is a simple heuristic based on entry names appearing in context.
 */
export function buildCanonUsageBrief(
  registry: CanonRegistryFile,
  contextText: string,
  language: "zh" | "en",
): string {
  const entries = Object.values(registry.loreEntries);
  if (entries.length === 0) return "";

  // Find entries whose displayName or key appears in the context
  const relevantEntries = entries.filter((entry) => {
    const key = Object.keys(registry.loreEntries).find(
      (k) => registry.loreEntries[k] === entry,
    );
    return (
      contextText.includes(entry.displayName) ||
      (key && contextText.includes(key))
    );
  });

  if (relevantEntries.length === 0) return "";

  const lockedEntries = relevantEntries.filter((e) => e.locked);
  const unlockedEntries = relevantEntries.filter((e) => !e.locked);

  const formatEntry = (entry: LoreEntry): string => {
    const lockTag = entry.locked ? " [LOCKED]" : "";
    const functionsList = entry.functions
      .map((f) => `  - ${f}`)
      .join("\n");
    return `${entry.displayName}${lockTag}\n${functionsList}`;
  };

  if (language === "en") {
    const lockedBlock =
      lockedEntries.length > 0
        ? `### Locked entries (NO new functions allowed)\n${lockedEntries.map(formatEntry).join("\n\n")}`
        : "";
    const unlockedBlock =
      unlockedEntries.length > 0
        ? `### Unlocked entries (can extend within reason)\n${unlockedEntries.map(formatEntry).join("\n\n")}`
        : "";

    return [lockedBlock, unlockedBlock].filter(Boolean).join("\n\n");
  }

  const lockedBlock =
    lockedEntries.length > 0
      ? `### 锁定条目（禁止新增功能）\n${lockedEntries.map(formatEntry).join("\n\n")}`
      : "";
  const unlockedBlock =
    unlockedEntries.length > 0
      ? `### 未锁定条目（可在合理范围内扩展）\n${unlockedEntries.map(formatEntry).join("\n\n")}`
      : "";

  return [lockedBlock, unlockedBlock].filter(Boolean).join("\n\n");
}