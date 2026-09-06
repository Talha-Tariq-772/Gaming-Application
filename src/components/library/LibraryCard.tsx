import Link from "next/link";
import CardImage from "@/components/ui/CardImage";
import { REDEMPTION_GUIDE_SLUG } from "@/src/lib/mock-guides";
import type { Game } from "@/src/types/database";

/**
 * Links into the existing order-detail / credential-reveal flow rather
 * than duplicating reveal logic here — the credential itself only ever
 * lives on the order-detail page (src/components/account/CredentialReveal.tsx).
 */
export default function LibraryCard({ game, orderId }: { game: Game; orderId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Link href={`/account/orders/${orderId}`} className="group flex flex-col gap-3">
        <CardImage game={game} className="rounded-lg border border-nova-hairline bg-nova-crypt" />
        <h3 className="line-clamp-2 wrap-break-word font-display text-lg font-bold text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember-text">
          {game.title}
        </h3>
      </Link>
      <Link
        href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
        className="-my-2.5 flex min-h-11 w-fit items-center py-2.5 text-sm font-semibold text-nova-ember-text hover:text-nova-ember-lo"
      >
        View setup guide →
      </Link>
    </div>
  );
}
