/* ============================================================
   media.js - turning stored photos/recordings into things the page
   can show or play, plus shrinking photos before they are saved.
   ------------------------------------------------------------
   A stored file is a Blob. To show it in an <img> or play it with
   Audio, the browser needs a URL, so URL.createObjectURL(blob) makes a
   temporary "blob:..." address for it. We remember those addresses so
   each file is only loaded once.
   ============================================================ */
import * as storage from "./storage.js";
import { enabledItems } from "./model.js";

const urlCache = new Map();   // file ref -> blob: URL

/** A URL for a stored file (or null if there's no ref / file). */
export async function mediaUrl(ref) {
  if (!ref) return null;
  if (!urlCache.has(ref)) {
    const blob = await storage.getBlob(ref);
    urlCache.set(ref, blob ? URL.createObjectURL(blob) : null);
  }
  return urlCache.get(ref);
}

/** Copies of the items with `image` and `audio` URLs filled in, ready to show. */
export async function withMedia(items) {
  return Promise.all(items.map(async item => ({
    ...item,
    image: await mediaUrl(item.imageRef),
    audio: await mediaUrl(item.audioRef),
  })));
}

/** The board's tiles, in order, ready to show. */
export function boardTiles(board) {
  return withMedia(enabledItems(board));
}

/** Delete a stored file and forget its URL. Safe to call with null. */
export async function deleteMedia(ref) {
  if (!ref) return;
  const url = urlCache.get(ref);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(ref);
  await storage.deleteBlob(ref);
}

/** Delete every photo and recording belonging to a board. */
export async function deleteBoardMedia(board) {
  for (const item of board.items) {
    await deleteMedia(item.imageRef);
    await deleteMedia(item.audioRef);
  }
}

/** Shrink a photo so its longest side is at most maxSide pixels, as a JPEG.
    Phone photos are often 4000+ pixels wide; tiles never need that much. */
export function resizeImage(file, maxSide = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";                       // see-through drawings get a white background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not shrink photo")),
                    "image/jpeg", 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Not a picture the browser can read"));
    };
    img.src = url;
  });
}
