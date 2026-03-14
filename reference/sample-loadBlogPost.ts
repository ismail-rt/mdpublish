// Static imports: markdown is bundled at build time via Vite's ?raw
// AUTO-IMPORTS-START
import raw7SignsReadyForAiWorkflowAutomation from "../content/blog/7-signs-ready-for-ai-workflow-automation.md?raw";
import rawBuildAiReadyInternalTools from "../content/blog/build-ai-ready-internal-tools.md?raw";
import rawHowToModernizeLegacyApplications from "../content/blog/how-to-modernize-legacy-applications.md?raw";
import rawLegacySystemVsModernPlatform from "../content/blog/legacy-system-vs-modern-platform.md?raw";
import rawSystemsIntegrationGuideGrowingCompanies from "../content/blog/systems-integration-guide-growing-companies.md?raw";
// AUTO-IMPORTS-END

export interface BlogPostContent {
  slug: string;
  contentBeforeFaq: string;
  faqContent: string;
}

/** Strip YAML frontmatter (---...---) and return only the body */
function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/);
  return match ? match[1].trim() : raw.trim();
}

function splitFaq(content: string): { contentBeforeFaq: string; faqContent: string } {
  const idx = content.indexOf("\n## FAQ\n");
  if (idx === -1) return { contentBeforeFaq: content, faqContent: "" };
  return {
    contentBeforeFaq: content.slice(0, idx),
    faqContent: content.slice(idx + "\n## FAQ\n".length).trim(),
  };
}

function parsePost(slug: string, raw: string): BlogPostContent {
  const body = stripFrontmatter(raw);
  const { contentBeforeFaq, faqContent } = splitFaq(body);
  return { slug, contentBeforeFaq, faqContent };
}

// Pre-parsed at module load — never inside a React render
const POST_REGISTRY: Record<string, BlogPostContent> = {
  // AUTO-REGISTRY-START
  "7-signs-ready-for-ai-workflow-automation": parsePost("7-signs-ready-for-ai-workflow-automation", raw7SignsReadyForAiWorkflowAutomation),
  "build-ai-ready-internal-tools": parsePost("build-ai-ready-internal-tools", rawBuildAiReadyInternalTools),
  "how-to-modernize-legacy-applications": parsePost("how-to-modernize-legacy-applications", rawHowToModernizeLegacyApplications),
  "legacy-system-vs-modern-platform": parsePost("legacy-system-vs-modern-platform", rawLegacySystemVsModernPlatform),
  "systems-integration-guide-growing-companies": parsePost("systems-integration-guide-growing-companies", rawSystemsIntegrationGuideGrowingCompanies),
// AUTO-REGISTRY-END
};

export function loadBlogPostBySlug(slug: string): BlogPostContent | null {
  return POST_REGISTRY[slug] ?? null;
}

export function extractTocFromMarkdown(content: string): { id: string; label: string }[] {
  const headingRegex = /^#{2}\s+(.+)$/gm;
  const sections: { id: string; label: string }[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const label = match[1].trim();
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (label.toLowerCase() !== "faq") {
      sections.push({ id, label });
    }
  }
  return sections;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function parseFaqContent(faqContent: string): FaqItem[] {
  if (!faqContent.trim()) return [];
  const items: FaqItem[] = [];
  const blocks = faqContent.split(/\n(?=###\s)/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const questionMatch = trimmed.match(/^###\s+(?:\d+\.\s+)?(.+?)(?=\n|$)/);
    if (!questionMatch) continue;
    const question = questionMatch[1].trim();
    const nlIdx = trimmed.indexOf("\n\n");
    const answer = nlIdx >= 0 ? trimmed.slice(nlIdx + 2).trim() : "";
    if (question && answer) items.push({ question, answer });
  }
  return items;
}
