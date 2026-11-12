# Choice Board App

A simple choice-board app for young children with speech delay, set up by parents and therapists. Delivered as a hosted website / Progressive Web App (PWA) that installs to the home screen and works on any phone or tablet. Primary target is Android (Chrome); iPhone/iPad (Safari) should work too as long as that doesn't add much complexity.

## Who this is for
- **First client:** one family. The developer is also a parent who has been through this, so product decisions come from lived experience.
- **Possible later audience:** other parents of very young children with a specific kind of speech delay and communication need, plus therapists in that field who could test it. This is a small, specific audience, not a mass-market product. The goal is to do this one client well and be able to share it, not to compete with big AAC apps.
- Design for **simple and focused**. Do not add general-purpose AAC features (sentence building, huge vocabularies, keyboards) unless asked.

## About the developer
Backend-focused (Python), completed a bootcamp in 2020, and has not used JavaScript much recently. Explain non-obvious choices briefly, comment the code clearly, and prefer simple, readable solutions over clever ones. Develops on an older Windows 10 PC, mostly in Chrome/Edge with device emulation (F12, phone icon), then tests on a real Android phone. Ask before adding dependencies or frameworks.

## Tech decisions (already made)
- Plain HTML, CSS and JavaScript. No framework and no build step unless there is a strong reason.
- Local test server: `python -m http.server`.
- No native app frameworks (the developer has no Mac, and a PWA covers both platforms).
- Hosting: free static hosting (GitHub Pages, Netlify or Cloudflare Pages), which provides HTTPS. Phone testing of the microphone and service worker needs HTTPS (localhost is exempt on desktop only). A custom domain is optional (about $10-15/year).
- `index.html` in this folder is a working prototype of the board. Build on it.

## Core behavior
- **4 tiles per screen is fixed. It is not a setting and parents cannot change it.** Do not build grid-size options.
- The app ships with 12 to 24 pre-made items. The board shows **4 tiles per screen** and the child **swipes between screens** (CSS scroll-snap; 16 enabled items = 4 screens). Page dots show position.
- Each item has: image (or emoji placeholder), word, `showWord` (display the word), `speak` (say it aloud), and an optional recorded or uploaded `audio` file.
- A parent chooses which items appear, in what order, and which of image, word and sound each one uses.
- A parent can upload their own photo and add a word. These behave like built-in items and can be mixed in with them.
- Speech uses `speechSynthesis`. Recorded audio (MediaRecorder or file upload) is optional and more reliable than synthesized voices on iOS.

## Tile touch rules (confirmed by the client)
- Tap 1: tile highlights and speaks and/or plays its sound.
- Tap 2 on a lit tile: unhighlights, **silently**.
- Tap 3: highlights and speaks again.
- **At most 2 tiles lit per screen.** Each 4-tile screen is independent: a child can pick 2 on one screen, swipe, and pick 2 on another, and the earlier screens stay lit. If 2 are lit on a screen and the child taps a third on that same screen, the tap is **ignored** (a small shake shows it was noticed). The third tile only works after a lit tile on that screen is tapped off. This may need a parent's help, which is intended.
- Two fingers can tap two tiles at the same time. Use pointer events and track each pointer separately.
- A touch that moves more than about 10px is a swipe, not a tap.

## Market research (done Nov 2026)
Sources were mostly app-store pages and third-party listings, so treat prices and features as approximate. **In what was found, no existing app combines swipeable pages of exactly 4 tiles, a limit of 2 lit tiles, and tap-again-to-unhighlight with free shared parent and therapist accounts.** Apps found:
- **Free / low cost:** Cboard (free, open source, web-based, board sharing and backup), CommBoards (free download, iOS and Android, $99.99 lifetime), Visual Choices AAC (free with in-app purchases; photo-based choice boards), KC TalkBoard (iOS and Android), MyVisualRoutine (freemium, about $9.99/month for custom photos and voice), LibreAAC (free, Android tablets, no accounts or sync), Leeloo AAC (free with premium tiers), Choice Boards (iOS, simple), Sky Simple AAC (free with subscription, iPad).
- **Therapist-oriented / paid:** CoughDrop (cloud-based, shared parent and therapist access, about $9/month or $295 lifetime; the closest to the sharing model wanted here), TD Snap (cloud sync, free professional accounts for therapists), Proloquo2Go (around $250, iOS only), TouchChat (iOS).
- Many popular AAC apps are iOS-only, which is a gap for Android families.
- The developer tried several of these on a real phone and found shortcomings (see next section).

## Lessons from hands-on testing (parent's perspective)
The developer, a parent who has been through this, tried several existing apps on a real phone. What went wrong:
- **Too many choices up front.** Even the simplest-looking apps began by making the parent pick from a large set of options.
- **Tutorials and pop-up text boxes did not help.** Even for someone with strong tech skills it was not self-explanatory. If another person would have to demonstrate it, it is too complicated.
- Most apps let you add your own photos and voice, but those steps were buried among many other steps.
- The apps try to serve the largest possible audience, which creates the clutter.

**Design principle:** this app deliberately offers very few choices: a small starter set, one decision per screen, clear defaults, minimal text, a visible Back button, no tutorials. **Acceptance test:** a non-technical parent can finish setup without any tutorial or help from another person.

## Parent setup wizard (first run, after sign-in)
One decision per screen. Parents can return to any step later and change it.
1. **Picture style:** drawn illustrations or real photos (e.g. a photo of a plate of food). One tap.
2. **Pick from the starter set:** show all 16 to 24 starter items in a grid, each with its word underneath. The parent selects how many and which. Counts should fill whole screens (4, 8, 12, ...).
3. **"Add your own?"** Yes/No. If yes, a very simple screen: choose or take a photo, type the word, and the voice defaults to the device's text-to-speech with an optional "record my own voice" button. Repeat as many times as wanted.
4. **"Preview?"** Yes (default) or No. Preview shows exactly what the child will see.
5. **Arrange:** drag and drop to reorder tiles within and across screens, like reordering a video queue.
6. **Done**, then child mode.

Limits: at most **40 tiles total per board (10 screens of 4)**, counting starter and own tiles together.

## Multiple boards
A parent can keep several named boards and switch between them in parent mode. Example: a family without a beach normally hides the beach tile, but makes a "Vacation" board that includes it plus their own beach photos. Each board mixes starter and own tiles up to the 40-tile limit. Boards are saved per account and sync across devices.

## Layout and screens
- **Landscape is the primary orientation** (wider than tall); portrait must work too. Each screen shows 4 tiles either way. Try both 2x2 and 4-across on real devices and keep whichever feels better.
- Child mode: big tiles, no menus, nothing that can be changed by accident. Parent mode sits behind a deliberate gate (a PIN or press-and-hold).
- Sign-in comes first: **Sign in with Google** or **create an account with email and password** (email, not a username, so forgotten passwords can be reset). An email account works on any device the person signs in on.
- Children's photos and voices are the most sensitive part. Make privacy visible and simple.

## Drag-and-drop (arrange step and parent edit area)
**Requirement from the developer:** works like rearranging apps on a phone home screen. In parent mode, press and hold a tile to pick it up, drag it (dragging to the right or left edge flips to the next or previous screen), and drop it on any tile on any screen. **The two tiles swap places** (e.g. tile 1 on screen 1 dropped on tile 1 of screen 3: they trade spots). This lets a parent or therapist customize every screen.
Implementation note: dragging across swipeable pages on a touch screen can fight with swipe scrolling, so in parent mode turn off normal swiping while a tile is held, and flip pages when the dragged tile is held near an edge. Ask before adding a library (e.g. SortableJS); plain pointer events should be enough.

## Voice choice (in setup and in settings)
- One simple choice for the whole board: **device voice for all words** (the default; tell the parent it is the easiest and can be changed any time in settings) or **my own voice for all words**.
- If "my own voice" is chosen during setup, prompt the parent to record each word on the board, one at a time.
- If they switch to "my own voice" later in settings, prompt them then to record every word that has no recording yet (including words added later).
- Details still to discuss with the developer (e.g. mixing per tile, re-recording one word).

## Own tiles
A parent picks which starter items to use (e.g. 16 of 24) and can add their own tiles: a picture (photo or drawn/cartoon image) plus a typed word, with the device voice or their own recording.

## Starter art assets
Two matching sets are needed for every starter item: **drawn illustrations** and **real photos** (16 to 24 items each, so roughly 32 to 48 images). Choose things very young children recognize (food, drinks, toys, animals, daily routines). Licensing matters if the app is shared beyond the first client: use images with clear permission for this use, or original or commissioned art. Emoji are placeholders until real art is chosen.

## Voice
The default voice is the device's built-in text-to-speech (not AI; free, but quality varies by device and is usually better on newer phones). Parents can record their own voice per tile, which is more reliable and more familiar to the child. Better cloud voices cost money, so revisit later.

## Data model (keep it storage-agnostic)
A board is one JSON object plus image/audio blobs:
- `items`: array of `{ id, word, emoji | imageRef, showWord, speak, audioRef, builtIn }`
- `enabled`: ordered array of item ids shown on the board
- Resize uploaded images on a canvas before storing.

Put all reads and writes behind **one small storage module** (for example `storage.js` with `loadBoard()`, `saveBoard()`, `saveBlob()`, `getBlob()`), so the local storage layer can be swapped for Firebase later without touching the UI. Use IndexedDB for images and audio (localStorage is too small).

## Build order
1. Polish the child board from the prototype (4 tiles per screen, swipe, tap rules, landscape and portrait).
2. Parent setup wizard (steps 1 to 6) and multiple boards, stored locally.
3. Own-tile upload (photo, word) and optional voice recording, saved in IndexedDB.
4. Web app manifest and service worker so it installs and works offline.
5. Login, sync and sharing with Firebase (below).
6. Test on a real Android phone, then iPhone/iPad via Safari, Add to Home Screen.
7. Small private beta with a few parents and therapists (below).

## Login, sharing and sync (step 5)
Parents and therapists share a board across devices.
- Plan: **Firebase**: Authentication (Google and email/password), Firestore with offline persistence, Storage for photos and audio.
- Each child has a board with a member list and roles: owner (parent), editor (therapist), optionally view-only. The owner invites others by email or short code. One therapist can belong to several boards.
- Conflicts: last write wins.
- **Security rules are critical**: only a board's members can read or write it, and only the owner manages members. Review these carefully.
- Known risk: Google sign-in inside an installed iOS PWA can be unreliable, so test early. Android is smoother.
- Cost: Firestore at this scale is likely free, but Storage may need a pay-as-you-go plan. Check current Firebase pricing before promising "free".

## Sharing with other families (later)
- Start with a small invite-only beta (a few therapists and parents) rather than a public launch.
- Before anyone outside the client family uses it: a plain-language privacy policy, a simple terms page, and parent-controlled sharing. Look into child-privacy rules (COPPA in the US, GDPR elsewhere).
- Say clearly that the app is a communication aid and not a substitute for therapy or medical advice. Avoid medical claims.
- Free symbol libraries such as ARASAAC are non-commercial. Fine for a free app, but not if the app is ever sold. OpenMoji or original or commissioned art are safer. Emoji are placeholders for now.
- iOS can clear a website's stored data after about 7 days of non-use; installed home-screen apps are exempt.
- Keep the browser updated on the developer's Windows 10 machine, since the OS is end-of-support.

## Decisions (answered by the developer, Nov 2026)
- **Partial last screen:** require full screens. Tile counts must be multiples of 4 (4, 8, 12 ... 40).
- **Landscape layout:** 2x2 (same as portrait).
- **Sign-in:** try first, sign in later. A parent can set up a board on the device without an account; sign-in is offered later for backup and sharing.
- **Roles:** owner (parent), editor (therapist) and view-only (e.g. grandparents) are all needed.

- **App name:** One Zen Baby (current working name).
- **Starter list (24 items, in this order, revised Nov 2026):** I want to, Take a Bath, Eat, Drink, Drink Milk, Drink Water, We are going to, The Grocery Store, Play, Go Outside, Go Play, Go to Park, Take Nap, Ride in the Car, Animals, Puppy, Get dressed, See Grandma, See Grandpa, Tablet, Music, Watch TV, Store, Go to Bed. Two phrase starters ("I want to", "We are going to") pair with the 2-lit-tile limit to make short sentences (e.g. "I want to" + "Eat", "We are going to" + "The Grocery Store"); wording was chosen so these pairs read naturally.
- **Changing the starter list:** edit `js/starter.js` and push. Same `id` = rename (updates boards already using it); new `id` = a different word. Removed words vanish from the Words step, but stay on boards that are still using them until the parent switches them off (`syncStarters` in `model.js`). A parent's recording of a renamed word still says the old word.

- **Parent gate:** press and hold the small ⚙️ button (bottom right of the child board) for 2 seconds; a quick tap shows "Hold to open". Chosen over a PIN (nothing to forget). Easy to change.
- **Wizard order as built:** Pictures, Words, Your own pictures, Voice, Preview?, Arrange, then the child board. Words start unselected.
- **Full-screens check:** during setup the Words step allows any number (even 0, since a parent may use all their own pictures); the check happens at the Your own pictures step. In edit mode, Save always needs full screens.
- **Starter set vs own pictures:** the starter set is a basis that the owner (developer) can change in `js/starter.js` at any time. A parent can mix any starter words with their own pictures (photo or uploaded image + typed word), or use only their own (e.g. 24 of their own).
- **Voice rule:** a word with a recording always plays the recording; otherwise the built-in voice says it. Choosing "My own voice" walks through every word on the board, one per screen (with "Finish later"). In edit mode with own voice, newly added words without a recording trigger the walk-through for just those. Switching back to the built-in voice asks "Keep your recordings?" (keep / remove). Recordings stop after 5 seconds.
- **Own picture limits:** a photo and a word are required; the recording is optional. Photos are shrunk to 800px JPEG before saving.

## Code layout
- `index.html` (three views: child, parent, arrange), `style.css`.
- `js/app.js` startup; `js/starter.js` starter words; `js/model.js` board rules; `js/storage.js` the only file that saves/loads (localStorage for board JSON now; IndexedDB blobs in step 3; Firebase in step 5); `js/pages.js` builds 4-tile screens; `js/child.js` child board, tap rules, gate; `js/parent.js` wizard, parent menu, boards; `js/arrange.js` hold-drag-swap; `js/views.js` switches views; `js/media.js` photo/recording URLs and photo shrinking; `js/speech.js` plays recordings or the built-in voice; `js/recorder.js` microphone recording.
- Photos and recordings are stored in IndexedDB (via `storage.js` `saveBlob`/`getBlob`/`deleteBlob`); boards keep only `imageRef`/`audioRef`.
- Recording on a phone needs HTTPS (works on desktop at http://localhost).
- **Installable / offline (step 4):** `manifest.json` (name, icons, colors, standalone), `sw.js` service worker, `js/install.js` (registers the service worker; "Add to home screen" button in the parent menu on Chrome/Edge, Share-menu instructions on iPhone/iPad; Chrome's automatic install pop-up is suppressed so it never appears over the child board).
- `sw.js` is **network first**: always fetches fresh files when online (so code changes show immediately), falls back to saved copies offline or after 3 seconds. **When adding a new file to the app, add it to `APP_FILES` in `sw.js`** (a missing listed file breaks offline install). Bump `CACHE_NAME` to clear old copies.
- Icons in `icons/` are original artwork (2x2 board, two lit tiles); `icon.svg` / `icon-maskable.svg` are the sources for the PNGs.
- The first saved photo/recording asks the browser for persistent storage (`navigator.storage.persist()`), so it isn't cleared when space runs low.
- JS files are ES modules, so the app must be opened through `python -m http.server`, not by double-clicking.

## Hosting (set up Nov 2026)
- Public GitHub repo **katbait/one-zen-baby**, served by **GitHub Pages** from the `main` branch root: https://katbait.github.io/one-zen-baby/
- **Publishing = pushing to `main`.** Every `git push` updates the live site within a minute or two. Commit and push only when the developer asks.
- The repo is public (required for free GitHub Pages). Commits use the GitHub noreply address `78621138+katbait@users.noreply.github.com` (set in this repo's git config) so the developer's personal email is never published. Never put personal details in committed files.
- GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` (may not be on PATH in older shells). The `!` prompt in Claude Code runs bash, so use bash syntax there.
- Children's photos and recordings never leave the device yet (no server until step 5), so the public site holds only code.

## Open questions (ask the developer before building these parts)
- Where the drawn and photo artwork for the starter items comes from.
- Domain (optional).
