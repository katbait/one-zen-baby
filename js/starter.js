/* ============================================================
   The built-in starter words (the developer's list, in order).
   24 items = 6 full screens of 4.
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
  { id: "go-to-park",        word: "Go to Park",        emoji: "🏞️" },
  { id: "take-nap",          word: "Take Nap",          emoji: "😴" },
  { id: "cars",              word: "Ride in the Car",   emoji: "🚗" },
  { id: "animals",           word: "Animals",           emoji: "🦁" },
  { id: "puppies",           word: "Puppy",             emoji: "🐶" },
  { id: "get-dressed",       word: "Get dressed",       emoji: "👕" },
  { id: "grandma",           word: "See Grandma",       emoji: "👵" },
  { id: "grandpa",           word: "See Grandpa",       emoji: "👴" },
  { id: "tablet",            word: "Tablet",            emoji: "💻" },  // no tablet emoji exists; placeholder
  { id: "music",             word: "Music",             emoji: "🎵" },
  { id: "tv",                word: "Watch TV",          emoji: "📺" },
  { id: "store",             word: "Store",             emoji: "🛍️" },
  { id: "go-to-bed",         word: "Go to Bed",         emoji: "🛏️" },
];
