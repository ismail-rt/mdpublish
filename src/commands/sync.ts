import path from "path";
import pc from "picocolors";
import { scanContentDir } from "../core/scanner.js";
import { parseAll } from "../core/parser.js";
import { validateAll, sortPosts } from "../core/validator.js";
import { emit, emitDry } from "../core/emitter.js";
import type { ResolvedConfig, SyncResult } from "../types.js";

export interface SyncOptions {
  config: ResolvedConfig;
  dryRun?: boolean;
}

/**
 * Full pipeline: scan → parse → validate → emit.
 * Returns a result object; callers handle process.exit().
 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { config, dryRun = false } = options;
  const contentDir = path.resolve(config.content);

  // Scan
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

  // Parse
  const { parsed, errors: parseErrors } = parseAll(scanned);

  // Validate
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

  // Sort
  const sorted = sortPosts(valid);

  // Emit
  const outputPath = path.resolve(config.output);

  if (dryRun) {
    const output = emitDry(sorted, config, contentDir);
    process.stdout.write(output);
  } else {
    emit(sorted, config, contentDir);
  }

  return {
    posts: sorted,
    errors: [],
    warnings,
    outputPath,
  };
}

export function printSyncResult(result: SyncResult, dryRun: boolean): void {
  const { posts, errors, warnings, outputPath } = result;

  if (errors.length > 0) {
    console.error(pc.red(`\n✖  Validation failed — no files were written:\n`));
    for (const err of errors) {
      const location = `field: ${(err as { field?: string }).field ?? "file"}`;
      console.error(`  ${pc.red("✖")} ${pc.bold(err.file)}  [${location}]`);
      console.error(`    ${err.message}\n`);
    }
    console.error(pc.dim("Fix the above errors and re-run `mdpublish sync`.\n"));
    return;
  }

  for (const warn of warnings) {
    console.warn(`  ${pc.yellow("⚠")} ${pc.bold(warn.file)}  [field: ${warn.field}]`);
    console.warn(`    ${warn.message}`);
  }

  if (warnings.length > 0) console.warn("");

  if (dryRun) {
    console.log(pc.cyan(`\n● Dry run — output printed above, no file written.\n`));
  } else {
    console.log(
      pc.green(`\n✔ Synced ${posts.length} post${posts.length !== 1 ? "s" : ""}`) +
        (warnings.length > 0 ? pc.yellow(`, ${warnings.length} warning(s)`) : "") +
        pc.dim(` → ${outputPath}\n`)
    );
  }
}
