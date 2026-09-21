import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as the rest of the suite. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { createGame, deleteGame, setGameActive, updateGame } = await import(
  "@/src/lib/actions/admin-games"
);
const { uploadGameImage } = await import("@/src/lib/actions/admin-images");
const { getGamesByIds } = await import("@/src/lib/catalog");

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
const password = `GamesCrudTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let paymentMethodId: string;
let realImageBuffer: Buffer;

const gameIds: string[] = [];
const orderIds: string[] = [];
const uploadedSlugs: string[] = [];

function track(id: string | undefined | null): string | undefined {
  if (id) gameIds.push(id);
  return id ?? undefined;
}

function gameInput(overrides: Partial<Parameters<typeof createGame>[0]> = {}) {
  const suffix = randomUUID().slice(0, 8);
  return {
    title: `ZZ CRUD Game ${suffix}`,
    slug: `zz-crud-game-${suffix}`,
    description: "",
    price: 2500,
    genre: "Action" as const,
    platform: "ps5" as const,
    coverImageUrl: "",
    trailerUrl: "",
    setupGuide: "",
    isActive: true,
    isNewArrival: false,
    isBestSeller: false,
    releaseDate: null,
    setupGuideId: null,
    ...overrides,
  };
}

function formDataWith(fields: Record<string, string>, bytes: Buffer): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  fd.set("file", new File([bytes as unknown as BlobPart], "art.jpg", { type: "image/jpeg" }));
  return fd;
}

/**
 * Is this game actually reachable on the storefront?
 *
 * Deliberately the ANON client with an explicit is_active filter, not
 * getGamesByIds — that helper runs on the SERVICE client and returns
 * inactive rows on purpose, because cart validation has to tell
 * "deleted" apart from "hidden". Using it here would report a hidden
 * game as still on the store.
 */
async function isOnStorefront(id: string): Promise<boolean> {
  const { data, error } = await anon
    .from("games")
    .select("id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id === id;
}

async function objectExists(bucket: string, folder: string, name: string): Promise<boolean> {
  const { data, error } = await service.storage.from(bucket).list(folder, { limit: 100 });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === name);
}

beforeAll(async () => {
  const emailAdmin = `games-crud-admin-${run}@example.com`;
  const emailCustomer = `games-crud-customer-${run}@example.com`;

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

  const { data: pm } = await service.from("payment_methods").select("id").limit(1).single();
  paymentMethodId = pm!.id;

  const cardSourceDir = path.join(process.cwd(), "assets", "product-images", "card");
  const [firstFile] = await fs.readdir(cardSourceDir);
  realImageBuffer = await fs.readFile(path.join(cardSourceDir, firstFile));

  sessionState.client = await signedInClient(admin.email, password);
}, 120_000);

afterAll(async () => {
  await runCleanupSteps(
    [
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
        label: "credentials",
        run: async () => {
          if (gameIds.length) {
            await deleteWithRetry(
              () => service.from("game_credentials").delete().in("game_id", gameIds),
              "credentials",
            );
          }
        },
      },
      {
        // Anything a test uploaded but did not delete through deleteGame.
        label: "storage leftovers",
        run: async () => {
          if (!uploadedSlugs.length) return;
          const covers = uploadedSlugs.flatMap((s) => [
            `covers/${s}-400.webp`,
            `covers/${s}-800.webp`,
          ]);
          await deleteWithRetry(
            () => service.storage.from("game-images").remove(covers),
            "storage leftovers",
          );
        },
      },
      {
        label: "games",
        run: async () => {
          if (gameIds.length) {
            await deleteWithRetry(() => service.from("games").delete().in("id", gameIds), "games");
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
          if (customer?.id) {
            await deleteWithRetry(() => service.auth.admin.deleteUser(customer.id), "customer");
          }
        },
      },
    ],
    20_000,
  );
}, 180_000);

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

describe("creating a game", () => {
  it("creates a row that the public storefront query can then see", async () => {
    const input = gameInput({ title: `ZZ Storefront Game ${run}`, price: 3400 });
    const result = await createGame(input);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    track(result.game.id);

    expect(result.game.title).toBe(input.title);
    expect(result.game.price).toBe(3400);
    expect(result.game.isActive).toBe(true);

    // The real storefront read path: anon client, is_active filter. A
    // game an admin just created has to be reachable there, or
    // "appears on the storefront" is not true.
    expect(
      await isOnStorefront(result.game.id),
      "a newly created active game should be publicly visible",
    ).toBe(true);

    const bySlug = await anon
      .from("games")
      .select("id, title, price")
      .eq("slug", input.slug)
      .eq("is_active", true)
      .maybeSingle();
    expect(bySlug.error).toBeNull();
    expect(bySlug.data?.id).toBe(result.game.id);
  });

  it("gets a default variant, so the product page is actually sellable", async () => {
    // game_variants is the single source of truth for price, and
    // VariantPicker returns null outright for a game with none — so a
    // variantless game renders a product page with no price and no Add
    // to Cart button. Not a crash; quietly unbuyable, which is worse.
    // createGame seeds the same 'Standard' shape 20260829000003's own
    // backfill gave every pre-variants game.
    const result = await createGame(gameInput({ price: 2750 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    track(result.game.id);

    const { data: variants } = await service
      .from("game_variants")
      .select("id, label, price_pkr, price_source, is_active")
      .eq("game_id", result.game.id);
    expect((variants ?? []).length).toBe(1);
    expect(variants![0].label).toBe("Standard");
    expect(Number(variants![0].price_pkr)).toBe(2750);
    expect(variants![0].is_active).toBe(true);

    // And the returned Game carries it, so the admin list shows a real
    // price immediately rather than zero until the next refresh.
    expect(result.game.variants.length).toBe(1);
    expect(result.game.variants[0].pricePkr).toBe(2750);
  });

  it("creates an inactive game that the storefront does NOT show", async () => {
    const result = await createGame(gameInput({ isActive: false }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    track(result.game.id);

    expect(await isOnStorefront(result.game.id)).toBe(false);
  });

  it("refuses a duplicate slug with a readable message", async () => {
    const slug = `zz-crud-dupe-${run}`;
    const first = await createGame(gameInput({ slug }));
    expect(first.ok).toBe(true);
    if (first.ok) track(first.game.id);

    const second = await createGame(gameInput({ slug }));
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toMatch(/slug already exists/i);
  });

  it("requires an admin session", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(createGame(gameInput())).rejects.toThrow();
    sessionState.client = await signedInClient(admin.email, password);
  });
});

/* ------------------------------------------------------------------ */
/* Edit                                                                */
/* ------------------------------------------------------------------ */

describe("editing a game", () => {
  it("saves field changes and reflects them on the public read path", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const updated = await updateGame(created.game.id, {
      ...gameInput({ slug: created.game.slug }),
      title: "ZZ CRUD Game Edited",
      price: 4999,
      description: "An edited description.",
      isNewArrival: true,
    });
    expect(updated.ok, updated.ok ? "" : updated.message).toBe(true);
    if (!updated.ok) return;

    expect(updated.game.title).toBe("ZZ CRUD Game Edited");
    expect(updated.game.price).toBe(4999);
    expect(updated.game.isNewArrival).toBe(true);

    const publicRow = await anon
      .from("games")
      .select("title, price")
      .eq("id", created.game.id)
      .maybeSingle();
    expect(publicRow.error).toBeNull();
    expect(publicRow.data?.title).toBe("ZZ CRUD Game Edited");
  });

  it("saves with description, cover URL, trailer and setup guide all blank", async () => {
    // The regression from 36cbb31: requiring fields the catalog does not
    // populate made every seeded game unsaveable, with a dead Save button
    // and no feedback. Same rule the hardware form now follows.
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const result = await updateGame(created.game.id, {
      ...gameInput({ slug: created.game.slug }),
      description: "",
      coverImageUrl: "",
      trailerUrl: "",
      setupGuide: "",
      setupGuideId: null,
      releaseDate: null,
    });
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
  });

  it("changing images leaves the rest of the row untouched", async () => {
    const created = await createGame(gameInput({ title: `ZZ Image Edit ${run}`, price: 1234 }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);
    uploadedSlugs.push(created.game.slug);

    const uploaded = await uploadGameImage(
      formDataWith({ gameId: created.game.id, kind: "cover" }, realImageBuffer),
    );
    expect(uploaded.ok, uploaded.ok ? "" : uploaded.message).toBe(true);

    const { data: row } = await service
      .from("games")
      .select("title, price, cover_path")
      .eq("id", created.game.id)
      .single();
    expect(row!.cover_path).toBe(`covers/${created.game.slug}`);
    expect(row!.title).toBe(`ZZ Image Edit ${run}`);
    expect(Number(row!.price)).toBe(1234);
  });

  it("refuses an out-of-enum platform before touching the database", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const result = await updateGame(created.game.id, {
      ...gameInput({ slug: created.game.slug }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      platform: "PlayStation 5" as any,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/platform/i);
  });

  it("setGameActive hides a game from the storefront without deleting it", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const hidden = await setGameActive(created.game.id, false);
    expect(hidden.ok).toBe(true);
    expect(await isOnStorefront(created.game.id)).toBe(false);

    const { data: still } = await service
      .from("games")
      .select("id")
      .eq("id", created.game.id)
      .maybeSingle();
    expect(still?.id).toBe(created.game.id);
  });
});

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

describe("deleting a game with history is refused", () => {
  it("blocks a game that appears on an order, and names the alternative", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const { data: order, error: orderErr } = await service
      .from("orders")
      .insert({
        user_id: customer.id,
        status: "under_review",
        payment_reference: `ZZCRUD-${randomUUID().slice(0, 12)}`,
        amount_exact: 2500,
        payment_method_id: paymentMethodId,
        reserved_until: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    if (orderErr) throw orderErr;
    orderIds.push(order.id);

    const { error: itemErr } = await service
      .from("order_items")
      .insert({ order_id: order.id, game_id: created.game.id, price: 2500 });
    if (itemErr) throw itemErr;

    const result = await deleteGame(created.game.id);
    expect(result.ok, "a game with order history must not be deletable").toBe(false);
    if (result.ok) return;
    expect(result.blockedByHistory).toBe(true);
    expect(result.message).toMatch(/existing orders/i);
    expect(result.message).toMatch(/inactive/i);

    // Refused, not silently deactivated: the row is untouched, including
    // is_active. The admin decides, via the toast's own action.
    const { data: still } = await service
      .from("games")
      .select("id, is_active")
      .eq("id", created.game.id)
      .single();
    expect(still!.id).toBe(created.game.id);
    expect(still!.is_active).toBe(true);
  });

  it("blocks a game that has credential inventory but no orders", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    const { error } = await service.from("game_credentials").insert({
      game_id: created.game.id,
      login_enc: "test-login-enc",
      password_enc: "test-password-enc",
      status: "available",
    });
    if (error) throw error;

    const result = await deleteGame(created.game.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.blockedByHistory).toBe(true);
    expect(result.message).toMatch(/credential inventory/i);
    expect(result.message).toMatch(/inactive/i);
  });

  it("the offered alternative actually works", async () => {
    // The toast's "Set inactive" button calls setGameActive(id, false) —
    // this is that path, end to end, on a game the delete just refused.
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    await service.from("game_credentials").insert({
      game_id: created.game.id,
      login_enc: "x",
      password_enc: "y",
      status: "available",
    });

    const blocked = await deleteGame(created.game.id);
    expect(blocked.ok).toBe(false);

    const deactivated = await setGameActive(created.game.id, false);
    expect(deactivated.ok).toBe(true);
    if (!deactivated.ok) return;
    expect(deactivated.game.isActive).toBe(false);
    expect(await isOnStorefront(created.game.id)).toBe(false);
  });
});

describe("deleting a clean game removes it and leaves nothing behind", () => {
  it("removes the row, its variants, and its uploaded images", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { id, slug } = created.game;
    track(id);
    uploadedSlugs.push(slug);

    const uploaded = await uploadGameImage(formDataWith({ gameId: id, kind: "cover" }, realImageBuffer));
    expect(uploaded.ok, uploaded.ok ? "" : uploaded.message).toBe(true);
    expect(await objectExists("game-images", "covers", `${slug}-400.webp`)).toBe(true);

    // createGame seeds one, and this adds a second so the cascade is
    // exercised on more than a single row.
    await service
      .from("game_variants")
      .insert({ game_id: id, label: "Deluxe", price_pkr: 5000, price_source: "estimate" });

    const { data: variantsBefore } = await service
      .from("game_variants")
      .select("id")
      .eq("game_id", id);
    expect((variantsBefore ?? []).length).toBeGreaterThanOrEqual(2);

    const result = await deleteGame(id);
    expect(result.ok, result.ok ? "" : result.message).toBe(true);
    if (!result.ok) return;
    expect(result.hardDeleted).toBe(true);

    // 1. The row itself.
    const { data: gone } = await service.from("games").select("id").eq("id", id).maybeSingle();
    expect(gone).toBeNull();

    // 2. Variants — cascade at the database level
    //    (game_variants_game_id_fkey ON DELETE CASCADE).
    const { data: variantsAfter } = await service
      .from("game_variants")
      .select("id")
      .eq("game_id", id);
    expect(variantsAfter ?? []).toEqual([]);

    // 3. Storage objects — NO foreign key to cascade through, so this is
    //    the one that only happens because deleteGame purges them.
    for (const width of [400, 800]) {
      expect(
        await objectExists("game-images", "covers", `${slug}-${width}.webp`),
        `covers/${slug}-${width}.webp should not be orphaned in the bucket`,
      ).toBe(false);
    }
  });

  it("leaves no cart reference a returning buyer could act on", async () => {
    // A cart lives in the buyer's localStorage, so a deleted game can
    // still be sitting in one. CartIntegrityGuard/useCartSummary both
    // validate against this exact lookup and prune what it cannot resolve
    // — so "no cart reference left behind" means this returns nothing.
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { id } = created.game;

    expect((await getGamesByIds([id])).length).toBe(1);

    const result = await deleteGame(id);
    expect(result.ok).toBe(true);

    const stillResolvable = await getGamesByIds([id]);
    expect(stillResolvable.length, "a deleted game must not resolve for a stale cart").toBe(0);
  });

  it("deleting an already-deleted game does not report a false success", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect((await deleteGame(created.game.id)).ok).toBe(true);
    // A second delete finds no history and no row — it is a no-op that
    // reports success, which is the honest answer: the requested end
    // state holds.
    const second = await deleteGame(created.game.id);
    expect(second.ok).toBe(true);
  });

  it("requires an admin session", async () => {
    const created = await createGame(gameInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    track(created.game.id);

    sessionState.client = await signedInClient(customer.email, password);
    await expect(deleteGame(created.game.id)).rejects.toThrow();
    sessionState.client = await signedInClient(admin.email, password);

    const { data: still } = await service
      .from("games")
      .select("id")
      .eq("id", created.game.id)
      .maybeSingle();
    expect(still?.id).toBe(created.game.id);
  });
});
