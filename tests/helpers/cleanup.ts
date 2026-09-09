/**
 * Shared afterAll cleanup runner for the live-Supabase integration suites
 * (order-lifecycle, admin-users, header-auth, library, rls). Extracted after
 * tracing a real leak: those suites' afterAll hooks used to run their delete
 * calls as one linear await chain, where a single failure (exhausted
 * retries, or just a step that ran long enough to blow past Vitest's
 * hookTimeout) silently cancelled every step written after it — including
 * ones with no dependency on the failed step. That left games,
 * game_credentials, orders, and auth users behind in the live project across
 * several runs, sometimes even when every test in the file passed, because
 * the leak lived in this hook, not in the tests themselves.
 *
 * runCleanupSteps() replaces that chain: each step is independent (a
 * failure in one never blocks the others) and individually time-capped (so
 * a stuck request can't consume the whole hook's budget before later steps
 * get a turn). Failures are logged as they happen and aggregated into one
 * thrown error at the end, so the suite still fails loudly — cleanup
 * problems stay visible instead of being silently swallowed.
 */

const DEFAULT_STEP_TIMEOUT_MS = 8_000;

/** Postgres SQLSTATEs that are genuinely transient — lock contention or a
 * serialization conflict under concurrent load, where the exact same
 * request can succeed on a later attempt with no other change. */
const RETRYABLE_POSTGRES_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "55P03", // lock_not_available
  "57014", // query_canceled (e.g. a statement timeout under load)
]);

/**
 * A constraint violation (23xxx: not-null/FK/unique/check) or a custom
 * application error raised with `raise exception ... using errcode`
 * (e.g. LV001, the last-active-variant guardrail) is deterministic — the
 * exact same request fails the exact same way every time, because
 * nothing about the *data* changes between attempts. Retrying those
 * doesn't recover anything; it just spends the step's whole time budget
 * re-proving the same rejection, and the eventual failure surfaces as a
 * generic "step exceeded Nms" timeout instead of the actual error.
 *
 * The Auth admin API's own transient 500s (AuthRetryableFetchError, or
 * any 5xx status) are a different, genuinely transient class — worth
 * retrying, same as lock contention.
 */
function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return true; // unrecognized shape — don't assume it's a foregone conclusion

  const err = error as { code?: string; status?: number; name?: string };

  if (err.name === "AuthRetryableFetchError") return true;
  if (typeof err.status === "number" && err.status >= 500) return true;

  if (typeof err.code === "string") {
    // Any Postgres/PostgREST error code we don't specifically recognize
    // as transient is treated as a real, deterministic rejection —
    // constraint violations and custom raised errcodes both land here.
    return RETRYABLE_POSTGRES_CODES.has(err.code);
  }

  // No error code at all is typically a raw network/fetch failure —
  // worth retrying.
  return true;
}

/** Retries a single Supabase request until it reports no error, retries
 * are exhausted, or the error is identified as non-retryable (see
 * isRetryable) — in which case it throws immediately with the real
 * error rather than spending the rest of the step's budget re-failing
 * the same deterministic rejection. */
export async function deleteWithRetry(
  makeRequest: () => PromiseLike<{ error: unknown }>,
  label: string,
  retries = 5,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const { error } = await makeRequest();
    if (!error) return;
    if (!isRetryable(error)) {
      throw new Error(`cleanup failed (${label}), non-retryable: ${JSON.stringify(error)}`);
    }
    if (attempt >= retries) throw new Error(`cleanup failed (${label}): ${JSON.stringify(error)}`);
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}

export interface CleanupStep {
  label: string;
  run: () => Promise<void>;
}

/**
 * Runs each step to completion or failure, independently, and throws one
 * aggregated error at the end if any failed — but only after every step has
 * had its turn. Call this as the entire body of an afterAll (see any of the
 * live-Supabase suites for the call shape), and give the afterAll itself a
 * timeout of at least `steps.length * stepTimeoutMs` plus some headroom.
 */
export async function runCleanupSteps(steps: CleanupStep[], stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS): Promise<void> {
  const failures: (string | null)[] = [];

  for (const { label, run } of steps) {
    failures.push(await runOneStep(label, run, stepTimeoutMs));
  }

  const realFailures = failures.filter((f): f is string => f !== null);
  if (realFailures.length) {
    throw new Error(`afterAll left ${realFailures.length} cleanup step(s) incomplete:\n${realFailures.join("\n")}`);
  }
}

async function runOneStep(label: string, run: () => Promise<void>, stepTimeoutMs: number): Promise<string | null> {
  try {
    await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`step exceeded ${stepTimeoutMs}ms`)), stepTimeoutMs),
      ),
    ]);
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[afterAll cleanup] step "${label}" failed:`, message);
    return `${label}: ${message}`;
  }
}
