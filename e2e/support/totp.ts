import * as OTPAuth from "otpauth";

/** Computes the current 6-digit TOTP code for a given base32 secret, the
 * same way an authenticator app would. Used by e2e specs to complete MFA
 * enrollment/login without a real phone. The label/issuer don't affect the
 * generated code — only algorithm, digits, period and secret do. */
export function currentTotpCode(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "StockFlow B2B",
    label: "e2e",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}
