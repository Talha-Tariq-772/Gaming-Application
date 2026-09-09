import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-nova-bone">Forgot your password?</h1>
        <p className="mt-2 text-sm text-nova-ash">
          Enter the phone number on your account. If you added a recovery email, we&rsquo;ll send a reset link
          there; otherwise we&rsquo;ll follow up on WhatsApp once we&rsquo;ve verified it&rsquo;s you.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
