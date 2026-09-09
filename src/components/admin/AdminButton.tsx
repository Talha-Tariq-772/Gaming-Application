"use client";

import type { ButtonHTMLAttributes } from "react";

export type AdminButtonVariant = "primary" | "destructive" | "secondary";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: "bg-nova-ember-bright text-nova-void hover:bg-nova-ember-bright-hover",
  destructive: "bg-nova-blood text-nova-void hover:opacity-90",
  secondary: "border border-nova-hairline text-nova-ash hover:text-nova-bone",
};

/**
 * The one solid/bordered button shape reused across every admin dialog
 * footer and page-level primary action (Add Game, Approve/Reject, etc).
 * Row-level compact text actions (Edit/Delete/Manage inside AdminTable
 * cells) intentionally don't go through this — they're a visually
 * distinct, denser affordance and forcing them into this shape would
 * make tables louder, not clearer.
 */
export default function AdminButton({
  variant = "secondary",
  type = "button",
  className = "",
  disabled,
  children,
  ...rest
}: {
  variant?: AdminButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`min-h-11 rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
