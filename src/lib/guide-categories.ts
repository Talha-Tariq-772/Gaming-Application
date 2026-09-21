import type { GuideCategory } from "@/src/types/database";

export const GUIDE_CATEGORY_LABELS: Record<GuideCategory, string> = {
  "getting-started": "Getting Started",
  payment: "Payment",
  // Label only — the "account-setup" KEY is the database enum value
  // (guide_category / faqs.category) and every stored row references it,
  // so renaming it would be a data migration, not a copy change.
  "account-setup": "Orders & Setup",
  troubleshooting: "Troubleshooting",
};
