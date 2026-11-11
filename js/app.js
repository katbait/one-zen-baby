/* ============================================================
   app.js - starts the app (this is the file index.html loads).
   - No board yet (first visit): make one and start the setup wizard.
   - A board whose setup wasn't finished: carry on with setup.
   - Otherwise: show the child board.
   ============================================================ */
import { loadCurrentBoard, newBoard } from "./model.js";
import { boardTiles } from "./media.js";
import * as storage from "./storage.js";
import { showChildBoard, setParentOpener } from "./child.js";
import { startSetup, openParentMenu } from "./parent.js";

// Block the long-press menu everywhere except text boxes (where it's needed for paste).
document.addEventListener("contextmenu", e => {
  if (!e.target.closest("input, textarea")) e.preventDefault();
});

// When the ⚙️ is held on the child board, open the parent menu.
setParentOpener(openParentMenu);

start();

async function start() {
  const board = await loadCurrentBoard();

  if (!board) {
    const fresh = newBoard("My board");
    await storage.saveBoard(fresh);
    await storage.setCurrentBoardId(fresh.id);
    startSetup(fresh);
    return;
  }

  if (!board.setupDone) {
    // If there's a finished board too, Back on step 1 can cancel and return to it.
    const finished = (await storage.listBoards()).filter(b => b.setupDone && b.id !== board.id);
    startSetup(board, finished.length ? finished[0].id : null);
    return;
  }

  showChildBoard(await boardTiles(board));
}
