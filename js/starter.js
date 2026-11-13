/* ============================================================
   The built-in starter words (the developer's list, in order).
   34 items for now. A board holds at most 36 tiles (9 screens of 4),
   counting starter words and the parent's own pictures together.
   `emoji` is a placeholder picture until real drawings and photos are
   chosen. Later each item will also get drawn/photo image files, and
   the board's "picture style" setting will pick between them.

   HOW TO CHANGE THIS LIST (it changes for everyone with the link):
   - Rename a word but keep its meaning ("Cars" -> "Ride in the Car"):
     change `word`, keep `id`. Boards already using it update.
   - Replace a word with a different meaning ("Juice" -> "We are going to"):
     give it a NEW `id`. Boards that used the old word keep it until the
     parent switches it off; everyone else no longer sees the old word.
   - The order here is the order parents see in the Words step.
   ============================================================ */
export const STARTER_ITEMS = [
  { id: "i-want",            word: "I want to",         emoji: "🙋" },
  { id: "bath",              word: "Take a Bath",       emoji: "🛁" },
  { id: "eat",               word: "Eat",               emoji: "🍽️" },
  { id: "drink",             word: "Drink",             emoji: "🥤" },
  { id: "milk",              word: "Drink Milk",        emoji: "🥛" },
  { id: "water",             word: "Drink Water",       emoji: "💧" },
  { id: "we-are-going-to",   word: "We are going to",   emoji: "👩‍👧" },  // mom and child (real art later: walking together)
  { id: "the-grocery-store", word: "The Grocery Store", emoji: "🛒" },
  { id: "play",              word: "Play",              emoji: "🧸" },
  { id: "go-outside",        word: "Go Outside",        emoji: "🌳" },
  { id: "go-play",           word: "Go Play",           emoji: "⚽" },
  { id: "go-to-park",        word: "Go to Playground",  emoji: "🛝" },  // slide; newer emoji, may not show on Windows 10
  { id: "take-nap",          word: "Go to Sleep",       emoji: "😴" },
  { id: "cars",              word: "Ride in the Car",   emoji: "🚗" },
  { id: "animals",           word: "Animals",           emoji: "🦁" },
  { id: "more",              word: "More",              emoji: "➕" },
  { id: "get-dressed",       word: "Get dressed",       emoji: "👕" },
  { id: "clean-up",          word: "Clean up",          emoji: "🧹" },
  { id: "i-am",              word: "I am",              emoji: "🧒" },
  { id: "tablet",            word: "Tablet",            emoji: "💻" },  // no tablet emoji exists; placeholder
  { id: "music",             word: "Music",             emoji: "🎵" },
  { id: "tv",                word: "Watch TV",          emoji: "📺" },
  { id: "store",             word: "Store",             emoji: "🛍️" },
  { id: "all-done",          word: "All done",          emoji: "🙌" },
  // Feelings and short words (pair with "I am": "I am" + "Hungry")
  { id: "ready",             word: "Ready",             emoji: "👍" },
  { id: "cold",              word: "Cold",              emoji: "🥶" },
  { id: "hot",               word: "Hot",               emoji: "🥵" },
  { id: "hungry",            word: "Hungry",            emoji: "😋" },
  { id: "tired",             word: "Tired",             emoji: "🥱" },
  { id: "sad",               word: "Sad",               emoji: "😢" },
  { id: "frustrated",        word: "Frustrated",        emoji: "😤" },
  { id: "happy",             word: "Happy",             emoji: "😊" },
  { id: "mad",               word: "Mad",               emoji: "😠" },
  { id: "stop",              word: "Stop",              emoji: "✋" },
];
