"use client";

import { useToastStore } from "@/src/stores/toast-store";

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-surface-2 py-2 pl-5 pr-2 text-sm text-text shadow-lg"
        >
          {toast.message}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                dismissToast(toast.id);
              }}
              className="-my-2.5 flex min-h-11 items-center px-2 text-xs font-semibold uppercase tracking-wider text-accent hover:text-accent-strong"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="-my-2.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-faint hover:text-text"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
