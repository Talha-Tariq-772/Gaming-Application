import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/src/components/cart/CartDrawer";
import CartIntegrityGuard from "@/src/components/cart/CartIntegrityGuard";
import FooterSkeleton from "@/src/components/FooterSkeleton";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
      <CartDrawer />
      <CartIntegrityGuard />
    </>
  );
}
