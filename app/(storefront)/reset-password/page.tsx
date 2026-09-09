import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-nova-bone">Set a new password</h1>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
