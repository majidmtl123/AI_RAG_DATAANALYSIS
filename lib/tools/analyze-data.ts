import { tool, type UIToolInvocation } from "ai";
import { z } from "zod";
import { getDataset } from "@/lib/store/datasets";
import { runAnalysis } from "@/lib/analysis/sandbox";
import { createLogger } from "@/lib/logger";
import type { AnalysisResult } from "@/lib/types";

const log = createLogger("tool/analyzeData");

/** Context passed from the API route into the tool via experimental_context. */
export interface AnalysisContext {
  datasetId: string;
}

function isAnalysisContext(ctx: unknown): ctx is AnalysisContext {
  return typeof ctx === "object" && ctx !== null && typeof (ctx as AnalysisContext).datasetId === "string";
}

/**
 * THE single universal analysis tool.
 *
 * The model writes a JavaScript function body (`code`) that computes the answer
 * from the workbook. The body runs in a sandbox where:
 *   - `sheets` is an object: { [sheetName]: Array<rowObject> }
 *   - `helpers` provides aggregation/grouping/date/trend utilities
 *   - the function should `return` its result (array of rows, a scalar, or
 *     { table, scalar, notes })
 */
export const analyzeData = tool({
  description:
    "Run a JavaScript analysis over the uploaded Excel workbook and return computed results. " +
    "This is the ONLY way to read or compute over the data. Use it for every quantitative claim " +
    "(totals, averages, group-bys, top-N, filters, trends, comparisons). Never compute numbers yourself.",
  inputSchema: z.object({
    reasoning: z
      .string()
      .describe("One sentence: what this analysis computes and which sheet/columns it uses."),
    code: z
      .string()
      .describe(
        "JavaScript function body. Has access to `sheets` (object of sheetName -> row arrays) and " +
          "`helpers`. Must `return` the result: an array of row objects, a scalar, or " +
          "{ table: [...], scalar: ..., notes: '...' }. No imports, no async, no I/O.",
      ),
  }),
  execute: async ({ reasoning, code }, { experimental_context: ctx }): Promise<AnalysisResult> => {
    log.info("Tool invoked", { reasoning });
    log.debug("Generated analysis code", { code });

    if (!isAnalysisContext(ctx)) {
      log.warn("No dataset context available");
      return { ok: false, error: "No dataset context available for this request." };
    }
    const dataset = getDataset(ctx.datasetId);
    if (!dataset) {
      log.warn("Dataset not found or expired", { datasetId: ctx.datasetId });
      return { ok: false, error: "Dataset not found or expired. Please re-upload the Excel file." };
    }

    const result = await runAnalysis(code, dataset.data);
    if (result.ok) {
      log.info("Analysis ok", {
        durationMs: result.durationMs,
        rows: result.table?.length ?? 0,
        hasScalar: result.scalar !== undefined,
        notes: result.notes,
      });
    } else {
      log.error("Analysis failed", { error: result.error, durationMs: result.durationMs });
    }
    return result;
  },
});

export type AnalyzeDataInvocation = UIToolInvocation<typeof analyzeData>;
