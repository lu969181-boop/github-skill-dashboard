# GitHub 趋势雷达

一个面向中文业务技术交叉人群的 GitHub 趋势榜单原型。它不是单纯复刻 GitHub Trending，而是把开源项目翻译成 AI、社媒、程序员、营销市场、公关传播、法务合规、财务金融、设计创意、运营管理等专业领域里的可用信号。

## v0 功能

- 首页直接展示公开榜单，不做登录、收藏、投稿或复杂后台。
- 支持 `日榜`、`月榜`、`总榜` 三种周期切换。
- 支持 `AI`、`社媒`、`程序员`、`营销市场`、`公关传播`、`法务合规`、`财务金融`、`设计创意`、`运营管理` 等专业领域筛选。
- 每个项目展示排名、仓库名、中文业务解读、周期新增星标、总星标、语言、更新时间、GitHub 链接和业务标签。
- 使用静态 `data/rankings.json` 驱动页面，已内置 GitHub Actions 日更和 GitHub Pages 部署配置。

## 运行

```bash
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173
```

## 数据生成

首版数据结构在 `data/rankings.json`。可以用脚本从 GitHub Search API 拉候选仓库并生成同结构数据：

```bash
npm run generate:rankings -- --dry-run --limit 3
npm run generate:rankings:dry
npm run generate:rankings
```

脚本会读取 `data/snapshots/` 里的历史快照计算日榜、月榜新增星标。第一次运行没有历史快照时，新增星标会是 `0`；从第二天开始才会产生真实周期差值。

如需更高 GitHub API 额度，可以设置：

```bash
GITHUB_TOKEN=... npm run generate:rankings
```

## GitHub Pages 日更部署

仓库已包含 `.github/workflows/deploy-pages.yml`：

- 每天 UTC 00:15 自动生成榜单并部署。
- 每次推送到 `main` 也会部署。
- 可以在 GitHub Actions 手动运行 `Deploy GitHub Trend Radar`。
- 工作流使用 GitHub Actions cache 保存 `data/snapshots/`，用于计算日榜和月榜星标差值。

启用方式：

1. 把仓库推到 GitHub。
2. 在仓库 `Settings -> Pages` 中将 Source 设为 `GitHub Actions`。
3. 首次手动运行 `Deploy GitHub Trend Radar`。

## 构建检查

```bash
npm run check
```

## 说明

旧版本地能力库和 `npm run ingest -- <github-url>` 脚本暂时保留，后续可以作为运营后台或人工修正入口使用；v0 公开站不依赖本地 Obsidian 能力卡。

## License

MIT
