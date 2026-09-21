"use server";

import sharp from "sharp";
import { getAuthenticatedProfile, requireAdmin } from "@/src/lib/auth/session";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

const BUCKET = "payment-screenshots";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Widest a payment screenshot is ever usefully rendered. A phone
 * screenshot is ~1080-1290px wide, so this only shrinks oversized
 * desktop captures — the amount and reference stay legible. */
const MAX_WIDTH = 1600;

/** Decodable by sharp AND accepted by the bucket's allowed_mime_types
 * (20260921000005_payment_screenshots.sql). Checked against sharp's parse
 * of the actual magic bytes, never the client-supplied MIME header. */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type UploadScreenshotResult =
  | { ok: true; uploadedAt: string; replaced: boolean }
  | { ok: false; message: string };

export interface ScreenshotStatus {
  uploaded: boolean;
  uploadedAt: string | null;
  /** False once an admin has decided the order — the customer can replace
   * a wrong image only while it can still change the outcome. */
  canReplace: boolean;
}

/**
 * Payment screenshots, replacing the WhatsApp handoff.
 *
 * AUTHORIZATION lives here, not in storage RLS. Two ways to prove an order
 * is yours:
 *   - a session whose user id matches orders.user_id, or
 *   - the order's lookup_token (a guest has no session at all).
 *
 * The storage policies in the migration cover the signed-in case as a
 * backstop, but a bearer token cannot be expressed in a policy, so this
 * module is the single boundary both paths actually go through. It uses
 * the service client, exactly like every other upload in this app.
 *
 * The bucket is PRIVATE. Nothing here ever returns a public URL, because
 * none exists — admin reads go through a short-lived signed URL below.
 */

/** Resolves an order the caller has proven they may act on, or null.
 * Deliberately returns the same null for "no such order", "wrong token"
 * and "not your order": a caller probing tokens learns nothing from the
 * difference. */
async function authorizeOrder(
  orderId: string,
  lookupToken: string | null,
): Promise<{ id: string; status: string; userId: string | null } | null> {
  const supabase = createServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, user_id, lookup_token")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return null;

  if (lookupToken) {
    // Constant-ish comparison is not meaningful across a network round
    // trip here; the token is 64 hex chars of CSPRNG output, so guessing
    // is the infeasible part, not timing.
    if (lookupToken !== order.lookup_token) return null;
    return { id: order.id, status: order.status, userId: order.user_id };
  }

  // No token: this must be the signed-in owner. A guest order (user_id
  // null) can never be claimed this way.
  const profile = await getAuthenticatedProfile();
  if (!profile || !order.user_id || profile.id !== order.user_id) return null;
  return { id: order.id, status: order.status, userId: order.user_id };
}

/** An order that an admin has already decided is settled — replacing the
 * evidence afterwards would rewrite the record the decision was made on. */
const DECIDED_STATUSES = new Set(["approved", "rejected"]);

export async function uploadPaymentScreenshot(
  formData: FormData,
): Promise<UploadScreenshotResult> {
  const orderId = formData.get("orderId");
  const rawToken = formData.get("lookupToken");
  const file = formData.get("file");

  if (typeof orderId !== "string" || !orderId) {
    return { ok: false, message: "Missing order." };
  }
  const lookupToken = typeof rawToken === "string" && rawToken ? rawToken : null;

  const order = await authorizeOrder(orderId, lookupToken);
  if (!order) {
    return { ok: false, message: "This order couldn't be found, or isn't yours." };
  }
  if (DECIDED_STATUSES.has(order.status)) {
    return {
      ok: false,
      message: "This order has already been reviewed, so its payment proof can't be changed.",
    };
  }

  if (!(file instanceof File)) {
    return { ok: false, message: "No file was selected." };
  }
  if (file.size === 0) {
    return { ok: false, message: "That file is empty. Pick a different screenshot." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "Screenshot must be 10MB or smaller." };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Real magic-byte decode, not the client-supplied Content-Type: a
  // renamed .pdf or an SVG claiming image/png both die here, before sharp
  // resizes anything.
  let format: string | undefined;
  try {
    format = (await sharp(inputBuffer).metadata()).format;
  } catch {
    return { ok: false, message: "That file isn't an image we can read. Upload a PNG, JPEG or WebP." };
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    return { ok: false, message: "Only PNG, JPEG or WebP screenshots are supported." };
  }

  // Re-encoded rather than stored as-uploaded. Two reasons: sharp strips
  // EXIF by default (a phone screenshot can carry device and location
  // metadata the buyer never meant to share), and one consistent format
  // means the admin viewer has one thing to render.
  let processed: Buffer;
  try {
    processed = await sharp(inputBuffer)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    console.error("[uploadPaymentScreenshot] processing", e);
    return { ok: false, message: "We couldn't process that image. Try a different screenshot." };
  }

  const supabase = createServiceClient();
  // Fixed path per order, so a replacement overwrites rather than
  // accumulating. The order id is the first path segment because the
  // storage policies key ownership off it.
  const storagePath = `${order.id}/payment.webp`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, processed, { contentType: "image/webp", upsert: true });
  if (uploadErr) {
    console.error("[uploadPaymentScreenshot] storage", uploadErr);
    return { ok: false, message: "Something went wrong uploading your screenshot. Please try again." };
  }

  const { data: existing } = await supabase
    .from("payment_screenshots")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();

  const uploadedAt = new Date().toISOString();
  const { error: rowErr } = await supabase.from("payment_screenshots").upsert(
    {
      order_id: order.id,
      storage_path: storagePath,
      content_type: "image/webp",
      byte_size: processed.length,
      uploaded_at: uploadedAt,
    },
    { onConflict: "order_id" },
  );
  if (rowErr) {
    console.error("[uploadPaymentScreenshot] row", rowErr);
    return {
      ok: false,
      message: "Your screenshot uploaded, but saving it against the order failed. Please try again.",
    };
  }

  return { ok: true, uploadedAt, replaced: Boolean(existing) };
}

/** Whether this order has a screenshot yet, for the buyer's own status
 * UI. Returns no path and no URL — the buyer never re-reads the image. */
export async function getScreenshotStatus(
  orderId: string,
  lookupToken?: string | null,
): Promise<ScreenshotStatus> {
  const order = await authorizeOrder(orderId, lookupToken ?? null);
  if (!order) return { uploaded: false, uploadedAt: null, canReplace: false };

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("payment_screenshots")
    .select("uploaded_at")
    .eq("order_id", order.id)
    .maybeSingle();

  return {
    uploaded: Boolean(data),
    uploadedAt: data ? new Date(data.uploaded_at).toISOString() : null,
    canReplace: !DECIDED_STATUSES.has(order.status),
  };
}

export type ScreenshotViewResult =
  | { ok: true; url: string; uploadedAt: string }
  | { ok: false; message: string };

/**
 * A short-lived signed URL so an admin can actually look at the evidence.
 *
 * The bucket is private, so this is the only way to view one — and it is
 * admin-gated, minted per request, and expires. Nothing persists a
 * viewable link anywhere.
 */
export async function getPaymentScreenshotUrl(orderId: string): Promise<ScreenshotViewResult> {
  await requireAdmin({ allowAgent: true });

  const supabase = createServiceClient();
  const { data: row, error } = await supabase
    .from("payment_screenshots")
    .select("storage_path, uploaded_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) {
    console.error("[getPaymentScreenshotUrl] lookup", error);
    return { ok: false, message: "Something went wrong loading this screenshot." };
  }
  if (!row) return { ok: false, message: "No payment screenshot has been uploaded for this order." };

  // 5 minutes: long enough to open and read, short enough that a URL
  // pasted somewhere by accident stops working quickly.
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 300);
  if (signErr || !signed) {
    console.error("[getPaymentScreenshotUrl] sign", signErr);
    return { ok: false, message: "Something went wrong loading this screenshot." };
  }

  return { ok: true, url: signed.signedUrl, uploadedAt: new Date(row.uploaded_at).toISOString() };
}
