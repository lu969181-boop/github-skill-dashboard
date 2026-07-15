import React from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import {
  ArrowUpRight,
  ExternalLink,
  Flame,
  Github,
  Search,
  Sparkles,
  Trophy
} from "lucide-react";
import rankingsData from "../data/rankings.json";
import "./styles.css";

const DEFAULT_PERIOD = "daily";
const DEFAULT_CATEGORY = "all";

function App() {
  const [periodId, setPeriodId] = React.useState(DEFAULT_PERIOD);
  const [categoryId, setCategoryId] = React.useState(DEFAULT_CATEGORY);
  const [query, setQuery] = React.useState("");
  const [selectedRepoName, setSelectedRepoName] = React.useState("");

  const periods = rankingsData.periods || [];
  const categories = rankingsData.categories || [];
  const activePeriod = periods.find((period) => period.id === periodId) || periods[0];
  const activeCategory = categories.find((category) => category.id === categoryId) || categories[0];
  const activeRepos = rankingsData.rankings?.[activePeriod?.id] || [];

  const filteredRepos = React.useMemo(
    () => filterRepos(activeRepos, categoryId, query),
    [activeRepos, categoryId, query]
  );

  const selectedRepo = React.useMemo(() => {
    if (!filteredRepos.length) return null;
    return (
      filteredRepos.find((repo) => repo.fullName === selectedRepoName) ||
      filteredRepos[0]
    );
  }, [filteredRepos, selectedRepoName]);

  React.useEffect(() => {
    setSelectedRepoName(filteredRepos[0]?.fullName || "");
  }, [periodId, categoryId, query, filteredRepos]);

  const stats = React.useMemo(() => buildStats(activeRepos, filteredRepos), [activeRepos, filteredRepos]);

  return (
    <main className="site-shell">
      <div className="ambient-backdrop" aria-hidden="true" />

      <section className="hero-board">
        <SiteHeader generatedAt={rankingsData.generatedAt} />
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              <span className="hero-line">LET&apos;S FIND</span>
              <span className="hero-line hero-line-offset">OPEN-SOURCE</span>
              <span className="hero-line">SIGNALS</span>
            </h1>
            <p>
              给中文业务技术交叉人看的 GitHub 趋势雷达。用日榜、月榜、总榜发现 AI、社媒、程序员、营销市场、法务、财务等专业领域的新工具。
            </p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <img src="/assets/trend-glass-word.png" alt="" />
            <span className="sticker sticker-social">SOCIAL</span>
            <span className="sticker sticker-dev">DEV</span>
            <span className="sticker sticker-legal">LEGAL</span>
            <span className="sticker sticker-ai">AI</span>
          </div>
        </div>

        <div className="hero-footer">
          <span>BUSINESS-READY REPOS</span>
          <strong>{activeRepos.length} entries tracked</strong>
          <span>每日 08:15 左右更新（北京时间）</span>
        </div>
      </section>

      <section className="ranking-board" id="rankings" aria-label="GitHub 趋势榜单">
        <div className="board-heading">
          <div>
            <span className="section-label">TREND BOARD</span>
            <h2>GitHub {activePeriod?.label || "榜单"} · {activeCategory?.label || "全部"}</h2>
            <p>{activePeriod?.description}，{activeCategory?.description}</p>
          </div>
          <div className="metric-strip" aria-label="当前榜单统计">
            <Metric icon={<Flame size={17} />} label="周期热度" value={`+${formatNumber(stats.periodStars)}`} />
            <Metric icon={<Github size={17} />} label="项目数" value={String(stats.filteredCount)} />
            <Metric icon={<Trophy size={17} />} label="候选池" value={String(stats.totalCount)} />
          </div>
        </div>

        <div className="controls-row">
          <div className="period-tabs" role="tablist" aria-label="榜单周期">
            {periods.map((period) => (
              <button
                aria-selected={period.id === periodId}
                className={period.id === periodId ? "period-tab active" : "period-tab"}
                key={period.id}
                onClick={() => setPeriodId(period.id)}
                role="tab"
                type="button"
              >
                {period.label}
              </button>
            ))}
          </div>

          <label className="search-control">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索仓库、场景、语言或 topic"
            />
          </label>
        </div>

        <div className="category-row" aria-label="榜单品类">
          {categories.map((category) => (
            <button
              className={category.id === categoryId ? "category-chip active" : "category-chip"}
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="ranking-layout">
          <section className="repo-list" aria-label="仓库榜单">
            {filteredRepos.length ? (
              filteredRepos.map((repo) => (
                <RepoRow
                  categoryMap={buildCategoryMap(categories)}
                  key={repo.fullName}
                  repo={repo}
                  selected={selectedRepo?.fullName === repo.fullName}
                  onSelect={() => setSelectedRepoName(repo.fullName)}
                />
              ))
            ) : (
              <div className="empty-state">
                没有匹配项目。换一个品类或搜索词试试。
              </div>
            )}
          </section>

          <RepoDetail repo={selectedRepo} categories={categories} period={activePeriod} />
        </div>
      </section>
    </main>
  );
}

function SiteHeader({ generatedAt }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="GitHub Trend Radar">
        <span className="brand-mark">
          <Sparkles size={18} />
        </span>
        <span>GITHUB TREND RADAR</span>
      </a>
      <nav aria-label="站点导航">
        <a href="#rankings">RANKINGS</a>
        <a href="https://github.com" target="_blank" rel="noreferrer">GITHUB</a>
        <span>{formatDate(generatedAt)}</span>
      </nav>
    </header>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RepoRow({ categoryMap, repo, selected, onSelect }) {
  return (
    <button className={selected ? "repo-row selected" : "repo-row"} onClick={onSelect} type="button">
      <span className="rank-number">{String(repo.rank).padStart(2, "0")}</span>
      <div className="repo-main">
        <div className="repo-line">
          <strong>{repo.fullName}</strong>
          <span>{repo.language || "Unknown"}</span>
        </div>
        <p>{repo.businessSummary || repo.description || "待补充中文业务解读"}</p>
        <div className="tag-line">
          {(repo.categoryIds || []).slice(0, 3).map((categoryId) => (
            <span key={categoryId}>{categoryMap[categoryId] || categoryId}</span>
          ))}
        </div>
      </div>
      <div className="repo-score">
        <strong>+{formatNumber(repo.periodStars)}</strong>
        <span>{formatNumber(repo.stars)} stars</span>
      </div>
    </button>
  );
}

function RepoDetail({ categories, period, repo }) {
  if (!repo) {
    return (
      <aside className="repo-detail empty">
        选择一个项目查看详情。
      </aside>
    );
  }

  const categoryMap = buildCategoryMap(categories);

  return (
    <aside className="repo-detail">
      <div className="detail-top">
        <div>
          <span className="section-label">SELECTED REPO</span>
          <h3>{repo.fullName}</h3>
        </div>
        <a href={repo.url} target="_blank" rel="noreferrer" title="打开 GitHub">
          <ExternalLink size={18} />
        </a>
      </div>

      <p className="business-summary">{repo.businessSummary || "待补充中文业务解读"}</p>
      <p className="repo-description">{repo.description || "暂无英文描述。"}</p>

      <dl className="detail-stats">
        <div>
          <dt>{period?.label || "周期"}新增</dt>
          <dd>+{formatNumber(repo.periodStars)}</dd>
        </div>
        <div>
          <dt>总星标</dt>
          <dd>{formatNumber(repo.stars)}</dd>
        </div>
        <div>
          <dt>主要语言</dt>
          <dd>{repo.language || "Unknown"}</dd>
        </div>
        <div>
          <dt>最近更新</dt>
          <dd>{repo.updatedAt || "未知"}</dd>
        </div>
      </dl>

      <section className="detail-section">
        <h4>业务标签</h4>
        <div className="detail-tags">
          {(repo.categoryIds || []).map((categoryId) => (
            <span key={categoryId}>{categoryMap[categoryId] || categoryId}</span>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <h4>GitHub Topics</h4>
        <div className="detail-tags muted">
          {(repo.topics || []).length
            ? repo.topics.map((topic) => <span key={topic}>{topic}</span>)
            : <span>暂无 topics</span>}
        </div>
      </section>

      <a className="github-link" href={repo.url} target="_blank" rel="noreferrer">
        <Github size={18} />
        <span>查看仓库</span>
        <ArrowUpRight size={16} />
      </a>
    </aside>
  );
}

function filterRepos(repos, categoryId, query) {
  const terms = buildSearchTerms(query);

  return repos.filter((repo) => {
    const categoryMatched =
      categoryId === DEFAULT_CATEGORY || (repo.categoryIds || []).includes(categoryId);
    if (!categoryMatched) return false;
    if (!terms.length) return true;

    const haystack = [
      repo.fullName,
      repo.description,
      repo.businessSummary,
      repo.language,
      ...(repo.topics || []),
      ...(repo.categoryIds || [])
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

function buildSearchTerms(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/[\s,，。；;:：/|]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function buildStats(totalRepos, filteredRepos) {
  return {
    totalCount: totalRepos.length,
    filteredCount: filteredRepos.length,
    periodStars: filteredRepos.reduce((sum, repo) => sum + Number(repo.periodStars || 0), 0)
  };
}

function buildCategoryMap(categories) {
  return Object.fromEntries((categories || []).map((category) => [category.id, category.label]));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(value || 0)
  );
}

function formatDate(value) {
  if (!value) return "未生成";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <Analytics />
  </>
);
