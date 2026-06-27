---
id: minimalist
name: 极简风格
description: 简洁精炼的叙事风格，强调留白和暗示
styleRules:
  - scenePattern: "战斗|打斗|冲突"
    style: "简洁有力，动作精准，结果暗示过程"
    tone: "冷静克制"
    pacing: "快速结束"
  - scenePattern: "修炼|冥想|内功"
    style: "意境留白，感悟式描写，少即是多"
    tone: "空灵淡然"
    pacing: "缓慢"
  - scenePattern: "对话|交流|谈判"
    style: "对白精炼，潜台词丰富，沉默即表达"
    tone: "冷峻简洁"
    pacing: "适中"
  - scenePattern: "探索|发现|冒险"
    style: "环境描写精简，重点突出，暗示多于描述"
    tone: "神秘含蓄"
    pacing: "适中"
  - scenePattern: "日常|生活|休息"
    style: "生活细节精选，一个动作胜过千言"
    tone: "平淡真实"
    pacing: "缓慢"
contextStrategy:
  authorIntent: always
  currentFocus: always
  chapterSummary: never
  hooks: relevant
