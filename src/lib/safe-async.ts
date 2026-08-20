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
    console.error(`[data:${label}]`, error);
    throw new Error(`Failed to load ${label}. Please try again.`);
  }
}
