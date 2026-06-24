import type {
  CellValue,
  ColumnProfile,
  ColumnType,
  DataDictionary,
  SheetProfile,
  SheetRelationship,
  SheetRow,
  WorkbookData,
} from "@/lib/types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;
const SAMPLE_LIMIT = 5;

/** Build a compact data dictionary describing the whole workbook. */
export function profileWorkbook(fileName: string, data: WorkbookData): DataDictionary {
  const sheets: SheetProfile[] = Object.entries(data).map(([name, rows]) =>
    profileSheet(name, rows),
  );
  const relationships = detectRelationships(sheets);
  return { fileName, sheets, relationships };
}

function profileSheet(name: string, rows: SheetRow[]): SheetProfile {
  const headers = collectHeaders(rows);
  const columns = headers.map((header) => profileColumn(header, rows));
  return { name, rowCount: rows.length, columns };
}

function collectHeaders(rows: SheetRow[]): string[] {
  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headers.add(key);
  }
  return [...headers];
}

function profileColumn(name: string, rows: SheetRow[]): ColumnProfile {
  const values: CellValue[] = [];
  const distinct = new Set<string>();
  let nonNull = 0;
  let numberCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let minDate: string | undefined;
  let maxDate: string | undefined;

  for (const row of rows) {
    const v = row[name];
    if (v === null || v === undefined) continue;
    nonNull += 1;
    distinct.add(String(v));
    if (values.length < SAMPLE_LIMIT) values.push(v);

    if (typeof v === "number") {
      numberCount += 1;
      if (v < min) min = v;
      if (v > max) max = v;
    } else if (typeof v === "boolean") {
      boolCount += 1;
    } else if (typeof v === "string" && ISO_DATE_RE.test(v)) {
      dateCount += 1;
      if (!minDate || v < minDate) minDate = v;
      if (!maxDate || v > maxDate) maxDate = v;
    }
  }

  const type = inferType({ nonNull, numberCount, dateCount, boolCount, distinct: distinct.size });
  const role: ColumnProfile["role"] = type === "number" ? "measure" : "dimension";

  const profile: ColumnProfile = {
    name,
    type,
    role,
    nonNullCount: nonNull,
    distinctCount: distinct.size,
    samples: values,
  };
  if (type === "number" && nonNull > 0) {
    profile.min = min;
    profile.max = max;
  }
  if (type === "date") {
    profile.minDate = minDate;
    profile.maxDate = maxDate;
  }
  return profile;
}

function inferType(stats: {
  nonNull: number;
  numberCount: number;
  dateCount: number;
  boolCount: number;
  distinct: number;
}): ColumnType {
  const { nonNull, numberCount, dateCount, boolCount, distinct } = stats;
  if (nonNull === 0) return "empty";
  const majority = (count: number) => count / nonNull >= 0.8;
  if (majority(dateCount)) return "date";
  if (majority(boolCount)) return "boolean";
  if (majority(numberCount)) return "number";
  // Low-cardinality text is treated as a category dimension.
  if (distinct <= Math.max(20, nonNull * 0.5)) return "category";
  return "text";
}

/**
 * Heuristic relationship detection: a column in one sheet whose values are a
 * strong subset of a column in another sheet (shared key), with matching-ish names.
 */
function detectRelationships(sheets: SheetProfile[]): SheetRelationship[] {
  const relationships: SheetRelationship[] = [];
  const keyish = (n: string) => /(^id$|_id$|id$|code$|key$|number$)/i.test(n);

  for (const from of sheets) {
    for (const fromCol of from.columns) {
      if (fromCol.type === "number" && !keyish(fromCol.name)) continue;
      if (!keyish(fromCol.name)) continue;
      for (const to of sheets) {
        if (to.name === from.name) continue;
        for (const toCol of to.columns) {
          if (toCol.name.toLowerCase() === fromCol.name.toLowerCase()) {
            relationships.push({
              fromSheet: from.name,
              fromColumn: fromCol.name,
              toSheet: to.name,
              toColumn: toCol.name,
            });
          }
        }
      }
    }
  }
  // De-duplicate symmetric pairs.
  const seen = new Set<string>();
  return relationships.filter((r) => {
    const a = `${r.fromSheet}.${r.fromColumn}`;
    const b = `${r.toSheet}.${r.toColumn}`;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
