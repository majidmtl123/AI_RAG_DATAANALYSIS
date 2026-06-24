import * as XLSX from "xlsx";
import type { CellValue, SheetRow, WorkbookData } from "@/lib/types";

/**
 * Parse an Excel/CSV workbook (as bytes) into structured rows for every sheet.
 * The first row of each sheet is treated as the header row.
 */
export function parseWorkbook(bytes: ArrayBuffer | Uint8Array): WorkbookData {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const result: WorkbookData = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // defval: null keeps column alignment when cells are blank.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    result[sheetName] = rows.map((row) => normalizeRow(row));
  }

  return result;
}

/** Coerce raw cell values into our CellValue union (dates -> ISO strings). */
function normalizeRow(row: Record<string, unknown>): SheetRow {
  const out: SheetRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[String(key).trim()] = normalizeValue(value);
  }
  return out;
}

function normalizeValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  const str = String(value).trim();
  return str === "" ? null : str;
}
