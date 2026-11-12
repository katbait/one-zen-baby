/* ============================================================
   install.js - offline support and "Add to home screen".
   ------------------------------------------------------------
   - registerServiceWorker(): turns on sw.js (offline support).
   - Chrome/Edge (Android, PC) offer to install the app by sending a
     "beforeinstallprompt" event. We catch it and keep it, which also
     stops Chrome's own install pop-up from appearing over the child's
     board. The parent menu then shows an "Add to home screen" button.
   - iPhone/iPad Safari never sends that event: people must use
     Share -> Add to Home Screen, so the menu shows that instruction.
   ============================================================ */

let installPrompt = null;   // the saved "beforeinstallprompt" event, if any

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();   // no automatic pop-up
  installPrompt = event;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
});

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;   // very old browser: no offline mode, everything else works
  navigator.serviceWorker.register("./sw.js")
    .catch(err => console.warn("Offline support could not start:", err));
}

/** Already running as an installed home-screen app? */
export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
         navigator.standalone === true;          // older iPhones
}

/** Can we show our own "Add to home screen" button? */
export function canPromptInstall() {
  return installPrompt !== null;
}

/** iPhone or iPad? (Newer iPads report themselves as a Mac with a touch screen.) */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Show the browser's install dialog. Returns true if the parent accepted. */
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;            // each saved prompt can only be used once
  prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === "accepted";
}
