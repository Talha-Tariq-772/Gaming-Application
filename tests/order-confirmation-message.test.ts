import { describe, expect, it } from "vitest";
import {
  BUSINESS_HOURS_PKT,
  ORDER_READY_ESTIMATE,
  SUPPORT_WHATSAPP_NUMBER,
  buildCustomerWhatsAppLink,
  buildOrderConfirmedMessage,
  buildWhatsAppLink,
} from "@/src/lib/order";
import { toWaMeNumber } from "@/src/lib/phone";
import type { Order } from "@/src/types/database";

/**
 * The confirmation an admin sends after approving a payment. Pure — no
 * database, no browser — so it runs in the fast unit pass.
 */

const order = { paymentReference: "PSC-K5QT75", amountExact: 3900.08 };

function decodedText(link: string): string {
  return decodeURIComponent(link.split("?text=")[1]);
}

describe("buildOrderConfirmedMessage", () => {
  const message = buildOrderConfirmedMessage(
    order,
    [{ title: "Battlefield 6" }, { title: "PSN $10 Gift Card (US)", variant: "PlayStation Network, US, 10 USD" }],
    "JazzCash",
  );
  const lines = message.split("\n");

  it("leads with the order reference on its own line", () => {
    // Same layout as the buyer's own handoff message, so the reference is
    // the first thing either side sees and pastes back out cleanly.
    expect(lines[0]).toBe("PSC-K5QT75");
    expect(lines[1]).toBe("");
  });

  it("confirms payment received and the order confirmed", () => {
    expect(message).toMatch(/Payment received/);
    expect(message).toMatch(/order is confirmed/);
  });

  it("lists every item, with a variant where the item has one", () => {
    expect(lines).toContain("Battlefield 6");
    expect(lines).toContain("PSN $10 Gift Card (US) (PlayStation Network, US, 10 USD)");
  });

  it("states the exact amount, paisa included, and the payment method", () => {
    // formatPriceExact, not formatPrice: "Rs 3,900" would not match the
    // amount the customer actually transferred.
    expect(lines).toContain("Rs 3,900.08");
    expect(lines).toContain("JazzCash");
  });

  it("gives the same processing window the storefront promises", () => {
    expect(ORDER_READY_ESTIMATE).toBe("1–2 hours");
    expect(message).toContain(`within ${ORDER_READY_ESTIMATE}`);
    expect(message).toContain(BUSINESS_HOURS_PKT);
  });

  it("orders its parts: reference, confirmation, items, amount, method, timing", () => {
    const at = (needle: string) => message.indexOf(needle);
    expect(at("PSC-K5QT75")).toBeLessThan(at("Payment received"));
    expect(at("Payment received")).toBeLessThan(at("Battlefield 6"));
    expect(at("Battlefield 6")).toBeLessThan(at("Rs 3,900.08"));
    expect(at("Rs 3,900.08")).toBeLessThan(at("JazzCash"));
    expect(at("JazzCash")).toBeLessThan(at(ORDER_READY_ESTIMATE));
  });

  it("is plain text — no WhatsApp markdown that would render literally", () => {
    expect(message).not.toMatch(/[*_~`]/);
  });

  it("says nothing about how the order is delivered", () => {
    // Site-wide copy rules: confirm payment, confirm order, give a window.
    expect(message).not.toMatch(/credential|password|login|account|screenshot/i);
  });

  it("omits the method line cleanly when there is no method on the order", () => {
    const noMethod = buildOrderConfirmedMessage(order, [{ title: "Battlefield 6" }], null);
    expect(noMethod).not.toMatch(/null|undefined/);
    const noMethodLines = noMethod.split("\n");
    const amountIdx = noMethodLines.indexOf("Rs 3,900.08");
    expect(noMethodLines[amountIdx + 1]).toBe("");
  });
});

describe("toWaMeNumber", () => {
  it("accepts both stored phone formats and returns wa.me's digits-only form", () => {
    expect(toWaMeNumber("+92 300 1234567")).toBe("923001234567"); // profiles.phone_number
    expect(toWaMeNumber("+923001234567")).toBe("923001234567"); // orders.guest_phone
    expect(toWaMeNumber("03001234567")).toBe("923001234567");
  });

  it("returns null for nothing usable rather than a broken number", () => {
    expect(toWaMeNumber(null)).toBeNull();
    expect(toWaMeNumber(undefined)).toBeNull();
    expect(toWaMeNumber("")).toBeNull();
    expect(toWaMeNumber("021 1234567")).toBeNull(); // landline
    expect(toWaMeNumber("hello")).toBeNull();
  });
});

describe("buildCustomerWhatsAppLink", () => {
  const text = buildOrderConfirmedMessage(order, [{ title: "Battlefield 6" }], "JazzCash");

  it("targets the CUSTOMER's number, not our support line", () => {
    const link = buildCustomerWhatsAppLink(toWaMeNumber("+92 300 1234567"), text)!;
    expect(link.startsWith("https://wa.me/923001234567?text=")).toBe(true);
    expect(link).not.toContain(SUPPORT_WHATSAPP_NUMBER);
  });

  it("carries the message intact through URL encoding, newlines and dashes included", () => {
    const link = buildCustomerWhatsAppLink("923001234567", text)!;
    expect(decodedText(link)).toBe(text);
    // Raw newlines/spaces must not appear in the URL itself.
    expect(link).not.toMatch(/\s/);
  });

  it("returns null with no number, so no caller renders wa.me/null", () => {
    expect(buildCustomerWhatsAppLink(null, text)).toBeNull();
  });

  it("is a different recipient from the buyer's own handoff link", () => {
    // The buyer -> us link and the us -> buyer link must never be
    // confused: that was the bug in the admin panel's old "Message
    // customer" link, which opened our own support chat.
    const buyerToUs = buildWhatsAppLink(
      { ...order, id: "x" } as unknown as Order,
      [{ title: "Battlefield 6" }],
      "JazzCash",
    );
    const usToBuyer = buildCustomerWhatsAppLink("923001234567", text)!;
    expect(buyerToUs).toContain(`wa.me/${SUPPORT_WHATSAPP_NUMBER}`);
    expect(usToBuyer).toContain("wa.me/923001234567");
  });
});
