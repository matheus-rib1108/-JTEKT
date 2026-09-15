import "server-only";
import crypto from "crypto";

/**
 * Encrypts the TOTP secret at rest (§27). Unlike a password, a TOTP secret
 * must be recoverable to verify future codes, so it cannot be hashed —
 * it is encrypted instead with a key derived from APP_SECRET (the same
 * server-side secret already provisioned for this purpose, see .env),
 * never stored in plaintext.
 */

const KEY_INFO = "stockflow-mfa-secret-v1";
const IV_LENGTH = 12; // AES-GCM standard nonce size

function deriveKey(): Buffer {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) throw new Error("APP_SECRET não configurado — necessário para criptografar segredos de MFA.");
  return crypto.scryptSync(appSecret, KEY_INFO, 32);
}

export function encryptMfaSecret(plainSecret: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(".");
}

export function decryptMfaSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Segredo de MFA armazenado em formato inválido.");

  const key = deriveKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
