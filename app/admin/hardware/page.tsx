import AdminHardwareClient from "@/src/components/admin/AdminHardwareClient";
import { getHardwareForAdmin } from "@/src/lib/actions/admin-hardware";

export default async function AdminHardwarePage() {
  const products = await getHardwareForAdmin();
  return <AdminHardwareClient initialProducts={products} />;
}
