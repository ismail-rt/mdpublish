import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig } from "../src/core/config.js";

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdpublish-config-test-"));
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig();

    expect(config.content).toBe("content");
    expect(config.output).toBe("blog.generated.ts");
    expect(config.format).toBe("ts");
    expect(config.categories).toEqual([]);
    expect(config.strict).toBe(false);
    expect(config.featured).toBeUndefined();
  });

  it("loads and merges a valid config file", () => {
    const configFile = path.join(tmpDir, "mdpublish.config.json");
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        content: "src/posts",
        output: "src/generated/blog.ts",
        format: "ts",
        categories: ["Engineering", "Design"],
      }),
      "utf-8"
    );

    const config = loadConfig();
    expect(config.content).toBe("src/posts");
    expect(config.output).toBe("src/generated/blog.ts");
    expect(config.categories).toEqual(["Engineering", "Design"]);
  });

  it("applies CLI overrides on top of config file", () => {
    const configFile = path.join(tmpDir, "mdpublish.config.json");
    fs.writeFileSync(
      configFile,
      JSON.stringify({ content: "src/posts", format: "ts" }),
      "utf-8"
    );

    const config = loadConfig({ content: "override/posts", format: "json" });
    expect(config.content).toBe("override/posts");
    expect(config.format).toBe("json");
  });

  it("throws when the config file is invalid JSON", () => {
    const configFile = path.join(tmpDir, "mdpublish.config.json");
    fs.writeFileSync(configFile, "{ not: valid json }", "utf-8");

    expect(() => loadConfig()).toThrow("Config file is not valid JSON");
  });

  it("throws when config has an invalid format value", () => {
    const configFile = path.join(tmpDir, "mdpublish.config.json");
    fs.writeFileSync(
      configFile,
      JSON.stringify({ format: "xml" }),
      "utf-8"
    );

    expect(() => loadConfig()).toThrow("Invalid config");
  });

  it("throws when configPath is provided but file does not exist", () => {
    expect(() =>
      loadConfig({ configPath: path.join(tmpDir, "missing.json") })
    ).toThrow("Config file not found");
  });

  it("accepts an explicit configPath", () => {
    const configFile = path.join(tmpDir, "custom.config.json");
    fs.writeFileSync(
      configFile,
      JSON.stringify({ content: "custom/posts" }),
      "utf-8"
    );

    const config = loadConfig({ configPath: configFile });
    expect(config.content).toBe("custom/posts");
  });
});
