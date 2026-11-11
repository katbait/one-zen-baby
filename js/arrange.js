/* ============================================================
   arrange.js - rearrange tiles like apps on a phone home screen.
   ------------------------------------------------------------
   - Press and hold a tile (0.4 s) to pick it up. It follows your finger.
   - Hold it near the left or right edge to flip to the previous/next screen.
   - Drop it on another tile (any screen): the two tiles SWAP places.
   - Moving your finger before the hold finishes is a normal swipe.
   Every swap is saved straight away.

   The tricky part: the strip normally scrolls sideways when you drag.
   Once a tile is picked up we stop that by cancelling the browser's
   "touchmove" events (see the bottom of this file), so the drag moves
   the tile instead of the screen.
   ============================================================ */
import { createPager } from "./pages.js";
import { showView } from "./views.js";
import { boardTiles } from "./media.js";
import * as storage from "./storage.js";

const HOLD_MS      = 400;   // how long to hold before a tile is picked up
const SLOP_PX      = 10;    // moving more than this before then = a swipe instead
const EDGE_PX      = 32;    // how close to the screen edge counts as "at the edge"
const EDGE_WAIT_MS = 700;   // how long to hover at the edge before the screen flips

const strip    = document.getElementById("arrange-pages");
const pager    = createPager(strip, document.getElementById("arrange-dots"));
const backBtn  = document.getElementById("arrange-back");
const doneBtn  = document.getElementById("arrange-done");
const stepEl   = document.getElementById("arrange-step");

let board  = null;
let onBack = null;
let onDone = null;

let press = null;   // a finger is down on a tile, waiting to see if it's a hold
let drag  = null;   // a tile is picked up and being dragged

/** Open the Arrange view for a board. */
export async function showArrange(theBoard, { stepLabel = "", onBack: back, onDone: done }) {
  board = theBoard;
  onBack = back;
  onDone = done;
  stepEl.textContent = stepLabel;
  showView("arrange-view");
  pager.render(await boardTiles(board));
  pager.goTo(0);
}

backBtn.addEventListener("click", () => onBack && onBack());
doneBtn.addEventListener("click", () => onDone && onDone());


/* ---------- Press: start waiting for a hold ---------- */
strip.addEventListener("pointerdown", e => {
  if (drag || press) return;               // only one tile at a time
  const tile = e.target.closest(".tile");
  if (!tile) return;
  press = {
    pointerId: e.pointerId,
    startX: e.clientX, startY: e.clientY,
    x: e.clientX, y: e.clientY,
    tile,
    timer: setTimeout(pickUp, HOLD_MS),
  };
});

function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
}

/* ---------- Pick up: make a floating copy ("ghost") that follows the finger ---------- */
function pickUp() {
  const { tile, x, y, pointerId } = press;
  press = null;

  const rect = tile.getBoundingClientRect();
  const ghost = tile.cloneNode(true);
  ghost.classList.add("ghost");
  ghost.style.width  = rect.width + "px";
  ghost.style.height = rect.height + "px";
  document.body.appendChild(ghost);

  drag = {
    pointerId, tile, ghost,
    offsetX: x - rect.left,      // where on the tile the finger is, so it doesn't jump
    offsetY: y - rect.top,
    target: null,                // tile currently under the finger
    edgeSide: 0,                 // -1 = left edge, 1 = right edge, 0 = neither
    edgeTimer: null,
  };
  tile.classList.add("lifted");
  strip.classList.add("dragging");                  // stops swipe-scrolling (see style.css)
  if (navigator.vibrate) navigator.vibrate(30);     // small buzz on Android so you feel it pick up
  moveDrag(x, y);
}

/* ---------- Move ---------- */
window.addEventListener("pointermove", e => {
  if (press && e.pointerId === press.pointerId) {
    press.x = e.clientX;
    press.y = e.clientY;
    const moved = Math.hypot(e.clientX - press.startX, e.clientY - press.startY);
    if (moved > SLOP_PX) cancelPress();             // moved too soon: it's a swipe, not a hold
    return;
  }
  if (drag && e.pointerId === drag.pointerId) moveDrag(e.clientX, e.clientY);
});

function moveDrag(x, y) {
  drag.ghost.style.left = (x - drag.offsetX) + "px";
  drag.ghost.style.top  = (y - drag.offsetY) + "px";

  // Outline the tile under the finger (the ghost ignores pointers, so we see through it).
  const target = tileAt(x, y);
  if (target !== drag.target) {
    if (drag.target) drag.target.classList.remove("target");
    if (target) target.classList.add("target");
    drag.target = target;
  }

  // Near an edge? Start a timer to flip screens.
  const side = x < EDGE_PX ? -1 : x > window.innerWidth - EDGE_PX ? 1 : 0;
  if (side !== drag.edgeSide) {
    drag.edgeSide = side;
    clearTimeout(drag.edgeTimer);
    if (side !== 0) drag.edgeTimer = setTimeout(flipScreen, EDGE_WAIT_MS);
  }
}

function flipScreen() {
  if (!drag || drag.edgeSide === 0) return;
  pager.goTo(pager.page + drag.edgeSide, true);
  // Still at the edge? Keep flipping, a bit slower.
  drag.edgeTimer = setTimeout(flipScreen, EDGE_WAIT_MS * 1.5);
}

/** The tile (other than the one being dragged) at a screen point, or null. */
function tileAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const tile = el && el.closest("#arrange-pages .tile");
  return tile && tile !== drag.tile ? tile : null;
}

/* ---------- Drop ---------- */
window.addEventListener("pointerup", e => {
  if (drag && e.pointerId === drag.pointerId) drop(e.clientX, e.clientY);
  else if (press && e.pointerId === press.pointerId) cancelPress();
});

window.addEventListener("pointercancel", e => {
  if (drag && e.pointerId === drag.pointerId) endDrag();
  else if (press && e.pointerId === press.pointerId) cancelPress();
});

async function drop(x, y) {
  const target = tileAt(x, y);
  const fromId = drag.tile.dataset.id;
  endDrag();
  if (!target) return;                     // dropped on nothing: tile goes back

  // Swap the two ids in the board's order, save, and redraw.
  const order = board.enabled;
  const i = order.indexOf(fromId);
  const j = order.indexOf(target.dataset.id);
  [order[i], order[j]] = [order[j], order[i]];   // swap (like a, b = b, a in Python)
  await storage.saveBoard(board);
  pager.render(await boardTiles(board));   // stays on the current screen
}

function endDrag() {
  clearTimeout(drag.edgeTimer);
  drag.ghost.remove();
  drag.tile.classList.remove("lifted");
  if (drag.target) drag.target.classList.remove("target");
  strip.classList.remove("dragging");
  drag = null;
}

/* While a tile is being dragged, cancel touchmove so the browser doesn't
   scroll the strip. { passive: false } is required, or browsers ignore
   preventDefault() on touch events for speed. */
document.addEventListener("touchmove", e => {
  if (drag) e.preventDefault();
}, { passive: false });
