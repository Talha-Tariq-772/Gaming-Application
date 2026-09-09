import "server-only";

/**
 * The only outbound-email seam in this app — everything else (order
 * confirmations, support contact) is deliberately WhatsApp-mediated, not
 * emailed. This exists solely for the recovery-email password reset path
 * (src/lib/actions/password-reset.ts), which needs to deliver a Supabase
 * recovery link to an address that isn't the account's synthetic auth
 * email.
 *
 * No transactional-email provider is wired up yet (no API key configured
 * anywhere in this project) — RESEND_API_KEY is read here as the seam for
 * one, but until it's set this intentionally logs and returns ok:false
 * rather than pretending to send. Wiring a real provider is a deliberate,
 * separate infrastructure decision, not something to bolt on silently
 * inside a password-reset code path.
 */
export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — would have sent "${params.subject}" to ${params.to}`);
    return { ok: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PSCBUNDLE <no-reply@pscbundle.com>",
        to: params.to,
        subject: params.subject,
        text: params.text,
      }),
    });
    if (!res.ok) {
      console.error("[email] send failed", res.status, await res.text());
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] send threw", error);
    return { ok: false };
  }
}
