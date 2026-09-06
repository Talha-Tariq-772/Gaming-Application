import "server-only";

// Actual algorithm lives in crypto-core.ts (no "server-only" import) so it
// can also be imported directly by standalone Node scripts (e.g.
// scripts/seed-gift-card-codes.mjs) — server-only's package entry throws
// unconditionally outside a bundler that understands its export condition,
// which a plain `node --experimental-strip-types` run does not. Every
// app/server call site should keep importing from this file, not
// crypto-core directly, so the "server components only" guard still holds
// for real request-handling code.
export { encrypt, decrypt, bufferToBytea, byteaToBuffer, sha256Hex } from "@/src/lib/crypto-core";
