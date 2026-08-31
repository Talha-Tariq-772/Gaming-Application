import { describe, expect, it, vi } from "vitest";

/**
 * requireAdmin() always "succeeds" here — this suite isn't testing admin
 * auth (tests/admin-users.test.ts already covers requireAdmin against a
 * real session). Mocking it out means no live sign-in round trip per test.
 */
vi.mock("@/src/lib/auth/session", () => ({
  requireAdmin: async () => ({ id: "fake-admin-id", role: "admin", fullName: null, phoneNumber: null }),
}));

/**
 * The whole point of these tests is that an invalid platform never reaches
 * the database — so the service client itself throws if anything tries to
 * use it, turning "the action touched the DB when it shouldn't have" into a
 * loud test failure instead of a real (and unnecessary) network call. This
 * also means these tests add zero load to the live Supabase project, unlike
 * an earlier version of this file that created real users and rows —
 * removed after that started contributing to shared-DB test contention
 * (see vitest.config.ts's note on concurrent-auth flakiness).
 */
vi.mock("@/src/lib/supabase/server", () => ({
  createClient: () => {
    throw new Error("createGame/updateGame must not touch the database when platform is invalid");
  },
}));

const { createGame, updateGame } = await import("@/src/lib/actions/admin-games");
const { isValidGamePlatform } = await import("@/src/lib/admin-guardrails");

function baseGameInput(overrides: Partial<Parameters<typeof createGame>[0]> = {}) {
  return {
    title: "Test Game",
    slug: "test-game",
    description: "A test game.",
    price: 1000,
    genre: "Action" as const,
    platform: "ps5" as const,
    coverImageUrl: "https://placehold.co/1x1.png",
    trailerUrl: "https://example.com/trailer",
    setupGuide: "Install it.",
    isActive: true,
    isNewArrival: false,
    isBestSeller: false,
    releaseDate: null,
    setupGuideId: null,
    ...overrides,
  };
}

describe("isValidGamePlatform (pure guardrail logic)", () => {
  it("accepts every real value", () => {
    expect(isValidGamePlatform("ps4")).toBe(true);
    expect(isValidGamePlatform("ps5")).toBe(true);
    expect(isValidGamePlatform("ps4_ps5")).toBe(true);
    expect(isValidGamePlatform("xbox")).toBe(true);
  });

  it("rejects values outside the enum, including the pre-migration labels", () => {
    expect(isValidGamePlatform("PlayStation 5")).toBe(false);
    expect(isValidGamePlatform("PC")).toBe(false);
    expect(isValidGamePlatform("Nintendo Switch")).toBe(false);
    expect(isValidGamePlatform("")).toBe(false);
    expect(isValidGamePlatform(null)).toBe(false);
    expect(isValidGamePlatform(undefined)).toBe(false);
  });
});

/**
 * What these two add beyond the pure test above: proof that createGame/
 * updateGame actually call the guard on the way in and short-circuit
 * before the database client is even constructed — not just that
 * isValidGamePlatform itself is correct in isolation.
 */
describe("createGame/updateGame — reject an out-of-enum platform before ever constructing the database client", () => {
  it("createGame returns ok:false for a pre-migration platform label", async () => {
    // @ts-expect-error deliberately passing a value outside GamePlatform,
    // the same way a stale client or a raw request could.
    const input = baseGameInput({ platform: "PlayStation 5" });
    const result = await createGame(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/platform/i);
  });

  it("updateGame returns ok:false for a pre-migration platform label", async () => {
    // @ts-expect-error deliberately passing a value outside GamePlatform.
    const input = baseGameInput({ platform: "Xbox Series X" });
    const result = await updateGame("fake-game-id", input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/platform/i);
  });
});
