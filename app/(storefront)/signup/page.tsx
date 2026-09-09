import { Suspense } from "react";
import SignUpForm from "./SignUpForm";

export const metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-nova-bone">Create an account</h1>
        <p className="mt-2 text-sm text-nova-ash">
          Optional — you can always{" "}
          <a href="/checkout" className="font-semibold text-nova-ember-text hover:text-nova-ember-lo">
            check out as a guest
          </a>{" "}
          instead. An account just gives you a library and order history.
        </p>
      </div>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
    </div>
  );
}
