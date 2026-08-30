/**
 * Fallback for the <Suspense> around Header (components/Header.tsx) in
 * app/(storefront)/layout.tsx — Header is an async Server Component (reads
 * the session via cookies()/getUser(), then a profile lookup), same
 * isolation pattern as Footer/FooterSkeleton. Measured real height is
 * 69px at both 1440px and 390px (the nav links only appear at md:, so the
 * row height doesn't change), not estimated.
 */
export default function HeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-50 h-[69px] border-b border-nova-hairline bg-nova-void/80 backdrop-blur-md"
    />
  );
}
