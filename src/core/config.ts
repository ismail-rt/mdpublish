import fs from "fs";
import path from "path";
import { ConfigSchema } from "../schemas/config.js";
import type { ResolvedConfig } from "../types.js";

const CONFIG_FILENAME = "mdpublish.config.json";

/**
 * Walks up the directory tree from startDir looking for mdpublish.config.json.
 * Returns the path if found, null otherwise.
 */
function findConfigFile(startDir: string): string | null {
  let dir = startDir;

  while (true) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      return null;
    }
    dir = parent;
  }
}

export interface ConfigOverrides {
  content?: string;
  output?: string;
  format?: "ts" | "json";
  categories?: string[];
  featured?: string;
  strict?: boolean;
  configPath?: string;
}

/**
 * Loads and validates the config file, then merges in CLI flag overrides.
 * Missing config file is not an error — defaults apply.
 */
export function loadConfig(overrides: ConfigOverrides = {}): ResolvedConfig {
  let rawJson: Record<string, unknown> = {};

  const configPath = overrides.configPath
    ? path.resolve(overrides.configPath)
    : findConfigFile(process.cwd());

  if (configPath) {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    let content: string;
    try {
      content = fs.readFileSync(configPath, "utf-8");
    } catch (err) {
      throw new Error(`Could not read config file: ${(err as Error).message}`);
    }

    try {
      rawJson = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      throw new Error(`Config file is not valid JSON: ${(err as Error).message}`);
    }
  }

  // Merge CLI overrides on top of file config (omitting undefined values)
  const merged: Record<string, unknown> = { ...rawJson };
  if (overrides.content !== undefined) merged["content"] = overrides.content;
  if (overrides.output !== undefined) merged["output"] = overrides.output;
  if (overrides.format !== undefined) merged["format"] = overrides.format;
  if (overrides.categories !== undefined) merged["categories"] = overrides.categories;
  if (overrides.featured !== undefined) merged["featured"] = overrides.featured;
  if (overrides.strict !== undefined) merged["strict"] = overrides.strict;

  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config:\n${messages}`);
  }

  return result.data as ResolvedConfig;
}
