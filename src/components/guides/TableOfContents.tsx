import type { TocHeading } from "@/src/lib/markdown";

/**
 * Pure server-rendered anchor list — no JS needed, the browser already
 * handles scrolling to a fragment on click. Sticky so it stays in view
 * alongside a long article; hidden below lg by the caller.
 */
export default function TableOfContents({
  headings,
}: {
  headings: TocHeading[];
}) {
  return (
    <nav className="sticky top-24 rounded-lg border border-nova-hairline bg-nova-crypt p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-nova-smoke">
        On this page
      </h2>
      <ul className="flex flex-col gap-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={`-my-1 block py-1 text-sm text-nova-ash transition-colors duration-(--duration-fast) ease-standard hover:text-nova-ember-text ${
                heading.depth === 3 ? "pl-3" : ""
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
