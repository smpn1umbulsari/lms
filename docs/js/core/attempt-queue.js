// Antrean Persistif IndexedDB (fallback localStorage) untuk Jawaban & Submit Ujian CBT
const DB_NAME = "situri_cbt_db";
const DB_VERSION = 1;
const STORE_NAME = "attempts";
const LS_FALLBACK_KEY = "situri_cbt_attempts_v1";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "startId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb-error"));
  });
}

/** Factory murni berbasis storage agar dapat diuji di Node.js tanpa DOM/IDB. */
export function createFallbackStore(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const readMap = () => {
    if (!storage) return {};
    try {
      const raw = JSON.parse(storage.getItem(LS_FALLBACK_KEY) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch (e) {
      return {};
    }
  };
  const writeMap = (map) => {
    if (!storage) return;
    try {
      storage.setItem(LS_FALLBACK_KEY, JSON.stringify(map));
    } catch (e) {}
  };

  return {
    async put(rec) {
      if (!rec?.startId) return;
      const map = readMap();
      map[rec.startId] = { ...rec, updatedAtMs: rec.updatedAtMs || Date.now() };
      writeMap(map);
    },
    async get(startId) {
      return readMap()[startId] || null;
    },
    async del(startId) {
      const map = readMap();
      delete map[startId];
      writeMap(map);
    },
    async listPending(uid) {
      return Object.values(readMap()).filter((r) => r && (!uid || r.uid === uid) && r.pendingSubmit);
    }
  };
}

const fallback = () => createFallbackStore();

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result ?? null);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("idb-tx-error"));
    };
  });
}

export async function putLocalAttempt(rec) {
  if (!rec?.startId) return;
  const normalized = { ...rec, updatedAtMs: rec.updatedAtMs || Date.now() };
  try {
    await withStore("readwrite", (s) => s.put(normalized));
  } catch (e) {
    await fallback().put(normalized);
  }
}

export async function getLocalAttempt(startId) {
  if (!startId) return null;
  try {
    return (await withStore("readonly", (s) => s.get(startId))) || (await fallback().get(startId));
  } catch (e) {
    return fallback().get(startId);
  }
}

export async function deleteLocalAttempt(startId) {
  if (!startId) return;
  try {
    await withStore("readwrite", (s) => s.delete(startId));
  } catch (e) {}
  await fallback().del(startId);
}

export async function listPendingAttempts(uid) {
  try {
    const all = (await withStore("readonly", (s) => s.getAll())) || [];
    const lsPending = await fallback().listPending(uid);
    const byId = new Map();
    [...lsPending, ...all].forEach((r) => {
      if (r && (!uid || r.uid === uid) && r.pendingSubmit) byId.set(r.startId, r);
    });
    return [...byId.values()];
  } catch (e) {
    return fallback().listPending(uid);
  }
}
