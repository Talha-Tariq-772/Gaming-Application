"use client";

import { useState } from "react";

/** Shared by /signup and /login — a plain show/hide toggle, no new visual
 * language beyond the existing bordered-input pattern (see PhoneField). */
export default function PasswordField({
  id = "password",
  label = "Password",
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  autoComplete: "new-password" | "current-password";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 pr-14 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-nova-smoke hover:text-nova-bone"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-nova-blood">
          {error}
        </p>
      )}
    </div>
  );
}
