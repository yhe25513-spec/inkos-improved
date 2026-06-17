/**
 * 上下文构建器
 * 根据 Agent 需求动态加载模块和真理文件
 */

import { ModuleRegistry, type ModuleId, type Module } from "../modules/module-registry.js";

export interface ContextOptions {
  compress?: string[];           // 需要压缩的真理文件
  maxTokens?: number;            // 最大 token 数
  includeTruthFiles?: string[];  // 只包含指定的真理文件
  excludeTruthFiles?: string[];  // 排除指定的真理文件
  priority?: "quality" | "speed" | "balanced"; // 优先级策略
}

export interface AgentModuleRequirements {
  requiredModules: ModuleId[];   // 需要的模块
  excludedModules: ModuleId[];   // 排除的模块
  maxContextTokens?: number;     // 最大上下文 token 数
}

export class ContextBuilder {
  private registry: ModuleRegistry;

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  /**
   * 构建 Agent 上下文
   */
  buildContext(
    requirements: AgentModuleRequirements,
    truthFiles: Record<string, string>,
    options: ContextOptions = {}
  ): string {
    const parts: string[] = [];
    let tokenCount = 0;
    const maxTokens = options.maxTokens || requirements.maxContextTokens || 8000;

    // 1. 加载 Agent 需要的模块
    const modules = this.registry.getModules(requirements.requiredModules);
    const filteredModules = modules.filter(m => !requirements.excludedModules.includes(m.id));

    for (const mod of filteredModules) {
      if (tokenCount + mod.tokenCount > maxTokens) {
        // 超过 token 限制，尝试压缩
        if (options.priority !== "speed") {
          const compressed = this.compressModule(mod, maxTokens - tokenCount);
          if (compressed) {
            parts.push(`## ${mod.id}\n\n${compressed}`);
            tokenCount += this.estimateTokenCount(compressed);
          }
        }
        continue;
      }
      parts.push(`## ${mod.id}\n\n${mod.content}`);
      tokenCount += mod.tokenCount;
    }

    // 2. 加载真理文件（根据选项过滤和压缩）
    for (const [key, value] of Object.entries(truthFiles)) {
      // 过滤
      if (options.includeTruthFiles && !options.includeTruthFiles.includes(key)) {
        continue;
      }
      if (options.excludeTruthFiles && options.excludeTruthFiles.includes(key)) {
        continue;
      }

      // 估算 token
      const fileTokenCount = this.estimateTokenCount(value);
      if (tokenCount + fileTokenCount > maxTokens) {
        // 超过 token 限制，尝试压缩
        if (options.compress?.includes(key)) {
          const compressed = this.compressText(value, maxTokens - tokenCount);
          parts.push(`## ${key}\n\n${compressed}`);
          tokenCount += this.estimateTokenCount(compressed);
        }
        // 否则跳过
        continue;
      }

      parts.push(`## ${key}\n\n${value}`);
      tokenCount += fileTokenCount;
    }

    return parts.join("\n\n---\n\n");
  }

  /**
   * 压缩模块
   */
  private compressModule(module: Module, maxTokens: number): string | null {
    if (maxTokens <= 0) return null;

    const lines = module.content.split("\n");
    const compressed: string[] = [];
    let tokenCount = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);
      if (tokenCount + lineTokens > maxTokens) {
        compressed.push("\n... (已压缩)");
        break;
      }
      compressed.push(line);
      tokenCount += lineTokens;
    }

    return compressed.join("\n");
  }

  /**
   * 压缩文本
   */
  private compressText(text: string, maxTokens: number): string {
    const lines = text.split("\n");
    const compressed: string[] = [];
    let tokenCount = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);
      if (tokenCount + lineTokens > maxTokens) {
        compressed.push("\n... (已压缩)");
        break;
      }
      compressed.push(line);
      tokenCount += lineTokens;
    }

    return compressed.join("\n");
  }

  /**
   * 估算 token 数量
   */
  private estimateTokenCount(text: string): number {
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    const englishWords = text.split(/\s+/).length;
    return Math.ceil(chineseChars / 2 + englishWords);
  }

  /**
   * 获取模块统计
   */
  getModuleStats(): {
    totalModules: number;
    totalTokens: number;
    modules: Array<{ id: ModuleId; tokens: number; description: string }>;
  } {
    const moduleIds = this.registry.getModuleIds();
    const modules = moduleIds.map(id => {
      const mod = this.registry.getModule(id);
      return {
        id,
        tokens: mod?.tokenCount || 0,
        description: mod?.description || "",
      };
    });

    return {
      totalModules: modules.length,
      totalTokens: modules.reduce((sum, m) => sum + m.tokens, 0),
      modules,
    };
  }
}

/**
 * 预定义的 Agent 模块需求
 */
export const AGENT_MODULE_REQUIREMENTS: Record<string, AgentModuleRequirements> = {
  writer: {
    requiredModules: ["writing-rules", "genre-profile", "character-templates", "style-guides"],
    excludedModules: ["audit-dimensions", "revision-guides", "entity-extraction"],
    maxContextTokens: 6000,
  },
  auditor: {
    requiredModules: ["audit-dimensions", "genre-profile", "hook-governance"],
    excludedModules: ["writing-rules", "revision-guides"],
    maxContextTokens: 5000,
  },
  reviser: {
    requiredModules: ["revision-guides", "audit-dimensions", "genre-profile"],
    excludedModules: ["writing-rules"],
    maxContextTokens: 5000,
  },
  planner: {
    requiredModules: ["writing-rules", "genre-profile", "hook-governance", "character-templates"],
    excludedModules: ["audit-dimensions", "revision-guides"],
    maxContextTokens: 6000,
  },
  consolidator: {
    requiredModules: ["entity-extraction", "hook-governance"],
    excludedModules: ["writing-rules", "audit-dimensions", "revision-guides"],
    maxContextTokens: 4000,
  },
  "entity-extractor": {
    requiredModules: ["entity-extraction"],
    excludedModules: ["writing-rules", "audit-dimensions", "revision-guides"],
    maxContextTokens: 3000,
  },
  "health-checker": {
    requiredModules: ["hook-governance", "character-templates"],
    excludedModules: ["writing-rules", "audit-dimensions", "revision-guides"],
    maxContextTokens: 3000,
  },
};
