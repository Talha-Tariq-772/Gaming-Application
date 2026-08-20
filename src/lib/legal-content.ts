/**
 * ============================================================================
 * PLACEHOLDER CONTENT — none of this is binding legal language.
 *
 * Every page here is scaffolding: real structure and headings, but the
 * substantive terms (windows, jurisdictions, contact details, refund
 * mechanics) are either lifted from mock data already in this codebase
 * (business hours, WhatsApp number, "Nova Games (Pvt) Ltd" as the entity
 * name from the bank-transfer payment method) or explicitly marked
 * **[PLACEHOLDER: ...]** for the business owner to decide and a lawyer to
 * review before this ever governs a real transaction. Same pattern as
 * mock-guides.ts's guide/FAQ content — swap before launch.
 * ============================================================================
 */

export interface LegalPage {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  body: string;
}

export const LEGAL_PAGES: Record<string, LegalPage> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    description:
      "The terms governing orders, payment, and delivery on Nova. Placeholder copy — not yet reviewed by counsel.",
    updatedAt: "2026-03-01T00:00:00.000Z",
    body: `These terms cover your use of Nova and any order you place with us. By placing an order, you agree to them.

## Who We Are

Nova is operated by **[PLACEHOLDER: legal entity name, likely "Nova Games (Pvt) Ltd" — confirm against actual company registration]**, registered in **[PLACEHOLDER: jurisdiction / registration number]**.

## Orders and Pricing

Prices shown at checkout are final at the moment you check out — see [How Payment Verification Works](/guides/how-payment-verification-works) for how your payment is matched to your order. Placing an order reserves your items for 45 minutes; if payment isn't claimed within that window, the reservation releases automatically.

## Payment Verification

We don't currently use an automated payment gateway. Every order is verified manually against a screenshot sent to our WhatsApp support line, matched by the exact (uniquely offset) amount requested at checkout. See our [FAQ](/faq) for typical turnaround.

## Delivery of Credentials

Once an order is approved, game credentials are made available once via your account's order page. See our [Refund Policy](/refund-policy) for what "once revealed" means for refund eligibility — this is the single most important thing to read before checkout.

## Acceptable Use

You agree not to resell, redistribute, or share delivered credentials outside your own use, and not to attempt to circumvent our manual verification process (e.g. submitting a screenshot for a payment that wasn't actually sent).

## Account Stock and Availability

Most credentials are drawn from a shared pool of accounts we manage rather than keys generated fresh per sale. **[PLACEHOLDER: any additional disclaimers the business wants here about shared-account risk, beyond what's already covered in the refund policy]**.

## Limitation of Liability

**[PLACEHOLDER: liability cap / disclaimer language — needs review by a lawyer familiar with the relevant jurisdiction before publishing]**.

## Governing Law

**[PLACEHOLDER: governing law and dispute-resolution jurisdiction]**.

## Changes to These Terms

We may update these terms from time to time. Material changes will be reflected by the "last updated" date on this page.

## Contact

Questions about these terms — see our [Contact page](/contact).`,
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description:
      "What information Nova collects, why, and how it's used. Placeholder copy — not yet reviewed by counsel.",
    updatedAt: "2026-03-01T00:00:00.000Z",
    body: `This describes what information we collect when you use Nova, and what we do with it.

## Information We Collect

Placing an order requires a name and phone number — see [Setting Up and Securing Your Nova Account](/guides/setting-up-your-account) for how that's used. We also keep a record of your orders, the payment method you selected, and the screenshot you send us on WhatsApp for verification purposes.

## What We Don't Collect

We never see or store your card, bank, or wallet login details — payment verification happens by matching an amount and reviewing a screenshot you choose to send us, not by processing a transaction ourselves.

## How We Use Information

Your phone number is used to verify your account and to reach you about a specific order (a payment mismatch, a stock question, anything time-sensitive). Order history is kept so you can view past purchases and revealed credentials from your account page.

## Cookies and Analytics

**[PLACEHOLDER: disclose any analytics, ad tracking, or cookie usage actually in place — none is implemented in this build]**.

## Data Retention

**[PLACEHOLDER: how long order records, phone numbers, and support conversations are retained]**.

## Third Parties

We use WhatsApp to receive payment screenshots and communicate about orders — messages sent there are subject to WhatsApp's own privacy terms. **[PLACEHOLDER: any other third-party processors, e.g. SMS verification provider]**.

## Your Rights

**[PLACEHOLDER: data access/deletion rights, phrased according to whichever privacy regulation actually applies to this business's customers]**.

## Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by the "last updated" date on this page.

## Contact

Questions about this policy — see our [Contact page](/contact).`,
  },

  "refund-policy": {
    slug: "refund-policy",
    title: "Refund Policy",
    description:
      "When a refund is available, when it isn't, and what happens if an account stops working or a payment can't be verified.",
    updatedAt: "2026-03-01T00:00:00.000Z",
    body: `Read this before you check out — it's linked from the payment step for a reason. This is the single policy that gets referenced most often when something goes wrong with an order.

## Credentials Are Non-Refundable Once Revealed

Once you reveal a game's login credentials from your order page, that item is considered delivered and is **not eligible for a refund**, regardless of reason — including a change of mind, buyer's remorse, or deciding you no longer want the game. The reveal is deliberately one-time and irreversible (see [Managing Your Game Credentials](/guides/managing-game-credentials)), which is why checkout requires you to actively confirm you understand this before you can mark an order as paid.

If you haven't revealed credentials yet, contact us before you do — once revealed, this policy is final.

## If an Account Stops Working

Because most credentials come from a shared pool of accounts rather than keys generated fresh per order, there's a small risk an account gets locked, flagged, or otherwise stops working after delivery — see [What Happens If an Account Stops Working](/guides/account-stopped-working) for why this can happen.

If this happens to you within **[PLACEHOLDER: the specific time window, e.g. "7 days" or "14 days" — a business decision, not a technical one]** of delivery, message us with your order reference and a description of the issue. We will do one of the following, at our discretion:

- Restore access to the original account
- Swap you to a working replacement account from our pool
- Issue store credit or a refund for that item, if neither of the above is possible

Outside that window, **[PLACEHOLDER: does support/replacement continue on a case-by-case basis, or does eligibility end entirely? — business decision]**.

This does not cover accounts that stop working because of changes you made to the account yourself (password, 2FA, linked email) after delivery.

## If Payment Cannot Be Verified

Every order has a 45-minute reservation window to complete payment. If that window closes before you claim payment, the reservation simply expires — no charge was ever taken, so there's nothing to refund; you're free to check out again.

If you *did* send a payment but we can't match it to your order (the amount doesn't line up, or the reservation expired before we could verify it), contact us with proof of payment. **[PLACEHOLDER: exact resolution process and timeline the business commits to for unmatched payments]**.

We do not reject a claimed payment outright for an honest amount mismatch — see [How Payment Verification Works](/guides/how-payment-verification-works) — we'll reach out first to sort it out.

## [PLACEHOLDER] Refund Method and Processing Time

**[PLACEHOLDER: how an approved refund is actually paid out — same method it arrived by? store credit only? — and how many business days it takes]**.

## [PLACEHOLDER] Chargebacks

**[PLACEHOLDER: policy on bank/card chargebacks or wallet disputes filed outside this process — most manual-verification storefronts state that a chargeback after credential delivery may result in account suspension; confirm the business's actual stance before publishing]**.

## [PLACEHOLDER] Exceptions

**[PLACEHOLDER: any additional exceptions the business wants carved out — bulk orders, promotional pricing, etc.]**.

## Questions

If you're unsure whether your situation is covered, ask before revealing credentials — see our [Contact page](/contact) or message us on WhatsApp from your order page.`,
  },

  about: {
    slug: "about",
    title: "About",
    description: "What Nova is and how it works.",
    updatedAt: "2026-03-01T00:00:00.000Z",
    body: `## What We Do

Nova is a curated storefront for game accounts and keys across PC, PlayStation 5, Xbox, and Nintendo Switch — see [Which Platforms Do You Support](/faq#faq-platforms-supported). Browse the catalog, check out, and get your credentials once a real person on our team has verified your payment.

## Why Manual Verification

We don't currently have automatic payment gateway integration, so every order is checked by a person rather than a machine — see [How Payment Verification Works](/guides/how-payment-verification-works) for exactly how that works and why we built it this way. It's slower than an instant card checkout, but it means no chargebacks, no payment gateway fees eating into prices, and a real person double-checking every order before anything is delivered.

## Our Story

**[PLACEHOLDER: founding story / mission statement — how and why this business started]**.

## The Team

**[PLACEHOLDER: team bios, or a simple statement about company size/structure]**.

## Company Details

Nova is operated by **[PLACEHOLDER: legal entity name — see Terms of Service]**. Registered address: **[PLACEHOLDER]**.

## Get in Touch

Questions, feedback, or partnership inquiries — see our [Contact page](/contact).`,
  },

  contact: {
    slug: "contact",
    title: "Contact",
    description:
      "How to reach Nova support — WhatsApp, operating hours, and where to look first.",
    updatedAt: "2026-03-01T00:00:00.000Z",
    body: `## Fastest: WhatsApp

For anything order-specific — a payment question, a credential issue, a stuck reservation — message us on WhatsApp. If you already have an order, use the WhatsApp link on your order page so your reference is included automatically; otherwise use the button below.

## Operating Hours

We're online **9am–9pm PKT**, every day. Messages sent outside those hours are picked up first thing the next morning — see [How Long Does Verification Take](/faq#faq-verification-time).

## Check the FAQ and Guides First

Most questions about payment, redemption, and account issues are already answered — try the [FAQ](/faq) or [Guides](/guides) before messaging us, especially outside business hours.

## Other Ways to Reach Us

- Email: **[PLACEHOLDER: support email address]**
- Business inquiries: **[PLACEHOLDER: separate contact for partnerships/press, if any]**
- Registered address: **[PLACEHOLDER]**

## Legal and Policy Questions

For anything about your rights or our policies specifically, see [Terms of Service](/terms), [Privacy Policy](/privacy), or [Refund Policy](/refund-policy).`,
  },
};

export function getLegalPage(slug: string): LegalPage | null {
  return LEGAL_PAGES[slug] ?? null;
}
