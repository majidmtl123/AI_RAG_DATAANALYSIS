import { Worker } from "node:worker_threads";
import type { AnalysisResult, WorkbookData } from "@/lib/types";
import { HELPERS_SOURCE } from "@/lib/analysis/helpers";
import { createLogger } from "@/lib/logger";

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_ROWS = 1000;
const log = createLogger("analysis/sandbox");

/**
 * Run model-authored analysis code against the dataset in an isolated worker.
 *
 * Isolation model:
 * - Code runs inside a `vm` context in a separate worker thread.
 * - The context exposes ONLY: `sheets`, `helpers`, `result`, `Math`, `JSON`,
 *   `Date`, `Object`, `Array`, `Number`, `String`, `Boolean`. No require,
 *   process, fs, network, or timers.
 * - A hard timeout (vm `timeout` + worker kill) bounds CPU.
 *
 * NOTE: `vm` is not a hardened security boundary against a determined attacker,
 * but combined with the stripped context + worker timeout it is adequate for
 * running trusted-model-generated analytical code. See AGENTS.md.
 */
export function runAnalysis(code: string, data: WorkbookData): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;

    const sheetSizes = Object.fromEntries(
      Object.entries(data).map(([name, rows]) => [name, rows.length]),
    );
    log.debug("Running analysis in worker", { codeLength: code.length, sheets: sheetSizes });

    const finish = (r: AnalysisResult) => {
      if (settled) return;
      settled = true;
      r.durationMs = Date.now() - started;
      if (r.ok) {
        log.debug("Worker returned result", { durationMs: r.durationMs, rows: r.table?.length ?? 0 });
      } else {
        log.warn("Worker returned error", { durationMs: r.durationMs, error: r.error });
      }
      worker.terminate().catch(() => {});
      resolve(r);
    };

    const worker = new Worker(buildWorkerSource(), {
      eval: true,
      workerData: { code, data, helpersSource: HELPERS_SOURCE, timeoutMs: TIMEOUT_MS, maxRows: MAX_OUTPUT_ROWS },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });

    const killTimer = setTimeout(() => {
      finish({ ok: false, error: `Analysis timed out after ${TIMEOUT_MS}ms.` });
    }, TIMEOUT_MS + 1000);

    worker.on("message", (msg: AnalysisResult) => {
      clearTimeout(killTimer);
      finish(msg);
    });
    worker.on("error", (err) => {
      clearTimeout(killTimer);
      finish({ ok: false, error: err.message });
    });
    worker.on("exit", (codeNum) => {
      clearTimeout(killTimer);
      if (!settled) finish({ ok: false, error: `Worker exited unexpectedly (code ${codeNum}).` });
    });
  });
}

/** Source of the worker thread (runs untrusted code in a vm sandbox). */
function buildWorkerSource(): string {
  return String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');

try {
  const { code, data, helpersSource, timeoutMs, maxRows } = workerData;

  const sandbox = {
    sheets: data,
    result: undefined,
    Math, JSON, Date, Object, Array, Number, String, Boolean, isNaN, parseFloat, parseInt,
  };
  vm.createContext(sandbox);

  // Inject helpers, then the model's code. The code may either assign to
  // \`result\` or return a value via a wrapping function.
  const program =
    helpersSource +
    '\n;(function(){ "use strict";\n' +
    'const __run = (function(){\n' + code + '\n});\n' +
    'const __out = __run();\n' +
    'if (__out !== undefined) { result = __out; }\n' +
    '})();';

  vm.runInContext(program, sandbox, { timeout: timeoutMs });

  let out = sandbox.result;
  const response = { ok: true };

  if (out === undefined || out === null) {
    response.notes = 'Code produced no result value.';
  } else if (Array.isArray(out)) {
    response.table = out.slice(0, maxRows).map(normalizeRow);
    if (out.length > maxRows) response.notes = 'Truncated to ' + maxRows + ' of ' + out.length + ' rows.';
  } else if (typeof out === 'object') {
    if (Array.isArray(out.table)) {
      response.table = out.table.slice(0, maxRows).map(normalizeRow);
    }
    if (out.scalar !== undefined) response.scalar = normalizeScalar(out.scalar);
    if (typeof out.notes === 'string') response.notes = out.notes;
    if (response.table === undefined && response.scalar === undefined && !response.notes) {
      // Plain object: surface as a single-row table.
      response.table = [normalizeRow(out)];
    }
  } else {
    response.scalar = normalizeScalar(out);
  }

  parentPort.postMessage(response);
} catch (err) {
  parentPort.postMessage({ ok: false, error: (err && err.message) ? err.message : String(err) });
}

function normalizeScalar(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  return JSON.stringify(v);
}

function normalizeRow(row) {
  if (row === null || typeof row !== 'object') return { value: normalizeScalar(row) };
  const out = {};
  for (const k of Object.keys(row)) out[k] = normalizeScalar(row[k]);
  return out;
}
`;
}
