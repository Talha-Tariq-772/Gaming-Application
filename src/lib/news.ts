import "server-only";

import { safeAsync } from "@/src/lib/safe-async";
import { createClient } from "@/src/lib/supabase/public";
import type { NewsPost } from "@/src/types/database";

/**
 * Real Supabase-backed news reads (anon key, always is_published only —
 * matches the news_posts RLS policy for anon/customer). Same stateless
 * client as catalog.ts, for the same reason: generateStaticParams/
 * opengraph-image run at build time with no request/cookies at all.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNewsPostRow(row: any): NewsPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    body: row.body,
    coverImageUrl: row.cover_image_url,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    authorId: row.author_id,
    createdAt: row.created_at,
  };
}

export async function getNewsPosts(limit?: number): Promise<NewsPost[]> {
  return safeAsync("news posts", async () => {
    const supabase = await createClient();
    let query = supabase
      .from("news_posts")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapNewsPostRow);
  });
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPost | null> {
  return safeAsync("news post", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("news_posts").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? mapNewsPostRow(data) : null;
  });
}
