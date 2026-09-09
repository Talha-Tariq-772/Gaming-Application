import AdminNav from "@/src/components/admin/AdminNav";

/**
 * Admin access is enforced by middleware.ts (real role check, server-side,
 * before this ever renders) — no client-side gate needed here anymore.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-nova-void md:flex-row">
      <AdminNav />
      {/* min-h-0 is load-bearing here (flex-col on mobile): without it a
          flex item's default min-height:auto refuses to shrink below its
          content size, so overflow-y-auto never actually kicks in and this
          pane grows the whole page instead of scrolling internally.
          min-w-0 is the same fix for the md:flex-row axis — see
          AdminTable.tsx's contain-layout comment for the sibling bug this
          already had to work around. */}
      <main
        id="main-content"
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 md:px-8 md:py-8"
      >
        {children}
      </main>
    </div>
  );
}
