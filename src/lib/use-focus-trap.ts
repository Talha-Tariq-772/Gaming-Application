"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus-trap behavior for dialogs, drawers, and sheets: focuses the
 * first focusable element inside the panel on open, cycles Tab/Shift+Tab
 * within it, closes on Escape, and returns focus to whatever triggered it
 * once it closes or unmounts (WCAG 2.4.3 / 2.1.2).
 *
 * Works for both patterns used in this app: a panel that's always mounted
 * and toggles via `isOpen` (CartDrawer), and one that's conditionally
 * rendered by its parent (admin dialogs) — pass `true` for the latter,
 * since mount/unmount then does the open/close transition itself.
 */
export function useFocusTrap<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const panelRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // The listener below is only (re)attached when `isOpen` flips, not on
  // every render — that's what stops a fresh inline `onClose` (CartDrawer,
  // MobileFiltersSheet pass a new arrow function each render) from
  // re-running the focus/refocus setup constantly. But a caller whose
  // close behavior itself changes over time while `isOpen` stays `true`
  // the whole time (OrderDetailPanel: still open, but Escape should only
  // fire its own onClose once no nested confirm dialog is covering it)
  // would otherwise be stuck calling whatever `onClose` closed over on
  // the very first render. Routing through a ref keeps the listener
  // stable while always invoking the latest behavior.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    getFocusable()?.[0]?.focus();

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  return panelRef;
}
