import AdminGamesClient from "@/src/components/admin/AdminGamesClient";
import { getCredentialStock, getEstimatedVariants, getGamesForAdmin } from "@/src/lib/admin-queries";
import { getSetupGuides } from "@/src/lib/setup-guides";

export default async function AdminGamesPage() {
  const [games, stock, setupGuides, estimatedVariants] = await Promise.all([
    getGamesForAdmin(),
    getCredentialStock(),
    getSetupGuides(),
    getEstimatedVariants(),
  ]);

  return (
    <AdminGamesClient
      initialGames={games}
      stock={stock}
      setupGuides={setupGuides}
      estimatedVariants={estimatedVariants}
    />
  );
}
