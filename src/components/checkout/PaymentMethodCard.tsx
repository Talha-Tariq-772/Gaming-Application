import type { PaymentMethod } from "@/src/types/database";

function initials(label: string): string {
  return label
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PaymentMethodCard({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-colors duration-(--duration-fast) ease-standard ${
        selected
          ? "border-accent bg-surface-1"
          : "border-border bg-surface-1 hover:border-border-strong"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-text"
      >
        {initials(method.label)}
      </span>
      <span className="font-medium text-text">{method.label}</span>
      {selected && (
        <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-xs text-on-accent">
          ✓
        </span>
      )}
    </button>
  );
}
