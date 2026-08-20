"use client";

import { useEffect, useRef } from "react";
import { track } from "@/src/lib/analytics";

/** Fires the view_order analytics event once, without pulling the whole order-detail page into a client bundle. */
export default function ViewOrderTracker({ orderRef, status }: { orderRef: string; status: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("view_order", { orderRef, status });
  }, [orderRef, status]);
  return null;
}
