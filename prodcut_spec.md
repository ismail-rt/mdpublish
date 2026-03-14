# mdpublish — Product Spec

## Overview

`mdpublish` is a lightweight open-source CLI and npm package that helps developers publish markdown-based blog content into static or frontend applications without using a database or CMS.

The goal is simple:

- write blog posts as `.md` files with frontmatter
- run one command
- generate a validated output file the app can import directly

This package is designed for developers building blogs into:

- React apps
- Vite apps
- static company websites
- marketing sites
- internal content-driven sites

It is **not** a CMS.  
It is **not** a hosted platform.  
It is **not** a full website builder.

It is a focused developer utility for turning markdown content into a clean blog data layer.

---

## Product Goal

Build a small, polished, open-source package that solves one common problem well:

> “I have markdown blog posts. I want a reliable way to validate them and generate a clean manifest/output file for my app, without manually wiring everything.”

This package is being built first as an open-source trust-building tool.

### Success criteria

A developer should be able to:

1. Create a folder of markdown blog posts
2. Add frontmatter to each post
3. Run a single CLI command
4. Get a generated output file
5. Import that output file into their frontend app

The tool should feel:

- simple
- reliable
- readable
- framework-friendly
- low-maintenance

---

## v1 Scope

### In scope

- Read markdown files from a content folder
- Parse YAML frontmatter safely
- Validate required frontmatter fields
- Detect duplicate slugs
- Validate categories
- Support tags, author, date, readTime, featured, draft
- Generate a clean output file
- Support TypeScript output
- Support JSON output
- Provide CLI commands:
  - `sync`
  - `validate`
- Provide optional config file support
- Be usable as:
  - a CLI
  - a Node.js library/API
- Be publishable to GitHub and npm

### Out of scope for v1

- Editing arbitrary app source files
- Marker-comment rewriting as the public API
- Full CMS behavior
- Rich text editor or admin panel
- Scheduled publishing UI
- Hosted service
- Database support
- Search indexing
- RSS generation
- Image processing
- Full markdown body rendering in the browser
- Framework-specific runtime integrations
- Analytics fields like `views` or `relevance`

---

## Core Product Idea

The package should follow this model:

```text
Markdown files with frontmatter
        ↓
scan + parse + validate
        ↓
generate output file
        ↓
frontend app imports the generated file