import "server-only";
import { prisma } from "@/server/db/client";

/**
 * DB-backed brute-force protection. A single-process in-memory limiter would
 * not survive serverless cold starts or multiple instances, so attempts are
 * recorded in LoginAttempt and evaluated per request. For high-traffic
 * production deployments, front this with a shared cache (Redis) — tracked
 * as a follow-up in docs/ROADMAP.md.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IDENTIFIER = 8;
const MAX_ATTEMPTS_PER_IP = 30;
const ACCOUNT_LOCK_THRESHOLD = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

export async function recordLoginAttempt(
  identifier: string,
  success: boolean,
  ipAddress: string | null,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: { identifier: identifier.toLowerCase(), success, ipAddress: ipAddress ?? undefined },
  });
}

export async function isLoginRateLimited(
  identifier: string,
  ipAddress: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);

  const byIdentifier = await prisma.loginAttempt.count({
    where: { identifier: identifier.toLowerCase(), success: false, createdAt: { gte: since } },
  });
  if (byIdentifier >= MAX_ATTEMPTS_PER_IDENTIFIER) return true;

  if (ipAddress) {
    const byIp = await prisma.loginAttempt.count({
      where: { ipAddress, success: false, createdAt: { gte: since } },
    });
    if (byIp >= MAX_ATTEMPTS_PER_IP) return true;
  }

  return false;
}

/** Applies/clears the per-account lock (belt-and-suspenders alongside the
 * IP/identifier throttle above, since a distributed attack could spread
 * across many source IPs but still target one account). */
export async function registerFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const failedLoginCount = user.failedLoginCount + 1;
  const lockedUntil =
    failedLoginCount >= ACCOUNT_LOCK_THRESHOLD
      ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS)
      : user.lockedUntil;

  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount, lockedUntil },
  });
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

export function isAccountLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}
