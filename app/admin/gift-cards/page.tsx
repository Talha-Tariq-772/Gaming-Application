import AdminGiftCardsClient from "@/src/components/admin/AdminGiftCardsClient";
import { getGiftCardProductsForAdmin } from "@/src/lib/actions/admin-gift-cards";

export default async function AdminGiftCardsPage() {
  const products = await getGiftCardProductsForAdmin();
  return <AdminGiftCardsClient initialProducts={products} />;
}
