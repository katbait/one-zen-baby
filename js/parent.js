/* ============================================================
   parent.js - the setup wizard, the parent menu, and boards.
   ------------------------------------------------------------
   Two ways in:
   - SETUP mode: first time through. Steps run in order:
       Pictures -> Words -> Your own pictures -> Voice -> Preview? -> Arrange
     then the child board.
   - EDIT mode: from the parent menu, change any ONE step, then come
     back to the menu. Leaving a step with Back throws away unsaved
     changes; Next/Save keeps them. (Photos and recordings are saved
     the moment you make them.)

   The "every screen has 4 tiles" rule: in setup, the Words step allows
   any number (a parent may want all their own pictures), and the check
   happens at the Your own pictures step, where the totals come together.
   In edit mode, Save always needs full screens.

   How the screens are drawn: each screen is an HTML string put into
   #parent-view. Buttons carry data-action="..." and one click listener
   (at the bottom) looks up that action in the `actions` table.
   ============================================================ */
import * as storage from "./storage.js";
import { newBoard, enabledItems, loadCurrentBoard, isValidCount, makeId, PER_PAGE, MAX_TILES } from "./model.js";
import { showView } from "./views.js";
import { showChildBoard } from "./child.js";
import { showArrange } from "./arrange.js";
import { withMedia, boardTiles, mediaUrl, deleteMedia, deleteBoardMedia, resizeImage } from "./media.js";
import { speakWord, playUrl, stopSpeaking } from "./speech.js";
import { startRecording, canRecord, micErrorMessage } from "./recorder.js";
import { isInstalled, canPromptInstall, isIos, promptInstall } from "./install.js";

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
  if (mode === "setup") return goStep(stepIndex + 1);

  // Edit mode. If the parent uses their own voice and just added words
  // that have no recording yet, ask them to record those now.
  const key = STEPS[stepIndex];
  if (board.voice === "own" && (key === "words" || key === "own")) {
    const missing = enabledItems(board).filter(item => !item.audioRef).map(item => item.id);
    if (missing.length) return startVoiceWalk(missing, { onDone: showMenu, onBack: showMenu });
  }
  await showMenu();
}

async function goBack() {
  if (mode === "edit") return showMenu();        // showMenu reloads the saved board, dropping unsaved changes
  if (stepIndex > 0) return goStep(stepIndex - 1);
  // Back on the very first step of a NEW board: cancel it, return to the old board.
  if (previousBoardId) {
    await deleteBoardMedia(board);
    await storage.deleteBoard(board.id);
    await storage.setCurrentBoardId(previousBoardId);
    await showMenu();
  }
}

async function goChild() {
  showChildBoard(await boardTiles(board));
}

async function showPreview(onExit) {
  showChildBoard(await boardTiles(board), { preview: true, onExit });
}


/* ============================================================
   SCREEN HELPERS
   ============================================================ */

/** Make text safe to put inside HTML (so a word like "<b>" shows as text). */
function esc(text) {
  return String(text).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Draw a standard wizard screen: Back + step label, title, body, optional footer. */
function screen({ title, sub = "", body = "", footer = "", backAction = "back" }) {
  cancelRecording();                              // leaving a screen stops any recording
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

/** Big tappable choice cards. Each: { action, value, pic, label, small, selected, disabled } */
function choices(list) {
  const cards = list.map(c => `
    <button class="choice ${c.selected ? "selected" : ""}" data-action="${c.action}" data-value="${c.value || ""}" ${c.disabled ? "disabled" : ""}>
      <span class="choice-pic" aria-hidden="true">${c.pic}</span>
      <span>${esc(c.label)}</span>
      ${c.small ? `<small>${esc(c.small)}</small>` : ""}
    </button>`);
  return `<div class="choices">${cards.join("")}</div>`;
}

function nextButton() {
  return `<button class="btn primary" data-action="next">${mode === "edit" ? "Save" : "Next"}</button>`;
}

/** The picture for an item: its photo if it has one, else its emoji. */
function picHtml(item) {
  return item.image
    ? `<img class="pic" src="${item.image}" alt="">`
    : `<span class="pic" aria-hidden="true">${esc(item.emoji || "")}</span>`;
}

/** A tappable on/off card used by the Words and Your own pictures steps. */
function wordCard(item) {
  const on = board.enabled.includes(item.id);
  return `
    <button class="word-card ${on ? "on" : ""}" data-action="toggle-word" data-id="${esc(item.id)}" aria-pressed="${on}">
      ${picHtml(item)}
      <span class="w">${esc(item.word)}</span>
      <span class="check" aria-hidden="true">✓</span>
    </button>`;
}

/** Two-tap safety for deleting: the first tap arms the button, the second does it.
    Returns true on the second tap. */
function confirmTap(btn, armedText) {
  if (btn.classList.contains("armed")) return true;
  const original = btn.textContent;
  btn.classList.add("armed");
  btn.textContent = armedText;
  setTimeout(() => {
    btn.classList.remove("armed");
    btn.textContent = original;
  }, 4000);
  return false;
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

  // Step 2: choose words (starter words, plus any of the parent's own pictures).
  async words() {
    const items = await withMedia(board.items);
    screen({
      title: "Choose the words",
      sub: `Each screen shows ${PER_PAGE}.` + (mode === "setup" ? " You can add your own pictures next." : ""),
      body: `<div class="word-grid">${items.map(wordCard).join("")}</div>`,
      footer: `<span class="status" id="word-status"></span>${nextButton()}`,
    });
    updateWordStatus();
  },

  // Step 3: the parent's own pictures.
  // No own pictures yet: ask "Add your own?". Otherwise: show them, with "+ Add a picture".
  async own() {
    const own = board.items.filter(item => !item.builtIn);

    if (!own.length) {
      const n = board.enabled.length;
      const ok = isValidCount(n);
      screen({
        title: "Add your own pictures?",
        sub: "For example, a photo of your dog, Grandma, or a favorite food.",
        body: choices([
          { action: "add-own", pic: "📸", label: "Yes" },
          { action: "own-no",  pic: "👍", label: "No, not now", disabled: !ok },
        ]) + (ok ? "" : `<p class="note warn">You have ${n} ${n === 1 ? "word" : "words"}. Each screen needs ${PER_PAGE}, so add your own pictures, or go back and change the words.</p>`),
      });
      return;
    }

    const items = await withMedia(own);
    const cards = items.map(item => `
      <div class="own-card">
        ${wordCard(item)}
        <button class="edit-link" data-action="edit-own" data-id="${esc(item.id)}">Edit</button>
      </div>`).join("");
    screen({
      title: "Your own pictures",
      sub: "Tap a picture to show or hide it on the board.",
      body: `<div class="word-grid">
               ${cards}
               <button class="word-card add-card" data-action="add-own">
                 <span class="pic" aria-hidden="true">＋</span><span class="w">Add a picture</span>
               </button>
             </div>`,
      footer: `<span class="status" id="word-status"></span>
               <button class="btn" data-action="change-words">Change words</button>
               ${nextButton()}`,
    });
    updateWordStatus();
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

/** Update "8 chosen · 2 screens" and turn Next on/off.
    Next needs full screens, except on the Words step during setup
    (the parent may still add their own pictures). */
function updateWordStatus() {
  const statusEl = document.getElementById("word-status");
  const nextBtn = el.querySelector('[data-action="next"]');
  if (!statusEl || !nextBtn) return;

  const n = board.enabled.length;
  const ok = isValidCount(n);
  const wordsInSetup = mode === "setup" && STEPS[stepIndex] === "words";

  let text;
  if (n === 0) {
    text = wordsInSetup ? "None chosen. That's fine if you'll use your own pictures." : "Tap pictures to choose them.";
  } else if (ok) {
    const screens = n / PER_PAGE;
    text = `${n} chosen · ${screens} ${screens === 1 ? "screen" : "screens"} ✓`;
  } else {
    const extra = n % PER_PAGE;            // tiles on the unfinished last screen
    const need = PER_PAGE - extra;
    text = `${n} chosen · ${need} more` + (n > PER_PAGE ? ` or ${extra} fewer` : "") + " to fill the screen";
  }
  statusEl.textContent = text;
  statusEl.classList.toggle("ok", ok);
  nextBtn.disabled = wordsInSetup ? n > MAX_TILES : !ok;
}


/* ============================================================
   ADD / CHANGE ONE OF YOUR OWN PICTURES
   A photo, a word, and (optionally) a recording.
   Nothing is saved until "Save", so `draft` holds the changes.
   ============================================================ */
let draft = null;   // { item (null when new), word, imageBlob, previewUrl, audioBlob, audioUrl, audioCleared }

async function showOwnEditor(item = null) {
  draft = { item, word: item ? item.word : "", imageBlob: null, audioBlob: null, audioCleared: false };
  const imgUrl = item ? await mediaUrl(item.imageRef) : null;
  recTarget = draftRecTarget();

  screen({
    title: item ? "Change this picture" : "Add a picture",
    body: `
      <label class="photo-pick" for="photo-input">
        <img id="photo-preview" alt="" ${imgUrl ? `src="${imgUrl}"` : "hidden"}>
        <span id="photo-empty" ${imgUrl ? "hidden" : ""}>
          <span class="choice-pic" aria-hidden="true">📷</span><br>Take or choose a photo
        </span>
      </label>
      <input type="file" accept="image/*" id="photo-input" class="visually-hidden">
      <p class="note center" id="photo-note">${imgUrl ? "Tap the picture to change it." : ""}</p>

      <label class="field-label" for="word-input">Word</label>
      <input id="word-input" class="text-input" maxlength="30" autocomplete="off"
             placeholder="For example: Horse" value="${esc(draft.word)}">

      <h2>Voice <small>(optional)</small></h2>
      ${recorderHtml()}

      <p class="privacy">🔒 Photos and recordings stay on this device.</p>`,
    footer: `
      ${item ? `<button class="btn danger" data-action="delete-own">Delete</button>` : ""}
      <button class="btn primary" data-action="save-own">Save</button>`,
    backAction: "redo-step",
  });
  updateSaveOwn();
  updateRecorderUi();
}

/** Save needs a word and a photo. */
function updateSaveOwn() {
  const btn = el.querySelector('[data-action="save-own"]');
  const hasPhoto = Boolean(draft.imageBlob || (draft.item && draft.item.imageRef));
  btn.disabled = !(draft.word.trim() && hasPhoto);
}

async function handlePhoto(file) {
  const note = document.getElementById("photo-note");
  note.textContent = "Getting the photo…";
  try {
    draft.imageBlob = await resizeImage(file);
  } catch {
    note.textContent = "That file couldn't be used. Please try another photo.";
    return;
  }
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  draft.previewUrl = URL.createObjectURL(draft.imageBlob);
  const img = document.getElementById("photo-preview");
  img.src = draft.previewUrl;
  img.hidden = false;
  document.getElementById("photo-empty").hidden = true;
  note.textContent = "Tap the picture to change it.";
  updateSaveOwn();
}

async function saveOwn() {
  let item = draft.item;
  if (!item) {
    item = { id: "own-" + makeId(), word: "", imageRef: null, audioRef: null,
             showWord: true, speak: true, builtIn: false };
    board.items.push(item);
    if (board.enabled.length < MAX_TILES) board.enabled.push(item.id);   // new pictures start switched on
  }
  item.word = draft.word.trim();

  if (draft.imageBlob) {
    const oldRef = item.imageRef;
    item.imageRef = await storage.saveBlob(draft.imageBlob);
    await deleteMedia(oldRef);
  }
  if (draft.audioBlob) {
    const oldRef = item.audioRef;
    item.audioRef = await storage.saveBlob(draft.audioBlob);
    await deleteMedia(oldRef);
  } else if (draft.audioCleared && item.audioRef) {
    await deleteMedia(item.audioRef);
    item.audioRef = null;
  }

  await storage.saveBoard(board);
  goStep(stepIndex);                 // back to the list of your own pictures
}

async function deleteOwn(btn) {
  if (!confirmTap(btn, "Tap again to delete")) return;
  const item = draft.item;
  board.items = board.items.filter(i => i !== item);
  board.enabled = board.enabled.filter(id => id !== item.id);
  await deleteMedia(item.imageRef);
  await deleteMedia(item.audioRef);
  await storage.saveBoard(board);
  goStep(stepIndex);
}


/* ============================================================
   RECORDER (used on the "Add a picture" screen and the voice walk-through)
   ------------------------------------------------------------
   `recTarget` says where a new recording goes:
   - draftRecTarget(): into the unsaved draft (saved with "Save")
   - itemRecTarget(item): straight onto an existing word, saved at once
   ============================================================ */
let recTarget = null;
let activeRec = null;    // the recording in progress, if any

function recorderHtml() {
  if (!canRecord()) {
    return `<p class="note warn">${esc(micErrorMessage())}</p>
            <button class="btn" data-action="rec-play">▶ Hear it</button>`;
  }
  return `
    <div class="recorder">
      <button class="btn rec" id="rec-btn" data-action="rec-toggle">● Record</button>
      <button class="btn" data-action="rec-play">▶ Hear it</button>
      <button class="btn small" id="rec-clear" data-action="rec-clear" hidden>Remove recording</button>
      <p class="rec-status" id="rec-status"></p>
    </div>`;
}

/** Refresh the recorder's buttons and message. */
function updateRecorderUi(message) {
  const status = document.getElementById("rec-status");
  if (!status) return;
  const has = recTarget.hasAudio();
  document.getElementById("rec-clear").hidden = !has || Boolean(activeRec);
  const btn = document.getElementById("rec-btn");
  btn.textContent = activeRec ? "■ Stop" : has ? "● Record again" : "● Record";
  btn.classList.toggle("recording", Boolean(activeRec));
  status.textContent = message ||
    (activeRec ? "Recording… say the word, then tap Stop."
     : has     ? "✓ Your voice is recorded."
     :           "Not recorded: the built-in voice will say it.");
}

let recStarting = false; // true while the microphone is switching on (can take a moment)

async function toggleRecording() {
  if (activeRec) {                       // second tap: stop
    activeRec.stop();
    return;
  }
  if (recStarting) return;               // already starting: ignore extra taps
  stopSpeaking();
  recStarting = true;
  updateRecorderUi("Starting the microphone…");
  let rec;
  try {
    rec = await startRecording();
  } catch (err) {
    updateRecorderUi(micErrorMessage(err));
    return;
  } finally {
    recStarting = false;
  }
  activeRec = rec;
  const target = recTarget;              // remember it, in case the screen changes
  updateRecorderUi();

  const blob = await rec.done;           // wait until Stop (or 5 seconds)
  if (activeRec !== rec) return;         // the screen changed; throw this recording away
  activeRec = null;
  if (!blob.size) {
    updateRecorderUi("Nothing was recorded. Please try again.");
    return;
  }
  await target.setBlob(blob);
  updateRecorderUi();
  playRecTarget();                       // play it back so you can hear how it sounds
}

function cancelRecording() {
  if (!activeRec) return;
  const rec = activeRec;
  activeRec = null;                      // toggleRecording sees this and ignores the result
  rec.stop();
}

/** "Hear it": the recording if there is one, otherwise the built-in voice. */
async function playRecTarget() {
  stopSpeaking();
  const url = await recTarget.audioUrl();
  if (url) playUrl(url);
  else speakWord(recTarget.word());
}

function draftRecTarget() {
  return {
    word: () => draft.word.trim(),
    hasAudio: () => Boolean(draft.audioBlob) || (!draft.audioCleared && Boolean(draft.item && draft.item.audioRef)),
    setBlob: async blob => { draft.audioBlob = blob; draft.audioCleared = false; },
    clear: async () => { draft.audioBlob = null; draft.audioCleared = true; },
    audioUrl: async () => {
      if (draft.audioBlob) {
        if (draft.audioUrl) URL.revokeObjectURL(draft.audioUrl);
        draft.audioUrl = URL.createObjectURL(draft.audioBlob);
        return draft.audioUrl;
      }
      if (draft.audioCleared || !draft.item) return null;
      return mediaUrl(draft.item.audioRef);
    },
  };
}

function itemRecTarget(item) {
  return {
    word: () => item.word,
    hasAudio: () => Boolean(item.audioRef),
    setBlob: async blob => {
      const oldRef = item.audioRef;
      item.audioRef = await storage.saveBlob(blob);
      await deleteMedia(oldRef);
      await storage.saveBoard(board);
    },
    clear: async () => {
      await deleteMedia(item.audioRef);
      item.audioRef = null;
      await storage.saveBoard(board);
    },
    audioUrl: async () => mediaUrl(item.audioRef),
  };
}


/* ============================================================
   VOICE WALK-THROUGH: record each word, one per screen.
   Used when "My own voice" is chosen, and (in edit mode) when new
   words are added that have no recording yet.
   ============================================================ */
let walk = null;   // { ids, index, onDone, onBack }

function startVoiceWalk(ids, { onDone, onBack }) {
  walk = { ids, index: 0, onDone, onBack };
  showVoiceWalk();
}

async function showVoiceWalk() {
  const item = board.items.find(i => i.id === walk.ids[walk.index]);
  const [shown] = await withMedia([item]);
  recTarget = itemRecTarget(item);
  const last = walk.index === walk.ids.length - 1;
  screen({
    title: `Record “${item.word}”`,
    sub: `Word ${walk.index + 1} of ${walk.ids.length}`,
    body: `
      <div class="walk-tile">${picHtml(shown)}<span class="w">${esc(item.word)}</span></div>
      ${recorderHtml()}`,
    footer: `
      <button class="btn" data-action="walk-later">Finish later</button>
      <button class="btn primary" data-action="walk-next">${last ? "Done" : "Next ›"}</button>`,
    backAction: "walk-back",
  });
  updateRecorderUi();
}


/* ============================================================
   PARENT MENU (behind the ⚙️ gate)
   ============================================================ */
const MENU_ITEMS = [
  // [step key, icon, label]
  ["style",   "🖼️", "Pictures"],
  ["words",   "🔤", "Words"],
  ["own",     "📸", "Your own pictures"],
  ["voice",   "🔊", "Voice"],
  ["arrange", "↔️", "Arrange"],
];

async function showMenu({ renaming = false } = {}) {
  cancelRecording();
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
      ${installHtml()}
      <p class="privacy">🔒 Everything is saved on this device only.</p>
    </main>`;

  if (renaming) {
    const input = document.getElementById("name-input");
    input.focus();
    input.select();
  }
}

/** "Add to home screen": a button where the browser allows one (Android/PC
    Chrome and Edge), instructions on iPhone/iPad, nothing once installed. */
function installHtml() {
  if (isInstalled()) return "";
  const why = "It opens full screen, works offline, and keeps your photos and recordings safe.";
  if (canPromptInstall()) {
    return `<h2>This device</h2>
            <p class="note">${why}</p>
            <button class="btn" data-action="install">📲 Add to home screen</button>`;
  }
  if (isIos()) {
    return `<h2>This device</h2>
            <p class="note">${why} To add it: tap the Share button, then “Add to Home Screen”.</p>`;
  }
  return "";
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

async function deleteCurrentBoard(btn) {
  if (!confirmTap(btn, `Tap again to delete “${board.name}”`)) return;
  await deleteBoardMedia(board);
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
  "redo-step": () => goStep(stepIndex),     // Back from a sub-screen to the step itself
  "next":      finishStep,

  // Pictures and Words
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
  "change-words": () => goStep(STEPS.indexOf("words")),

  // Your own pictures
  "own-no":     finishStep,
  "add-own":    () => showOwnEditor(null),
  "edit-own":   btn => showOwnEditor(board.items.find(i => i.id === btn.dataset.id)),
  "save-own":   saveOwn,
  "delete-own": deleteOwn,

  // Recorder
  "rec-toggle": toggleRecording,
  "rec-play":   playRecTarget,
  "rec-clear":  async () => { await recTarget.clear(); updateRecorderUi(); },

  // Voice
  "pick-voice": btn => {
    board.voice = btn.dataset.value;
    if (board.voice === "own") {
      // Walk through every word on the board.
      return startVoiceWalk(board.enabled.slice(), { onDone: finishStep, onBack: () => goStep(stepIndex) });
    }
    const recorded = board.items.filter(item => item.audioRef).length;
    if (!recorded) return finishStep();
    screen({
      title: "Keep your recordings?",
      sub: `You recorded ${recorded} ${recorded === 1 ? "word" : "words"}.`,
      body: choices([
        { action: "keep-recs",   pic: "🎙️", label: "Keep them",   small: "Those words use your voice." },
        { action: "remove-recs", pic: "🔊", label: "Remove them", small: "Every word uses the built-in voice." },
      ]),
      backAction: "redo-step",
    });
  },
  "keep-recs": finishStep,
  "remove-recs": async () => {
    for (const item of board.items) {
      if (item.audioRef) {
        await deleteMedia(item.audioRef);
        item.audioRef = null;
      }
    }
    finishStep();
  },
  "walk-next": () => {
    if (walk.index < walk.ids.length - 1) { walk.index++; showVoiceWalk(); }
    else walk.onDone();
  },
  "walk-back": () => {
    if (walk.index > 0) { walk.index--; showVoiceWalk(); }
    else walk.onBack();
  },
  "walk-later": () => walk.onDone(),

  // Preview
  "preview-yes": () => showPreview(finishStep),   // after looking, carry on to the next step
  "preview-no":  finishStep,

  // Parent menu
  "to-child":     goChild,
  "edit-step":    btn => editStep(btn.dataset.step),
  "menu-preview": () => showPreview(showMenu),
  "rename":       () => showMenu({ renaming: true }),
  "save-name":    saveName,
  "use-board":    async btn => { await storage.setCurrentBoardId(btn.dataset.id); await showMenu(); },
  "new-board":    startNewBoard,
  "delete-board": deleteCurrentBoard,
  "install":      async () => { await promptInstall(); await showMenu(); },
};

// One listener for every button in parent mode.
el.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn || btn.disabled) return;
  const action = actions[btn.dataset.action];
  if (action) action(btn);
});

// Typing and photo picking on the "Add a picture" screen.
el.addEventListener("input", e => {
  if (e.target.id === "word-input") {
    draft.word = e.target.value;
    updateSaveOwn();
  }
});
el.addEventListener("change", e => {
  if (e.target.id === "photo-input" && e.target.files[0]) handlePhoto(e.target.files[0]);
});

// Enter key saves the board name.
el.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "name-input") saveName();
});
