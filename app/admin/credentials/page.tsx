import AdminCredentialsClient from "@/src/components/admin/AdminCredentialsClient";
import { getCredentialStock, getGamesForAdmin } from "@/src/lib/admin-queries";

export default async function AdminCredentialsPage() {
  const [games, stock] = await Promise.all([getGamesForAdmin(), getCredentialStock()]);

  return <AdminCredentialsClient games={games} initialStock={stock} />;
}
