# st-card-creator · Duet Stage panels for SillyTavern (0.3.2)

Install in SillyTavern: Extensions (the blocks icon) → **Install extension** → paste `https://github.com/Daleah666/SillyTavern-Card-Creator`. This repo holds the extension at its root.

What you get: two top-bar buttons. **Duet** (left dock): the Duet rail with coloured collapsible sections for Characters, Chats (open a chat, fork, summarize), Latest pictures and a Library tab (avatar, sprite pack, chat images; hover to enlarge, right-click to emote/send/open/copy, drop a picture to add a sprite). **About** (right dock): live ticker, hero portrait, talks meter and tabs for Overview, Sheet (flat vitals and quirks), Reel + idle playlist, Story and memories, Inner voice, Subliminals, Connection and Settings. Drag the dock edge to resize; Ctrl+wheel scales only the dock's text. The Card creator itself (the Duet Stage tab, or a standalone drawer when st-duet-stage is not installed) is unchanged.

Manual install: copy this folder into `data/default-user/extensions/third-party/st-card-creator/` and reload.

**💗 Right now** (About dock, 0.3.2, from 0.1.5): her mood, a thought, her outfit and six relationship bars (Affection, Trust, Spark, Comfort, Jealousy, Energy) with a stage name. 💞 *Score every reply* (off until you turn it on) judges each of her messages with one quiet call on your connection and moves the bars, with a little pill under her message. 🗣 *She knows where you two stand* adds a short note to her prompt. Saved per character in `extensionSettings['st-card-creator'].hearts`, the same place 0.1.5 kept them.

## Auto-update and the 📣 board

- **It updates itself.** On every refresh, `autoupdate.js` asks SillyTavern whether this folder is behind GitHub (`/api/extensions/version`). If it is, it runs the same update as Manage extensions → Update (`/api/extensions/update`) and reloads once. `"auto_update": true` in `manifest.json` also lets SillyTavern update it when SillyTavern itself updates.
- **The board.** `board.jsonl` is this repo's message board, in the house format (`{"t","who","to","kind","text"}`, one line each, 200 characters, no keys or private data). New lines addressed to `red`, `all` or nobody show as toasts in SillyTavern after a refresh. Bots: append a line and push to talk to Red here.
- **Mirroring.** Keep `autoupdate.js`, its import at the top of `index.js`, `board.jsonl` and `"auto_update": true` when you mirror this extension from its source branch.

## How changes land here

One door. Anyone building on this extension (Cursor, another Claude session, a person) opens a pull request against `main` and leaves it unmerged. The Claude session named **SillyTavern merge door** checks it against the current `main`, merges both sides if `main` has moved, runs the checks, and merges it. Red can still merge a pull request herself.

Do not upload or paste files over `main`. This extension updates itself in SillyTavern on every refresh, so a copy built on an older version silently undoes whatever landed since. Keep `autoupdate.js` and `"auto_update": true`, and add a line to `board.jsonl` for anything Red will notice.
