import fs from "fs";
import path from "path";
import pc from "picocolors";

const CONFIG_CONTENT = `${JSON.stringify(
  {
    content: "content",
    output: "blog.generated.ts",
    format: "ts",
    includeDrafts: false,
  },
  null,
  2
)}\n`;

const SAMPLE_POST = `---
slug: "hello-world"
title: "Hello World"
excerpt: "My first post published with mdpublish."
category: "General"
tags:
  - "welcome"
author: "Your Name"
date: "2026-01-01"
readTime: "1 min read"
featured: true
draft: false
---

# Hello World

Start writing your post here.
`;

export interface InitResult {
  created: string[];
}

export function runInit(cwd = process.cwd()): InitResult {
  const configPath = path.join(cwd, "mdpublish.config.json");
  const samplePath = path.join(cwd, "content", "hello-world.md");
  const existing = [configPath, samplePath].filter((file) => fs.existsSync(file));

  if (existing.length > 0) {
    const relative = existing.map((file) => path.relative(cwd, file)).join(", ");
    throw new Error(`Refusing to overwrite existing file(s): ${relative}`);
  }

  fs.mkdirSync(path.dirname(samplePath), { recursive: true });
  fs.writeFileSync(configPath, CONFIG_CONTENT, "utf-8");
  fs.writeFileSync(samplePath, SAMPLE_POST, "utf-8");

  return {
    created: [path.relative(cwd, configPath), path.relative(cwd, samplePath)],
  };
}

export function printInitResult(result: InitResult): void {
  console.log(pc.green("\n✔ Initialized mdpublish"));
  for (const file of result.created) {
    console.log(`  ${pc.dim("created")} ${file}`);
  }
  console.log(pc.cyan("\nNext: run `npx mdpublish sync`\n"));
}
