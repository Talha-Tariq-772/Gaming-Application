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
        const plainText = text.replace(/<[^>]+>/g, "");
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
