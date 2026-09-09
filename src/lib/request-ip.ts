import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort caller IP from request headers — never trust a client-
 * supplied IP for anything security-relevant (audit logs, rate limits),
 * since it's trivially spoofable. Shared by every server action that needs
 * one (credential reveal audit logging, phone-auth rate limiting).
 */
export async function requestIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerList.get("x-real-ip") ?? "unknown";
}
