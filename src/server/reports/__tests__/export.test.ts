import { describe, expect, it } from "vitest";
import { toCsv } from "@/server/reports/export";

describe("toCsv", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = toCsv({ title: "t", headers: ["a"], rows: [] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("joins headers and rows with CRLF", () => {
    const csv = toCsv({
      title: "t",
      headers: ["Nome", "Quantidade"],
      rows: [["Rolamento", 10]],
    });
    expect(csv).toBe("﻿Nome,Quantidade\r\nRolamento,10");
  });

  it("quotes and escapes values containing commas, quotes, or newlines", () => {
    const csv = toCsv({
      title: "t",
      headers: ["Descrição"],
      rows: [['Contém "aspas", vírgula e\nquebra de linha']],
    });
    expect(csv).toBe('﻿Descrição\r\n"Contém ""aspas"", vírgula e\nquebra de linha"');
  });

  it("leaves plain values unquoted", () => {
    const csv = toCsv({ title: "t", headers: ["x"], rows: [["valor simples"]] });
    expect(csv).toBe("﻿x\r\nvalor simples");
  });
});
