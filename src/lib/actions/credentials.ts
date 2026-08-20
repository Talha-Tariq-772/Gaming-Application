"use server";

import { headers } from "next/headers";
import { requireUser } from "@/src/lib/auth/session";
import { byteaToBuffer, decrypt } from "@/src/lib/crypto";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

export type RevealCredentialResult =
  | { ok: true; login: string; password: string; revealedAt: string }
  | { ok: false; error: "NOT_FOUND" | "UNKNOWN"; message: string };

async function requestIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}

/**
 * The ONLY code path in the app that ever decrypts a credential. Do not
 * add a second one — every other place that needs to know about
 * credentials (admin stock counts, order_items) works with ids/aggregates
 * only, never login_enc/password_enc contents.
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
