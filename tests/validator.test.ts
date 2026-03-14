import { describe, it, expect } from "vitest";
import path from "path";
import { parseAll } from "../src/core/parser.js";
import { validateAll, sortPosts } from "../src/core/validator.js";
import type { BlogPost } from "../src/types.js";

const VALID_DIR = path.join(__dirname, "fixtures/valid");
const INVALID_DIR = path.join(__dirname, "fixtures/invalid");

function loadParsed(dir: string, filenames: string[]) {
  return parseAll(
    filenames.map((f) => ({ file: f, fullPath: path.join(dir, f) }))
  ).parsed;
}

describe("validateAll", () => {
  it("validates all valid posts with no categories restriction", () => {
    const parsed = loadParsed(VALID_DIR, ["hello-world.md", "with-draft.md"]);
    const { valid, errors, warnings } = validateAll(parsed, []);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    expect(valid.map((p) => p.slug)).toEqual(
      expect.arrayContaining(["hello-world", "getting-started-guide"])
    );
  });

  it("validates posts against an allowed category list", () => {
    const parsed = loadParsed(VALID_DIR, ["hello-world.md"]);
    const { valid, errors } = validateAll(parsed, ["Engineering"]);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
  });

  it("rejects a post with a disallowed category", () => {
    const parsed = loadParsed(INVALID_DIR, ["bad-category.md"]);
    const { valid, errors } = validateAll(parsed, ["Engineering", "Design"]);

    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("validation");
    expect((errors[0] as { field: string }).field).toBe("category");
    expect(errors[0].message).toMatch(/NotAllowed/);
  });

  it("accepts a post with any category when no categories are configured", () => {
    const parsed = loadParsed(INVALID_DIR, ["bad-category.md"]);
    const { valid, errors } = validateAll(parsed, []);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
  });

  it("reports validation errors for missing required fields", () => {
    const parsed = loadParsed(INVALID_DIR, ["missing-fields.md"]);
    const { valid, errors } = validateAll(parsed, []);

    expect(valid).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    const fields = errors.map((e) => (e as { field: string }).field);
    expect(fields).toEqual(expect.arrayContaining(["excerpt", "category", "tags", "author", "date", "readTime"]));
  });

  it("detects duplicate slugs and excludes both from valid", () => {
    const parsed = loadParsed(INVALID_DIR, ["duplicate-slug-a.md", "duplicate-slug-b.md"]);
    const { valid, errors } = validateAll(parsed, []);

    expect(valid).toHaveLength(0);
    expect(errors.some((e) => e.message.includes("duplicate-slug"))).toBe(true);
  });

  it("warns when excerpt exceeds 160 characters", () => {
    const longExcerpt = "A".repeat(161);
    const parsed = [
      {
        file: "long-excerpt.md",
        fullPath: "long-excerpt.md",
        body: "",
        frontmatter: {
          slug: "long-excerpt",
          title: "Long Excerpt",
          excerpt: longExcerpt,
          category: "Engineering",
          tags: ["test"],
          author: "Test",
          date: "2026-01-01",
          readTime: "3 min read",
        },
      },
    ];

    const { warnings } = validateAll(parsed, []);
    expect(warnings.some((w) => w.field === "excerpt")).toBe(true);
  });

  it("warns when multiple posts have featured: true", () => {
    const parsed = [
      {
        file: "post-a.md",
        fullPath: "post-a.md",
        body: "",
        frontmatter: {
          slug: "post-a",
          title: "Post A",
          excerpt: "Short excerpt A.",
          category: "Engineering",
          tags: ["test"],
          author: "Author",
          date: "2026-01-01",
          readTime: "3 min read",
          featured: true,
        },
      },
      {
        file: "post-b.md",
        fullPath: "post-b.md",
        body: "",
        frontmatter: {
          slug: "post-b",
          title: "Post B",
          excerpt: "Short excerpt B.",
          category: "Engineering",
          tags: ["test"],
          author: "Author",
          date: "2026-01-02",
          readTime: "3 min read",
          featured: true,
        },
      },
    ];

    const { warnings } = validateAll(parsed, []);
    expect(warnings.some((w) => w.field === "featured")).toBe(true);
  });
});

describe("sortPosts", () => {
  const makePosts = (overrides: Partial<BlogPost>[]): BlogPost[] =>
    overrides.map((o, i) => ({
      slug: `post-${i}`,
      title: `Post ${i}`,
      excerpt: "excerpt",
      category: "cat",
      tags: ["tag"],
      author: "author",
      date: "2026-01-01",
      readTime: "3 min",
      featured: false,
      draft: false,
      order: 0,
      ...o,
    }));

  it("sorts by date descending when order is 0", () => {
    const posts = makePosts([
      { slug: "older", date: "2026-01-01" },
      { slug: "newer", date: "2026-03-01" },
    ]);

    const sorted = sortPosts(posts);
    expect(sorted[0].slug).toBe("newer");
    expect(sorted[1].slug).toBe("older");
  });

  it("puts non-zero order posts first, ascending", () => {
    const posts = makePosts([
      { slug: "no-order", date: "2026-03-01", order: 0 },
      { slug: "order-2", date: "2026-01-01", order: 2 },
      { slug: "order-1", date: "2026-01-01", order: 1 },
    ]);

    const sorted = sortPosts(posts);
    expect(sorted[0].slug).toBe("order-1");
    expect(sorted[1].slug).toBe("order-2");
    expect(sorted[2].slug).toBe("no-order");
  });
});
