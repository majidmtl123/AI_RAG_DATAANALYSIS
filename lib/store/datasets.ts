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
