import { describe, expect, it } from "vitest";
import { verifyCsrfToken, CSRF_HEADER_NAME } from "@/server/auth/csrf";
import { CSRF_COOKIE_NAME } from "@/server/auth/session";

function makeRequest(cookieValue: string | null, headerValue: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookieValue !== null) headers["cookie"] = `${CSRF_COOKIE_NAME}=${cookieValue}`;
  if (headerValue !== null) headers[CSRF_HEADER_NAME] = headerValue;
  return new Request("http://localhost/api/test", { headers });
}

describe("verifyCsrfToken", () => {
  it("accepts a matching cookie and header", () => {
    expect(verifyCsrfToken(makeRequest("abc123", "abc123"))).toBe(true);
  });

  it("rejects a mismatched cookie and header", () => {
    expect(verifyCsrfToken(makeRequest("abc123", "different"))).toBe(false);
  });

  it("rejects when the cookie is missing", () => {
    expect(verifyCsrfToken(makeRequest(null, "abc123"))).toBe(false);
  });

  it("rejects when the header is missing", () => {
    expect(verifyCsrfToken(makeRequest("abc123", null))).toBe(false);
  });
});
