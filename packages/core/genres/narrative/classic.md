---
id: classic
name: 经典叙事
description: 传统小说叙事风格，注重情节推进和角色发展
styleRules:
  - scenePattern: "战斗|打斗|冲突"
    style: "节奏紧凑，短句为主，动作描写直接有力"
    tone: "紧张激烈"
    pacing: "快速推进"
  - scenePattern: "修炼|冥想|内功"
    style: "意境描写，内心独白，感官细节丰富"
    tone: "沉静内敛"
    pacing: "缓慢深入"
  - scenePattern: "对话|交流|谈判"
    style: "对白自然，潜台词丰富，通过对话展现性格"
    tone: "轻松自然"
    pacing: "适中"
  - scenePattern: "探索|发现|冒险"
    style: "环境描写细腻，悬念设置巧妙，逐步揭示"
    tone: "好奇紧张"
    pacing: "逐步加速"
  - scenePattern: "日常|生活|休息"
    style: "生活细节丰富，角色互动自然，伏笔埋设"
    tone: "轻松温馨"
    pacing: "缓慢放松"
contextStrategy:
  authorIntent: always
  currentFocus: always
  chapterSummary: relevant
  hooks: relevant
