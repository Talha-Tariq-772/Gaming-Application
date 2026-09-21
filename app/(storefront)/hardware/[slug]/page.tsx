import type { Metadata } from "next";
import { Suspense } from "react";
import HardwareDetailSkeleton from "@/src/components/hardware/HardwareDetailSkeleton";
import { getHardwareProductBySlug, getHardwareProducts } from "@/src/lib/hardware-catalog";
import HardwareDetailBody from "./HardwareDetailBody";

export async function generateStaticParams() {
  const products = await getHardwareProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getHardwareProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `/hardware/${product.slug}`,
    },
    openGraph: {
      type: "website",
      title: `${product.name} — PSCBUNDLE`,
      description: product.description,
      url: `/hardware/${product.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — PSCBUNDLE`,
      description: product.description,
    },
  };
}

/**
 * Deliberately NOT async, with zero top-level awaits of its own — same
 * pattern as app/(storefront)/gift-cards/[slug]/page.tsx.
 */
export default function HardwareDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<HardwareDetailSkeleton />}>
      <HardwareDetailBody params={params} />
    </Suspense>
  );
}
