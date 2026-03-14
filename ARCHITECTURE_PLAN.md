


Good. I have a complete picture. Here is the full architecture and implementation plan.

---

## What I Learned From Reading the Code

Before the plan, the key observations that shape every decision:

**What the current script does that is Atlas-specific and must be stripped out:**
- Edits `loadBlogPost.ts` using marker comments — a Vite `?raw` import pattern specific to this project
- Writes to `blogData.ts` with Atlas-specific fields: `id` (sequential string IDs like `"featured-1"`, `"article-2"`), `views`, `relevance`, `illustrationType`
- Hard-coded category list, hard-coded paths, hard-coded `ILLUSTRATION_MAP`

**What is genuinely reusable:**
- Scan + parse `.md` files with gray-matter
- Validate frontmatter fields
- Detect duplicate slugs
- Generate a typed output manifest

**The core problem with the current design:**
The script edits app source files directly (`loadBlogPost.ts`, `blogData.ts`). This is fine internally but it cannot be a public API. The public API must be: _write a generated output file, the app reads from it._ No editing app internals.

---

## 1. Package Name

**Recommendation: `mdpublish`**

Rationale: short, command-reads-like-an-action (`npx mdpublish sync`), clearly scoped to markdown publishing. Works well as a global CLI tool name too.

Alternatives if taken on npm: `markpub`, `blogctl`, `md-manifest`

---

## 2. Package Architecture

Three clean layers, nothing bleeds between them:

```
CLI (commander)
    ↓  passes ResolvedConfig
Core Engine
  scanner  →  parser  →  validator  →  emitter
    ↓                         ↓
  .md files             Zod validation
                        with structured errors
    ↓
Public Node.js API (index.ts)
  sync() / validate() / loadConfig()
```

**Key design rules:**
- The engine never reads or writes app source files
- Zod is used for both frontmatter validation AND config file validation — the same library does both, and types are inferred from schemas (no duplicate interface definitions)
- The generated output file is the only artifact the package produces
- `views`, `relevance`, `illustrationType`, `id` — not the package's concern. Those are app runtime state

---

## 3. Folder Structure

```
mdpublish/
├── src/
│   ├── cli.ts                    ← commander entry point, wires commands
│   ├── commands/
│   │   ├── sync.ts               ← scan → parse → validate → emit
│   │   └── validate.ts           ← scan → parse → validate → report (no writes)
│   ├── core/
│   │   ├── config.ts             ← load mdpublish.config.json + merge CLI flags
│   │   ├── scanner.ts            ← discover .md files from content dir
│   │   ├── parser.ts             ← gray-matter wrapper, line-ending normalization
│   │   ├── validator.ts          ← run Zod, collect structured errors per file
│   │   └── emitter.ts            ← write blog.generated.ts or blog.generated.json
│   ├── schemas/
│   │   ├── frontmatter.ts        ← Zod schema for all frontmatter fields
│   │   └── config.ts             ← Zod schema for mdpublish.config.json
│   ├── types.ts                  ← TypeScript types inferred from Zod schemas
│   └── index.ts                  ← public programmatic API
├── bin/
│   └── mdpublish.js              ← #!/usr/bin/env node shim → dist/cli.js
├── tests/
│   ├── fixtures/
│   │   ├── valid/
│   │   │   ├── hello-world.md    ← fully valid post
│   │   │   └── with-draft.md     ← valid post with draft: true
│   │   └── invalid/
│   │       ├── missing-fields.md
│   │       ├── bad-category.md
│   │       └── duplicate-slug.md
│   ├── validator.test.ts
│   ├── parser.test.ts
│   ├── emitter.test.ts
│   └── config.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts                ← builds ESM + CJS + .d.ts to dist/
├── vitest.config.ts
└── README.md
```

---

## 4. Dependencies

| Package | Purpose |
|---|---|
| `gray-matter` | Frontmatter parsing (already proven in current script) |
| `zod` | Schema validation for both frontmatter and config |
| `commander` | CLI argument parsing — minimal, well-typed, standard |
| `picocolors` | Terminal colors — zero dependencies, tiny (replaces chalk for v1) |

**devDependencies:** `typescript`, `tsup`, `vitest`, `@types/node`

**Runtime bundle size goal:** under 50KB total (gray-matter + zod + commander + picocolors)

---

## 5. Zod Schemas

### Frontmatter schema (`schemas/frontmatter.ts`)

The base schema covers all fields that belong in a `.md` file. Category validation is injected at runtime from config so the schema itself is not hardcoded to any project's category list.

```
BaseFrontmatterSchema:
  slug        — string, min 1, regex: /^[a-z0-9]+(-[a-z0-9]+)*$/
  title       — string, min 1
  excerpt     — string, min 1, max 300 (warn if over 160 for SEO)
  category    — string, min 1 (refined at runtime against config.categories)
  tags        — array of strings, min 1 item
  author      — string, min 1
  date        — string, coerced and validated as a parseable date
  readTime    — string, min 1
  featured    — boolean, optional, default false
  draft       — boolean, optional, default false
  order       — number, optional (manual sort override)
```

`buildFrontmatterSchema(categories: string[])` returns a refined version of this schema that validates `category` against the provided list. If `categories` is empty/undefined in config, category is accepted as any non-empty string.

### Config schema (`schemas/config.ts`)

```
ConfigSchema:
  content       — string path, default "content"
  output        — string path, default "blog.generated.ts"
  format        — enum "ts" | "json", default "ts"
  categories    — string[], optional (if omitted, all categories accepted)
  featured      — string slug, optional (pin a post as featured)
  strict        — boolean, optional (treat warnings as errors — useful for CI)
```

Config loaded from `mdpublish.config.json` at project root, validated with `.safeParse()`. CLI flags override config values. Missing config file is not an error — defaults apply.

---

## 6. Core Module Responsibilities

### `scanner.ts`
- Accepts a `contentDir: string`
- Returns a sorted list of `{ file: string, fullPath: string }` for every `.md` file found (non-recursive in v1, recursive in v2)
- Does not read file contents — only discovers paths
- Skips empty files with a warning, does not throw

### `parser.ts`
- Accepts a file path, reads it, normalizes `\r\n` → `\n`
- Calls `gray-matter` to split frontmatter from body
- Returns `{ frontmatter: Record<string, unknown>, body: string, file: string }`
- Wraps gray-matter parse errors and re-throws as a typed `ParseError`
- Does not validate — only parses

### `validator.ts`
- Accepts the parsed frontmatter + the runtime-built Zod schema
- Calls `schema.safeParse(frontmatter)` — never `.parse()` (never throws)
- Collects all Zod `issue` objects into a typed `ValidationError[]` array
- Checks for duplicate slugs across the full set after all files are parsed
- Checks that at most one post has `featured: true` (warn if multiple)
- Returns `{ valid: BlogPost[], errors: ValidationError[], warnings: Warning[] }`

### `emitter.ts`
- Accepts `BlogPost[]` + `ResolvedConfig`
- Emits either a `.ts` or `.json` file depending on `config.format`
- TypeScript output always includes the `BlogPost` interface definition so the output file is self-contained
- Never overwrites the output file if validation failed (guarded by the commands layer, not the emitter)

### `config.ts`
- Looks for `mdpublish.config.json` starting at `cwd` and walking up (like eslint)
- Merges with CLI-provided overrides
- Validates with `ConfigSchema.safeParse()`
- Returns a `ResolvedConfig` with all defaults applied

---

## 7. CLI Commands

### `mdpublish sync`

Full pipeline: scan → parse → validate → emit.

```
mdpublish sync [options]

Options:
  --content <path>    Directory containing .md files  [default: "content"]
  --output <path>     Output file path                [default: "blog.generated.ts"]
  --format <ts|json>  Output format                   [default: "ts"]
  --featured <slug>   Pin this slug as the featured post
  --dry-run           Print output to stdout, do not write file
  --config <path>     Path to config file             [default: "./mdpublish.config.json"]
```

Behavior:
1. Load and validate config
2. Scan content directory
3. Parse all `.md` files
4. Validate all frontmatter with Zod
5. **If any errors: print them all, exit 1, write nothing**
6. Sort posts (by `order` if set, then by `date` descending)
7. Emit output file
8. Print summary: synced N posts, N warnings, output written to path

### `mdpublish validate`

Validation only — safe for CI. Reads files, runs the full Zod pipeline, exits 0 or 1. Writes nothing.

```
mdpublish validate [options]

Options:
  --content <path>    Directory to validate
  --config <path>     Path to config file
  --strict            Treat warnings as errors (e.g. excerpt over 160 chars)
```

Exit codes: `0` = all valid, `1` = one or more errors (or warnings in `--strict` mode)

---

## 8. Generated Output Format

### TypeScript (default)

```typescript
// AUTO-GENERATED by mdpublish — do not edit manually
// Source: src/content/blog  |  Generated: 2026-03-12T08:00:00.000Z
// Run `npx mdpublish sync` to regenerate

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  author: string;
  date: string;
  readTime: string;
  featured: boolean;
  draft: boolean;
  order: number;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "how-to-modernize-legacy-applications",
    title: "How to Modernize Legacy Applications for AI-Era Demands",
    excerpt: "A practical guide to upgrading older systems...",
    category: "Legacy Modernization",
    tags: ["modernization", "legacy systems", "AI workflows"],
    author: "Atlas Flow Team",
    date: "2026-03-04",
    readTime: "8 min read",
    featured: true,
    draft: false,
    order: 0,
  },
  // ...
];

export const featuredPost: BlogPost | null =
  blogPosts.find((p) => p.featured) ?? null;

export const allCategories: string[] = [
  "Legacy Modernization",
  "AI Automation",
  // ...
];

export const allTags: string[] = [
  "modernization", "legacy systems", "AI workflows",
  // ...
];
```

### JSON (optional via `--format json`)

```json
{
  "_meta": {
    "generated": "2026-03-12T08:00:00.000Z",
    "version": "1",
    "count": 5
  },
  "posts": [ /* same fields */ ],
  "allCategories": [...],
  "allTags": [...]
}
```

**What is intentionally NOT in the output:**
- `id` — sequential string IDs are an app concern, not a content concern
- `views`, `relevance` — runtime analytics owned by the app
- `illustrationType` — framework/UI-specific mapping, not intrinsic to content
- Markdown body content — body loading is always framework-specific

---

## 9. Public Programmatic API (`index.ts`)

For users who want to integrate without the CLI — e.g. a Vite plugin, a Next.js build step, or a custom CI script:

```typescript
import { sync, validate, loadConfig } from "mdpublish";

// Full pipeline
const result = await sync({ content: "src/content/blog", output: "src/generated/blog.generated.ts" });
// result: { posts: BlogPost[], errors: ValidationError[], outputPath: string }

// Validate only
const report = await validate({ content: "src/content/blog" });
// report: { valid: BlogPost[], errors: ValidationError[], warnings: Warning[] }

// Load config file
const config = await loadConfig();
// config: ResolvedConfig

// Types
export type { BlogPost, ValidationError, Warning, ResolvedConfig, SyncResult };
```

---

## 10. Migration Path for Atlas Flow

Once the package is built, here's how this project (`atlasflowllc`) would migrate:

| Before | After |
|---|---|
| `scripts/publish-blog.mjs` (custom) | `npx mdpublish sync` |
| `"publish:blog": "node scripts/publish-blog.mjs"` | `"publish:blog": "mdpublish sync"` |
| Imports from `src/data/blogData.ts` | Imports from `src/generated/blog.generated.ts` |
| `loadBlogPost.ts` marker-comment editing | Kept as-is (body loading is Vite-specific, not the package's concern) |
| Atlas-specific `views`, `relevance`, `id`, `illustrationType` | Managed in a separate `blogExtras.ts` the app owns |

The `blogExtras.ts` pattern: a user-managed file that maps `slug → { views, relevance, illustrationType }`, merged with the generated `blogPosts` at import time in the app. The package never touches it.

---

## 11. Build Configuration

**`tsup.config.ts`** builds two output formats so the package works everywhere:

```
dist/
  cli.js         ← ESM CLI entry (pointed to by bin/)
  index.js       ← ESM main export
  index.cjs      ← CJS main export (for tools that require CJS)
  index.d.ts     ← type declarations
```

**`package.json` exports:**
```json
{
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "bin": { "mdpublish": "bin/mdpublish.js" },
  "types": "dist/index.d.ts"
}
```

---

## 12. v1 Build Sequence

The order in which to implement, smallest-first:

1. **Scaffold** — `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
2. **Schemas** — `schemas/frontmatter.ts` (Zod), `schemas/config.ts` (Zod), `types.ts`
3. **Core: scanner + parser** — file discovery and gray-matter wrapper, with tests against fixtures
4. **Core: validator** — Zod validation + duplicate slug check + warning collection, with tests
5. **Core: config** — config file loading + CLI flag merging
6. **Core: emitter** — TypeScript output writer, then JSON output writer
7. **CLI** — `sync` command using all of the above, then `validate` command
8. **Public API** — `index.ts` wrapping the commands as functions
9. **bin shim** — `bin/mdpublish.js`
10. **README** — quickstart, config reference, frontmatter schema, migration guide
11. **Publish** — `npm publish --access public`