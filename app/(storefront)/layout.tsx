import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/src/components/cart/CartDrawer";
import CartIntegrityGuard from "@/src/components/cart/CartIntegrityGuard";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <CartIntegrityGuard />
    </>
  );
}
