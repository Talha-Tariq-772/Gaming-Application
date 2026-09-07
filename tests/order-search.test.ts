import { describe, expect, it } from "vitest";
import { matchesOrderSearch, referenceCore } from "@/src/lib/order-search";

function order(paymentReference: string, guestPhone: string | null = null) {
  return { paymentReference, guestPhone };
}

describe("referenceCore", () => {
  it("strips the PSC- prefix, case-insensitively", () => {
    expect(referenceCore("PSC-4K7M2Q")).toBe("4K7M2Q");
    expect(referenceCore("psc-4k7m2q")).toBe("4K7M2Q");
  });

  it("strips the legacy GK- prefix", () => {
    expect(referenceCore("GK-A1B2")).toBe("A1B2");
    expect(referenceCore("gk-a1b2")).toBe("A1B2");
  });

  it("leaves a bare code (no prefix) as-is, uppercased", () => {
    expect(referenceCore("4k7m2q")).toBe("4K7M2Q");
  });

  it("trims surrounding whitespace from a paste", () => {
    expect(referenceCore("  PSC-4K7M2Q  ")).toBe("4K7M2Q");
    expect(referenceCore("\n4K7M2Q\t")).toBe("4K7M2Q");
  });
});

describe("matchesOrderSearch — by reference", () => {
  it("matches the full reference with the PSC- prefix", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "PSC-4K7M2Q")).toBe(true);
  });

  it("matches with a missing prefix", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "4K7M2Q")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "psc-4k7m2q")).toBe(true);
  });

  it("matches with surrounding whitespace from a paste", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "  PSC-4K7M2Q  ")).toBe(true);
  });

  it("matches a legacy GK- reference the same way", () => {
    expect(matchesOrderSearch(order("GK-A1B2"), null, "a1b2")).toBe(true);
    expect(matchesOrderSearch(order("GK-A1B2"), null, "GK-A1B2")).toBe(true);
  });

  it("does not match a different order's reference", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "PSC-ZZZZZZ")).toBe(false);
  });

  it("does not cross-match a PSC- order against a GK- style query or vice versa", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "GK-4K7M")).toBe(false);
  });
});

describe("matchesOrderSearch — by phone", () => {
  it("matches a guest order's guest_phone regardless of input format", () => {
    const o = order("PSC-4K7M2Q", "+923001234567");
    expect(matchesOrderSearch(o, null, "03001234567")).toBe(true);
    expect(matchesOrderSearch(o, null, "0300-123-4567")).toBe(true);
    expect(matchesOrderSearch(o, null, "+92 300 123 4567")).toBe(true);
    expect(matchesOrderSearch(o, null, "0092 300 1234567")).toBe(true);
  });

  it("matches a signed-in order's customer profile phone regardless of input format", () => {
    const o = order("PSC-9Q8W7E", null);
    expect(matchesOrderSearch(o, "+92 300 123 4567", "03001234567")).toBe(true);
    expect(matchesOrderSearch(o, "0300 123 4567", "+923001234567")).toBe(true);
  });

  it("does not match an unrelated phone number", () => {
    const o = order("PSC-4K7M2Q", "+923001234567");
    expect(matchesOrderSearch(o, null, "03211234567")).toBe(false);
  });

  it("does not match when the query isn't a valid reference or a valid phone", () => {
    const o = order("PSC-4K7M2Q", "+923001234567");
    expect(matchesOrderSearch(o, null, "not a reference or phone")).toBe(false);
  });

  it("an empty query matches nothing", () => {
    expect(matchesOrderSearch(order("PSC-4K7M2Q"), null, "   ")).toBe(false);
  });
});
