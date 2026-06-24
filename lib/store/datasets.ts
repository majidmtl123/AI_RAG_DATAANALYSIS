import { randomUUID } from "node:crypto";
import type { DataDictionary, StoredDataset, WorkbookData } from "@/lib/types";

/**
 * In-memory session store for parsed datasets.
 *
 * Notes / limitations (see AGENTS.md):
 * - Lives in the Node process memory; lost on server restart.
 * - Single-instance only (not shared across serverless instances).
 * - Datasets expire after TTL to avoid unbounded memory growth.
 */
const TTL_MS = 1000 * 60 * 60; // 1 hour
const MAX_DATASETS = 25;

// Survive Next.js dev hot-reloads by stashing the map on globalThis.
const globalForStore = globalThis as unknown as {
  __datasetStore?: Map<string, StoredDataset>;
};
const store: Map<string, StoredDataset> =
  globalForStore.__datasetStore ?? (globalForStore.__datasetStore = new Map());

export function saveDataset(
  fileName: string,
  data: WorkbookData,
  dictionary: DataDictionary,
  options: { source?: StoredDataset["source"]; extraction?: StoredDataset["extraction"] } = {},
): StoredDataset {
  evictExpired();
  evictOldestIfFull();

  const dataset: StoredDataset = {
    id: randomUUID(),
    fileName,
    data,
    dictionary,
    createdAt: Date.now(),
    source: options.source ?? "excel",
    extraction: options.extraction,
  };
  store.set(dataset.id, dataset);
  return dataset;
}

export function getDataset(id: string): StoredDataset | undefined {
  const dataset = store.get(id);
  if (!dataset) return undefined;
  if (Date.now() - dataset.createdAt > TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return dataset;
}

/**
 * Rehydrate a dataset into the store from a client-provided payload. Used on
 * serverless platforms (e.g. Vercel) where the upload and chat requests may run
 * in different instances, so the in-memory store from upload is not visible to
 * the chat request. The client round-trips the parsed dataset and we restore it.
 */
export function putDataset(dataset: {
  id: string;
  fileName: string;
  data: WorkbookData;
  dictionary: DataDictionary;
  source?: StoredDataset["source"];
  extraction?: StoredDataset["extraction"];
}): StoredDataset {
  evictExpired();
  evictOldestIfFull();
  const stored: StoredDataset = {
    id: dataset.id,
    fileName: dataset.fileName,
    data: dataset.data,
    dictionary: dataset.dictionary,
    createdAt: Date.now(),
    source: dataset.source ?? "excel",
    extraction: dataset.extraction,
  };
  store.set(stored.id, stored);
  return stored;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [id, dataset] of store) {
    if (now - dataset.createdAt > TTL_MS) store.delete(id);
  }
}

function evictOldestIfFull(): void {
  while (store.size >= MAX_DATASETS) {
    const oldest = [...store.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!oldest) break;
    store.delete(oldest.id);
  }
}
