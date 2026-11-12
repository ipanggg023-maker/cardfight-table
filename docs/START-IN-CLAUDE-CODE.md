# Starting in Claude Code

1. Install Claude Code and open a terminal in **D:\Vanguard**, then run `claude`.
2. (Optional) Make it a git repo so every change can be undone:
   ```
   git init
   git add .
   git commit -m "Vanguard Table: starting point"
   ```
   `.gitignore` already keeps official card art and playmats out of the repo.
3. Paste this as your first message:

```
Read CLAUDE.md, docs/ARCHITECTURE.md and docs/ROADMAP.md.
Then open login.html → lobby → play one full hot-seat game in a browser (or with Playwright) to see how it works.
Tell me anything broken. After that, start roadmap task 1 (online play).
Rules: no build step, keep files plain HTML/CSS/JS, keep engine.js free of DOM code,
reply to me in English, commit after each working step.
```

## Testing tips for Claude Code
- Engine actions are async and may wait on `S.pending`; in Playwright call them with `void Game.x(...)` then answer pending choices in a loop.
- `Game` is a top-level `const`, so check `typeof Game !== "undefined"` instead of `window.Game`.
- Card art is not in the repo and there are no sample decks: make test cards/decks in the editor (or import a backup .json).
