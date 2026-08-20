import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

/**
 * Releases expired credential reservations and expires their orders (see
 * release_expired_reservations() in
 * supabase/migrations/20260818000009_functions.sql). Meant to be hit on a
 * schedule — see CRON_SECRET below for how callers authenticate.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("release_expired_reservations");

  if (error) {
    console.error("[cron:release-expired]", error);
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString(), message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
