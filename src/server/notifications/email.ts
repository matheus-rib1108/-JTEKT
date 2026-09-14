import "server-only";

/**
 * Transactional email is not wired to a real provider yet (no SMTP/SES/
 * SendGrid credentials configured). Per the product brief's "não inventar
 * integrações" rule, this stub does NOT pretend to send anything — it logs
 * the intended message server-side so the flow is testable end-to-end, and
 * every call site must surface that delivery is pending real integration.
 *
 * To wire a real provider: implement `EmailProvider` and swap the export
 * below. Keep the interface — callers should not need to change.
 */
export interface EmailProvider {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

class PendingIntegrationEmailProvider implements EmailProvider {
  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    console.warn(
      "[email:pending-integration] No email provider configured. " +
        "Message NOT delivered — this is expected until a real provider is wired.",
      { to: input.to, subject: input.subject },
    );
  }
}

export const emailProvider: EmailProvider = new PendingIntegrationEmailProvider();

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await emailProvider.send({
    to,
    subject: "StockFlow B2B — Redefinição de senha",
    body: `Use o link a seguir para redefinir sua senha (expira em 30 minutos): ${resetUrl}`,
  });
}
