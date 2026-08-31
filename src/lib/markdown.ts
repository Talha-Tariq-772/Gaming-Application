import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

export interface TocHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface RenderedMarkdown {
  html: string;
  headings: TocHeading[];
}

/** Reverses marked's own escaping of plain text nodes (`&amp;`, `&#39;`,
 * etc.) — needed because TocHeading.text is rendered as a plain React text
 * node (TableOfContents), not dangerouslySetInnerHTML like the article
 * body, so an escaped entity would show up as literal "&#39;" instead of
 * an apostrophe. */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
];

/**
 * Renders guide/FAQ markdown (our own authored placeholder copy, not user
 * input) to sanitized HTML, and separately collects h2/h3 headings for the
 * article's table of contents — using a fresh Marked instance per call
 * rather than the shared default export, so the heading-ID renderer
 * override from one call can't leak into another during a single SSG
 * build process that renders many guides back to back.
 */
export function renderMarkdown(markdown: string): RenderedMarkdown {
  const headings: TocHeading[] = [];
  const seenIds = new Map<string, number>();

  const marked = new Marked({
    renderer: {
      heading(token) {
        const text = this.parser.parseInline(token.tokens);
        const plainText = decodeHtmlEntities(text.replace(/<[^>]+>/g, ""));
        let id = slugify(plainText);
        const seenCount = seenIds.get(id) ?? 0;
        seenIds.set(id, seenCount + 1);
        if (seenCount > 0) id = `${id}-${seenCount}`;

        if (token.depth === 2 || token.depth === 3) {
          headings.push({ id, text: plainText, depth: token.depth });
        }

        return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
      },
    },
  });

  const rawHtml = marked.parse(markdown, { async: false }) as string;

  const html = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
    },
    // Every external link in our own guide copy should behave like the
    // rest of the site's external links (WhatsApp, payment app links) —
    // safe defaults even though this content isn't user-supplied.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });

  return { html, headings };
}

/**
 * Plain-text meta-description fallback for markdown that has no separate
 * excerpt column (setup_guides — see its type comment). Takes the first
 * paragraph, strips inline markdown syntax, and truncates on a word
 * boundary. Not used for on-page rendering, only <meta description> /
 * card subtitles, so it doesn't need to handle every markdown construct —
 * just the bold/link/heading syntax this codebase's own guide copy uses.
 */
export function excerptFromMarkdown(markdown: string, maxLength = 155): string {
  const firstParagraph = markdown.split(/\n\s*\n/)[0] ?? "";
  const plain = firstParagraph
    .replace(/^#+\s*/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).replace(/\s+\S*$/, "")}…`;
}
