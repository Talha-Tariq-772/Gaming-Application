export default function LegalPlaceholderNotice() {
  return (
    <div className="mb-10 rounded-lg border border-warning/30 bg-warning-dim px-6 py-4">
      <p className="text-sm font-bold text-warning">
        Placeholder — not legal advice
      </p>
      <p className="mt-1 text-sm text-text-muted">
        This page is scaffolding for the real policy, not binding legal
        language. Sections marked{" "}
        <strong className="text-text">[PLACEHOLDER]</strong> need an actual
        business decision, and the whole page should be reviewed by a lawyer
        before it governs a real transaction.
      </p>
    </div>
  );
}
