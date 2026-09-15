import "server-only";
import crypto from "crypto";
import { prisma } from "@/server/db/client";

/** Short-lived, single-use token bridging the password step and the TOTP
 * step of login — mirrors the session-token pattern (random value in the
 * cookie/response, only its SHA-256 hash persisted) so a DB leak alone
 * cannot be replayed as a valid challenge. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function createMfaChallenge(userId: string): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await prisma.mfaChallenge.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });

  return { rawToken, expiresAt };
}

/** Looks up the challenge without consuming it — the caller still needs to
 * check the TOTP code before the challenge should be deleted. */
export async function findMfaChallenge(rawToken: string): Promise<{ id: string; userId: string } | null> {
  const challenge = await prisma.mfaChallenge.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!challenge) return null;
  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.mfaChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return null;
  }
  return { id: challenge.id, userId: challenge.userId };
}

/** Single-use: deletes the challenge so a captured token cannot be replayed
 * for a second session once the correct code has been used. */
export async function deleteMfaChallenge(id: string): Promise<void> {
  await prisma.mfaChallenge.delete({ where: { id } }).catch(() => undefined);
}
