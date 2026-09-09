// Deletes every game_credentials row whose decrypted login starts with
// "DUMMY-" — the seed marker scripts/seed-game-credentials-dev.mjs uses.
// Must be run (and re-run) before any real credential is ever allowed to
// share this table with dummy rows.
//
// Refuses to run without --confirm: this decrypts and deletes rows, and a
// bare accidental invocation should never delete anything.
//
// Run manually —
// `node --experimental-strip-types scripts/purge-dummy-credentials.mjs --confirm`
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decrypt, byteaToBuffer } from "../src/lib/crypto-core.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

config({ path: path.join(ROOT, ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("purge-dummy-credentials: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!process.env.CREDENTIAL_ENCRYPTION_KEY) {
  console.error("purge-dummy-credentials: missing CREDENTIAL_ENCRYPTION_KEY in .env.local");
  process.exit(1);
}

const confirmed = process.argv.includes("--confirm");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: rows, error } = await supabase
    .from("game_credentials")
    .select("id, login_enc");

  if (error) {
    console.error("purge-dummy-credentials: failed to load game_credentials", error);
    process.exit(1);
  }

  const dummyIds = [];
  for (const row of rows ?? []) {
    let login;
    try {
      login = decrypt(byteaToBuffer(row.login_enc));
    } catch (err) {
      console.error(`purge-dummy-credentials: failed to decrypt login for row ${row.id}, skipping`, err);
      continue;
    }
    if (login.startsWith("DUMMY-")) {
      dummyIds.push(row.id);
    }
  }

  console.log(`purge-dummy-credentials: found ${dummyIds.length} DUMMY- credential(s) out of ${rows?.length ?? 0} total.`);

  if (dummyIds.length === 0) {
    console.log("Nothing to purge.");
    return;
  }

  if (!confirmed) {
    console.log("Dry run only — pass --confirm to actually delete these rows.");
    return;
  }

  const { error: deleteError, count } = await supabase
    .from("game_credentials")
    .delete({ count: "exact" })
    .in("id", dummyIds);

  if (deleteError) {
    console.error("purge-dummy-credentials: delete failed", deleteError);
    process.exit(1);
  }

  console.log(`Deleted ${count ?? dummyIds.length} DUMMY- credential(s).`);
}

main();
