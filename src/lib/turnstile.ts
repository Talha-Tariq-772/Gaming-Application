import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Server-side verification of a Cloudflare Turnstile token — the client
 * widget's token is never trusted on its own, same principle as every
 * other "client sent X, re-verify server-side" check in this app.
 * TURNSTILE_SECRET_KEY is set in .env.local; see README's Auth section for
 * where to get a real one (the checked-in dev value is Cloudflare's public
 * always-passes test secret, not a real credential).
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set — failing closed");
    return false;
  }
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("[turnstile] verification request failed", error);
    return false;
  }
}
