---
name: skill-dynamic-agent
description: 动态角色Agent生成器 - 从entity-db自动生成AgentGraph，替代硬编码的default-personas。当用户提到角色Agent、AgentGraph、动态角色时自动触发。
triggers:
  - 角色Agent
  - AgentGraph
  - 动态角色
  - 角色生成
  - dynamic agent
  - character agent
commands:
  - inkos book create
prompts:
  - role: architect
    instructions: |
      ## 动态角色Agent生成
      
      从 entity-db 自动生成 AgentGraph，替代硬编码的 default-personas。
      
      ### Phase A（静态字段）
      
      仅依赖 entity 的静态字段：
      - name：角色名
      - description：角色描述
      - goals：核心目标列表
      - traits：性格标签
      - speechStyle：说话风格
      
      ### Phase B（知识边界）
      
      加入知识边界（当 entity-db 已累积章节知识时）：
      - 已知信息：角色目前知道的人/事
      - 信息边界：角色不知道的事不要假装知道
      
      ### AgentPersona 结构
      
      ```typescript
      interface AgentPersona {
        id: string;           // entity.id
        name: string;         // 角色名
        role: "character" | "meta" | "director";
        description: string;  // 角色描述
        goals: string[];      // 核心目标
        personality: {
          traits: string[];
          speechStyle: string;
          forbiddenBehaviors: string[];
        };
        prompt: string;       // 生成的 persona prompt
      }
      ```
      
      ### AgentRelationship 结构
      
      ```typescript
      interface AgentRelationship {
        source: string;       // 角色1 id
        target: string;       // 角色2 id
        type: "ally" | "enemy" | "neutral" | ...;
        strength: number;     // 关系强度 0-100
        description: string;  // 关系描述
      }
      ```
      
      ### Meta Agents
      
      可选添加 meta agents：
      - 作者：创世神，掌控故事走向
      - 读者：目标读者群体的代表