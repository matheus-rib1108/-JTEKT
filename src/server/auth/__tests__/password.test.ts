import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/server/auth/password";

describe("password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("SenhaForte#123");
    expect(hash).not.toBe("SenhaForte#123");
    await expect(verifyPassword("SenhaForte#123", hash)).resolves.toBe(true);
    await expect(verifyPassword("SenhaErrada#999", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const [hash1, hash2] = await Promise.all([
      hashPassword("SenhaForte#123"),
      hashPassword("SenhaForte#123"),
    ]);
    expect(hash1).not.toBe(hash2);
  });
});

describe("isPasswordStrongEnough", () => {
  it("rejects passwords shorter than 10 characters", () => {
    expect(isPasswordStrongEnough("Abc12345")).toBe(false);
  });

  it("rejects passwords without a number", () => {
    expect(isPasswordStrongEnough("SomenteLetras")).toBe(false);
  });

  it("rejects passwords without a letter", () => {
    expect(isPasswordStrongEnough("1234567890")).toBe(false);
  });

  it("accepts a password with letters, numbers and enough length", () => {
    expect(isPasswordStrongEnough("SenhaForte123")).toBe(true);
  });
});
