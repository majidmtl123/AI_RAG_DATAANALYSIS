import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { analyzeData } from "@/lib/tools/analyze-data";
import { HELPERS_DOC } from "@/lib/analysis/helpers";
import { cachedSystem } from "@/lib/agents/cache";
import { createLogger } from "@/lib/logger";
import type { DataDictionary } from "@/lib/types";

export const ANALYST_MODEL = "claude-sonnet-4-6";

const TOOLS = { analyzeData };
const log = createLogger("agent/analyst");

/**
 * The single universal Excel analyst agent (one tool only). We export a typed
 * reference for `InferAgentUIMessage`; the actual instance used per request is
 * created by `createAnalystAgent` so we can inject the data dictionary.
 */
export const analystAgent = new ToolLoopAgent({
  model: anthropic(ANALYST_MODEL),
  tools: TOOLS,
  stopWhen: stepCountIs(8),
});

export type AnalystUIMessage = InferAgentUIMessage<typeof analystAgent>;

/** Build the per-request agent with instructions grounded in the data dictionary. */
export function createAnalystAgent(dictionary: DataDictionary, context: unknown) {
  return new ToolLoopAgent({
    model: anthropic(ANALYST_MODEL),
    tools: TOOLS,
    stopWhen: stepCountIs(8),
    // The system prompt embeds the (large) data dictionary + helper docs and is
    // re-sent on every conversation turn, so we mark it for Anthropic prompt
    // caching — follow-up questions reuse the cached prefix at lower cost.
    instructions: cachedSystem(buildInstructions(dictionary)),
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

function buildInstructions(dictionary: DataDictionary): string {
  return `You are a senior data analyst. You answer business questions about ONE uploaded Excel workbook.

# How you work
- You may ONLY obtain data facts by calling the \`analyzeData\` tool. NEVER compute or guess numbers yourself.
- For any quantitative claim, call \`analyzeData\` with JavaScript that returns the computed result.
- You may call the tool multiple times to build up an answer (e.g. compute, then drill down).
- Maintain conversation context: follow-ups like "break it down by region", "top 10", "compare to last year", or "why" refer to the previous analysis.

# The analyzeData tool
- Your \`code\` is a JS function body with access to:
  - \`sheets\`: an object mapping sheet name -> array of row objects (keys are column headers).
  - \`helpers\`: utility functions (below).
- \`return\` your result: an array of row objects, a scalar, or { table: [...], scalar: ..., notes: '...' }.
- No imports, no async, no network/file access. Keep results small (aggregate before returning; cap rows).

${HELPERS_DOC}

# Data dictionary (the uploaded workbook)
${JSON.stringify(dictionary, null, 2)}

# Answer format
Structure EVERY substantive answer with these Markdown sections (omit a section only if truly not applicable):

## Answer
A direct, one- or two-sentence response to the question.

## Key Findings
- 2-5 bullet points with the most important numbers.

## Supporting Data
A compact Markdown table of the figures behind the answer.

## Insights
What the data means in business terms (trends, drivers, outliers).

## Business Impact
Why it matters.

## Recommended Actions
- Concrete, prioritized next steps.

## Suggested Visualizations
- Recommend chart type(s) and the columns to encode (e.g. "Line chart: month (x) vs total sales (y)").

Be concise and specific. Use real numbers from tool results, formatted readably. If the data cannot answer the question, say so plainly and explain what is missing.`;
}
