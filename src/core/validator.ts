import type { ParsedFile, BlogPost, ValidationError, Warning, ValidationResult } from "../types.js";
import { buildFrontmatterSchema } from "../schemas/frontmatter.js";

const EXCERPT_SEO_LIMIT = 160;

/**
 * Validates all parsed files against the Zod frontmatter schema,
 * detects duplicate slugs, and collects warnings.
 */
export function validateAll(
  parsedFiles: ParsedFile[],
  categories: string[]
): ValidationResult {
  const schema = buildFrontmatterSchema(categories);
  const valid: BlogPost[] = [];
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];

  const slugToFile = new Map<string, string>();
  const duplicateSlugs = new Set<string>();

  // First pass: validate each file individually
  for (const pf of parsedFiles) {
    const result = schema.safeParse(pf.frontmatter);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          type: "validation",
          file: pf.file,
          field: issue.path.join(".") || "frontmatter",
          message: issue.message,
        });
      }
      continue;
    }

    const post = result.data as BlogPost;

    // Track slugs for duplicate detection
    if (slugToFile.has(post.slug)) {
      duplicateSlugs.add(post.slug);
    } else {
      slugToFile.set(post.slug, pf.file);
    }

    // Warn if excerpt is long (SEO guidance)
    if (post.excerpt.length > EXCERPT_SEO_LIMIT) {
      warnings.push({
        type: "warning",
        file: pf.file,
        field: "excerpt",
        message: `Excerpt is ${post.excerpt.length} chars (over ${EXCERPT_SEO_LIMIT} may hurt SEO previews)`,
      });
    }

    valid.push(post);
  }

  // Second pass: report duplicate slugs
  if (duplicateSlugs.size > 0) {
    for (const slug of duplicateSlugs) {
      // Find all files claiming this slug
      for (const pf of parsedFiles) {
        const fm = pf.frontmatter as Record<string, unknown>;
        if (fm["slug"] === slug) {
          errors.push({
            type: "validation",
            file: pf.file,
            field: "slug",
            message: `Duplicate slug "${slug}" — must be unique across all posts`,
          });
        }
      }
    }

    // Remove posts with duplicate slugs from valid
    const invalidSlugs = duplicateSlugs;
    return {
      valid: valid.filter((p) => !invalidSlugs.has(p.slug)),
      errors,
      warnings,
    };
  }

  // Warn if multiple posts have featured: true
  const featuredPosts = valid.filter((p) => p.featured);
  if (featuredPosts.length > 1) {
    for (const p of featuredPosts) {
      const file = parsedFiles.find((pf) => {
        const fm = pf.frontmatter as Record<string, unknown>;
        return fm["slug"] === p.slug;
      });
      warnings.push({
        type: "warning",
        file: file?.file ?? p.slug,
        field: "featured",
        message: `Multiple posts have featured: true — only the first one will be used as featuredPost`,
      });
    }
  }

  return { valid, errors, warnings };
}

/**
 * Sorts posts: non-zero order ascending first, then date descending.
 */
export function sortPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => {
    const ao = a.order ?? 0;
    const bo = b.order ?? 0;

    if (ao !== bo) {
      // Non-zero orders come first, sorted ascending
      if (ao === 0) return 1;
      if (bo === 0) return -1;
      return ao - bo;
    }

    // Same order (both 0 or equal): sort by date descending
    return Date.parse(b.date) - Date.parse(a.date);
  });
}
