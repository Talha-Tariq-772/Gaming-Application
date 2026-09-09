import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bufferToBytea, encrypt } from "@/src/lib/crypto";
import { deleteWithRetry, runCleanupSteps } from "./helpers/cleanup";
import { randomTestPhone } from "./helpers/phone";
import { collectText, findAllElementsOfType } from "./helpers/react-tree";

/**
 * /library is a Server Component reading next/headers cookies() via the
 * session client — same constraint, same fix as header-auth.test.ts: mock
 * the session client to a real, already-signed-in Supabase client, then
 * call the page function directly and inspect the returned tree.
 *
 * "Shows only each user's own games" is fundamentally an RLS guarantee
 * (getOrdersForUser relies entirely on auth.uid()-scoped RLS, same as
 * /account) — this test proves it end to end through the real pipeline:
 * real createOrder -> claimPayment -> approveOrder, then the real page.
 */
const sessionState = vi.hoisted(() => ({ client: null as SupabaseClient | null }));

vi.mock("@/src/lib/supabase/server-session", () => ({
  createClient: async () => sessionState.client,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const { default: LibraryPage } = await import("@/app/(storefront)/library/page");
const { default: LibraryCard } = await import("@/src/components/library/LibraryCard");
const { createOrder, claimPayment } = await import("@/src/lib/actions/checkout");
const { approveOrder } = await import("@/src/lib/actions/admin-orders");

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


async function seedGame(title: string, price: number) {
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

  const { error: credErr } = await service.from("game_credentials").insert({
    game_id: game.id,
    login_enc: bufferToBytea(encrypt(`login-${game.id}`)),
    password_enc: bufferToBytea(encrypt(`password-${game.id}`)),
    status: "available",
  });
  if (credErr) throw credErr;

  return game as { id: string; price: number };
}

const run = randomUUID().slice(0, 8);
const password = `LibraryTest!${randomUUID()}`;

let customerA: { id: string; email: string };
let customerB: { id: string; email: string };
let customerEmpty: { id: string; email: string };
let adminUser: { id: string; email: string };
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let clientEmpty: SupabaseClient;
let clientAdmin: SupabaseClient;
let paymentMethod: { id: string };

const gameIds: string[] = [];
const orderIds: string[] = [];

beforeAll(async () => {
  const { data: createdA, error: errA } = await service.auth.admin.createUser({
    email: `library-a-${run}@example.com`,
    password,
    email_confirm: true,
  });
  if (errA) throw errA;
  customerA = { id: createdA.user.id, email: createdA.user.email! };
  const { error: updA } = await service.from("profiles").update({ phone_number: randomTestPhone() }).eq("id", customerA.id);
  if (updA) throw updA;

  const { data: createdB, error: errB } = await service.auth.admin.createUser({
    email: `library-b-${run}@example.com`,
    password,
    email_confirm: true,
  });
  if (errB) throw errB;
  customerB = { id: createdB.user.id, email: createdB.user.email! };
  const { error: updB } = await service.from("profiles").update({ phone_number: randomTestPhone() }).eq("id", customerB.id);
  if (updB) throw updB;

  const { data: createdEmpty, error: errEmpty } = await service.auth.admin.createUser({
    email: `library-empty-${run}@example.com`,
    password,
    email_confirm: true,
  });
  if (errEmpty) throw errEmpty;
  customerEmpty = { id: createdEmpty.user.id, email: createdEmpty.user.email! };
  const { error: updEmpty } = await service
    .from("profiles")
    .update({ phone_number: randomTestPhone() })
    .eq("id", customerEmpty.id);
  if (updEmpty) throw updEmpty;

  const { data: createdAdmin, error: errAdmin } = await service.auth.admin.createUser({
    email: `library-admin-${run}@example.com`,
    password,
    email_confirm: true,
  });
  if (errAdmin) throw errAdmin;
  adminUser = { id: createdAdmin.user.id, email: createdAdmin.user.email! };
  const { data: updatedAdmin, error: updAdmin } = await service
    .from("profiles")
    .update({ phone_number: randomTestPhone(), role: "admin" })
    .eq("id", adminUser.id)
    .select("role")
    .single();
  if (updAdmin) throw updAdmin;
  if (updatedAdmin.role !== "admin") {
    throw new Error(`admin promotion did not take: role is ${updatedAdmin.role}`);
  }

  clientA = await signedInClient(customerA.email, password);
  clientB = await signedInClient(customerB.email, password);
  clientEmpty = await signedInClient(customerEmpty.email, password);
  clientAdmin = await signedInClient(adminUser.email, password);

  const { data: pm, error: pmErr } = await service
    .from("payment_methods")
    .insert({ label: `Library Test Bank ${run}`, account_title: "Test", account_number: "0000000000" })
    .select("id")
    .single();
  if (pmErr) throw pmErr;
  paymentMethod = pm;
});

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
      label: "customerEmpty",
      run: async () => {
        if (customerEmpty?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(customerEmpty.id), "customerEmpty");
      },
    },
    {
      label: "adminUser",
      run: async () => {
        if (adminUser?.id) await deleteWithRetry(() => service.auth.admin.deleteUser(adminUser.id), "adminUser");
      },
    },
  ]);
}, 100_000); // 10 independent steps, each capped at 8s worst case (see tests/helpers/cleanup.ts)

describe("/library — real per-user isolation", () => {
  it("shows only each signed-in user's own approved games, never the other user's", async () => {
    const gameA = await seedGame(`Library Owned A ${run}`, 1500);
    const gameB = await seedGame(`Library Owned B ${run}`, 2500);
    gameIds.push(gameA.id, gameB.id);

    // Customer A buys and gets approved for gameA.
    sessionState.client = clientA;
    const orderA = await createOrder(customerA.id, [{ kind: "credential", gameId: gameA.id, paymentMethodId: paymentMethod.id }], `+9230${run}A1`);
    expect(orderA.ok).toBe(true);
    if (!orderA.ok) return;
    orderIds.push(orderA.order.id);
    const claimedA = await claimPayment(orderA.order.id);
    expect(claimedA.ok).toBe(true);

    sessionState.client = clientAdmin;
    const approvedA = await approveOrder(orderA.order.id, adminUser.id);
    expect(approvedA.ok).toBe(true);

    // Customer B buys and gets approved for gameB.
    sessionState.client = clientB;
    const orderB = await createOrder(customerB.id, [{ kind: "credential", gameId: gameB.id, paymentMethodId: paymentMethod.id }], `+9230${run}B1`);
    expect(orderB.ok).toBe(true);
    if (!orderB.ok) return;
    orderIds.push(orderB.order.id);
    const claimedB = await claimPayment(orderB.order.id);
    expect(claimedB.ok).toBe(true);

    sessionState.client = clientAdmin;
    const approvedB = await approveOrder(orderB.order.id, adminUser.id);
    expect(approvedB.ok).toBe(true);

    // Customer A's library: sees gameA, never gameB. LibraryCard is given
    // `game`/`orderId` as props, not children — collectText can't see
    // inside a custom component's own render (that only happens through a
    // real renderer, which this deliberately isn't), so assert on the
    // LibraryCard elements' props directly instead, same approach as
    // header-auth.test.ts inspecting HeaderAuthMenu's props.
    sessionState.client = clientA;
    const libraryA = await LibraryPage();
    const cardsA = findAllElementsOfType<{ game: { title: string }; orderId: string }>(libraryA, LibraryCard);
    const titlesA = cardsA.map((c) => c.props.game.title);
    expect(titlesA).toContain(`Library Owned A ${run}`);
    expect(titlesA).not.toContain(`Library Owned B ${run}`);
    expect(cardsA.find((c) => c.props.game.title === `Library Owned A ${run}`)?.props.orderId).toBe(orderA.order.id);

    // Customer B's library: sees gameB, never gameA.
    sessionState.client = clientB;
    const libraryB = await LibraryPage();
    const cardsB = findAllElementsOfType<{ game: { title: string }; orderId: string }>(libraryB, LibraryCard);
    const titlesB = cardsB.map((c) => c.props.game.title);
    expect(titlesB).toContain(`Library Owned B ${run}`);
    expect(titlesB).not.toContain(`Library Owned A ${run}`);
  }, 40_000);

  it("shows the empty state (with a link to /games) for a user with no orders at all", async () => {
    sessionState.client = clientEmpty;
    const library = await LibraryPage();
    const text = collectText(library).join(" ");
    expect(text).toContain("No purchases yet");
    expect(text).toContain("Browse Store");
    expect(text).not.toContain("View setup guide");
  });
});
