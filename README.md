# mdpublish

A lightweight CLI and Node.js library for validating markdown frontmatter and generating a typed blog manifest — no CMS required.

**Write blog posts as `.md` files. Run one command. Get a clean output file your app can import directly.**

```bash
npx @ismail-rt/mdpublish sync
```

---

## Why

Most static blog setups end up with a hand-rolled script that parses frontmatter, validates fields, and writes some data file. `mdpublish` does that job well and nothing more:

- Validates required frontmatter fields with clear error messages
- Detects duplicate slugs across your content folder
- Validates categories against a configured list
- Generates a self-contained TypeScript or JSON output file
- Works as a CLI or a Node.js library
- Zero runtime dependencies on your app — just import the generated file

---

## Install

```bash
npm install --save-dev @ismail-rt/mdpublish
# or
npm install -g @ismail-rt/mdpublish
```

---

## Quickstart

For a ready-to-edit config and sample post, run:

```bash
npx @ismail-rt/mdpublish init
```

The command will not overwrite an existing config or sample post.

**1. Create a content folder with markdown posts:**

```
content/
  hello-world.md
  guides/
    getting-started.md
```

Content folders are scanned recursively.

**2. Add frontmatter to each post:**

```markdown
---
slug: "hello-world"
title: "Hello World"
excerpt: "A short description under 160 characters for best SEO."
category: "Engineering"
tags:
  - "open-source"
  - "markdown"
author: "Your Name"
date: "2026-01-15"
readTime: "3 min read"
featured: true
draft: false
---

Your post body here...
```

**3. Run sync:**

```bash
npx @ismail-rt/mdpublish sync
```

**4. Import the generated file in your app:**

```typescript
import { blogPosts, featuredPost, allCategories, allTags } from "./blog.generated";
```

---

## CLI Commands

### `mdpublish init`

Creates `mdpublish.config.json` and `content/hello-world.md`. It exits without
changing either file if one already exists.

```bash
mdpublish init
```

### `mdpublish sync`

Full pipeline: scan → parse → validate → emit.

```bash
mdpublish sync [options]

Options:
  --content <path>    Directory containing .md files   [default: "content"]
  --output <path>     Output file path                 [default: "blog.generated.ts"]
  --format <ts|json>  Output format: ts or json        [default: "ts"]
  --featured <slug>   Pin a post slug as the featured post
  --include-drafts    Include draft posts in generated output
  --dry-run           Print output to stdout, do not write file
  --config <path>     Path to config file              [default: "./mdpublish.config.json"]
```

**Behavior:**
- If any validation errors are found, they are all printed and no file is written (exit 1)
- All posts are validated, but drafts are excluded from output unless `--include-drafts` is set
- Posts are sorted: non-zero `order` values ascending first, then by `date` descending
- The output file is self-contained — it includes the `BlogPost` interface definition

### `mdpublish validate`

Validation only — safe for CI. Reads files, runs full validation, exits 0 or 1. Writes nothing.

```bash
mdpublish validate [options]

Options:
  --content <path>   Directory to validate
  --config <path>    Path to config file
  --strict           Treat warnings as errors (useful for CI)
```

**Exit codes:** `0` = all valid, `1` = one or more errors (or warnings in `--strict` mode)

### `mdpublish list`

Lists the title, slug, date, category, draft status, and featured status of every
post. It validates content but never writes an output file.

```bash
mdpublish list [--content <path>] [--config <path>]
```

---

## Config File

Create `mdpublish.config.json` at your project root:

```json
{
  "content": "src/content/blog",
  "output": "src/generated/blog.generated.ts",
  "format": "ts",
  "categories": [
    "Engineering",
    "Design",
    "Product"
  ],
  "featured": "hello-world",
  "strict": false,
  "includeDrafts": false
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | `"content"` | Directory containing `.md` files |
| `output` | `string` | `"blog.generated.ts"` | Output file path |
| `format` | `"ts" \| "json"` | `"ts"` | Output format |
| `categories` | `string[]` | `[]` | Allowed categories. If empty, any value is accepted |
| `featured` | `string` | — | Slug to pin as the featured post |
| `strict` | `boolean` | `false` | Treat warnings as errors |
| `includeDrafts` | `boolean` | `false` | Include posts with `draft: true` in generated output |

CLI flags override config file values. Missing config file is not an error.

---

## Frontmatter Schema

All fields below are read from each `.md` file's YAML frontmatter.

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | `string` | ✓ | Lowercase alphanumeric with hyphens: `my-post` |
| `title` | `string` | ✓ | |
| `excerpt` | `string` | ✓ | Max 300 chars. Warning if over 160 (SEO) |
| `category` | `string` | ✓ | Validated against `config.categories` if set |
| `tags` | `string[]` | ✓ | At least one tag required |
| `author` | `string` | ✓ | |
| `date` | `string` | ✓ | Any parseable date string: `2026-03-04` or `Mar 4, 2026` |
| `readTime` | `string` | ✓ | e.g. `"5 min read"` |
| `featured` | `boolean` | — | Default `false` |
| `draft` | `boolean` | — | Default `false`; validated but excluded from sync output by default |
| `order` | `number` | — | Manual sort position. Default `0` (sort by date) |

---

## Generated Output

### TypeScript (default)

```typescript
// AUTO-GENERATED by mdpublish — do not edit manually
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

export const blogPosts: BlogPost[] = [ /* ... */ ];
export const featuredPost: BlogPost | null = blogPosts.find((p) => p.featured) ?? null;
export const allCategories: string[] = [ /* ... */ ];
export const allTags: string[] = [ /* ... */ ];
```

### JSON (`--format json`)

```json
{
  "_meta": { "generated": "...", "version": "1", "count": 5 },
  "posts": [ /* BlogPost objects */ ],
  "allCategories": ["Engineering", "Design"],
  "allTags": ["open-source", "tutorial"]
}
```

The output file intentionally does **not** include:
- Markdown body content (framework-specific to load)
- `id`, `views`, `relevance` (runtime app state, not content)
- Framework-specific fields

---

## Not in v1

This is a focused utility. The following are intentionally out of scope:

- Editing app source files directly
- CMS behavior or admin UI
- Scheduled publishing
- RSS generation
- Image processing
- Search indexing
- Framework-specific runtime integrations (Next.js, Vite, etc.)
- Database support

---

## Programmatic API

```typescript
import { sync, validate, loadConfig } from "@ismail-rt/mdpublish";

// Full pipeline
const result = await sync({
  content: "src/content/blog",
  output: "src/generated/blog.generated.ts",
});
// result: { posts, errors, warnings, outputPath }

// Validate only
const report = await validate({ content: "src/content/blog" });
// report: { valid, errors, warnings, parseErrors }

// Load config
const config = await loadConfig();

// Types
import type { BlogPost, ValidationError, Warning, ResolvedConfig, SyncResult } from "@ismail-rt/mdpublish";
```

---

## npm scripts integration

```json
{
  "scripts": {
    "content:sync": "mdpublish sync",
    "content:validate": "mdpublish validate --strict"
  }
}
```

---

## License

MIT — Copyright (c) 2026 Muhammad Ismail
