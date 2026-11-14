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
     enabled: [ "milk", "blank-1", ... ], // ids shown on the board, in order;
              // "blank-N" = an empty spot (see BLANK SPOTS below)
     setupDone: false,                    // true once the wizard is finished
     createdAt, updatedAt
   }
   ============================================================ */
import { STARTER_ITEMS } from "./starter.js";
import * as storage from "./storage.js";

export const PER_PAGE  = 4;    // tiles per screen (fixed by design)
export const MAX_TILES = 36;   // 9 screens of 4

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

/** True if a board can have this many pictures (at least 1, at most 36). */
export function isValidCount(n) {
  return n >= 1 && n <= MAX_TILES;
}

/* ------------------------------------------------------------
   BLANK SPOTS
   Every screen shows exactly 4 spots. If the number of pictures doesn't
   fill the last screen (e.g. 34 = 8 screens + 2), the board gets 1 to 3
   blank spots to fill it. They live in `enabled` as "blank-1", "blank-2"...
   so they can be dragged to any screen in Arrange, like a picture.
   ------------------------------------------------------------ */
const BLANK_PREFIX = "blank-";

export function isBlankId(id) {
  return id.startsWith(BLANK_PREFIX);
}

/** How many pictures (not blanks) are on the board. */
export function wordCount(board) {
  return board.enabled.filter(id => !isBlankId(id)).length;
}

/** How many blank spots n pictures need to fill the last screen (0-3). */
export function blanksNeeded(n) {
  return (PER_PAGE - (n % PER_PAGE)) % PER_PAGE;
}

/** Add or remove blank spots so the board always fills whole screens.
    Extra blanks are removed starting from the end (so a newly added picture
    takes the last blank's place); missing blanks are added at the end. */
export function normalizeBlanks(board) {
  const need = blanksNeeded(wordCount(board));
  let have = board.enabled.filter(isBlankId).length;
  for (let i = board.enabled.length - 1; i >= 0 && have > need; i--) {
    if (isBlankId(board.enabled[i])) {
      board.enabled.splice(i, 1);
      have--;
    }
  }
  while (have < need) {
    board.enabled.push(BLANK_PREFIX + "new");
    have++;
  }
  // Number them 1, 2, 3 in board order, so each has its own id.
  let k = 0;
  board.enabled = board.enabled.map(id => isBlankId(id) ? BLANK_PREFIX + (++k) : id);
}

/** Put a picture on the board. It goes at the end, but before any blank spots
    at the end (it fills the first of them), so blanks stay at the end unless
    the parent moved them somewhere else in Arrange. */
export function addToBoard(board, id) {
  let i = board.enabled.length;
  while (i > 0 && isBlankId(board.enabled[i - 1])) i--;   // i = where the blanks at the end start
  if (i < board.enabled.length) board.enabled[i] = id;    // take the first trailing blank's place
  else board.enabled.push(id);
  normalizeBlanks(board);
}

/** The items shown on the board, in board order (blank spots as { id, blank: true }). */
export function enabledItems(board) {
  const byId = new Map(board.items.map(item => [item.id, item]));
  return board.enabled
    .map(id => isBlankId(id) ? { id, blank: true } : byId.get(id))
    .filter(Boolean);
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
  if (board) {
    syncStarters(board);
    normalizeBlanks(board);
  }
  return board;
}
