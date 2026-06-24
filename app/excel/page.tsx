"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import type { AnalystUIMessage } from "@/lib/agents/analyst-agent";
import type { DataDictionary, DatasetPayload } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

const SAMPLE_QUESTIONS = [
  "What were total sales last month?",
  "Which products generated the highest revenue?",
  "Which stores are underperforming?",
  "What trends do you see in the data?",
  "Identify anomalies in the dataset.",
  "Create an executive summary for management.",
];

export default function ExcelAnalysisPage() {
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [dictionary, setDictionary] = useState<DataDictionary | null>(null);
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status, error } = useChat<AnalystUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      setDatasetId(json.datasetId);
      setDictionary(json.dictionary);
      setDataset(json.dataset ?? null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
      setDatasetId(null);
      setDictionary(null);
      setDataset(null);
    } finally {
      setUploading(false);
    }
  }

  function ask(question: string) {
    if (!datasetId || busy || !question.trim()) return;
    // Send datasetId + the full dataset so the server can rehydrate it on
    // stateless/serverless instances where the in-memory store is empty.
    sendMessage({ text: question }, { body: { datasetId, dataset } });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
      {/* Left rail: workbook specimen sheet */}
      <aside className="shrink-0 lg:w-80 lg:overflow-y-auto">
        <div className="flex flex-col gap-4">
          <header>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-accent">
              Excel Analyst
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight text-ink">
              Ask your spreadsheet anything.
            </h1>
            <p className="mt-1 text-sm text-muted">
              One universal tool reads every sheet and computes real answers.
            </p>
          </header>

          <UploadZone
            uploading={uploading}
            fileName={dictionary?.fileName ?? null}
            onPick={() => fileRef.current?.click()}
            onDrop={handleFile}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          {uploadError && (
            <p className="rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-ink">
              {uploadError}
            </p>
          )}

          {dictionary && <WorkbookSummary dictionary={dictionary} />}
        </div>
      </aside>

      {/* Right: conversation */}
      <main className="flex min-h-[60vh] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-card/80 shadow-sm lg:min-h-0">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <EmptyState ready={!!datasetId} onAsk={ask} />
          ) : (
            messages.map((m) => <MessageView key={m.id} message={m} />)
          )}
          {busy && <ComputingRow />}
          {error && (
            <p className="rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm">
              {error.message || "Something went wrong. Try again."}
            </p>
          )}
        </div>

        <form
          className="border-t border-line p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder={datasetId ? "Ask a question about your data…" : "Upload a spreadsheet to begin"}
              disabled={!datasetId || busy}
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!datasetId || busy || !input.trim()}
              className="h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
            >
              Analyze
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function UploadZone({
  uploading,
  fileName,
  onPick,
  onDrop,
}: {
  uploading: boolean;
  fileName: string | null;
  onPick: () => void;
  onDrop: (file: File) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      className={`flex w-full flex-col items-start gap-1 rounded-lg border border-dashed px-4 py-4 text-left transition-colors ${
        over ? "border-accent bg-accent/5" : "border-line bg-card hover:border-accent/60"
      }`}
    >
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted">
        {uploading ? "Reading…" : fileName ? "Loaded" : "Upload"}
      </span>
      <span className="text-sm font-medium text-ink">
        {fileName ?? "Drop .xlsx / .csv or click"}
      </span>
    </button>
  );
}

function WorkbookSummary({ dictionary }: { dictionary: DataDictionary }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-3">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-muted">
        {dictionary.sheets.length} sheet{dictionary.sheets.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-col gap-3">
        {dictionary.sheets.map((sheet) => (
          <div key={sheet.name}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink">{sheet.name}</span>
              <span className="font-mono text-xs text-muted">{sheet.rowCount} rows</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {sheet.columns.map((col) => (
                <span
                  key={col.name}
                  title={`${col.type} · ${col.distinctCount} distinct`}
                  className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[0.68rem] text-ink"
                >
                  {col.name}
                  <span className="ml-1 text-accent">{typeLabel(col.type)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function typeLabel(t: string): string {
  switch (t) {
    case "number":
      return "#";
    case "date":
      return "⏱";
    case "category":
      return "▦";
    case "boolean":
      return "⊤";
    default:
      return "T";
  }
}

function EmptyState({ ready, onAsk }: { ready: boolean; onAsk: (q: string) => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 py-10">
      <p className="text-base text-muted">
        {ready ? "Your workbook is loaded. Try one of these:" : "Upload a spreadsheet to start analyzing."}
      </p>
      {ready && (
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComputingRow() {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-signal">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal" />
      computing…
    </div>
  );
}

function MessageView({ message }: { message: AnalystUIMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-paper"
            : "w-full max-w-none"
        }
      >
        {message.parts.map((part, idx) => {
          if (part.type === "text") {
            return isUser ? (
              <span key={idx}>{part.text}</span>
            ) : (
              <div
                key={idx}
                className="report text-sm text-ink"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(part.text) }}
              />
            );
          }
          if (isToolUIPart(part)) {
            return <ToolView key={idx} state={part.state} output={part.output} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

type ToolOutput = {
  ok: boolean;
  table?: Record<string, unknown>[];
  scalar?: unknown;
  notes?: string;
  error?: string;
};

function ToolView({ state, output }: { state: string; output: unknown }) {
  // Compact, collapsible view of the analysis the model ran.
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="my-2 flex items-center gap-2 font-mono text-xs text-signal">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-signal" />
        running analysis…
      </div>
    );
  }
  if (state === "output-available") {
    const result = output as ToolOutput;
    if (!result?.ok) {
      return (
        <div className="my-2 rounded-md border border-signal/40 bg-signal/10 px-3 py-1.5 font-mono text-xs text-ink">
          analysis error: {result?.error ?? "unknown"}
        </div>
      );
    }
    return (
      <details className="my-2 rounded-md border border-line bg-paper/60 px-3 py-1.5 text-xs">
        <summary className="cursor-pointer font-mono uppercase tracking-[0.12em] text-muted">
          analysis result
        </summary>
        <div className="mt-2 overflow-x-auto">
          {result.scalar !== undefined && (
            <p className="font-mono text-sm text-ink">= {String(result.scalar)}</p>
          )}
          {result.table && result.table.length > 0 && <ResultTable rows={result.table} />}
          {result.notes && <p className="mt-1 text-muted">{result.notes}</p>}
        </div>
      </details>
    );
  }
  return null;
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = Object.keys(rows[0] ?? {});
  const shown = rows.slice(0, 50);
  return (
    <table className="w-full border-collapse font-mono text-[0.72rem]">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} className="border border-line bg-card px-2 py-1 text-left">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c} className="border border-line px-2 py-1">
                {formatCell(r[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}
