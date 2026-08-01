import { loadConfig as _loadConfig } from "./core/config.js";
import { runSync } from "./commands/sync.js";
import { runValidate } from "./commands/validate.js";
import type {
  BlogPost,
  ValidationError,
  Warning,
  ResolvedConfig,
  SyncResult,
  ValidationResult,
  ParseError,
} from "./types.js";
import type { ConfigOverrides } from "./core/config.js";

export type { BlogPost, ValidationError, Warning, ResolvedConfig, SyncResult, ValidationResult, ParseError };

/**
 * Load and resolve mdpublish config, optionally with overrides.
 */
export async function loadConfig(overrides?: ConfigOverrides): Promise<ResolvedConfig> {
  return _loadConfig(overrides);
}

/**
 * Full pipeline: scan → parse → validate → emit.
 * Returns the result; does not call process.exit().
 *
 * @example
 * const result = await sync({ content: "src/content/blog", output: "src/generated/blog.generated.ts" });
 */
export async function sync(overrides?: ConfigOverrides): Promise<SyncResult> {
  const config = _loadConfig(overrides);
  return runSync({ config });
}

/**
 * Validate-only pipeline: scan → parse → validate.
 * Writes nothing.
 *
 * @example
 * const report = await validate({ content: "src/content/blog" });
 */
export async function validate(
  overrides?: ConfigOverrides
): Promise<ValidationResult & { parseErrors: ParseError[] }> {
  const config = _loadConfig(overrides);
  return runValidate({ config });
}
