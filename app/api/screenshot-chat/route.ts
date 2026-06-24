import { convertToModelMessages, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { createScreenshotAgent } from "@/lib/agents/screenshot-agent";
import { getDataset } from "@/lib/store/datasets";
import type { AnalysisContext } from "@/lib/tools/analyze-data";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("api/screenshot-chat");

interface ChatRequestBody {
  messages: UIMessage[];
  datasetId?: string;
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const textPart = last?.parts.find((p) => p.type === "text");
  return textPart && "text" in textPart ? textPart.text : "";
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    log.error("Missing ANTHROPIC_API_KEY");
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => null)) as ChatRequestBody | null;
  if (!body || !Array.isArray(body.messages)) {
    log.warn("Invalid request body");
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.datasetId) {
    log.warn("Request without datasetId");
    return NextResponse.json({ error: "No datasetId. Upload screenshots first." }, { status: 400 });
  }

  const dataset = getDataset(body.datasetId);
  if (!dataset) {
    log.warn("Dataset not found or expired", { datasetId: body.datasetId });
    return NextResponse.json(
      { error: "Dataset not found or expired. Please re-upload your screenshots." },
      { status: 404 },
    );
  }
  if (dataset.source !== "screenshot" || !dataset.extraction) {
    log.warn("Dataset is not a screenshot dataset", { datasetId: body.datasetId });
    return NextResponse.json({ error: "This dataset is not a screenshot dataset." }, { status: 400 });
  }

  log.info("Screenshot chat request", {
    datasetId: body.datasetId,
    messages: body.messages.length,
    question: lastUserText(body.messages),
  });

  const context: AnalysisContext = { datasetId: body.datasetId };
  const agent = createScreenshotAgent(dataset.dictionary, dataset.extraction, context);

  const result = await agent.stream({
    messages: await convertToModelMessages(body.messages),
  });

  return result.toUIMessageStreamResponse();
}
