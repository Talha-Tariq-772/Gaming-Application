import AdminFaqsClient from "@/src/components/admin/AdminFaqsClient";
import { getFaqsForAdmin } from "@/src/lib/admin-queries";

export default async function AdminFaqsPage() {
  const faqs = await getFaqsForAdmin();

  return <AdminFaqsClient initialFaqs={faqs} />;
}
