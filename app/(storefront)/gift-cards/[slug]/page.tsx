import type { Metadata } from "next";
import { Suspense } from "react";
import GiftCardDetailSkeleton from "@/src/components/gift-cards/GiftCardDetailSkeleton";
import { getGiftCardProductBySlug, getGiftCardProducts } from "@/src/lib/gift-card-catalog";
import GiftCardDetailBody from "./GiftCardDetailBody";

export async function generateStaticParams() {
  const products = await getGiftCardProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getGiftCardProductBySlug(slug);

  if (!product) {
    return { title: "Gift card not found" };
  }

  return {
    title: product.title,
    description: product.description,
    alternates: {
      canonical: `/gift-cards/${product.slug}`,
    },
    openGraph: {
      type: "website",
      title: `${product.title} — PSCBUNDLE`,
      description: product.description,
      url: `/gift-cards/${product.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.title} — PSCBUNDLE`,
      description: product.description,
    },
  };
}

/**
 * Deliberately NOT async, with zero top-level awaits of its own — same
 * pattern as app/(storefront)/games/[slug]/page.tsx.
 */
export default function GiftCardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<GiftCardDetailSkeleton />}>
      <GiftCardDetailBody params={params} />
    </Suspense>
  );
}
