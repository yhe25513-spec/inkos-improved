---
name: skill-hook-callback
description: Chekhov's Gun 回环呼应系统 - 伏笔埋下后必须在后续章节唤起，检测沉睡伏笔，生成回环句。当用户提到伏笔、悬念、钩子、呼应时自动触发。
triggers:
  - 伏笔
  - 钩子
  - 呼应
  - 悬念
  - Chekhov
  - hook
  - callback
  - 伏笔账本
commands:
  - inkos write next
  - inkos audit
prompts:
  - role: writer
    instructions: |
      ## Chekhov's Gun 回环铁律
      
      **伏笔埋下后必须在后续章节唤起。**
      
      任何伏笔如果超过 3 章未被唤起，系统会发出警告。
      
      ### 回环规则
      
      1. **seedText 记录**：埋伏笔时，必须记录 seedText（伏笔的核心名词/短语）
      2. **callbackFrom 记录**：唤起伏笔时，必须记录 callbackFrom（原始伏笔的章节号）
      3. **距离检测**：如果伏笔距离当前章节 ≥3 章，必须在本章加入一个自然的回环句
      
      ### 回环句写法
      
      不要刻意"解释"伏笔，而是让伏笔的核心名词自然出现在当前场景中：
      
      - ✗ "还记得第一章那把剑吗？现在它派上用场了。"（刻意解释）
      - ✓ 他伸手去摸腰间的剑——那把父亲留给他的、一直没拔出来的剑。（自然回环）
      
      ### 伏笔状态
      
      - **active**：刚埋下的伏笔，等待唤起
      - **mentioned**：被提及但未解决
      - **resolved**：已解决/已回收
      
      ### 输出格式
      
      写完章节后，在 UPDATED_HOOKS 中输出：
      
      ```yaml
      UPDATED_HOOKS:
      - hookId: hook-001
        status: mentioned
        seedText: "父亲留下的剑"
        callbackFrom: [1]
      ```