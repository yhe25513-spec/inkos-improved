---
name: "inkos"
description: "AI小说创作助手 - 用于长篇小说写作、短篇故事包、封面生成、开放世界/分支互动、同人创作、文风仿写、章节续写、EPUB导出、AIGC检测。当用户想要写小说、写短篇、创建角色、续写章节、做封面、做互动游戏时使用。"
---

# InkOS - 故事创作 AI Agent

InkOS 是一个本地 AI 故事创作系统，支持 Studio Chat、CLI 和 TUI 三种交互方式，共用同一套创作内核。

## 核心能力

- **长篇小说**：规划 → 编排 → 写作 → 审计 → 修订完整管线，支持上下文治理、伏笔追踪、状态持久化
- **短篇故事**：独立生成完整短篇包（正文、大纲、卖点、封面提示词、可选封面图）
- **封面生成**：为已有标题或简介生成/重生成封面图
- **开放世界/分支互动**：用自然语言创建互动世界，支持自由动作、可点击选择、世界状态维护
- **同人创作**：从原作素材创建同人书（正典延续/架空/性格重塑/CP向）
- **文风仿写**：分析参考文本并应用到后续创作
- **章节导入续写**：导入已有章节，自动重建状态并继续创作
- **多模型路由**：不同 Agent 分配不同模型（写作/审计/雷达可走不同 provider）
- **AIGC 检测**：33 维度质量审计 + AI 痕迹检测

## 适用场景

- 用户说"写一本 X 题材小说"
- 用户说"写一个短篇，方向是..."
- 用户说"继续写下一章"
- 用户说"生成一张封面"
- 用户说"做一个开放世界游戏"
- 用户说"分析这段文字的文风"
- 用户说"导入我之前的小说继续写"
- 用户说"审计一下第 X 章"

## 快速开始

### 初始化项目
```bash
inkos init my-novel
cd my-novel
```

### 配置模型（以 OpenAI 为例）
```bash
export OPENAI_API_KEY=sk-xxx
inkos config set-global --provider openai --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-4o
```

### 创建新书
```bash
inkos book create --title "我的小说" --genre xuanhuan --chapter-words 3000
```

### 写下一章
```bash
inkos write next --count 3 --words 3000 --context "主角发现自己的能力"
```

### 自然语言交互入口（推荐）
```bash
inkos interact --json --message "继续当前书，但把节奏再收紧一点"
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `inkos book create` | 创建新书（--genre、--brief、--lang） |
| `inkos write next` | 完整管线写下一章 |
| `inkos draft` | 只写草稿 |
| `inkos audit` | 33维度质量审计 |
| `inkos revise` | 修订章节（polish/spot-fix/rewrite/anti-detect） |
| `inkos short run` | 生成独立短篇包 |
| `inkos generate_cover` | 生成封面 |
| `inkos play_start` / `inkos play_step` | 开放世界/分支互动 |
| `inkos import chapters` | 导入章节续写 |
| `inkos style analyze` | 分析文风 |
| `inkos detect` | AIGC 检测 |
| `inkos export` | 导出（txt/md/epub） |
| `inkos analytics` | 数据分析 |
| `inkos studio` / `inkos` | 启动 Web 工作台 |
| `inkos tui` | 启动终端 TUI |
| `inkos interact` | 自然语言交互入口 |
| `inkos doctor` | 诊断配置问题 |

## 题材类型

**英文题材**：`litrpg`, `progression`, `isekai`, `cultivation`, `system-apocalypse`, `dungeon-core`, `romantasy`, `sci-fi`, `tower-climber`, `cozy`

**中文题材**：`xuanhuan`（玄幻）、`xianxia`（仙侠）、`urban`（都市）、`horror`（恐怖）、`other`

## 交互原则

1. **以工具结果为准**：书本、短篇、封面、互动世界的完成以对应文件和工具结果为准，不要从模型回复文本推断完成状态
2. **优先自然语言入口**：用 `inkos interact --json --message "..."` 作为主要交互方式，而非拼凑多个原子命令
3. **上下文治理**：protected 事实和当前意图不应被静默压缩；compressible 历史在上下文紧张时可被摘要
4. **确认后执行**：重动作（删除、重写、导出）会先确认

## 状态管理

- **结构化状态**：`story/state/*.json` 是权威运行时状态，经过 Zod schema 校验
- **可读投影**：`current_state.md`、`pending_hooks.md`、`chapter_summaries.md` 等供人类阅读
- **时序记忆**：`story/memory.db`（Node 22+）支持相关性检索

## 注意事项

- 所有 inkos 命令需要在已初始化 `inkos init` 的项目目录下运行
- API Key 优先使用 `--api-key-env` 传入环境变量名，而非明文
- Studio 和 CLI 使用独立的配置体系，不会互相污染
- 写作前用 `--context` 提供创作指导，叙事连贯性更好
