import { safeAsync } from "@/src/lib/safe-async";
import {
  GUIDE_CATEGORIES,
  type FaqItem,
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
export const PAYMENT_VERIFICATION_FAQ_ID = "faq-how-verification-works";

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
    body: `Once your order is approved and your credentials are revealed, redeeming your game only takes a few minutes. Find your platform below.

## Before You Start

Make sure you've saved your login and password from the credential reveal page — it's only shown once. If you closed the page before copying them, contact us on WhatsApp with your order reference and we'll help you recover access.

## PC (Steam)

1. Open Steam and sign in with the account details we gave you — most games are pre-loaded on a dedicated account rather than added via a key, so you'll usually be signing into a *new* Steam account, not activating a code on your own.
2. If a specific redemption code was provided instead, go to **Library → Add a Game → Activate a Product on Steam** and paste it in.
3. Download and install from your Library like any other game.

## PlayStation 5

1. On your PS5, go to **PlayStation Store → Redeem Codes** from the sidebar.
2. Enter the code exactly as shown on your credential page — codes are case-sensitive and don't include spaces.
3. Once redeemed, install the game from **Your Library**.

## Xbox (Series X|S and One)

1. Go to the **Microsoft Store** app and select **Redeem** from the menu (or visit redeem.microsoft.com on any browser signed into your Xbox account).
2. Enter the 25-character code shown on your credential page.
3. Install from **My Library** once the redemption completes.

## Nintendo Switch

1. From the Switch home screen, open the **Nintendo eShop**.
2. Select your user icon, then **Redeem Code**.
3. Enter the code and confirm — download progress appears under **My Downloads**.

## Still Stuck?

If a code comes back as invalid or already used, don't try it more than two or three times — some platforms temporarily lock redemption after repeated failed attempts. Message us on WhatsApp with your order reference instead and we'll check it from our side.`,
  },
  {
    id: "guide-2",
    slug: "first-order-walkthrough",
    title: "Placing Your First Order",
    category: "getting-started",
    excerpt:
      "A quick walkthrough from browsing the store to getting your credentials, for anyone ordering with us for the first time.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-10T09:30:00.000Z",
    body: `New here? This is the whole process, start to finish.

## 1. Browse and Add to Cart

Filter by platform, genre, or price on the store page, and add whatever you're after to your cart. Prices shown are final — no hidden fees at checkout.

## 2. Choose a Payment Method

At checkout you'll pick from bank transfer, JazzCash, Easypaisa, SadaPay, or NayaPay. Pick whichever you already use — see our [accepted payment methods guide](/guides/accepted-payment-methods) if you're not sure which is fastest for you.

## 3. Send Payment and Claim It

We'll show you an *exact* amount to send — it'll be a few rupees off your order total on purpose. That small difference is how we automatically match your payment to your order, so send precisely that amount, not a rounded-up figure. Once you've paid, tap **I have made the payment** and send your screenshot to the WhatsApp number shown.

You have 45 minutes from checkout to complete this before your reservation expires and the price/stock is released back.

## 4. Verification and Delivery

Our team checks the payment against your reference — usually within an hour or two during business hours (9am–9pm PKT), sometimes faster. Once approved, your order status changes to **Approved** and your game credentials become available to reveal from your order page.

That's it — see [how to redeem your game key](/guides/redeem-your-game-key) once you've got your credentials.`,
  },
  {
    id: "guide-3",
    slug: "how-payment-verification-works",
    title: "How Payment Verification Works",
    category: "payment",
    excerpt:
      "Why we verify payments manually, how the exact-amount matching works, and what to expect after you send your screenshot.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-03-22T13:15:00.000Z",
    body: `We don't have automatic payment gateway integration yet, so every order is verified by a real person on our team. Here's exactly how that works.

## Why We Verify Manually

Bank transfers, JazzCash, Easypaisa, and the other methods we support don't give us a reliable, instant way to confirm a specific payment belongs to a specific order automatically. Manual verification is slower than a card checkout, but it means no chargebacks, no payment gateway fees eating into prices, and a real person double-checking every order.

## The Exact-Amount Trick

When you check out, we don't ask you to send a round number — we add a small random offset (a few rupees) to your total. That unique amount is how our team matches your incoming payment to your specific order without needing a reference number to line up perfectly. Always send the *exact* amount shown, including the odd paisa, not your cart total.

## Sending Your Screenshot

After paying, tap **I have made the payment** on the checkout page — this sends you straight to WhatsApp with your order reference pre-filled. Attach a screenshot of the transaction (the confirmation screen from your banking app or wallet) so we can cross-check it against what arrives in our account.

## Typical Turnaround

Most orders are verified within 1–2 hours during business hours (9am–9pm PKT). Orders sent outside those hours are usually picked up first thing the next morning. Weekend and public holiday orders can take a little longer.

## If Something Looks Wrong

If the amount we receive doesn't match what was requested, we can't approve the order automatically — we'll message you on WhatsApp to sort it out, which usually just means confirming the amount and retrying. Orders aren't rejected outright for an honest mismatch; we'll always reach out first.`,
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
    body: `We currently accept five payment methods. All of them are verified manually, so speed comes down to how fast you can send the payment and screenshot, not which method you pick — but a few notes below might help you choose.

## Bank Transfer

Works with any bank via online banking or an ATM transfer. Slightly slower to send than a wallet app if you don't already have online banking set up, but has no per-transaction limits to worry about for bigger orders.

## JazzCash

Fast if you already have the app installed — send via Mobile Account to the number shown at checkout. Our most commonly used method.

## Easypaisa

Same idea as JazzCash — send the exact amount to the account shown, screenshot the confirmation, and you're done.

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
    title: "Setting Up and Securing Your Nova Account",
    category: "account-setup",
    excerpt:
      "Creating your account, verifying your phone number, and keeping it secure.",
    isPublished: true,
    sortOrder: 1,
    updatedAt: "2026-02-14T15:45:00.000Z",
    body: `Your Nova account is where your order history and revealed game credentials live — separate from the game accounts themselves.

## Creating Your Account

You'll be asked for your name and phone number the first time you check out. There's no separate signup step — placing your first order creates your account automatically.

## Verifying Your Phone Number

We verify phone numbers by SMS so we can reach you if there's an issue with an order (a payment mismatch, a stock question, anything time-sensitive). An unverified number can still place orders, but verification helps us reach you faster if something needs your attention.

## Keeping Your Account Secure

We don't currently support account passwords — access is tied to your verified phone number. Don't share your phone or any SMS codes with anyone claiming to be from our support team; we will never ask you to forward a verification code to us.`,
  },
  {
    id: "guide-6",
    slug: "managing-game-credentials",
    title: "Managing Your Game Credentials",
    category: "account-setup",
    excerpt:
      "Where to find your login details after an order is approved, whether you can change the password, and how to store them safely.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-05T09:00:00.000Z",
    body: `Once an order is approved, each game in it gets its own credential reveal on your order page.

## Where to Find Your Credentials

Go to **My Orders**, open the approved order, and you'll see a **Reveal Credentials** button under each game. Credentials are shown once per visit to that button — after revealing them, they stay visible on that page for as long as you're signed in, but treat the first reveal as your one chance to copy them down somewhere safe.

## Can I Change the Password?

We'd rather you didn't. These are shared-pool accounts we manage stock for — changing the password locks *us* out of an account we're still responsible for, and can flag the account for review on the platform's side. If you need a password change for a specific reason, message us first and we'll walk you through it safely.

## Storing Credentials Safely

Use a password manager if you have one. If not, a private note is fine — just avoid anywhere publicly accessible, like an unencrypted note synced to a shared device.

## Sharing Devices

If you're playing on a shared family console or PC, sign out of the account when you're done rather than leaving it logged in, especially on Xbox and PlayStation where a signed-in profile can trigger purchases or changes without a password prompt.`,
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
- Make sure there's no leading or trailing space if you copied it from the credential page.
- Confirm you're signed into the right platform account — not a secondary or child profile.

## Common Platform-Specific Issues

**Steam:** if we provided full account login details rather than a key, make sure you're signing *into that account* rather than trying to activate a product code — most of our PC titles work this way.

**PlayStation / Xbox:** codes are region-locked to the storefront they were generated for. If your console's region doesn't match, redemption will fail even with a correct code — message us with your order reference and we'll check it.

**Nintendo Switch:** codes tied to a specific region's eShop behave the same way — a mismatch here is the usual cause if everything else checks out.

## Still Not Working?

Message us on WhatsApp with your order reference and a screenshot of the error. Don't keep retrying more than 2–3 times — some platforms temporarily lock further attempts after repeated failures, which makes it harder for us to diagnose from our side too.`,
  },
  {
    id: "guide-8",
    slug: "account-stopped-working",
    title: "What Happens If an Account Stops Working",
    category: "troubleshooting",
    excerpt:
      "Why a shared game account can stop working after purchase, what we'll do about it, and what we can't guarantee.",
    isPublished: true,
    sortOrder: 2,
    updatedAt: "2026-03-15T14:00:00.000Z",
    body: `Because most of our accounts are shared-pool accounts rather than keys generated fresh per sale, there's a small risk an account can be locked, flagged, or otherwise stop working after you've already started using it. Here's how we handle that.

## Why This Can Happen

Platforms occasionally run automated security checks that don't distinguish between a legitimate account transfer and something suspicious — a login from a new device or region can sometimes trigger a temporary hold, independent of anything you did wrong.

## What We'll Do

If your account stops working within a reasonable window after delivery, message us with your order reference and a description of what's happening (an error message, a "suspended" notice, anything specific helps). We'll either restore access, swap you to a working account from our pool, or — if neither is possible — issue store credit or a refund for that item, at our discretion, on a case-by-case basis.

## What We Can't Guarantee

We can't promise an account will never be flagged by the platform down the line — that risk is inherent to shared accounts and is part of why prices are lower than a first-party purchase. We also can't help with issues caused by changing the account's own password or recovery details after delivery (see [managing your game credentials](/guides/managing-game-credentials)).

## Reducing the Risk

Avoid changing security-sensitive settings on the account (password, 2FA, linked email) unless we've specifically told you to. The less you alter about how the account was delivered, the less likely it is to trip a platform's automated checks.`,
  },
];

/* ---------------------------------------------------------------------- */
/* FAQ                                                                      */
/* ---------------------------------------------------------------------- */

export const MOCK_FAQ_ITEMS: FaqItem[] = [
  {
    id: PAYMENT_VERIFICATION_FAQ_ID,
    question: "How does payment verification work?",
    answer:
      "Every payment is checked manually by our team rather than through an automatic gateway. At checkout we give you an exact amount to send (with a small unique offset added to your total) — that's how we match your payment to your order. Send that exact amount, then tap \"I have made the payment\" and share your screenshot on WhatsApp so we can confirm it.",
    category: "payment",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "faq-verification-time",
    question: "How long does verification take?",
    answer:
      "Usually 1–2 hours during business hours (9am–9pm PKT). Orders sent outside those hours are picked up first thing the next morning. Weekends and public holidays can take a little longer.",
    category: "payment",
    sortOrder: 2,
    isPublished: true,
  },
  {
    id: "faq-agent-not-replied",
    question:
      "I sent my screenshot but no one has replied — what do I do?",
    answer:
      "First, check that your 45-minute reservation window hasn't expired — if it has, your order will show as expired and you'll need to check out again. If it's still active and you're within business hours, give it a little longer; during busy periods responses can take a bit past our usual turnaround. If it's been more than a few hours during business hours with no reply, send a follow-up message on the same WhatsApp thread with your order reference — don't open a new chat, as that can split your conversation across two threads.",
    category: "payment",
    sortOrder: 3,
    isPublished: true,
  },
  {
    id: "faq-payment-methods",
    question: "What payment methods do you accept?",
    answer:
      "Bank transfer, JazzCash, Easypaisa, SadaPay, and NayaPay. See our accepted payment methods guide for details on each.",
    category: "payment",
    sortOrder: 4,
    isPublished: true,
  },
  {
    id: "faq-refund-policy",
    question: "What's your refund policy?",
    answer:
      "If we can't deliver a working account or key for an approved order — and can't fix or replace it — we'll issue a refund or store credit at your choice. Refunds aren't available simply for a change of mind after credentials have been revealed, since the account is considered delivered at that point. If a payment was sent but never verified (for example, the reservation expired before we could match it), contact us with proof of payment and we'll sort it out.",
    category: "payment",
    sortOrder: 5,
    isPublished: true,
  },
  {
    id: "faq-access-credentials",
    question: "How do I access my game credentials after I'm approved?",
    answer:
      "Go to My Orders, open the approved order, and use the Reveal Credentials button under each game. Credentials are shown once — save them somewhere safe as soon as you reveal them.",
    category: "account-setup",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "faq-change-credentials",
    question: "Can I change the password on my game account?",
    answer:
      "We'd rather you didn't — these are shared-pool accounts we're still responsible for managing, and a password change can lock us out or flag the account on the platform's side. If you have a specific reason to change it, message us first and we'll help you do it safely.",
    category: "account-setup",
    sortOrder: 2,
    isPublished: true,
  },
  {
    id: "faq-need-account",
    question: "Do I need to create an account before I can order?",
    answer:
      "No separate signup step — placing your first order creates your account automatically using the name and phone number you provide at checkout.",
    category: "account-setup",
    sortOrder: 3,
    isPublished: true,
  },
  {
    id: "faq-account-stopped-working",
    question: "What happens if my game account stops working?",
    answer:
      "Message us with your order reference and what's happening. We'll restore access, swap you to a working account, or issue store credit/refund depending on the situation. See our full guide on this for more detail on what to expect.",
    category: "troubleshooting",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "faq-key-not-working",
    question: "My game key won't redeem — what should I do?",
    answer:
      "Double-check you've copied the code exactly with no extra spaces, and that you're signed into the right platform account. Avoid retrying more than 2–3 times, since some platforms temporarily lock further attempts. If it still doesn't work, message us on WhatsApp with your order reference and a screenshot of the error.",
    category: "troubleshooting",
    sortOrder: 2,
    isPublished: true,
  },
  {
    id: "faq-how-to-redeem",
    question: "How do I redeem my game after I'm approved?",
    answer:
      "It depends on your platform — see our full redemption guide for step-by-step instructions covering PC, PlayStation 5, Xbox, and Nintendo Switch.",
    category: "getting-started",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "faq-platforms-supported",
    question: "Which platforms do you support?",
    answer:
      "PC (via Steam), PlayStation 5, Xbox Series X|S and Xbox One, and Nintendo Switch. Each game's product page shows which platform it's for before you buy.",
    category: "getting-started",
    sortOrder: 2,
    isPublished: true,
  },
];

/* ---------------------------------------------------------------------- */
/* Data-layer functions                                                     */
/* ---------------------------------------------------------------------- */

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

export async function getFaqItems(): Promise<FaqItem[]> {
  return safeAsync("FAQ", async () => {
    const results = MOCK_FAQ_ITEMS.filter((item) => item.isPublished).sort(
      (a, b) => {
        if (a.category !== b.category) {
          return categoryRank(a.category) - categoryRank(b.category);
        }
        return a.sortOrder - b.sortOrder;
      },
    );

    return delay(results);
  });
}
