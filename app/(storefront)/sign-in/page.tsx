import { Suspense } from "react";
import SignInForm from "./SignInForm";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-bold text-nova-bone">Sign in</h1>
      <p className="text-sm text-nova-ash">
        Sign in with Google to view your orders and complete checkout.
      </p>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
