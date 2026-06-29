/**
 * 発見アルバムの証拠写真ストア（IndexedDB）。
 * 図鑑メタデータ（軽量）は localStorage、写真（重い dataURL）はこちらに分離して保存する。
 * localStorage の容量制限を避け、写真は必要なときに非同期で読み出す。
 */

const DB_NAME = "kamere-dex";
const STORE = "photos";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 非対応"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 証拠写真（dataURL）を伝統色キーで保存。失敗しても致命的でないので握りつぶす。 */
export async function putPhoto(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* 写真は付加価値。保存できなくても発見自体は成立させる。 */
  }
}

/** 発見済みキーすべての写真をまとめて取得（romaji → dataURL）。 */
export async function getAllPhotos(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const out: Record<string, string> = {};
      const tx = db.transaction(STORE, "readonly");
      const cursorReq = tx.objectStore(STORE).openCursor();
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
}

/** 全写真を消去（図鑑リセット時）。 */
export async function clearPhotos(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* noop */
  }
}
