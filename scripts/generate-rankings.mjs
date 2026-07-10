import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const snapshotDir = path.join(dataDir, "snapshots");
const outputPath = path.join(dataDir, "rankings.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = Number(readFlag("--limit") || 12);
const perQueryLimit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 12;
const today = new Date().toISOString().slice(0, 10);

const categories = [
  { id: "all", label: "全部", description: "所有业务技术趋势" },
  { id: "ai", label: "AI", description: "模型、Agent、RAG、多模态、AI 应用与 LLMOps" },
  { id: "social", label: "社媒", description: "抖音、小红书、Twitter/X、B站、YouTube 等平台工具" },
  { id: "developer", label: "程序员", description: "开发框架、工程效率、测试、DevOps 与代码工具" },
  { id: "marketing", label: "营销市场", description: "增长、投放、CRM、SEO、活动和用户分析" },
  { id: "pr", label: "公关传播", description: "舆情、媒体监测、传播分析、品牌声誉与危机响应" },
  { id: "legal", label: "法务合规", description: "合同、隐私、安全合规、审计、政策和风险管理" },
  { id: "finance", label: "财务金融", description: "财务、会计、支付、投资、风控和金融数据分析" },
  { id: "design", label: "设计创意", description: "UI、视觉、图片、视频、3D、动效和创意生产" },
  { id: "ops", label: "运营管理", description: "流程自动化、项目管理、客服、监控、知识库和内部工具" }
];

const periods = [
  { id: "daily", label: "日榜", description: "过去 24 小时新增热度" },
  { id: "monthly", label: "月榜", description: "最近 30 天持续升温" },
  { id: "all", label: "总榜", description: "长期值得收藏的基础项目" }
];

const searchPlans = [
  {
    categoryId: "ai",
    queries: [
      "llm rag agent stars:>100 pushed:>2025-01-01",
      "generative-ai multimodal stars:>100 pushed:>2025-01-01",
      "llmops evaluation observability stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "social",
    queries: [
      "topic:social-media stars:>100 pushed:>2025-01-01",
      "tiktok youtube twitter analytics stars:>100 pushed:>2025-01-01",
      "wechat instagram reddit content stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "developer",
    queries: [
      "developer-tools cli framework stars:>100 pushed:>2025-01-01",
      "testing devops ci cd stars:>100 pushed:>2025-01-01",
      "code-review static-analysis stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "marketing",
    queries: [
      "marketing analytics crm stars:>100 pushed:>2025-01-01",
      "seo growth analytics stars:>100 pushed:>2025-01-01",
      "campaign attribution dashboard stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "pr",
    queries: [
      "sentiment-analysis media-monitoring stars:>100 pushed:>2025-01-01",
      "news monitoring reputation stars:>100 pushed:>2025-01-01",
      "osint public opinion stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "legal",
    queries: [
      "legal contract analysis stars:>100 pushed:>2025-01-01",
      "privacy compliance gdpr stars:>100 pushed:>2025-01-01",
      "policy audit security compliance stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "finance",
    queries: [
      "finance accounting dashboard stars:>100 pushed:>2025-01-01",
      "payment billing invoice stars:>100 pushed:>2025-01-01",
      "risk trading portfolio analysis stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "design",
    queries: [
      "design system ui components stars:>100 pushed:>2025-01-01",
      "image video generation creative stars:>100 pushed:>2025-01-01",
      "figma animation 3d stars:>100 pushed:>2025-01-01"
    ]
  },
  {
    categoryId: "ops",
    queries: [
      "workflow automation internal tool stars:>100 pushed:>2025-01-01",
      "customer support knowledge base stars:>100 pushed:>2025-01-01",
      "project management monitoring alerts stars:>100 pushed:>2025-01-01"
    ]
  }
];

await main();

async function main() {
  const previousSnapshots = await readPreviousSnapshots();
  const reposByName = new Map();

  for (const plan of searchPlans) {
    const repos = await searchPlanRepositories(plan, perQueryLimit);
    for (const repo of repos) {
      const current = reposByName.get(repo.full_name) || normalizeRepo(repo);
      current.categoryIds = unique([plan.categoryId, ...current.categoryIds, ...inferCategories(repo)]);
      current.businessSummary = summarizeBusinessValue(current);
      reposByName.set(repo.full_name, current);
    }
  }

  const repos = [...reposByName.values()].map((repo) => attachDeltas(repo, previousSnapshots));
  const rankings = {
    daily: rankRepos(repos, "dailyDelta", 24),
    monthly: rankRepos(repos, "monthlyDelta", 24),
    all: rankRepos(repos, "allScore", 24)
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    periods,
    categories,
    rankings
  };

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(snapshotDir, `${today}.json`),
    `${JSON.stringify(repos, null, 2)}\n`,
    "utf8"
  );
  console.log(`已生成榜单：${outputPath}`);
}

async function searchPlanRepositories(plan, limit) {
  const queryLimit = Math.max(1, Math.ceil(limit / plan.queries.length));
  const batches = [];
  for (const query of plan.queries) {
    batches.push(await searchRepositories(query, queryLimit));
  }
  const seen = new Set();
  return batches
    .flat()
    .filter(isUsefulCandidate)
    .filter((repo) => {
      if (seen.has(repo.full_name)) return false;
      seen.add(repo.full_name);
      return true;
    })
    .slice(0, limit);
}

async function searchRepositories(query, limit) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(limit, 100)));

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-skill-dashboard"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub 搜索失败：${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.items || [];
}

async function readPreviousSnapshots() {
  try {
    const files = (await fs.readdir(snapshotDir))
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .sort();
    const snapshots = await Promise.all(
      files.map(async (file) => ({
        date: file.slice(0, 10),
        repos: await readJson(path.join(snapshotDir, file))
      }))
    );
    return snapshots;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function normalizeRepo(repo) {
  return {
    rank: 0,
    fullName: repo.full_name,
    url: repo.html_url,
    description: cleanDescription(repo.description),
    businessSummary: "",
    categoryIds: inferCategories(repo),
    language: repo.language || "Unknown",
    stars: Number(repo.stargazers_count || 0),
    periodStars: 0,
    updatedAt: repo.updated_at ? repo.updated_at.slice(0, 10) : "",
    topics: repo.topics || [],
    dailyDelta: 0,
    monthlyDelta: 0,
    allScore: 0
  };
}

function attachDeltas(repo, snapshots) {
  const dailyBase = findSnapshotRepo(snapshots.at(-1), repo.fullName);
  const monthlyBase = findSnapshotRepo(findSnapshotBefore(snapshots, 30), repo.fullName);
  const dailyDelta = Math.max(0, repo.stars - Number(dailyBase?.stars || repo.stars));
  const monthlyDelta = Math.max(0, repo.stars - Number(monthlyBase?.stars || repo.stars));
  const recencyScore = daysSince(repo.updatedAt) <= 14 ? 1000 : 0;

  return {
    ...repo,
    dailyDelta,
    monthlyDelta,
    allScore: repo.stars + recencyScore
  };
}

function findSnapshotBefore(snapshots, days) {
  const target = Date.now() - days * 24 * 60 * 60 * 1000;
  return [...snapshots].reverse().find((snapshot) => new Date(snapshot.date).getTime() <= target);
}

function findSnapshotRepo(snapshot, fullName) {
  if (!snapshot) return null;
  return (snapshot.repos || []).find((repo) => repo.fullName === fullName);
}

function rankRepos(repos, scoreKey, limit) {
  return [...repos]
    .sort((left, right) => Number(right[scoreKey] || 0) - Number(left[scoreKey] || 0) || right.stars - left.stars)
    .slice(0, limit)
    .map((repo, index) => ({
      rank: index + 1,
      fullName: repo.fullName,
      url: repo.url,
      description: cleanDescription(repo.description),
      businessSummary: repo.businessSummary || summarizeBusinessValue(repo),
      categoryIds: repo.categoryIds.length ? repo.categoryIds : ["developer"],
      language: repo.language || "Unknown",
      stars: repo.stars,
      periodStars: scoreKey === "allScore" ? repo.stars : Number(repo[scoreKey] || 0),
      updatedAt: repo.updatedAt,
      topics: repo.topics || []
    }));
}

function inferCategories(repo) {
  const text = `${repo.full_name} ${cleanDescription(repo.description)} ${(repo.topics || []).join(" ")}`.toLowerCase();
  const matches = [];
  if (
    hasAny(text, [
      "ai-", "artificial intelligence", "machine-learning", "deep-learning", "agent",
      "agents", "rag", "llm", "llmops", "mcp", "model", "models", "multimodal",
      "generative", "generative-ai", "openai", "anthropic", "ollama", "embedding"
    ])
  ) {
    matches.push("ai");
  }
  if (
    hasAny(text, [
      "social", "social-media", "twitter", "x.com", "xhs", "xiaohongshu", "rednote",
      "douyin", "tiktok", "instagram", "youtube", "bilibili", "wechat", "weibo",
      "reddit", "telegram", "content creator"
    ])
  ) {
    matches.push("social");
  }
  if (
    hasAny(text, [
      "developer", "framework", "sdk", "api", "cli", "devops", "testing",
      "test", "code", "lint", "static-analysis", "debug", "deploy", "kubernetes"
    ])
  ) {
    matches.push("developer");
  }
  if (
    hasAny(text, [
      "marketing", "growth", "seo", "crm", "campaign", "attribution", "ads",
      "advertising", "conversion", "funnel", "lead", "customer analytics"
    ])
  ) {
    matches.push("marketing");
  }
  if (
    hasAny(text, [
      "sentiment", "reputation", "media-monitoring", "media monitoring", "public opinion",
      "news", "press", "brand", "osint", "crisis", "monitoring"
    ])
  ) {
    matches.push("pr");
  }
  if (
    hasAny(text, [
      "legal", "contract", "compliance", "gdpr", "privacy", "policy", "audit",
      "risk", "security compliance", "license", "licensing"
    ])
  ) {
    matches.push("legal");
  }
  if (
    hasAny(text, [
      "finance", "financial", "accounting", "invoice", "billing", "payment",
      "trading", "portfolio", "stock", "crypto", "risk management", "tax"
    ])
  ) {
    matches.push("finance");
  }
  if (
    hasAny(text, [
      "design", "ui", "ux", "figma", "creative", "image", "video", "animation",
      "3d", "threejs", "webgl", "motion", "editor", "visual"
    ])
  ) {
    matches.push("design");
  }
  if (
    hasAny(text, [
      "workflow", "automation", "operations", "project management", "customer support",
      "knowledge base", "helpdesk", "dashboard", "alert", "alerts", "observability",
      "internal tool", "admin"
    ])
  ) {
    matches.push("ops");
  }
  return unique(matches);
}

function summarizeBusinessValue(repo) {
  const primaryCategory = (repo.categoryIds || [])[0];
  if (primaryCategory === "ai") return "适合构建 AI 应用、模型工作流、RAG、Agent 或 LLM 评测监控。";
  if (primaryCategory === "social") return "适合社媒平台内容生产、账号运营、发布管理、数据分析或趋势追踪。";
  if (primaryCategory === "developer") return "适合程序员提升开发、测试、部署、代码质量或工程协作效率。";
  if (primaryCategory === "marketing") return "适合营销市场团队做增长、投放、CRM、SEO、活动复盘或用户分析。";
  if (primaryCategory === "pr") return "适合公关传播团队做舆情监测、媒体分析、品牌声誉和传播复盘。";
  if (primaryCategory === "legal") return "适合法务合规场景里的合同分析、隐私合规、审计和风险管理。";
  if (primaryCategory === "finance") return "适合财务金融场景里的账单、支付、风控、投资组合或经营数据分析。";
  if (primaryCategory === "design") return "适合设计创意团队做 UI、视觉、视频、图片、3D 或动效生产。";
  if (primaryCategory === "ops") return "适合运营管理团队做流程自动化、项目协作、客服、知识库或监控告警。";
  return "适合进一步评估业务场景价值的开源项目。";
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function isUsefulCandidate(repo) {
  const description = cleanDescription(repo.description);
  const text = `${repo.full_name} ${description} ${(repo.topics || []).join(" ")}`.toLowerCase();
  if (!repo.full_name || !repo.html_url) return false;
  if (repo.fork || repo.archived) return false;
  if (description.length > 520) return false;
  if (
    hasAny(text, [
      "propaganda",
      "dictatorship",
      "censorship-circumvention",
      "political propaganda",
      "hate speech"
    ])
  ) {
    return false;
  }
  return true;
}

function cleanDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function daysSince(dateString) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - new Date(dateString).getTime()) / (24 * 60 * 60 * 1000));
}

function readFlag(flag) {
  const index = args.indexOf(flag);
  if (index === -1) return "";
  return args[index + 1] || "";
}
