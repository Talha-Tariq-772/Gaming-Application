/**
 * A small denylist of the most common leaked passwords (from public
 * breach-corpus "top passwords" lists) — not a composition-rules engine.
 * The task is explicit: minimum length only, no forced mix of
 * upper/lower/digit/symbol. This just blocks the handful of passwords an
 * attacker tries first against every account.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "password",
  "123456",
  "123456789",
  "12345678",
  "12345",
  "1234567",
  "1234567890",
  "qwerty",
  "qwerty123",
  "111111",
  "123123",
  "abc123",
  "password1",
  "password123",
  "iloveyou",
  "admin",
  "welcome",
  "monkey",
  "dragon",
  "letmein",
  "football",
  "baseball",
  "master",
  "michael",
  "shadow",
  "sunshine",
  "princess",
  "superman",
  "trustno1",
  "654321",
  "000000",
  "11111111",
  "88888888",
  "1q2w3e4r",
  "1qaz2wsx",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "pakistan",
  "karachi",
  "lahore123",
]);

/** Case-insensitive — "Password1" and "PASSWORD1" are just as guessable as "password1". */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
