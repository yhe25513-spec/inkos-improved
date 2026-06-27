// ── 真人感修复提示词模板 ─────────────────────────────────
// 按维度分组提供修复策略，指导 LLM 做定点真人感增强

import {
  HUMANITY_DIMENSIONS,
  HUMANITY_LAYER_LABELS,
  type HumanityDimension,
  type HumanityDimensionLayer,
} from "./humanity-dimensions.js";

type PromptLanguage = "zh" | "en";

/**
 * 按维度分组的修复策略指南
 */
const DIMENSION_REPAIR_STRATEGIES: Record<number, { zh: string; en: string }> = {
  38: {
    zh: "在长句段落中插入1-2个短句（3-7字），制造节奏突变。例如在描写段落后加'他没动。'或'血还在流。'",
    en: "Insert 1-2 short sentences (3-7 words) into long paragraphs to create rhythm bursts.",
  },
  39: {
    zh: "将连续'他'开头的段落改为以动作、环境或感官开头。例如'他站起来'→'椅子刮过地面，发出刺耳的声响。'",
    en: "Vary paragraph openings: replace consecutive 'he' starts with action, environment, or sensory openings.",
  },
  40: {
    zh: "在适当位置插入口语化表达。例如'他感到非常愤怒'→'他骂了一声靠'。保持角色性格一致。",
    en: "Insert colloquial expressions where appropriate. E.g., 'he felt angry' → 'he swore under his breath'.",
  },
  41: {
    zh: "删除多余的'似乎''好像'等模糊词，替换为具体描写。例如'似乎很冷'→'他打了个寒颤'。",
    en: "Remove excessive hedge words; replace with concrete descriptions.",
  },
  42: {
    zh: "检查是否有重复使用的比喻或修饰词，替换为不同的表达。",
    en: "Check for repeated metaphors or modifiers; replace with varied expressions.",
  },
  43: {
    zh: "在场景中补充缺失的感官描写。优先补充嗅觉（如'一股生肉腐烂的腥气'）或味觉。",
    en: "Add missing sensory descriptions, prioritizing smell or taste.",
  },
  44: {
    zh: "补充主角的身体感受描写。如伤痛、疲惫、眼皮酸等。例如'他揉了揉发酸的眼皮'。",
    en: "Add protagonist body sensations: pain, fatigue, soreness.",
  },
  45: {
    zh: "检查配角行为是否有自洽的逻辑链。如有降智或工具人化，补充配角的内心动机。",
    en: "Ensure side characters have self-consistent behavior logic chains.",
  },
  46: {
    zh: "给场景道具增加磨损感细节。如'缺口''裂缝''污渍''磨损'等。",
    en: "Add wear-and-tear details to props: chips, cracks, stains, wear.",
  },
  47: {
    zh: "在主角做决定前插入短暂的自我怀疑。如'我要是看错了呢？'但他还是做了。",
    en: "Insert brief self-doubt before protagonist decisions. 'What if I'm wrong?' But he did it anyway.",
  },
  48: {
    zh: "在动作之间插入犹豫/盘算的时间缝隙。如'正打算过去……忽然……'。",
    en: "Insert hesitation/calculating time gaps between actions.",
  },
  49: {
    zh: "让对话不闭环：被打断、答非所问、重复。如用动作代替回答（'嚓'的一声代替语言）。",
    en: "Make dialogue imperfect: interruptions, non-answers, repetitions.",
  },
  50: {
    zh: "将模糊的物理描写替换为具体数字。如'碰到了什么东西'→'刀尖插下去不到三寸'。",
    en: "Replace vague physical descriptions with specific numbers.",
  },
  51: {
    zh: "在紧张场景后插入温暖/松弛描写。如'远处有风吹过来，很暖，带着不知名的野草香。'",
    en: "Insert warm/relaxing descriptions after tense scenes.",
  },
  52: {
    zh: "在某个瞬间故意放慢、用更多笔墨。如'做完这一切'——故意不展开说'这一切'是什么。",
    en: "Deliberately slow down at certain moments with more detail.",
  },
  53: {
    zh: "让主角做一件'不该做但符合性格'的事。如隐藏能力=对同伴不透明，但符合谨慎性格。",
    en: "Have protagonist do something 'wrong but in-character'.",
  },
  54: {
    zh: "让主角意识到自己的借口不够好。如'他说完之后，忽然觉得这话有点假'。",
    en: "Let protagonist realize their excuse isn't good enough.",
  },
  55: {
    zh: "给情绪一个'担心→压下去'的弧线，而非立刻振作。如'不会有什么副作用吧？这以后要是用多了，瞎了怎么办？'",
    en: "Give emotions a 'worry → suppress' arc rather than instant recovery.",
  },
  56: {
    zh: "补充特异性细节。如'半块干饼''攒下的'——具体到数量和来源。",
    en: "Add specific details: 'half a dry cake' — specific to quantity and origin.",
  },
  57: {
    zh: "插入主角'想自己怎么想'的元认知层次。如'下次要不要再用，他说不上来。'",
    en: "Insert protagonist meta-cognition: 'whether to use it again, he couldn't say.'",
  },
  58: {
    zh: "让主角意识到自己暴露了什么。如'他说完运气好之后，忽然觉得这话有点假——如果真的只是运气好，他怎么会注意到泥印子的细节？'",
    en: "Let protagonist realize what they've exposed.",
  },
  59: {
    zh: "确保信息一个接一个出来，每步比读者快一步。如陷阱→发现→判断→揭穿→验证。",
    en: "Ensure information drips out one piece at a time, each step ahead of the reader.",
  },
  60: {
    zh: "构建多层预期反转（A→B→C→真相）。如：看到陷阱（预期A）→用运气好掩饰（预期B）→光头脸色变了（预期C）→真相揭晓。",
    en: "Build multi-layer expectation reversals (A→B→C→truth).",
  },
  61: {
    zh: "让信息被角色故意污染。如主角撒谎、配角偏见、读者在无人讨论下自行得出结论。",
    en: "Let information be deliberately contaminated by characters.",
  },
  62: {
    zh: "在紧张场景刚结束时加一个不合时宜的情绪反应。如'光头消失在树影里的时候，林天忽然想笑。他忍住了。'",
    en: "Add an incongruous emotional reaction right after a tense scene.",
  },
  63: {
    zh: "增加'没有人讨论但读者感觉到了'的留白。如配角做了决定但不说出来，让读者自己猜。",
    en: "Add silence layers: decisions made but not discussed, letting readers guess.",
  },
  64: {
    zh: "让主角事后修正自己的判断。如'那个陷阱末端的花纹，不像是临时做的。要么是早就在这里埋的，要么……他们不是第一次干这种事。'",
    en: "Let protagonist revise their judgment afterwards.",
  },
};

/**
 * 可程序化处理的维度（优先用 humanity 模块处理，不调 LLM）
 */
export const PROGRAMMABLE_DIMENSIONS = new Set<number>([63, 47]);

/**
 * 构建真人感修复系统提示词
 */
export function buildHumanityEnhanceSystemPrompt(language: PromptLanguage): string {
  const en = language === "en";
  return en
    ? `You are a professional fiction editor specializing in "human feel" enhancement. Your task is to fix humanity-quality issues identified by the 27-dimension audit.

CRITICAL CONSTRAINTS:
1. Do NOT alter the plot direction, core conflicts, or character decisions
2. Do NOT rewrite the whole chapter — only insert/replace at specific points
3. Do NOT change word count by more than ±15%
4. Each fix must correspond to a specific audit issue
5. Preserve the original writing style and rhythm

Your output must use this format:

=== FIXED_ISSUES ===
(List each fix on its own line, referencing the dimension name and what you changed)

=== REVISED_CONTENT ===
(The full chapter text with your targeted insertions/replacements applied)`
    : `你是一位专业的小说编辑，专精于"真人感"增强。你的任务是修复27维度真人感审计发现的问题。

关键约束：
1. 不得改变剧情走向、核心冲突或角色决定
2. 不得整章重写——只在具体位置做定点插入/替换
3. 修改后字数变化不得超过 ±15%
4. 每个修复必须对应一个具体的审计问题
5. 保持原文的写作风格和节奏

输出格式：

=== FIXED_ISSUES ===
（逐条列出修复内容，标明维度名称和具体改动）

=== REVISED_CONTENT ===
（应用了定点插入/替换后的完整章节正文）`;
}

/**
 * 构建真人感修复用户提示词
 */
export function buildHumanityEnhanceUserPrompt(
  chapterContent: string,
  chapterNumber: number,
  issues: ReadonlyArray<{
    readonly category: string;
    readonly description: string;
    readonly suggestion: string;
  }>,
  language: PromptLanguage,
): string {
  const en = language === "en";

  const issueList = issues
    .map((issue, i) => {
      const dimensionId = parseDimensionId(issue.category);
      const strategy = dimensionId !== undefined ? DIMENSION_REPAIR_STRATEGIES[dimensionId] : undefined;
      const strategyText = strategy
        ? (en ? strategy.en : strategy.zh)
        : "";
      return en
        ? `${i + 1}. [${issue.category}] ${issue.description}\n   Suggestion: ${issue.suggestion}\n   Repair strategy: ${strategyText}`
        : `${i + 1}. [${issue.category}] ${issue.description}\n   建议: ${issue.suggestion}\n   修复策略: ${strategyText}`;
    })
    .join("\n\n");

  return en
    ? `Please fix chapter ${chapterNumber} for humanity quality.

## Audit Issues (Humanity Dimensions)
${issueList}

## Chapter Content
${chapterContent}`
    : `请修复第${chapterNumber}章的真人感问题。

## 审计问题（真人感维度）
${issueList}

## 章节正文
${chapterContent}`;
}

/**
 * 从 category 字段解析维度 ID
 */
function parseDimensionId(category: string): number | undefined {
  // 尝试从 HUMANITY_DIMENSIONS 中匹配名称
  for (const dim of HUMANITY_DIMENSIONS) {
    if (category.includes(dim.name.zh) || category.includes(dim.name.en)) {
      return dim.id;
    }
  }
  return undefined;
}

/**
 * 获取维度的修复策略
 */
export function getDimensionRepairStrategy(
  dimensionId: number,
  language: PromptLanguage,
): string | undefined {
  const strategy = DIMENSION_REPAIR_STRATEGIES[dimensionId];
  if (!strategy) return undefined;
  return language === "en" ? strategy.en : strategy.zh;
}
