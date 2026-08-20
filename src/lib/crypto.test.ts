import { describe, expect, it } from "vitest";
import { bufferToBytea, byteaToBuffer, decrypt, encrypt } from "@/src/lib/crypto";

describe("crypto", () => {
  it("round-trips plaintext through encrypt/decrypt", () => {
    const plaintext = "player.ab12@novagames.dev:S3cr3t#Pass";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("uses a random IV, so identical plaintext never produces identical ciphertext", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.equals(b)).toBe(false);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("throws rather than returning garbage when the ciphertext is tampered with", () => {
    const encrypted = encrypt("do-not-leak-this");
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws rather than returning garbage when the auth tag is tampered with", () => {
    const encrypted = encrypt("do-not-leak-this-either");
    const tampered = Buffer.from(encrypted);
    tampered[15] ^= 0xff; // byte inside the 16-byte auth tag region (offset 12..28)
    expect(() => decrypt(tampered)).toThrow();
  });

  it("round-trips an encrypted buffer through the bytea wire format", () => {
    const plaintext = "player.wire@novagames.dev:Wire#Format1";
    const encrypted = encrypt(plaintext);
    const wireValue = bufferToBytea(encrypted);
    expect(wireValue.startsWith("\\x")).toBe(true);
    const decoded = byteaToBuffer(wireValue);
    expect(decoded.equals(encrypted)).toBe(true);
    expect(decrypt(decoded)).toBe(plaintext);
  });
});
