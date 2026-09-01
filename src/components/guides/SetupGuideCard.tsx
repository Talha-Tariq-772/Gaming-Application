import Link from "next/link";
import NovaCard from "@/src/components/ui/nova/NovaCard";
import { GAME_PLATFORM_LABELS, type SetupGuide } from "@/src/types/database";

/** "PS4 & PS5 · Game" / "Membership" — SetupGuide has no excerpt/category
 * column (see the type's comment), so the card's subtitle is derived from
 * platform + productType instead of stored copy. */
function subtitle(guide: SetupGuide): string {
  const platformLabel = guide.platform ? GAME_PLATFORM_LABELS[guide.platform] : null;
  const productLabel = guide.productType === "membership" ? "Membership" : "Game";
  return [platformLabel, productLabel].filter(Boolean).join(" · ");
}

export default function SetupGuideCard({ guide }: { guide: SetupGuide }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="group block">
      <NovaCard className="flex h-full flex-col gap-2 p-6">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-nova-smoke">
          {subtitle(guide)}
        </span>
        <h3 className="wrap-break-word font-display text-lg font-bold text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
          {guide.title}
        </h3>
      </NovaCard>
    </Link>
  );
}
