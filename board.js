/* ============================================================
   Choice Board - child mode
   ------------------------------------------------------------
   What this file does:
   1. Builds screens of 4 tiles from the ITEMS list.
   2. Handles taps with the client's rules (see onTileTap).
   3. Tells taps apart from swipes, and supports two fingers at once.
   4. Keeps the page dots in sync, and keeps your place when the phone rotates.
   ============================================================ */
"use strict";   // makes JavaScript report more mistakes instead of ignoring them

/* ---------- DATA ----------
   Placeholder list for now. In step 2 this will come from the parent's
   settings through storage.js instead of being written here.
   Each item:
     id        - stable unique name (never shown)
     word      - what is shown and spoken
     emoji     - placeholder picture (or `image`: a URL for a real picture)
     showWord  - show the word under the picture?
     speak     - say it aloud when lit?
     audio     - optional URL of a recorded sound; played instead of the
                 device voice when present */
// The developer's starter list (24 items = 6 full screens), in their order.
// Emoji are placeholders until real drawings/photos are chosen.
const ITEMS = [
  { id: "i-want",        word: "I want",        emoji: "🙋" },
  { id: "bath",          word: "Bath",          emoji: "🛁" },
  { id: "eat",           word: "Eat",           emoji: "🍽️" },
  { id: "drink",         word: "Drink",         emoji: "🥤" },
  { id: "milk",          word: "Milk",          emoji: "🥛" },
  { id: "water",         word: "Water",         emoji: "💧" },
  { id: "juice",         word: "Juice",         emoji: "🧃" },
  { id: "snack",         word: "Snack",         emoji: "🍪" },
  { id: "play",          word: "Play",          emoji: "🧸" },
  { id: "go-outside",    word: "Go Outside",    emoji: "🌳" },
  { id: "go-play",       word: "Go Play",       emoji: "⚽" },
  { id: "go-to-park",    word: "Go to Park",    emoji: "🏞️" },
  { id: "take-nap",      word: "Take Nap",      emoji: "😴" },
  { id: "cars",          word: "Cars",          emoji: "🚗" },
  { id: "animals",       word: "Animals",       emoji: "🦁" },
  { id: "puppies",       word: "Puppies",       emoji: "🐶" },
  { id: "kitties",       word: "Kitties",       emoji: "🐱" },
  { id: "grandma",       word: "Grandma",       emoji: "👵" },
  { id: "grandpa",       word: "Grandpa",       emoji: "👴" },
  { id: "tablet",        word: "Tablet",        emoji: "💻" },  // no tablet emoji exists; placeholder
  { id: "phone",         word: "Phone",         emoji: "📱" },
  { id: "tv",            word: "TV",            emoji: "📺" },
  { id: "grocery-store", word: "Grocery Store", emoji: "🛒" },
  { id: "swimming",      word: "Swimming",      emoji: "🏊" },
].map(item => ({ showWord: true, speak: true, ...item }));   // fill in defaults
// (`...item` copies the item's own fields last, so they override the defaults.)

/* ---------- SETTINGS (fixed by design, not parent options) ---------- */
const PER_PAGE = 4;    // tiles per screen
const MAX_LIT  = 2;    // at most 2 tiles highlighted per screen
const SWIPE_PX = 10;   // a touch that moves farther than this is a swipe, not a tap

/* ---------- STATE ---------- */
let currentPage = 0;    // which screen is showing (0 = first)

const itemsById = new Map(ITEMS.map(item => [item.id, item]));  // quick lookup by id
const pagesEl = document.getElementById("pages");
const dotsEl  = document.getElementById("dots");


/* ============================================================
   1. BUILD THE SCREENS
   ============================================================ */
function render() {
  pagesEl.innerHTML = "";
  dotsEl.innerHTML = "";

  const pageCount = Math.ceil(ITEMS.length / PER_PAGE);
  for (let p = 0; p < pageCount; p++) {
    const page = document.createElement("div");
    page.className = "page";
    // Take the 4 items for this screen (slice end is exclusive).
    const pageItems = ITEMS.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    pageItems.forEach(item => page.appendChild(makeTile(item)));
    pagesEl.appendChild(page);
    dotsEl.appendChild(document.createElement("span"));
  }
  dotsEl.classList.toggle("single", pageCount <= 1);
  updateDots();
}

function makeTile(item) {
  const tile = document.createElement("div");
  tile.className = "tile";
  if (!item.showWord) tile.classList.add("no-word");
  tile.dataset.id = item.id;                  // becomes the HTML attribute data-id="apple"
  tile.setAttribute("role", "button");        // tells screen readers it's tappable
  tile.setAttribute("aria-label", item.word);

  // Picture: a real image if there is one, otherwise the emoji placeholder.
  let pic;
  if (item.image) {
    pic = document.createElement("img");
    pic.src = item.image;
    pic.alt = "";
    pic.draggable = false;
  } else {
    pic = document.createElement("div");
    pic.textContent = item.emoji;
  }
  pic.className = "pic";
  tile.appendChild(pic);

  if (item.showWord) {
    const word = document.createElement("div");
    word.className = "word";
    word.textContent = item.word;
    tile.appendChild(word);
  }
  return tile;
}


/* ============================================================
   2. TAP RULES (confirmed by the client)
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

// Play the item's recorded sound if it has one, otherwise use the device voice.
function sayItem(item) {
  if (!item || !item.speak) return;

  if (item.audio) {
    new Audio(item.audio).play().catch(() => speakWord(item.word));  // fall back to voice if playback fails
  } else {
    speakWord(item.word);
  }
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) return;   // very old browser: stay silent
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = document.documentElement.lang || "en";
  utterance.rate = 0.85;                         // a little slower than normal, for small children
  // We don't cancel what's already playing, so two quick taps are both heard in turn.
  speechSynthesis.speak(utterance);
}


/* ============================================================
   3. TAP vs SWIPE, and TWO FINGERS
   Pointer events give every finger its own pointerId. We remember where
   each finger went down; when it lifts, if it moved less than SWIPE_PX
   it was a tap on the tile it started on.
   If the browser decides the touch is a swipe and starts scrolling, it
   sends "pointercancel" instead, and we simply forget that finger.
   ============================================================ */
const fingerStarts = new Map();   // pointerId -> { x, y, tile }

pagesEl.addEventListener("pointerdown", e => {
  const tile = e.target.closest(".tile");   // the tile under the finger, or null for a gap
  fingerStarts.set(e.pointerId, { x: e.clientX, y: e.clientY, tile });
});

pagesEl.addEventListener("pointerup", e => {
  const start = fingerStarts.get(e.pointerId);
  fingerStarts.delete(e.pointerId);
  if (!start || !start.tile) return;

  const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);  // distance in pixels
  if (moved < SWIPE_PX) onTileTap(start.tile);
});

pagesEl.addEventListener("pointercancel", e => fingerStarts.delete(e.pointerId));

// Block the long-press menu (and right-click menu on desktop) in child mode.
document.addEventListener("contextmenu", e => e.preventDefault());


/* ============================================================
   4. PAGE DOTS and ROTATION
   ============================================================ */
function updateDots() {
  [...dotsEl.children].forEach((dot, i) => dot.classList.toggle("cur", i === currentPage));
}

// While swiping, work out which screen is showing.
pagesEl.addEventListener("scroll", () => {
  const width = pagesEl.clientWidth;
  if (width === 0) return;
  const page = Math.round(pagesEl.scrollLeft / width);
  if (page !== currentPage) {
    currentPage = page;
    updateDots();
  }
});

// When the phone rotates, the screen width changes, and the old scroll
// position could land between two screens. Jump back to the same screen.
// (Browsers run "resize" before "scroll" in the same frame, so currentPage
// still holds the screen we were on.)
window.addEventListener("resize", () => {
  pagesEl.scrollLeft = currentPage * pagesEl.clientWidth;
});


/* ---------- START ---------- */
render();
