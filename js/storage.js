/* ============================================================
   storage.js - the ONLY file that saves or loads data.
   ------------------------------------------------------------
   Today it saves boards in the browser's localStorage on this device.
   In step 5 this file will be rewritten to use Firebase, and nothing
   else in the app should need to change.

   Why every function is "async":
   Firebase (and IndexedDB, used for photos/audio in step 3) can't answer
   instantly; they return a Promise (like a Python awaitable). Making
   these functions async now means the rest of the app already uses
   `await storage.loadBoard(...)`, so swapping the storage later is painless.

   Data shape: all boards are kept in one JSON object, keyed by board id:
     { "b1abc": { id, name, items, enabled, ... }, "b2xyz": {...} }
   ============================================================ */

const BOARDS_KEY  = "oneZenBaby.boards";
const CURRENT_KEY = "oneZenBaby.currentBoardId";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(BOARDS_KEY)) || {};
  } catch {
    return {};   // missing or damaged data: start fresh rather than crash
  }
}

function writeAll(all) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(all));
}

/** All boards, oldest first. */
export async function listBoards() {
  return Object.values(readAll()).sort((a, b) => a.createdAt - b.createdAt);
}

/** One board by id, or null. */
export async function loadBoard(id) {
  return readAll()[id] || null;
}

/** Create or update a board. */
export async function saveBoard(board) {
  const all = readAll();
  board.updatedAt = Date.now();
  all[board.id] = board;
  writeAll(all);
}

export async function deleteBoard(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

/** Which board the child sees. */
export async function getCurrentBoardId() {
  return localStorage.getItem(CURRENT_KEY);
}

export async function setCurrentBoardId(id) {
  localStorage.setItem(CURRENT_KEY, id);
}

/* ============================================================
   PHOTOS AND RECORDINGS ("blobs" = chunks of file data)
   ------------------------------------------------------------
   These are too big for localStorage, so they go in IndexedDB, the
   browser's built-in database for larger data. A board only stores a
   short reference ("ref") to each file, like a filename.

   IndexedDB is old and uses callbacks (onsuccess/onerror) instead of
   Promises, so the two helpers below wrap it to work with `await`.
   We store each file as { type, data: ArrayBuffer } instead of the Blob
   itself, which older iPhones handled badly.
   ============================================================ */
const DB_NAME = "oneZenBaby";
const STORE   = "blobs";
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      // Runs only the first time (or when the version number goes up): create the table.
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

/** Run one request against the blobs table and wait for it to finish. */
async function runRequest(mode, makeRequest) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = makeRequest(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Ask the browser not to clear our data when the device is low on space.
    (Browsers may delete website data to free up room unless it's marked
    "persistent". Chrome decides quietly; nothing pops up.) Done once, the
    first time a photo or recording is saved. */
let askedToPersist = false;
function askToKeepData() {
  if (askedToPersist) return;
  askedToPersist = true;
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

/** Save a file; returns its ref (a short id string). */
export async function saveBlob(blob) {
  askToKeepData();
  const ref = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const record = { type: blob.type, data: await blob.arrayBuffer() };
  await runRequest("readwrite", store => store.put(record, ref));
  return ref;
}

/** Get a file back by ref (or null if it's missing). */
export async function getBlob(ref) {
  const record = await runRequest("readonly", store => store.get(ref));
  return record ? new Blob([record.data], { type: record.type }) : null;
}

export async function deleteBlob(ref) {
  await runRequest("readwrite", store => store.delete(ref));
}
