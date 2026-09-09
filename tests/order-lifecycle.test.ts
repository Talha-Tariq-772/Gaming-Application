import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bufferToBytea, encrypt } from "@/src/lib/crypto";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/**
 * These server actions internally call next/headers (cookies()/headers()),
 * which only works inside a real Next.js request context — not a bare
 * vitest process. Rather than change the actions' exported signatures,
 * @/src/lib/supabase/server-session is mocked so requireUser/requireAdmin
 * receive a real, already-signed-in Supabase client of our choosing
 * (sessionState.client, settable per test) instead of trying to read
 * cookies that don't exist here. next/headers itself is mocked too, since
 * revealCredential's IP lookup calls headers() directly.
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
const { revealCredential } = await import("@/src/lib/actions/credentials");
const { getOrdersForAdmin, getOrdersForUser } = await import("@/src/lib/order-queries");

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
const password = `LifecycleTest!${randomUUID()}`;

let customerA: { id: string; email: string };
let customerB: { id: string; email: string };
let adminUser: { id: string; email: string };
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientAdmin: SupabaseClient;
let paymentMethod: { id: string };

const gameIds: string[] = [];
const orderIds: string[] = [];

async function seedGame(title: string, availableCredentials: number, price = 999) {
  const { data: game, error } = await service
    .from("games")
    .insert({
      title,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`,
      price,
      is_active: true,
    })
    .select("id, price")
    .single();
  if (error) throw error;
  gameIds.push(game.id);

  for (let i = 0; i < availableCredentials; i++) {
    const { error: credErr } = await service.from("game_credentials").insert({
      game_id: game.id,
      login_enc: bufferToBytea(encrypt(`login-${i}-${game.id}`)),
      password_enc: bufferToBytea(encrypt(`password-${i}-${game.id}`)),
      status: "available",
    });
    if (credErr) throw credErr;
  }

  return game as { id: string; price: number };
}

/** Seeds an order already sitting at a pre-decision status, with its credential 'reserved'. */
async function seedDecidableOrder(userId: string, status: "under_review" | "payment_claimed") {
  const game = await seedGame(`Decidable ${run} ${randomUUID().slice(0, 6)}`, 1);
  const { data: cred, error: credErr } = await service
    .from("game_credentials")
    .select("id")
    .eq("game_id", game.id)
    .single();
  if (credErr) throw credErr;

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      user_id: userId,
      status,
      payment_reference: `GK-${randomUUID().slice(0, 4)}`,
      amount_exact: game.price,
      payment_method_id: paymentMethod.id,
      reserved_until: new Date(Date.now() + 45 * 60_000).toISOString(),
    })
    .select("*")
    .single();
  if (orderErr) throw orderErr;
  orderIds.push(order.id);

  await service.from("game_credentials").update({ status: "reserved", order_id: order.id }).eq("id", cred.id);
  await service.from("order_items").insert({
    order_id: order.id,
    game_id: game.id,
    credential_id: cred.id,
    price: game.price,
  });

  return { order, credentialId: cred.id as string };
}

/** Seeds an approved order with a known-plaintext, already-sold credential. */
async function seedApprovedOrder(userId: string, loginPlain: string, passwordPlain: string) {
  const game = await seedGame(`Approved ${run} ${randomUUID().slice(0, 6)}`, 0);
  const { data: cred, error: credErr } = await service
    .from("game_credentials")
    .insert({
      game_id: game.id,
      login_enc: bufferToBytea(encrypt(loginPlain)),
      password_enc: bufferToBytea(encrypt(passwordPlain)),
      status: "sold",
      sold_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (credErr) throw credErr;

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      user_id: userId,
      status: "approved",
      payment_reference: `GK-${randomUUID().slice(0, 4)}`,
      amount_exact: game.price,
      payment_method_id: paymentMethod.id,
      reviewed_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (orderErr) throw orderErr;
  orderIds.push(order.id);

  await service.from("order_items").insert({
    order_id: order.id,
    game_id: game.id,
    credential_id: cred.id,
    price: game.price,
  });

  return { order, credentialId: cred.id as string };
}

beforeAll(async () => {
  const emailA = `lifecycle-a-${run}@example.com`;
  const emailB = `lifecycle-b-${run}@example.com`;
  const emailAdmin = `lifecycle-admin-${run}@example.com`;

  const { data: createdA, error: errA } = await service.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  customerA = { id: createdA.user.id, email: emailA };

  const { data: createdB, error: errB } = await service.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;
  customerB = { id: createdB.user.id, email: emailB };

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
  clientB = await signedInClient(customerB.email, password);
  clientAdmin = await signedInClient(adminUser.email, password);

  const { data: pm, error: pmErr } = await service
    .from("payment_methods")
    .insert({
      label: `Lifecycle Test Bank ${run}`,
      account_title: "Test Account",
      account_number: "0000000000",
    })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  paymentMethod = pm;
});

// audit_log.actor_id -> profiles(id) has no ON DELETE CASCADE. approveOrder/
// rejectOrder/revealCredential all write rows with actor_id set to one of
// these test users, which would otherwise block their profile's cascade
// delete from auth.users (surfaced generically as "Database error deleting
// user", not an FK error) — must go before deleting the users themselves.
// See tests/helpers/cleanup.ts for why each step below runs independently
// instead of as one linear await chain.
afterAll(async () => {
  await runCleanupSteps([
    {
      label: "order_items",
      run: async () => {
        if (orderIds.length) await deleteWithRetry(() => service.from("order_items").delete().in("order_id", orderIds), "order_items");
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
      label: "payment_methods",
      run: async () => {
        if (paymentMethod?.id) await deleteWithRetry(() => service.from("payment_methods").delete().eq("id", paymentMethod.id), "payment_methods");
      },
    },
    {
      label: "audit_log",
      run: async () => {
        const actorIds = [customerA?.id, customerB?.id, adminUser?.id].filter((id): id is string => Boolean(id));
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
      label: "customerB",
      run: async () => {
        if (customerB?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customerB.id), "customerB");
      },
    },
    {
      label: "adminUser",
      run: async () => {
        if (adminUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminUser.id), "adminUser");
      },
    },
  ]);
}, 90_000); // 9 independent steps, each capped at 8s worst case (see tests/helpers/cleanup.ts)

describe("createOrder", () => {
  it("creates an order and reserves a credential when one is available", async () => {
    const game = await seedGame(`Available ${run}`, 1);
    sessionState.client = clientA;

    const result = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A1`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);

    expect(result.order.userId).toBe(customerA.id);
    expect(result.order.status).toBe("awaiting_payment");
    expect(result.order.reservedUntil).not.toBeNull();

    const { data: items } = await service.from("order_items").select("credential_id").eq("order_id", result.order.id);
    expect(items).toHaveLength(1);
    const credentialId = items?.[0]?.credential_id;
    expect(credentialId).toBeTruthy();

    const { data: credential } = await service
      .from("game_credentials")
      .select("status, order_id")
      .eq("id", credentialId)
      .single();
    expect(credential?.status).toBe("reserved");
    expect(credential?.order_id).toBe(result.order.id);
  });

  it("returns OUT_OF_STOCK and creates no order when no credential is available", async () => {
    const game = await seedGame(`Empty ${run}`, 0);
    sessionState.client = clientA;

    const result = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A2`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("OUT_OF_STOCK");

    const { data: orders } = await service.from("orders").select("id").eq("payment_method_id", paymentMethod.id);
    const leaked = (orders ?? []).some((o) => !orderIds.includes(o.id) && o.id !== undefined);
    // No order row should exist referencing this empty game at all.
    const { data: itemsForGame } = await service.from("order_items").select("id").eq("game_id", game.id);
    expect(itemsForGame ?? []).toHaveLength(0);
    expect(leaked).toBe(false);
  });

  it("throws when the caller's session doesn't match the given userId", async () => {
    const game = await seedGame(`Spoof ${run}`, 1);
    sessionState.client = clientB; // real session is B, but claiming to be A
    await expect(createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A3`)).rejects.toThrow();
  });

  it("under concurrent calls for the same low-stock game, exactly one succeeds and the other is OUT_OF_STOCK", async () => {
    const game = await seedGame(`Race ${run}`, 1);
    sessionState.client = clientA;

    const [r1, r2] = await Promise.all([
      createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A4`),
      createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A4`),
    ]);

    for (const r of [r1, r2]) {
      if (r.ok) orderIds.push(r.order.id);
    }

    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].ok === false && failures[0].error).toBe("OUT_OF_STOCK");
  });

  it("multi-item cart: creates one order with one order_items row per game and the correctly summed amount", async () => {
    const gameA = await seedGame(`Multi A ${run}`, 1, 1500);
    const gameB = await seedGame(`Multi B ${run}`, 1, 2500);
    const gameC = await seedGame(`Multi C ${run}`, 1, 999);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [
        { kind: "credential", gameId: gameA.id, paymentMethodId: paymentMethod.id },
        { kind: "credential", gameId: gameB.id, paymentMethodId: paymentMethod.id },
        { kind: "credential", gameId: gameC.id, paymentMethodId: paymentMethod.id },
      ],
      `+9230${run}A7`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);

    expect(result.order.userId).toBe(customerA.id);
    expect(result.order.status).toBe("awaiting_payment");
    // amount_exact = sum of item prices (4999) plus a random 0.01-0.99 offset.
    expect(result.order.amountExact).toBeGreaterThan(4999);
    expect(result.order.amountExact).toBeLessThan(5000);

    const { data: items } = await service
      .from("order_items")
      .select("game_id, credential_id, price")
      .eq("order_id", result.order.id);
    expect(items).toHaveLength(3);
    expect(new Set(items?.map((i) => i.game_id))).toEqual(new Set([gameA.id, gameB.id, gameC.id]));

    for (const item of items ?? []) {
      const { data: credential } = await service
        .from("game_credentials")
        .select("status, order_id")
        .eq("id", item.credential_id)
        .single();
      expect(credential?.status).toBe("reserved");
      expect(credential?.order_id).toBe(result.order.id);
    }
  });

  it("multi-item cart: one item out of stock fails the whole order and releases the other items' reservations", async () => {
    const gameA = await seedGame(`PartialFail A ${run}`, 1, 1200);
    const gameB = await seedGame(`PartialFail B ${run}`, 0, 800); // no stock
    const gameC = await seedGame(`PartialFail C ${run}`, 1, 1600);
    sessionState.client = clientA;

    const result = await createOrder(
      customerA.id,
      [
        { kind: "credential", gameId: gameA.id, paymentMethodId: paymentMethod.id },
        { kind: "credential", gameId: gameB.id, paymentMethodId: paymentMethod.id },
        { kind: "credential", gameId: gameC.id, paymentMethodId: paymentMethod.id },
      ],
      `+9230${run}A8`,
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      orderIds.push(result.order.id); // shouldn't happen, but keep cleanup honest if it does
      return;
    }
    expect(result.error).toBe("OUT_OF_STOCK");
    expect(result.gameId).toBe(gameB.id);

    // No order_items row for any of the three games — not a partial order,
    // just nothing at all.
    const { data: itemsA } = await service.from("order_items").select("id").eq("game_id", gameA.id);
    const { data: itemsC } = await service.from("order_items").select("id").eq("game_id", gameC.id);
    expect(itemsA ?? []).toHaveLength(0);
    expect(itemsC ?? []).toHaveLength(0);

    // gameA and gameC's credentials were reserved earlier in the same
    // transaction, then rolled back — they must be back to 'available',
    // not stuck 'reserved' with no owning order.
    const { data: credA } = await service.from("game_credentials").select("status, order_id").eq("game_id", gameA.id).single();
    const { data: credC } = await service.from("game_credentials").select("status, order_id").eq("game_id", gameC.id).single();
    expect(credA?.status).toBe("available");
    expect(credA?.order_id).toBeNull();
    expect(credC?.status).toBe("available");
    expect(credC?.order_id).toBeNull();
  });
});

describe("createOrder — guest checkout", () => {
  it("creates an order with no session at all and a unique PSC- reference", async () => {
    const game = await seedGame(`Guest ${run}`, 1);
    sessionState.client = null; // no session — if any code path secretly needs one, this throws loudly.

    const result = await createOrder(undefined, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], "03001234567");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);

    expect(result.order.userId).toBeNull();
    expect(result.order.guestPhone).toBe("+923001234567");
    expect(result.order.paymentReference).toMatch(/^PSC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("rejects an invalid guest phone number before creating anything", async () => {
    const game = await seedGame(`GuestBadPhone ${run}`, 1);
    sessionState.client = null;

    const result = await createOrder(undefined, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], "not-a-phone");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("INVALID_PHONE");

    const { data: itemsForGame } = await service.from("order_items").select("id").eq("game_id", game.id);
    expect(itemsForGame ?? []).toHaveLength(0);
  });

  it("a guest can mark their own order paid with no session (claimPayment)", async () => {
    const game = await seedGame(`GuestClaim ${run}`, 1);
    sessionState.client = null;

    const created = await createOrder(undefined, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], "03211234567");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);

    const result = await claimPayment(created.order.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("payment_claimed");
  });

  it("signed-in checkout still attaches user_id and still enforces requireUser — a mismatched session throws", async () => {
    const game = await seedGame(`SignedInStillGuarded ${run}`, 1);
    sessionState.client = clientA;

    const own = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}SG`);
    expect(own.ok).toBe(true);
    if (!own.ok) return;
    orderIds.push(own.order.id);
    expect(own.order.userId).toBe(customerA.id);
    expect(own.order.guestPhone).toBeNull();

    const game2 = await seedGame(`SignedInSpoof ${run}`, 1);
    sessionState.client = clientB; // real session is B, but claiming to be A
    await expect(
      createOrder(customerA.id, [{ kind: "credential", gameId: game2.id, paymentMethodId: paymentMethod.id }], `+9230${run}SP`),
    ).rejects.toThrow();
  });
});

describe("payment reference generation", () => {
  it("produces PSC- references from the unambiguous alphabet (no 0/O/1/I/L)", async () => {
    const game = await seedGame(`RefFormat ${run}`, 1);
    sessionState.client = clientA;

    const result = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}RF`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    orderIds.push(result.order.id);
    expect(result.order.paymentReference).toMatch(/^PSC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });

  it("two concurrent orders never collide on payment_reference", async () => {
    const gameA = await seedGame(`RaceRefA ${run}`, 1);
    const gameB = await seedGame(`RaceRefB ${run}`, 1);
    sessionState.client = clientA;

    const [r1, r2] = await Promise.all([
      createOrder(customerA.id, [{ kind: "credential", gameId: gameA.id, paymentMethodId: paymentMethod.id }], `+9230${run}R1`),
      createOrder(customerA.id, [{ kind: "credential", gameId: gameB.id, paymentMethodId: paymentMethod.id }], `+9230${run}R2`),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok) orderIds.push(r1.order.id);
    if (r2.ok) orderIds.push(r2.order.id);
    if (r1.ok && r2.ok) {
      expect(r1.order.paymentReference).not.toBe(r2.order.paymentReference);
    }
  });

  it("a closed (approved) order's reference can't be reused — the uniqueness check spans every status, not just open orders", async () => {
    const game = await seedGame(`RefClosed ${run}`, 1);
    sessionState.client = clientA;

    const created = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}RC`);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);

    // Close it out, same as approve_order/reject_order would.
    await service.from("orders").update({ status: "approved" }).eq("id", created.order.id);

    // A brand-new row reusing that exact reference must fail at the
    // database level — proves payment_reference's global UNIQUE
    // constraint isn't scoped to "still open" orders, which is exactly
    // what generate_unique_payment_reference()'s collision check must
    // respect (the previous version didn't — see 20260907000001).
    const { error: dupError } = await service.from("orders").insert({
      user_id: customerA.id,
      status: "awaiting_payment",
      payment_reference: created.order.paymentReference,
      amount_exact: 500,
      payment_method_id: paymentMethod.id,
    });
    expect(dupError).not.toBeNull();

    // And the real generator, called again with that closed reference
    // still sitting in the table, keeps working — no error, no
    // repeated value.
    const { data: freshRef, error: rpcError } = await service.rpc("generate_unique_payment_reference");
    expect(rpcError).toBeNull();
    expect(freshRef).not.toBe(created.order.paymentReference);
    expect(freshRef).toMatch(/^PSC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  });
});

describe("claimPayment", () => {
  it("marks an awaiting_payment order as payment_claimed for its owner", async () => {
    const game = await seedGame(`Claimable ${run}`, 1);
    sessionState.client = clientA;
    const created = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A5`);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);

    const result = await claimPayment(created.order.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("payment_claimed");
    expect(result.order.claimedAt).not.toBeNull();
    expect(result.order.refundPolicyConsentedAt).not.toBeNull();
  });

  it("fails to claim someone else's order", async () => {
    const game = await seedGame(`Claim Other ${run}`, 1);
    sessionState.client = clientA;
    const created = await createOrder(customerA.id, [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }], `+9230${run}A6`);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);

    sessionState.client = clientB;
    const result = await claimPayment(created.order.id);
    expect(result.ok).toBe(false);

    const { data: recheck } = await service.from("orders").select("status").eq("id", created.order.id).single();
    expect(recheck?.status).toBe("awaiting_payment");
  });
});

describe("approveOrder", () => {
  it("approves the order, sells the credential, and writes an audit log entry", async () => {
    const { order, credentialId } = await seedDecidableOrder(customerA.id, "under_review");
    sessionState.client = clientAdmin;

    const result = await approveOrder(order.id, adminUser.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("approved");
    expect(result.order.reviewedAt).not.toBeNull();

    const { data: credential } = await service
      .from("game_credentials")
      .select("status, sold_at")
      .eq("id", credentialId)
      .single();
    expect(credential?.status).toBe("sold");
    expect(credential?.sold_at).not.toBeNull();

    const { data: auditRows } = await service
      .from("audit_log")
      .select("action, actor_id, target_id")
      .eq("target_id", order.id)
      .eq("action", "order_approved");
    expect(auditRows).toHaveLength(1);
    expect(auditRows?.[0]?.actor_id).toBe(adminUser.id);
  });

  it("also approves from payment_claimed (auto-hops through under_review server-side)", async () => {
    const { order } = await seedDecidableOrder(customerA.id, "payment_claimed");
    sessionState.client = clientAdmin;

    const result = await approveOrder(order.id, adminUser.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("approved");
  });

  it("rejects a non-admin caller", async () => {
    const { order } = await seedDecidableOrder(customerA.id, "under_review");
    sessionState.client = clientA; // customer, not admin

    await expect(approveOrder(order.id, customerA.id)).rejects.toThrow();

    const { data: recheck } = await service.from("orders").select("status").eq("id", order.id).single();
    expect(recheck?.status).toBe("under_review");
  });
});

describe("rejectOrder", () => {
  it("rejects the order, releases the credential back to the pool, and writes an audit log entry", async () => {
    const { order, credentialId } = await seedDecidableOrder(customerA.id, "under_review");
    sessionState.client = clientAdmin;

    const result = await rejectOrder(order.id, adminUser.id, "Amount did not match");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("rejected");
    expect(result.order.rejectionReason).toBe("Amount did not match");

    const { data: credential } = await service
      .from("game_credentials")
      .select("status, order_id, reserved_until")
      .eq("id", credentialId)
      .single();
    expect(credential?.status).toBe("available");
    expect(credential?.order_id).toBeNull();
    expect(credential?.reserved_until).toBeNull();

    const { data: auditRows } = await service
      .from("audit_log")
      .select("action")
      .eq("target_id", order.id)
      .eq("action", "order_rejected");
    expect(auditRows).toHaveLength(1);
  });
});

describe("revealCredential", () => {
  it("decrypts and returns the real login/password for the order's owner", async () => {
    const { order } = await seedApprovedOrder(customerA.id, "player.reveal@novagames.dev", "Rev3al#Secret1");
    sessionState.client = clientA;

    const result = await revealCredential(order.id, customerA.id, "203.0.113.5");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.login).toBe("player.reveal@novagames.dev");
    expect(result.password).toBe("Rev3al#Secret1");
    expect(result.revealedAt).toBeTruthy();
  });

  it("is idempotent: a second reveal returns the same revealedAt and the same values", async () => {
    const { order } = await seedApprovedOrder(customerA.id, "player.idempotent@novagames.dev", "Idem#Secret2");
    sessionState.client = clientA;

    const first = await revealCredential(order.id, customerA.id, "203.0.113.5");
    const second = await revealCredential(order.id, customerA.id, "203.0.113.6");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.revealedAt).toBe(first.revealedAt);
    expect(second.login).toBe(first.login);
    expect(second.password).toBe(first.password);

    const { data: auditRows } = await service
      .from("audit_log")
      .select("id")
      .eq("target_id", order.id)
      .eq("action", "credential_revealed");
    expect(auditRows).toHaveLength(2); // logged on every view, not just the first
  });

  it("fails for a non-owner even with a legitimate session of their own", async () => {
    const { order } = await seedApprovedOrder(customerA.id, "player.notyours@novagames.dev", "NotYours#3");
    sessionState.client = clientB;

    const result = await revealCredential(order.id, customerB.id, "203.0.113.7");
    expect(result.ok).toBe(false);
  });

  it("throws if the session doesn't match the claimed userId (spoofing attempt)", async () => {
    const { order } = await seedApprovedOrder(customerA.id, "player.spoof@novagames.dev", "Spoof#4");
    sessionState.client = clientB; // real session is B

    await expect(revealCredential(order.id, customerA.id, "203.0.113.8")).rejects.toThrow();
  });

  it("fails for an order that isn't approved yet", async () => {
    const { order } = await seedDecidableOrder(customerA.id, "under_review");
    sessionState.client = clientA;

    const result = await revealCredential(order.id, customerA.id, "203.0.113.9");
    expect(result.ok).toBe(false);
  });
});

describe("end to end: storefront order -> admin queue -> approve -> customer sees it", () => {
  it("a real order created via createOrder shows up for admin, and the customer sees the approval afterward", async () => {
    const game = await seedGame(`E2E ${run}`, 1, 3200);

    // 1. Customer checks out from the storefront.
    sessionState.client = clientA;
    const created = await createOrder(
      customerA.id,
      [{ kind: "credential", gameId: game.id, paymentMethodId: paymentMethod.id }],
      `+9230${run}E1`,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    orderIds.push(created.order.id);

    const claimed = await claimPayment(created.order.id);
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.order.status).toBe("payment_claimed");

    // 2. Admin's real query (no status filter — "all statuses") sees it.
    sessionState.client = clientAdmin;
    const adminView = await getOrdersForAdmin();
    const foundByAdmin = adminView.orders.find((o) => o.id === created.order.id);
    expect(foundByAdmin).toBeTruthy();
    expect(foundByAdmin?.status).toBe("payment_claimed");
    expect(foundByAdmin?.amountExact).toBe(claimed.order.amountExact);

    // 3. Admin approves it.
    const approved = await approveOrder(created.order.id, adminUser.id);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.order.status).toBe("approved");

    // 4. The credential actually flips to sold.
    const { data: items } = await service.from("order_items").select("credential_id").eq("order_id", created.order.id);
    const credentialId = items?.[0]?.credential_id;
    const { data: credential } = await service
      .from("game_credentials")
      .select("status, sold_at")
      .eq("id", credentialId)
      .single();
    expect(credential?.status).toBe("sold");
    expect(credential?.sold_at).not.toBeNull();

    // 5. The customer's own real query shows the approval.
    sessionState.client = clientA;
    const customerView = await getOrdersForUser(customerA.id);
    const foundByCustomer = customerView.orders.find((o) => o.id === created.order.id);
    expect(foundByCustomer?.status).toBe("approved");
  });
});
