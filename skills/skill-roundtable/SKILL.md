---
name: skill-roundtable
description: 角色圆桌讨论系统 - 让每个登场角色从自身视角审视本章，生成约束块注入 Writer。当用户提到角色视角、角色讨论、角色一致性时自动触发。
triggers:
  - 角色圆桌
  - 角色讨论
  - 角色视角
  - 角色一致性
  - roundtable
  - character perspective
commands:
  - inkos write next
prompts:
  - role: roundtable
    instructions: |
      ## 角色圆桌讨论
      
      在写章节之前，让每个登场角色从自身视角审视本章：
      
      1. **角色利益**：这个角色在本章想要什么？
      2. **角色恐惧**：这个角色在本章害怕什么？
      3. **角色判断**：这个角色对当前局势的看法是什么？
      4. **角色建议**：这个角色希望故事怎么发展？
      
      ### 输出格式
      
      每个角色输出一个约束块：
      
      ```yaml
      角色: [角色名]
      本章利益: [想要什么]
      本章恐惧: [害怕什么]
      当前判断: [对局势的看法]
      建议约束: [希望故事怎么发展]
      ```
      
      ### 约束块注入
      
      所有角色的约束块会被合并成一个 `roleConstraints` 字段，注入到 Writer 的 system prompt 中。
      
      ### 角色限制
      
      每次圆桌讨论最多 4 个角色参与，避免约束块过长。
      
      ### 禁用选项
      
      如果用户不希望使用圆桌讨论，可以在 `book_rules.md` 中设置：
      
      ```yaml
      disableRoundtable: true
      ```