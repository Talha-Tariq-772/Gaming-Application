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

/** Retries a single Supabase request until it reports no error, or throws once retries are exhausted. */
export async function deleteWithRetry(
  makeRequest: () => PromiseLike<{ error: unknown }>,
  label: string,
  retries = 5,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    const { error } = await makeRequest();
    if (!error) return;
    if (attempt >= retries) throw new Error(`cleanup failed (${label}): ${JSON.stringify(error)}`);
    // The Auth admin API occasionally returns a transient 500
    // (AuthRetryableFetchError) under bursty test load — worth retrying
    // before treating it as a real failure.
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
