import { convertToModelMessages, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { createAnalystAgent } from "@/lib/agents/analyst-agent";
import { getDataset, putDataset } from "@/lib/store/datasets";
import type { AnalysisContext } from "@/lib/tools/analyze-data";
import type { DatasetPayload } from "@/lib/types";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const log = createLogger("api/chat");

interface ChatRequestBody {
  messages: UIMessage[];
  datasetId?: string;
  /** Full dataset, round-tripped by the client for stateless/serverless use. */
  dataset?: DatasetPayload;
}

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const textPart = last?.parts.find((p) => p.type === "text");
  return textPart && "text" in textPart ? textPart.text : "";
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();

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
    return NextResponse.json({ error: "No datasetId. Upload a spreadsheet first." }, { status: 400 });
  }

  // Fast path: in-memory store. Fallback: rehydrate from the client payload
  // (required on serverless where upload/chat run in different instances).
  let dataset = getDataset(body.datasetId);
  if (!dataset && body.dataset && body.dataset.id === body.datasetId) {
    dataset = putDataset(body.dataset);
    log.info("Rehydrated dataset from client payload", { datasetId: body.datasetId });
  }
  if (!dataset) {
    log.warn("Dataset not found or expired", { datasetId: body.datasetId });
    return NextResponse.json(
      { error: "Dataset not found or expired. Please re-upload the Excel file." },
      { status: 404 },
    );
  }

  log.info("Chat request received", {
    datasetId: body.datasetId,
    file: dataset.fileName,
    messages: body.messages.length,
    question: lastUserText(body.messages),
  });

  const context: AnalysisContext = { datasetId: body.datasetId };
  const agent = createAnalystAgent(dataset.dictionary, context);

  const result = await agent.stream({
    messages: await convertToModelMessages(body.messages),
  });

  log.debug("Streaming response to client", { elapsedMs: Date.now() - startedAt });
  return result.toUIMessageStreamResponse();
}
