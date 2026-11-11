/* ============================================================
   parent.js - the setup wizard, the parent menu, and boards.
   ------------------------------------------------------------
   Two ways in:
   - SETUP mode: first time through. Steps run in order:
       Pictures -> Words -> Add your own? -> Voice -> Preview? -> Arrange
     then the child board.
   - EDIT mode: from the parent menu, change any ONE step, then come
     back to the menu. Leaving a step with Back throws away unsaved
     changes; Next/Save keeps them.

   How the screens are drawn: each screen is an HTML string put into
   #parent-view. Buttons carry data-action="..." and one click listener
   (at the bottom) looks up that action in the `actions` table.
   ============================================================ */
import * as storage from "./storage.js";
import { newBoard, enabledItems, loadCurrentBoard, isValidCount, PER_PAGE, MAX_TILES } from "./model.js";
import { showView } from "./views.js";
import { showChildBoard } from "./child.js";
import { showArrange } from "./arrange.js";

const el = document.getElementById("parent-view");

const STEPS = ["style", "words", "own", "voice", "preview", "arrange"];

let board = null;              // the board being set up or edited
let mode = "setup";            // "setup" or "edit" (see top of file)
let stepIndex = 0;             // which of STEPS is showing
let previousBoardId = null;    // when making a NEW board: the board to go back to if cancelled


/* ============================================================
   ENTRY POINTS (used by app.js)
   ============================================================ */
export function startSetup(theBoard, prevBoardId = null) {
  board = theBoard;
  mode = "setup";
  previousBoardId = prevBoardId;
  goStep(0);
}

export async function openParentMenu() {
  await showMenu();
}


/* ============================================================
   MOVING BETWEEN STEPS
   ============================================================ */
function goStep(i) {
  stepIndex = i;
  const key = STEPS[i];
  if (key !== "arrange") showView("parent-view");   // Arrange has its own view
  RENDER[key]();
}

function stepLabel() {
  return mode === "setup" ? `Step ${stepIndex + 1} of ${STEPS.length}` : "";
}

/** Save, then go to the next step (setup) or back to the menu (edit). */
async function finishStep() {
  await storage.saveBoard(board);
  if (mode === "edit") await showMenu();
  else goStep(stepIndex + 1);
}

async function goBack() {
  if (mode === "edit") return showMenu();        // showMenu reloads the saved board, dropping unsaved changes
  if (stepIndex > 0) return goStep(stepIndex - 1);
  // Back on the very first step of a NEW board: cancel it, return to the old board.
  if (previousBoardId) {
    await storage.deleteBoard(board.id);
    await storage.setCurrentBoardId(previousBoardId);
    await showMenu();
  }
}

function goChild() {
  showChildBoard(enabledItems(board));
}

function showPreview(onExit) {
  showChildBoard(enabledItems(board), { preview: true, onExit });
}


/* ============================================================
   SCREEN HELPERS
   ============================================================ */

/** Make text safe to put inside HTML (so a board named "<b>" shows as text). */
function esc(text) {
  return String(text).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Draw a standard wizard screen: Back + step label, title, body, optional footer. */
function screen({ title, sub = "", body = "", footer = "", backAction = "back" }) {
  const showBack = mode === "edit" || stepIndex > 0 || previousBoardId;
  el.innerHTML = `
    <header class="bar">
      ${showBack ? `<button class="btn-back" data-action="${backAction}">‹ Back</button>` : "<span></span>"}
      <span class="step">${stepLabel()}</span>
    </header>
    <main class="parent-body">
      <h1>${esc(title)}</h1>
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
      ${body}
    </main>
    ${footer ? `<footer class="parent-footer">${footer}</footer>` : ""}`;
}

/** Big tappable choice cards. Each: { action, value, pic, label, small, selected } */
function choices(list) {
  const cards = list.map(c => `
    <button class="choice ${c.selected ? "selected" : ""}" data-action="${c.action}" data-value="${c.value || ""}">
      <span class="choice-pic" aria-hidden="true">${c.pic}</span>
      <span>${esc(c.label)}</span>
      ${c.small ? `<small>${esc(c.small)}</small>` : ""}
    </button>`);
  return `<div class="choices">${cards.join("")}</div>`;
}

function nextButton() {
  return `<button class="btn primary" data-action="next">${mode === "edit" ? "Save" : "Next"}</button>`;
}


/* ============================================================
   THE STEPS
   ============================================================ */
const RENDER = {
  // Step 1: picture style. One tap and done.
  style() {
    screen({
      title: "Which kind of pictures?",
      body: choices([
        { action: "pick-style", value: "drawn", pic: "🖍️", label: "Drawings",    selected: board.pictureStyle === "drawn" },
        { action: "pick-style", value: "photo", pic: "📷", label: "Real photos", selected: board.pictureStyle === "photo" },
      ]),
    });
  },

  // Step 2: choose words. Tap cards on/off. Next only works when screens are full.
  words() {
    const cards = board.items.map(item => {
      const on = board.enabled.includes(item.id);
      return `
        <button class="word-card ${on ? "on" : ""}" data-action="toggle-word" data-id="${esc(item.id)}" aria-pressed="${on}">
          <span class="pic" aria-hidden="true">${esc(item.emoji || "")}</span>
          <span class="w">${esc(item.word)}</span>
          <span class="check" aria-hidden="true">✓</span>
        </button>`;
    });
    screen({
      title: "Choose the words",
      sub: `Each screen shows ${PER_PAGE}.`,
      body: `<div class="word-grid">${cards.join("")}</div>`,
      footer: `<span class="status" id="word-status"></span>${nextButton()}`,
    });
    updateWordStatus();
  },

  // Step 3: add your own? (the photo screen itself comes in build step 3)
  own() {
    screen({
      title: "Add your own pictures?",
      sub: "For example, a photo of your dog, or of Grandma.",
      body: choices([
        { action: "own-yes", pic: "📸", label: "Yes" },
        { action: "own-no",  pic: "👍", label: "No, not now" },
      ]),
    });
  },

  // Step 4: voice for the whole board.
  voice() {
    screen({
      title: "Which voice says the words?",
      body: choices([
        { action: "pick-voice", value: "device", pic: "🔊", label: "Built-in voice", small: "Easiest. Ready now.",    selected: board.voice === "device" },
        { action: "pick-voice", value: "own",    pic: "🎙️", label: "My own voice",   small: "You record each word.", selected: board.voice === "own" },
      ]) + `<p class="note">You can change this any time.</p>`,
    });
  },

  // Step 5: preview? (setup only; from the menu, Preview opens directly)
  preview() {
    screen({
      title: "See it the way your child will?",
      body: choices([
        { action: "preview-yes", pic: "👀", label: "Yes, show me", selected: true },
        { action: "preview-no",  pic: "⏭️", label: "No, skip" },
      ]),
    });
  },

  // Step 6: arrange (its own view, see arrange.js).
  arrange() {
    showArrange(board, {
      stepLabel: stepLabel(),
      onBack: goBack,
      onDone: async () => {
        if (mode === "setup") {
          board.setupDone = true;
          await storage.saveBoard(board);
          goChild();                 // setup finished: straight to the child board
        } else {
          await showMenu();
        }
      },
    });
  },
};

/** Words step: update "8 chosen · 2 screens" and enable/disable Next. */
function updateWordStatus() {
  const n = board.enabled.length;
  const statusEl = document.getElementById("word-status");
  const nextBtn = el.querySelector('[data-action="next"]');
  const ok = isValidCount(n);

  let text;
  if (n === 0) {
    text = "Tap words to choose them.";
  } else if (ok) {
    const screens = n / PER_PAGE;
    text = `${n} chosen · ${screens} ${screens === 1 ? "screen" : "screens"} ✓`;
  } else {
    const extra = n % PER_PAGE;            // tiles on the unfinished last screen
    const need = PER_PAGE - extra;
    text = `${n} chosen · choose ${need} more` + (n > PER_PAGE ? ` or remove ${extra}` : "") + " to fill the screen";
  }
  statusEl.textContent = text;
  statusEl.classList.toggle("ok", ok);
  nextBtn.disabled = !ok;
}


/* ============================================================
   PARENT MENU (behind the ⚙️ gate)
   ============================================================ */
const MENU_ITEMS = [
  // [step key, icon, label]
  ["style",   "🖼️", "Pictures"],
  ["words",   "🔤", "Words"],
  ["own",     "➕", "Your own pictures"],
  ["voice",   "🔊", "Voice"],
  ["arrange", "↔️", "Arrange"],
];

async function showMenu({ renaming = false } = {}) {
  mode = "edit";
  previousBoardId = null;
  board = await loadCurrentBoard();
  const boards = (await storage.listBoards()).filter(b => b.setupDone);
  showView("parent-view");

  const title = renaming
    ? `<input class="name-input" id="name-input" value="${esc(board.name)}" maxlength="40" aria-label="Board name">
       <button class="btn primary" data-action="save-name">Save</button>`
    : `<h1>${esc(board.name)}</h1>
       <button class="btn small" data-action="rename">Rename</button>`;

  const stepButtons = MENU_ITEMS.map(([key, icon, label]) => `
    <button class="menu-item" data-action="edit-step" data-step="${key}">
      <span class="icon" aria-hidden="true">${icon}</span>${label}
    </button>`).join("") + `
    <button class="menu-item" data-action="menu-preview">
      <span class="icon" aria-hidden="true">👀</span>Preview
    </button>`;

  const boardRows = boards.map(b => b.id === board.id
    ? `<div class="board-row current">✓ ${esc(b.name)} <small>showing now</small></div>`
    : `<button class="board-row" data-action="use-board" data-id="${esc(b.id)}">${esc(b.name)}</button>`
  ).join("");

  el.innerHTML = `
    <header class="bar">
      <span class="step">Parent settings</span>
      <button class="btn primary" data-action="to-child">Back to board ▶</button>
    </header>
    <main class="parent-body">
      <div class="title-row">${title}</div>

      <h2>Change this board</h2>
      <div class="menu-grid">${stepButtons}</div>

      <h2>Boards</h2>
      <div class="board-list">${boardRows}</div>
      <div class="row">
        <button class="btn" data-action="new-board">+ New board</button>
        ${boards.length > 1 ? `<button class="btn danger" data-action="delete-board">Delete this board</button>` : ""}
      </div>
    </main>`;

  if (renaming) {
    const input = document.getElementById("name-input");
    input.focus();
    input.select();
  }
}

function editStep(key) {
  mode = "edit";
  goStep(STEPS.indexOf(key));
}

async function saveName() {
  const name = document.getElementById("name-input").value.trim();
  if (name) {
    board.name = name;
    await storage.saveBoard(board);
  }
  await showMenu();
}

async function startNewBoard() {
  const all = await storage.listBoards();
  const fresh = newBoard(`Board ${all.length + 1}`);
  await storage.saveBoard(fresh);
  await storage.setCurrentBoardId(fresh.id);
  startSetup(fresh, board.id);       // Back on step 1 cancels and returns to this board
}

/** Delete needs two taps: the first arms the button, the second deletes. */
async function deleteCurrentBoard(btn) {
  if (!btn.classList.contains("armed")) {
    btn.classList.add("armed");
    btn.textContent = `Tap again to delete “${board.name}”`;
    setTimeout(() => {
      btn.classList.remove("armed");
      btn.textContent = "Delete this board";
    }, 4000);
    return;
  }
  await storage.deleteBoard(board.id);
  const rest = (await storage.listBoards()).filter(b => b.setupDone);
  await storage.setCurrentBoardId(rest[0].id);
  await showMenu();
}


/* ============================================================
   BUTTON ACTIONS: data-action name -> what it does
   ============================================================ */
const actions = {
  // wizard navigation
  "back":      goBack,
  "redo-step": () => goStep(stepIndex),     // Back from a sub-screen to the step's question
  "next":      finishStep,

  // step answers
  "pick-style": btn => { board.pictureStyle = btn.dataset.value; finishStep(); },
  "toggle-word": btn => {
    const id = btn.dataset.id;
    if (board.enabled.includes(id)) {
      board.enabled = board.enabled.filter(x => x !== id);
    } else if (board.enabled.length < MAX_TILES) {
      board.enabled.push(id);                // new words go at the end; Arrange can move them
    }
    const on = board.enabled.includes(id);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    updateWordStatus();
  },
  "own-yes": () => screen({
    title: "Your own pictures",
    body: `<p class="note">Coming in the next update: take or choose a photo and type its word.</p>`,
    footer: nextButton(),
    backAction: "redo-step",
  }),
  "own-no": finishStep,
  "pick-voice": btn => {
    board.voice = btn.dataset.value;
    if (board.voice === "device") return finishStep();
    screen({
      title: "My own voice",
      body: `<p class="note">Recording your voice is coming in the next update. Until then, the built-in voice says the words.</p>`,
      footer: nextButton(),
      backAction: "redo-step",
    });
  },
  "preview-yes": () => showPreview(finishStep),   // after looking, carry on to the next step
  "preview-no":  finishStep,

  // parent menu
  "to-child":     goChild,
  "edit-step":    btn => editStep(btn.dataset.step),
  "menu-preview": () => showPreview(showMenu),
  "rename":       () => showMenu({ renaming: true }),
  "save-name":    saveName,
  "use-board":    async btn => { await storage.setCurrentBoardId(btn.dataset.id); await showMenu(); },
  "new-board":    startNewBoard,
  "delete-board": deleteCurrentBoard,
};

// One listener for every button in parent mode.
el.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  const action = actions[btn.dataset.action];
  if (action) action(btn);
});

// Enter key saves the board name.
el.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "name-input") saveName();
});
