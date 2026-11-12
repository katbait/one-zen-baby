/* ============================================================
   model.js - the rules about boards (no screens, no saving details).
   ------------------------------------------------------------
   A board looks like:
   {
     id, name,
     pictureStyle: "drawn" | "photo",
     voice:        "device" | "own",
     items:   [ { id, word, emoji, imageRef, audioRef, showWord, speak, builtIn }, ... ],
              // imageRef / audioRef: refs to photo / recording files (storage.js), or null.
              // Built-in items use emoji; parents' own items use imageRef.
     enabled: [ "milk", "juice", ... ],   // ids shown on the board, in order
     setupDone: false,                    // true once the wizard is finished
     createdAt, updatedAt
   }
   ============================================================ */
import { STARTER_ITEMS } from "./starter.js";
import * as storage from "./storage.js";

export const PER_PAGE  = 4;    // tiles per screen (fixed by design)
export const MAX_TILES = 40;   // 10 screens of 4

/** A short unique id, e.g. "blq3x9k2ab1". */
export function makeId() {
  return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** A brand-new, empty board with sensible defaults. */
export function newBoard(name) {
  return {
    id: makeId(),
    name,
    pictureStyle: "drawn",
    voice: "device",
    items: STARTER_ITEMS.map(s => ({ ...s, showWord: true, speak: true, builtIn: true })),
    enabled: [],
    setupDone: false,
    createdAt: Date.now(),
  };
}

/** True if this many tiles fills whole screens and stays under the limit. */
export function isValidCount(n) {
  return n >= PER_PAGE && n <= MAX_TILES && n % PER_PAGE === 0;
}

/** The items shown on the board, in board order. */
export function enabledItems(board) {
  const byId = new Map(board.items.map(item => [item.id, item]));
  return board.enabled.map(id => byId.get(id)).filter(Boolean);
}

/** Keep a saved board's built-in items in step with starter.js
    (adds new starter words; updates their word/emoji if we changed them). */
export function syncStarters(board) {
  const starterIds = new Set(STARTER_ITEMS.map(s => s.id));

  // 1. Every current starter word, in starter.js order (new ones added, switched off).
  const starters = STARTER_ITEMS.map(starter => {
    const existing = board.items.find(item => item.id === starter.id);
    if (!existing) return { ...starter, showWord: true, speak: true, builtIn: true };
    existing.word = starter.word;
    existing.emoji = starter.emoji;
    return existing;
  });

  // 2. Old starter words that were removed from starter.js: keep them only if
  //    this board is still using them (so no child loses a tile unexpectedly).
  //    Once the parent switches one off, it's gone for good.
  const retired = board.items.filter(item =>
    item.builtIn && !starterIds.has(item.id) && board.enabled.includes(item.id));

  // 3. The parent's own pictures, unchanged, at the end.
  const own = board.items.filter(item => !item.builtIn);

  board.items = [...starters, ...retired, ...own];
}

/** The board the child should see (or null if there are none yet). */
export async function loadCurrentBoard() {
  const id = await storage.getCurrentBoardId();
  let board = id ? await storage.loadBoard(id) : null;
  if (!board) {
    // The remembered board is gone: fall back to the first one.
    const all = await storage.listBoards();
    board = all[0] || null;
    if (board) await storage.setCurrentBoardId(board.id);
  }
  if (board) syncStarters(board);
  return board;
}
