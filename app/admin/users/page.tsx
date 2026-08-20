import AdminUsersClient from "@/src/components/admin/AdminUsersClient";
import { requireAdmin } from "@/src/lib/auth/session";
import { getProfilesForAdmin } from "@/src/lib/order-queries";

export default async function AdminUsersPage() {
  const [admin, profiles] = await Promise.all([requireAdmin({ allowAgent: true }), getProfilesForAdmin()]);

  return <AdminUsersClient initialProfiles={profiles} currentUserId={admin.id} canChangeRoles={admin.role === "admin"} />;
}
