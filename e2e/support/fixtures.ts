import { E2E_LEGAL_NAME_PREFIX } from "./db";

/** A fresh, collision-free set of registration fields for one test run.
 * The CNPJ is a syntactically valid 14-digit string (uniqueness is all
 * that matters here — checksum validity isn't enforced by the schema). */
export function makeCompanyFixture(label: string) {
  const stamp = Date.now().toString().slice(-9);
  return {
    legalName: `${E2E_LEGAL_NAME_PREFIX} ${label} ${stamp}`,
    cnpj: `9${stamp}`.padEnd(14, "0").slice(0, 14),
    adminName: `Cliente E2E ${label}`,
    adminEmail: `e2e.${label.toLowerCase().replace(/\s+/g, "-")}.${stamp}@empresaqa.demo`,
    password: "SenhaTesteE2E#2026",
  };
}
