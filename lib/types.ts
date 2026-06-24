// Shared types for the Universal Excel Analysis Tool.

/** A single cell value after parsing. */
export type CellValue = string | number | boolean | null;

/** One row of a sheet, keyed by column header. */
export type SheetRow = Record<string, CellValue>;

/** Inferred semantic type of a column. */
export type ColumnType = "number" | "date" | "category" | "text" | "boolean" | "empty";

/** Profile of a single column within a sheet. */
export interface ColumnProfile {
  name: string;
  type: ColumnType;
  /** Whether this column behaves like a measure (numeric, aggregatable). */
  role: "measure" | "dimension";
  nonNullCount: number;
  distinctCount: number;
  /** A few example values to help the model understand the column. */
  samples: CellValue[];
  /** Numeric stats (only for number columns). */
  min?: number;
  max?: number;
  /** Date range (ISO strings) for date columns. */
  minDate?: string;
  maxDate?: string;
}

/** Profile of a single worksheet. */
export interface SheetProfile {
  name: string;
  rowCount: number;
  columns: ColumnProfile[];
}

/** Detected relationship between two sheets that share a key column. */
export interface SheetRelationship {
  fromSheet: string;
  fromColumn: string;
  toSheet: string;
  toColumn: string;
}

/** Compact description of the workbook handed to the model. */
export interface DataDictionary {
  fileName: string;
  sheets: SheetProfile[];
  relationships: SheetRelationship[];
}

/** Parsed workbook data: every sheet's rows keyed by sheet name. */
export type WorkbookData = Record<string, SheetRow[]>;

/** A dataset stored server-side for a session. */
export interface StoredDataset {
  id: string;
  fileName: string;
  data: WorkbookData;
  dictionary: DataDictionary;
  createdAt: number;
  /** Origin of the dataset. "excel" = uploaded workbook; "screenshot" = OCR. */
  source: "excel" | "screenshot";
  /** Screenshot extraction details (only when source === "screenshot"). */
  extraction?: ScreenshotExtraction;
}

/**
 * Dataset payload returned to the client on upload and round-tripped back with
 * each chat request. Lets the app work on stateless/serverless platforms where
 * the upload and chat run in different instances (no shared in-memory store).
 */
export interface DatasetPayload {
  id: string;
  fileName: string;
  data: WorkbookData;
  dictionary: DataDictionary;
  source: "excel" | "screenshot";
  extraction?: ScreenshotExtraction;
}

/** Metadata extracted from a chart/visualization in a screenshot. */
export interface ChartMeta {
  title: string;
  /** e.g. "bar", "line", "pie", "table", "kpi", "unknown". */
  chartType: string;
  xAxis?: string;
  yAxis?: string;
  legend: string[];
  series: string[];
  /** Numeric data labels that were visible on the chart. */
  dataLabels: string[];
  notes?: string;
}

/** A KPI / single metric extracted from a screenshot. */
export interface ExtractedKpi {
  label: string;
  value: string;
  /** Optional comparison/delta text, e.g. "+12% vs last month". */
  change?: string;
}

/** Per-image extraction summary. */
export interface ScreenshotImageExtraction {
  name: string;
  summary: string;
  /** OCR confidence 0-100 (mean word confidence). */
  ocrConfidence: number;
  charts: ChartMeta[];
  kpis: ExtractedKpi[];
}

/**
 * Structured result of OCR + Claude extraction over one or more screenshots.
 * `tables` becomes the queryable WorkbookData (sheet name -> rows).
 */
export interface ScreenshotExtraction {
  perImage: ScreenshotImageExtraction[];
  /** Tables keyed by a generated table name (used as "sheets"). */
  tables: WorkbookData;
  /** Caveats: low confidence, charts without numeric labels, etc. */
  limitations: string;
}

/** Result returned by the sandboxed analysis tool. */
export interface AnalysisResult {
  ok: boolean;
  /** Tabular result rows (if any). */
  table?: Record<string, CellValue>[];
  /** A single scalar result (if any). */
  scalar?: CellValue;
  /** Free-form notes/labels the code wants to surface. */
  notes?: string;
  /** Error message when ok === false. */
  error?: string;
  /** How long the code ran, in ms. */
  durationMs?: number;
}

/** Result returned by the sandboxed analysis tool. */
export interface AnalysisResult {
  ok: boolean;
  /** Tabular result rows (if any). */
  table?: Record<string, CellValue>[];
  /** A single scalar result (if any). */
  scalar?: CellValue;
  /** Free-form notes/labels the code wants to surface. */
  notes?: string;
  /** Error message when ok === false. */
  error?: string;
  /** How long the code ran, in ms. */
  durationMs?: number;
}
