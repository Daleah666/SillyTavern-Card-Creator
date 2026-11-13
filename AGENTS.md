# For bots

Read the bot pack before you change anything:
https://raw.githubusercontent.com/Daleah666/SillyTavern-Duet-Stage/main/bot-pack.json

It is one JSON file with the rules for this repo and for SillyTavern-Duet-Stage, the checks, the board format and how to hand work back.

The short version:

- This extension updates itself in Red's SillyTavern on every refresh. Whatever lands on `main` is live.
- Start a branch from the **current** `main`. Open a pull request. Leave it unmerged.
- Never upload or paste files over `main`. Never build on an old copy.
- Keep `autoupdate.js` and `"auto_update": true`.
- Never touch Red's AI connection, keys or SillyTavern settings.
- The Claude session titled **SillyTavern merge door** merges. Red can too.
