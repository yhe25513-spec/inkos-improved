/**
 * AntiDetectAgent — final de-AI polish pass.
 *
 * Runs after the review cycle completes, before persistence.
 * Uses a focused LLM call to break AI-detectable patterns:
 * - Sentence rhythm variation
 * - Colloquial texture injection
 * - "了" density reduction
 * - Transition word elimination
 * - Emotion externalization
 * - Simile breaking
 *
 * This is a lightweight, targeted pass — not a full rewrite.
 */

import type { LLMClient, LLMMessage, LLMResponse } from "../llm/provider.js";

export interface AntiDetectResult {
  readonly content: string;
  readonly changes: ReadonlyArray<string>;
  readonly tokenUsage: { readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number };
}

export interface AntiDetectParams {
  readonly chatCompletion: (
    client: LLMClient,
    model: string,
    messages: ReadonlyArray<LLMMessage>,
    options?: { readonly temperature?: number },
  ) => Promise<LLMResponse>;
  readonly client: LLMClient;
  readonly model: string;
  readonly content: string;
  readonly language: "zh" | "en";
  readonly logger?: { readonly info: (msg: string) => void };
}

const SYSTEM_PROMPT_ZH = `你是一个专门去除AI味的文本后处理专家。你的任务是对已经写好的小说章节进行最后一道打磨，让它读起来完全像真人手写的。

## 你的操作范围（只做以下改动，不要重写情节）

1. **打断工整句式**：如果连续3句以上结构相似（比如都是"主语+动词+宾语"），必须变换句式——有的用倒装，有的省略主语，有的用短句截断
2. **增加口语感**：在合适的地方加入口语化表达——"得""吧""呢""嘛"等语气词，但不能过度
3. **减少"了"字**：检查每个"了"字，能删就删，能换就换。"他走了过去"→"他走过去"
4. **打破比喻连击**：如果连续出现2个以上"像…一样"的比喻，改写至少一个为直接描写
5. **五感补位**：如果某一段只有视觉描写，补一个听觉或嗅觉细节
6. **段尾变化**：如果段落结尾是总结句或感悟句，改成动作或对话结尾
7. **对话碎片化**：把过于完整的对话句打碎——加入省略号、打断、欲言又止

## 绝对禁止的改动

- 不要改变情节走向
- 不要增删场景
- 不要改变角色性格
- 不要修改对话的核心含义
- 不要添加新的伏笔或线索
- 不要改变人称或视角

## 输出格式

直接输出修改后的完整章节正文。不要加任何解释、注释或元信息。`;

const SYSTEM_PROMPT_EN = `You are a text post-processing specialist focused on removing AI-generated text markers. Your job is to polish an already-written novel chapter so it reads like human handwriting.

## Scope of changes (only do the following, do not rewrite plot)

1. **Break sentence patterns**: If 3+ consecutive sentences share the same structure, vary them — use inversions, omit subjects, insert short punchy fragments
2. **Add colloquial texture**: Sprinkle natural speech particles where appropriate — trailing off, false starts, contractions
3. **Simile breaking**: If 2+ "like/as" similes appear consecutively, rewrite at least one as direct description
4. **Sensory filling**: If a paragraph only has visual description, add a sound or smell detail
5. **Paragraph-end variation**: If a paragraph ends with a summary or moral, replace with action or dialogue
6. **Dialogue fragmentation**: Break overly complete dialogue lines — add ellipses, interruptions, trailing off

## Absolute prohibitions

- Do NOT change plot direction
- Do NOT add or remove scenes
- Do NOT change character personalities
- Do NOT alter the core meaning of dialogue
- Do NOT add new foreshadowing
- Do NOT change POV or narrative person

## Output format

Output the full revised chapter text only. No explanations, annotations, or meta-information.`;

/**
 * Run the anti-detect polish pass on chapter content.
 * Returns the polished content with a list of changes made.
 */
export async function runAntiDetectPass(params: AntiDetectParams): Promise<AntiDetectResult> {
  const { chatCompletion, client, model, content, language, logger } = params;

  const systemPrompt = language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

  logger?.info(`[anti-detect] Running de-AI polish pass (${content.length} chars)`);

  const result = await chatCompletion(
    client,
    model,
    [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: language === "zh"
          ? `请对以下章节进行去AI味打磨，输出修改后的完整正文：\n\n${content}`
          : `Please polish the following chapter to remove AI markers. Output the full revised text:\n\n${content}`,
      },
    ],
    { temperature: 0.3 },
  );

  const responseText = result?.content ?? content;

  // Track what changed
  const changes: string[] = [];
  if (responseText !== content) {
    // Simple diff: count paragraph differences
    const origParas = content.split(/\n\s*\n/).length;
    const newParas = responseText.split(/\n\s*\n/).length;
    if (origParas !== newParas) {
      changes.push(`Paragraph count: ${origParas} → ${newParas}`);
    }
    changes.push(`Content length: ${content.length} → ${responseText.length} chars`);
  }

  const usage = result?.usage;

  logger?.info(`[anti-detect] Pass complete. Changes: ${changes.length}`);

  return {
    content: responseText,
    changes,
    tokenUsage: {
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    },
  };
}
