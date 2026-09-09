This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication

Two independent sign-in methods, both real (neither is a fallback for the
other):

- **Google OAuth** (`/sign-in`) — the original method. `auth.users.email` is
  the customer's real Google email.
- **Phone + password** (`/signup`, `/login`) — added so customers who'd
  rather not use Google can still get an account (a library + order
  history; guest checkout at `/checkout` never requires either).

Supabase has no phone+password provider without SMS verification, which
costs money per number. Instead, phone+password auth maps the normalised
phone number to a synthetic, internal-only email address —
`923001234567@phone.pscbundle.local` — and signs up/in against that
address with Supabase's ordinary email+password grant
(`src/lib/phone.ts`'s `phoneToAuthEmail`, called from
`src/lib/actions/phone-auth.ts`). The user never sees this address; the UI
only ever shows their phone number. **If you're looking at `auth.users` and
see rows with `@phone.pscbundle.local` emails, that's expected** — they're
real customer accounts, not test data or a mistake.

The mapping is always derived from `src/lib/phone.ts`'s `normalisePhone`
(tight E.164, `+923001234567`) — never from `validation.ts`'s
`toCanonicalPkPhone` (spaced, `+92 300 1234567`, which is what
`profiles.phone_number` itself still stores, unchanged from the original
Google + `/complete-profile` flow). The two phone formatters are
deliberately not consolidated; each has its own callers and its own job.

**Password reset** has two paths:

- A recovery email on file (optional, collected at signup, stored in
  `profiles.recovery_email` — never in `auth.users.email`): the standard
  Supabase recovery-link flow, emailed via `src/lib/email.ts` (needs
  `RESEND_API_KEY`; without it, this path logs instead of sending).
- No recovery email: a request form sets `profiles.password_reset_requested_at`,
  and an agent fulfils it from `/admin/resets` after verifying the
  requester's identity against their recent order details — the same
  human-verified, WhatsApp-mediated pattern this app already uses for order
  fulfilment, not a new email flow. Every manual reset is logged to
  `audit_log` with the acting admin's id.

**Rate limiting**: 5 login/signup attempts per phone per 15 minutes, 20 per
IP per hour, enforced server-side by the `check_login_rate_limit` Postgres
function (`login_attempts` table) — never trust a client to self-limit.

**Bot mitigation**: Cloudflare Turnstile on `/signup` and `/login`
(`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`). The dev values
checked into `.env.local` are Cloudflare's published always-passes *test*
keys, not real credentials — replace both before production.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
