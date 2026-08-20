"use client";

import { useState } from "react";
import { useFocusTrap } from "@/src/lib/use-focus-trap";
import CatalogFilters from "./CatalogFilters";

export default function MobileFiltersSheet() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const panelRef = useFocusTrap<HTMLDivElement>(open, close);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full border border-border bg-surface-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-text"
      >
        Filters
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close filters"
            onClick={close}
            className="absolute inset-0 bg-black/60"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-lg border-t border-border bg-bg p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-text">
                Filters
              </span>
              <button
                type="button"
                onClick={close}
                className="-mr-2 -my-2 min-h-11 px-2 text-sm font-medium text-text-muted hover:text-text"
              >
                Close
              </button>
            </div>
            <CatalogFilters />
          </div>
        </div>
      )}
    </div>
  );
}
