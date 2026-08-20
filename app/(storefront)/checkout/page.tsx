import type { Metadata } from "next";
import CheckoutFlow from "@/src/components/checkout/CheckoutFlow";
import { getPaymentMethods } from "@/src/lib/catalog";

export const metadata: Metadata = {
  title: "Checkout",
  alternates: {
    canonical: "/checkout",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage() {
  const paymentMethods = await getPaymentMethods();
  return <CheckoutFlow paymentMethods={paymentMethods} />;
}
