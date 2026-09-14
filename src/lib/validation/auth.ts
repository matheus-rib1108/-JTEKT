import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

const passwordField = z
  .string()
  .min(10, "A senha deve ter no mínimo 10 caracteres.")
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
    message: "A senha deve conter letras e números.",
  });

export const registerCompanySchema = z.object({
  companyLegalName: z.string().trim().min(2).max(200),
  companyTradeName: optionalText(200),
  cnpj: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 14, { message: "CNPJ deve ter 14 dígitos." }),
  phone: optionalText(30),
  adminName: z.string().trim().min(2).max(150),
  adminEmail: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: passwordField,
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: passwordField,
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
