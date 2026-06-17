import { describe, it, expect } from "vitest";
import { PerplexityAnalyzer } from "../anti-ai/perplexity-analyzer.js";
import { SentenceReconstructor } from "../anti-ai/sentence-reconstructor.js";
import { GenreAdapter } from "../anti-ai/genre-adapters.js";

describe("PerplexityAnalyzer", () => {
  const analyzer = new PerplexityAnalyzer();

  it("should detect AI-like text (low perplexity)", () => {
    // AI典型输出：句子结构均匀，用词常见
    const aiText =
      "他走进了房间，看到了桌子上的书。他拿起书，翻开了第一页。" +
      "书中写满了密密麻麻的文字，他认真地读了起来。" +
      "过了一会儿，他合上了书，思考着书中的内容。";

    const result = analyzer.analyze(aiText);
    expect(result.perplexity).toBeLessThan(100);
    expect(result.burstiness).toBeLessThan(0.5);
  });

  it("should detect human-like text (high perplexity)", () => {
    // 人类典型输出：句式变化大，用词多样
    const humanText =
      "那天下午——说来也怪——雨突然就停了。阳光从云缝里漏下来，" +
      "金灿灿的，照得人睁不开眼。李明站在街角，点了根烟，" +
      "深吸一口。烟雾在潮湿的空气里打着旋儿，懒洋洋地往上飘。" +
      "他盯着对面那家关了门的奶茶店，心里头说不上是什么滋味。" +
      "三年了。这地方一点没变，又好像什么都变了。";

    const result = analyzer.analyze(humanText);
    // 人类文本困惑度应该更高
    expect(result.perplexity).toBeGreaterThan(30);
  });

  it("should calculate burstiness correctly", () => {
    // 短句+长句混合 = 高突发性
    const burstyText = "好。他走了很远很远的路，穿过了一片又一片的树林，终于在天黑之前到达了那个谁也不知道的小村庄。";
    const burstiness = analyzer.calculateBurstiness(burstyText);
    expect(burstiness).toBeGreaterThan(0.2);

    // 均匀句子 = 低突发性
    const uniformText = "他走了过去。他看到了房子。他推开了门。他走了进去。他看到了一个人。";
    const uniformBurstiness = analyzer.calculateBurstiness(uniformText);
    expect(uniformBurstiness).toBeLessThan(burstiness);
  });

  it("should calculate vocabulary diversity", () => {
    // 重复用词 = 低多样性
    const repetitive = "他走了过去。他看到了房子。他走进了房间。他坐在了椅子上。";
    const diversity1 = analyzer.calculateVocabularyDiversity(repetitive);
    expect(diversity1).toBeGreaterThan(0);
    expect(diversity1).toBeLessThanOrEqual(1);

    // 用词多样 = 高多样性
    const diverse =
      "晨曦透过薄雾，洒在青石板路上。巷子深处传来几声犬吠，" +
      "伴随着远处小贩的吆喝声。空气里弥漫着豆浆和油条的香味。";
    const diversity2 = analyzer.calculateVocabularyDiversity(diverse);
    expect(diversity2).toBeGreaterThan(0);
    expect(diversity2).toBeLessThanOrEqual(1);
  });

  it("should handle short text gracefully", () => {
    const result = analyzer.analyze("短文本");
    expect(result.perplexity).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe("SentenceReconstructor", () => {
  const reconstructor = new SentenceReconstructor();

  it("should not modify text that is already human-like", async () => {
    const humanText =
      "好。他走了。阳光从窗帘缝里钻进来，晃得人眼睛疼。" +
      "李明打了个哈欠，翻身把被子裹紧。谁也不想起床，" +
      "尤其是冬天。尤其是周一。尤其是冬天的周一。";

    const result = await reconstructor.reconstruct(humanText, {
      targetPerplexity: 60,
      targetBurstiness: 0.4,
      intensity: 3,
    });

    // 原文已经足够人类化，不应被大幅修改
    expect(result.length).toBeGreaterThan(humanText.length * 0.8);
  });

  it("should modify AI-like text to be more human", async () => {
    const aiText =
      "因为天气很好，所以他决定出去走走。" +
      "虽然路上的人很多，但是他并不在意。" +
      "他觉得这样很好，因为可以放松心情。";

    // 多次运行取平均，因为有随机性
    let changedCount = 0;
    const runs = 10;

    for (let i = 0; i < runs; i++) {
      const result = await reconstructor.reconstruct(aiText, {
        targetPerplexity: 80,
        targetBurstiness: 0.5,
        genre: "urban",
        intensity: 7,
      });

      if (result !== aiText) changedCount++;

      // 文本长度不应变化太大
      expect(result.length).toBeGreaterThan(aiText.length * 0.5);
      expect(result.length).toBeLessThan(aiText.length * 2);
    }

    // 至少50%的运行应该产生了变化
    expect(changedCount).toBeGreaterThan(runs * 0.3);
  });

  it("should respect intensity levels", async () => {
    const text = "因为天气很好，所以他决定出去走走。虽然路上的人很多，但是他并不在意。";

    // 多次运行取统计结果
    let lowChangedCount = 0;
    let highChangedCount = 0;
    const runs = 10;

    for (let i = 0; i < runs; i++) {
      const low = await reconstructor.reconstruct(text, { intensity: 2 });
      const high = await reconstructor.reconstruct(text, { intensity: 9 });

      if (low !== text) lowChangedCount++;
      if (high !== text) highChangedCount++;
    }

    // 高强度应该比低强度更容易产生变化
    expect(highChangedCount).toBeGreaterThanOrEqual(lowChangedCount);
  });
});

describe("GenreAdapter", () => {
  const adapter = new GenreAdapter();

  it("should return correct config for each genre", () => {
    const xuanhuan = adapter.getConfig("xuanhuan");
    expect(xuanhuan.characteristicWords).toContain("灵力");

    const urban = adapter.getConfig("urban");
    expect(urban.characteristicWords).toContain("手机");

    const romance = adapter.getConfig("romance");
    expect(romance.characteristicWords).toContain("心跳");

    const mystery = adapter.getConfig("mystery");
    expect(mystery.characteristicWords).toContain("线索");
  });

  it("should return general config for unknown genre", () => {
    const general = adapter.getConfig("general");
    expect(general.characteristicWords).toHaveLength(0);
  });
});
