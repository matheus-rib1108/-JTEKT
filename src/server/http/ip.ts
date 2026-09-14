import "server-only";

/** Best-effort client IP extraction. Behind a trusted reverse proxy this
 * should be replaced with the proxy's own trusted header — never trust
 * X-Forwarded-For blindly on the public internet without an allowlisted
 * proxy in front, since a caller can set arbitrary values otherwise. */
export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}
