import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()/getAuthenticatedProfile()-via-mocked-session
 * pattern as the rest of the suite. next/headers is mocked too — the
 * upload path doesn't read it, but requireAdmin's session client does. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const {
  getPaymentScreenshotUrl,
  getScreenshotStatus,
  uploadPaymentScreenshot,
} = await import("@/src/lib/actions/payment-screenshots");
const { findOrderByLookupToken } = await import("@/src/lib/order-lookup");
const { approveOrder } = await import("@/src/lib/actions/admin-orders");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `ScreenshotTest!${randomUUID()}`;

let admin: { id: string; email: string };
let buyerA: { id: string; email: string };
let buyerB: { id: string; email: string };
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientAdmin: SupabaseClient;
let game: { id: string };
let paymentMethodId: string;
let realImageBuffer: Buffer;

const orderIds: string[] = [];

function fileFormData(
  fields: Record<string, string>,
  bytes: Buffer,
  name = "shot.jpg",
  type = "image/jpeg",
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  fd.set("file", new File([bytes as unknown as BlobPart], name, { type }));
  return fd;
}

/** Creates an order directly (not through checkout) so each test controls
 * its own status and ownership. Returns the lookup token too, since that
 * is the guest half of the authorization contract under test. */
async function seedOrder(
  userId: string | null,
  status = "payment_claimed",
): Promise<{ id: string; lookupToken: string }> {
  const { data, error } = await service
    .from("orders")
    .insert({
      user_id: userId,
      guest_phone: userId ? null : `+9230${run}77`,
      status,
      payment_reference: `SHOT-${randomUUID().slice(0, 10)}`,
      amount_exact: 2500.42,
      payment_method_id: paymentMethodId,
      reserved_until: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .select("id, lookup_token")
    .single();
  if (error) throw error;
  orderIds.push(data.id);

  const { error: itemErr } = await service
    .from("order_items")
    .insert({ order_id: data.id, game_id: game.id, price: 2500 });
  if (itemErr) throw itemErr;

  return { id: data.id, lookupToken: data.lookup_token };
}

beforeAll(async () => {
  const mk = async (label: string) => {
    const email = `shot-${label}-${run}@example.com`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return { id: data.user.id, email };
  };

  admin = await mk("admin");
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);
  buyerA = await mk("buyer-a");
  buyerB = await mk("buyer-b");

  clientAdmin = await signedInClient(admin.email, password);
  clientA = await signedInClient(buyerA.email, password);
  clientB = await signedInClient(buyerB.email, password);

  const { data: g, error: gErr } = await service
    .from("games")
    .insert({
      title: `Screenshot Test Game ${run}`,
      slug: `screenshot-test-game-${run}`,
      genre: "Action",
      price: 2500,
      is_active: true,
    })
    .select("id")
    .single();
  if (gErr) throw gErr;
  game = g;

  const { data: pm } = await service.from("payment_methods").select("id").limit(1).single();
  paymentMethodId = pm!.id;

  // A genuine decodable jpeg, not a synthetic fixture — same source the
  // other upload suites use.
  const cardDir = path.join(process.cwd(), "assets", "product-images", "card");
  const [first] = await fs.readdir(cardDir);
  realImageBuffer = await fs.readFile(path.join(cardDir, first));

  sessionState.client = clientA;
}, 160_000);

afterAll(async () => {
  await runCleanupSteps(
    [
      {
        // Storage objects have no FK to cascade through — the rows do
        // (ON DELETE CASCADE), the files do not.
        label: "storage objects",
        run: async () => {
          if (orderIds.length) {
            await deleteWithRetry(
              () =>
                service.storage
                  .from("payment-screenshots")
                  .remove(orderIds.map((id) => `${id}/payment.webp`)),
              "storage objects",
            );
          }
        },
      },
      {
        label: "orders",
        run: async () => {
          if (orderIds.length) {
            await deleteWithRetry(
              () => service.from("orders").delete().in("id", orderIds),
              "orders",
            );
          }
        },
      },
      {
        label: "game",
        run: async () => {
          if (game?.id) {
            await deleteWithRetry(() => service.from("games").delete().eq("id", game.id), "game");
          }
        },
      },
      {
        label: "audit log",
        run: async () => {
          for (const u of [admin, buyerA, buyerB]) {
            if (u?.id) {
              await deleteWithRetry(
                () => service.from("audit_log").delete().eq("actor_id", u.id),
                "audit log",
              );
            }
          }
        },
      },
      {
        label: "users",
        run: async () => {
          for (const u of [admin, buyerA, buyerB]) {
            if (u?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(u.id), "user");
          }
        },
      },
    ],
    20_000,
  );
}, 200_000);

/* ------------------------------------------------------------------ */
/* Upload succeeds                                                     */
/* ------------------------------------------------------------------ */

describe("uploading a payment screenshot", () => {
  it("stores the object, records the row, and reports back", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, realImageBuffer),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.replaced).toBe(false);
    expect(result.uploadedAt).toBeTruthy();

    const { data: row } = await service
      .from("payment_screenshots")
      .select("storage_path, content_type, byte_size")
      .eq("order_id", order.id)
      .single();
    expect(row!.storage_path).toBe(`${order.id}/payment.webp`);
    // Re-encoded to webp on the way in: strips EXIF, and gives the admin
    // viewer one format to render.
    expect(row!.content_type).toBe("image/webp");
    expect(row!.byte_size).toBeGreaterThan(0);

    const { data: listed } = await service.storage
      .from("payment-screenshots")
      .list(order.id, { limit: 10 });
    expect((listed ?? []).map((o) => o.name)).toContain("payment.webp");
  });

  it("a guest uploads with the lookup token and no session at all", async () => {
    const order = await seedOrder(null);
    sessionState.client = null;

    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id, lookupToken: order.lookupToken }, realImageBuffer),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
  });

  it("replacing overwrites in place rather than piling up evidence", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const first = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, realImageBuffer),
    );
    expect(first.ok).toBe(true);

    const second = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, realImageBuffer),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.replaced, "a second upload should report itself as a replacement").toBe(true);

    const { count } = await service
      .from("payment_screenshots")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    expect(count, "one current screenshot per order").toBe(1);
  });

  it("reports status back to the buyer's own UI", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const before = await getScreenshotStatus(order.id);
    expect(before.uploaded).toBe(false);
    expect(before.canReplace).toBe(true);

    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    const after = await getScreenshotStatus(order.id);
    expect(after.uploaded).toBe(true);
    expect(after.uploadedAt).toBeTruthy();
  });

  it("refuses to change evidence once the order has been decided", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;
    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    await service.from("orders").update({ status: "rejected" }).eq("id", order.id);

    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, realImageBuffer),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/already been reviewed/i);

    const status = await getScreenshotStatus(order.id);
    expect(status.canReplace).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Non-image files rejected                                            */
/* ------------------------------------------------------------------ */

describe("only real images are accepted", () => {
  it("rejects a non-image with a spoofed image/jpeg content type", async () => {
    // The Content-Type header is attacker-controlled; only the magic-byte
    // decode proves what the bytes actually are.
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const notAnImage = Buffer.from("%PDF-1.4 this is a pdf, not a screenshot");
    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, notAnImage, "receipt.jpg", "image/jpeg"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/image|supported/i);

    const { count } = await service
      .from("payment_screenshots")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    expect(count, "a rejected upload must not leave a row behind").toBe(0);
  });

  it("rejects an empty file and an oversized one", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const empty = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, Buffer.alloc(0)),
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.message).toMatch(/empty/i);

    const huge = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, Buffer.alloc(11 * 1024 * 1024, 1)),
    );
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.message).toMatch(/10MB/i);
  });

  it("rejects a missing file rather than throwing", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;

    const fd = new FormData();
    fd.set("orderId", order.id);
    const result = await uploadPaymentScreenshot(fd);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/no file/i);
  });
});

/* ------------------------------------------------------------------ */
/* Isolation between buyers and guests                                 */
/* ------------------------------------------------------------------ */

describe("one buyer cannot reach another's order or evidence", () => {
  it("a signed-in buyer cannot upload to someone else's order", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientB;

    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: order.id }, realImageBuffer),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Same message as "no such order": a prober learns nothing from the
    // difference between wrong-owner and doesn't-exist.
    expect(result.message).toMatch(/couldn't be found, or isn't yours/i);

    const { count } = await service
      .from("payment_screenshots")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    expect(count).toBe(0);
  });

  it("a wrong lookup token is refused, and one guest's token can't open another's order", async () => {
    const guestA = await seedOrder(null);
    const guestB = await seedOrder(null);
    sessionState.client = null;

    const wrong = await uploadPaymentScreenshot(
      fileFormData({ orderId: guestA.id, lookupToken: guestB.lookupToken }, realImageBuffer),
    );
    expect(wrong.ok, "guest B's token must not open guest A's order").toBe(false);

    const garbage = await uploadPaymentScreenshot(
      fileFormData({ orderId: guestA.id, lookupToken: "f".repeat(64) }, realImageBuffer),
    );
    expect(garbage.ok).toBe(false);
  });

  it("a guest order can't be claimed by a session alone, with no token", async () => {
    // orders.user_id is null, so there is no owner for a session to
    // match — a signed-in stranger must not be able to act on it.
    const guest = await seedOrder(null);
    sessionState.client = clientA;

    const result = await uploadPaymentScreenshot(
      fileFormData({ orderId: guest.id }, realImageBuffer),
    );
    expect(result.ok).toBe(false);
  });

  it("the lookup token resolves exactly one order, and rejects a malformed one", async () => {
    const order = await seedOrder(null);

    const found = await findOrderByLookupToken(order.lookupToken);
    expect(found).not.toBeNull();
    expect(found!.order.id).toBe(order.id);
    expect(found!.items.length).toBe(1);

    // Short/guessable inputs — the exact reason payment_reference was not
    // reused as the token — never reach the database.
    expect(await findOrderByLookupToken("PSC-ABC123")).toBeNull();
    expect(await findOrderByLookupToken("")).toBeNull();
    expect(await findOrderByLookupToken("g".repeat(64))).toBeNull();
  });

  it("the token is long, random, and unique per order", async () => {
    const a = await seedOrder(null);
    const b = await seedOrder(null);
    expect(a.lookupToken).toMatch(/^[0-9a-f]{64}$/);
    expect(b.lookupToken).toMatch(/^[0-9a-f]{64}$/);
    expect(a.lookupToken).not.toBe(b.lookupToken);
  });

  it("neither anon nor a signed-in customer can read the screenshot table", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;
    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    expect((await anon.from("payment_screenshots").select("*").limit(1)).error).not.toBeNull();
    expect(
      (await clientA.from("payment_screenshots").select("*").limit(1)).error,
      "even the order's own owner has no direct table access",
    ).not.toBeNull();
  });

  it("the bucket is private — no public URL serves the object", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;
    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    const publicUrl = `${url}/storage/v1/object/public/payment-screenshots/${order.id}/payment.webp`;
    const response = await fetch(publicUrl);
    expect(response.ok, "a payment screenshot must not be publicly fetchable").toBe(false);
  });

  it("only an admin can mint a viewing URL", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;
    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    sessionState.client = clientB;
    await expect(getPaymentScreenshotUrl(order.id)).rejects.toThrow();

    sessionState.client = clientA;
    await expect(
      getPaymentScreenshotUrl(order.id),
      "not even the buyer who uploaded it — the image is evidence, not a receipt",
    ).rejects.toThrow();

    sessionState.client = clientAdmin;
    const result = await getPaymentScreenshotUrl(order.id);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("payment-screenshots");
    // Signed, not public.
    expect(result.url).toMatch(/token=|signature=/);

    const fetched = await fetch(result.url);
    expect(fetched.ok, "the signed URL should actually serve the image").toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* No screenshot, no approval                                          */
/* ------------------------------------------------------------------ */

describe("an order can't be approved without a screenshot", () => {
  it("approve_order refuses at the database level", async () => {
    const order = await seedOrder(buyerA.id);

    const { error } = await service.rpc("approve_order", {
      p_order_id: order.id,
      p_admin_id: admin.id,
    });
    expect(error, "approval must be blocked, not merely discouraged").not.toBeNull();
    expect(error!.message).toMatch(/NO_PAYMENT_SCREENSHOT/);

    const { data: row } = await service
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();
    expect(row!.status, "a refused approval must not move the order").toBe("payment_claimed");
  });

  it("succeeds once the screenshot exists", async () => {
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientA;
    await uploadPaymentScreenshot(fileFormData({ orderId: order.id }, realImageBuffer));

    const { error } = await service.rpc("approve_order", {
      p_order_id: order.id,
      p_admin_id: admin.id,
    });
    expect(error).toBeNull();

    const { data: row } = await service
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();
    expect(row!.status).toBe("approved");
  });

  it("the admin action reports WHY, not a generic failure", async () => {
    // The panel disables Approve without a screenshot, but a second admin
    // tab can still get here. The database refusal must reach the admin as
    // a sentence they can act on.
    const order = await seedOrder(buyerA.id);
    sessionState.client = clientAdmin;

    const result = await approveOrder(order.id, admin.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("NO_PAYMENT_SCREENSHOT");
    expect(result.message).toMatch(/payment screenshot/i);
  });

  it("rejection is deliberately NOT gated", async () => {
    // An order that never got a screenshot is exactly the kind an admin
    // needs to be able to reject.
    const order = await seedOrder(buyerA.id);

    const { error } = await service.rpc("reject_order", {
      p_order_id: order.id,
      p_admin_id: admin.id,
      p_reason: "No payment received",
    });
    expect(error).toBeNull();

    const { data: row } = await service
      .from("orders")
      .select("status")
      .eq("id", order.id)
      .single();
    expect(row!.status).toBe("rejected");
  });
});
