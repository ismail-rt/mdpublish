import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runInit } from "../src/commands/init.js";
import { printListResult, runList } from "../src/commands/list.js";
import { runSync } from "../src/commands/sync.js";
import type { ResolvedConfig } from "../src/types.js";

const FIXTURES = path.join(__dirname, "fixtures");
let tmpDir: string;

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    content: path.join(tmpDir, "content"),
    output: path.join(tmpDir, "blog.generated.json"),
    format: "json",
    categories: [],
    featured: undefined,
    strict: false,
    includeDrafts: false,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdpublish-commands-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runSync", () => {
  beforeEach(() => {
    fs.cpSync(path.join(FIXTURES, "valid"), path.join(tmpDir, "content"), {
      recursive: true,
    });
  });

  it("excludes drafts from generated output by default", async () => {
    const result = await runSync({ config: makeConfig() });
    const output = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "blog.generated.json"), "utf-8")
    ) as { posts: Array<{ slug: string }> };

    expect(result.errors).toEqual([]);
    expect(result.posts.map((post) => post.slug)).toEqual(["hello-world"]);
    expect(output.posts.map((post) => post.slug)).toEqual(["hello-world"]);
  });

  it("includes drafts when configured", async () => {
    const result = await runSync({
      config: makeConfig({ includeDrafts: true }),
    });

    expect(result.errors).toEqual([]);
    expect(result.posts.map((post) => post.slug)).toEqual([
      "hello-world",
      "getting-started-guide",
    ]);
  });
});

describe("runInit", () => {
  it("creates a config and sample without overwriting them", () => {
    const result = runInit(tmpDir);
    const configPath = path.join(tmpDir, "mdpublish.config.json");
    const samplePath = path.join(tmpDir, "content", "hello-world.md");
    const originalConfig = fs.readFileSync(configPath, "utf-8");

    expect(result.created).toEqual([
      "mdpublish.config.json",
      path.join("content", "hello-world.md"),
    ]);
    expect(JSON.parse(originalConfig)).toMatchObject({ includeDrafts: false });
    expect(fs.readFileSync(samplePath, "utf-8")).toContain('slug: "hello-world"');
    expect(() => runInit(tmpDir)).toThrow("Refusing to overwrite");
    expect(fs.readFileSync(configPath, "utf-8")).toBe(originalConfig);
  });
});

describe("runList", () => {
  it("lists published and draft posts without writing output", async () => {
    fs.cpSync(path.join(FIXTURES, "valid"), path.join(tmpDir, "content"), {
      recursive: true,
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await runList({ config: makeConfig() });
    printListResult(result);

    expect(result.valid).toHaveLength(2);
    expect(result.valid.some((post) => post.draft)).toBe(true);
    expect(log.mock.calls.flat().join("\n")).toContain("draft");
    expect(log.mock.calls.flat().join("\n")).toContain("Hello World (hello-world)");
    expect(fs.existsSync(path.join(tmpDir, "blog.generated.json"))).toBe(false);
  });

  it("returns validation failures for invalid content", async () => {
    fs.cpSync(path.join(FIXTURES, "invalid"), path.join(tmpDir, "content"), {
      recursive: true,
    });

    const result = await runList({ config: makeConfig() });

    expect(result.errors.length + result.parseErrors.length).toBeGreaterThan(0);
  });
});
