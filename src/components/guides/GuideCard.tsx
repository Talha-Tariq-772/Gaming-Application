import Link from "next/link";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import type { Guide } from "@/src/types/database";

export default function GuideCard({ guide }: { guide: Guide }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="group block">
      <NovaCard className="flex h-full flex-col gap-2 p-6">
        <h3 className="wrap-break-word font-display text-lg font-bold text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember">
          {guide.title}
        </h3>
        <p className="line-clamp-2 wrap-break-word text-sm text-nova-ash">
          {guide.excerpt}
        </p>
      </NovaCard>
    </Link>
  );
}
