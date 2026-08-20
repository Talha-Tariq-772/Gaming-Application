import type { MetadataRoute } from "next";
import { LEGAL_PAGES } from "@/src/lib/legal-content";
import { getGames } from "@/src/lib/catalog";
import { getGuides } from "@/src/lib/mock-guides";
import { SITE_URL } from "@/src/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [games, guides] = await Promise.all([
    getGames(), // defaults to isActive-only — matches generateStaticParams for /games/[slug]
    getGuides(), // defaults to isPublished-only
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/games`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const legalRoutes: MetadataRoute.Sitemap = Object.values(LEGAL_PAGES).map(
    (page) => ({
      url: `${SITE_URL}/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "yearly",
      priority: 0.3,
    }),
  );

  const gameRoutes: MetadataRoute.Sitemap = games.map((game) => ({
    url: `${SITE_URL}/games/${game.slug}`,
    lastModified: game.createdAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    lastModified: guide.updatedAt,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...gameRoutes, ...guideRoutes, ...legalRoutes];
}
