import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "./core/config.js";
import { runSync, printSyncResult } from "./commands/sync.js";
import { runValidate, printValidateResult } from "./commands/validate.js";
import { runInit, printInitResult } from "./commands/init.js";
import { runList, printListResult } from "./commands/list.js";

const program = new Command();

program
  .name("mdpublish")
  .description("Validate markdown frontmatter and generate a typed blog manifest")
  .version("0.2.0");

program
  .command("sync")
  .description("Scan, validate, and generate the output file")
  .option("--content <path>", "Directory containing .md files")
  .option("--output <path>", "Output file path")
  .option("--format <ts|json>", "Output format: ts or json")
  .option("--featured <slug>", "Pin a post slug as the featured post")
  .option("--include-drafts", "Include draft posts in generated output")
  .option("--dry-run", "Print output to stdout, do not write file")
  .option("--config <path>", "Path to mdpublish.config.json")
  .action(async (opts: {
    content?: string;
    output?: string;
    format?: string;
    featured?: string;
    includeDrafts?: boolean;
    dryRun?: boolean;
    config?: string;
  }) => {
    try {
      const config = loadConfig({
        content: opts.content,
        output: opts.output,
        format: opts.format as "ts" | "json" | undefined,
        featured: opts.featured,
        includeDrafts: opts.includeDrafts ? true : undefined,
        configPath: opts.config,
      });

      const result = await runSync({ config, dryRun: opts.dryRun });
      printSyncResult(result, opts.dryRun ?? false);

      if (result.errors.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red(`\n✖ ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Validate markdown frontmatter without writing any files")
  .option("--content <path>", "Directory containing .md files")
  .option("--config <path>", "Path to mdpublish.config.json")
  .option("--strict", "Treat warnings as errors")
  .action(async (opts: {
    content?: string;
    config?: string;
    strict?: boolean;
  }) => {
    try {
      const config = loadConfig({
        content: opts.content,
        strict: opts.strict,
        configPath: opts.config,
      });

      const result = await runValidate({ config });
      const strict = opts.strict ?? config.strict ?? false;
      printValidateResult(result, strict);

      const hasErrors =
        result.errors.length > 0 ||
        result.parseErrors.length > 0 ||
        (strict && result.warnings.length > 0);

      if (hasErrors) {
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red(`\n✖ ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Create a config file and example post")
  .action(() => {
    try {
      printInitResult(runInit());
    } catch (err) {
      console.error(pc.red(`\n✖ ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List and validate all markdown posts without writing files")
  .option("--content <path>", "Directory containing .md files")
  .option("--config <path>", "Path to mdpublish.config.json")
  .action(async (opts: { content?: string; config?: string }) => {
    try {
      const config = loadConfig({
        content: opts.content,
        configPath: opts.config,
      });
      const result = await runList({ config });
      printListResult(result);

      if (result.errors.length > 0 || result.parseErrors.length > 0) {
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red(`\n✖ ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(pc.red(`\n✖ Unexpected error: ${err.message}\n`));
  process.exit(1);
});
