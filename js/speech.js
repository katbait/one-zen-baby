/* ============================================================
   speech.js - saying a word out loud.
   - If the item has a recording (item.audio), play it.
   - Otherwise use the device's built-in voice (speechSynthesis).
   Two quick taps are both heard, one after the other (not on top of
   each other): the built-in voice queues by itself, and recordings
   wait in our own little queue below.
   ============================================================ */

let queue = Promise.resolve();   // recordings waiting to play, one after another
let generation = 0;              // goes up on stopSpeaking(), so queued sounds know to skip
let currentAudio = null;

export function sayItem(item) {
  if (!item || !item.speak) return;
  if (item.audio) playUrl(item.audio, item.word);
  else speakWord(item.word);
}

/** Play a recording (queued). If it can't play, say fallbackWord instead. */
export function playUrl(url, fallbackWord = "") {
  const myGeneration = generation;
  queue = queue.then(() => new Promise(resolve => {
    if (myGeneration !== generation) return resolve();   // stopped while waiting
    const audio = new Audio(url);
    currentAudio = audio;
    const finish = () => { clearTimeout(safety); resolve(); };
    const safety = setTimeout(finish, 10000);            // never let one stuck sound block the rest
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(() => {
      if (fallbackWord) speakWord(fallbackWord);
      finish();
    });
  }));
}

export function speakWord(word) {
  if (!word || !("speechSynthesis" in window)) return;   // nothing to say, or very old browser
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = document.documentElement.lang || "en";
  utterance.rate = 0.85;                                 // a little slower than normal, for small children
  speechSynthesis.speak(utterance);
}

/** Stop everything that is playing or waiting to play. */
export function stopSpeaking() {
  generation++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
