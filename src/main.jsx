import React from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Flag,
  FolderOpen,
  Github,
  LibraryBig,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  Trash2,
  TriangleAlert
} from "lucide-react";
import "./styles.css";

const CATEGORIES = ["全部", "AI视频", "前端", "自动化", "知识库", "文档", "Agent", "待整理"];
const CATEGORY_OPTIONS = CATEGORIES.filter((item) => item !== "全部");
const PRIORITY_OPTIONS = [
  { value: "high", label: "高优先级" },
  { value: "low", label: "低优先级" }
];
const POLL_INTERVAL = 8000;

function App() {
  const [cards, setCards] = React.useState([]);
  const [libraryDir, setLibraryDir] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("全部");
  const [selectedId, setSelectedId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [busyCardId, setBusyCardId] = React.useState("");

  const loadCards = React.useCallback(async () => {
    try {
      const response = await fetch("/api/capabilities", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setCards(payload.cards || []);
      setLibraryDir(payload.libraryDir || "");
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCards();
    const timer = window.setInterval(loadCards, POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [loadCards]);

  const filteredCards = React.useMemo(
    () => filterCards(cards, category, query),
    [cards, category, query]
  );

  const selectedCard = React.useMemo(() => {
    if (!filteredCards.length) return null;
    return filteredCards.find((card) => card.id === selectedId) || filteredCards[0];
  }, [filteredCards, selectedId]);

  const topFilteredId = filteredCards[0]?.id || "";

  React.useEffect(() => {
    setSelectedId(topFilteredId);
    setCopied(false);
  }, [category, query, topFilteredId]);

  React.useEffect(() => {
    if (selectedCard && selectedCard.id !== selectedId) {
      setSelectedId(selectedCard.id);
    }
  }, [selectedCard, selectedId]);

  async function copyPrompt() {
    if (!selectedCard?.prompt) return;
    await navigator.clipboard.writeText(selectedCard.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function updateCard(id, updates) {
    setBusyCardId(id);
    try {
      const response = await fetch(`/api/capabilities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error(await readError(response));
      const payload = await response.json();
      setCards((currentCards) =>
        currentCards.map((card) => (card.id === id ? payload.card : card))
      );
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusyCardId("");
    }
  }

  async function deleteCard(id) {
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    const confirmed = window.confirm(`删除“${card.title}”？这会移除能力库里的 Markdown 文件。`);
    if (!confirmed) return;

    setBusyCardId(id);
    try {
      const response = await fetch(`/api/capabilities/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await readError(response));
      setCards((currentCards) => currentCards.filter((item) => item.id !== id));
      setCopied(false);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusyCardId("");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} strokeWidth={2.2} />
          </div>
          <div>
            <h1>能力看台</h1>
            <span>{cards.length} 张调用卡</span>
          </div>
        </div>

        <div className="sidebar-summary" aria-label="能力库概览">
          <span>高优先级</span>
          <strong>{countPriority(cards, "high")}</strong>
        </div>

        <nav className="category-list" aria-label="能力场景">
          {CATEGORIES.map((item) => (
            <button
              className={item === category ? "category-button active" : "category-button"}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              <span>{item}</span>
              <strong>{countCategory(cards, item)}</strong>
            </button>
          ))}
        </nav>

        <div className="library-foot">
          <BookOpen size={16} />
          <span title={libraryDir}>{libraryDir || "能力库目录"}</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索任务、场景或功能..."
              type="search"
            />
            <span className="search-hint">⌘K</span>
          </label>
          <button className="icon-button" onClick={loadCards} type="button" title="刷新">
            <RefreshCw size={18} />
          </button>
        </header>

        <div className="content-grid">
          <section className="card-list" aria-label="能力卡列表">
            <div className="list-heading">
              <div>
                <span>当前筛选</span>
                <h2>{category}</h2>
              </div>
              <strong>{filteredCards.length}</strong>
            </div>

            {error && cards.length > 0 && (
              <div className="sync-alert">
                <TriangleAlert size={16} />
                <span>同步未完成：{error}</span>
              </div>
            )}
            {loading && cards.length === 0 && <EmptyState label="读取中" />}
            {error && cards.length === 0 && <EmptyState label={`读取失败：${error}`} />}
            {!loading && !error && filteredCards.length === 0 && <EmptyState label="暂无匹配能力" />}

            <div className="cards">
              {filteredCards.map((card) => (
                <CapabilityCard
                  card={card}
                  key={card.id}
                  selected={selectedCard?.id === card.id}
                  onSelect={() => setSelectedId(card.id)}
                />
              ))}
            </div>
          </section>

          <DetailPanel
            busy={busyCardId === selectedCard?.id}
            card={selectedCard}
            copied={copied}
            onCopy={copyPrompt}
            onDelete={deleteCard}
            onUpdate={updateCard}
          />
        </div>
      </section>
    </main>
  );
}

function CapabilityCard({ card, selected, onSelect }) {
  return (
    <button className={selected ? "capability-card selected" : "capability-card"} onClick={onSelect} type="button">
      <div className="card-topline">
        <span className={`status ${card.status}`}>{statusLabel(card.status)}</span>
        <PriorityBadge priority={card.priority} />
        <span className="source-badge">{sourceLabel(card.sourceType)}</span>
        <span className="repo-name">{card.repo}</span>
      </div>
      <h3>{card.title}</h3>
      <p>{card.summary || "待补充一句话能力"}</p>
      <div className="scenario-row">
        {(card.scenarios || []).slice(0, 3).map((scenario) => (
          <span key={scenario}>{scenario}</span>
        ))}
      </div>
      <div className="card-meta">
        <span>
          <Tags size={14} />
          {(card.domains || []).join(" / ") || "未分类"}
        </span>
        <span>
          <Clock3 size={14} />
          {card.lastUsed || "未使用"}
        </span>
      </div>
    </button>
  );
}

function DetailPanel({ busy, card, copied, onCopy, onDelete, onUpdate }) {
  if (!card) {
    return (
      <aside className="detail-panel empty">
        <EmptyState label="选择一张调用卡" />
      </aside>
    );
  }

  const primaryDomain = card.domains?.[0] || "待整理";
  const categoryOptions = CATEGORY_OPTIONS.includes(primaryDomain)
    ? CATEGORY_OPTIONS
    : [primaryDomain, ...CATEGORY_OPTIONS];
  const priority = card.priority === "high" ? "high" : "low";

  return (
    <aside className="detail-panel">
      <div className="detail-title">
        <div>
          <span>{card.repo}</span>
          <h2>{card.title}</h2>
          <div className="detail-title-meta">
            <PriorityBadge priority={priority} />
            <span>{sourceLabel(card.sourceType)}</span>
          </div>
        </div>
        {isHttpUrl(card.url) && (
          <a className="icon-button" href={card.url} rel="noreferrer" target="_blank" title={sourceLabel(card.sourceType)}>
            {card.sourceType === "codex-skill" ? <LibraryBig size={18} /> : <Github size={18} />}
          </a>
        )}
      </div>

      <section className="manage-strip" aria-label="能力卡管理">
        <label className="field-control">
          <span>
            <FolderOpen size={14} />
            分类
          </span>
          <select
            disabled={busy}
            onChange={(event) => onUpdate(card.id, { domain: event.target.value })}
            value={primaryDomain}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="field-control">
          <span>
            <Flag size={14} />
            优先级
          </span>
          <div className="segmented-control" role="group" aria-label="优先级">
            {PRIORITY_OPTIONS.map((option) => (
              <button
                className={priority === option.value ? `segment-button active ${option.value}` : "segment-button"}
                disabled={busy}
                key={option.value}
                onClick={() => onUpdate(card.id, { priority: option.value })}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h3>一句话能力</h3>
        <p>{card.summary || "待补充"}</p>
      </section>

      <section className="detail-section">
        <h3>什么时候想起它</h3>
        <ul>
          {(card.reminder || card.scenarios || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="detail-section prompt-section">
        <div className="prompt-heading">
          <h3>给 Codex/Claude 的调用提示</h3>
          <button className="copy-button" onClick={onCopy} type="button">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "已复制" : "复制调用提示"}</span>
          </button>
        </div>
        <pre>{card.prompt || "待补充调用提示"}</pre>
      </section>

      <section className="detail-section">
        <h3>使用线索</h3>
        <ul>
          {(card.usageNotes || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="detail-actions">
        <a href={card.obsidianUri}>
          <BookOpen size={16} />
          <span>Obsidian</span>
        </a>
        {isHttpUrl(card.url) && (
          <a href={card.url} rel="noreferrer" target="_blank">
            <ExternalLink size={16} />
            <span>{card.sourceType === "codex-skill" ? "来源" : "GitHub"}</span>
          </a>
        )}
        <button className="danger-button" disabled={busy} onClick={() => onDelete(card.id)} type="button">
          <Trash2 size={16} />
          <span>删除</span>
        </button>
      </div>
    </aside>
  );
}

function PriorityBadge({ priority }) {
  const normalized = priority === "high" ? "high" : "low";
  return <span className={`priority-badge ${normalized}`}>{priorityLabel(normalized)}</span>;
}

function EmptyState({ label }) {
  return <div className="empty-state">{label}</div>;
}

function filterCards(cards, category, query) {
  const terms = buildSearchTerms(query);

  return cards
    .filter((card) => category === "全部" || (card.domains || []).includes(category))
    .map((card) => ({ card, score: scoreCard(card, terms) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        comparePriority(left.card, right.card) ||
        compareUpdated(left.card, right.card)
    )
    .map(({ card }) => card);
}

function buildSearchTerms(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const terms = new Set();
  terms.add(normalized);

  normalized
    .split(/[\s,，。；;:：/|]+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .forEach((term) => terms.add(term));

  const cjkRuns = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const run of cjkRuns) {
    for (let index = 0; index <= run.length - 2; index += 1) {
      terms.add(run.slice(index, index + 2));
    }
  }

  const synonymGroups = [
    ["视频", "ai视频", "分镜", "短剧", "复刻", "seedance", "libtv"],
    ["浏览器", "自动化", "playwright", "网页", "点击", "截图"],
    ["文档", "pdf", "word", "报告", "材料"],
    ["知识", "obsidian", "markdown", "笔记", "沉淀"],
    ["agent", "skill", "mcp", "claude", "codex"]
  ];

  for (const group of synonymGroups) {
    if (group.some((term) => normalized.includes(term))) {
      group.forEach((term) => terms.add(term));
    }
  }

  return [...terms].filter((term) => term.length >= 2);
}

function scoreCard(card, terms) {
  if (!terms.length) return 1;
  const haystack = String(card.searchText || "").toLowerCase();
  const title = `${card.title} ${card.repo}`.toLowerCase();

  return terms.reduce((score, term) => {
    if (title.includes(term)) return score + 8;
    if ((card.domains || []).join(" ").toLowerCase().includes(term)) return score + 5;
    if ((card.scenarios || []).join(" ").toLowerCase().includes(term)) return score + 4;
    if (haystack.includes(term)) return score + 1;
    return score;
  }, 0);
}

function countCategory(cards, category) {
  if (category === "全部") return cards.length;
  return cards.filter((card) => (card.domains || []).includes(category)).length;
}

function countPriority(cards, priority) {
  return cards.filter((card) => card.priority === priority).length;
}

function compareUpdated(left, right) {
  return String(right.updated || right.created || "").localeCompare(String(left.updated || left.created || ""), "zh-CN");
}

function comparePriority(left, right) {
  return priorityWeight(right.priority) - priorityWeight(left.priority);
}

function priorityWeight(priority) {
  return priority === "high" ? 1 : 0;
}

function statusLabel(status) {
  const labels = {
    ready: "可调用",
    inbox: "待整理",
    remembered: "已记住",
    archived: "归档"
  };
  return labels[status] || status || "可调用";
}

function priorityLabel(priority) {
  const labels = {
    high: "高优先级",
    low: "低优先级"
  };
  return labels[priority] || "低优先级";
}

function sourceLabel(sourceType) {
  const labels = {
    github: "GitHub",
    "codex-skill": "Codex Skill",
    "claude-skill": "Claude Skill"
  };
  return labels[sourceType] || sourceType || "来源";
}

function isHttpUrl(value) {
  return /^https?:\/\//.test(String(value || ""));
}

async function readError(response) {
  try {
    const payload = await response.json();
    return payload.detail || payload.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export default App;

const rootElement = document.getElementById("root");

if (!rootElement.__capabilityDashboardRoot) {
  rootElement.__capabilityDashboardRoot = createRoot(rootElement);
}

rootElement.__capabilityDashboardRoot.render(<App />);
