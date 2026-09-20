import { describe, expect, it } from "vitest";
import { gameFormSchema } from "@/src/lib/validation";

/**
 * Regression cover for the bug that made every seeded game unsaveable:
 * cover_image_url/trailer_url/setup_guide were required-and-absolute, but
 * the seeded catalog stores a root-relative cover and empty trailer/guide,
 * so opening any existing game in the admin form and pressing Save failed
 * on three fields the admin never touched.
 */

/** Minimal valid payload; each test overrides only what it's exercising. */
function base(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test Game",
    slug: "test-game",
    description: "A description.",
    price: "1000",
    costPrice: "",
    genre: "Shooter",
    productType: "game",
    platform: "ps4",
    coverImageUrl: "",
    trailerUrl: "",
    setupGuide: "",
    isActive: true,
    isNewArrival: false,
    isBestSeller: false,
    releaseDate: "",
    setupGuideId: "",
    ...overrides,
  };
}

describe("gameFormSchema — the three fields that blocked every seeded game", () => {
  it("accepts a seeded row's exact shape: relative cover, empty trailer, empty setup guide", () => {
    const result = gameFormSchema.safeParse(
      base({ coverImageUrl: "/game-cover-placeholder.png", trailerUrl: "", setupGuide: "" }),
    );
    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
  });

  it("still accepts an absolute http(s) cover URL", () => {
    for (const url of ["https://cdn.example.com/a.png", "http://cdn.example.com/a.png"]) {
      const result = gameFormSchema.safeParse(base({ coverImageUrl: url }));
      expect(result.success, url).toBe(true);
    }
  });

  it("rejects a cover value that is neither a root-relative path nor an http(s) URL", () => {
    // "//evil.com/x" is protocol-relative — a browser reads it as a HOST,
    // not a path, so it must not pass the relative-path branch.
    for (const bad of ["not a url", "//evil.com/x", "javascript:alert(1)", "C:\\x.png"]) {
      const result = gameFormSchema.safeParse(base({ coverImageUrl: bad }));
      expect(result.success, bad).toBe(false);
    }
  });

  it("accepts an empty trailer but still rejects a malformed one", () => {
    expect(gameFormSchema.safeParse(base({ trailerUrl: "" })).success).toBe(true);
    expect(
      gameFormSchema.safeParse(base({ trailerUrl: "https://youtube.com/watch?v=x" })).success,
    ).toBe(true);
    expect(gameFormSchema.safeParse(base({ trailerUrl: "nonsense" })).success).toBe(false);
  });

  it("accepts an empty setup guide", () => {
    expect(gameFormSchema.safeParse(base({ setupGuide: "" })).success).toBe(true);
    expect(gameFormSchema.safeParse(base({ setupGuide: "   " })).success).toBe(true);
  });

  it("does not loosen the fields that genuinely are required", () => {
    expect(gameFormSchema.safeParse(base({ title: "" })).success).toBe(false);
    expect(gameFormSchema.safeParse(base({ slug: "" })).success).toBe(false);
    // description is NOT in this list — see the membership-product case below.
    expect(gameFormSchema.safeParse(base({ price: "0" })).success).toBe(false);
    expect(gameFormSchema.safeParse(base({ slug: "Not A Slug" })).success).toBe(false);
  });

  it("accepts an empty description — the 3 seeded membership products have none", () => {
    expect(gameFormSchema.safeParse(base({ description: "" })).success).toBe(true);
  });

  it("keeps cost price optional and rejects a negative one", () => {
    expect(gameFormSchema.safeParse(base({ costPrice: "" })).success).toBe(true);
    const zero = gameFormSchema.safeParse(base({ costPrice: "0" }));
    expect(zero.success).toBe(true);
    expect(gameFormSchema.safeParse(base({ costPrice: "-1" })).success).toBe(false);
  });

  it("transforms blank optional values to the shapes the action expects", () => {
    const result = gameFormSchema.safeParse(base({ costPrice: "", releaseDate: "", setupGuideId: "" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.costPrice).toBeNull();
    expect(result.data.releaseDate).toBeNull();
    expect(result.data.setupGuideId).toBeNull();
  });
});

/**
 * End-to-end through the form's own parse step: takes the raw string
 * values the dialog holds and proves they survive validation into the
 * shape updateGame consumes. This is the path that used to fail for
 * every seeded game.
 */
describe("a seeded game's raw form values survive validation intact", () => {
  it("parses a membership row (empty description/cover/trailer/guide) into a usable payload", () => {
    const result = gameFormSchema.safeParse(
      base({
        title: "PlayStation Plus",
        slug: "playstation-plus",
        description: "",
        price: "10000",
        costPrice: "6000",
        coverImageUrl: "/game-cover-placeholder.png",
        trailerUrl: "",
        setupGuide: "",
      }),
    );

    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
    if (!result.success) return;

    expect(result.data.title).toBe("PlayStation Plus");
    expect(result.data.price).toBe(10000);
    expect(result.data.costPrice).toBe(6000);
    expect(result.data.coverImageUrl).toBe("/game-cover-placeholder.png");
    expect(result.data.trailerUrl).toBe("");
    expect(result.data.setupGuide).toBe("");
    expect(result.data.description).toBe("");
  });
});

/**
 * The membership products carry genre = NULL. A controlled
 * <select value={null}> still displays the first option, so the form
 * looked valid while the parsed value was null — z.enum rejected it,
 * handleSave bailed, and because genre is excluded from TEXT_FIELDS no
 * error ever rendered. The Save button simply did nothing.
 */
describe("genre — required for a game, optional for a membership", () => {
  it("rejects a game with no genre", () => {
    const result = gameFormSchema.safeParse(base({ productType: "game", genre: "" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    // The issue is reported ON the genre field, which is what lets the
    // dialog render an error next to the select instead of failing mute.
    expect(result.error.issues.some((i) => i.path[0] === "genre")).toBe(true);
  });

  it("accepts a membership with no genre, and normalises it to null", () => {
    const result = gameFormSchema.safeParse(
      base({ productType: "membership", genre: "", description: "", coverImageUrl: "", trailerUrl: "", setupGuide: "" }),
    );
    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.genre).toBeNull();
  });

  it("still accepts a membership that does carry a genre", () => {
    const result = gameFormSchema.safeParse(base({ productType: "membership", genre: "RPG" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.genre).toBe("RPG");
  });

  it("accepts every real genre value for a game", () => {
    for (const genre of ["Action", "RPG", "Shooter", "Horror"]) {
      expect(gameFormSchema.safeParse(base({ genre })).success, genre).toBe(true);
    }
  });

  it("rejects a genre outside the enum", () => {
    expect(gameFormSchema.safeParse(base({ genre: "Roguelike" })).success).toBe(false);
  });

  it("rejects a null platform — platform is still required for both types", () => {
    expect(gameFormSchema.safeParse(base({ platform: null })).success).toBe(false);
  });

  it("parses the exact shape of a seeded membership row end to end", () => {
    const result = gameFormSchema.safeParse(
      base({
        title: "PS Plus Extra & Premium",
        slug: "ps-plus-extra-premium",
        productType: "membership",
        genre: "",
        description: "",
        price: "1500",
        costPrice: "900",
        coverImageUrl: "/game-cover-placeholder.png",
        trailerUrl: "",
        setupGuide: "",
      }),
    );
    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
    if (!result.success) return;
    expect(result.data.genre).toBeNull();
    expect(result.data.costPrice).toBe(900);
  });
});
