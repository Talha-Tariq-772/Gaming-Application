import AdminResetsClient from "@/src/components/admin/AdminResetsClient";
import { getPasswordResetRequests } from "@/src/lib/actions/admin-resets";

export default async function AdminResetsPage() {
  const requests = await getPasswordResetRequests();
  return <AdminResetsClient requests={requests} />;
}
