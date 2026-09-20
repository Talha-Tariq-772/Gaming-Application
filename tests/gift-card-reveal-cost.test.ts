import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encrypt, sha256Hex } from "@/src/lib/crypto-core";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/**
 * Covers the two gift-card gaps found during manual verification:
 *   1. an approved gift-card order gave the buyer no way to see the code
 *      (delivered in the DB, invisible in the UI)
 *   2. gift-card lines could never resolve a cost, so every one counted
 *      as items_missing_cost forever
 */

const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

// requestIp reads next/headers, which throws outside a request scope.
vi.mock("@/src/lib/request-ip", () => ({ requestIp: async () => "127.0.0.1" }));

const { revealGiftCardCode } = await import("@/src/lib/actions/credentials");
const { setGiftCardCostPrice } = await import("@/src/lib/actions/admin-cost-price");

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
const password = `GiftCardTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let other: { id: string; email: string };
let product: { id: string };
let paymentMethodId: string;
const orderIds: string[] = [];
/** Report assertions need a product nothing else in this file has sold —
 * otherwise the earlier tests' approved orders land in the same time
 * window and inflate the totals. */
const extraProductIds: string[] = [];

async function makeIsolatedProduct(costPrice: number): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const { data, error } = await service
    .from("gift_card_products")
    .insert({
      slug: `gc-iso-${suffix}`,
      title: `GC Iso ${suffix}`,
      platform: "psn",
      region: "US",
      price_pkr: 3200,
      description: "Isolated test product.",
      redemption_instructions: "Redeem on PSN.",
      is_active: true,
      cost_price: costPrice,
    })
    .select("id")
    .single();
  if (error) throw error;
  extraProductIds.push(data.id);
  return data.id;
}

/** One product, one code, one approved order — the shape a real purchase
 * leaves behind. Returns ids needed to assert against. */
async function createApprovedGiftCardOrder(
  plainCode: string,
  userId: string,
  productId?: string,
): Promise<{ orderId: string; orderItemId: string; codeId: string }> {
  const { data: code, error: codeErr } = await service
    .from("gift_card_codes")
    .insert({
      product_id: productId ?? product.id,
      code_encrypted: encrypt(plainCode).toString("base64"),
      code_hash: sha256Hex(plainCode),
      status: "reserved",
    })
    .select("id")
    .single();
  if (codeErr) throw codeErr;

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      user_id: userId,
      status: "under_review",
      payment_reference: `GC-${randomUUID().slice(0, 10)}`,
      amount_exact: 3200,
      payment_method_id: paymentMethodId,
      reserved_until: new Date(Date.now() + 3_600_000).toISOString(),
    })
    .select("id")
    .single();
  if (orderErr) throw orderErr;
  orderIds.push(order.id);

  const { data: item, error: itemErr } = await service
    .from("order_items")
    .insert({
      order_id: order.id,
      gift_card_code_id: code.id,
      product_type: "gift_card",
      price: 3200,
    })
    .select("id")
    .single();
  if (itemErr) throw itemErr;

  await service.from("gift_card_codes").update({ order_id: order.id }).eq("id", code.id);

  const { error: approveErr } = await service.rpc("approve_order", {
    p_order_id: order.id,
    p_admin_id: admin.id,
  });
  if (approveErr) throw approveErr;

  return { orderId: order.id, orderItemId: item.id, codeId: code.id };
}

beforeAll(async () => {
  for (const [key, label] of [
    ["admin", "admin"],
    ["customer", "customer"],
    ["other", "other"],
  ] as const) {
    const email = `gc-${label}-${run}@example.com`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    const record = { id: data.user.id, email };
    if (key === "admin") admin = record;
    else if (key === "customer") customer = record;
    else other = record;
  }
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: p, error: pErr } = await service
    .from("gift_card_products")
    .insert({
      slug: `gc-test-${run}`,
      title: `GC Test ${run}`,
      platform: "psn",
      region: "US",
      price_pkr: 3200,
      description: "Test product.",
      redemption_instructions: "Redeem on PSN.",
      is_active: true,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;
  product = p;

  const { data: pm } = await service.from("payment_methods").select("id").limit(1).single();
  paymentMethodId = pm!.id;

  sessionState.client = await signedInClient(customer.email, password);
});

afterAll(async () => {
  await runCleanupSteps(
    [
      {
        // These three tables form a cycle:
        //   gift_card_codes.order_id -> orders
        //   order_items.gift_card_code_id -> gift_card_codes
        //   order_items -> orders (ON DELETE CASCADE)
        // so neither orders nor codes can be deleted first. Break it by
        // nulling the codes' back-reference, THEN deleting the orders
        // (which cascades order_items and frees the codes), then the codes.
        label: "orders",
        run: async () => {
          if (orderIds.length) {
            await deleteWithRetry(
              () => service.from("gift_card_codes").update({ order_id: null }).in("order_id", orderIds),
              "unlink codes from orders",
            );
            await deleteWithRetry(() => service.from("orders").delete().in("id", orderIds), "orders");
          }
        },
      },
      {
        label: "gift card codes",
        run: async () => {
          const productIds = [product?.id, ...extraProductIds].filter(Boolean) as string[];
          if (productIds.length) {
            await deleteWithRetry(
              () => service.from("gift_card_codes").delete().in("product_id", productIds),
              "codes",
            );
          }
        },
      },
      {
        label: "gift card products",
        run: async () => {
          const productIds = [product?.id, ...extraProductIds].filter(Boolean) as string[];
          if (productIds.length) {
            await deleteWithRetry(
              () => service.from("gift_card_products").delete().in("id", productIds),
              "products",
            );
          }
        },
      },
      {
        // approve_order writes audit_log rows with actor_id = admin;
        // audit_log.actor_id is a blocking FK, so these must go first.
        label: "audit log",
        run: async () => {
          for (const id of [admin?.id, customer?.id].filter(Boolean) as string[]) {
            await deleteWithRetry(
              () => service.from("audit_log").delete().eq("actor_id", id),
              "audit log",
            );
          }
        },
      },
      ...(["admin", "customer", "other"] as const).map((key) => ({
        label: key,
        run: async () => {
          const record = key === "admin" ? admin : key === "customer" ? customer : other;
          if (record?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(record.id), key);
        },
      })),
    ],
    20_000,
  );
}, 160_000);

describe("gift-card code reveal", () => {
  it("returns the decrypted code to the buyer and stamps revealed_at once", async () => {
    const plain = `DUMMY-${run.toUpperCase()}-REVEAL`;
    const { orderId, orderItemId, codeId } = await createApprovedGiftCardOrder(plain, customer.id);

    const result = await revealGiftCardCode(orderId, orderItemId, customer.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toBe(plain);

    const { data: row } = await service
      .from("gift_card_codes")
      .select("revealed_at, revealed_ip, status")
      .eq("id", codeId)
      .single();
    expect(row!.status).toBe("delivered");
    expect(row!.revealed_at).not.toBeNull();
    const firstRevealedAt = row!.revealed_at;

    // Revealing again re-decrypts but must NOT move the first-reveal stamp.
    const second = await revealGiftCardCode(orderId, orderItemId, customer.id);
    expect(second.ok).toBe(true);
    const { data: after } = await service
      .from("gift_card_codes")
      .select("revealed_at")
      .eq("id", codeId)
      .single();
    expect(after!.revealed_at).toBe(firstRevealedAt);
  });

  it("refuses to reveal another customer's order", async () => {
    const { orderId, orderItemId } = await createApprovedGiftCardOrder(`DUMMY-${run}-OTHER`, customer.id);

    // requireUser is checked against the session, so a mismatched userId
    // argument must be rejected outright rather than trusted.
    sessionState.client = await signedInClient(other.email, password);
    await expect(revealGiftCardCode(orderId, orderItemId, customer.id)).rejects.toThrow();

    sessionState.client = await signedInClient(other.email, password);
    const asSelf = await revealGiftCardCode(orderId, orderItemId, other.id);
    expect(asSelf.ok).toBe(false);

    sessionState.client = await signedInClient(customer.email, password);
  });

  it("refuses an item id that belongs to a different order", async () => {
    const a = await createApprovedGiftCardOrder(`DUMMY-${run}-A`, customer.id);
    const b = await createApprovedGiftCardOrder(`DUMMY-${run}-B`, customer.id);

    // Both orders are this customer's, so ownership alone would pass —
    // the order_id filter on the item lookup is what blocks this.
    const crossed = await revealGiftCardCode(a.orderId, b.orderItemId, customer.id);
    expect(crossed.ok).toBe(false);
    if (crossed.ok) return;
    expect(crossed.error).toBe("NOT_FOUND");
  });

  it("does not reveal a code that was never delivered", async () => {
    const plain = `DUMMY-${run}-UNDELIVERED`;
    const { orderId, orderItemId, codeId } = await createApprovedGiftCardOrder(plain, customer.id);
    await service.from("gift_card_codes").update({ status: "reserved" }).eq("id", codeId);

    const result = await revealGiftCardCode(orderId, orderItemId, customer.id);
    expect(result.ok).toBe(false);
  });
});

describe("gift-card cost price", () => {
  it("is hidden from the public API", async () => {
    await setGiftCardCostPriceAsAdmin(2000);

    const star = await anon.from("gift_card_products").select("*").eq("id", product.id);
    expect(star.error).not.toBeNull();

    const explicit = await anon.from("gift_card_products").select("cost_price").eq("id", product.id);
    expect(explicit.error).not.toBeNull();

    const safe = await anon
      .from("gift_card_products")
      .select("id, title, price_pkr")
      .eq("id", product.id)
      .maybeSingle();
    expect(safe.error).toBeNull();
    expect(safe.data).not.toHaveProperty("cost_price");
  });

  it("records history alongside the column write", async () => {
    await service.from("cost_price_history").delete().eq("gift_card_product_id", product.id);
    const result = await setGiftCardCostPriceAsAdmin(1800, { effectiveFrom: "2026-04-04" });
    expect(result.ok).toBe(true);

    const { data: history } = await service
      .from("cost_price_history")
      .select("cost_price, effective_from")
      .eq("gift_card_product_id", product.id);
    expect(history?.length).toBe(1);
    expect(Number(history![0].cost_price)).toBe(1800);
    expect(history![0].effective_from).toBe("2026-04-04");
  });

  it("cost_price_at resolves a gift-card product by effective date", async () => {
    await service.from("cost_price_history").delete().eq("gift_card_product_id", product.id);
    await service.from("cost_price_history").insert([
      { gift_card_product_id: product.id, cost_price: 1000, effective_from: "2026-01-01" },
      { gift_card_product_id: product.id, cost_price: 2000, effective_from: "2026-06-01" },
    ]);

    const at = async (iso: string) => {
      const { data, error } = await service.rpc("cost_price_at", {
        p_game_id: null,
        p_variant_id: null,
        p_gift_card_product_id: product.id,
        p_at: iso,
      });
      expect(error).toBeNull();
      return Number(data);
    };

    expect(await at("2026-03-01T00:00:00Z")).toBe(1000);
    expect(await at("2026-08-01T00:00:00Z")).toBe(2000);
  });

  it("approve_order locks the gift-card cost — the gap this fixes", async () => {
    await service.from("cost_price_history").delete().eq("gift_card_product_id", product.id);
    await service.from("gift_card_products").update({ cost_price: 2500 }).eq("id", product.id);

    const { orderId } = await createApprovedGiftCardOrder(`DUMMY-${run}-COST`, customer.id);

    const { data: item } = await service
      .from("order_items")
      .select("cost_price, cost_locked_at")
      .eq("order_id", orderId)
      .single();
    expect(Number(item!.cost_price)).toBe(2500);
    expect(item!.cost_locked_at).not.toBeNull();

    // And it stays locked when the product's cost later changes.
    await setGiftCardCostPriceAsAdmin(4000);
    const { data: after } = await service
      .from("order_items")
      .select("cost_price")
      .eq("order_id", orderId)
      .single();
    expect(Number(after!.cost_price)).toBe(2500);
  });

  it("appears in get_profit_by_product with a gift_card product_type", async () => {
    const isoProduct = await makeIsolatedProduct(1200);

    const from = new Date(Date.now() - 60_000).toISOString();
    await createApprovedGiftCardOrder(`DUMMY-${run}-REPORT`, customer.id, isoProduct);

    const { data, error } = await service.rpc("get_profit_by_product", {
      p_from: from,
      p_to: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? []).find((r: any) => r.game_id === isoProduct);
    expect(row, "gift-card product should now appear in the per-product report").toBeTruthy();
    expect(row.product_type).toBe("gift_card");
    expect(Number(row.revenue)).toBe(3200);
    expect(Number(row.cost)).toBe(1200);
    expect(Number(row.profit)).toBe(2000);
    // The whole point: no longer permanently "missing cost".
    expect(Number(row.items_missing_cost)).toBe(0);
  });
});

/** setGiftCardCostPrice needs an admin session; these tests otherwise run
 * as the customer, so swap for the call and swap back. */
async function setGiftCardCostPriceAsAdmin(
  value: number,
  options?: { effectiveFrom?: string },
): ReturnType<typeof setGiftCardCostPrice> {
  const previous = sessionState.client;
  sessionState.client = await signedInClient(admin.email, password);
  try {
    return await setGiftCardCostPrice(product.id, value, options);
  } finally {
    sessionState.client = previous;
  }
}
