import type { CalcInput, CalcResult } from "./calc";
import type { CurrencyCode } from "./format";

/** A saved calculation: the inputs plus the result as it was at save time. */
export type Quote = {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  currency: CurrencyCode;
  input: CalcInput;
  result: CalcResult;
};

const DB_NAME = "calc3d";
const STORE = "quotes";
const VERSION = 1;

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir la base de datos"));
    req.onblocked = () => reject(new Error("Base de datos bloqueada por otra pestaña"));
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Error de base de datos"));
      tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada"));
    });
  } finally {
    db.close();
  }
}

/** Newest first. */
export async function listQuotes(): Promise<Quote[]> {
  const all = await run<Quote[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putQuote(quote: Quote): Promise<void> {
  await run("readwrite", (s) => s.put(quote));
}

export async function deleteQuote(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}

export function newQuoteId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
