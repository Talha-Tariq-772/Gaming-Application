import AdminGamesClient from "@/src/components/admin/AdminGamesClient";
import { getCredentialStock, getGamesForAdmin } from "@/src/lib/admin-queries";

export default async function AdminGamesPage() {
  const [games, stock] = await Promise.all([getGamesForAdmin(), getCredentialStock()]);

  return <AdminGamesClient initialGames={games} stock={stock} />;
}
