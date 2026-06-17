/**
 * 实体提取器
 * 从章节内容中提取 6 类实体和关系
 */

import { BaseAgent, type AgentContext } from "./base.js";
import type { Entity, Edge, EntityType, EntityDelta } from "../models/entity.js";

export interface ExtractionResult {
  delta: EntityDelta;
  rawResponse: string;
  confidence: number;
}

export class EntityExtractor extends BaseAgent {
  name = "entity-extractor";

  constructor(ctx: AgentContext) {
    super(ctx);
  }

  /**
   * 从章节内容中提取实体
   */
  async extractFromChapter(
    chapterContent: string,
    chapterNumber: number
  ): Promise<ExtractionResult> {
    const prompt = this.buildExtractionPrompt(chapterContent, chapterNumber);
    const response = await this.chat([{ role: "user", content: prompt }]);
    const delta = this.parseResponse(response.content);

    return {
      delta,
      rawResponse: response.content,
      confidence: this.calculateConfidence(delta),
    };
  }

  /**
   * 构建实体提取提示词
   */
  private buildExtractionPrompt(content: string, chapterNumber: number): string {
    return `你是一个专业的实体提取器。请从以下章节内容中提取所有实体和关系。

章节号：${chapterNumber}

内容：
${content}

请提取以下 6 类实体：

1. **角色 (characters)**：所有出现的人物
   - 包含：名字、别名、身份、特征、状态
   - 标记是新角色还是已有角色

2. **关系 (relationships)**：角色之间的关系
   - 类型：认识、亲属、敌对、恋爱、上下级、朋友、师徒等
   - 标记关系的建立/变化/结束

3. **场景 (scenes)**：地点/场景
   - 包含：名称、类型、特征、当前状态
   - 标记场景的变化

4. **组织 (organizations)**：势力/组织
   - 包含：名称、类型、成员、状态
   - 标记组织的变化

5. **物品 (items)**：重要物品
   - 包含：名称、类型、持有者、状态
   - 标记物品的获得/转让/使用

6. **概念 (concepts)**：设定/概念
   - 包含：名称、类型、描述、相关角色
   - 标记概念的揭示/变化

输出格式（JSON）：
{
  "characters": [
    {
      "name": "张三",
      "aliases": ["张老板"],
      "type": "character",
      "attributes": { "身份": "药铺老板", "年龄": 40 },
      "state": { "位置": "城东药铺" },
      "status": "active",
      "isNew": true
    }
  ],
  "relationships": [
    {
      "source": "张三",
      "target": "主角",
      "type": "knows",
      "attributes": { "关系": "药铺老板与顾客" },
      "since": ${chapterNumber}
    }
  ],
  "scenes": [
    {
      "name": "城东药铺",
      "type": "scene",
      "attributes": { "类型": "药铺", "位置": "城东" },
      "state": { "营业状态": "正常" },
      "isNew": true
    }
  ],
  "organizations": [
    {
      "name": "天剑宗",
      "type": "organization",
      "attributes": { "类型": "修仙宗门", "实力": "一流" },
      "state": { "掌门": "张真人" },
      "isNew": true
    }
  ],
  "items": [
    {
      "name": "聚气丹",
      "type": "item",
      "attributes": { "类型": "丹药", "品质": "中品" },
      "state": { "持有者": "主角", "数量": 3 },
      "isNew": true
    }
  ],
  "concepts": [
    {
      "name": "筑基期",
      "type": "concept",
      "attributes": { "类型": "修炼境界", "描述": "修炼第二阶段" },
      "state": {},
      "isNew": true
    }
  ]
}

请确保：
1. 提取所有出现的实体，不要遗漏
2. 实体名称使用最常用的名字
3. 关系类型使用标准类型（knows, loves, enemy, member_of, owns, located_at 等）
4. 状态变化要明确标记
5. 只输出 JSON，不要输出其他内容`;
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(response: string): EntityDelta {
    try {
      // 尝试解析 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        characters: (parsed.characters || []).map((c: any) => this.normalizeEntity(c, "character")),
        relationships: (parsed.relationships || []).map((r: any) => this.normalizeEdge(r)),
        scenes: (parsed.scenes || []).map((s: any) => this.normalizeEntity(s, "scene")),
        organizations: (parsed.organizations || []).map((o: any) => this.normalizeEntity(o, "organization")),
        items: (parsed.items || []).map((i: any) => this.normalizeEntity(i, "item")),
        concepts: (parsed.concepts || []).map((c: any) => this.normalizeEntity(c, "concept")),
      };
    } catch (error) {
      this.ctx.logger?.error("Failed to parse entity extraction response:", error as Record<string, unknown>);
      return {
        characters: [],
        relationships: [],
        scenes: [],
        organizations: [],
        items: [],
        concepts: [],
      };
    }
  }

  /**
   * 规范化实体
   */
  private normalizeEntity(data: any, type: EntityType): Entity {
    return {
      id: `${type}-${data.name || data.id || Math.random().toString(36).slice(2)}`,
      type,
      name: data.name || "未知",
      aliases: data.aliases || [],
      attributes: data.attributes || {},
      state: data.state || {},
      firstAppearance: data.firstAppearance || 0,
      lastAppearance: data.lastAppearance || 0,
      status: data.status || "active",
      exitChapter: data.exitChapter,
      exitReason: data.exitReason,
      tags: data.tags || [],
    };
  }

  /**
   * 规范化边
   */
  private normalizeEdge(data: any): Edge {
    return {
      id: `edge-${data.source}-${data.target}-${data.type}-${Date.now()}`,
      source: data.source,
      target: data.target,
      type: data.type || "related_to",
      attributes: data.attributes || {},
      since: data.since || 0,
      until: data.until,
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(delta: EntityDelta): number {
    const totalEntities =
      delta.characters.length +
      delta.scenes.length +
      delta.organizations.length +
      delta.items.length +
      delta.concepts.length;

    const totalEdges = delta.relationships.length;

    // 如果提取到实体，置信度较高
    if (totalEntities > 0 && totalEdges > 0) {
      return 0.8;
    }

    // 只有实体没有关系
    if (totalEntities > 0) {
      return 0.6;
    }

    // 没有提取到任何实体
    return 0.3;
  }
}
