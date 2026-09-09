"use client";

import type { ReactNode } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";

/**
 * Right-side slide-over shell shared by OrderDetailPanel, VariantsPanel
 * and CredentialGamePanel. Owns the backdrop, focus trap/scroll lock, the
 * h-dvh viewport pin, and the header row (title + close button) — content
 * and an optional footer are supplied by the caller.
 */
export default function AdminSlideOver({
  onClose,
  titleId,
  title,
  bodyClassName = "flex flex-1 flex-col gap-6 px-5 py-5",
  footer,
  children,
}: {
  onClose: () => void;
  titleId: string;
  title: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(true, onClose);

  return (
    <>
      <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-nova-void/70" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-40 flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-nova-hairline bg-nova-crypt"
      >
        <div className="flex items-start justify-between border-b border-nova-hairline px-5 py-4">
          <div id={titleId}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-nova-ash hover:text-nova-bone"
          >
            ✕
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer}
      </div>
    </>
  );
}
