import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

/** Format: [iv (12 bytes)][authTag (16 bytes)][ciphertext]. */
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/** Throws if the auth tag doesn't verify — a tampered buffer never silently decrypts. */
export function decrypt(data: Buffer): string {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * PostgREST exchanges `bytea` columns as hex strings prefixed with `\x`
 * (Postgres's bytea_output=hex text format), never as a raw Buffer/JSON
 * value — these convert between that wire format and the Buffer encrypt()/
 * decrypt() actually operate on.
 */
export function bufferToBytea(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

export function byteaToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/^\\x/, ""), "hex");
}

/**
 * Deterministic fingerprint of a plaintext secret, for duplicate detection
 * only — never used to authenticate or decrypt anything. Needed because
 * encrypt() above uses a random IV per call, so two encryptions of the same
 * plaintext never produce the same ciphertext; a unique index on this hash
 * is what lets a duplicate-code upload fail with a normal Postgres
 * unique-violation instead of requiring every existing row to be decrypted
 * and compared on every insert.
 */
export function sha256Hex(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}
