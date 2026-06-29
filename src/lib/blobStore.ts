/**
 * 文字列(dataURL)をキー付きで保存する最小の IndexedDB ストア。
 * 大きな写真は localStorage の容量制限を避けて IndexedDB に置く。
 * 失敗しても致命的でないため、各操作は握りつぶして既定値を返す。
 */
export function createBlobStore(dbName: string, storeName: string) {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB 非対応"));
        return;
      }
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  return {
    async put(key: string, value: string): Promise<void> {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        /* noop */
      }
    },
    async getAll(): Promise<Record<string, string>> {
      try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
          const out: Record<string, string> = {};
          const tx = db.transaction(storeName, "readonly");
          const cursorReq = tx.objectStore(storeName).openCursor();
          cursorReq.onsuccess = () => {
            const cur = cursorReq.result;
            if (cur) {
              out[String(cur.key)] = cur.value as string;
              cur.continue();
            } else {
              resolve(out);
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        });
      } catch {
        return {};
      }
    },
    async remove(key: string): Promise<void> {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        /* noop */
      }
    },
    async clear(): Promise<void> {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        /* noop */
      }
    },
  };
}
