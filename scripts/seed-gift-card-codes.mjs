// Seeds 3 placeholder redemption codes per gift-card product, for local/dev
// use against the products inserted by supabase/seed/gift-cards-dev.sql.
// Run manually — `node --experimental-strip-types scripts/seed-gift-card-codes.mjs`
// — never at request time.
//
// Every code is encrypted through the app's real src/lib/crypto.ts helpers
// (AES-256-GCM) before insert, exactly like a real code would be — this
// script never writes a plaintext code to the database, even though the
// codes themselves are throwaway dummy values.
//
// Format DUMMY-XXXX-XXXX-XXXX makes these visibly fake if one ever reached
// a customer. Safe to re-run: each product is topped up to 3 codes rather
// than always adding 3 more.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
// Imports crypto-core.ts directly, not crypto.ts — crypto.ts re-exports the
// same functions behind `import "server-only"`, which throws when loaded by
// plain Node outside a bundler (see crypto.ts's own comment).
import { encrypt, sha256Hex } from "../src/lib/crypto-core.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

config({ path: path.join(ROOT, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-gift-card-codes: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
  console.error("seed-gift-card-codes: missing CREDENTIAL_ENCRYPTION_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CODES_PER_PRODUCT = 3;
const SEGMENT_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easier to eyeball

function randomSegment(length) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SEGMENT_CHARS[bytes[i] % SEGMENT_CHARS.length];
  }
  return out;
}

function generateDummyCode() {
  return `DUMMY-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

async function main() {
  const { data: products, error: productsError } = await supabase
    .from("gift_card_products")
    .select("id, slug, title");

  if (productsError) {
    console.error("seed-gift-card-codes: failed to load gift_card_products", productsError);
    process.exit(1);
  }
  if (!products || products.length === 0) {
    console.error("seed-gift-card-codes: no gift_card_products found — run the seed SQL first.");
    process.exit(1);
  }

  const generatedByProduct = [];

  for (const product of products) {
    const { count, error: countError } = await supabase
      .from("gift_card_codes")
      .select("id", { count: "exact", head: true })
      .eq("product_id", product.id);

    if (countError) {
      console.error(`seed-gift-card-codes: failed to count codes for ${product.slug}`, countError);
      continue;
    }

    const existing = count ?? 0;
    const toCreate = CODES_PER_PRODUCT - existing;
    if (toCreate <= 0) {
      console.log(`[skip] ${product.slug}: already has ${existing} code(s)`);
      continue;
    }

    const plaintextCodes = Array.from({ length: toCreate }, generateDummyCode);
    const rows = plaintextCodes.map((code) => ({
      product_id: product.id,
      code_encrypted: encrypt(code).toString("base64"),
      code_hash: sha256Hex(code),
      status: "available",
    }));

    const { error: insertError } = await supabase.from("gift_card_codes").insert(rows);
    if (insertError) {
      console.error(`seed-gift-card-codes: failed to insert codes for ${product.slug}`, insertError);
      continue;
    }

    console.log(`[seeded] ${product.slug} (${product.title}): +${toCreate} code(s)`);
    generatedByProduct.push({ slug: product.slug, codes: plaintextCodes });
  }

  if (generatedByProduct.length > 0) {
    console.log("\nPlaintext dummy codes generated this run (dev-only convenience log — never logged in production code paths):");
    for (const { slug, codes } of generatedByProduct) {
      for (const code of codes) console.log(`  ${slug}: ${code}`);
    }
  }
}

main();
