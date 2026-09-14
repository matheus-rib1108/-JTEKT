import { describe, expect, it } from "vitest";
import { isAccountLocked } from "@/server/auth/rateLimit";

describe("isAccountLocked", () => {
  it("returns false when there is no lock", () => {
    expect(isAccountLocked(null)).toBe(false);
  });

  it("returns false when the lock has already expired", () => {
    expect(isAccountLocked(new Date(Date.now() - 1000))).toBe(false);
  });

  it("returns true while the lock is still in the future", () => {
    expect(isAccountLocked(new Date(Date.now() + 60_000))).toBe(true);
  });
});
