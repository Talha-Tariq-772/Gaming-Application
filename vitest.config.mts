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
  },
});
