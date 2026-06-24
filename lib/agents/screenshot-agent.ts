import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { analyzeData } from "@/lib/tools/analyze-data";
import { HELPERS_DOC } from "@/lib/analysis/helpers";
import { createLogger } from "@/lib/logger";
import type { DataDictionary, ScreenshotExtraction } from "@/lib/types";

export const SCREENSHOT_MODEL = "claude-sonnet-4-6";

const TOOLS = { analyzeData };
const log = createLogger("agent/screenshot");

/**
 * The single universal screenshot analyst agent (one tool only). Reuses the
 * sandboxed `analyzeData` tool to compute over OCR-extracted tables.
 */
export const screenshotAgent = new ToolLoopAgent({
  model: anthropic(SCREENSHOT_MODEL),
  tools: TOOLS,
  stopWhen: stepCountIs(8),
});

export type ScreenshotUIMessage = InferAgentUIMessage<typeof screenshotAgent>;

/** Build the per-request agent grounded in the screenshot extraction. */
export function createScreenshotAgent(
  dictionary: DataDictionary,
  extraction: ScreenshotExtraction,
  context: unknown,
) {
  return new ToolLoopAgent({
    model: anthropic(SCREENSHOT_MODEL),
    tools: TOOLS,
    stopWhen: stepCountIs(8),
    instructions: buildInstructions(dictionary, extraction),
    experimental_context: context,
    onStepFinish: (step) => {
      log.debug("Step finished", {
        step: step.stepNumber,
        finishReason: step.finishReason,
        toolCalls: step.toolCalls?.map((c) => c.toolName),
        toolResults: step.toolResults?.length ?? 0,
        textPreview: step.text ? step.text.slice(0, 120) : undefined,
        usage: step.usage,
      });
    },
    onFinish: (event) => {
      log.info("Agent finished", {
        finishReason: event.finishReason,
        steps: event.steps?.length,
        usage: event.usage,
      });
    },
  });
}

function buildInstructions(dictionary: DataDictionary, extraction: ScreenshotExtraction): string {
  const chartSummary = extraction.perImage
    .map((img) => {
      const charts = img.charts
        .map(
          (c) =>
            `  - [${c.chartType}] "${c.title}"` +
            (c.xAxis || c.yAxis ? ` axes(${c.xAxis ?? "?"} / ${c.yAxis ?? "?"})` : "") +
            (c.series.length ? ` series(${c.series.join(", ")})` : "") +
            (c.dataLabels.length ? ` labels(${c.dataLabels.join(", ")})` : " labels(none)"),
        )
        .join("\n");
      const kpis = img.kpis.map((k) => `  - ${k.label}: ${k.value}${k.change ? ` (${k.change})` : ""}`).join("\n");
      return `Screenshot "${img.name}" (OCR ${img.ocrConfidence}%): ${img.summary}\n${
        charts ? `Charts:\n${charts}\n` : ""
      }${kpis ? `KPIs:\n${kpis}` : ""}`;
    })
    .join("\n\n");

  return `You are a senior data analyst. You answer business questions about data EXTRACTED FROM SCREENSHOTS via OCR.

# Important about the source
- The data came from OCR on screenshots (Excel, dashboards, Power BI/Tableau, PDFs, reports, web apps). OCR can misread characters; treat values as approximate when OCR confidence is low.
- Charts were read as TEXT only. You can use printed axis labels, legends, and numeric data labels, but you CANNOT see chart shapes (line slopes, bar heights) when values are not labelled. When a chart lacks numeric labels, say the exact magnitudes are unknown.
- These known limitations apply: ${extraction.limitations || "none reported"}

# How you work
- For any quantitative claim over the extracted TABLES, you MUST call the \`analyzeData\` tool with JavaScript that returns the computed result. NEVER compute or guess numbers yourself.
- For chart/KPI narrative questions where no table exists, answer from the chart/KPI metadata below and clearly flag uncertainty.
- Maintain conversation context for follow-ups ("compare to last month", "why", "which KPI needs attention", "explain this dashboard").

# The analyzeData tool
- Your \`code\` is a JS function body with access to:
  - \`sheets\`: an object mapping table name -> array of row objects (keys are column headers).
  - \`helpers\`: utility functions (below).
- \`return\` your result: an array of row objects, a scalar, or { table: [...], scalar: ..., notes: '...' }.
- No imports, no async, no network/file access. Aggregate before returning; cap rows.

${HELPERS_DOC}

# Extracted tables (the queryable dataset)
${JSON.stringify(dictionary, null, 2)}

# Extracted charts & KPIs (text only — use for interpretation)
${chartSummary || "(none detected)"}

# Answer format
Structure EVERY substantive answer with these Markdown sections (omit one only if truly not applicable):

## Direct Answer
A direct, one- or two-sentence response.

## Key Findings
- 2-5 bullet points with the most important figures.

## Supporting Evidence
A compact Markdown table of the figures behind the answer, and which screenshot they came from.

## Insights
What the data means in business terms (trends, drivers, outliers).

## Business Impact
Why it matters.

## Recommended Actions
- Concrete, prioritized next steps.

Be concise and specific. Use real numbers from tool results. When OCR confidence is low or chart values are unlabelled, state the uncertainty plainly.`;
}
