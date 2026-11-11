/* ============================================================
   views.js - shows one full-screen "view" at a time.
   The app has three views (see index.html):
     child-view   - the board the child uses (also used for Preview)
     parent-view  - the setup wizard and parent menu
     arrange-view - drag tiles to swap them
   ============================================================ */
const VIEW_IDS = ["child-view", "parent-view", "arrange-view"];

export function showView(id) {
  for (const viewId of VIEW_IDS) {
    document.getElementById(viewId).hidden = (viewId !== id);
  }
}
