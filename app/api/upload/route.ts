import { NextResponse } from "next/server";
import { parseWorkbook } from "@/lib/excel/parse";
import { profileWorkbook } from "@/lib/excel/profile";
import { saveDataset } from "@/lib/store/datasets";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("api/upload");

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = [".xlsx", ".xls", ".csv"];

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    log.warn("Upload with no file");
    return NextResponse.json({ error: "No file uploaded. Attach a spreadsheet as 'file'." }, { status: 400 });
  }
  log.info("Upload received", { name: file.name, size: file.size });
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 413 });
  }
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload .xlsx, .xls, or .csv." },
      { status: 415 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const data = parseWorkbook(bytes);

    const sheetNames = Object.keys(data);
    if (sheetNames.length === 0 || sheetNames.every((s) => data[s].length === 0)) {
      log.warn("No tabular data found", { name: file.name });
      return NextResponse.json(
        { error: "No tabular data found. Ensure the first row contains column headers." },
        { status: 422 },
      );
    }

    const dictionary = profileWorkbook(file.name, data);
    const dataset = saveDataset(file.name, data, dictionary);

    log.info("Workbook parsed and stored", {
      datasetId: dataset.id,
      sheets: dictionary.sheets.map((s) => ({ name: s.name, rows: s.rowCount, cols: s.columns.length })),
      relationships: dictionary.relationships.length,
    });

    return NextResponse.json({ datasetId: dataset.id, dictionary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the file.";
    log.error("Parse failed", { name: file.name, error: message });
    return NextResponse.json({ error: `Could not parse the spreadsheet: ${message}` }, { status: 422 });
  }
}
