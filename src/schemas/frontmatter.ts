import { z } from "zod";

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const BaseFrontmatterSchema = z.object({
  slug: z
    .string()
    .min(1, "slug is required")
    .regex(slugRegex, "slug must be lowercase alphanumeric with hyphens (e.g. my-post)"),
  title: z.string().min(1, "title is required"),
  excerpt: z.string().min(1, "excerpt is required").max(300, "excerpt must be 300 characters or fewer"),
  category: z.string().min(1, "category is required"),
  tags: z
    .array(z.string().min(1))
    .min(1, "tags must contain at least one item"),
  author: z.string().min(1, "author is required"),
  date: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "date must be a valid parseable date string (e.g. 2026-03-04 or Mar 4, 2026)" }
  ),
  readTime: z.string().min(1, "readTime is required"),
  featured: z.boolean().optional().default(false),
  draft: z.boolean().optional().default(false),
  order: z.number().optional().default(0),
});

export type RawFrontmatter = z.infer<typeof BaseFrontmatterSchema>;

/**
 * Returns a refined schema that validates category against a known list.
 * When categories is empty, any non-empty string is accepted.
 */
export function buildFrontmatterSchema(categories: string[]) {
  if (categories.length === 0) {
    return BaseFrontmatterSchema;
  }

  return BaseFrontmatterSchema.superRefine((data, ctx) => {
    if (!categories.includes(data.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `"${data.category}" is not an allowed category. Allowed: ${categories.join(", ")}`,
      });
    }
  });
}
