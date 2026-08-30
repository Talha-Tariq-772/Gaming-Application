export default function LegalPlaceholderNotice() {
  return (
    <div className="mb-10 rounded-lg border border-nova-gild/30 bg-nova-gild/15 px-6 py-4">
      <p className="text-sm font-bold text-nova-gild">
        Placeholder — not legal advice
      </p>
      <p className="mt-1 text-sm text-nova-ash">
        This page is scaffolding for the real policy, not binding legal
        language. Sections marked{" "}
        <strong className="text-nova-bone">[PLACEHOLDER]</strong> need an actual
        business decision, and the whole page should be reviewed by a lawyer
        before it governs a real transaction.
      </p>
    </div>
  );
}
