import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-nova-bone">Log in</h1>
        <p className="mt-2 text-sm text-nova-ash">Sign in with your phone number and password.</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
