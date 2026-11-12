# Vanguard Table – Roadmap

Status as of 2026-11-12. Each task is written so it can be pasted into Claude Code.

## Done
- Guest login, lobby, sign-out
- Hot-seat game: mulligan, ride (ride deck / hand), call, move, orders (normal 1/turn, blitz), battle, boost, drive check, triggers (crit/front/draw/heal/over), guard, intercept, sentinel, damage check, counter-blast, energy, win/lose
- Ability engine (AUTO/ACT/CONT/ORDER/BLITZ) built from editor blocks
- Card editor, deck builder with rule checker, export/import, CSV import, text → ability parser
- Card library import (CGS GitHub data, 21k cards), tcgapi.dev import (needs key + relay)
- Local pictures: `vanguard_images` (Edit.py) + "Link pictures" folder matcher
- Playmats per player (Classic / overDress Red / Blue / custom upload), DD2-style HUD, phase banner

## Next (priority order)

### 1. Online play between two PCs
> Add online play: one player hosts, the other joins with a room code. Use PeerJS (WebRTC, free public broker) loaded from a CDN. The host runs `Game` from engine.js; the guest sends actions (`{fn, args}`) and receives `Game.state()` after each change. Hide the opponent's hand and deck order on the guest side. Add "Host online" / "Join online" to lobby.html. Keep hot-seat working.

### 2. Better text → ability coverage
> Write `tools/parse-report.mjs` (Node) that loads every set from the CGS repo, runs `TextParse.abilities()` on each effect, and lists the most common phrases that produce no blocks or partial blocks. Then add regexes in js/textparse.js and new SCHEMA blocks + engine handling for the top 10.

### 3. Trigger type helper
> CGS data has no trigger icon. In the Card library tab add "Set triggers for this set": shows all trigger units of the set as large images in a grid with 5 buttons each (crit/front/draw/heal/over). Save to the cards.

### 4. Game feel
> Add animations: card slides from hand to circle, rest/stand rotation, drive check card flip in the trigger zone, damage card slides to the damage zone, power number pop. Add optional sound effects (off by default, toggle in the HUD). Respect prefers-reduced-motion.

### 5. Missing rules
> Implement: Over trigger extra effect, imaginary gifts (Force/Accel/Protect markers), set orders + order zone, "cannot be called" restrictions, opponent-chosen effects, abilities from soul/drop/hand, drop-zone ACT, ride-deck alternative costs.

### 6. Accounts + cloud save
> Replace guest Auth with real accounts (Supabase or Firebase free tier). Store cards/decks per user, keep IndexedDB as offline cache. Pages only call Auth.get/set/clear so they don't change.

### 7. Vs CPU
> Add a simple AI opponent: ride the ride deck, call best power to front row, attack with everything, guard to stay ahead of the attack when damage ≥ 4.
