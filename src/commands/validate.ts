import path from "path";
import pc from "picocolors";
import { scanContentDir } from "../core/scanner.js";
import { parseAll } from "../core/parser.js";
import { validateAll } from "../core/validator.js";
import type { ResolvedConfig, ValidationResult, ParseError } from "../types.js";

export interface ValidateOptions {
  config: ResolvedConfig;
}

/**
 * Validate-only pipeline: scan → parse → validate → report.
 * Writes nothing. Returns a combined ValidationResult.
 */
export async function runValidate(
  options: ValidateOptions
): Promise<ValidationResult & { parseErrors: ParseError[] }> {
  const { config } = options;
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

export function printValidateResult(
  result: ValidationResult & { parseErrors: ParseError[] },
  strict: boolean
): void {
  const { valid, errors, warnings, parseErrors } = result;
  const allErrors = [...parseErrors, ...errors];
  const hasFailures = allErrors.length > 0 || (strict && warnings.length > 0);

  if (allErrors.length > 0) {
    console.error(pc.red(`\n✖  ${allErrors.length} error(s) found:\n`));
    for (const err of allErrors) {
      const location = `field: ${ (err as { field?: string }).field ?? "file"}`;
      console.error(`  ${pc.red("✖")} ${pc.bold(err.file)}  [${location}]`);
      console.error(`    ${err.message}\n`);
    }
  }

  if (warnings.length > 0) {
    const prefix = strict ? pc.red(`\n✖  ${warnings.length} warning(s) treated as errors (--strict):\n`) : pc.yellow(`\n⚠  ${warnings.length} warning(s):\n`);
    console.warn(prefix);
    for (const warn of warnings) {
      const icon = strict ? pc.red("✖") : pc.yellow("⚠");
      console.warn(`  ${icon} ${pc.bold(warn.file)}  [field: ${warn.field}]`);
      console.warn(`    ${warn.message}\n`);
    }
  }

  if (!hasFailures) {
    console.log(
      pc.green(`\n✔ All ${valid.length} post${valid.length !== 1 ? "s" : ""} are valid.`) +
        (warnings.length > 0 ? pc.yellow(` ${warnings.length} warning(s).`) : "") +
        "\n"
    );
  } else {
    console.error(pc.red(`\nFix the above issues and re-run.\n`));
  }
}
