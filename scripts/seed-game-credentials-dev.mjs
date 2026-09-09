// Seeds 5 dummy login credentials per active game, for local/dev use so
// /games shows in-stock counts and the checkout -> WhatsApp handoff can be
// tested end to end. Run manually —
// `node --experimental-strip-types scripts/seed-game-credentials-dev.mjs`
// — never at request time.
//
// *** DEVELOPMENT ONLY. *** Every row here is DUMMY-prefixed and must be
// purged (scripts/purge-dummy-credentials.mjs --confirm) before any real
// credential ever loads into this table.
//
// A plain .sql seed file (the gift-cards-dev.sql pattern) can't do this:
// game_credentials has no non-secret columns to seed, and the actual
// encryption has to run through the app's real src/lib/crypto.ts /
// crypto-core.ts AES-256-GCM helpers, which SQL has no way to invoke. This
// mirrors scripts/seed-gift-card-codes.mjs instead — same idea, same
// connection setup, same "never write plaintext" rule — for the credential
// table's login/password_enc columns.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
// crypto-core.ts directly, not crypto.ts — crypto.ts's "server-only" import
// throws outside a bundler (see crypto.ts's own comment; seed-gift-card-
// codes.mjs does the same thing for the same reason).
//
// bufferToBytea(), not .toString("base64") — unlike gift_card_codes'
// code_encrypted (a `text` column, which is why seed-gift-card-codes.mjs
// can just base64-encode it), game_credentials.login_enc/password_enc are
// `bytea` columns. Every real call site (src/lib/actions/admin-
// credentials.ts) writes them via bufferToBytea()'s `\x`-prefixed hex wire
// format and reads them back via byteaToBuffer() — matching that exactly.
import { encrypt, bufferToBytea } from "../src/lib/crypto-core.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

config({ path: path.join(ROOT, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-game-credentials-dev: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
  console.error("seed-game-credentials-dev: missing CREDENTIAL_ENCRYPTION_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CREDENTIALS_PER_GAME = 5;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/l/1/I

function randomPasswordSuffix(length) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

async function main() {
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, slug, title")
    .eq("is_active", true);

  if (gamesError) {
    console.error("seed-game-credentials-dev: failed to load games", gamesError);
    process.exit(1);
  }
  if (!games || games.length === 0) {
    console.error("seed-game-credentials-dev: no active games found.");
    process.exit(1);
  }

  let totalInserted = 0;

  for (const game of games) {
    const { count, error: countError } = await supabase
      .from("game_credentials")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id);

    if (countError) {
      console.error(`seed-game-credentials-dev: failed to count credentials for ${game.slug}`, countError);
      continue;
    }

    const existing = count ?? 0;
    const toCreate = CREDENTIALS_PER_GAME - existing;
    if (toCreate <= 0) {
      console.log(`[skip] ${game.slug}: already has ${existing} credential(s)`);
      continue;
    }

    const rows = [];
    for (let i = existing + 1; i <= existing + toCreate; i++) {
      const username = `DUMMY-${game.slug}-${i}@test.local`;
      const password = `DUMMY-PASS-${randomPasswordSuffix(8)}`;
      rows.push({
        game_id: game.id,
        login_enc: bufferToBytea(encrypt(username)),
        password_enc: bufferToBytea(encrypt(password)),
        status: "available",
        order_id: null,
      });
    }

    const { error: insertError } = await supabase.from("game_credentials").insert(rows);
    if (insertError) {
      console.error(`seed-game-credentials-dev: failed to insert credentials for ${game.slug}`, insertError);
      continue;
    }

    console.log(`[seeded] ${game.slug} (${game.title}): +${toCreate} credential(s)`);
    totalInserted += toCreate;
  }

  console.log(`\nDone. ${totalInserted} dummy credential(s) inserted this run.`);
  console.log("Remember: purge before any real credential loads — scripts/purge-dummy-credentials.mjs --confirm");
}

main();
