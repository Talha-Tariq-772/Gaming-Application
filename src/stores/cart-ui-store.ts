import { create } from "zustand";

/** Drawer open/close state — intentionally not persisted, so a page reload
 * never reopens the drawer on its own. */
interface CartUIState {
  isOpen: boolean;
  lastFocusedElement: HTMLElement | null;
  open: () => void;
  close: () => void;
}

export const useCartUIStore = create<CartUIState>((set, get) => ({
  isOpen: false,
  lastFocusedElement: null,

  open: () =>
    set({
      isOpen: true,
      lastFocusedElement:
        typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null,
    }),

  close: () => {
    const { lastFocusedElement } = get();
    set({ isOpen: false });
    lastFocusedElement?.focus?.();
  },
}));
