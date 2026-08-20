import Link from "next/link";
import type { Guide } from "@/src/types/database";

export default function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-surface-1 p-6 transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong"
    >
      <h3 className="break-words font-display text-lg font-bold text-text transition-colors duration-(--duration-fast) ease-standard group-hover:text-accent">
        {guide.title}
      </h3>
      <p className="line-clamp-2 break-words text-sm text-text-muted">
        {guide.excerpt}
      </p>
    </Link>
  );
}
