/* ============================================================
   child.js - the board the child uses.
   1. Tap rules (see onTileTap).
   2. Tap vs swipe, and two fingers at once.
   3. Speech / recorded sound (see speech.js).
   4. The parent gate: press and hold the ⚙️ button for 2 seconds.
   The same view is used for "Preview", with a Back button instead of ⚙️.
   ============================================================ */
import { createPager } from "./pages.js";
import { showView } from "./views.js";
import { sayItem, stopSpeaking } from "./speech.js";

const MAX_LIT = 2;               // at most 2 tiles lit per screen
const SWIPE_PX = 10;             // a touch that moves farther than this is a swipe, not a tap
const HOLD_TO_OPEN_MS = 2000;    // how long to hold ⚙️ to open parent mode

const strip   = document.getElementById("pages");
const pager   = createPager(strip, document.getElementById("dots"));
const gateBtn = document.getElementById("parent-btn");
const gateHint = document.getElementById("parent-hint");
const exitBtn = document.getElementById("preview-exit");

let itemsById = new Map();       // quick lookup: item id -> item
let openParent = () => {};       // set by app.js (avoids files importing each other in a circle)
let exitPreview = null;          // what the Back button does in Preview

export function setParentOpener(fn) {
  openParent = fn;
}

/** Show the child board with these items (with photo/recording URLs
    already filled in - see boardTiles() in media.js).
    preview: true shows a Back button (calls onExit) instead of the ⚙️ gate. */
export function showChildBoard(items, { preview = false, onExit = null } = {}) {
  itemsById = new Map(items.map(item => [item.id, item]));
  gateBtn.hidden = preview;
  exitBtn.hidden = !preview;
  exitPreview = onExit;
  showView("child-view");        // show first, so the strip has a width when the pages are built
  pager.render(items);           // re-building also turns every tile off
  pager.goTo(0);
}


/* ============================================================
   1. TAP RULES (confirmed by the client)
   - Tap an unlit tile: it lights up and speaks.
   - Tap a lit tile: it turns off, silently.
   - EACH SCREEN IS SEPARATE: up to 2 tiles can be lit on every screen.
     Lit tiles on other screens stay lit and don't count here.
   - If 2 tiles on this screen are already lit, tapping a 3rd one on this
     screen is ignored (small shake). A lit tile must be tapped off first.
   We don't keep a separate list of lit tiles: the "on" CSS class on each
   tile is the record, and we count the lit tiles inside this tile's screen.
   ============================================================ */
function onTileTap(tile) {
  // Already lit -> turn it off, no sound.
  if (tile.classList.contains("on")) {
    tile.classList.remove("on");
    return;
  }

  // How many tiles are lit on THIS screen only?
  const screen = tile.closest(".page");
  const litOnThisScreen = screen.querySelectorAll(".tile.on").length;

  // Two already lit here -> ignore, but shake so the child sees the tap was noticed.
  if (litOnThisScreen >= MAX_LIT) {
    tile.classList.remove("nope");
    void tile.offsetWidth;   // trick: forces the browser to notice the class was removed, so the shake can replay
    tile.classList.add("nope");
    return;
  }

  // Otherwise light it up and say it.
  tile.classList.add("on");
  sayItem(itemsById.get(tile.dataset.id));
}


/* ============================================================
   2. TAP vs SWIPE, and TWO FINGERS
   Pointer events give every finger its own pointerId. We remember where
   each finger went down; when it lifts, if it moved less than SWIPE_PX
   it was a tap on the tile it started on.
   If the browser decides the touch is a swipe and starts scrolling, it
   sends "pointercancel" instead, and we simply forget that finger.
   ============================================================ */
const fingerStarts = new Map();   // pointerId -> { x, y, tile }

strip.addEventListener("pointerdown", e => {
  const tile = e.target.closest(".tile");   // the tile under the finger, or null for a gap
  fingerStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, tile });
});

strip.addEventListener("pointerup", e => {
  const start = fingerStarts.get(e.pointerId);
  fingerStarts.delete(e.pointerId);
  if (!start || !start.tile) return;

  const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);  // distance in pixels
  if (moved < SWIPE_PX) onTileTap(start.tile);
});

strip.addEventListener("pointercancel", e => fingerStarts.delete(e.pointerId));


/* (3. Speech / sound lives in speech.js: a recording if there is one,
   otherwise the built-in voice.) */


/* ============================================================
   4. PARENT GATE: press and hold ⚙️ for 2 seconds.
   A glowing ring grows while holding (CSS class "holding").
   Letting go early cancels, and briefly shows "Hold to open".
   ============================================================ */
let holdTimer = null;
let hintTimer = null;

gateBtn.addEventListener("pointerdown", () => {
  gateBtn.classList.add("holding");
  holdTimer = setTimeout(() => {
    holdTimer = null;
    gateBtn.classList.remove("holding");
    stopSpeaking();
    openParent();
  }, HOLD_TO_OPEN_MS);
});

function stopHold() {
  if (!holdTimer) return;           // not holding (or already opened)
  clearTimeout(holdTimer);
  holdTimer = null;
  gateBtn.classList.remove("holding");
  // Let go too early: show a short hint.
  gateHint.hidden = false;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { gateHint.hidden = true; }, 1800);
}
gateBtn.addEventListener("pointerup", stopHold);
gateBtn.addEventListener("pointerleave", stopHold);
gateBtn.addEventListener("pointercancel", stopHold);

// Preview's Back button.
exitBtn.addEventListener("click", () => {
  stopSpeaking();
  if (exitPreview) exitPreview();
});
