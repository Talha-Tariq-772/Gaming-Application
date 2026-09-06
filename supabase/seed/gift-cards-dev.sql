-- Placeholder gift-card catalog for local/dev use, so the /gift-cards
-- routes and admin screens have real rows to render against before actual
-- inventory exists. Idempotent (on conflict do nothing) — safe to re-run.
--
-- *** PKR PRICES ARE PLACEHOLDERS FOR LAYOUT ONLY. ***
-- Every price_pkr value below is a rough USD*PKR-rate guess, not a real
-- price. Hashir must confirm every one of these against actual supplier
-- cost before this goes live — do not launch with these numbers.
--
-- card_image_url/header_image_url are left NULL on purpose: this exercises
-- the placeholder-image fallback path in lib/product-image.ts, which is
-- otherwise untested for a product type with no local manifest entry and
-- no Storage-uploaded art.

insert into public.gift_card_products
  (slug, title, platform, region, denomination_value, denomination_currency, price_pkr, card_image_url, header_image_url, description, redemption_instructions, is_active, sort_order)
values
  (
    'psn-10-us', 'PSN $10 Gift Card (US)', 'psn', 'US', 10, 'USD', 3200, null, null,
    'A $10 PlayStation Network gift card for the US store. Adds funds to your PSN wallet — spend on games, add-ons, or subscriptions.',
    E'1. Sign in to your PlayStation Network account. This code only works on a US-region PSN account — check under Settings > Users and Accounts > Account > Account Information if you''re unsure.\n2. On console: go to Settings > Account (or press the PS button, select your profile) > Redeem Codes. On the web: go to playstation.com/redeem and sign in.\n3. Enter the code exactly as shown, including any dashes.\n4. The balance is added to your wallet immediately and never expires.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 1
  ),
  (
    'psn-25-us', 'PSN $25 Gift Card (US)', 'psn', 'US', 25, 'USD', 7800, null, null,
    'A $25 PlayStation Network gift card for the US store. Adds funds to your PSN wallet — spend on games, add-ons, or subscriptions.',
    E'1. Sign in to your PlayStation Network account. This code only works on a US-region PSN account — check under Settings > Users and Accounts > Account > Account Information if you''re unsure.\n2. On console: go to Settings > Account (or press the PS button, select your profile) > Redeem Codes. On the web: go to playstation.com/redeem and sign in.\n3. Enter the code exactly as shown, including any dashes.\n4. The balance is added to your wallet immediately and never expires.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 2
  ),
  (
    'psn-10-pk', 'PSN $10 Gift Card (PK)', 'psn', 'PK', 10, 'USD', 3400, null, null,
    'A $10 PlayStation Network gift card for the Pakistan store. Adds funds to your PSN wallet — spend on games, add-ons, or subscriptions.',
    E'1. Sign in to your PlayStation Network account. This code only works on a Pakistan-region (PK) PSN account — check under Settings > Users and Accounts > Account > Account Information if you''re unsure.\n2. On console: go to Settings > Account (or press the PS button, select your profile) > Redeem Codes. On the web: go to playstation.com/redeem and sign in.\n3. Enter the code exactly as shown, including any dashes.\n4. The balance is added to your wallet immediately and never expires.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 3
  ),
  (
    'xbox-10-us', 'Xbox $10 Gift Card (US)', 'xbox', 'US', 10, 'USD', 3200, null, null,
    'A $10 Xbox gift card for the US store. Adds funds to your Microsoft account — spend on games, add-ons, or Game Pass.',
    E'1. Sign in to your Microsoft account. This code only works on a US-region Xbox/Microsoft account.\n2. On console: press the Xbox button, go to My games & apps > Redeem Code, or store.xbox.com/redeem. On the web: go to redeem.microsoft.com and sign in.\n3. Enter the 25-character code exactly as shown.\n4. The balance is added to your account immediately.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 4
  ),
  (
    'steam-20-global', 'Steam Wallet Code $20 (Global)', 'steam', 'GLOBAL', 20, 'USD', 6200, null, null,
    'A $20 Steam Wallet code. Works on any Steam account regardless of region — adds funds to your Steam Wallet.',
    E'1. Open the Steam client (or store.steampowered.com) and sign in to your account.\n2. Go to Games > Activate a Product on Steam (client) or steampowered.com/account/registerkey (web).\n3. Enter the code exactly as shown.\n4. The balance is added to your Steam Wallet immediately and never expires.\n\nThis code works on any Steam region, but is single-use — once redeemed, it cannot be reused or refunded.',
    true, 5
  ),
  (
    'steam-50-global', 'Steam Wallet Code $50 (Global)', 'steam', 'GLOBAL', 50, 'USD', 15200, null, null,
    'A $50 Steam Wallet code. Works on any Steam account regardless of region — adds funds to your Steam Wallet.',
    E'1. Open the Steam client (or store.steampowered.com) and sign in to your account.\n2. Go to Games > Activate a Product on Steam (client) or steampowered.com/account/registerkey (web).\n3. Enter the code exactly as shown.\n4. The balance is added to your Steam Wallet immediately and never expires.\n\nThis code works on any Steam region, but is single-use — once redeemed, it cannot be reused or refunded.',
    true, 6
  ),
  (
    'google-play-10', 'Google Play $10 Gift Card (US)', 'google_play', 'US', 10, 'USD', 3100, null, null,
    'A $10 Google Play gift card for the US store. Adds funds to your Google Play balance — spend on apps, games, and subscriptions.',
    E'1. Open the Google Play Store app and sign in with the account you want credited. This code only works on a US-region Play Store account.\n2. Tap your profile icon, then Payments & subscriptions > Redeem code, or go to play.google.com/redeem.\n3. Enter the code exactly as shown.\n4. The balance is added to your Google Play balance immediately.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 7
  ),
  (
    'apple-25-us', 'Apple Gift Card $25 (US)', 'apple', 'US', 25, 'USD', 7900, null, null,
    'A $25 Apple gift card for the US store. Adds funds to your Apple ID balance — spend on apps, games, iCloud+, or subscriptions.',
    E'1. Sign in with the Apple ID you want credited. This code only works on a US-region Apple ID.\n2. On iPhone/iPad: open the App Store, tap your profile icon, then Redeem Gift Card or Code. On the web: go to apple.com/redeem.\n3. Enter the code exactly as shown, or use your device camera to scan it if printed.\n4. The balance is added to your Apple ID immediately.\n\nThis code is single-use. Once redeemed, it cannot be reused, refunded, or reissued.',
    true, 8
  )
on conflict (slug) do nothing;
