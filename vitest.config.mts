import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json sets jsx: "preserve" (Next's own SWC pipeline handles the
  // transform in the real app) — Vite needs this plugin to transform .tsx
  // itself, or it can't even parse a component file for testing.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "./vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // The RLS/order-lifecycle/header-auth suites are real integration tests
    // against a live Supabase project — several sequential network round-
    // trips per test (or per beforeAll/afterAll hook) regularly exceed
    // vitest's 5s/10s defaults under normal latency.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Capped below CPU count (4 on this machine) deliberately. 6 of the
    // ~16 test files sign in real Supabase users concurrently; with the
    // default fork pool (~1 per core) enough of those auth flows land in
    // the same instant to occasionally trip GoTrue's clock-skew tolerance
    // on JWT `iat` validation ("JWT issued at future") — a real, if
    // intermittent, failure under load, not a bug in any single test.
    // Confirmed by reproducing it with unrelated non-Supabase test files
    // added to the run (more total files -> more concurrent auth flows)
    // and confirmed fixed by capping concurrency here rather than by
    // disabling file parallelism outright, which would also serialize the
    // many fast, non-Supabase unit tests for no reason.
    maxWorkers: 2,
  },
});
