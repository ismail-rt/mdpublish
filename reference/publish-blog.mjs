#!/usr/bin/env node
/**
 * publish-blog.mjs  v2
 *
 * Usage:  npm run publish:blog
 *
 * What it does:
 *   1. Scans every .md file in src/content/blog/
 *   2. Parses frontmatter with gray-matter (supports multiline YAML arrays)
 *   3. Validates required fields and category against the allowed list
 *   4. Rewrites AUTO-IMPORTS / AUTO-REGISTRY sections in loadBlogPost.ts
 *   5. Syncs blogData.ts:
 *        - Existing entries: update metadata from frontmatter, preserve id/views/relevance
 *        - Entries without a .md file: kept unchanged (placeholder drafts)
 *        - New slugs: appended with sensible defaults
 *
 * Frontmatter is the source of truth for:
 *   slug, title, excerpt, category, tags, author, date, readTime
 *
 * blogData.ts is the source of truth for:
 *   id, views, relevance, article ordering / featured position
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BLOG_DIR    = path.join(ROOT, "src/content/blog");
const LOADER_FILE = path.join(ROOT, "src/lib/loadBlogPost.ts");
const DATA_FILE   = path.join(ROOT, "src/data/blogData.ts");

const REQUIRED_FIELDS = ["slug", "title", "excerpt", "category", "tags", "author", "date", "readTime"];

const ALLOWED_CATEGORIES = [
  "AI Automation",
  "Legacy Modernization",
  "Systems Integration",
  "Web & Mobile Engineering",
  "Product Strategy",
  "Architecture",
  "Case Studies",
];

const ILLUSTRATION_MAP = {
  "AI Automation":            "automation",
  "Legacy Modernization":     "modernization",
  "Systems Integration":      "integration",
  "Web & Mobile Engineering": "mobile",
  "Product Strategy":         "strategy",
  "Architecture":             "architecture",
  "Case Studies":             "dashboard",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a slug to a camelCase import variable name, e.g. my-post → rawMyPost */
function slugToVar(slug) {
  return "raw" + slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

/**
 * Bracket-counting parser.
 * Returns every top-level { ... } block from a text string as raw substrings.
 * Works correctly even when the object contains nested arrays like tags: [...].
 */
function extractObjectBlocks(text) {
  const blocks = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return blocks;
}

/** Extract a quoted string field from a raw TS object string */
function extractStringField(raw, field) {
  const m = raw.match(new RegExp(`\\b${field}:\\s*["']([^"'\\n]+)["']`));
  return m ? m[1] : null;
}

/** Extract a numeric field from a raw TS object string */
function extractNumberField(raw, field) {
  const m = raw.match(new RegExp(`\\b${field}:\\s*(\\d+)`));
  return m ? parseInt(m[1], 10) : null;
}

/** Extract a tags array from a raw TS object string, e.g. tags: ["a", "b"] */
function extractTagsField(raw) {
  const m = raw.match(/\btags:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Parse all active (non-commented) article entries from blogData.ts.
 * Returns an array of fully parsed entry objects in their original order.
 */
function parseExistingEntries(dataContent) {
  // Remove block comments so only active code remains
  const active = dataContent.replace(/\/\*[\s\S]*?\*\//g, "");

  const arrayDeclIdx = active.indexOf("export const blogArticles");
  if (arrayDeclIdx === -1) throw new Error("Could not find blogArticles array in blogData.ts");
  const openBracket = active.indexOf("[", arrayDeclIdx);
  const closeSemicolon = active.lastIndexOf("];");
  const arrayBody = active.slice(openBracket + 1, closeSemicolon);

  return extractObjectBlocks(arrayBody)
    .map((raw) => ({
      slug:             extractStringField(raw, "slug"),
      id:               extractStringField(raw, "id"),
      title:            extractStringField(raw, "title"),
      excerpt:          extractStringField(raw, "excerpt"),
      category:         extractStringField(raw, "category"),
      tags:             extractTagsField(raw),
      author:           extractStringField(raw, "author"),
      date:             extractStringField(raw, "date"),
      readTime:         extractStringField(raw, "readTime"),
      views:            extractNumberField(raw, "views") ?? 1000,
      relevance:        extractNumberField(raw, "relevance") ?? 5,
      illustrationType: extractStringField(raw, "illustrationType"),
    }))
    .filter((e) => e.slug !== null); // skip any block we couldn't parse
}

/**
 * Extract the block comment (draft/placeholder articles) from inside
 * the blogArticles array so it can be preserved in the regenerated output.
 */
function extractCommentBlock(dataContent) {
  const arrayMatch = dataContent.match(/export const blogArticles[^=]*=\s*\[([\s\S]*)\];/);
  if (!arrayMatch) return "";
  const m = arrayMatch[1].match(/\/\*[\s\S]*?\*\//);
  return m ? m[0] : "";
}

/** Serialize a BlogArticle object to a consistent TypeScript object literal */
function stringifyEntry(a) {
  const tagsStr = a.tags.map((t) => `"${t}"`).join(", ");
  return [
    `  {`,
    `    id: "${a.id}",`,
    `    slug: "${a.slug}",`,
    `    title: "${String(a.title).replace(/"/g, '\\"')}",`,
    `    excerpt: "${String(a.excerpt).replace(/"/g, '\\"')}",`,
    `    category: "${a.category}",`,
    `    tags: [${tagsStr}],`,
    `    author: "${a.author}",`,
    `    date: "${a.date}",`,
    `    readTime: "${a.readTime}",`,
    `    views: ${a.views},`,
    `    relevance: ${a.relevance},`,
    `    illustrationType: "${a.illustrationType}",`,
    `  }`,
  ].join("\n");
}

// ─── Phase 1: Scan and validate markdown files ────────────────────────────────

const mdFiles = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const posts = [];
const validationErrors = [];
const seenSlugs = new Set();

for (const file of mdFiles) {
  const fullPath = path.join(BLOG_DIR, file);
  // Normalize line endings for cross-platform safety
  const raw = fs.readFileSync(fullPath, "utf-8").replace(/\r\n/g, "\n");

  if (raw.trim().length === 0) {
    console.warn(`⚠   Skipping empty file: ${file} — save it in your editor first (Cmd+S)`);
    continue;
  }

  // Parse frontmatter using gray-matter (handles multiline YAML arrays, quoted strings, etc.)
  let fm;
  try {
    fm = matter(raw).data;
  } catch (err) {
    validationErrors.push(`❌  ${file}: frontmatter parse error — ${err.message}`);
    continue;
  }

  // Validate required fields
  const missing = REQUIRED_FIELDS.filter((f) => fm[f] === undefined || fm[f] === null || fm[f] === "");
  if (missing.length > 0) {
    validationErrors.push(`❌  ${file}: missing required field(s): ${missing.join(", ")}`);
    continue;
  }

  // Validate category
  if (!ALLOWED_CATEGORIES.includes(fm.category)) {
    validationErrors.push(
      `❌  ${file}: invalid category "${fm.category}".\n     Allowed: ${ALLOWED_CATEGORIES.join(", ")}`
    );
    continue;
  }

  // Detect duplicate slugs across files
  if (seenSlugs.has(fm.slug)) {
    validationErrors.push(`❌  ${file}: duplicate slug "${fm.slug}" — already used by another file`);
    continue;
  }
  seenSlugs.add(fm.slug);

  posts.push({ slug: fm.slug, file, fm });
}

// Fail early if any validation errors — don't write anything
if (validationErrors.length > 0) {
  console.error("\n💥  Validation failed — no files were modified:\n");
  validationErrors.forEach((e) => console.error(`  ${e}`));
  console.error("\nFix the above errors and re-run.\n");
  process.exit(1);
}

if (posts.length === 0) {
  console.error("❌  No valid markdown files found in src/content/blog/");
  process.exit(1);
}

console.log(`\n📄  Found ${posts.length} valid article(s):\n`);
posts.forEach((p) => console.log(`    • ${p.slug}`));
console.log();

// ─── Phase 2: Update loadBlogPost.ts ─────────────────────────────────────────

const importBlock = posts
  .map(({ slug, file }) => `import ${slugToVar(slug)} from "../content/blog/${file}?raw";`)
  .join("\n");

const registryBlock = posts
  .map(({ slug }) => `  "${slug}": parsePost("${slug}", ${slugToVar(slug)}),`)
  .join("\n");

let loader = fs.readFileSync(LOADER_FILE, "utf-8").replace(/\r\n/g, "\n");

loader = loader.replace(
  /(\/\/ AUTO-IMPORTS-START\n)[\s\S]*?(\/\/ AUTO-IMPORTS-END)/,
  `$1${importBlock}\n$2`
);
loader = loader.replace(
  /(\/\/ AUTO-REGISTRY-START\n)[\s\S]*?(\/\/ AUTO-REGISTRY-END)/,
  `$1${registryBlock}\n$2`
);

fs.writeFileSync(LOADER_FILE, loader, "utf-8");
console.log("✅  Updated src/lib/loadBlogPost.ts");

// ─── Phase 3: Sync blogData.ts ────────────────────────────────────────────────

const dataContent = fs.readFileSync(DATA_FILE, "utf-8").replace(/\r\n/g, "\n");

// Parse all currently active entries (original order preserved)
const existingEntries = parseExistingEntries(dataContent);
const existingBySlug  = new Map(existingEntries.map((e) => [e.slug, e]));

// Preserve the /* ... */ draft/placeholder comment block
const commentBlock = extractCommentBlock(dataContent);

// Highest article-N id across the entire file (including commented entries)
const allIds = [...dataContent.matchAll(/\bid:\s*["']article-(\d+)["']/g)].map((m) =>
  parseInt(m[1], 10)
);
let nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 2;

// Build the markdown lookup
const postsBySlug = new Map(posts.map((p) => [p.slug, p]));

// Tracking for the report
const synced    = [];
const unchanged = [];
const added     = [];

// Build the final ordered entry list
const finalEntries = [];

// 1. Walk existing active entries in their original order
for (const existing of existingEntries) {
  if (postsBySlug.has(existing.slug)) {
    // Has a .md file — update metadata from frontmatter, preserve id / views / relevance
    const { fm } = postsBySlug.get(existing.slug);
    const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags].filter(Boolean);
    // Frontmatter illustrationType overrides auto-map (for manual "cloud" etc.)
    const illustrationType = fm.illustrationType || ILLUSTRATION_MAP[fm.category] || "automation";
    finalEntries.push({
      id:               existing.id,
      slug:             fm.slug,
      title:            fm.title,
      excerpt:          fm.excerpt,
      category:         fm.category,
      tags,
      author:           fm.author,
      date:             String(fm.date),
      readTime:         fm.readTime,
      views:            existing.views,
      relevance:        existing.relevance,
      illustrationType,
    });
    synced.push(existing.slug);
  } else {
    // No .md file — keep existing data unchanged (placeholder/manual entry)
    finalEntries.push({ ...existing });
    unchanged.push(existing.slug);
  }
}

// 2. Append truly new slugs (not in existing blogData at all)
for (const post of posts) {
  if (!existingBySlug.has(post.slug)) {
    const { fm } = post;
    const tags = Array.isArray(fm.tags) ? fm.tags : [fm.tags].filter(Boolean);
    const illustrationType = fm.illustrationType || ILLUSTRATION_MAP[fm.category] || "automation";
    finalEntries.push({
      id:               `article-${nextId++}`,
      slug:             fm.slug,
      title:            fm.title,
      excerpt:          fm.excerpt,
      category:         fm.category,
      tags,
      author:           fm.author,
      date:             String(fm.date),
      readTime:         fm.readTime,
      views:            1000,
      relevance:        5,
      illustrationType,
    });
    added.push(fm.slug);
  }
}

// Serialize all entries to consistent TS object literal strings
const entryStrings = finalEntries.map(stringifyEntry);

// Reconstruct the file:
//   keep everything before export const blogArticles (interface, categories, tags)
//   regenerate only the array contents
const arrayDeclIdx  = dataContent.indexOf("export const blogArticles");
const beforeArray   = dataContent.slice(0, arrayDeclIdx);
const commentSection = commentBlock ? `  ${commentBlock}\n` : "";
const newDataContent =
  `${beforeArray}` +
  `export const blogArticles: BlogArticle[] = [\n` +
  `${entryStrings.join(",\n")},\n` +
  `${commentSection}` +
  `];\n`;

fs.writeFileSync(DATA_FILE, newDataContent, "utf-8");

// ─── Report ───────────────────────────────────────────────────────────────────

if (synced.length)
  console.log(`✅  Synced    ${synced.length} existing article(s):   ${synced.join(", ")}`);
if (added.length)
  console.log(`✅  Added     ${added.length} new article(s):          ${added.join(", ")}`);
if (unchanged.length)
  console.log(`ℹ️   Unchanged ${unchanged.length} unmanaged entry/entries: ${unchanged.join(", ")}`);

console.log("\n🚀  Done! Restart the dev server to see changes.\n");
