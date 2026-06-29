# GitHub/Skill 能力看台

一个本地优先的“能力资产库”看台：用 Obsidian Markdown 做长期数据源，用可视化页面浏览、搜索、分类、标注优先级，并一键复制给 Codex / Claude Code 的调用提示。

它不是普通收藏夹。适合把你经常在 GitHub、AI agent、Claude/Codex skill 里看到的好东西，沉淀成以后能想起来、能立刻调用的能力卡。

## 功能

- 读取本地 Markdown 能力卡，默认来自 Obsidian vault。
- 按任务场景搜索 GitHub 项目、AI skills、agent 工具。
- 左侧分类：AI视频、前端、自动化、知识库、文档、Agent、待整理。
- 右侧详情：调用提示、来源链接、Obsidian 入口。
- 手动修改分类和优先级，直接写回 Markdown。
- 删除噪音卡片，避免能力库变成垃圾堆。
- GitHub 轻量沉淀脚本：只读 README 和仓库元信息，不 clone、不安装、不试运行。

## 隐私设计

这个仓库只包含看台程序本身，不包含你的 Obsidian 笔记、能力卡、历史对话或本地 skill 文件。

- 能力卡从 `CAPABILITY_LIBRARY_DIR` 指向的本地目录读取。
- `.env`、本地能力卡目录、vault 目录和私有 Markdown 默认被 `.gitignore` 排除。
- 看台没有账号系统，也不会把能力卡上传到远端服务。
- `npm run ingest -- <github-url>` 只读取公开 GitHub README 和仓库元信息。
- 如果你 fork 或二次发布，建议不要把自己的 Obsidian vault 放进仓库目录。

## 运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173
```

默认能力库目录：

```text
~/Documents/Obsidian Vault/01-AI沉淀/能力库
```

如果你的 Obsidian vault 或能力库目录不同，可以用环境变量：

```bash
OBSIDIAN_VAULT_PATH="/path/to/Obsidian Vault" npm run dev
CAPABILITY_LIBRARY_DIR="/path/to/capability-cards" npm run dev
PORT=5174 npm run dev
```

也可以复制 `.env.example` 作为自己的配置参考。

## 固定对话指令

沉淀 GitHub 项目：

```text
沉淀GitHub: https://github.com/owner/repo
```

Codex / Claude Code 可以在本项目里运行：

```bash
npm run ingest -- https://github.com/owner/repo
```

检索能力库：

```text
查能力库: <我现在想做的任务>
```

AI 助手应该搜索能力库目录下 `type: capability-card` 的 Markdown 卡片，并优先推荐 `scenarios`、`activation_phrases`、`一句话能力` 命中的项目。

## 能力卡格式

每张能力卡都是一个 Markdown 文件，frontmatter 推荐结构如下：

```yaml
---
type: capability-card
source_type: github
title: ""
repo: ""
url: ""
status: ready
priority: low
created: ""
updated: ""
domains: []
scenarios: []
activation_phrases: []
agents: ["codex", "claude"]
readiness: callable
last_used: ""
---
```

正文推荐包含：

```markdown
# 项目名

## 一句话能力
## 什么时候想起它
## 给 Codex/Claude 的调用提示
## 使用线索
## 原始信息
## 使用记录
```

`priority` 只使用两个值：

- `high`：高优先级
- `low`：低优先级

## 给 Codex / Claude Code 的同步指令

你可以把下面这段给 AI coding agent：

```text
请使用同一个 GitHub/Skill 能力看台，不要另建目录。

能力库目录：
<你的 CAPABILITY_LIBRARY_DIR，或 Obsidian Vault/01-AI沉淀/能力库>

看台项目：
<这个仓库的本地路径>

工作规则：
1. 当我发“沉淀GitHub: <url>”或明确要求“放看台 / 记一下 / 沉淀一下”时，在能力库目录新建或更新一张 Markdown 调用卡。
2. 只读取 GitHub README + 元信息；不要 clone、不要安装、不要试运行，除非我明确要求。
3. 如果只是历史对话里出现过、还没确认会高频使用，status 用 remembered 或 inbox，readiness 用 remembered。
4. 如果我明确说要沉淀成可调用能力，status 用 ready，readiness 用 callable。
5. 当我说“查能力库: <任务>”，请搜索能力库，并推荐最相关的 3-5 张卡片。
6. 同步整理两类东西：历史对话里出现过的 GitHub 仓库，以及 Codex/Claude 常用或可能高频使用的 skill。
7. 两类都放同一个能力库目录，用 source_type 区分：github、codex-skill、claude-skill。
8. 避免重复卡片：GitHub 用 repo 去重，skill 用 title 或 source_path 去重。
9. 尊重看台里用户手动改过的 domains、priority 和删除结果。
10. 写完后运行 npm run check。
```

## 开发

```bash
npm run check
```

## License

MIT
