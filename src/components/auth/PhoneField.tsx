"use client";

import { phoneSchema } from "@/src/lib/validation";

/**
 * Accepts any format the user types, normalises on blur, and writes the
 * canonical "+92 300 1234567" form back into the field so the user sees
 * exactly what was understood — shared by /signup, /login, and
 * /forgot-password so all three treat a phone number identically.
 */
export default function PhoneField({
  id = "phone",
  value,
  onChange,
  touched,
  onTouch,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  touched: boolean;
  onTouch: () => void;
}) {
  const parsed = phoneSchema.safeParse(value);
  const error = touched && value && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-nova-smoke">
        Phone number
      </label>
      <input
        id={id}
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          onTouch();
          if (parsed.success) onChange(parsed.data);
        }}
        placeholder="+92 300 1234567"
        autoComplete="tel"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-2 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-nova-blood">
          {error}
        </p>
      )}
    </div>
  );
}
