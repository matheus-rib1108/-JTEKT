import { describe, expect, it } from "vitest";
import { confirmMfaEnrollmentSchema, disableMfaSchema, mfaChallengeSchema } from "@/lib/validation/mfa";

describe("confirmMfaEnrollmentSchema", () => {
  it("accepts a valid secret and 6-digit code", () => {
    const result = confirmMfaEnrollmentSchema.safeParse({
      secretBase32: "JBSWY3DPEHPK3PXP",
      code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a code that isn't 6 digits", () => {
    expect(confirmMfaEnrollmentSchema.safeParse({ secretBase32: "JBSWY3DPEHPK3PXP", code: "123" }).success).toBe(false);
    expect(confirmMfaEnrollmentSchema.safeParse({ secretBase32: "JBSWY3DPEHPK3PXP", code: "12345a" }).success).toBe(false);
  });

  it("rejects a too-short secret", () => {
    expect(confirmMfaEnrollmentSchema.safeParse({ secretBase32: "short", code: "123456" }).success).toBe(false);
  });
});

describe("disableMfaSchema", () => {
  it("accepts a 6-digit code", () => {
    expect(disableMfaSchema.safeParse({ code: "654321" }).success).toBe(true);
  });

  it("rejects an empty code", () => {
    expect(disableMfaSchema.safeParse({ code: "" }).success).toBe(false);
  });
});

describe("mfaChallengeSchema", () => {
  it("accepts a valid challenge token and code", () => {
    expect(
      mfaChallengeSchema.safeParse({ challengeToken: "a".repeat(32), code: "000000" }).success,
    ).toBe(true);
  });

  it("rejects a too-short challenge token", () => {
    expect(mfaChallengeSchema.safeParse({ challengeToken: "short", code: "000000" }).success).toBe(false);
  });
});
