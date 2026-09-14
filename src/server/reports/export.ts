import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface TableReport {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** UTF-8 BOM prefix so Excel opens accented Portuguese characters (ç, ã,
 * é...) correctly when the file is double-clicked instead of imported. */
export function toCsv(report: TableReport): string {
  const lines = [report.headers.map(csvEscape).join(",")];
  for (const row of report.rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return "﻿" + lines.join("\r\n");
}

export async function toXlsxBuffer(report: TableReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(report.title.slice(0, 31));
  sheet.addRow(report.headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of report.rows) sheet.addRow(row);
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const PAGE_MARGIN = 40;
const ROW_HEIGHT = 18;

/** A plain tabular PDF — no chart/graphics library. Columns are laid out
 * at fixed x-offsets sized to fit within a portrait A4 page; long values
 * are truncated with an ellipsis rather than wrapped, to keep every row on
 * a single line. */
export function toPdfBuffer(report: TableReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - PAGE_MARGIN * 2;
    const colWidth = pageWidth / report.headers.length;

    doc.fontSize(14).font("Helvetica-Bold").text(report.title, PAGE_MARGIN, PAGE_MARGIN);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, PAGE_MARGIN, PAGE_MARGIN + 18);

    let y = PAGE_MARGIN + 45;

    function drawRow(values: (string | number)[], bold: boolean) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      values.forEach((value, i) => {
        doc.text(String(value), PAGE_MARGIN + i * colWidth, y, { width: colWidth - 4, ellipsis: true, lineBreak: false });
      });
      y += ROW_HEIGHT;
    }

    drawRow(report.headers, true);
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).strokeColor("#cccccc").stroke();
    y += 4;

    for (const row of report.rows) {
      if (y > doc.page.height - PAGE_MARGIN) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      drawRow(row, false);
    }

    doc.end();
  });
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

/** `body` is typed as `BodyInit` (not `Buffer`) because Next's
 * `NextResponse` constructor's DOM-derived type doesn't accept Node's
 * `Buffer` directly even though it's a valid `Uint8Array` at runtime — a
 * TS lib friction point, not a real runtime constraint. */
export async function renderReport(
  report: TableReport,
  format: ExportFormat,
): Promise<{ body: BodyInit; contentType: string; extension: string }> {
  if (format === "csv") {
    return { body: toCsv(report), contentType: "text/csv; charset=utf-8", extension: "csv" };
  }
  if (format === "xlsx") {
    return {
      body: new Uint8Array(await toXlsxBuffer(report)),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  return { body: new Uint8Array(await toPdfBuffer(report)), contentType: "application/pdf", extension: "pdf" };
}
