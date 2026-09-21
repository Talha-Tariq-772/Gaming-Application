import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { attachPaymentProof } from "./helpers/payment-proof";

/** Same requireAdmin()-via-mocked-session pattern as cost-price.test.ts. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { getRevenueByPaymentMethod } = await import("@/src/lib/payment-revenue");
const { revenueShare, sumPaymentRevenue } = await import("@/src/lib/payment-revenue-math");

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
const password = `PaymentRevenueTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let game: { id: string };

/**
 * This report groups by payment method, and the live project's real
 * methods already carry real orders — asserting exact totals against
 * "JazzCash" would fold those in and fail unpredictably. So the suite
 * creates its OWN payment_methods rows (the cost-price suite's isolated-
 * game trick, applied to the dimension this report actually groups on)
 * and only ever asserts on those. is_active = false keeps them out of
 * checkout's method list for the lifetime of the run.
 */
const methods: Record<string, string> = {};
const methodIds: string[] = [];
const orderIds: string[] = [];

async function makeIsolatedMethod(name: string): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const { data, error } = await service
    .from("payment_methods")
    .insert({
      label: `ZZ Test ${name} ${suffix}`,
      account_title: "Test Account",
      account_number: `0000${suffix}`,
      instructions: "Test-only payment method",
      is_active: false,
      sort_order: 999,
    })
    .select("id")
    .single();
  if (error) throw error;
  methodIds.push(data.id);
  return data.id;
}

beforeAll(async () => {
  const emailAdmin = `payrev-admin-${run}@example.com`;
  const emailCustomer = `payrev-customer-${run}@example.com`;

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
    .insert({
      title: `Payment Revenue Game ${run}`,
      slug: `payment-revenue-game-${run}`,
      genre: "Action",
      price: 1000,
      is_active: true,
      cost_price: 400,
    })
    .select("id")
    .single();
  if (gErr) throw gErr;
  game = g;

  methods.bank = await makeIsolatedMethod("Bank");
  methods.jazzcash = await makeIsolatedMethod("JazzCash");
  methods.easypaisa = await makeIsolatedMethod("Easypaisa");
  methods.raast = await makeIsolatedMethod("RAAST");

  sessionState.client = await signedInClient(admin.email, password);
}, 160_000);

afterAll(async () => {
  await runCleanupSteps(
    [
      {
        // Must precede payment methods: orders.payment_method_id is a
        // plain FK with no ON DELETE action, so a leftover order blocks
        // its method's delete outright.
        label: "orders",
        run: async () => {
          if (orderIds.length) {
            // order_items cascade on order delete (order_items_order_id_fkey).
            await deleteWithRetry(
              () => service.from("orders").delete().in("id", orderIds),
              "orders",
            );
          }
        },
      },
      {
        label: "payment methods",
        run: async () => {
          if (methodIds.length) {
            await deleteWithRetry(
              () => service.from("payment_methods").delete().in("id", methodIds),
              "payment methods",
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
        // approve_order writes an audit_log row per approval with
        // actor_id = this admin, and audit_log.actor_id is a blocking FK —
        // these must go before the user does or the delete fails with
        // "Database error deleting user".
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
          if (admin?.id) {
            await deleteWithRetry(() => service.auth.admin.deleteUser(admin.id), "admin");
          }
        },
      },
      {
        label: "customer",
        run: async () => {
          if (customer?.id) {
            await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
          }
        },
      },
    ],
    20_000,
  );
}, 160_000);

type OrderStatus =
  | "awaiting_payment"
  | "payment_claimed"
  | "under_review"
  | "approved"
  | "rejected"
  | "expired";

/**
 * Creates an order against one of this suite's isolated methods, with a
 * single line item so approve_order exercises its real cost-lock path.
 *
 * `reviewedAt` is only meaningful for statuses the report dates on it
 * (approved). Set directly rather than by calling approve_order when a
 * test needs a specific approval DATE — approve_order always stamps
 * now(), and "approved before the window" can't be built any other way.
 */
async function createOrder(options: {
  methodId: string;
  amount: number;
  status: OrderStatus;
  reviewedAt?: string;
  createdAt?: string;
}): Promise<string> {
  const { data: order, error } = await service
    .from("orders")
    .insert({
      user_id: customer.id,
      status: options.status,
      payment_reference: `PAYREV-${randomUUID().slice(0, 12)}`,
      amount_exact: options.amount,
      payment_method_id: options.methodId,
      reviewed_by: options.reviewedAt ? admin.id : null,
      reviewed_at: options.reviewedAt ?? null,
      ...(options.createdAt ? { created_at: options.createdAt } : {}),
      reserved_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  orderIds.push(order.id);

  const { error: itemErr } = await service
    .from("order_items")
    .insert({ order_id: order.id, game_id: game.id, price: options.amount });
  if (itemErr) throw itemErr;

  await attachPaymentProof(service, order.id);
  return order.id;
}

/** The report over a window wide enough to hold everything this suite
 * creates, reduced to just this suite's own methods. */
async function report(days = 30): Promise<Map<string, Record<string, number>>> {
  const to = new Date(Date.now() + 60 * 1000);
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const rows = await getRevenueByPaymentMethod({ from, to });
  const byId = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (row.paymentMethodId && methodIds.includes(row.paymentMethodId)) {
      byId.set(row.paymentMethodId, {
        ordersCount: row.ordersCount,
        revenue: row.revenue,
        pendingOrders: row.pendingOrders,
        pendingAmount: row.pendingAmount,
      });
    }
  }
  return byId;
}

describe("the breakdown is admin-only", () => {
  it("anon cannot execute get_revenue_by_payment_method", async () => {
    const result = await anon.rpc("get_revenue_by_payment_method", {
      p_from: new Date(Date.now() - 86_400_000).toISOString(),
      p_to: new Date().toISOString(),
    });
    expect(result.error).not.toBeNull();
  });

  it("a signed-in customer cannot execute it either", async () => {
    const customerClient = await signedInClient(customer.email, password);
    const result = await customerClient.rpc("get_revenue_by_payment_method", {
      p_from: new Date(Date.now() - 86_400_000).toISOString(),
      p_to: new Date().toISOString(),
    });
    expect(result.error).not.toBeNull();
  });

  it("getRevenueByPaymentMethod rejects a non-admin session", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(
      getRevenueByPaymentMethod({ from: new Date(Date.now() - 86_400_000), to: new Date() }),
    ).rejects.toThrow();
    sessionState.client = await signedInClient(admin.email, password);
  });
});

describe("revenue is grouped by the method the money arrived through", () => {
  it("sums approved orders per method and keeps methods separate", async () => {
    const jazz1 = await createOrder({ methodId: methods.jazzcash, amount: 1500.25, status: "under_review" });
    const jazz2 = await createOrder({ methodId: methods.jazzcash, amount: 2000.5, status: "under_review" });
    const easy1 = await createOrder({ methodId: methods.easypaisa, amount: 800.75, status: "under_review" });

    for (const id of [jazz1, jazz2, easy1]) {
      const { error } = await service.rpc("approve_order", { p_order_id: id, p_admin_id: admin.id });
      expect(error).toBeNull();
    }

    const rows = await report();

    expect(rows.get(methods.jazzcash)).toMatchObject({
      ordersCount: 2,
      revenue: 3500.75,
    });
    expect(rows.get(methods.easypaisa)).toMatchObject({
      ordersCount: 1,
      revenue: 800.75,
    });
    // A method with no activity at all is absent, not a zero row.
    expect(rows.has(methods.raast)).toBe(false);
  });

  it("reports the exact transferred amount, paisa offset included", async () => {
    // generate_unique_amount() adds Rs 0.01-0.99 so each order's transfer
    // is uniquely matchable; the report must carry that through rather
    // than rounding, or it stops reconciling against a bank statement.
    const id = await createOrder({ methodId: methods.raast, amount: 4999.37, status: "under_review" });
    await service.rpc("approve_order", { p_order_id: id, p_admin_id: admin.id });

    const rows = await report();
    expect(rows.get(methods.raast)?.revenue).toBe(4999.37);
  });
});

describe("only confirmed revenue is counted", () => {
  it("excludes every unapproved status from revenue", async () => {
    // One order in each non-approved status, all on a method that has
    // never seen an approval — its revenue must stay exactly zero.
    await createOrder({ methodId: methods.bank, amount: 1000, status: "awaiting_payment" });
    await createOrder({ methodId: methods.bank, amount: 2000, status: "payment_claimed" });
    await createOrder({ methodId: methods.bank, amount: 3000, status: "under_review" });
    await createOrder({ methodId: methods.bank, amount: 4000, status: "rejected" });
    await createOrder({ methodId: methods.bank, amount: 5000, status: "expired" });

    const rows = await report();
    const bank = rows.get(methods.bank);

    expect(bank?.revenue).toBe(0);
    expect(bank?.ordersCount).toBe(0);

    // The three genuinely-in-flight ones are reported as pending so the
    // exclusion is visible; rejected and expired are money that is never
    // arriving, so they appear in neither figure.
    expect(bank?.pendingOrders).toBe(3);
    expect(bank?.pendingAmount).toBe(6000);
  });

  it("an order only becomes revenue once approve_order runs", async () => {
    const id = await createOrder({ methodId: methods.bank, amount: 7500, status: "under_review" });

    const before = (await report()).get(methods.bank);
    expect(before?.revenue).toBe(0);
    const pendingBefore = before?.pendingAmount ?? 0;

    const { error } = await service.rpc("approve_order", { p_order_id: id, p_admin_id: admin.id });
    expect(error).toBeNull();

    const after = (await report()).get(methods.bank);
    expect(after?.revenue).toBe(7500);
    expect(after?.ordersCount).toBe(1);
    // ...and it leaves the pending column as it joins revenue, rather than
    // being counted in both at once.
    expect(after?.pendingAmount).toBe(pendingBefore - 7500);
  });

  it("an order approved with a NULL reviewed_at is not counted", async () => {
    // Defensive: the status gate alone would count a row whose approval
    // timestamp never got written, giving it no date to be reported under.
    // The `reviewed_at is not null` clause is what keeps it out.
    const id = await createOrder({ methodId: methods.raast, amount: 999, status: "under_review" });
    const revenueBefore = (await report()).get(methods.raast)?.revenue ?? 0;

    await service.from("orders").update({ status: "approved", reviewed_at: null }).eq("id", id);

    const after = (await report()).get(methods.raast);
    expect(after?.revenue).toBe(revenueBefore);
  });

  it("matches the profit report's revenue-recognition gate", async () => {
    // Both reports must agree on WHICH orders count. They differ only in
    // the amount column (amount_exact vs summed line prices), so with a
    // whole-rupee amount and one line item the two figures are identical —
    // any divergence here means one report's status/date gate has drifted.
    const isolated = await makeIsolatedMethod("Parity");
    const from = new Date(Date.now() - 60 * 1000);
    const to = new Date(Date.now() + 60 * 1000);

    const id = await createOrder({ methodId: isolated, amount: 2500, status: "under_review" });
    await service.rpc("approve_order", { p_order_id: id, p_admin_id: admin.id });

    const rows = await getRevenueByPaymentMethod({ from, to });
    const mine = rows.find((r) => r.paymentMethodId === isolated);
    expect(mine?.revenue).toBe(2500);

    const { data: series, error } = await service.rpc("get_profit_series", {
      p_granularity: "day",
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    expect(error).toBeNull();
    // Same window, same gate — this order's 2500 is inside the profit
    // series' revenue too (which also holds other orders from this run).
    const seriesRevenue = (series ?? []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, p: any) => sum + Number(p.revenue),
      0,
    );
    expect(seriesRevenue).toBeGreaterThanOrEqual(2500);
  });
});

describe("the reporting window", () => {
  it("excludes an order approved before the window opens", async () => {
    const isolated = await makeIsolatedMethod("OldApproval");
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();

    await createOrder({
      methodId: isolated,
      amount: 12_000,
      status: "approved",
      reviewedAt: longAgo,
      createdAt: longAgo,
    });

    const to = new Date(Date.now() + 60 * 1000);
    const near = new Date(to);
    near.setDate(near.getDate() - 30);
    const nearRows = await getRevenueByPaymentMethod({ from: near, to });
    expect(nearRows.find((r) => r.paymentMethodId === isolated)).toBeUndefined();

    // Widen past the approval date and it appears, proving the absence
    // above was the date bound and not a missing row.
    const wide = new Date(to);
    wide.setDate(wide.getDate() - 365);
    const wideRows = await getRevenueByPaymentMethod({ from: wide, to });
    expect(wideRows.find((r) => r.paymentMethodId === isolated)?.revenue).toBe(12_000);
  });

  it("dates a pending order on creation, since it has no approval date", async () => {
    // Dating pending orders on reviewed_at (null until review) would drop
    // every one of them, silently reporting zero pending forever.
    const isolated = await makeIsolatedMethod("OldPending");
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();

    await createOrder({
      methodId: isolated,
      amount: 600,
      status: "payment_claimed",
      createdAt: longAgo,
    });

    const to = new Date(Date.now() + 60 * 1000);
    const near = new Date(to);
    near.setDate(near.getDate() - 30);
    expect(
      (await getRevenueByPaymentMethod({ from: near, to })).find(
        (r) => r.paymentMethodId === isolated,
      ),
    ).toBeUndefined();

    const wide = new Date(to);
    wide.setDate(wide.getDate() - 365);
    const wideRow = (await getRevenueByPaymentMethod({ from: wide, to })).find(
      (r) => r.paymentMethodId === isolated,
    );
    expect(wideRow?.pendingOrders).toBe(1);
    expect(wideRow?.pendingAmount).toBe(600);
    expect(wideRow?.revenue).toBe(0);
  });
});

describe("orders with no payment method recorded", () => {
  it("group into a single row instead of being dropped from the total", async () => {
    // orders.payment_method_id is nullable; an inner join would silently
    // shrink the grand total below what actually came in.
    const { data: order, error } = await service
      .from("orders")
      .insert({
        user_id: customer.id,
        status: "under_review",
        payment_reference: `PAYREV-NULL-${randomUUID().slice(0, 12)}`,
        amount_exact: 333,
        payment_method_id: null,
        reserved_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    orderIds.push(order.id);
    await attachPaymentProof(service, order.id);

    await service.rpc("approve_order", { p_order_id: order.id, p_admin_id: admin.id });

    const to = new Date(Date.now() + 60 * 1000);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    const rows = await getRevenueByPaymentMethod({ from, to });

    const unrecorded = rows.find((r) => r.paymentMethodId === null);
    expect(unrecorded, "a method-less order should still be reported").toBeTruthy();
    expect(unrecorded!.label).toBe("Not recorded");
    expect(unrecorded!.revenue).toBeGreaterThanOrEqual(333);
    // Exactly one catch-all row — AdminPaymentsClient keys it on the
    // constant "unrecorded", which a second null row would collide with.
    expect(rows.filter((r) => r.paymentMethodId === null).length).toBe(1);
  });
});

describe("sumPaymentRevenue and revenueShare (pure)", () => {
  const rows = [
    {
      paymentMethodId: "a",
      label: "JazzCash",
      ordersCount: 3,
      revenue: 3000,
      pendingOrders: 1,
      pendingAmount: 500,
    },
    {
      paymentMethodId: "b",
      label: "Easypaisa",
      ordersCount: 1,
      revenue: 1000,
      pendingOrders: 0,
      pendingAmount: 0,
    },
  ];

  it("totals every column and derives the average from the summed figures", () => {
    const totals = sumPaymentRevenue(rows);
    expect(totals.revenue).toBe(4000);
    expect(totals.ordersCount).toBe(4);
    expect(totals.pendingOrders).toBe(1);
    expect(totals.pendingAmount).toBe(500);
    expect(totals.averageOrderValue).toBe(1000);
  });

  it("keeps pending volume out of the revenue total", () => {
    // The tiles would otherwise report money that hasn't been confirmed.
    const totals = sumPaymentRevenue(rows);
    expect(totals.revenue).toBe(3000 + 1000);
    expect(totals.revenue).not.toBe(3000 + 1000 + 500);
  });

  it("returns 0, not NaN, for the average when nothing was approved", () => {
    const totals = sumPaymentRevenue([
      {
        paymentMethodId: "a",
        label: "JazzCash",
        ordersCount: 0,
        revenue: 0,
        pendingOrders: 2,
        pendingAmount: 900,
      },
    ]);
    expect(totals.averageOrderValue).toBe(0);
    expect(Number.isNaN(totals.averageOrderValue)).toBe(false);
    expect(totals.pendingAmount).toBe(900);
  });

  it("sums an empty period to zeroes", () => {
    const totals = sumPaymentRevenue([]);
    expect(totals.revenue).toBe(0);
    expect(totals.ordersCount).toBe(0);
    expect(totals.averageOrderValue).toBe(0);
  });

  it("computes each method's share of the total", () => {
    const totals = sumPaymentRevenue(rows);
    expect(revenueShare(3000, totals.revenue)).toBeCloseTo(0.75);
    expect(revenueShare(1000, totals.revenue)).toBeCloseTo(0.25);
  });

  it("returns share 0 rather than NaN when there is no revenue", () => {
    expect(revenueShare(0, 0)).toBe(0);
    expect(Number.isNaN(revenueShare(0, 0))).toBe(false);
  });
});
