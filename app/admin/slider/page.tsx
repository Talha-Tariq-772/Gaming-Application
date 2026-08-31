import AdminSliderClient from "@/src/components/admin/AdminSliderClient";
import { getGamesForAdmin } from "@/src/lib/admin-queries";

export default async function AdminSliderPage() {
  const games = await getGamesForAdmin();

  return <AdminSliderClient games={games} />;
}
