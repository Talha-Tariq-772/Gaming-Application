import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as tests/admin-users.test.ts
 * and tests/admin-images.test.ts. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { createVariant, getVariantsForGame, reorderVariant, setVariantActive, setVariantMode, updateVariant } =
  await import("@/src/lib/actions/admin-variants");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

const run = randomUUID().slice(0, 8);
const password = `AdminVariantsTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let game: { id: string; slug: string };

beforeAll(async () => {
  const emailAdmin = `admin-variants-admin-${run}@example.com`;
  const emailCustomer = `admin-variants-customer-${run}@example.com`;

  const { data: createdAdmin, error: adminErr } = await service.auth.admin.createUser({
    email: emailAdmin,
    password,
    email_confirm: true,
  });
  if (adminErr) throw adminErr;
  admin = { id: createdAdmin.user.id, email: emailAdmin };
  await service.from("profiles").update({ role: "admin" }).eq("id", admin.id);

  const { data: createdCustomer, error: customerErr } = await service.auth.admin.createUser({
    email: emailCustomer,
    password,
    email_confirm: true,
  });
  if (customerErr) throw customerErr;
  customer = { id: createdCustomer.user.id, email: emailCustomer };

  const { data: gameRow, error: gameErr } = await service
    .from("games")
    .insert({ title: `Admin Variants Test Game ${run}`, slug: `admin-variants-test-game-${run}`, price: 999, is_active: true })
    .select("id, slug")
    .single();
  if (gameErr) throw gameErr;
  game = gameRow;

  sessionState.client = await signedInClient(admin.email, password);
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "game_variants",
      run: async () => {
        if (game?.id) await deleteWithRetry(() => service.from("game_variants").delete().eq("game_id", game.id), "game_variants");
      },
    },
    {
      label: "games",
      run: async () => {
        if (game?.id) await deleteWithRetry(() => service.from("games").delete().eq("id", game.id), "games");
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
  ]);
}, 40_000);

describe("auth boundary: a non-admin session is rejected", () => {
  it("createVariant rejects a customer session before writing anything", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(createVariant(game.id, { label: "Sneaky", pricePkr: 1, wasPricePkr: null, priceSource: "estimate" })).rejects.toThrow();

    const { data: recheck } = await service.from("game_variants").select("id").eq("game_id", game.id);
    expect(recheck ?? []).toHaveLength(0);

    sessionState.client = await signedInClient(admin.email, password);
  });
});

describe("createVariant / updateVariant", () => {
  it("creates a first variant", async () => {
    const result = await createVariant(game.id, {
      label: "Standard",
      pricePkr: 1000,
      wasPricePkr: null,
      priceSource: "estimate",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].label).toBe("Standard");
    expect(result.variants[0].isActive).toBe(true);
  });

  it("creates a second variant", async () => {
    const result = await createVariant(game.id, {
      label: "Deluxe",
      pricePkr: 2000,
      wasPricePkr: 2500,
      priceSource: "catalog",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variants.map((v) => v.label).sort()).toEqual(["Deluxe", "Standard"]);
  });

  it("rejects a duplicate label for the same game (row-level: no third row created)", async () => {
    const result = await createVariant(game.id, {
      label: "Standard",
      pricePkr: 1500,
      wasPricePkr: null,
      priceSource: "estimate",
    });
    expect(result.ok).toBe(false);

    const { data: recheck } = await service.from("game_variants").select("id").eq("game_id", game.id);
    expect(recheck ?? []).toHaveLength(2); // still just Standard + Deluxe
  });

  it("rejects a was-price that isn't actually higher than the price, before ever reaching the DB", async () => {
    const result = await createVariant(game.id, {
      label: "Bad Discount",
      pricePkr: 1000,
      wasPricePkr: 900,
      priceSource: "estimate",
    });
    expect(result.ok).toBe(false);

    const { data: recheck } = await service.from("game_variants").select("id").eq("label", "Bad Discount");
    expect(recheck ?? []).toHaveLength(0);
  });

  it("updateVariant edits label/price and the change is visible by row-level re-read", async () => {
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const deluxe = list.variants.find((v) => v.label === "Deluxe")!;

    const result = await updateVariant(game.id, deluxe.id, {
      label: "Deluxe Edition",
      pricePkr: 2200,
      wasPricePkr: null,
      priceSource: "catalog",
    });
    expect(result.ok).toBe(true);

    const { data: recheck } = await service
      .from("game_variants")
      .select("label, price_pkr, was_price_pkr")
      .eq("id", deluxe.id)
      .single();
    expect(recheck?.label).toBe("Deluxe Edition");
    expect(recheck?.price_pkr).toBe(2200);
    expect(recheck?.was_price_pkr).toBeNull();
  });
});

describe("setVariantActive — last-active-variant guardrail (app check + real DB trigger)", () => {
  it("deactivating one of two active variants succeeds", async () => {
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const standard = list.variants.find((v) => v.label === "Standard")!;

    const result = await setVariantActive(game.id, standard.id, false);
    expect(result.ok).toBe(true);

    const { data: recheck } = await service.from("game_variants").select("is_active").eq("id", standard.id).single();
    expect(recheck?.is_active).toBe(false);
  });

  it("deactivating the LAST active variant is rejected by the action's advisory check, and the row is unchanged", async () => {
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const active = list.variants.filter((v) => v.isActive);
    expect(active).toHaveLength(1); // only "Deluxe Edition" left active from the previous test
    const lastActive = active[0];

    const result = await setVariantActive(game.id, lastActive.id, false);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/at least one active variant/i);

    const { data: recheck } = await service.from("game_variants").select("is_active").eq("id", lastActive.id).single();
    expect(recheck?.is_active).toBe(true); // unchanged at the DB level — not just a friendly-looking rejection
  });

  it("the DB trigger itself blocks the same deactivation even bypassing the action entirely (service-role direct write)", async () => {
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const lastActive = list.variants.find((v) => v.isActive)!;

    const { error } = await service.from("game_variants").update({ is_active: false }).eq("id", lastActive.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("LV001");

    const { data: recheck } = await service.from("game_variants").select("is_active").eq("id", lastActive.id).single();
    expect(recheck?.is_active).toBe(true);
  });

  it("the DB trigger also blocks a hard DELETE of the last active variant", async () => {
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const lastActive = list.variants.find((v) => v.isActive)!;

    const { error } = await service.from("game_variants").delete().eq("id", lastActive.id);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("LV001");

    const { data: recheck } = await service.from("game_variants").select("id").eq("id", lastActive.id).single();
    expect(recheck?.id).toBe(lastActive.id); // still there
  });

  it("real concurrent deactivation of two different active variants on the same game: exactly one succeeds, never zero active", async () => {
    // Reactivate Standard so the game has 2 active variants again, giving
    // the race something real to contend over.
    const list = await getVariantsForGame(game.id);
    if (!list.ok) throw new Error(list.message);
    const standard = list.variants.find((v) => v.label === "Standard")!;
    const deluxe = list.variants.find((v) => v.label === "Deluxe Edition")!;
    await service.from("game_variants").update({ is_active: true }).eq("id", standard.id);

    const { count: preRaceCount } = await service
      .from("game_variants")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .eq("is_active", true);
    expect(preRaceCount).toBe(2);

    // Direct concurrent service-role writes — this is specifically testing
    // the trigger's row-locking under real concurrency, not the action's
    // sequential SELECT-then-UPDATE (which can't race against itself in a
    // single-process test the way two real requests could).
    const [resA, resB] = await Promise.all([
      service.from("game_variants").update({ is_active: false }).eq("id", standard.id),
      service.from("game_variants").update({ is_active: false }).eq("id", deluxe.id),
    ]);

    const errors = [resA.error, resB.error];
    const successes = errors.filter((e) => e === null);
    const failures = errors.filter((e) => e !== null);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.code).toBe("LV001");

    const { count: postRaceCount } = await service
      .from("game_variants")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id)
      .eq("is_active", true);
    expect(postRaceCount).toBe(1); // never zero

    // Restore both to active for the reorder tests below.
    await service.from("game_variants").update({ is_active: true }).eq("game_id", game.id);
  });
});

describe("reorderVariant", () => {
  it("swaps sort_order with the adjacent variant", async () => {
    const before = await getVariantsForGame(game.id);
    if (!before.ok) throw new Error(before.message);
    expect(before.variants.length).toBeGreaterThanOrEqual(2);
    const [first, second] = before.variants;

    const result = await reorderVariant(game.id, second.id, "up");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newFirst = result.variants[0];
    const newSecond = result.variants[1];
    expect(newFirst.id).toBe(second.id);
    expect(newSecond.id).toBe(first.id);
  });

  it("is a no-op (not an error) when already at the top", async () => {
    const before = await getVariantsForGame(game.id);
    if (!before.ok) throw new Error(before.message);
    const topId = before.variants[0].id;

    const result = await reorderVariant(game.id, topId, "up");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variants[0].id).toBe(topId); // unchanged
  });
});

describe("setVariantMode", () => {
  it("toggles games.variant_mode and the change is visible by row-level re-read", async () => {
    const result = await setVariantMode(game.id, "multi");
    expect(result.ok).toBe(true);

    const { data: recheck } = await service.from("games").select("variant_mode").eq("id", game.id).single();
    expect(recheck?.variant_mode).toBe("multi");
  });
});
