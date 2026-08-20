import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cleanup calls whose errors previously went unchecked leaked test rows and
// test auth users into the live project across several runs. Every cleanup
// call goes through this so a failure is loud instead of silent.
async function cleanup(
  makeRequest: () => PromiseLike<{ error: unknown }>,
  label: string,
  retries = 2,
) {
  for (let attempt = 0; ; attempt++) {
    const { error } = await makeRequest();
    if (!error) return;
    if (attempt >= retries) {
      throw new Error(`cleanup failed (${label}): ${JSON.stringify(error)}`);
    }
    // The Auth admin API occasionally returns a transient 500
    // (AuthRetryableFetchError) under bursty test load — worth one retry
    // before treating it as a real failure.
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
}

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `RlsTest!${randomUUID()}`;

let userA: { id: string; email: string };
let userB: { id: string; email: string };
let clientA: SupabaseClient;
let anon: SupabaseClient;

let game: { id: string };
let paymentMethod: { id: string };
let orderA: { id: string };
let orderB: { id: string };
let credentialForOrderA: { id: string };
let auditRow: { id: string };

beforeAll(async () => {
  anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const emailA = `rls-test-a-${run}@example.com`;
  const emailB = `rls-test-b-${run}@example.com`;

  const { data: createdA, error: errA } = await service.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  userA = { id: createdA.user.id, email: emailA };

  const { data: createdB, error: errB } = await service.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;
  userB = { id: createdB.user.id, email: emailB };

  clientA = await signedInClient(userA.email, password);

  const { data: gameRow, error: gameErr } = await service
    .from("games")
    .insert({
      title: `RLS Test Game ${run}`,
      slug: `rls-test-game-${run}`,
      price: 999,
      is_active: true,
    })
    .select("id")
    .single();
  if (gameErr) throw gameErr;
  game = gameRow;

  const { data: pmRow, error: pmErr } = await service
    .from("payment_methods")
    .insert({
      label: `RLS Test Bank ${run}`,
      account_title: "Test Account",
      account_number: "0000000000",
    })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  paymentMethod = pmRow;

  const { data: orderARow, error: orderAErr } = await service
    .from("orders")
    .insert({
      user_id: userA.id,
      status: "approved",
      payment_reference: `GK-A${run.slice(0, 4)}`,
      amount_exact: 999.42,
      payment_method_id: paymentMethod.id,
    })
    .select("id")
    .single();
  if (orderAErr) throw orderAErr;
  orderA = orderARow;

  const { data: orderBRow, error: orderBErr } = await service
    .from("orders")
    .insert({
      user_id: userB.id,
      status: "awaiting_payment",
      payment_reference: `GK-B${run.slice(0, 4)}`,
      amount_exact: 999.17,
      payment_method_id: paymentMethod.id,
    })
    .select("id")
    .single();
  if (orderBErr) throw orderBErr;
  orderB = orderBRow;

  // A credential that belongs to customer A's own, already-approved order —
  // the highest-stakes case: even the rightful owner must not be able to
  // SELECT it directly.
  const { data: credRow, error: credErr } = await service
    .from("game_credentials")
    .insert({
      game_id: game.id,
      login_enc: Buffer.from("fake-encrypted-login"),
      password_enc: Buffer.from("fake-encrypted-password"),
      status: "sold",
      order_id: orderA.id,
      sold_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (credErr) throw credErr;
  credentialForOrderA = credRow;

  await service.from("order_items").insert({
    order_id: orderA.id,
    game_id: game.id,
    credential_id: credentialForOrderA.id,
    price: 999,
  });

  const { data: auditRowData, error: auditErr } = await service
    .from("audit_log")
    .insert({
      actor_id: null,
      action: "rls_test_seed",
      target_type: "order",
      target_id: orderA.id,
    })
    .select("id")
    .single();
  if (auditErr) throw auditErr;
  auditRow = auditRowData;
});

afterAll(async () => {
  // Defensive: if beforeAll failed partway, only clean up what actually got created.
  if (orderA?.id) {
    await cleanup(() => service.from("order_items").delete().eq("order_id", orderA.id), "order_items");
  }
  if (auditRow?.id) await cleanup(() => service.from("audit_log").delete().eq("id", auditRow.id), "audit_log");
  if (game?.id) {
    await cleanup(() => service.from("game_credentials").delete().eq("game_id", game.id), "game_credentials");
  }
  const orderIds = [orderA?.id, orderB?.id].filter((id): id is string => Boolean(id));
  if (orderIds.length) await cleanup(() => service.from("orders").delete().in("id", orderIds), "orders");
  if (game?.id) await cleanup(() => service.from("games").delete().eq("id", game.id), "games");
  if (paymentMethod?.id) {
    await cleanup(
      () => service.from("payment_methods").delete().eq("id", paymentMethod.id),
      "payment_methods",
    );
  }
  if (userA?.id) await cleanup(() => service.auth.admin.deleteUser(userA.id), "userA");
  if (userB?.id) await cleanup(() => service.auth.admin.deleteUser(userB.id), "userB");
});

describe("RLS sanity controls (positive cases — proves denials below aren't just broken access entirely)", () => {
  it("customer A CAN select their own order", async () => {
    const { data, error } = await clientA.from("orders").select("id").eq("id", orderA.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("customer A CAN select their own order_items", async () => {
    const { data, error } = await clientA.from("order_items").select("id").eq("order_id", orderA.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("RLS denials — each of these must genuinely fail at the database level", () => {
  it("customer A selecting customer B's orders returns nothing", async () => {
    const { data, error } = await clientA.from("orders").select("*").eq("id", orderB.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("customer A selecting anything from game_credentials returns nothing, including their own order's credential", async () => {
    const broad = await clientA.from("game_credentials").select("*");
    expect(broad.data ?? []).toHaveLength(0);

    const specific = await clientA
      .from("game_credentials")
      .select("*")
      .eq("id", credentialForOrderA.id);
    expect(specific.data ?? []).toHaveLength(0);
    // Whichever way Postgres reports it (permission error vs RLS-filtered
    // empty set), no row and no plaintext must come back.
    expect(specific.data === null || specific.data.length === 0).toBe(true);
  });

  it("customer A updating their own order's status directly does not change it", async () => {
    await clientA.from("orders").update({ status: "approved" }).eq("id", orderB.id);
    await clientA.from("orders").update({ status: "rejected" }).eq("id", orderA.id);

    const { data: recheck } = await service
      .from("orders")
      .select("status")
      .eq("id", orderA.id)
      .single();
    expect(recheck?.status).toBe("approved"); // unchanged from seed
  });

  it("customer A updating their own profile role is blocked by the trigger", async () => {
    const { error } = await clientA.from("profiles").update({ role: "admin" }).eq("id", userA.id);
    expect(error).not.toBeNull();

    const { data: recheck } = await service
      .from("profiles")
      .select("role")
      .eq("id", userA.id)
      .single();
    expect(recheck?.role).toBe("customer");
  });

  it("customer A updating someone else's profile role does not change it", async () => {
    await clientA.from("profiles").update({ role: "admin" }).eq("id", userB.id);

    const { data: recheck } = await service
      .from("profiles")
      .select("role")
      .eq("id", userB.id)
      .single();
    expect(recheck?.role).toBe("customer");
  });

  it("anon client selecting from orders returns nothing", async () => {
    // anon has no grant on orders at all (only `authenticated` does), so this
    // denies one layer earlier than RLS: a hard permission error rather than
    // an RLS-filtered empty set. Either shape counts as "genuinely fails".
    const { data } = await anon.from("orders").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("anon client selecting from game_credentials returns nothing", async () => {
    const { data } = await anon.from("game_credentials").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("customer A inserting a row into order_items directly is rejected", async () => {
    const { error } = await clientA.from("order_items").insert({
      order_id: orderA.id,
      game_id: game.id,
      price: 1,
    });
    expect(error).not.toBeNull();

    const { data: recheck } = await service
      .from("order_items")
      .select("id")
      .eq("order_id", orderA.id);
    expect(recheck).toHaveLength(1); // still just the one seeded row
  });

  it("customer A updating audit_log does not change it", async () => {
    await clientA.from("audit_log").update({ action: "tampered" }).eq("id", auditRow.id);

    const { data: recheck } = await service
      .from("audit_log")
      .select("action")
      .eq("id", auditRow.id)
      .single();
    expect(recheck?.action).toBe("rls_test_seed");
  });
});

describe("reserve_credential inventory logic", () => {
  it("returns null when no credential is available for a game", async () => {
    const { data: emptyGame, error: emptyGameErr } = await service
      .from("games")
      .insert({
        title: `RLS Test Empty Game ${run}`,
        slug: `rls-test-empty-game-${run}`,
        price: 500,
        is_active: true,
      })
      .select("id")
      .single();
    if (emptyGameErr) throw emptyGameErr;

    const { data: fakeOrder, error: fakeOrderErr } = await service
      .from("orders")
      .insert({
        user_id: userA.id,
        status: "awaiting_payment",
        payment_reference: `GK-E${run.slice(0, 4)}`,
        amount_exact: 500.5,
      })
      .select("id")
      .single();
    if (fakeOrderErr) throw fakeOrderErr;

    const { data: reserved, error } = await service.rpc("reserve_credential", {
      p_game_id: emptyGame.id,
      p_order_id: fakeOrder.id,
    });
    expect(error).toBeNull();
    expect(reserved).toBeNull();

    await cleanup(() => service.from("orders").delete().eq("id", fakeOrder.id), "fakeOrder");
    await cleanup(() => service.from("games").delete().eq("id", emptyGame.id), "emptyGame");
  });

  it("under concurrent calls for the same game with one credential, exactly one succeeds and one gets null", async () => {
    const { data: raceGame, error: raceGameErr } = await service
      .from("games")
      .insert({
        title: `RLS Test Race Game ${run}`,
        slug: `rls-test-race-game-${run}`,
        price: 750,
        is_active: true,
      })
      .select("id")
      .single();
    if (raceGameErr) throw raceGameErr;

    const { data: raceCred, error: raceCredErr } = await service
      .from("game_credentials")
      .insert({
        game_id: raceGame.id,
        login_enc: Buffer.from("race-login"),
        password_enc: Buffer.from("race-password"),
        status: "available",
      })
      .select("id")
      .single();
    if (raceCredErr) throw raceCredErr;

    const { data: raceOrder1, error: raceOrder1Err } = await service
      .from("orders")
      .insert({
        user_id: userA.id,
        status: "awaiting_payment",
        payment_reference: `GK-R1${run.slice(0, 3)}`,
        amount_exact: 750.11,
      })
      .select("id")
      .single();
    if (raceOrder1Err) throw raceOrder1Err;

    const { data: raceOrder2, error: raceOrder2Err } = await service
      .from("orders")
      .insert({
        user_id: userB.id,
        status: "awaiting_payment",
        payment_reference: `GK-R2${run.slice(0, 3)}`,
        amount_exact: 750.22,
      })
      .select("id")
      .single();
    if (raceOrder2Err) throw raceOrder2Err;

    const [res1, res2] = await Promise.all([
      service.rpc("reserve_credential", { p_game_id: raceGame.id, p_order_id: raceOrder1.id }),
      service.rpc("reserve_credential", { p_game_id: raceGame.id, p_order_id: raceOrder2.id }),
    ]);

    expect(res1.error).toBeNull();
    expect(res2.error).toBeNull();

    const results = [res1.data, res2.data];
    const successes = results.filter((r) => r !== null);
    const nulls = results.filter((r) => r === null);

    expect(successes).toHaveLength(1);
    expect(nulls).toHaveLength(1);
    expect(successes[0]).toBe(raceCred.id);

    // game_credentials.order_id -> orders(id) has no ON DELETE CASCADE, and
    // the winning reservation left raceCred pointing at whichever order won
    // — it must go before the orders it references, not after.
    await cleanup(() => service.from("game_credentials").delete().eq("id", raceCred.id), "raceCred");
    await cleanup(
      () => service.from("orders").delete().in("id", [raceOrder1.id, raceOrder2.id]),
      "raceOrders",
    );
    await cleanup(() => service.from("games").delete().eq("id", raceGame.id), "raceGame");
  });
});
