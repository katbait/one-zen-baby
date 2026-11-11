/* ============================================================
   recorder.js - record a short clip from the microphone.
   Uses the browser's MediaRecorder. The browser asks permission the
   first time. On a phone the microphone only works on an https://
   site (on the PC, http://localhost is allowed too).
   ============================================================ */

const MAX_RECORDING_MS = 5000;   // stop by itself after 5 seconds

/** Can this browser record here at all? */
export function canRecord() {
  return Boolean(window.isSecureContext && navigator.mediaDevices &&
                 navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

/** A plain-language message for why recording didn't work. */
export function micErrorMessage(err) {
  if (!window.isSecureContext) {
    return "Recording only works on the secure (https://) version of the site.";
  }
  if (!window.MediaRecorder || !navigator.mediaDevices) {
    return "This browser can't record sound.";
  }
  if (err && err.name === "NotAllowedError") {
    return "The microphone is blocked. Allow it in the browser's settings for this site, then try again.";
  }
  if (err && err.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  return "The microphone couldn't start. Please try again.";
}

/** Start recording. Returns { stop(), done }:
    call stop() to finish early; `done` is a Promise that gives the
    recorded Blob when recording ends (by stop() or after 5 seconds). */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise(resolve => {
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());   // turn the microphone off
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
  });

  recorder.start();
  const timer = setTimeout(stop, MAX_RECORDING_MS);

  function stop() {
    clearTimeout(timer);
    if (recorder.state !== "inactive") recorder.stop();
  }

  return { stop, done };
}
