import AdminNav from "@/src/components/admin/AdminNav";

/**
 * Admin access is enforced by middleware.ts (real role check, server-side,
 * before this ever renders) — no client-side gate needed here anymore.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-bg md:flex-row">
      <AdminNav />
      <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
