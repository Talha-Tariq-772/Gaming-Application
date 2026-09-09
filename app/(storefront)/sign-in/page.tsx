import Link from "next/link";
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
      <p className="text-sm text-nova-ash">
        Prefer a phone number and password?{" "}
        <Link href="/login" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
          Log in
        </Link>{" "}
        or{" "}
        <Link href="/signup" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
          create an account
        </Link>
        .
      </p>
    </div>
  );
}
