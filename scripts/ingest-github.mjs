import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH || path.join(os.homedir(), "Documents", "Obsidian Vault");
const CAPABILITY_DIR =
  process.env.CAPABILITY_LIBRARY_DIR ||
  path.join(VAULT_PATH, "01-AI沉淀", "能力库");

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

if (!url) {
  console.error("用法：npm run ingest -- https://github.com/owner/repo");
  process.exit(1);
}

const repoRef = parseGithubUrl(url);
const repoApi = `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}`;
const repoResponse = await fetch(repoApi, {
  headers: {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-skill-dashboard"
  }
});

if (!repoResponse.ok) {
  throw new Error(`GitHub 元信息读取失败：${repoResponse.status} ${repoResponse.statusText}`);
}

const repo = await repoResponse.json();
const readme = await fetchReadme(repoRef);
const card = buildCapabilityCard(repo, readme);
const filePath = path.join(CAPABILITY_DIR, `${repoRef.owner}-${repoRef.repo}.md`);

if (dryRun) {
  console.log(card);
} else {
  await fs.mkdir(CAPABILITY_DIR, { recursive: true });
  if (!force && (await exists(filePath))) {
    throw new Error(`能力卡已存在：${filePath}。如需覆盖，请加 --force。`);
  }
  await fs.writeFile(filePath, card, "utf8");
  console.log(`已生成能力卡：${filePath}`);
}

function parseGithubUrl(value) {
  const parsed = new URL(value);
  if (parsed.hostname !== "github.com") {
    throw new Error("目前只支持 github.com 仓库链接。");
  }

  const [owner, repo] = parsed.pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  if (!owner || !repo) {
    throw new Error("GitHub 链接需要包含 owner/repo。");
  }

  return { owner, repo: repo.replace(/\.git$/, "") };
}

async function fetchReadme(repoRef) {
  const response = await fetch(
    `https://api.github.com/repos/${repoRef.owner}/${repoRef.repo}/readme`,
    {
      headers: {
        Accept: "application/vnd.github.raw",
        "User-Agent": "github-skill-dashboard"
      }
    }
  );

  if (!response.ok) return "";
  return response.text();
}

function buildCapabilityCard(repo, readme) {
  const today = new Date().toISOString().slice(0, 10);
  const repoName = repo.full_name || `${repo.owner.login}/${repo.name}`;
  const title = toTitle(repo.name);
  const domains = inferDomains(repo, readme);
  const scenarios = inferScenarios(domains, repo, readme);
  const activationPhrases = inferActivationPhrases(repo, domains);
  const summary = repo.description || summarizeReadme(readme) || "待补充一句话能力";

  return `---
type: capability-card
source_type: github
title: ${quote(title)}
repo: ${quote(repoName)}
url: ${quote(repo.html_url)}
status: ready
priority: low
created: ${quote(today)}
updated: ${quote(today)}
domains: ${JSON.stringify(domains)}
scenarios: ${JSON.stringify(scenarios)}
activation_phrases: ${JSON.stringify(activationPhrases)}
agents: ["codex", "claude"]
readiness: callable
last_used: ""
---

# ${title}

## 一句话能力

${summary}

## 什么时候想起它

${scenarios.map((scenario) => `- ${scenario}`).join("\n")}

## 给 Codex/Claude 的调用提示

\`\`\`text
我想使用 ${title}（${repoName}）来解决：<描述我的任务>。
请先阅读仓库 README 和关键说明，只基于 README + 元信息判断最小可行用法；不要安装或试运行，除非我明确要求。
请告诉我它适合解决什么、最小调用路径是什么、需要注意哪些限制。
仓库链接：${repo.html_url}
\`\`\`

## 使用线索

- 主要语言：${repo.language || "未识别"}
- GitHub topics：${(repo.topics || []).join(", ") || "暂无"}
- 最近更新：${repo.updated_at ? repo.updated_at.slice(0, 10) : "未知"}

## 原始信息

- GitHub：${repo.html_url}
- README 摘要：${summarizeReadme(readme) || "待补充"}

## 使用记录

- 暂无
`;
}

function inferDomains(repo, readme) {
  const metadata = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`.toLowerCase();
  const readmeText = readme.toLowerCase();
  const domains = new Set();

  if (
    matches(metadata, ["seedance", "remotion", "ffmpeg", "libtv", "ai-video", "video-generation", "短剧", "视频生成", "分镜"]) ||
    matches(readmeText, ["seedance", "remotion", "libtv", "ai video", "video generation", "视频生成", "短剧分镜"])
  ) {
    domains.add("AI视频");
  }

  if (
    matches(metadata, ["react", "vue", "vite", "frontend", "ui", "dashboard", "web-app", "前端"]) ||
    matches(readmeText, ["react component", "vite", "frontend", "web dashboard", "ui component"])
  ) {
    domains.add("前端");
  }

  if (
    matches(metadata, ["playwright", "browser", "automation", "scrape", "crawler", "自动化", "浏览器"]) ||
    matches(readmeText, ["browser automation", "web automation", "playwright", "scraping"])
  ) {
    domains.add("自动化");
  }

  if (
    matches(metadata, ["obsidian", "markdown", "knowledge-base", "rag", "知识库", "笔记"]) ||
    matches(readmeText, ["obsidian", "knowledge base", "markdown notes", "rag pipeline"])
  ) {
    domains.add("知识库");
  }

  if (matches(metadata, ["pdf", "docx", "word", "slides", "spreadsheet", "文档"])) {
    domains.add("文档");
  }

  if (
    matches(metadata, ["agent", "skill", "mcp", "claude", "codex"]) ||
    matches(readmeText, ["model context protocol", "agent tool", "claude code", "codex"])
  ) {
    domains.add("Agent");
  }

  if (!domains.size) domains.add("待整理");
  return [...domains];
}

function inferScenarios(domains, repo, readme) {
  const scenarios = new Set();
  const text = `${repo.name} ${repo.description || ""} ${readme}`.toLowerCase();

  if (domains.includes("AI视频")) scenarios.add("AI 视频工作流");
  if (domains.includes("前端")) scenarios.add("前端页面或工具搭建");
  if (domains.includes("自动化")) scenarios.add("浏览器或流程自动化");
  if (domains.includes("知识库")) scenarios.add("知识沉淀与检索");
  if (domains.includes("文档")) scenarios.add("文档处理与生成");
  if (domains.includes("Agent")) scenarios.add("Agent 工具或 skill 调用");
  if (matches(text, ["test", "testing", "e2e"])) scenarios.add("测试与验证");

  return [...scenarios].slice(0, 5);
}

function inferActivationPhrases(repo, domains) {
  const phrases = new Set([
    repo.name,
    ...(repo.topics || []).slice(0, 6),
    ...domains
  ]);

  return [...phrases].filter(Boolean).slice(0, 10);
}

function summarizeReadme(readme) {
  return readme
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\[[^\]]+]\([^)]+\)/g, "").trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("---"))
    .find((line) => line.length > 24)
    ?.slice(0, 220);
}

function matches(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function toTitle(value) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (["AI", "API", "CLI", "MCP", "SDK", "UI"].includes(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function quote(value) {
  return JSON.stringify(String(value || ""));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
