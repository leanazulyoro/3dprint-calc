/** Thin promise wrapper over IndexedDB for the local (offline) repository. */

export const DB_NAME = "calc3d";
const VERSION = 2;

export const STORES = { quotes: "quotes", printers: "printers" } as const;
export type StoreName = (typeof STORES)[keyof typeof STORES];

export function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.quotes)) {
        db.createObjectStore(STORES.quotes, { keyPath: "id" }).createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORES.printers)) {
        db.createObjectStore(STORES.printers, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir la base de datos"));
    req.onblocked = () => reject(new Error("Base de datos bloqueada por otra pestaña"));
  });
}

export async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
  dbName = DB_NAME,
): Promise<T> {
  const db = await openDb(dbName);
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = op(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Error de base de datos"));
      tx.onabort = () => reject(tx.error ?? new Error("Transacción abortada"));
    });
  } finally {
    db.close();
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Non-secure contexts only; the remote store needs real UUIDs.
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
