export default function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium uppercase tracking-[0.05em] text-text-muted">
      {children}
    </span>
  );
}
