"use client";

import { useEffect, useRef, useState } from "react";

function msRemaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

// Minute marks the live region announces at — never every second, per
// WCAG 4.1.3 (an aria-live region firing every second would be unusable
// noise for screen reader users).
const ANNOUNCE_THRESHOLDS_MIN = [10, 5, 1];

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() => msRemaining(expiresAt));
  const [announcement, setAnnouncement] = useState("");

  // Kept in a ref so the interval below doesn't need to restart every time
  // the parent passes a fresh inline callback.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const announcedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    announcedRef.current = new Set();
    setAnnouncement("");

    const interval = setInterval(() => {
      const next = msRemaining(expiresAt);
      setRemainingMs(next);

      const nextMinutes = Math.ceil(next / 60000);
      if (
        ANNOUNCE_THRESHOLDS_MIN.includes(nextMinutes) &&
        !announcedRef.current.has(nextMinutes)
      ) {
        announcedRef.current.add(nextMinutes);
        setAnnouncement(
          `${nextMinutes} minute${nextMinutes === 1 ? "" : "s"} left to complete payment`,
        );
      }

      if (next <= 0) {
        clearInterval(interval);
        onExpireRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <>
      <span className="font-mono tabular-nums">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
