import fs from "fs";
import path from "path";

export interface ScannedFile {
  file: string;
  fullPath: string;
}

/**
 * Discovers all .md files in contentDir (non-recursive).
 * Returns them sorted alphabetically by filename.
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

  const entries = fs.readdirSync(contentDir).sort();
  const results: ScannedFile[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;

    const fullPath = path.join(contentDir, entry);
    const fileStat = fs.statSync(fullPath);

    if (!fileStat.isFile()) continue;

    if (fileStat.size === 0) {
      console.warn(`[mdpublish] skipping empty file: ${entry}`);
      continue;
    }

    results.push({ file: entry, fullPath });
  }

  return results;
}
