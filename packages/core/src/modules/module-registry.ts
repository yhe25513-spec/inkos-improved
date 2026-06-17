/**
 * 模块注册表
 * 管理可按需加载的上下文模块
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export type ModuleId =
  | "writing-rules"       // 写作规则
  | "audit-dimensions"    // 审计维度
  | "revision-guides"     // 修订指南
  | "genre-profile"       // 类型档案
  | "hook-governance"     // 伏笔治理
  | "character-templates" // 角色模板
  | "style-guides"        // 风格指南
  | "entity-extraction";  // 实体提取

export interface Module {
  id: ModuleId;
  content: string;           // 模块内容
  tokenCount: number;        // token 数量（估算）
  dependencies: ModuleId[];  // 依赖的模块
  description: string;       // 模块描述
}

export interface ModuleRegistryConfig {
  projectRoot: string;
  modulesDir?: string;
}

export class ModuleRegistry {
  private modules: Map<ModuleId, Module> = new Map();
  private modulesDir: string;

  constructor(config: ModuleRegistryConfig) {
    this.modulesDir = config.modulesDir || join(config.projectRoot, "packages/core/src/modules");
    this.loadAllModules();
  }

  /**
   * 加载所有模块
   */
  private loadAllModules(): void {
    const moduleDefinitions: Array<{
      id: ModuleId;
      file: string;
      description: string;
      dependencies: ModuleId[];
    }> = [
      {
        id: "writing-rules",
        file: "writing-rules.md",
        description: "写作规则和技巧",
        dependencies: [],
      },
      {
        id: "audit-dimensions",
        file: "audit-dimensions.md",
        description: "33 维审计检查维度",
        dependencies: [],
      },
      {
        id: "revision-guides",
        file: "revision-guides.md",
        description: "修订指南和模式",
        dependencies: [],
      },
      {
        id: "genre-profile",
        file: "genre-profile.md",
        description: "类型档案和规则",
        dependencies: [],
      },
      {
        id: "hook-governance",
        file: "hook-governance.md",
        description: "伏笔治理规则",
        dependencies: [],
      },
      {
        id: "character-templates",
        file: "character-templates.md",
        description: "角色模板和人设",
        dependencies: [],
      },
      {
        id: "style-guides",
        file: "style-guides.md",
        description: "风格指南",
        dependencies: [],
      },
      {
        id: "entity-extraction",
        file: "entity-extraction.md",
        description: "实体提取规则",
        dependencies: [],
      },
    ];

    for (const def of moduleDefinitions) {
      try {
        const filePath = join(this.modulesDir, def.file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          this.modules.set(def.id, {
            id: def.id,
            content,
            tokenCount: this.estimateTokenCount(content),
            dependencies: def.dependencies,
            description: def.description,
          });
        } else {
          // 如果文件不存在，创建默认内容
          const defaultContent = this.createDefaultContent(def.id);
          this.modules.set(def.id, {
            id: def.id,
            content: defaultContent,
            tokenCount: this.estimateTokenCount(defaultContent),
            dependencies: def.dependencies,
            description: def.description,
          });
        }
      } catch (error) {
        console.warn(`Failed to load module ${def.id}: ${error}`);
      }
    }
  }

  /**
   * 获取模块
   */
  getModule(id: ModuleId): Module | undefined {
    return this.modules.get(id);
  }

  /**
   * 获取多个模块
   */
  getModules(ids: ModuleId[]): Module[] {
    return ids
      .map(id => this.modules.get(id))
      .filter(Boolean) as Module[];
  }

  /**
   * 获取所有模块 ID
   */
  getModuleIds(): ModuleId[] {
    return Array.from(this.modules.keys());
  }

  /**
   * 获取模块描述
   */
  getModuleDescription(id: ModuleId): string {
    return this.modules.get(id)?.description || "";
  }

  /**
   * 估算 token 数量
   */
  private estimateTokenCount(text: string): number {
    // 中文字符数 / 2 + 英文单词数
    const chineseChars = (text.match(/[一-鿿]/g) || []).length;
    const englishWords = text.split(/\s+/).length;
    return Math.ceil(chineseChars / 2 + englishWords);
  }

  /**
   * 创建默认模块内容
   */
  private createDefaultContent(id: ModuleId): string {
    const defaults: Record<ModuleId, string> = {
      "writing-rules": `# 写作规则

## 基本原则
1. 情绪通过动作展现，不要直接陈述
2. 对话要符合角色人设
3. 场景描写要有五感细节
4. 节奏要有张有弛
5. 伏笔要按时回收

## 禁忌
- 不要出现 AI 写作痕迹
- 不要角色人设崩塌
- 不要时间线混乱
- 不要设定前后矛盾`,

      "audit-dimensions": `# 审计维度

## 33 维检查
1. OOC 检查（角色人设一致性）
2. 时间线检查
3. 设定冲突检查
4. 力量体系检查
5. 数值一致性检查
6. 伏笔检查
7. 节奏检查
8. 风格检查
9. 信息边界检查
10. 词汇疲劳检查
...`,

      "revision-guides": `# 修订指南

## 修订模式
- auto: 自动选择修订方式
- polish: 润色，只改表达
- rewrite: 改写，允许重组
- rework: 重写，可重构场景
- anti-detect: 反检测改写
- spot-fix: 定点修复`,

      "genre-profile": `# 类型档案

## 玄幻
- 力量体系要清晰
- 战斗描写要有画面感
- 升级节奏要合理

## 都市
- 现代感要强
- 对话要口语化
- 情感要真实

## 仙侠
- 修仙体系要完整
- 法宝描写要具体
- 意境要有韵味`,

      "hook-governance": `# 伏笔治理

## 规则
1. 活跃伏笔不超过 12 个
2. 伏笔要及时推进
3. 核心伏笔要优先处理
4. 新伏笔要有因果关联
5. 伏笔回收要自然`,

      "character-templates": `# 角色模板

## 主角
- 性格特点
- 成长弧线
- 核心动机

## 配角
- 功能定位
- 与主角关系
- 独特特征

## 反派
- 动机合理性
- 威胁程度
- 智商在线`,

      "style-guides": `# 风格指南

## 文笔要求
- 句式要有变化
- 段落长度要差异化
- 用词要精准
- 节奏要有呼吸感

## 禁忌词汇
- 避免 AI 高频词
- 减少口语化表达
- 避免重复用词`,

      "entity-extraction": `# 实体提取规则

## 6 类实体
1. 角色 (character)
2. 关系 (relationship)
3. 场景 (scene)
4. 组织 (organization)
5. 物品 (item)
6. 概念 (concept)

## 提取原则
- 提取所有出现的实体
- 实体名称使用最常用的名字
- 关系类型要标准
- 状态变化要标记`,
    };

    return defaults[id] || "";
  }
}
