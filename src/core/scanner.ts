import fs from "fs";
import path from "path";

export interface ScannedFile {
  file: string;
  fullPath: string;
}

/**
 * Recursively discovers all .md files in contentDir.
 * Returns them sorted alphabetically by relative path.
 * Skips empty files with a console warning rather than throwing.
 */
export function scanContentDir(contentDir: string): ScannedFile[] {
  if (!fs.existsSync(contentDir)) {
    throw new Error(`Content directory not found: ${contentDir}`);
  }

  const stat = fs.statSync(contentDir);
  if (!stat.isDirectory()) {
    throw new Error(`Content path is not a directory: ${contentDir}`);
  }

  const results: ScannedFile[] = [];

  function visit(directory: string): void {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      const file = path.relative(contentDir, fullPath);
      const fileStat = fs.statSync(fullPath);

      if (fileStat.size === 0) {
        console.warn(`[mdpublish] skipping empty file: ${file}`);
        continue;
      }

      results.push({ file, fullPath });
    }
  }

  visit(contentDir);

  return results.sort((a, b) => a.file.localeCompare(b.file));
}
