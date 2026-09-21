import { safeAsync } from "@/src/lib/safe-async";
import {
  GUIDE_CATEGORIES,
  type Guide,
  type GuideCategory,
} from "@/src/types/database";

/** Category display/sort order — GUIDE_CATEGORIES is deliberately NOT
 * alphabetical (getting-started should sort first), so every list here
 * sorts by this index rather than by localeCompare. */
function categoryRank(category: GuideCategory): number {
  return GUIDE_CATEGORIES.indexOf(category);
}

/**
 * ============================================================================
 * PLACEHOLDER CONTENT — pending real copy from the store owner.
 *
 * Every guide and FAQ answer below is realistic, plausible support content
 * written to match this store's actual flow (WhatsApp-verified manual
 * payments, exact-amount reconciliation, 45-minute reservation window,
 * PKT business hours) — but none of it has been reviewed or approved by
 * the business. Treat every word here as a stand-in to be replaced before
 * launch, not as final copy.
 * ============================================================================
 *
 * Mock data layer, same pattern as mock-data.ts: async functions with a
 * small artificial delay, so this can be swapped for real queries later
 * with no changes downstream.
 */

const NETWORK_DELAY_MS = 400;

function delay<T>(value: T, ms: number = NETWORK_DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Shared across the game detail page and the credential reveal page —
 * every game links to this one general redemption guide rather than a
 * per-platform article, since the guide itself covers all four platforms
 * as sections. */
export const REDEMPTION_GUIDE_SLUG = "redeem-your-game-key";

/** Linked from checkout step 3 (confirmation) while the buyer is waiting
 * on verification. */

/* ---------------------------------------------------------------------- */
/* Guides                                                                   */
/* ---------------------------------------------------------------------- */

export const MOCK_GUIDES: Guide[] = [
  {
    id: "guide-1",
    slug: REDEMPTION_GUIDE_SLUG,
    title: "How to Redeem Your Game Key",
    category: "getting-started",
    excerpt:
      "Step-by-step redemption instructions for every platform we sell on — PC, PlayStation 5, Xbox, and Nintendo Switch.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-03-18T10:00:00.000Z",
    body: `Once your order is approved, redeeming your game only takes a few minutes. Find your platform below.

## Before You Start

Make sure you've saved the sign-in details from your order page — they're only shown once. If you closed the page before copying them, contact us with your order reference and we'll help you get back in.

## PC (Steam)

1. Open Steam and sign in using the details on your order page. Most PC titles work this way rather than by entering a code.
2. If a specific redemption code was provided instead, go to **Library → Add a Game → Activate a Product on Steam** and paste it in.
3. Download and install from your Library like any other game.

## PlayStation 5

1. On your PS5, go to **PlayStation Store → Redeem Codes** from the sidebar.
2. Enter the code exactly as shown on your order page — codes are case-sensitive and don't include spaces.
3. Once redeemed, install the game from **Your Library**.

## Xbox (Series X|S and One)

1. Go to the **Microsoft Store** app and select **Redeem** from the menu (or visit redeem.microsoft.com on any browser signed into your Xbox account).
2. Enter the 25-character code shown on your order page.
3. Install from **My Library** once the redemption completes.

## Nintendo Switch

1. From the Switch home screen, open the **Nintendo eShop**.
2. Select your user icon, then **Redeem Code**.
3. Enter the code and confirm — download progress appears under **My Downloads**.

## Still Stuck?

If a code comes back as invalid or already used, don't try it more than two or three times — some platforms temporarily lock redemption after repeated failed attempts. Message us with your order reference instead and we'll check it from our side.`,
  },
  {
    id: "guide-2",
    slug: "first-order-walkthrough",
    title: "Placing Your First Order",
    category: "getting-started",
    excerpt:
      "A quick walkthrough from browsing the store to getting your order, for anyone buying from us for the first time.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-10T09:30:00.000Z",
    body: `New here? This is the whole process, start to finish.

## 1. Browse and Add to Cart

Filter by platform, genre, or price on the store page, and add whatever you're after to your cart. Prices shown are final — no hidden fees at checkout.

## 2. Choose a Payment Method

At checkout you'll pick from bank transfer, JazzCash, Easypaisa, SadaPay, or NayaPay. Pick whichever you already use — see our [accepted payment methods guide](/guides/accepted-payment-methods) if you're not sure which is fastest for you.

## 3. Send Payment and Confirm It

We'll show you an *exact* amount to send — it'll be a few rupees off your order total on purpose. That small difference is how we match your payment to your order, so send precisely that amount, not a rounded-up figure. Once you've paid, tap **I have made the payment** and upload a screenshot of the transaction.

You have 45 minutes from checkout to complete this before your reservation expires and the price/stock is released back.

## 4. Confirmation and Delivery

We check the payment against your reference — usually within an hour or two during business hours (9am–9pm PKT), sometimes faster. Once approved, your order status changes to **Approved** and everything you need becomes available on your order page.

That's it — see [how to redeem your game key](/guides/redeem-your-game-key) once your order is ready.`,
  },
  {
    id: "guide-3",
    slug: "how-payment-verification-works",
    title: "How Payment Confirmation Works",
    category: "payment",
    excerpt:
      "How the exact-amount matching works, and what to expect after you pay.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-03-22T13:15:00.000Z",
    body: `Every order is checked against the payment before it's approved. Here's exactly how that works.

## Why It Works This Way

Bank transfers, JazzCash, Easypaisa, and the other methods we support don't give us an instant way to tie a specific payment to a specific order. Checking each one takes a little longer than a card checkout, but it means no gateway fees eating into prices, and every order double-checked before it goes out.

## The Exact-Amount Trick

When you check out, we don't ask you to send a round number — we add a small random offset (a few rupees) to your total. That unique amount is how our team matches your incoming payment to your specific order without needing a reference number to line up perfectly. Always send the *exact* amount shown, including the odd paisa, not your cart total.

## Confirming Your Payment

After paying, tap **I have made the payment** on the checkout page, then upload a screenshot of the transaction — the confirmation screen from your banking app or wallet. We check it against what arrives on our side before approving the order.

Signed in? You can upload it later from **My Orders** instead. Checking out as a guest? You get a private link to your order that does the same thing, no sign-in needed. Either way you can swap the image for a different one right up until we review it.

## Typical Turnaround

Most orders are confirmed within 1–2 hours during business hours (9am–9pm PKT). Orders sent outside those hours are usually picked up first thing the next morning. Weekend and public holiday orders can take a little longer.

## If Something Looks Wrong

If the amount we receive doesn't match what was requested, we can't approve the order — we'll get in touch to sort it out, which usually just means confirming the amount and retrying. Orders aren't rejected outright for an honest mismatch; we'll always reach out first.`,
  },
  {
    id: "guide-4",
    slug: "accepted-payment-methods",
    title: "Accepted Payment Methods",
    category: "payment",
    excerpt:
      "Bank transfer, JazzCash, Easypaisa, SadaPay, and NayaPay — what each one needs from you and which is fastest.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-02-28T11:00:00.000Z",
    body: `We currently accept five payment methods. Speed comes down to how fast you can send the payment, not which method you pick — but a few notes below might help you choose.

## Bank Transfer

Works with any bank via online banking or an ATM transfer. Slightly slower to send than a wallet app if you don't already have online banking set up, but has no per-transaction limits to worry about for bigger orders.

## JazzCash

Fast if you already have the app installed — send via Mobile Account to the number shown at checkout. Our most commonly used method.

## Easypaisa

Same idea as JazzCash — send the exact amount to the account shown and you're done.

## SadaPay

Send via IBAN or account number directly in the app. Good if you already bank digitally-first.

## NayaPay

Send via IBAN, or transfer directly within the app if you're paying another NayaPay user.

## Choosing the Right One

If you're ordering during business hours and want the fastest possible turnaround, use whichever method you already have open and logged in — the few seconds saved not switching apps adds up more than any difference between the methods themselves.`,
  },
  {
    id: "guide-5",
    slug: "setting-up-your-account",
    title: "Getting Started with PSCBUNDLE",
    category: "account-setup",
    excerpt:
      "How ordering works the first time, verifying your phone number, and keeping your details safe.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-02-14T15:45:00.000Z",
    body: `Your order history and everything you've bought live in one place, reachable from **My Orders**.

## Ordering for the First Time

You'll be asked for your name and phone number the first time you check out. There's no separate signup step — just place your order and you're set.

## Verifying Your Phone Number

We verify phone numbers by SMS so we can reach you if there's an issue with an order (a payment mismatch, a stock question, anything time-sensitive). An unverified number can still place orders, but verification helps us reach you faster if something needs your attention.

## Keeping Your Details Safe

Access is tied to your verified phone number. Don't share your phone or any SMS codes with anyone claiming to be from our support team; we will never ask you to forward a verification code to us.`,
  },
  {
    id: "guide-6",
    slug: "managing-game-credentials",
    title: "Finding and Storing Your Order Details",
    category: "account-setup",
    excerpt:
      "Where to find everything after an order is approved, what not to change, and how to store it safely.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-05T09:00:00.000Z",
    body: `Once an order is approved, each item in it can be revealed on your order page.

## Where to Find Them

Go to **My Orders**, open the approved order, and you'll see a **Reveal** button under each item. Details are shown once per visit to that button — after revealing them, they stay visible on that page for as long as you're signed in, but treat the first reveal as your one chance to copy them down somewhere safe.

## Can I Change the Sign-in Details?

Please don't. We manage these on our side, and changing them can cut off your own access and void replacement or refund cover on your order. If you have a specific reason to change something, message us first and we'll walk you through it safely.

## Storing Them Safely

Use a password manager if you have one. If not, a private note is fine — just avoid anywhere publicly accessible, like an unencrypted note synced to a shared device.

## Sharing Devices

If you're playing on a shared family console or PC, sign out when you're done rather than leaving it signed in, especially on Xbox and PlayStation where a signed-in profile can trigger purchases or changes without a password prompt.`,
  },
  {
    id: "guide-7",
    slug: "game-key-not-working",
    title: "My Game Key Isn't Working",
    category: "troubleshooting",
    excerpt:
      "What to check first if a code won't redeem, plus the most common platform-specific causes.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-03-25T16:30:00.000Z",
    body: `Most redemption failures come down to one of a handful of causes. Work through these before reaching out — it'll save you a back-and-forth.

## Double-Check the Basics

- Copy the code again rather than retyping it — a single mismatched character (0 vs O, 1 vs I) is the most common cause of a failed redemption.
- Make sure there's no leading or trailing space if you copied it from your order page.
- Confirm you're signed in on the right platform profile — not a secondary or child profile.

## Common Platform-Specific Issues

**Steam:** if your order page shows sign-in details rather than a code, sign in with those directly rather than trying to activate a product code — most of our PC titles work this way.

**PlayStation / Xbox:** codes are region-locked to the storefront they were generated for. If your console's region doesn't match, redemption will fail even with a correct code — message us with your order reference and we'll check it.

**Nintendo Switch:** codes tied to a specific region's eShop behave the same way — a mismatch here is the usual cause if everything else checks out.

## Still Not Working?

Message us with your order reference and a screenshot of the error. Don't keep retrying more than 2–3 times — some platforms temporarily lock further attempts after repeated failures, which makes it harder for us to diagnose from our side too.`,
  },
  {
    id: "guide-8",
    slug: "account-stopped-working",
    title: "If Something Stops Working",
    category: "troubleshooting",
    excerpt:
      "What to do if an item stops working after purchase, what we'll do about it, and what we can't guarantee.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-15T14:00:00.000Z",
    body: `Occasionally an item stops working after you've already started using it. It's uncommon, but here's how we handle it.

## Why This Can Happen

Platforms run automated security checks that can't always tell a normal sign-in from a suspicious one — signing in from a new device or region sometimes triggers a temporary hold, independent of anything you did wrong.

## What We'll Do

If something stops working within a reasonable window after delivery, message us with your order reference and a description of what's happening (an error message, a "suspended" notice, anything specific helps). We'll either restore your access, swap you to a working replacement, or — if neither is possible — issue store credit or a refund for that item, on a case-by-case basis.

## What We Can't Guarantee

We can't promise a platform will never flag something down the line. We also can't help with issues caused by changing the sign-in or recovery details yourself after delivery (see [finding and storing your order details](/guides/managing-game-credentials)).

## Reducing the Risk

Avoid changing security-sensitive settings (password, 2FA, linked email) unless we've specifically told you to. The less you alter about how your order arrived, the less likely it is to trip a platform's automated checks.`,
  },
];

export interface GuideFilters {
  category?: GuideCategory;
  /** Case-insensitive match against title and excerpt. */
  search?: string;
}

export async function getGuides(filters: GuideFilters = {}): Promise<Guide[]> {
  return safeAsync("guides", async () => {
    const query = filters.search?.trim().toLowerCase();

    const results = MOCK_GUIDES.filter((guide) => {
      if (!guide.isPublished) return false;
      if (filters.category && guide.category !== filters.category) return false;
      if (
        query &&
        !guide.title.toLowerCase().includes(query) &&
        !guide.excerpt.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    results.sort((a, b) => {
      if (a.category !== b.category) {
        return categoryRank(a.category) - categoryRank(b.category);
      }
      return a.sortOrder - b.sortOrder;
    });

    return delay(results);
  });
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  return safeAsync("guide", async () => {
    const guide = MOCK_GUIDES.find((g) => g.slug === slug && g.isPublished) ?? null;
    return delay(guide);
  });
}
