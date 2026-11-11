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

// Coming in step 3: saveBlob() / getBlob() for photos and voice recordings (IndexedDB).
