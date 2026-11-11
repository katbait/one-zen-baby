/* ============================================================
   pages.js - builds swipeable screens of 4 tiles.
   Used by both the child board and the Arrange view, so they look
   exactly alike.
   ============================================================ */
import { PER_PAGE } from "./model.js";

/** Build one tile element for an item. */
export function makeTile(item) {
  const tile = document.createElement("div");
  tile.className = "tile";
  if (!item.showWord) tile.classList.add("no-word");
  tile.dataset.id = item.id;                  // becomes the HTML attribute data-id="milk"
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

/* ------------------------------------------------------------
   createPager(strip, dots) sets up one swipe strip and its dots.
   It returns a small object:
     pager.render(items)    - (re)build the screens, staying on the same screen
     pager.goTo(n, smooth)  - jump (or glide) to screen n (0 = first)
     pager.page             - which screen is showing now
   ------------------------------------------------------------ */
export function createPager(strip, dots) {
  let page = 0;

  function pageCount() {
    return strip.children.length;
  }

  function updateDots() {
    [...dots.children].forEach((dot, i) => dot.classList.toggle("cur", i === page));
  }

  function goTo(n, smooth = false) {
    page = Math.max(0, Math.min(pageCount() - 1, n));   // keep n inside 0..last
    strip.scrollTo({ left: page * strip.clientWidth, behavior: smooth ? "smooth" : "auto" });
    updateDots();
  }

  function render(items) {
    const keepPage = page;
    strip.innerHTML = "";
    dots.innerHTML = "";
    for (let start = 0; start < items.length; start += PER_PAGE) {
      const pageEl = document.createElement("div");
      pageEl.className = "page";
      items.slice(start, start + PER_PAGE).forEach(item => pageEl.appendChild(makeTile(item)));
      strip.appendChild(pageEl);
      dots.appendChild(document.createElement("span"));
    }
    dots.classList.toggle("single", pageCount() <= 1);   // no dots for a single screen
    goTo(keepPage);
  }

  // While swiping, work out which screen is showing.
  strip.addEventListener("scroll", () => {
    const width = strip.clientWidth;
    if (width === 0) return;             // strip is hidden
    const n = Math.round(strip.scrollLeft / width);
    if (n !== page) {
      page = n;
      updateDots();
    }
  });

  // When the phone rotates, the width changes and the old scroll position
  // could land between two screens. Jump back to the same screen.
  // (Browsers run "resize" before "scroll" in the same frame, so `page`
  // still holds the screen we were on.)
  window.addEventListener("resize", () => {
    if (strip.clientWidth) strip.scrollLeft = page * strip.clientWidth;
  });

  return {
    render,
    goTo,
    get page() { return page; },
  };
}
