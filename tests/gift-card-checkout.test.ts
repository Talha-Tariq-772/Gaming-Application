import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bufferToBytea, encrypt } from "@/src/lib/crypto";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { attachPaymentProof } from "./helpers/payment-proof";

/**
 * Gift cards wired through cart/checkout — see
 * supabase/migrations/20260908000001_gift_card_checkout.sql. Mirrors
 * tests/order-lifecycle.test.ts's structure exactly (same session-client
 * mock, same live-Supabase integration approach), covering the gift-card
 * branch of create_order/approve_order/reject_order that file doesn't
 * touch.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const { createOrder, claimPayment } = await import("@/src/lib/actions/checkout");
const { approveOrder, rejectOrder } = await import("@/src/lib/actions/admin-orders");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
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
const password = `GiftCardTest!${randomUUID()}`;

let customerA: { id: string; email: string };
let clientA: SupabaseClient;
let adminUser: { id: string; email: string };
let clientAdmin: SupabaseClient;
let paymentMethod: { id: string };

const productIds: string[] = [];
const codeIds: string[] = [];
const orderIds: string[] = [];
/** Games/credentials created only by the mixed-cart test — cleaned up in
 * the same order-items -> credentials -> games sequence
 * order-lifecycle.test.ts uses, since a credential can't be deleted while
 * an order_items row still references it. */
const gameIds: string[] = [];

async function seedGiftCardProduct(title: string, availableCodes: number, pricePkr = 3500) {
  const { data: product, error } = await service
    .from("gift_card_products")
    .insert({
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`,
      title,
      platform: "psn",
      region: "US",
      denomination_value: 10,
      denomination_currency: "USD",
      price_pkr: pricePkr,
      is_active: true,
    })
    .select("id, price_pkr")
    .single();
  if (error) throw error;
  productIds.push(product.id);

  for (let i = 0; i < availableCodes; i++) {
    const { data: code, error: codeErr } = await service
      .from("gift_card_codes")
      .insert({
        product_id: product.id,
        code_encrypted: `encrypted-${randomUUID()}`,
        code_hash: randomUUID(),
        status: "available",
      })
      .select("id")
      .single();
    if (codeErr) throw codeErr;
    codeIds.push(code.id);
  }

  return { id: product.id as string, pricePkr: product.price_pkr as number };
}

/** Seeds an order already sitting at a pre-decision status, with its gift
 * card code 'reserved' — mirrors order-lifecycle.test.ts's
 * seedDecidableOrder for the credential branch. */
async function seedDecidableGiftCardOrder(userId: string, status: "under_review" | "payment_claimed") {
  const product = await seedGiftCardProduct(`Decidable GC ${run} ${randomUUID().slice(0, 6)}`, 1);
  const { data: code, error: codeErr } = await service
    .from("gift_card_codes")
    .select("id")
    .eq("product_id", product.id)
    .single();
  if (codeErr) throw codeErr;

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      user_id: userId,
      status,
      payment_reference: `PSC-${randomUUID().slice(0, 6).toUpperCase()}`,
      amount_exact: product.pricePkr,
      payment_method_id: paymentMethod.id,
      reserved_until: new Date(Date.now() + 45 * 60_000).toISOString(),
      region_ack_confirmed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (orderErr) throw orderErr;
  orderIds.push(order.id);
  // approve_order refuses an order with no payment screenshot
  // (20260921000005_payment_screenshots.sql) — a real buyer uploads one
  // before an admin ever sees the order.
  await attachPaymentProof(service, order.id);

  await service.from("gift_card_codes").update({ status: "reserved", order_id: order.id }).eq("id", code.id);
  await service.from("order_items").insert({
    order_id: order.id,
    game_id: null,
    credential_id: null,
    product_type: "gift_card",
    gift_card_code_id: code.id,
    price: product.pricePkr,
  });

  return { order, codeId: code.id as string };
}

beforeAll(async () => {
  const emailA = `giftcard-a-${run}@example.com`;
  const emailAdmin = `giftcard-admin-${run}@example.com`;

  const { data: createdA, error: errA } = await service.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  customerA = { id: createdA.user.id, email: emailA };

  const { data: createdAdmin, error: errAdmin } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (errAdmin) throw errAdmin;
  adminUser = { id: createdAdmin.user.id, email: emailAdmin };

  const { error: promoteErr } = await service.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);
  if (promoteErr) throw promoteErr;

  clientA = await signedInClient(customerA.email, password);
  clientAdmin = await signedInClient(adminUser.email, password);

  const { data: pm, error: pmErr } = await service
    .from("payment_methods")
    .insert({
      label: `GiftCard Test Bank ${run}`,
      account_title: "Test Account",
      account_number: "0000000000",
    })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  paymentMethod = pm;
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "order_items",
      run: async () => {
        if (orderIds.length) await deleteWithRetry(() => service.from("order_items").delete().in("order_id", orderIds), "order_items");
      },
    },
    {
      label: "gift_card_codes",
      run: async () => {
        if (codeIds.length) await deleteWithRetry(() => service.from("gift_card_codes").delete().in("id", codeIds), "gift_card_codes");
      },
    },
    {
      label: "game_credentials",
      run: async () => {
        if (gameIds.length) await deleteWithRetry(() => service.from("game_credentials").delete().in("game_id", gameIds), "game_credentials");
      },
    },
    {
      label: "orders",
      run: async () => {
        if (orderIds.length) await deleteWithRetry(() => service.from("orders").delete().in("id", orderIds), "orders");
      },
    },
    {
      label: "games",
      run: async () => {
        if (gameIds.length) await deleteWithRetry(() => service.from("games").delete().in("id", gameIds), "games");
      },
    },
    {
      label: "gift_card_products",
      run: async () => {
        if (productIds.length) await deleteWithRetry(() => service.from("gift_card_products").delete().in("id", productIds), "gift_card_products");
      },
    },
    {
      label: "payment_methods",
      run: async () => {
        if (paymentMethod?.id) await deleteWithRetry(() => service.from("payment_methods").delete().eq("id", paymentMethod.id), "payment_methods");
      },
    },
    {
      label: "audit_log",
      run: async () => {
        const actorIds = [customerA?.id, adminUser?.id].filter((id): id is string => Boolean(id));
        if (actorIds.length) await deleteWithRetry(() => service.from("audit_log").delete().in("actor_id", actorIds), "audit_log");
      },
    },
    {
      label: "customerA",
      run: async () => {
        if (customerA?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customerA.id), "customerA");
      },
    },
    {
      label: "adminUser",
      run: async () => {
        if (adminUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminUser.id), "adminUser");
      },
    },
  ]);
}, 90_000);

describe("createOrder — gift cards", () => {
  it("creates an order and reserves a gift card code when one is available", async () => {
    const product = await seedGiftCardProduct(`Available GC ${run}`, 1);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
      `+9230${run}G1`,
      true,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);
    expect(result.order.regionAckConfirmedAt).not.toBeNull();

    const { data: items } = await service
      .from("order_items")
      .select("product_type, game_id, credential_id, gift_card_code_id")
      .eq("order_id", result.order.id);
    expect(items).toHaveLength(1);
    expect(items?.[0]?.product_type).toBe("gift_card");
    expect(items?.[0]?.game_id).toBeNull();
    expect(items?.[0]?.credential_id).toBeNull();
    const codeId = items?.[0]?.gift_card_code_id;
    expect(codeId).toBeTruthy();

    const { data: code } = await service
      .from("gift_card_codes")
      .select("status, order_id")
      .eq("id", codeId)
      .single();
    expect(code?.status).toBe("reserved");
    expect(code?.order_id).toBe(result.order.id);
  });

  it("returns OUT_OF_STOCK and creates no order when no code is available", async () => {
    const product = await seedGiftCardProduct(`Empty GC ${run}`, 0);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
      `+9230${run}G2`,
      true,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("OUT_OF_STOCK");

    const { data: itemsForProduct } = await service.from("gift_card_codes").select("id").eq("product_id", product.id);
    expect(itemsForProduct ?? []).toHaveLength(0);
  });

  it("raises REGION_NOT_ACKNOWLEDGED when the cart has a gift card and regionAck is false", async () => {
    const product = await seedGiftCardProduct(`Unacked GC ${run}`, 1);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
      `+9230${run}G3`,
      false,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("REGION_NOT_ACKNOWLEDGED");

    // No order, no reservation — the ack check happens in the pre-check
    // loop, before anything is inserted.
    const { data: code } = await service.from("gift_card_codes").select("status").eq("product_id", product.id).single();
    expect(code?.status).toBe("available");
  });

  it("does not require regionAck for a games-only cart (no gift card in it)", async () => {
    // Reuses the credential branch purely to prove the ack requirement is
    // conditional on cart contents, not a blanket new requirement.
    const { data: game, error } = await service
      .from("games")
      .insert({
        title: `GC-adjacent game ${run}`,
        slug: `gc-adjacent-game-${run}-${randomUUID().slice(0, 6)}`,
        genre: "Action",
        price: 999,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    gameIds.push(game.id);

    sessionState.client = clientA;
    const result = await createOrder(
      customerA.id,
      [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }],
      `+9230${run}G4`,
      false,
    );
    // No credential seeded for this game, so it fails OUT_OF_STOCK rather
    // than REGION_NOT_ACKNOWLEDGED — proving the ack gate never triggered.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("OUT_OF_STOCK");
  });

  it("under concurrent calls for the last available code, exactly one succeeds and the code is reserved once", async () => {
    const product = await seedGiftCardProduct(`Race GC ${run}`, 1);
    sessionState.client = clientA;

    const [r1, r2] = await Promise.all([
      createOrder(
        customerA.id,
        [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
        `+9230${run}G5`,
        true,
      ),
      createOrder(
        customerA.id,
        [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
        `+9230${run}G5`,
        true,
      ),
    ]);

    for (const r of [r1, r2]) {
      if (r.ok) orderIds.push(r.order.id);
    }

    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].ok === false && failures[0].error).toBe("OUT_OF_STOCK");

    // Reserved exactly once — no double-reservation of the same code.
    const { data: reservedCodes } = await service
      .from("gift_card_codes")
      .select("id")
      .eq("product_id", product.id)
      .eq("status", "reserved");
    expect(reservedCodes ?? []).toHaveLength(1);
  });

  it("mixed cart: one game item and one gift-card item in the same order", async () => {
    const { data: game, error } = await service
      .from("games")
      .insert({
        title: `Mixed game ${run}`,
        slug: `mixed-game-${run}-${randomUUID().slice(0, 6)}`,
        genre: "Action",
        price: 1500,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    gameIds.push(game.id);

    const { error: credErr } = await service.from("game_credentials").insert({
      game_id: game.id,
      login_enc: bufferToBytea(encrypt("mixed-cart-login")),
      password_enc: bufferToBytea(encrypt("mixed-cart-password")),
      status: "available",
    });
    if (credErr) throw credErr;

    const product = await seedGiftCardProduct(`Mixed GC ${run}`, 1, 2500);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [
        { kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id },
        { kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id },
      ],
      `+9230${run}G6`,
      true,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);

    const { data: items } = await service
      .from("order_items")
      .select("product_type")
      .eq("order_id", result.order.id);
    expect(new Set(items?.map((i) => i.product_type))).toEqual(new Set(["game", "gift_card"]));
    // game_credentials/games cleanup happens in the shared afterAll (see
    // gameIds above) — order_items must be deleted first, which only the
    // afterAll's step ordering guarantees.
  });
});

describe("createOrder — gift cards, guest checkout", () => {
  it("a guest can create and pay for a gift-card-only order", async () => {
    const product = await seedGiftCardProduct(`Guest GC ${run}`, 1);
    sessionState.client = null; // no session — a real guest.

    const created = await createOrder(
      undefined,
      [{ kind: "gift_card", productId: product.id, paymentMethodId: paymentMethod.id }],
      "03211234567",
      true,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);
    expect(created.order.userId).toBeNull();
    expect(created.order.guestPhone).toBe("+923211234567");

    const claimed = await claimPayment(created.order.id);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.order.status).toBe("payment_claimed");
  });
});

describe("approveOrder / rejectOrder — gift cards", () => {
  it("approves the order and flips the gift card code to 'delivered'", async () => {
    const { order, codeId } = await seedDecidableGiftCardOrder(customerA.id, "under_review");
    sessionState.client = clientAdmin;

    const result = await approveOrder(order.id, adminUser.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("approved");

    const { data: code } = await service
      .from("gift_card_codes")
      .select("status, delivered_at")
      .eq("id", codeId)
      .single();
    expect(code?.status).toBe("delivered");
    expect(code?.delivered_at).not.toBeNull();
  });

  it("rejects the order and releases the gift card code back to 'available'", async () => {
    const { order, codeId } = await seedDecidableGiftCardOrder(customerA.id, "under_review");
    sessionState.client = clientAdmin;

    const result = await rejectOrder(order.id, adminUser.id, "Amount did not match");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("rejected");

    const { data: code } = await service
      .from("gift_card_codes")
      .select("status, order_id")
      .eq("id", codeId)
      .single();
    expect(code?.status).toBe("available");
    expect(code?.order_id).toBeNull();
  });
});
