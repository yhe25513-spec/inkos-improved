---
name: skill-english-prose
description: 英文小说写作规则 - 信息揭示铁律、句子级节奏、空洞形容词检测、Anti-AI Example Table。当用户请求写英文小说、英文章节时自动触发。
triggers:
  - 英文小说
  - 英文写作
  - English novel
  - English prose
  - LitRPG
  - Progression Fantasy
commands:
  - inkos write next --lang en
  - inkos book create --lang en
prompts:
  - role: writer
    instructions: |
      ## English Prose Rules
      
      ### Information Reveal HARD RULES
      
      Any worldbuilding/setting/background information MUST be attached to concrete action or dialogue. NO standalone exposition paragraphs.
      
      - ✗ "This is a cultivation world where people practice spiritual energy to ascend realms..." (standalone exposition)
      - ✓ He stared at the jade slip, carved with "Foundation Establishment" — the one his father handed him before dying, claiming it was the first step toward immortality. (info attached to action)
      
      ### Sentence Rhythm
      
      One sentence, one breath. Mix short and long sentences — don't write 5+ sentences in a row of nearly identical 12-18 word length; that's a metronome and readers will drift.
      
      Every ~500 words, deliberately drop one sentence of ≤5 words as a standalone paragraph — a "short-bomb sentence" that gives the reader a beat of silence.
      
      After a short-bomb, the next paragraph must be a normal-length narrative paragraph that regathers the action.
      
      ### Abstract Adjective Detection
      
      Forbidden patterns:
      - "He was very/extremely/incredibly + [abstract adjective]"
      - "This made him feel [abstract emotion]"
      
      Must replace with:
      - Concrete action
      - Concrete physiological response
      - Concrete dialogue tone
      - Concrete environmental detail
      
      ### Anti-AI Example Table
      
      | Bad | Good |
      |-----|------|
      | "He was nervous." | "His fingers drummed three times on the table, then stopped. His throat felt like it had a stone lodged in it." |
      | "She felt angry." | "She slammed the cup down. 'You're lying.'" |
      | "This was a dangerous situation." | "Three guards. One exit. No weapons." |
      | "He realized the truth." | "Trap. He stepped back, hand already on the door." |
      | "The atmosphere was tense." | "No one spoke. No one moved. The only sound was the clock ticking." |
      | "He was shocked by the revelation." | "His coffee cup slipped. Crashed on the floor." |
      | "She felt a surge of hope." | "Her eyes lit up. She grabbed his arm." |
      | "He was deeply conflicted." | "He walked to the window. Walked back. Walked to the window again." |
      | "The scene was chaotic." | "Glass shattered. Someone screamed. Chairs toppled." |
      | "He felt a sense of dread." | "The hairs on his arms stood up. His breath caught." |
      | "She was overwhelmed by emotion." | "She couldn't speak. She couldn't move. She just stood there, tears running down her face." |
      | "He had an ominous feeling." | "Something was wrong. He could feel it in his gut." |