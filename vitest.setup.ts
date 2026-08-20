import { config } from "dotenv";

// quiet: true suppresses dotenv's stdout "tip" banner (rotates in
// unrelated third-party promo links) — noise, not something we want
// printed on every test run.
config({ path: ".env.local", quiet: true });
