import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { scanContentDir } from "../src/core/scanner.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdpublish-scanner-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("scanContentDir", () => {
  it("recursively discovers markdown files in stable relative-path order", () => {
    fs.mkdirSync(path.join(tmpDir, "guides"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "z-last.md"), "post", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "guides", "a-first.md"), "post", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "ignored.txt"), "not markdown", "utf-8");

    const files = scanContentDir(tmpDir);

    expect(files.map((entry) => entry.file)).toEqual([
      path.join("guides", "a-first.md"),
      "z-last.md",
    ]);
  });

  it("skips nested empty files and warns with their relative path", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fs.mkdirSync(path.join(tmpDir, "drafts"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "drafts", "empty.md"), "", "utf-8");

    expect(scanContentDir(tmpDir)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      `[mdpublish] skipping empty file: ${path.join("drafts", "empty.md")}`
    );
  });

  it("rejects missing directories and file paths", () => {
    expect(() => scanContentDir(path.join(tmpDir, "missing"))).toThrow(
      "Content directory not found"
    );

    const filePath = path.join(tmpDir, "post.md");
    fs.writeFileSync(filePath, "post", "utf-8");
    expect(() => scanContentDir(filePath)).toThrow("Content path is not a directory");
  });
});
