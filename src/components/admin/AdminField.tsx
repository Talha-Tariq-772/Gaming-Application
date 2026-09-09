import type { ReactNode } from "react";

/** Shared input/select/textarea styling — applied by the call site since
 * each field still needs its own type-specific props (type="number",
 * rows, etc). Kept as a plain string, not a wrapper component, so every
 * existing <input>/<select>/<textarea> element and its onChange/onBlur
 * handlers stay exactly as they are. */
export const ADMIN_INPUT_CLASS =
  "min-h-11 w-full rounded-md border border-nova-hairline bg-nova-slab px-3 py-2 text-sm text-nova-bone placeholder:text-nova-smoke focus:border-nova-ember focus:outline-none";

/** The label/input/error trio repeated across GameFormDialog, VariantsPanel,
 * CredentialGamePanel and RejectDialog. Wraps whatever field element the
 * caller renders (children) — this only unifies the label above and the
 * error/hint line below, not the field itself. */
export default function AdminField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold uppercase tracking-wider text-nova-smoke"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-nova-blood">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-nova-smoke">{hint}</p>
      )}
    </div>
  );
}
