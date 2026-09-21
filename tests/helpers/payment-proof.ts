import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Satisfies approve_order's NO_PAYMENT_SCREENSHOT guard
 * (20260921000005_payment_screenshots.sql) for a test fixture.
 *
 * That guard is a real business rule — an order cannot be approved
 * without evidence the buyer paid — so every suite that approves an order
 * has to produce one, exactly as a real buyer would. Weakening the rule
 * for tests would leave the one thing it exists to prevent untested.
 *
 * Deliberately writes only the ROW, not a storage object. The gate is a
 * row existence check, and uploading a real file per fixture would add a
 * network round trip and a cleanup obligation to dozens of tests for no
 * extra coverage — tests/payment-screenshots.test.ts is where the actual
 * upload path, the image validation and the storage object are exercised.
 *
 * The row cascades away with its order (ON DELETE CASCADE), so no suite
 * needs a new cleanup step for it.
 */
export async function attachPaymentProof(
  service: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { error } = await service.from("payment_screenshots").upsert(
    {
      order_id: orderId,
      storage_path: `${orderId}/payment.webp`,
      content_type: "image/webp",
      byte_size: 1024,
    },
    { onConflict: "order_id" },
  );
  if (error) throw error;
}
