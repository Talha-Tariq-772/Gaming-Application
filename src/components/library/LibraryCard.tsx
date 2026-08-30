import Image from "next/image";
import Link from "next/link";
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
        <div className="relative aspect-3/4 overflow-hidden rounded-lg border border-nova-hairline bg-nova-crypt">
          <Image
            src={game.coverImageUrl}
            alt={game.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
        </div>
        <h3 className="line-clamp-2 wrap-break-word font-display text-lg font-bold text-nova-bone transition-colors duration-(--duration-fast) ease-standard group-hover:text-nova-ember">
          {game.title}
        </h3>
      </Link>
      <Link
        href={`/guides/${REDEMPTION_GUIDE_SLUG}`}
        className="-my-2.5 flex min-h-11 w-fit items-center py-2.5 text-sm font-semibold text-nova-ember hover:text-nova-ember-lo"
      >
        View setup guide →
      </Link>
    </div>
  );
}
