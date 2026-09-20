import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { setGameCostPrice, setVariantCostPrice } = await import(
  "@/src/lib/actions/admin-cost-price"
);
const { sumProfit } = await import("@/src/lib/cost-price");

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
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `CostPriceTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let game: { id: string };
let variant: { id: string };
let paymentMethodId: string;
const orderIds: string[] = [];
/** Profit assertions need a product nothing else in this file has sold,
 * otherwise earlier tests' approved orders land in the same time window
 * and inflate the totals. Each such test makes its own. */
const extraGameIds: string[] = [];

async function makeIsolatedGame(costPrice: number | null): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const { data, error } = await service
    .from("games")
    .insert({
      title: `Cost Iso ${suffix}`,
      slug: `cost-iso-${suffix}`,
      genre: "Action",
      price: 1000,
      is_active: true,
      cost_price: costPrice,
    })
    .select("id")
    .single();
  if (error) throw error;
  extraGameIds.push(data.id);
  return data.id;
}

beforeAll(async () => {
  const emailAdmin = `cost-admin-${run}@example.com`;
  const emailCustomer = `cost-customer-${run}@example.com`;

  const { data: a, error: aErr } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (aErr) throw aErr;
  admin = { id: a.user.id, email: emailAdmin };
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: c, error: cErr } = await service.auth.admin.createUser({
    email: emailCustomer,
    password,
    email_confirm: true,
  });
  if (cErr) throw cErr;
  customer = { id: c.user.id, email: emailCustomer };

  const { data: g, error: gErr } = await service
    .from("games")
    .insert({ title: `Cost Test Game ${run}`, slug: `cost-test-game-${run}`, genre: "Action", price: 1000, is_active: true })
    .select("id")
    .single();
  if (gErr) throw gErr;
  game = g;

  const { data: v, error: vErr } = await service
    .from("game_variants")
    .insert({ game_id: game.id, label: `Standard ${run}`, price_pkr: 1000, is_active: true })
    .select("id")
    .single();
  if (vErr) throw vErr;
  variant = v;

  const { data: pm } = await service.from("payment_methods").select("id").limit(1).single();
  paymentMethodId = pm!.id;

  sessionState.client = await signedInClient(admin.email, password);
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "orders",
      run: async () => {
        if (orderIds.length) {
          // order_items cascade on order delete (order_items_order_id_fkey).
          await deleteWithRetry(() => service.from("orders").delete().in("id", orderIds), "orders");
        }
      },
    },
    {
      label: "cost history",
      run: async () => {
        await deleteWithRetry(
          () => service.from("cost_price_history").delete().eq("game_id", game?.id ?? randomUUID()),
          "history by game",
        );
        await deleteWithRetry(
          () => service.from("cost_price_history").delete().eq("variant_id", variant?.id ?? randomUUID()),
          "history by variant",
        );
      },
    },
    {
      label: "game",
      run: async () => {
        if (game?.id) await deleteWithRetry(() => service.from("games").delete().eq("id", game.id), "game");
      },
    },
    {
      label: "isolated games",
      run: async () => {
        if (extraGameIds.length) {
          await deleteWithRetry(
            () => service.from("games").delete().in("id", extraGameIds),
            "isolated games",
          );
        }
      },
    },
    {
      // approve_order writes an audit_log row per approval with
      // actor_id = this admin. audit_log.actor_id is a blocking FK
      // (no ON DELETE action), so these must go before the user does or
      // the delete fails with "Database error deleting user".
      label: "audit log",
      run: async () => {
        if (admin?.id) {
          await deleteWithRetry(
            () => service.from("audit_log").delete().eq("actor_id", admin.id),
            "audit log",
          );
        }
      },
    },
    {
      label: "admin",
      run: async () => {
        if (admin?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(admin.id), "admin");
      },
    },
    {
      label: "customer",
      run: async () => {
        if (customer?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
      },
    },
  // 7 steps; this suite deletes an admin who authored audit_log rows and
  // cost history, which is slower than the 8s default allows.
  ], 20_000);
}, 160_000);

/** Creates an approved-ready order with one line, returns its id. */
async function createOrderWithItem(price: number, gameId?: string): Promise<string> {
  const { data: order, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id,
      status: "under_review",
      payment_reference: `COST-${randomUUID().slice(0, 12)}`,
      amount_exact: price,
      payment_method_id: paymentMethodId,
      reserved_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  orderIds.push(order.id);

  const { error: itemErr } = await service
    .from("order_items")
    .insert({ order_id: order.id, game_id: gameId ?? game.id, price });
  if (itemErr) throw itemErr;

  return order.id;
}

describe("cost price is hidden from the public API", () => {
  it("anon cannot select cost_price from games, and `select *` fails closed", async () => {
    await setGameCostPrice(game.id, 400);

    const explicit = await anon.from("games").select("cost_price").eq("id", game.id);
    expect(explicit.error).not.toBeNull();

    // The real regression guard: a future `select("*")` as anon must ERROR
    // rather than quietly returning the cost column.
    const star = await anon.from("games").select("*").eq("id", game.id);
    expect(star.error).not.toBeNull();

    // The public column list still works — this is what catalog.ts sends.
    const safe = await anon.from("games").select("id, title, price").eq("id", game.id).maybeSingle();
    expect(safe.error).toBeNull();
    expect(safe.data?.id).toBe(game.id);
    expect(safe.data).not.toHaveProperty("cost_price");
  });

  it("anon cannot select cost_price from game_variants", async () => {
    await setVariantCostPrice(variant.id, 350);

    const explicit = await anon.from("game_variants").select("cost_price").eq("id", variant.id);
    expect(explicit.error).not.toBeNull();

    const safe = await anon
      .from("game_variants")
      .select("id, label, price_pkr")
      .eq("id", variant.id)
      .maybeSingle();
    expect(safe.error).toBeNull();
    expect(safe.data).not.toHaveProperty("cost_price");
  });

  it("anon cannot read cost_price_history at all", async () => {
    const result = await anon.from("cost_price_history").select("*").limit(1);
    expect(result.error).not.toBeNull();
  });

  it("a signed-in customer cannot read cost_price on their own order's items", async () => {
    const orderId = await createOrderWithItem(1000);
    const customerClient = await signedInClient(customer.email, password);

    // They can read their own line through the existing RLS policy...
    const allowed = await customerClient
      .from("order_items")
      .select("id, price")
      .eq("order_id", orderId);
    expect(allowed.error).toBeNull();
    expect(allowed.data?.length).toBe(1);

    // ...but not what it cost us.
    const denied = await customerClient.from("order_items").select("cost_price").eq("order_id", orderId);
    expect(denied.error).not.toBeNull();
  });

  it("requires an admin session to set a cost price", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(setGameCostPrice(game.id, 999)).rejects.toThrow();
    sessionState.client = await signedInClient(admin.email, password);
  });
});

describe("historical cost lookups", () => {
  it("cost_price_at returns the value effective on the given date, not the latest", async () => {
    // Three prices, each effective from a different date.
    await service.from("cost_price_history").delete().eq("game_id", game.id);
    const { error } = await service.from("cost_price_history").insert([
      { game_id: game.id, cost_price: 100, effective_from: "2026-01-01" },
      { game_id: game.id, cost_price: 200, effective_from: "2026-06-01" },
      { game_id: game.id, cost_price: 300, effective_from: "2026-09-01" },
    ]);
    expect(error).toBeNull();

    const at = async (iso: string) => {
      const { data, error: rpcErr } = await service.rpc("cost_price_at", {
        p_game_id: game.id,
        p_variant_id: null,
        p_gift_card_product_id: null,
        p_at: iso,
      });
      expect(rpcErr).toBeNull();
      return data === null ? null : Number(data);
    };

    expect(await at("2026-03-15T12:00:00Z")).toBe(100);
    expect(await at("2026-07-15T12:00:00Z")).toBe(200);
    expect(await at("2026-09-15T12:00:00Z")).toBe(300);
    // Exactly on the boundary the new price applies (effective_from <= date).
    expect(await at("2026-06-01T00:00:00Z")).toBe(200);
  });

  it("falls back to the current column when the date precedes all history", async () => {
    await service.from("cost_price_history").delete().eq("game_id", game.id);
    await service.from("games").update({ cost_price: 555 }).eq("id", game.id);
    await service
      .from("cost_price_history")
      .insert({ game_id: game.id, cost_price: 100, effective_from: "2026-06-01" });

    const { data } = await service.rpc("cost_price_at", {
      p_game_id: game.id,
      p_variant_id: null,
      p_gift_card_product_id: null,
      p_at: "2026-01-01T00:00:00Z",
    });
    expect(Number(data)).toBe(555);
  });

  it("a variant with no cost of its own inherits the parent game's", async () => {
    await service.from("cost_price_history").delete().eq("variant_id", variant.id);
    await service.from("game_variants").update({ cost_price: null }).eq("id", variant.id);
    await service.from("games").update({ cost_price: 777 }).eq("id", game.id);
    await service.from("cost_price_history").delete().eq("game_id", game.id);

    const { data } = await service.rpc("cost_price_at", {
      p_game_id: game.id,
      p_variant_id: variant.id,
      p_gift_card_product_id: null,
      p_at: new Date().toISOString(),
    });
    expect(Number(data)).toBe(777);
  });

  it("setGameCostPrice records a history row alongside the column write", async () => {
    await service.from("cost_price_history").delete().eq("game_id", game.id);

    const result = await setGameCostPrice(game.id, 425.5, { effectiveFrom: "2026-05-05", note: "supplier change" });
    expect(result.ok).toBe(true);

    const { data: row } = await service
      .from("games")
      .select("cost_price")
      .eq("id", game.id)
      .single();
    expect(Number(row!.cost_price)).toBe(425.5);

    const { data: history } = await service
      .from("cost_price_history")
      .select("cost_price, effective_from, note")
      .eq("game_id", game.id);
    expect(history?.length).toBe(1);
    expect(Number(history![0].cost_price)).toBe(425.5);
    expect(history![0].effective_from).toBe("2026-05-05");
    expect(history![0].note).toBe("supplier change");
  });

  it("rejects a negative cost price without writing anything", async () => {
    await service.from("cost_price_history").delete().eq("game_id", game.id);
    const result = await setGameCostPrice(game.id, -5);
    expect(result.ok).toBe(false);

    const { count } = await service
      .from("cost_price_history")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id);
    expect(count).toBe(0);
  });
});

describe("cost is locked at approval and profit math is correct", () => {
  it("approve_order stamps the cost that was active at that moment", async () => {
    await service.from("cost_price_history").delete().eq("game_id", game.id);
    await service.from("games").update({ cost_price: 600 }).eq("id", game.id);

    const orderId = await createOrderWithItem(1000);

    const { error } = await service.rpc("approve_order", { p_order_id: orderId, p_admin_id: admin.id });
    expect(error).toBeNull();

    const { data: item } = await service
      .from("order_items")
      .select("cost_price, cost_locked_at")
      .eq("order_id", orderId)
      .single();
    expect(Number(item!.cost_price)).toBe(600);
    expect(item!.cost_locked_at).not.toBeNull();
  });

  it("a later cost change does NOT move an already-approved order's profit", async () => {
    await service.from("cost_price_history").delete().eq("game_id", game.id);
    await service.from("games").update({ cost_price: 600 }).eq("id", game.id);

    const orderId = await createOrderWithItem(1000);
    await service.rpc("approve_order", { p_order_id: orderId, p_admin_id: admin.id });

    const { data: before } = await service
      .from("order_items")
      .select("cost_price")
      .eq("order_id", orderId)
      .single();
    expect(Number(before!.cost_price)).toBe(600);

    // Cost doubles afterwards — the locked line must not follow it.
    const raised = await setGameCostPrice(game.id, 1200);
    expect(raised.ok).toBe(true);

    const { data: after } = await service
      .from("order_items")
      .select("cost_price")
      .eq("order_id", orderId)
      .single();
    expect(Number(after!.cost_price)).toBe(600);
  });

  it("get_profit_by_product computes revenue - cost per product", async () => {
    const isoGame = await makeIsolatedGame(250);

    const from = new Date(Date.now() - 60 * 1000).toISOString();
    const orderA = await createOrderWithItem(1000, isoGame);
    const orderB = await createOrderWithItem(500, isoGame);
    await service.rpc("approve_order", { p_order_id: orderA, p_admin_id: admin.id });
    await service.rpc("approve_order", { p_order_id: orderB, p_admin_id: admin.id });

    const { data, error } = await service.rpc("get_profit_by_product", {
      p_from: from,
      p_to: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? []).find((r: any) => r.game_id === isoGame);
    expect(row, "this run's game should appear in the report").toBeTruthy();
    // Two lines: 1000 and 500 revenue, 250 cost each.
    expect(Number(row.revenue)).toBe(1500);
    expect(Number(row.cost)).toBe(500);
    expect(Number(row.profit)).toBe(1000);
    expect(Number(row.items_sold)).toBe(2);
    expect(Number(row.items_missing_cost)).toBe(0);
  });

  it("counts lines approved with no cost on record instead of treating them as free", async () => {
    const isoGame = await makeIsolatedGame(null);

    const from = new Date(Date.now() - 60 * 1000).toISOString();
    const orderId = await createOrderWithItem(800, isoGame);
    await service.rpc("approve_order", { p_order_id: orderId, p_admin_id: admin.id });

    const { data: item } = await service
      .from("order_items")
      .select("cost_price")
      .eq("order_id", orderId)
      .single();
    expect(item!.cost_price).toBeNull();

    const { data } = await service.rpc("get_profit_by_product", {
      p_from: from,
      p_to: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? []).find((r: any) => r.game_id === isoGame);
    expect(Number(row.items_missing_cost)).toBe(1);
    expect(Number(row.revenue)).toBe(800);
    expect(Number(row.cost)).toBe(0);
  });

  it("get_profit_series buckets by the requested granularity", async () => {
    const from = new Date(Date.now() - 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();

    for (const granularity of ["day", "week", "month"] as const) {
      const { data, error } = await service.rpc("get_profit_series", {
        p_granularity: granularity,
        p_from: from,
        p_to: to,
      });
      expect(error, granularity).toBeNull();
      // Everything in this window was approved seconds ago, so whatever the
      // granularity it collapses to exactly one bucket.
      expect((data ?? []).length, granularity).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const point: any = data![0];
      expect(Number(point.profit)).toBe(Number(point.revenue) - Number(point.cost));
    }
  });
});

describe("sumProfit (pure)", () => {
  it("totals a series and derives margin from the summed figures", () => {
    const totals = sumProfit([
      { revenue: 1000, cost: 400, profit: 600, itemsSold: 2, itemsMissingCost: 0 },
      { revenue: 500, cost: 100, profit: 400, itemsSold: 1, itemsMissingCost: 1 },
    ]);
    expect(totals.revenue).toBe(1500);
    expect(totals.cost).toBe(500);
    expect(totals.profit).toBe(1000);
    expect(totals.itemsSold).toBe(3);
    expect(totals.itemsMissingCost).toBe(1);
    expect(totals.margin).toBeCloseTo(1000 / 1500);
  });

  it("returns margin 0 rather than NaN when there is no revenue", () => {
    const totals = sumProfit([]);
    expect(totals.revenue).toBe(0);
    expect(totals.profit).toBe(0);
    expect(totals.margin).toBe(0);
    expect(Number.isNaN(totals.margin)).toBe(false);
  });

  it("reports a loss when cost exceeds revenue", () => {
    const totals = sumProfit([{ revenue: 100, cost: 250, profit: -150, itemsSold: 1, itemsMissingCost: 0 }]);
    expect(totals.profit).toBe(-150);
    expect(totals.margin).toBeCloseTo(-1.5);
  });
});
