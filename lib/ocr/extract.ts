import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import type {
  CellValue,
  ScreenshotExtraction,
  ScreenshotImageExtraction,
  WorkbookData,
} from "@/lib/types";
import type { OcrResult } from "@/lib/ocr/ocr";

const log = createLogger("ocr/extract");

export const EXTRACT_MODEL = "claude-sonnet-4-6";

// Schema for what Claude returns: tables modelled as columns + string-cell rows
// (robust to messy OCR), plus per-image chart/KPI metadata and limitations.
const extractionSchema = z.object({
  tables: z
    .array(
      z.object({
        name: z.string().describe("Short, unique, snake_case-ish table name."),
        columns: z.array(z.string()).describe("Column headers in order."),
        rows: z
          .array(z.array(z.string()))
          .describe("Each row is an array of cell strings aligned to columns."),
      }),
    )
    .describe("All tabular data found across the screenshots."),
  perImage: z
    .array(
      z.object({
        name: z.string().describe("The image/file name this refers to."),
        summary: z.string().describe("1-2 sentences: what this screenshot shows."),
        charts: z.array(
          z.object({
            title: z.string(),
            chartType: z.string().describe("bar | line | pie | table | kpi | unknown"),
            xAxis: z.string().optional(),
            yAxis: z.string().optional(),
            legend: z.array(z.string()),
            series: z.array(z.string()),
            dataLabels: z.array(z.string()).describe("Numeric labels visible on the chart."),
            notes: z.string().optional(),
          }),
        ),
        kpis: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
            change: z.string().optional(),
          }),
        ),
      }),
    )
    .describe("One entry per uploaded screenshot."),
  limitations: z
    .string()
    .describe("Caveats: low OCR confidence, charts without numeric labels, ambiguous values, etc."),
});

type RawExtraction = z.infer<typeof extractionSchema>;

/**
 * Turn raw OCR text from one or more screenshots into a structured dataset
 * using Claude. Numbers are NOT computed here — this only structures what OCR
 * read. Returns tables as WorkbookData plus chart/KPI metadata.
 */
export async function extractStructuredData(ocrResults: OcrResult[]): Promise<ScreenshotExtraction> {
  const ocrBlock = ocrResults
    .map(
      (r) =>
        `### Screenshot: ${r.name} (OCR confidence ${r.confidence}%)\n${r.text || "(no text detected)"}`,
    )
    .join("\n\n");

  const prompt = `You are an OCR post-processor. Below is raw OCR text extracted from one or more screenshots of data (Excel, dashboards, Power BI/Tableau, reports, tables, charts, etc.).

Reconstruct the structured content as faithfully as possible:
- Identify every table: its columns and rows. Align cells to columns. Keep numbers as they appear (do not compute or invent values).
- Capture charts: title, type, axis labels, legend, series names, and any numeric data labels that were printed.
- Capture standalone KPIs / metric cards (label + value + any change text).
- Note limitations: low OCR confidence, charts whose values are not labelled (so exact magnitudes are unknown), or anything ambiguous.

Do not fabricate data. If something is unreadable, omit it and mention it in limitations.

RAW OCR TEXT:
${ocrBlock}`;

  const started = Date.now();
  const { output } = await generateText({
    model: anthropic(EXTRACT_MODEL),
    output: Output.object({ schema: extractionSchema }),
    prompt,
  });
  const raw = output as RawExtraction;

  const tables = toWorkbookData(raw.tables);
  const perImage: ScreenshotImageExtraction[] = raw.perImage.map((img) => {
    const match = ocrResults.find((o) => o.name === img.name);
    return {
      name: img.name,
      summary: img.summary,
      ocrConfidence: match?.confidence ?? 0,
      charts: img.charts.map((c) => ({
        title: c.title,
        chartType: c.chartType,
        xAxis: c.xAxis,
        yAxis: c.yAxis,
        legend: c.legend ?? [],
        series: c.series ?? [],
        dataLabels: c.dataLabels ?? [],
        notes: c.notes,
      })),
      kpis: img.kpis ?? [],
    };
  });

  log.info("Extraction complete", {
    tables: Object.keys(tables).length,
    images: perImage.length,
    elapsedMs: Date.now() - started,
  });

  return { perImage, tables, limitations: raw.limitations };
}

/** Convert Claude's columns+rows tables into WorkbookData (row objects). */
function toWorkbookData(tables: RawExtraction["tables"]): WorkbookData {
  const out: WorkbookData = {};
  const used = new Set<string>();

  for (const table of tables) {
    if (!table.columns?.length || !table.rows?.length) continue;
    let name = table.name?.trim() || "table";
    // Ensure unique sheet names.
    let n = name;
    let i = 2;
    while (used.has(n)) n = `${name}_${i++}`;
    name = n;
    used.add(name);

    out[name] = table.rows.map((row) => {
      const obj: Record<string, CellValue> = {};
      table.columns.forEach((col, idx) => {
        obj[col] = coerce(row[idx]);
      });
      return obj;
    });
  }
  return out;
}

/** Coerce an OCR cell string into number where it cleanly parses, else string. */
function coerce(value: string | undefined): CellValue {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const cleaned = s.replace(/[$,%\s]/g, "");
  if (cleaned !== "" && !Number.isNaN(Number(cleaned)) && /^-?\d*\.?\d+$/.test(cleaned)) {
    return Number(cleaned);
  }
  return s;
}
