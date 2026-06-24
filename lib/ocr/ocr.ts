import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createWorker, type Worker } from "tesseract.js";
import { preprocessImage } from "@/lib/ocr/preprocess";
import { createLogger } from "@/lib/logger";

const log = createLogger("ocr/ocr");

export interface OcrResult {
  name: string;
  text: string;
  /** Mean OCR confidence 0-100. */
  confidence: number;
}

// Cache the worker across requests (and dev hot-reloads). Creating a worker
// downloads the language data (~10-15MB) on first use, so reuse is important.
const globalForOcr = globalThis as unknown as { __ocrWorker?: Promise<Worker> };

/**
 * Resolve tesseract.js asset paths explicitly. Under Next.js bundling the
 * worker can't resolve its own worker-script via relative paths, so we point
 * it at the real files in node_modules. We resolve from the project's
 * node_modules (cwd) which is reliable for the Node server runtime.
 */
function resolvePaths() {
  const nm = path.join(process.cwd(), "node_modules");
  let tessDir = path.join(nm, "tesseract.js");
  let coreDir = path.join(nm, "tesseract.js-core");
  try {
    const require = createRequire(path.join(process.cwd(), "noop.js"));
    tessDir = path.dirname(require.resolve("tesseract.js/package.json"));
    coreDir = path.dirname(require.resolve("tesseract.js-core/package.json"));
  } catch {
    // fall back to cwd/node_modules paths above
  }

  // The lang-data cache must be in a WRITABLE directory. On Vercel (and most
  // serverless platforms) the deployment filesystem is read-only except for the
  // OS temp dir, so use that there. Locally we keep the project-local cache so
  // the (~10-15MB) eng.traineddata download persists across restarts.
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const cachePath = isServerless
    ? path.join(os.tmpdir(), "tesseract-cache")
    : path.join(process.cwd(), ".tesseract-cache");

  return {
    workerPath: path.join(tessDir, "src", "worker-script", "node", "index.js"),
    corePath: coreDir,
    cachePath,
  };
}

function getWorker(): Promise<Worker> {
  if (!globalForOcr.__ocrWorker) {
    const paths = resolvePaths();
    log.info("Creating Tesseract worker (eng)", paths);
    globalForOcr.__ocrWorker = (async () => {
      // Ensure the (writable) cache dir exists before the worker tries to
      // download/read eng.traineddata into it.
      await fs.mkdir(paths.cachePath, { recursive: true }).catch(() => {});
      return createWorker("eng", undefined, {
        workerPath: paths.workerPath,
        corePath: paths.corePath,
        cachePath: paths.cachePath,
      });
    })();
    // If worker creation fails, don't cache the rejected promise — clear it so
    // a later request can retry instead of failing forever.
    globalForOcr.__ocrWorker.catch(() => {
      globalForOcr.__ocrWorker = undefined;
    });
  }
  return globalForOcr.__ocrWorker;
}

/** Run OCR over a single image (bytes), preprocessing it first. */
export async function ocrImage(name: string, bytes: Uint8Array): Promise<OcrResult> {
  const worker = await getWorker();
  const processed = await preprocessImage(bytes);

  // tesseract.js in Node reliably reads a file PATH; write the preprocessed
  // image to a temp file and pass that path.
  const tmpPath = path.join(os.tmpdir(), `ocr-${randomUUID()}.png`);
  await fs.writeFile(tmpPath, processed);

  const started = Date.now();
  try {
    const { data } = await worker.recognize(tmpPath);
    const text = (data.text ?? "").trim();
    const confidence = Math.round(data.confidence ?? 0);

    log.info("OCR complete", {
      name,
      confidence,
      chars: text.length,
      elapsedMs: Date.now() - started,
    });
    return { name, text, confidence };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

/** Run OCR over multiple images sequentially (one shared worker). */
export async function ocrImages(images: { name: string; bytes: Uint8Array }[]): Promise<OcrResult[]> {
  const results: OcrResult[] = [];
  for (const img of images) {
    results.push(await ocrImage(img.name, img.bytes));
  }
  return results;
}
