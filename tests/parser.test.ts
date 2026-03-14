import { describe, it, expect } from "vitest";
import path from "path";
import { parseFile, parseAll } from "../src/core/parser.js";

const VALID_DIR = path.join(__dirname, "fixtures/valid");
const INVALID_DIR = path.join(__dirname, "fixtures/invalid");

describe("parseFile", () => {
  it("parses a valid markdown file and extracts frontmatter", () => {
    const result = parseFile({
      file: "hello-world.md",
      fullPath: path.join(VALID_DIR, "hello-world.md"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.frontmatter["slug"]).toBe("hello-world");
    expect(result.data.frontmatter["title"]).toBe("Hello World");
    expect(result.data.frontmatter["featured"]).toBe(true);
    expect(result.data.body).toContain("Hello World");
    expect(result.data.body).not.toContain("slug:");
  });

  it("parses a draft post correctly", () => {
    const result = parseFile({
      file: "with-draft.md",
      fullPath: path.join(VALID_DIR, "with-draft.md"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.frontmatter["draft"]).toBe(true);
    expect(result.data.frontmatter["slug"]).toBe("getting-started-guide");
  });

  it("returns a parse error for a non-existent file", () => {
    const result = parseFile({
      file: "nonexistent.md",
      fullPath: "/tmp/nonexistent.md",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.type).toBe("parse");
    expect(result.error.file).toBe("nonexistent.md");
    expect(result.error.message).toMatch(/Could not read file/);
  });
});

describe("parseAll", () => {
  it("parses all valid files without errors", () => {
    const scanned = [
      { file: "hello-world.md", fullPath: path.join(VALID_DIR, "hello-world.md") },
      { file: "with-draft.md", fullPath: path.join(VALID_DIR, "with-draft.md") },
    ];

    const { parsed, errors } = parseAll(scanned);

    expect(errors).toHaveLength(0);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((p) => p.frontmatter["slug"])).toEqual(
      expect.arrayContaining(["hello-world", "getting-started-guide"])
    );
  });

  it("separates parse errors from successfully parsed files", () => {
    const scanned = [
      { file: "hello-world.md", fullPath: path.join(VALID_DIR, "hello-world.md") },
      { file: "missing.md", fullPath: "/tmp/does-not-exist.md" },
    ];

    const { parsed, errors } = parseAll(scanned);

    expect(parsed).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe("missing.md");
  });
});
