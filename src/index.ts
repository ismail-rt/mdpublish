import path from "path";
import { loadConfig as _loadConfig } from "./core/config.js";
import { scanContentDir } from "./core/scanner.js";
import { parseAll } from "./core/parser.js";
import { validateAll, sortPosts } from "./core/validator.js";
import { emit } from "./core/emitter.js";
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
  const contentDir = path.resolve(config.content);

  const scanned = scanContentDir(contentDir);

  if (scanned.length === 0) {
    return {
      posts: [],
      errors: [
        {
          type: "parse",
          file: contentDir,
          message: `No .md files found in ${contentDir}`,
        },
      ],
      warnings: [],
      outputPath: path.resolve(config.output),
    };
  }

  const { parsed, errors: parseErrors } = parseAll(scanned);
  const { valid, errors: validationErrors, warnings } = validateAll(parsed, config.categories);
  const allErrors = [...parseErrors, ...validationErrors];

  if (allErrors.length > 0) {
    return {
      posts: [],
      errors: allErrors,
      warnings,
      outputPath: path.resolve(config.output),
    };
  }

  const sorted = sortPosts(valid);
  const outputPath = path.resolve(config.output);
  emit(sorted, config, contentDir);

  return {
    posts: sorted,
    errors: [],
    warnings,
    outputPath,
  };
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
  const contentDir = path.resolve(config.content);

  const scanned = scanContentDir(contentDir);

  if (scanned.length === 0) {
    return {
      valid: [],
      errors: [],
      warnings: [],
      parseErrors: [
        {
          type: "parse",
          file: contentDir,
          message: `No .md files found in ${contentDir}`,
        },
      ],
    };
  }

  const { parsed, errors: parseErrors } = parseAll(scanned);
  const { valid, errors, warnings } = validateAll(parsed, config.categories);

  return { valid, errors, warnings, parseErrors };
}
