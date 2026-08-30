"use client";

import { useOnlineStatus } from "@/src/lib/use-online-status";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-70 flex min-h-11 items-center justify-center gap-2 bg-nova-gild px-4 py-2 text-center text-sm font-semibold text-nova-void"
    >
      You&rsquo;re offline. Checkout is disabled until your connection comes
      back.
    </div>
  );
}
