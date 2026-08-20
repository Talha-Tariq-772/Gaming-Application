/**
 * Single source of truth for the site's canonical origin. Every absolute
 * URL used in metadata (canonical links, OG/Twitter images, sitemap,
 * robots.txt, JSON-LD) is built from this constant.
 *
 * PLACEHOLDER — nova.example is RFC 2606's reserved-for-documentation
 * domain, chosen deliberately so it's obviously not a real address.
 * Swap for the real production domain before launch; nothing else needs
 * to change.
 */
export const SITE_URL = "https://nova.example";

export const SITE_NAME = "Nova";
