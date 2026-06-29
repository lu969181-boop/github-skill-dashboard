import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5173);

export const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH || path.join(os.homedir(), "Documents", "Obsidian Vault");

export const CAPABILITY_DIR =
  process.env.CAPABILITY_LIBRARY_DIR ||
  path.join(VAULT_PATH, "01-AI沉淀", "能力库");

const app = express();
app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    capabilityDir: CAPABILITY_DIR
  });
});

app.get("/api/capabilities", async (_req, res) => {
  try {
    const cards = await readCapabilityCards(CAPABILITY_DIR);
    res.json({
      cards,
      libraryDir: CAPABILITY_DIR,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: "能力库读取失败",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.patch("/api/capabilities/:id", async (req, res) => {
  try {
    const filePath = resolveCardPath(req.params.id);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseFrontmatter(raw);

    if (parsed.data.type !== "capability-card") {
      res.status(404).json({ error: "未找到能力卡" });
      return;
    }

    const updates = req.body || {};
    const nextData = { ...parsed.data };

    if (Object.hasOwn(updates, "domain")) {
      const domain = stringValue(updates.domain).trim();
      if (!domain) {
        res.status(400).json({ error: "分类不能为空" });
        return;
      }
      nextData.domains = [domain];
    }

    if (Object.hasOwn(updates, "priority")) {
      const priority = stringValue(updates.priority).trim();
      if (!["high", "low"].includes(priority)) {
        res.status(400).json({ error: "优先级只能是 high 或 low" });
        return;
      }
      nextData.priority = priority;
    }

    nextData.updated = new Date().toISOString().slice(0, 10);
    await fs.writeFile(filePath, stringifyFrontmatter(nextData, parsed.content), "utf8");

    res.json({ card: await parseCapabilityCard(filePath) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "非法卡片路径" ? 400 : 500).json({
      error: "能力卡更新失败",
      detail: message
    });
  }
});

app.delete("/api/capabilities/:id", async (req, res) => {
  try {
    const filePath = resolveCardPath(req.params.id);
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = parseFrontmatter(raw);

    if (parsed.data.type !== "capability-card") {
      res.status(404).json({ error: "未找到能力卡" });
      return;
    }

    await fs.rm(filePath);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "非法卡片路径" ? 400 : 500).json({
      error: "能力卡删除失败",
      detail: message
    });
  }
});

if (isProduction) {
  const distDir = path.join(__dirname, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: __dirname,
    appType: "spa",
    server: { middlewareMode: true }
  });
  app.use(vite.middlewares);
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`能力看台已启动：http://127.0.0.1:${PORT}`);
  console.log(`能力库目录：${CAPABILITY_DIR}`);
});

export async function readCapabilityCards(directory) {
  await fs.mkdir(directory, { recursive: true });
  const files = await listMarkdownFiles(directory);
  const cards = await Promise.all(files.map((file) => parseCapabilityCard(file)));

  return cards
    .filter(Boolean)
    .sort((a, b) => {
      const left = b.updated || b.created || "";
      const right = a.updated || a.created || "";
      return left.localeCompare(right, "zh-CN");
    });
}

async function listMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(entryPath);
      if (entry.name.startsWith("_")) return [];
      if (entry.isFile() && entry.name.endsWith(".md")) return entryPath;
      return [];
    })
  );

  return files.flat();
}

async function parseCapabilityCard(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = parseFrontmatter(raw);

  if (parsed.data.type !== "capability-card") return null;

  const sections = extractSections(parsed.content);
  const title = String(parsed.data.title || sections.title || path.basename(filePath, ".md"));

  return {
    id: path.relative(CAPABILITY_DIR, filePath),
    title,
    sourceType: stringValue(parsed.data.source_type || "github"),
    sourcePath: stringValue(parsed.data.source_path),
    origin: stringValue(parsed.data.origin),
    repo: stringValue(parsed.data.repo),
    url: stringValue(parsed.data.url),
    status: stringValue(parsed.data.status || "ready"),
    priority: stringValue(parsed.data.priority || "low"),
    created: stringValue(parsed.data.created),
    updated: stringValue(parsed.data.updated),
    domains: arrayValue(parsed.data.domains),
    scenarios: arrayValue(parsed.data.scenarios),
    activationPhrases: arrayValue(parsed.data.activation_phrases),
    agents: arrayValue(parsed.data.agents),
    readiness: stringValue(parsed.data.readiness || "callable"),
    lastUsed: stringValue(parsed.data.last_used),
    summary: firstUsefulLine(sections["一句话能力"]),
    reminder: linesFromSection(sections["什么时候想起它"]),
    prompt: cleanFence(sections["给 Codex/Claude 的调用提示"] || ""),
    usageNotes: linesFromSection(sections["使用线索"]),
    rawInfo: linesFromSection(sections["原始信息"]),
    usageLog: linesFromSection(sections["使用记录"]),
    notePath: filePath,
    obsidianUri: toObsidianUri(filePath),
    searchText: buildSearchText(parsed.data, sections, raw)
  };
}

function extractSections(markdown) {
  const sections = {};
  let current = "";
  let buffer = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      if (current) sections[current] = buffer.join("\n").trim();
      current = heading[2].trim();
      buffer = [];
      if (heading[1] === "#") sections.title = current;
    } else if (current) {
      buffer.push(line);
    }
  }

  if (current) sections[current] = buffer.join("\n").trim();
  return sections;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) {
    return { data: {}, content: raw };
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { data: {}, content: raw };
  }

  return {
    data: YAML.parse(match[1]) || {},
    content: raw.slice(match[0].length)
  };
}

function firstUsefulLine(value = "") {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .find((line) => line && !line.startsWith("```")) || ""
  );
}

function linesFromSection(value = "") {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line && !line.startsWith("```"));
}

function cleanFence(value) {
  return value
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function toObsidianUri(filePath) {
  const vaultName = path.basename(VAULT_PATH);
  const relativePath = path.relative(VAULT_PATH, filePath).split(path.sep).join("/");
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
}

function buildSearchText(frontmatter, sections, raw) {
  return [
    frontmatter.title,
    frontmatter.source_type,
    frontmatter.source_path,
    frontmatter.origin,
    frontmatter.repo,
    frontmatter.url,
    frontmatter.priority,
    arrayValue(frontmatter.domains).join(" "),
    arrayValue(frontmatter.scenarios).join(" "),
    arrayValue(frontmatter.activation_phrases).join(" "),
    sections["一句话能力"],
    sections["什么时候想起它"],
    sections["给 Codex/Claude 的调用提示"],
    raw
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function resolveCardPath(id) {
  const baseDir = path.resolve(CAPABILITY_DIR);
  const filePath = path.resolve(CAPABILITY_DIR, id);
  const isInsideLibrary = filePath.startsWith(`${baseDir}${path.sep}`);

  if (!isInsideLibrary || !filePath.endsWith(".md")) {
    throw new Error("非法卡片路径");
  }

  return filePath;
}

function stringifyFrontmatter(data, content) {
  const orderedData = {};
  const preferredOrder = [
    "type",
    "source_type",
    "title",
    "repo",
    "url",
    "status",
    "priority",
    "created",
    "updated",
    "domains",
    "scenarios",
    "activation_phrases",
    "agents",
    "readiness",
    "last_used"
  ];

  for (const key of preferredOrder) {
    if (Object.hasOwn(data, key)) orderedData[key] = data[key];
  }

  for (const [key, value] of Object.entries(data)) {
    if (!Object.hasOwn(orderedData, key)) orderedData[key] = value;
  }

  return `---\n${YAML.stringify(orderedData).trim()}\n---\n\n${content.trimStart()}`;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function stringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}
