import { runValidate, printValidateResult } from "./validate.js";
import { sortPosts } from "../core/validator.js";
import type { BlogPost, ParseError, ResolvedConfig, ValidationResult } from "../types.js";

export interface ListOptions {
  config: ResolvedConfig;
}

export type ListResult = ValidationResult & {
  parseErrors: ParseError[];
};

export async function runList(options: ListOptions): Promise<ListResult> {
  const result = await runValidate({ config: options.config });
  return {
    ...result,
    valid: sortPosts(result.valid),
  };
}

function statusFor(post: BlogPost): string {
  const publication = post.draft ? "draft" : "published";
  return post.featured ? `${publication}, featured` : publication;
}

export function printListResult(result: ListResult): void {
  const hasErrors = result.errors.length > 0 || result.parseErrors.length > 0;

  if (hasErrors) {
    printValidateResult(result, false);
    return;
  }

  console.log(`\n${"DATE".padEnd(12)}${"STATUS".padEnd(22)}${"CATEGORY".padEnd(18)}TITLE (SLUG)`);
  for (const post of result.valid) {
    console.log(
      `${post.date.padEnd(12)}${statusFor(post).padEnd(22)}${post.category.padEnd(18)}${post.title} (${post.slug})`
    );
  }

  console.log(
    `\n${result.valid.length} post${result.valid.length === 1 ? "" : "s"}` +
      (result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : "") +
      "\n"
  );
}
