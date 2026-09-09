"use client";

import { useSearchParams } from "next/navigation";
import ContinueWithGoogle from "@/src/components/auth/ContinueWithGoogle";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  return <ContinueWithGoogle next={next} variant="primary" />;
}
