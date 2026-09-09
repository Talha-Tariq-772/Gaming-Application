import type { Order } from "@/src/types/database";

/** Postgres/PostgREST returns timestamptz as "...+00:00" — normalized to "...Z" so every timestamp the app sees has a consistent format regardless of source. */
function isoOrNull(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Maps a snake_case `orders` row (as returned by Supabase/RPCs) to the app's `Order` type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOrderRow(row: any): Order {
  return {
    id: row.id,
    userId: row.user_id,
    guestPhone: row.guest_phone,
    status: row.status,
    paymentReference: row.payment_reference,
    amountExact: Number(row.amount_exact),
    paymentMethodId: row.payment_method_id,
    claimedAt: isoOrNull(row.claimed_at),
    reviewedAt: isoOrNull(row.reviewed_at),
    rejectionReason: row.rejection_reason,
    reservedUntil: new Date(row.reserved_until).toISOString(),
    refundPolicyConsentedAt: isoOrNull(row.refund_policy_consented_at),
    regionAckConfirmedAt: isoOrNull(row.region_ack_confirmed_at),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
