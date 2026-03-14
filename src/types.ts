import type { RawFrontmatter } from "./schemas/frontmatter.js";
import type { RawConfig } from "./schemas/config.js";

export type BlogPost = RawFrontmatter;

export interface ParsedFile {
  file: string;
  fullPath: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface ParseError {
  type: "parse";
  file: string;
  message: string;
}

export interface ValidationError {
  type: "validation";
  file: string;
  field: string;
  message: string;
}

export interface Warning {
  type: "warning";
  file: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: BlogPost[];
  errors: (ParseError | ValidationError)[];
  warnings: Warning[];
}

export interface ResolvedConfig {
  content: string;
  output: string;
  format: "ts" | "json";
  categories: string[];
  featured: string | undefined;
  strict: boolean;
}

export interface SyncResult {
  posts: BlogPost[];
  errors: (ParseError | ValidationError)[];
  warnings: Warning[];
  outputPath: string;
}
