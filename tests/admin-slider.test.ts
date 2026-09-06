import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";

/** Same requireAdmin()-via-mocked-session pattern as the rest of this suite. */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

const { assignSliderSlot, removeFromSliderSlot, reorderSliderSlot } = await import(
  "@/src/lib/actions/admin-slider"
);

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
const password = `AdminSliderTest!${randomUUID()}`;

let admin: { id: string; email: string };
let customer: { id: string; email: string };
let gameA: { id: string };
let gameB: { id: string };
let gameC: { id: string };

beforeAll(async () => {
  const emailAdmin = `admin-slider-admin-${run}@example.com`;
  const emailCustomer = `admin-slider-customer-${run}@example.com`;

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

  const { data: gameRows, error: gamesErr } = await service
    .from("games")
    .insert([
      { title: `Admin Slider Test A ${run}`, slug: `admin-slider-test-a-${run}`, price: 999, is_active: true },
      { title: `Admin Slider Test B ${run}`, slug: `admin-slider-test-b-${run}`, price: 999, is_active: true },
      { title: `Admin Slider Test C ${run}`, slug: `admin-slider-test-c-${run}`, price: 999, is_active: true },
    ])
    .select("id");
  if (gamesErr) throw gamesErr;
  [gameA, gameB, gameC] = gameRows;

  sessionState.client = await signedInClient(admin.email, password);
});

afterAll(async () => {
  await runCleanupSteps([
    {
      label: "games",
      run: async () => {
        const ids = [gameA?.id, gameB?.id, gameC?.id].filter((id): id is string => Boolean(id));
        if (ids.length) await deleteWithRetry(() => service.from("games").delete().in("id", ids), "games");
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

/**
 * These do NOT touch any of the 6 real slider slots — this live project's
 * slider is normally fully occupied by real catalog games (all 6 slots
 * taken), so anything that only ever gets REJECTED, or that fails before
 * ever reaching the database, is safe to run by default. Anything that
 * needs an actual free slot to succeed lives in the gated block below.
 */
describe("safe by construction — no real slot is ever written to", () => {
  it("assignSliderSlot rejects a customer session before writing anything", async () => {
    sessionState.client = await signedInClient(customer.email, password);
    await expect(assignSliderSlot(gameA.id, 1)).rejects.toThrow();

    const { data: recheck } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
    expect(recheck?.slider_position).toBeNull();

    sessionState.client = await signedInClient(admin.email, password);
  });

  it("rejects a position outside 1-6 (this is the whole 'max 6 slots' enforcement)", async () => {
    for (const bad of [0, 7, -1]) {
      const result = await assignSliderSlot(gameA.id, bad);
      expect(result.ok).toBe(false);
    }

    const { data: recheck } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
    expect(recheck?.slider_position).toBeNull();
  });

  it("rejects assigning to slot 1 — occupied by a real catalog game — and leaves that game untouched (row-level)", async () => {
    const { data: before } = await service.from("games").select("id").eq("slider_position", 1).single();
    expect(before?.id).toBeTruthy(); // this live project always keeps slot 1 filled

    const result = await assignSliderSlot(gameA.id, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/already taken/i);

    const { data: after } = await service.from("games").select("id").eq("slider_position", 1).single();
    expect(after?.id).toBe(before?.id); // still whichever real game was there

    const { data: aRecheck } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
    expect(aRecheck?.slider_position).toBeNull();
  });
});

/**
 * The live project's slider is normally fully occupied (all 6 slots taken
 * by real catalog games), so testing a successful assign/reorder/remove —
 * or the DB unique index actually rejecting a duplicate — needs at least
 * one genuinely free slot. There's no test-owned slot to use: the domain
 * is exactly 6 fixed values, all already spoken for. The only way to
 * exercise this without guessing at which slot might be safe is to
 * temporarily clear all real assignments, run the real flow against
 * test-owned games, and restore the originals in a `finally` — same
 * shape as admin-users.test.ts's prevent_last_admin_demotion race test,
 * and for the same reason: a real, if small, live-project blast radius if
 * this gets interrupted mid-run (killed process, crash between clearing
 * and restoring) before the restore happens.
 *
 * Gated behind RUN_ADMIN_SLIDER_TEST — does NOT run by default. Run
 * explicitly with:
 *   RUN_ADMIN_SLIDER_TEST=1 npx vitest run tests/admin-slider.test.ts
 */
describe.skipIf(!process.env.RUN_ADMIN_SLIDER_TEST)(
  "assign / reorder / remove against real, temporarily-freed slots",
  () => {
    it("full flow: assign, duplicate rejection at the DB level, reorder (occupied<->occupied and occupied<->empty), remove", async () => {
      // ~25 sequential live round trips in one test (clear 5 real slots,
      // the actual flow, then clear+restore in `finally`) — the default
      // 20s budget is tight even on a good connection and this session has
      // seen this live project run slow. A generous timeout matters more
      // here than in most tests: a timed-out test's `finally` is not
      // guaranteed to finish running before the process moves on, and this
      // one is what restores 5 real catalog games' slider positions.
      const { data: originalRows, error: originalErr } = await service
        .from("games")
        .select("id, slider_position")
        .not("slider_position", "is", null)
        .order("slider_position", { ascending: true });
      if (originalErr) throw originalErr;
      const original = originalRows ?? [];

      try {
        // Clear every real slot — order doesn't matter for clearing, only
        // for restoring (uniqueness only ever blocks a SET, never a clear).
        for (const row of original) {
          const { error } = await service.from("games").update({ slider_position: null }).eq("id", row.id);
          if (error) throw error;
        }

        // --- assign into a genuinely empty slot ---
        const assignResult = await assignSliderSlot(gameA.id, 1);
        expect(assignResult.ok).toBe(true);
        const { data: aAfterAssign } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
        expect(aAfterAssign?.slider_position).toBe(1);

        // --- the DB unique index blocks a duplicate, bypassing the action entirely ---
        const { error: dupErr } = await service.from("games").update({ slider_position: 1 }).eq("id", gameB.id);
        expect(dupErr).not.toBeNull();
        expect(dupErr?.code).toBe("23505");
        const { data: bStillNull } = await service.from("games").select("slider_position").eq("id", gameB.id).single();
        expect(bStillNull?.slider_position).toBeNull();

        // --- second assign, different slot ---
        const assignResult2 = await assignSliderSlot(gameB.id, 2);
        expect(assignResult2.ok).toBe(true);

        // --- reorder: swap two occupied slots ---
        const swapResult = await reorderSliderSlot(2, "up");
        expect(swapResult.ok).toBe(true);
        if (swapResult.ok) {
          expect(swapResult.updates).toEqual([
            { gameId: gameB.id, sliderPosition: 1 },
            { gameId: gameA.id, sliderPosition: 2 },
          ]);
        }
        const { data: aAfterSwap } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
        const { data: bAfterSwap } = await service.from("games").select("slider_position").eq("id", gameB.id).single();
        expect(bAfterSwap?.slider_position).toBe(1);
        expect(aAfterSwap?.slider_position).toBe(2);

        // --- reorder: move into an empty adjacent slot (gameB@1, gameA@2, slot 3 empty) ---
        const moveResult = await reorderSliderSlot(2, "down");
        expect(moveResult.ok).toBe(true);
        if (moveResult.ok) expect(moveResult.updates).toEqual([{ gameId: gameA.id, sliderPosition: 3 }]);
        const { data: aAfterMove } = await service.from("games").select("slider_position").eq("id", gameA.id).single();
        expect(aAfterMove?.slider_position).toBe(3);

        // --- reorder: no slot further in that direction is rejected, not a silent no-op ---
        const edgeResult = await reorderSliderSlot(1, "up");
        expect(edgeResult.ok).toBe(false);
        const { data: bStillAt1 } = await service.from("games").select("slider_position").eq("id", gameB.id).single();
        expect(bStillAt1?.slider_position).toBe(1);

        // --- reorder: target slot itself empty is a no-op success ---
        const noopResult = await reorderSliderSlot(2, "down");
        expect(noopResult.ok).toBe(true);
        if (noopResult.ok) expect(noopResult.updates).toEqual([]);

        // --- remove ---
        const removeResult = await removeFromSliderSlot(gameB.id);
        expect(removeResult.ok).toBe(true);
        const { data: bAfterRemove } = await service.from("games").select("slider_position").eq("id", gameB.id).single();
        expect(bAfterRemove?.slider_position).toBeNull();
      } finally {
        // Clear whatever test games ended up holding a slot, then restore
        // every real game to its exact original position. Two passes
        // (clear-all, then set-all) so a partial restore never trips the
        // unique index against a still-occupied slot.
        for (const id of [gameA.id, gameB.id, gameC.id]) {
          await deleteWithRetry(
            () => service.from("games").update({ slider_position: null }).eq("id", id),
            `clear test game ${id}`,
          );
        }
        for (const row of original) {
          await deleteWithRetry(
            () => service.from("games").update({ slider_position: row.slider_position }).eq("id", row.id),
            `restore ${row.id}`,
          );
        }

        const { data: finalState } = await service
          .from("games")
          .select("id, slider_position")
          .not("slider_position", "is", null)
          .order("slider_position", { ascending: true });
        expect(finalState).toEqual(original);
      }
    }, 120_000);
  },
);
