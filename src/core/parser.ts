import fs from "fs";
import matter from "gray-matter";
import type { ParsedFile, ParseError } from "../types.js";
import type { ScannedFile } from "./scanner.js";

export type ParseResult =
  | { ok: true; data: ParsedFile }
  | { ok: false; error: ParseError };

/**
 * Reads a single markdown file, normalizes line endings,
 * and parses frontmatter with gray-matter.
 * Returns a discriminated union so callers never need try/catch.
 */
export function parseFile(scanned: ScannedFile): ParseResult {
  let raw: string;

  try {
    raw = fs.readFileSync(scanned.fullPath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: {
        type: "parse",
        file: scanned.file,
        message: `Could not read file: ${(err as Error).message}`,
      },
    };
  }

  // Normalize CRLF → LF for cross-platform consistency
  raw = raw.replace(/\r\n/g, "\n");

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    return {
      ok: false,
      error: {
        type: "parse",
        file: scanned.file,
        message: `Frontmatter parse error: ${(err as Error).message}`,
      },
    };
  }

  return {
    ok: true,
    data: {
      file: scanned.file,
      fullPath: scanned.fullPath,
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
    },
  };
}

/**
 * Parses all scanned files and returns separate arrays for
 * successfully parsed data and parse errors.
 */
export function parseAll(scanned: ScannedFile[]): {
  parsed: ParsedFile[];
  errors: ParseError[];
} {
  const parsedFiles: ParsedFile[] = [];
  const errors: ParseError[] = [];

  for (const s of scanned) {
    const result = parseFile(s);
    if (result.ok) {
      parsedFiles.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  return { parsed: parsedFiles, errors };
}
