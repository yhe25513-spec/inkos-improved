// ── 真人感27维度定义（ID 38-64） ───────────────────────────
// 独立于结构审计（1-37）的真人感质量审计维度
// 分5层：语言表层 / 沉浸层 / 叙事结构层 / 人物情感层 / 叙事与伏笔层

export type HumanityDimensionLayer =
  | "language"      // 语言表层
  | "immersion"     // 沉浸层
  | "structure"     // 叙事结构层
  | "emotion"       // 人物情感层
  | "narrative";    // 叙事与伏笔层

export interface HumanityDimension {
  readonly id: number;
  readonly name: { readonly zh: string; readonly en: string };
  readonly layer: HumanityDimensionLayer;
  readonly baseNote: string;
}

export const HUMANITY_DIMENSIONS: ReadonlyArray<HumanityDimension> = [
  // ── 语言表层（5维度） ──
  {
    id: 38,
    name: { zh: "句子突发性", en: "Sentence Burstiness" },
    layer: "language",
    baseNote: "长短句交替程度。短句突然出现制造节奏呼吸感。AI写作倾向句长均匀，真人写作有明显的长短交替。",
  },
  {
    id: 39,
    name: { zh: "开头多样性", en: "Opening Variety" },
    layer: "language",
    baseNote: "段落/句子开头是否过于单一。连续'他'开头或省略主语过多需要检查。真人写作开头变化丰富。",
  },
  {
    id: 40,
    name: { zh: "口语化密度", en: "Colloquial Density" },
    layer: "language",
    baseNote: "'这玩意儿''哪儿懂'等口语表达的自然密度。口语化是真人感的来源之一，也是人物故意说错话的载体。",
  },
  {
    id: 41,
    name: { zh: "模糊词控制", en: "Hedge Word Control" },
    layer: "language",
    baseNote: "'似乎''好像'等模糊词是否滥用。合理比喻除外，模糊词过多是AI写作的典型特征。",
  },
  {
    id: 42,
    name: { zh: "词汇多样性", en: "Vocabulary Variety" },
    layer: "language",
    baseNote: "装饰词/比喻是否重复使用。真人写作不会反复使用同一个比喻或修饰词。",
  },

  // ── 沉浸层（5维度） ──
  {
    id: 43,
    name: { zh: "感官种类", en: "Sensory Variety" },
    layer: "immersion",
    baseNote: "视觉/听觉/触觉/嗅觉/味觉的覆盖广度。至少覆盖3种感官。缺少嗅觉和味觉是常见问题。",
  },
  {
    id: 44,
    name: { zh: "身体存在感", en: "Body Presence" },
    layer: "immersion",
    baseNote: "主角身体感受描写（伤痛、疲惫、眼皮酸等）。身体细节让角色有'肉身感'，而非纯意识体。",
  },
  {
    id: 45,
    name: { zh: "次要人物自洽", en: "Side Character Consistency" },
    layer: "immersion",
    baseNote: "配角行为逻辑是否自洽（不降智、不工具人）。每个配角应有自己的行为逻辑链。",
  },
  {
    id: 46,
    name: { zh: "不体面道具", en: "Unseemly Props" },
    layer: "immersion",
    baseNote: "场景道具是否有'磨损感'（缺口、裂缝、污渍）。完美无瑕的道具缺乏真实感。",
  },
  {
    id: 47,
    name: { zh: "自我矛盾性", en: "Self-Contradiction" },
    layer: "immersion",
    baseNote: "主角是否有'自己也不确定'的瞬间。真人面对选择时会犹豫，而非确定后才行动。",
  },

  // ── 叙事结构层（5维度） ──
  {
    id: 48,
    name: { zh: "时间碎片", en: "Time Fragments" },
    layer: "structure",
    baseNote: "'正打算…忽然'式的时间缝隙。主角在犹豫、盘算时的停顿是真人写作的标志。AI写的是'他走过去'，中间没有犹豫。",
  },
  {
    id: 49,
    name: { zh: "对话不完美", en: "Imperfect Dialogue" },
    layer: "structure",
    baseNote: "对话是否'不闭环'（被打断、答非所问、重复）。对话不闭环是真人感的核心来源之一。",
  },
  {
    id: 50,
    name: { zh: "物理接触", en: "Physical Contact" },
    layer: "structure",
    baseNote: "物理细节是否具体到数字（'三寸'而非'什么东西'）。具体数字比模糊描述有力得多。",
  },
  {
    id: 51,
    name: { zh: "节奏呼吸感", en: "Rhythmic Breathing" },
    layer: "structure",
    baseNote: "紧张后是否有温暖/松弛描写让读者'松下来'。AI会直接跳到'然后他做了XX'，真人会在紧张后加松弛描写。",
  },
  {
    id: 52,
    name: { zh: "不必要重量", en: "Unnecessary Weight" },
    layer: "structure",
    baseNote: "是否有故意放慢、用更多笔墨写一件事的厚度。'做完这一切'这种故意不展开的模糊感就是不必要重量。",
  },

  // ── 人物情感层（6维度） ──
  {
    id: 53,
    name: { zh: "矛盾性行为", en: "Contradictory Behavior" },
    layer: "emotion",
    baseNote: "主角是否做'不该做但符合性格'的事。隐藏能力=对同伴不透明，但符合谨慎性格。这种矛盾让角色立体。",
  },
  {
    id: 54,
    name: { zh: "错误余地", en: "Error Margin" },
    layer: "emotion",
    baseNote: "主角是否意识到'自己的借口不够好'。真人事后会怀疑自己的表现，AI写的角色总是自信满满。",
  },
  {
    id: 55,
    name: { zh: "情感回落期", en: "Emotional Settling" },
    layer: "emotion",
    baseNote: "情绪是否有'担心→压下去'的弧线（非立刻振作）。情绪不立刻收束，而是有弧线，这是真人感的标志。",
  },
  {
    id: 56,
    name: { zh: "特异性细节", en: "Specific Details" },
    layer: "emotion",
    baseNote: "'半块干饼''绳头连到大树阴影'级别的精准细节。具体到'半块''攒下的'这种程度的信息密度。",
  },
  {
    id: 57,
    name: { zh: "自我意识", en: "Self-Awareness" },
    layer: "emotion",
    baseNote: "主角是否'想自己怎么想'（元认知层次）。'下次要不要再用，他说不上来'——这种'说不上来'就是自我意识的核心。",
  },
  {
    id: 58,
    name: { zh: "自我暴露", en: "Self-Exposure" },
    layer: "emotion",
    baseNote: "主角是否意识到'自己暴露了什么'。'运气好'暴露了不想承认能力，'我哪儿懂'暴露了其实懂。角色应意识到自己的暴露。",
  },

  // ── 叙事与伏笔层（6维度） ──
  {
    id: 59,
    name: { zh: "信息挤牙膏", en: "Information Drip" },
    layer: "narrative",
    baseNote: "信息是否一个接一个出来（每步比读者快一步）。陷阱→发现→判断→揭穿→验证，节奏完美。",
  },
  {
    id: 60,
    name: { zh: "读者预期管理", en: "Reader Expectation Management" },
    layer: "narrative",
    baseNote: "是否有多层预期反转（A→B→C→真相）。四层反转是教科书级别的叙事技巧。",
  },
  {
    id: 61,
    name: { zh: "污染式传递", en: "Contaminated Transmission" },
    layer: "narrative",
    baseNote: "信息是否被角色故意污染（撒谎/偏见/读者自行解读）。最顶级的是读者在无人讨论的情况下自己得出结论。",
  },
  {
    id: 62,
    name: { zh: "温度切换", en: "Temperature Switch" },
    layer: "narrative",
    baseNote: "紧张结束后是否有不合时宜的情绪反应（忽然想笑）。紧张场景刚结束加一个不合时宜的情绪，立刻提升真人感。",
  },
  {
    id: 63,
    name: { zh: "沉默层", en: "Silence Layer" },
    layer: "narrative",
    baseNote: "是否有'没有人讨论但读者感觉到了'的留白。灰衣年轻人做了决定但不说出来——这种沉默让读者自己猜。",
  },
  {
    id: 64,
    name: { zh: "不可靠性", en: "Unreliability" },
    layer: "narrative",
    baseNote: "主角是否事后修正自己的判断。'那个陷阱末端的花纹，不像是临时做的'——这种事后修正判断是叙事不可靠性的典型表现。",
  },
];

export const HUMANITY_DIMENSION_IDS: ReadonlyArray<number> = HUMANITY_DIMENSIONS.map((d) => d.id);

const DIMENSION_BY_ID = new Map<number, HumanityDimension>(
  HUMANITY_DIMENSIONS.map((d) => [d.id, d]),
);

export function getHumanityDimensionConfig(id: number): HumanityDimension | undefined {
  return DIMENSION_BY_ID.get(id);
}

export const HUMANITY_LAYER_LABELS: Record<HumanityDimensionLayer, { readonly zh: string; readonly en: string }> = {
  language: { zh: "语言表层", en: "Language Surface" },
  immersion: { zh: "沉浸层", en: "Immersion Layer" },
  structure: { zh: "叙事结构层", en: "Narrative Structure Layer" },
  emotion: { zh: "人物情感层", en: "Character Emotion Layer" },
  narrative: { zh: "叙事与伏笔层", en: "Narrative & Foreshadowing Layer" },
};
