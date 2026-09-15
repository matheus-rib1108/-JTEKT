import "server-only";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { encryptMfaSecret, decryptMfaSecret } from "@/server/auth/mfaCrypto";

const ISSUER = "StockFlow B2B";

function buildTotp(base32Secret: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

export interface MfaEnrollment {
  /** Base32 secret — held only in memory/session until the user confirms
   * a real code; never written to the database until then. */
  secretBase32: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
}

/** Generates a fresh enrollment: a random secret plus a scannable QR code
 * and the manual-entry fallback key, for the two ways an authenticator app
 * supports adding an account. Nothing is persisted here — enrollment is
 * only finalized once the user proves possession with a real code
 * (see confirmMfaEnrollment in the actions layer). */
export async function generateMfaEnrollment(accountLabel: string): Promise<MfaEnrollment> {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = buildTotp(secret.base32, accountLabel);
  const qrCodeDataUrl = await QRCode.toDataURL(totp.toString());
  return { secretBase32: secret.base32, qrCodeDataUrl, manualEntryKey: secret.base32 };
}

/** Allows one 30s step of clock drift either side (window: 1) — tight
 * enough to still reject a stale/replayed code, loose enough for
 * real-world clock skew between the server and the user's phone. */
function verifyCodeAgainstRawSecret(secretBase32: string, code: string, accountLabel: string): boolean {
  const totp = buildTotp(secretBase32, accountLabel);
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

/** Used at enrollment time, before the secret is ever encrypted/stored —
 * the raw secret only exists in the enrollment round-trip, never in the
 * database until this check passes. */
export function verifyEnrollmentCode(secretBase32: string, code: string, accountLabel: string): boolean {
  return verifyCodeAgainstRawSecret(secretBase32, code, accountLabel);
}

/** Verifies a 6-digit code against the encrypted-at-rest secret — the
 * normal login-time and disable-time check. */
export function verifyTotpCode(encryptedSecret: string, code: string, accountLabel: string): boolean {
  const secretBase32 = decryptMfaSecret(encryptedSecret);
  return verifyCodeAgainstRawSecret(secretBase32, code, accountLabel);
}

export function encryptSecretForStorage(secretBase32: string): string {
  return encryptMfaSecret(secretBase32);
}
