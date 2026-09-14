import "server-only";
import crypto from "crypto";
import type { cookies as nextCookies } from "next/headers";
import { prisma } from "@/server/db/client";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from "@/lib/auth-constants";

export { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME };

/** Idle session lifetime. Kept short because this is a B2B admin/ERP-style
 * surface handling commercial and stock data — see product brief §27. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

type CookieJar = Awaited<ReturnType<typeof nextCookies>>;

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Creates a DB-backed session and returns the raw token to store in the
 * cookie. Only the SHA-256 hash is persisted, so a DB leak alone cannot be
 * replayed as a valid session cookie. */
export async function createSession(input: CreateSessionInput): Promise<{
  rawToken: string;
  expiresAt: Date;
}> {
  const rawToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(rawToken),
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export async function getSessionByRawToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return session;
}

export async function revokeSessionByRawToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Sets the session + CSRF cookies on a Next.js cookie jar (route handler or
 * server action context). CSRF token is intentionally readable by JS so the
 * client can echo it back in a header on state-changing requests
 * (double-submit pattern) — it is not a secret by itself. */
export function attachSessionCookies(
  cookieStore: CookieJar,
  rawToken: string,
  expiresAt: Date,
): void {
  const isProd = process.env.NODE_ENV === "production";

  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  cookieStore.set(CSRF_COOKIE_NAME, randomToken(), {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookies(cookieStore: CookieJar): void {
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(CSRF_COOKIE_NAME);
}
