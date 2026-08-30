import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/src/components/cart/CartDrawer";
import CartIntegrityGuard from "@/src/components/cart/CartIntegrityGuard";
import FooterSkeleton from "@/src/components/FooterSkeleton";
import HeaderSkeleton from "@/src/components/HeaderSkeleton";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main id="main-content" className="flex-1">{children}</main>
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
      <CartDrawer />
      <CartIntegrityGuard />
    </>
  );
}
