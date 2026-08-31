-- Seeds the two setup guides and links every existing game/membership row
-- to one.
--
-- Only two guides, not one per GAME_PLATFORMS value (ps4/ps5/ps4_ps5/xbox):
-- every game in the catalog has platform = null as of this migration (see
-- 20260829000002_games_catalog_columns.sql's comment — Session 1 checked
-- the live table and found nothing to normalize, and deliberately didn't
-- guess a per-game platform). With no real per-game platform data to key
-- off, a single combined 'ps4_ps5' guide that covers both consoles is
-- accurate for every game today, where a guessed ps4-only or ps5-only
-- split would not be. No Xbox *game* guide either — nothing in this
-- session's brief gives verified Xbox activation steps for a game account
-- (only Xbox Game Pass, a membership, is specified), and this catalog has
-- no game rows sold as Xbox accounts yet. Add ps4-only/ps5-only/xbox game
-- guides in a later session once real per-game platform data exists.
--
-- The membership guide is one document covering all three membership
-- products (PlayStation Plus, PS Plus Extra & Premium, Xbox Game Pass
-- Ultimate) rather than one per product — PS Plus and PS Plus Extra/Premium
-- both activate exactly the same way as a game account (this store's
-- game_credentials-backed accounts, not a redeemed code — see the PS
-- section of the migration's guide body for why), so they reuse the
-- PS4/PS5 guide's steps by reference instead of duplicating them.
insert into public.setup_guides (slug, title, body, platform, product_type, sort_order)
values
  (
    'ps4-ps5-account-setup',
    'Setting Up Your PS4 / PS5 Account',
    $body$Your game is delivered as a full PlayStation account — not a redeemable code. Follow the steps for your console below to start playing.

## How Delivery Works

1. Place your order and pay the exact amount shown at checkout.
2. Send a screenshot of the payment to the WhatsApp number shown on the confirmation screen, with your order reference.
3. An agent checks the payment against your order — usually within 1–2 hours during business hours.
4. Once approved, go to **My Orders**, open the order, and tap **Reveal Credentials** to get the account's email and password.

## Setting Up on PS5

1. On your PS5, sign in with the email and password from your order — not your own PSN account.
2. Go to **Settings → Users and Accounts → Other → Console Sharing and Offline Play**.
3. Select **Enable Console Sharing and Offline Play**.

Once enabled, your PS5 becomes that account's primary console. You can then sign back into your own PSN profile on the same console and play any game downloaded to the account — offline, using your own saves and trophies.

Only one console at a time. An account can only have one PS5 set as its primary console. If the account was previously enabled on a different PS5, enabling it on yours automatically removes it from that one.

## Setting Up on PS4

PS4 uses an older version of the same idea, called activating a primary console:

1. Sign in on your PS4 with the account's email and password.
2. Go to **Settings → Account Management → Activate as Primary PS4**.
3. Confirm the activation.

Same rule as PS5: only one PS4 can be the primary console for an account at a time.

## Primary vs Secondary — What's the Difference

- **Primary console** (the one you just activated): any local profile signed in on that console — including your own — can play the account's games offline, with your own saves and trophies. This is what you want for normal, everyday play.
- **Secondary console**: if you sign into the account directly on a console that isn't its primary one, you can still play its games, but only while signed into that account itself (not your own profile), and only with an active internet connection. There's no offline play, and no separate save data of your own.

Almost everyone wants their console set as primary. Only skip this if you're just trying the account out briefly on a console you don't own.

## What You Must Not Do

Never change the account's email or password. These are shared-pool accounts we're still responsible for — changing either one locks us out of an account other customers may also be using, breaks it for everyone sharing it, and voids replacement or refund coverage for your order. If you have a specific reason to want it changed, message us first and we'll walk you through it safely.

## You Have Access, Not Ownership

You're buying access to an account, not the account itself. We manage the credentials, restock the account pool, and remain responsible for keeping it working — treat it accordingly: don't change security settings, and don't share the login outside your own household.$body$,
    'ps4_ps5',
    'game',
    1
  ),
  (
    'membership-account-setup',
    'Activating Your Membership',
    $body$PlayStation Plus, PS Plus Extra & Premium, and Xbox Game Pass Ultimate are all delivered as full account credentials, not redeemable codes. How you activate one depends on which platform it's for.

## How Delivery Works

1. Place your order and pay the exact amount shown at checkout.
2. Send a screenshot of the payment to the WhatsApp number on the confirmation screen, with your order reference.
3. An agent checks the payment against your order — usually within 1–2 hours during business hours.
4. Once approved, go to **My Orders**, open the order, and tap **Reveal Credentials** to get the account's email and password.

## PlayStation Plus & PS Plus Extra/Premium

These use the same account-sharing method as our PlayStation games — see the [PS4/PS5 setup guide](/guides/ps4-ps5-account-setup) for full steps. In short:

- **PS5:** sign in with the account, then Settings → Users and Accounts → Other → Console Sharing and Offline Play → Enable.
- **PS4:** sign in with the account, then Settings → Account Management → Activate as Primary PS4.

Once your console is set as the account's primary console, sign back into your own PSN profile — your PS Plus benefits (online play, monthly games, cloud storage, and the Extra/Premium game catalog if you bought that tier) apply to your profile on that console. Same one-console-at-a-time rule applies: enabling it on your console removes it from wherever it was primary before.

## Xbox Game Pass Ultimate

1. On your Xbox console, the Xbox app (PC), or the Xbox Cloud Gaming site, sign in with the account's email and password — not your own Microsoft account.
2. Game Pass Ultimate is active immediately for whoever is signed into that account: browse Game Pass from the home screen and install or stream anything in the catalog.
3. To play under your own gamertag instead of the shared account's: while still signed into the shared account on your console, go to Settings → General → Personalization → My home Xbox → Make this my home Xbox. Your own profile can then install and play from the account's Game Pass library, including mostly-offline play — Xbox re-checks the license online roughly every 30 days, so reconnect occasionally.
4. Only one console can be set as an account's home Xbox at a time, same as the PlayStation console-sharing limit above.

## What You Must Not Do

Never change the account's email or password. These are shared-pool accounts we're still responsible for — changing either one locks us out of an account other customers may also be using, and voids replacement or refund coverage for your order.

## You Have Access, Not Ownership

A membership purchased through us gives you access to an active subscription on an account we manage — you don't own the account or the subscription itself. Don't change security settings, and don't share the login outside your own household.$body$,
    null,
    'membership',
    1
  )
on conflict (slug) do update set
  title = excluded.title,
  body = excluded.body,
  platform = excluded.platform,
  product_type = excluded.product_type,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.games g
set setup_guide_id = sg.id
from public.setup_guides sg
where g.product_type = 'game'
  and sg.slug = 'ps4-ps5-account-setup';

update public.games g
set setup_guide_id = sg.id
from public.setup_guides sg
where g.product_type = 'membership'
  and sg.slug = 'membership-account-setup';
