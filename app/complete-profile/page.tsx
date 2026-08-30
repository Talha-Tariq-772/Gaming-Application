import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server-session";
import CompleteProfileForm from "./CompleteProfileForm";

export const metadata = {
  title: "Complete your profile",
  robots: { index: false, follow: false },
};

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent("/complete-profile")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, phone_number")
    .eq("id", user.id)
    .single();

  if (profile?.phone_number) {
    redirect(next || "/account");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div>
        <h1 className="font-display text-2xl font-bold text-nova-bone">Complete your profile</h1>
        <p className="mt-2 text-sm text-nova-ash">
          We need a phone number to reach you about your orders.
        </p>
      </div>
      <CompleteProfileForm email={profile?.email ?? user.email ?? ""} next={next || "/account"} />
    </div>
  );
}
