import { beforeAll, describe, expect, it } from "vitest";
import { encryptMfaSecret, decryptMfaSecret } from "@/server/auth/mfaCrypto";

beforeAll(() => {
  process.env.APP_SECRET = "test-app-secret-for-mfa-crypto-unit-tests";
});

describe("mfaCrypto", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptMfaSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptMfaSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(encryptMfaSecret(secret)).not.toBe(encryptMfaSecret(secret));
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP");
    const [iv, authTag, ciphertext] = encrypted.split(".");
    const tamperedByte = Buffer.from(ciphertext, "base64");
    tamperedByte[0] = tamperedByte[0] ^ 0xff;
    const tampered = [iv, authTag, tamperedByte.toString("base64")].join(".");
    expect(() => decryptMfaSecret(tampered)).toThrow();
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptMfaSecret("not-a-valid-format")).toThrow();
  });
});
