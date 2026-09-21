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

const {
  createHardwareProduct,
  deleteHardwareProduct,
  getHardwareForAdmin,
  setHardwareActive,
  setHardwareStock,
  updateHardwareProduct,
} = await import("@/src/lib/actions/admin-hardware");
const { isUsableImageRef, validateHardwareInput } = await import(
  "@/src/lib/hardware-validation"
);
const { getRevenueByPaymentMethod } = await import("@/src/lib/payment-revenue");

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
const password = `HardwareTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
/** This suite's own payment method, so the payment-method revenue
 * assertion is exact rather than folded in with the live project's real
 * orders. Same isolation trick payment-revenue.test.ts uses. */
let paymentMethodId: string;

const productIds: string[] = [];
const orderIds: string[] = [];

/** Every hardware product this suite creates, tracked for cleanup so it
 * never depends on a test reaching its own delete. */
function track(id: string | undefined | null): string | undefined {
  if (id) productIds.push(id);
  return id ?? undefined;
}

function input(overrides: Partial<Parameters<typeof createHardwareProduct>[0]> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return {
    slug: `zz-test-hw-${suffix}`,
    name: `ZZ Test Hardware ${suffix}`,
    description: "A test product.",
    category: "controller" as const,
    salePrice: 12_000,
    costPrice: 8_000,
    stockQuantity: 5,
    imageUrls: ["/hardware/test.png"],
    isActive: true,
    sortOrder: null,
    ...overrides,
  };
}

/** Inserts directly via the service client, bypassing the action, for
 * tests that only need a row to exist. */
async function seedProduct(overrides: Record<string, unknown> = {}): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  const { data, error } = await service
    .from("hardware_products")
    .insert({
      slug: `zz-seed-hw-${suffix}`,
      name: `ZZ Seed Hardware ${suffix}`,
      description: "",
      category: "accessory",
      sale_price: 5_000,
      cost_price: 3_000,
      stock_quantity: 3,
      image_urls: [],
      is_active: true,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  track(data.id);
  return data.id;
}

async function stockOf(productId: string): Promise<number> {
  const { data, error } = await service
    .from("hardware_products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();
  if (error) throw error;
  return Number(data.stock_quantity);
}

/** Places a real order through create_order, the same RPC checkout calls. */
async function placeOrder(
  items: { productId: string }[],
): Promise<{ ok: true; orderId: string } | { ok: false; message: string }> {
  const { data, error } = await service.rpc("create_order", {
    p_user_id: customer.id,
    p_items: items.map((i) => ({
      product_type: "hardware",
      product_id: i.productId,
      payment_method_id: paymentMethodId,
    })),
    p_phone_number: null,
    p_guest_phone: null,
    p_region_ack: false,
  });
  if (error) return { ok: false, message: error.message ?? "" };
  orderIds.push(data.id);
  await attachPaymentProof(service, data.id);
  return { ok: true, orderId: data.id };
}

/** create_order leaves an order at 'awaiting_payment'; approve_order only
 * accepts 'under_review'/'payment_claimed'. */
async function moveToReview(orderId: string): Promise<void> {
  const { error } = await service
    .from("orders")
    .update({ status: "under_review" })
    .eq("id", orderId);
  if (error) throw error;
}

beforeAll(async () => {
  const emailAdmin = `hw-admin-${run}@example.com`;
  const emailCustomer = `hw-customer-${run}@example.com`;

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

  const { data: pm, error: pmErr } = await service
    .from("payment_methods")
    .insert({
      label: `ZZ Test Hardware Method ${run}`,
      account_title: "Test Account",
      account_number: `0000${run}`,
      instructions: "Test-only payment method",
      is_active: false,
      sort_order: 999,
    })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  paymentMethodId = pm.id;

  sessionState.client = await signedInClient(admin.email, password);
}, 160_000);

afterAll(async () => {
  await runCleanupSteps(
    [
      {
        // First: order_items cascade on order delete, and both
        // hardware_products and payment_methods are blocking FKs from
        // order_items/orders respectively.
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
        label: "cost history",
        run: async () => {
          if (productIds.length) {
            await deleteWithRetry(
              () =>
                service.from("cost_price_history").delete().in("hardware_product_id", productIds),
              "cost history",
            );
          }
        },
      },
      {
        label: "hardware products",
        run: async () => {
          if (productIds.length) {
            await deleteWithRetry(
              () => service.from("hardware_products").delete().in("id", productIds),
              "hardware products",
            );
          }
        },
      },
      {
        label: "payment method",
        run: async () => {
          if (paymentMethodId) {
            await deleteWithRetry(
              () => service.from("payment_methods").delete().eq("id", paymentMethodId),
              "payment method",
            );
          }
        },
      },
      {
        // approve_order/reject_order write audit_log rows with
        // actor_id = this admin, and audit_log.actor_id is a blocking FK.
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
}, 200_000);

/* ------------------------------------------------------------------ */
/* Column lockdown and RLS                                             */
/* ------------------------------------------------------------------ */

describe("cost price is hidden from the public API", () => {
  it("anon cannot select cost_price, and `select *` fails closed", async () => {
    const id = await seedProduct({ cost_price: 4321 });

    const explicit = await anon.from("hardware_products").select("cost_price").eq("id", id);
    expect(explicit.error).not.toBeNull();

    // The real regression guard: a future `select("*")` as anon must ERROR
    // rather than quietly returning the cost column.
    const star = await anon.from("hardware_products").select("*").eq("id", id);
    expect(star.error).not.toBeNull();

    // The public column list still works — this is what hardware-catalog.ts
    // sends.
    const safe = await anon
      .from("hardware_products")
      .select("id, name, sale_price, stock_quantity, image_urls")
      .eq("id", id)
      .maybeSingle();
    expect(safe.error).toBeNull();
    expect(safe.data?.id).toBe(id);
    expect(safe.data).not.toHaveProperty("cost_price");
  });

  it("a signed-in customer cannot read cost_price either", async () => {
    const id = await seedProduct({ cost_price: 999 });
    const customerClient = await signedInClient(customer.email, password);

    const denied = await customerClient.from("hardware_products").select("cost_price").eq("id", id);
    expect(denied.error).not.toBeNull();

    const allowed = await customerClient
      .from("hardware_products")
      .select("id, name, sale_price")
      .eq("id", id)
      .maybeSingle();
    expect(allowed.error).toBeNull();
  });

  it("anon cannot see an inactive product", async () => {
    const id = await seedProduct({ is_active: false });
    const result = await anon.from("hardware_products").select("id").eq("id", id);
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(0);
  });

  it("a customer cannot write to the catalog", async () => {
    const id = await seedProduct();
    const customerClient = await signedInClient(customer.email, password);

    const inserted = await customerClient
      .from("hardware_products")
      .insert({ slug: `zz-evil-${run}`, name: "Evil", category: "console", sale_price: 1 });
    expect(inserted.error).not.toBeNull();

    const updated = await customerClient
      .from("hardware_products")
      .update({ sale_price: 1 })
      .eq("id", id)
      .select("id");
    // RLS gives zero affected rows rather than an error on UPDATE.
    expect(updated.data?.length ?? 0).toBe(0);

    const { data: after } = await service
      .from("hardware_products")
      .select("sale_price")
      .eq("id", id)
      .single();
    expect(Number(after!.sale_price)).not.toBe(1);
  });

  it("the admin CRUD actions reject a non-admin session", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(createHardwareProduct(input())).rejects.toThrow();
    await expect(getHardwareForAdmin()).rejects.toThrow();
    sessionState.client = await signedInClient(admin.email, password);
  });
});

/* ------------------------------------------------------------------ */
/* Admin CRUD                                                          */
/* ------------------------------------------------------------------ */

describe("admin CRUD", () => {
  it("creates, reads back, updates and deletes a product", async () => {
    const created = await createHardwareProduct(input({ name: "DualSense Test", stockQuantity: 7 }));
    expect(created.ok, created.ok ? "" : created.message).toBe(true);
    if (!created.ok) return;
    track(created.product.id);

    expect(created.product.name).toBe("DualSense Test");
    expect(created.product.stockQuantity).toBe(7);
    expect(created.product.costPrice).toBe(8_000);

    const listed = await getHardwareForAdmin();
    expect(listed.some((p) => p.id === created.product.id)).toBe(true);

    const updated = await updateHardwareProduct(created.product.id, {
      ...input({ slug: created.product.slug }),
      name: "DualSense Test Edited",
      salePrice: 13_500,
      stockQuantity: 2,
    });
    expect(updated.ok, updated.ok ? "" : updated.message).toBe(true);
    if (!updated.ok) return;
    expect(updated.product.name).toBe("DualSense Test Edited");
    expect(updated.product.salePrice).toBe(13_500);
    expect(updated.product.stockQuantity).toBe(2);

    const deleted = await deleteHardwareProduct(created.product.id);
    expect(deleted.ok, deleted.ok ? "" : deleted.message).toBe(true);

    const { data: gone } = await service
      .from("hardware_products")
      .select("id")
      .eq("id", created.product.id)
      .maybeSingle();
    expect(gone).toBeNull();
  });

  it("toggles active and corrects stock without touching anything else", async () => {
    const created = await createHardwareProduct(input({ stockQuantity: 1 }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.product.id);

    const hidden = await setHardwareActive(created.product.id, false);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.product.isActive).toBe(false);
    expect(hidden.product.name).toBe(created.product.name);

    const restocked = await setHardwareStock(created.product.id, 42);
    expect(restocked.ok).toBe(true);
    if (!restocked.ok) return;
    expect(restocked.product.stockQuantity).toBe(42);
    // Restocking must not silently republish a product an admin hid.
    expect(restocked.product.isActive).toBe(false);
  });

  it("rejects a duplicate slug with a readable message", async () => {
    const first = await createHardwareProduct(input({ slug: `zz-dupe-${run}` }));
    expect(first.ok).toBe(true);
    if (first.ok) track(first.product.id);

    const second = await createHardwareProduct(input({ slug: `zz-dupe-${run}` }));
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toMatch(/slug already exists/i);
  });

  it("reports a deleted product instead of failing opaquely on save", async () => {
    // The concrete scenario: two admin tabs open, one deletes, the other
    // presses Save. .single() would surface this as the generic
    // "something went wrong" and hide the real cause.
    const created = await createHardwareProduct(input());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await service.from("hardware_products").delete().eq("id", created.product.id);

    const result = await updateHardwareProduct(created.product.id, input());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/no longer exists/i);
  });

  it("refuses to delete a product that appears on an order, and says why", async () => {
    const id = await seedProduct({ stock_quantity: 2 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok, placed.ok ? "" : placed.message).toBe(true);

    const result = await deleteHardwareProduct(id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/existing orders/i);
    expect(result.message).toMatch(/inactive/i);

    // The row survives, so the order's history stays intact.
    const { data: still } = await service
      .from("hardware_products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(still?.id).toBe(id);
  });
});

/* ------------------------------------------------------------------ */
/* Validation: the "don't require what doesn't apply" rule             */
/* ------------------------------------------------------------------ */

describe("form validation requires only what applies to every product", () => {
  it("saves with description, images, cost price and sort order all blank", async () => {
    // This is the regression this whole rule exists for. /admin/games
    // required a cover URL, trailer, setup guide and description that 18
    // of 19 seeded rows did not have, so Save did nothing, forever, with
    // no feedback (36cbb31). A half-written hardware product must save.
    const result = await createHardwareProduct(
      input({ description: "", imageUrls: [], costPrice: null, sortOrder: null }),
    );
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    track(result.product.id);

    expect(result.product.description).toBe("");
    expect(result.product.imageUrls).toEqual([]);
    expect(result.product.costPrice).toBeNull();
    expect(result.product.sortOrder).toBeNull();
  });

  it("accepts a cost price of exactly 0, which is not the same as blank", async () => {
    // A bundled or giveaway unit genuinely costs nothing. Blank means
    // "not recorded" and counts toward items_missing_cost; 0 means free
    // and does not.
    const result = await createHardwareProduct(input({ costPrice: 0 }));
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    track(result.product.id);
    expect(result.product.costPrice).toBe(0);
  });

  it("returns a displayable sentence for every rejection, never a bare false", () => {
    const cases: [string, Partial<ReturnType<typeof input>>, RegExp][] = [
      ["blank name", { name: "   " }, /name is required/i],
      ["blank slug", { slug: "   " }, /slug is required/i],
      ["slug of only punctuation", { slug: "!!!" }, /slug is required/i],
      ["zero sale price", { salePrice: 0 }, /greater than 0/i],
      ["negative sale price", { salePrice: -1 }, /greater than 0/i],
      ["non-numeric sale price", { salePrice: NaN }, /greater than 0/i],
      ["negative cost price", { costPrice: -5 }, /valid cost price/i],
      ["fractional stock", { stockQuantity: 1.5 }, /whole number/i],
      ["negative stock", { stockQuantity: -1 }, /whole number/i],
      ["protocol-relative image", { imageUrls: ["//evil.com/x.png"] }, /must be a path/i],
      ["backslash image", { imageUrls: ["/a\\b.png"] }, /must be a path/i],
      ["bare word image", { imageUrls: ["controller.png"] }, /must be a path/i],
    ];

    for (const [label, overrides, pattern] of cases) {
      const message = validateHardwareInput(input(overrides));
      expect(message, `${label} should be rejected`).not.toBeNull();
      expect(message!, label).toMatch(pattern);
      // Every message is a real sentence an admin can act on.
      expect(message!.length, label).toBeGreaterThan(8);
    }
  });

  it("accepts the two image shapes the app can actually render", () => {
    expect(isUsableImageRef("/hardware/dualsense.png")).toBe(true);
    expect(isUsableImageRef("https://cdn.example.com/x.png")).toBe(true);
    expect(isUsableImageRef("http://cdn.example.com/x.png")).toBe(true);
    // A browser reads these as a host, not a path.
    expect(isUsableImageRef("//evil.com/x.png")).toBe(false);
    expect(isUsableImageRef("/a\\b.png")).toBe(false);
    expect(isUsableImageRef("javascript:alert(1)")).toBe(false);
    expect(isUsableImageRef("controller.png")).toBe(false);
  });

  it("passes a fully-populated product", () => {
    expect(validateHardwareInput(input())).toBeNull();
  });

  it("the server action rejects the same inputs the form does", async () => {
    // The form and the action share validateHardwareInput, so this is the
    // assertion that the shared rule is actually wired into the action
    // rather than only into the dialog.
    const result = await createHardwareProduct(input({ name: "  " }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/name is required/i);
  });
});

/* ------------------------------------------------------------------ */
/* Stock reservation                                                   */
/* ------------------------------------------------------------------ */

describe("stock is a counter, reserved and released correctly", () => {
  it("checkout decrements stock", async () => {
    const id = await seedProduct({ stock_quantity: 3 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok, placed.ok ? "" : placed.message).toBe(true);
    expect(await stockOf(id)).toBe(2);
  });

  it("refuses an order for a product with no stock", async () => {
    const id = await seedProduct({ stock_quantity: 0 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.message).toMatch(/OUT_OF_STOCK/);
    expect(await stockOf(id)).toBe(0);
  });

  it("refuses an order for an inactive product", async () => {
    const id = await seedProduct({ is_active: false, stock_quantity: 5 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.message).toMatch(/GAME_NOT_FOUND/);
  });

  it("counts repeat lines for the same product against one stock pool", async () => {
    // Two lines, one unit on hand. Without the per-cart tally in
    // create_order's pre-check, both lines pass the up-front check and the
    // failure only surfaces from the second reservation.
    const id = await seedProduct({ stock_quantity: 1 });
    const placed = await placeOrder([{ productId: id }, { productId: id }]);
    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.message).toMatch(/OUT_OF_STOCK/);
    // The whole transaction rolled back, so the one unit is still on hand.
    expect(await stockOf(id)).toBe(1);
  });

  it("takes two units for two lines when both are available", async () => {
    const id = await seedProduct({ stock_quantity: 4 });
    const placed = await placeOrder([{ productId: id }, { productId: id }]);
    expect(placed.ok, placed.ok ? "" : placed.message).toBe(true);
    expect(await stockOf(id)).toBe(2);
  });

  it("returns stock when an order is rejected", async () => {
    const id = await seedProduct({ stock_quantity: 2 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(await stockOf(id)).toBe(1);

    await moveToReview(placed.orderId);
    const { error } = await service.rpc("reject_order", {
      p_order_id: placed.orderId,
      p_admin_id: admin.id,
      p_reason: "test",
    });
    expect(error).toBeNull();
    expect(await stockOf(id)).toBe(2);
  });

  it("does NOT return stock when an order is approved", async () => {
    const id = await seedProduct({ stock_quantity: 2 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    await moveToReview(placed.orderId);
    const { error } = await service.rpc("approve_order", {
      p_order_id: placed.orderId,
      p_admin_id: admin.id,
    });
    expect(error).toBeNull();
    // The unit shipped — it must not reappear on the shelf.
    expect(await stockOf(id)).toBe(1);
  });

  it("returns stock when a reservation expires, exactly once however often the cron runs", async () => {
    // The idempotency guarantee hardware_stock_released_at exists for. A
    // row-per-unit inventory is self-idempotent (setting a code back to
    // 'available' twice is the same as once); adding 1 back to a counter
    // twice is not, and release_expired_reservations re-runs over every
    // expired order on every cron pass.
    const id = await seedProduct({ stock_quantity: 2 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(await stockOf(id)).toBe(1);

    await service
      .from("orders")
      .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", placed.orderId);

    const first = await service.rpc("release_expired_reservations");
    expect(first.error).toBeNull();
    expect(await stockOf(id)).toBe(2);

    // Three more passes must change nothing.
    for (let i = 0; i < 3; i++) {
      const again = await service.rpc("release_expired_reservations");
      expect(again.error).toBeNull();
    }
    expect(await stockOf(id), "stock must not inflate on repeat cron passes").toBe(2);

    const { data: order } = await service
      .from("orders")
      .select("status")
      .eq("id", placed.orderId)
      .single();
    expect(order!.status).toBe("expired");
  });

  it("rejecting an already-expired-and-released order does not double-credit", async () => {
    const id = await seedProduct({ stock_quantity: 1 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(await stockOf(id)).toBe(0);

    await service
      .from("orders")
      .update({ reserved_until: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", placed.orderId);
    await service.rpc("release_expired_reservations");
    expect(await stockOf(id)).toBe(1);

    // Force it back into a rejectable state and reject — the release is
    // already marked, so this must be a no-op for stock.
    await moveToReview(placed.orderId);
    await service.rpc("reject_order", {
      p_order_id: placed.orderId,
      p_admin_id: admin.id,
      p_reason: "test",
    });
    expect(await stockOf(id)).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Cost lock and profit reporting                                      */
/* ------------------------------------------------------------------ */

describe("hardware reaches the cost and profit reports", () => {
  it("cost_price_at resolves a hardware product's cost", async () => {
    const id = await seedProduct({ cost_price: 6_500 });
    const { data, error } = await service.rpc("cost_price_at", {
      p_game_id: null,
      p_variant_id: null,
      p_gift_card_product_id: null,
      p_hardware_product_id: id,
      p_at: new Date().toISOString(),
    });
    expect(error).toBeNull();
    expect(Number(data)).toBe(6_500);
  });

  it("cost_price_at prefers a dated history row over the current column", async () => {
    const id = await seedProduct({ cost_price: 9_999 });
    await service.from("cost_price_history").insert([
      { hardware_product_id: id, cost_price: 1_000, effective_from: "2026-01-01" },
      { hardware_product_id: id, cost_price: 2_000, effective_from: "2026-06-01" },
    ]);

    const at = async (iso: string) => {
      const { data } = await service.rpc("cost_price_at", {
        p_game_id: null,
        p_variant_id: null,
        p_gift_card_product_id: null,
        p_hardware_product_id: id,
        p_at: iso,
      });
      return Number(data);
    };
    expect(await at("2026-03-15T12:00:00Z")).toBe(1_000);
    expect(await at("2026-07-15T12:00:00Z")).toBe(2_000);
  });

  it("approve_order locks the hardware cost instead of leaving it null", async () => {
    // Gift cards shipped with exactly this bug: cost_price_at had no arm
    // for them, so every card sold locked NULL and reported 100% margin.
    const id = await seedProduct({ cost_price: 7_000, sale_price: 11_000, stock_quantity: 1 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    await moveToReview(placed.orderId);
    const { error } = await service.rpc("approve_order", {
      p_order_id: placed.orderId,
      p_admin_id: admin.id,
    });
    expect(error).toBeNull();

    const { data: item } = await service
      .from("order_items")
      .select("cost_price, cost_locked_at, product_type, hardware_product_id")
      .eq("order_id", placed.orderId)
      .single();
    expect(item!.product_type).toBe("hardware");
    expect(item!.hardware_product_id).toBe(id);
    expect(Number(item!.cost_price)).toBe(7_000);
    expect(item!.cost_locked_at).not.toBeNull();
  });

  it("get_profit_by_product reports hardware under its own product type", async () => {
    const id = await seedProduct({ cost_price: 3_000, sale_price: 10_000, stock_quantity: 2 });
    const from = new Date(Date.now() - 60_000).toISOString();

    for (let i = 0; i < 2; i++) {
      const placed = await placeOrder([{ productId: id }]);
      expect(placed.ok).toBe(true);
      if (!placed.ok) return;
      await moveToReview(placed.orderId);
      await service.rpc("approve_order", { p_order_id: placed.orderId, p_admin_id: admin.id });
    }

    const { data, error } = await service.rpc("get_profit_by_product", {
      p_from: from,
      p_to: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? []).find((r: any) => r.game_id === id);
    expect(row, "hardware must not be silently dropped from the per-product report").toBeTruthy();
    expect(row.product_type).toBe("hardware");
    // The report's `title` column coalesces across all three families —
    // this is where hardware_products.name lands.
    expect(row.title).toMatch(/^ZZ Seed Hardware/);
    expect(Number(row.revenue)).toBe(20_000);
    expect(Number(row.cost)).toBe(6_000);
    expect(Number(row.profit)).toBe(14_000);
    expect(Number(row.items_sold)).toBe(2);
    expect(Number(row.items_missing_cost)).toBe(0);
  });

  it("counts a hardware line with no cost on record rather than treating it as free", async () => {
    const id = await seedProduct({ cost_price: null, sale_price: 4_000, stock_quantity: 1 });
    const from = new Date(Date.now() - 60_000).toISOString();

    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    await moveToReview(placed.orderId);
    await service.rpc("approve_order", { p_order_id: placed.orderId, p_admin_id: admin.id });

    const { data } = await service.rpc("get_profit_by_product", {
      p_from: from,
      p_to: new Date(Date.now() + 60_000).toISOString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (data ?? []).find((r: any) => r.game_id === id);
    expect(Number(row.items_missing_cost)).toBe(1);
    expect(Number(row.revenue)).toBe(4_000);
    expect(Number(row.cost)).toBe(0);
  });

  it("get_profit_series includes hardware revenue", async () => {
    const id = await seedProduct({ cost_price: 1_000, sale_price: 5_000, stock_quantity: 1 });
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();

    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    await moveToReview(placed.orderId);
    await service.rpc("approve_order", { p_order_id: placed.orderId, p_admin_id: admin.id });

    const { data, error } = await service.rpc("get_profit_series", {
      p_granularity: "day",
      p_from: from,
      p_to: to,
    });
    expect(error).toBeNull();
    const revenue = (data ?? []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, p: any) => sum + Number(p.revenue),
      0,
    );
    expect(revenue).toBeGreaterThanOrEqual(5_000);
  });

  it("get_revenue_by_payment_method counts a hardware order", async () => {
    // This report aggregates ORDERS, not order_items, so it has no product
    // join to drop a new product type out of. Asserted rather than assumed.
    const id = await seedProduct({ sale_price: 25_000, stock_quantity: 1 });
    const placed = await placeOrder([{ productId: id }]);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const to = new Date(Date.now() + 60_000);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);

    const beforeApproval = (await getRevenueByPaymentMethod({ from, to })).find(
      (r) => r.paymentMethodId === paymentMethodId,
    );
    const pendingBefore = beforeApproval?.pendingAmount ?? 0;
    const revenueBefore = beforeApproval?.revenue ?? 0;
    expect(pendingBefore).toBeGreaterThanOrEqual(25_000);

    await moveToReview(placed.orderId);
    await service.rpc("approve_order", { p_order_id: placed.orderId, p_admin_id: admin.id });

    const afterApproval = (await getRevenueByPaymentMethod({ from, to })).find(
      (r) => r.paymentMethodId === paymentMethodId,
    );
    expect(afterApproval).toBeTruthy();
    // amount_exact carries the paisa reconciliation offset on top of the
    // 25,000 line price, so this is a floor, not an equality.
    expect(afterApproval!.revenue).toBeGreaterThan(revenueBefore + 25_000 - 1);
    expect(afterApproval!.ordersCount).toBeGreaterThanOrEqual(1);
  });
});
