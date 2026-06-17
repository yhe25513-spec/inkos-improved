import { BaseAgent } from "./base.js";

export interface SurpriseFactor {
  readonly type: string;
  readonly description: string;
  readonly impact: string;
}

export interface CreativityInput {
  readonly chapterNumber: number;
  readonly chapterMemo: string;
  readonly recentSummaries: string;
  readonly surpriseCount?: number;
}

export interface CreativityOutput {
  readonly chapterNumber: number;
  readonly surprises: ReadonlyArray<SurpriseFactor>;
  readonly unpredictabilityScore: number;
}

export class CreativityAgent extends BaseAgent {
  get name(): string {
    return "creativity";
  }

  async generateSurprises(input: CreativityInput): Promise<CreativityOutput> {
    const surpriseCount = input.surpriseCount ?? 3;

    const systemPrompt = `You are a creative consultant for web fiction. Your role is to analyze recent chapter summaries for repetitive patterns or clichés, and inject "surprise factors" that break those patterns and keep readers engaged.

## Your Task

1. Analyze the recent chapter summaries for:
   - Repeated plot structures (e.g., always solving problems the same way)
   - Predictable character behavior
   - Overused conflict types or resolution patterns
   - Stagnant emotional rhythms

2. Generate ${surpriseCount} non-obvious twists or details that:
   - Subvert reader expectations based on the detected patterns
   - Introduce unexpected but logically consistent elements
   - Create new narrative tension without contradicting established world rules

3. Each surprise factor must have:
   - type: category of the surprise (e.g., "character reversal", "hidden information", "environmental shift", "relationship twist", "power dynamic change", "moral ambiguity")
   - description: specific, actionable suggestion for the chapter
   - impact: how this surprise would affect the reader's expectations going forward

4. Rate the unpredictability of your suggestions 0-100:
   - 0-30: Subtle, almost expected variations
   - 31-60: Moderately surprising, adds fresh tension
   - 61-80: Genuinely unexpected but still logical
   - 81-100: High-impact twist that reshapes reader assumptions

## Output Format

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "surprises": [
    {
      "type": "string",
      "description": "string",
      "impact": "string"
    }
  ],
  "unpredictabilityScore": number
}

Do NOT include any text outside the JSON object.`;

    const userPrompt = `## Chapter Number
${input.chapterNumber}

## Chapter Memo
${input.chapterMemo}

## Recent Chapter Summaries
${input.recentSummaries}

Generate ${surpriseCount} surprise factors that break repetitive patterns in these recent summaries and add unpredictability to chapter ${input.chapterNumber}.`;

    try {
      const response = await this.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.8, maxTokens: 1000 },
      );

      const parsed = this.parseResponse(response.content);
      if (parsed) {
        return {
          chapterNumber: input.chapterNumber,
          surprises: parsed.surprises,
          unpredictabilityScore: parsed.unpredictabilityScore,
        };
      }
    } catch (e) {
      this.log?.warn(`[creativity] Generation failed: ${e}`);
    }

    return {
      chapterNumber: input.chapterNumber,
      surprises: [],
      unpredictabilityScore: 0,
    };
  }

  private parseResponse(content: string): { surprises: SurpriseFactor[]; unpredictabilityScore: number } | null {
    try {
      const balanced = this.extractBalancedJson(content);
      if (balanced) {
        const result = this.tryParse(balanced);
        if (result) return result;
      }

      const trimmed = content.trim();
      if (trimmed.startsWith("{")) {
        const result = this.tryParse(trimmed);
        if (result) return result;
      }

      const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        const result = this.tryParse(codeBlockMatch[1]!.trim());
        if (result) return result;
      }
    } catch {
      // parse failed
    }
    return null;
  }

  private tryParse(json: string): { surprises: SurpriseFactor[]; unpredictabilityScore: number } | null {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed.surprises)) return null;

      const surprises: SurpriseFactor[] = parsed.surprises.map((s: Record<string, unknown>) => ({
        type: typeof s.type === "string" ? s.type : "unspecified",
        description: typeof s.description === "string" ? s.description : "",
        impact: typeof s.impact === "string" ? s.impact : "",
      }));

      const rawScore = typeof parsed.unpredictabilityScore === "number" ? parsed.unpredictabilityScore : 50;
      const unpredictabilityScore = Math.round(Math.max(0, Math.min(100, rawScore)));

      return { surprises, unpredictabilityScore };
    } catch {
      return null;
    }
  }

  private extractBalancedJson(text: string): string | null {
    const start = text.indexOf("{");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
  }
}
