import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // robots.txt disallow rules match by path prefix, so each entry also
      // covers everything nested under it (/admin/orders, /account/orders/1…).
      disallow: ["/admin", "/account", "/checkout"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
