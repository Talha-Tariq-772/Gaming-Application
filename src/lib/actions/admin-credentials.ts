"use server";

import { requireAdmin } from "@/src/lib/auth/session";
import { bufferToBytea, encrypt } from "@/src/lib/crypto";
import { createClient as createServiceClient } from "@/src/lib/supabase/server";

export type AddCredentialResult = { ok: true } | { ok: false; message: string };

/**
 * Encrypts before insert, always — login_enc/password_enc never touch the
 * database (or a log line) in plaintext. Plaintext values live only in
 * this function's local variables for the duration of the encrypt() call.
 */
export async function addCredential(gameId: string, login: string, password: string): Promise<AddCredentialResult> {
  await requireAdmin();

  const trimmedLogin = login.trim();
  const trimmedPassword = password.trim();
  if (!trimmedLogin || !trimmedPassword) {
    return { ok: false, message: "Login and password are both required." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("game_credentials").insert({
    game_id: gameId,
    login_enc: bufferToBytea(encrypt(trimmedLogin)),
    password_enc: bufferToBytea(encrypt(trimmedPassword)),
    status: "available",
  });

  if (error) {
    // Error object only — never the login/password that produced it.
    console.error("[addCredential]", error);
    return { ok: false, message: "Something went wrong adding this credential." };
  }
  return { ok: true };
}

export interface BulkAddCredentialsResult {
  successCount: number;
  failCount: number;
  /** 1-indexed line numbers that failed — never the row content itself. */
  failedLines: number[];
}

/**
 * One login,password pair per line. Splits on the FIRST comma only, so a
 * password containing a comma still round-trips correctly (a login
 * containing one would not — logins are assumed comma-free, which holds
 * for every login shape this store actually uses: email or username).
 */
export async function addCredentialsBulk(gameId: string, csvText: string): Promise<BulkAddCredentialsResult> {
  await requireAdmin();

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const supabase = createServiceClient();
  let successCount = 0;
  const failedLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commaIndex = line.indexOf(",");
    const login = commaIndex === -1 ? "" : line.slice(0, commaIndex).trim();
    const password = commaIndex === -1 ? "" : line.slice(commaIndex + 1).trim();

    if (!login || !password) {
      failedLines.push(i + 1);
      continue;
    }

    const { error } = await supabase.from("game_credentials").insert({
      game_id: gameId,
      login_enc: bufferToBytea(encrypt(login)),
      password_enc: bufferToBytea(encrypt(password)),
      status: "available",
    });

    if (error) {
      // Error object + line NUMBER only — never the row's login/password.
      console.error(`[addCredentialsBulk] row ${i + 1}`, error);
      failedLines.push(i + 1);
    } else {
      successCount++;
    }
  }

  return { successCount, failCount: failedLines.length, failedLines };
}
