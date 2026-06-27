---
id: cinematic
name: 电影风格
description: 电影化叙事，注重视觉冲击和节奏控制
styleRules:
  - scenePattern: "战斗|打斗|冲突"
    style: "镜头感强，画面切换快，动作特写与全景交替"
    tone: "紧张刺激"
    pacing: "快速剪辑"
  - scenePattern: "修炼|冥想|内功"
    style: "视觉化描写，能量流动可见，突破时刻戏剧化"
    tone: "神秘震撼"
    pacing: "慢镜头"
  - scenePattern: "对话|交流|谈判"
    style: "场景切换频繁，特写表情描写，环境烘托情绪"
    tone: "戏剧化"
    pacing: "适中"
  - scenePattern: "探索|发现|冒险"
    style: "航拍视角，环境全景，发现时刻视觉冲击"
    tone: "震撼好奇"
    pacing: "逐步加速"
  - scenePattern: "日常|生活|休息"
    style: "蒙太奇手法，时间跳跃，细节特写"
    tone: "轻松自然"
    pacing: "快速切换"
contextStrategy:
  authorIntent: always
  currentFocus: relevant
  chapterSummary: relevant
  hooks: relevant
