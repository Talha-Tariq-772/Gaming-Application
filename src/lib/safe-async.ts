/**
 * Wraps a mock data getter so a thrown error is logged and re-thrown as a
 * clean, generic message — never leaking internal details to whatever
 * renders the failure. The mock functions in mock-data.ts/mock-guides.ts
 * can't actually fail today, but this is the seam a real API call slots
 * into later, and it gives Next's error.tsx / SectionErrorBoundary a
 * consistent, catchable failure to recover from right now.
 */
export async function safeAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logDataError(label, error);
    throw new Error(`Failed to load ${label}. Please try again.`);
  }
}

/**
 * Supabase's PostgrestError (and other plain-object error shapes the
 * client throws) is not an Error instance — its real fields
 * (message/code/details/hint) are own enumerable properties, but
 * console.error's default formatting of a plain object with no visible
 * fields is easy to misread, and some logging pipelines stringify it to
 * "{}" outright. Logging the four fields individually makes the actual
 * cause visible instead of silently swallowed — and if all four come back
 * undefined, that itself is a real signal (the thrown value truly carries
 * no diagnostic info, so the root cause is elsewhere, e.g. a network
 * failure before any error object formed).
 *
 * A genuine Error instance (thrown by our own code, not by supabase-js) is
 * logged as-is instead — it already stringifies correctly and carries a
 * stack trace, which this shouldn't discard.
 */
function logDataError(label: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[data:${label}]`, error);
    return;
  }

  if (error && typeof error === "object") {
    const { message, code, details, hint } = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    console.error(`[data:${label}]`, { message, code, details, hint });
    return;
  }

  console.error(`[data:${label}]`, error);
}
