import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  /** e.g. a "Retry" button on a failure toast — never a silent failure. */
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, action?: ToastAction) => void;
  dismissToast: (id: string) => void;
}

/** Action toasts (failures needing a Retry) stay up longer than plain
 * confirmations — give the user time to actually read and act on them. */
const TOAST_DURATION_MS = 3000;
const ACTION_TOAST_DURATION_MS = 8000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message, action) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, action }] }));
    setTimeout(
      () => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },
      action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS,
    );
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
