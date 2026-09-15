import "server-only";

/**
 * Public base URL used to build links sent outside the app (password
 * reset, employee invite). In development, missing APP_URL silently
 * falling back to localhost is convenient; in production it's a trap —
 * every such link would point nowhere the recipient can reach, with no
 * visible error at the moment it happens. Fail loudly there instead.
 */
export function getAppUrl(): string {
  const configured = process.env.APP_URL;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL não está configurada. Links enviados a usuários (redefinição de senha, convite de funcionário) não podem ser gerados sem ela — veja docs/DEPLOY.md.",
    );
  }

  return "http://localhost:3000";
}
