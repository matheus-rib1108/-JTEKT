import { z } from "zod";

const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Informe o código de 6 dígitos.");

export const confirmMfaEnrollmentSchema = z.object({
  secretBase32: z.string().trim().min(16),
  code: totpCode,
});

export const disableMfaSchema = z.object({
  code: totpCode,
});

export const mfaChallengeSchema = z.object({
  challengeToken: z.string().min(20),
  code: totpCode,
});
