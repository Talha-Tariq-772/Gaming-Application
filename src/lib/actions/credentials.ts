"use server";

import { requireUser } from "@/src/lib/auth/session";
import { byteaToBuffer, decrypt } from "@/src/lib/crypto";
import { requestIp } from "@/src/lib/request-ip";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

export type RevealCredentialResult =
  | { ok: true; login: string; password: string; revealedAt: string }
  | { ok: false; error: "NOT_FOUND" | "UNKNOWN"; message: string };

/**
 * The ONLY code path in the app that ever decrypts a GAME credential
 * (revealGiftCardCode below is the gift-card equivalent; both live here so
 * decryption stays in one module). Do not add a third — every other place
 * that needs to know about credentials (admin stock counts, order_items)
 * works with ids/aggregates only, never login_enc/password_enc contents.
 */
export async function revealCredential(
  orderId: string,
  userId: string,
  clientProvidedIp: string,
): Promise<RevealCredentialResult> {
  // Re-verified against the real session, never trusted from the caller.
  await requireUser(userId);
  // A browser can't know its own server-observed IP, and a client-supplied
  // one would be trivially spoofable in an audit log anyway — derived from
  // request headers instead. clientProvidedIp is accepted for signature
  // compatibility but intentionally unused.
  void clientProvidedIp;
  const ip = await requestIp();

  const supabase = createServiceClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (orderErr) {
    console.error("[revealCredential] order lookup", orderErr);
    return { ok: false, error: "UNKNOWN", message: "Something went wrong revealing this credential." };
  }
  if (!order) {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "This order isn't approved yet, or doesn't belong to you.",
    };
  }

  const { data: item, error: itemErr } = await supabase
    .from("order_items")
    .select("credential_id")
    .eq("order_id", orderId)
    .not("credential_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (itemErr || !item?.credential_id) {
    console.error("[revealCredential] order_items lookup", itemErr);
    return { ok: false, error: "NOT_FOUND", message: "No credential is linked to this order." };
  }

  const { data: credential, error: credErr } = await supabase
    .from("game_credentials")
    .select("id, login_enc, password_enc, revealed_at")
    .eq("id", item.credential_id)
    .single();

  if (credErr || !credential) {
    console.error("[revealCredential] credential lookup", credErr);
    return { ok: false, error: "NOT_FOUND", message: "This credential could not be found." };
  }

  const login = decrypt(byteaToBuffer(credential.login_enc));
  const password = decrypt(byteaToBuffer(credential.password_enc));

  // Postgres/PostgREST returns timestamptz as "...+00:00", but freshly
  // generated timestamps below use "...Z" — same instant, different string.
  // Normalized so callers get a consistent format on every call regardless
  // of whether this is the first reveal or a repeat one.
  let revealedAt = credential.revealed_at ? new Date(credential.revealed_at).toISOString() : null;
  if (!revealedAt) {
    revealedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("game_credentials")
      .update({ revealed_at: revealedAt, revealed_ip: ip })
      .eq("id", credential.id);
    if (updateErr) console.error("[revealCredential] stamping revealed_at", updateErr);
  }

  // Logged on every view, not just the first reveal — the timestamp above
  // tracks "first reveal" only, this tracks every access.
  const { error: auditErr } = await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "credential_revealed",
    target_type: "order",
    target_id: orderId,
    metadata: { ip },
  });
  if (auditErr) console.error("[revealCredential] audit log", auditErr);

  return { ok: true, login, password, revealedAt };
}

export type RevealGiftCardCodeResult =
  | { ok: true; code: string; revealedAt: string }
  | { ok: false; error: "NOT_FOUND" | "UNKNOWN"; message: string };

/**
 * Gift-card sibling of revealCredential above — deliberately in the same
 * module so every decryption in this app lives in one file.
 *
 * Note the storage difference: game credentials are `bytea` and go through
 * byteaToBuffer, while gift_card_codes.code_encrypted is `text` holding
 * base64 (see scripts/seed-gift-card-codes.mjs, which writes
 * `encrypt(code).toString("base64")`). Same AES-256-GCM payload, different
 * wire format — decoding it the other way yields garbage that decrypt()
 * rejects on the auth tag, not a silent wrong answer.
 *
 * Scoped to one order_items row rather than "any code on this order", so
 * an order containing several gift cards reveals each line's own code.
 */
export async function revealGiftCardCode(
  orderId: string,
  orderItemId: string,
  userId: string,
): Promise<RevealGiftCardCodeResult> {
  await requireUser(userId);
  const ip = await requestIp();

  const supabase = createServiceClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (orderErr) {
    console.error("[revealGiftCardCode] order lookup", orderErr);
    return { ok: false, error: "UNKNOWN", message: "Something went wrong revealing this code." };
  }
  if (!order) {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "This order isn't approved yet, or doesn't belong to you.",
    };
  }

  // The order_id filter matters as much as the item id: without it, a
  // valid item id from someone else's order would pass the ownership
  // check above (which only proves THIS order is yours) and leak a code.
  const { data: item, error: itemErr } = await supabase
    .from("order_items")
    .select("gift_card_code_id")
    .eq("id", orderItemId)
    .eq("order_id", orderId)
    .not("gift_card_code_id", "is", null)
    .maybeSingle();

  if (itemErr || !item?.gift_card_code_id) {
    console.error("[revealGiftCardCode] order_items lookup", itemErr);
    return { ok: false, error: "NOT_FOUND", message: "No gift card code is linked to this item." };
  }

  const { data: row, error: codeErr } = await supabase
    .from("gift_card_codes")
    .select("id, code_encrypted, revealed_at, status")
    .eq("id", item.gift_card_code_id)
    .single();

  if (codeErr || !row) {
    console.error("[revealGiftCardCode] code lookup", codeErr);
    return { ok: false, error: "NOT_FOUND", message: "This gift card code could not be found." };
  }

  // approve_order flips reserved -> delivered. A code still sitting at
  // 'reserved' here means the order says approved but delivery never ran —
  // surface that rather than handing over a code the system doesn't
  // consider sold.
  if (row.status !== "delivered") {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "This code isn't ready yet. Message us on WhatsApp if this persists.",
    };
  }

  const code = decrypt(Buffer.from(row.code_encrypted, "base64"));

  let revealedAt = row.revealed_at ? new Date(row.revealed_at).toISOString() : null;
  if (!revealedAt) {
    revealedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("gift_card_codes")
      .update({ revealed_at: revealedAt, revealed_ip: ip })
      .eq("id", row.id);
    if (updateErr) console.error("[revealGiftCardCode] stamping revealed_at", updateErr);
  }

  const { error: auditErr } = await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "gift_card_code_revealed",
    target_type: "order",
    target_id: orderId,
    metadata: { ip, order_item_id: orderItemId },
  });
  if (auditErr) console.error("[revealGiftCardCode] audit log", auditErr);

  return { ok: true, code, revealedAt };
}
