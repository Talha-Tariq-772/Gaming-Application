import SectionErrorBoundary from "@/src/components/SectionErrorBoundary";

// See route-error/page.tsx — same reasoning, forced dynamic so the
// always-throwing child can't fail the build during static prerendering.
export const dynamic = "force-dynamic";

function AlwaysThrows(): never {
  throw new Error("Simulated section failure — this component always throws.");
}

/**
 * DEV ONLY — demonstrates that a failure inside SectionErrorBoundary stays
 * contained: the heading and the "unaffected content" block below both
 * still render normally even though the middle section fails every time.
 * Part of /dev/states — remove this whole app/dev directory before
 * production.
 */
export default function SectionErrorTriggerPage() {
  return (
    <div className="mx-auto max-w-page px-4 py-16 md:px-8">
      <h1 className="mb-8 text-display-sm font-display font-extrabold text-nova-bone">
        Section error boundary
      </h1>

      <p className="mb-4 text-sm text-nova-ash">
        The section below always throws on render. It should show an
        inline retry state (and fire a failure toast with a Retry
        action) — everything else on this page should render normally
        regardless.
      </p>

      <SectionErrorBoundary label="this demo section">
        <AlwaysThrows />
      </SectionErrorBoundary>

      <div className="mt-8 rounded-lg border border-nova-ember/30 bg-nova-ember/15 p-6 text-sm text-nova-ember">
        Unaffected content — if you can read this, the failure above
        stayed contained.
      </div>
    </div>
  );
}
