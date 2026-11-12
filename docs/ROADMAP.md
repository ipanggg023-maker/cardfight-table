# Vanguard Table – Roadmap

Status as of 2026-11-12. Each task is written so it can be pasted into Claude Code.

## Done
- Guest login, lobby, sign-out
- Hot-seat game: mulligan, ride (ride deck / hand), call, move, orders (normal 1/turn, blitz), battle, boost, drive check, triggers (crit/front/draw/heal/over), guard, intercept, sentinel, damage check, counter-blast, energy, win/lose
- Ability engine (AUTO/ACT/CONT/ORDER/BLITZ) built from editor blocks
- Card editor (clan/race filters), deck builder with card pictures + clan/race/grade filters and rule checker, ✨ Quick deck (auto-builds a legal deck from your own cards of one clan: pick vanguard + trigger mix), export/import, CSV import, text → ability parser
- Card library import (CGS GitHub data, 21k cards), tcgapi.dev import (needs key + relay)
- Local pictures: `vanguard_images` (Edit.py) + "Link pictures" folder matcher
- Playmats per player (Classic / overDress Red / Blue / custom upload), DD2-style HUD, phase banner
- Online play (2026-11-12): lobby "Host online" / "Join online", 5-letter room code, PeerJS; host runs the engine, guest gets redacted snapshots; guest can reload and rejoin mid-game; rematch

## Next (priority order)

### 1. Online play polish
> Online play works (js/net.js). Still open: random first player, chat/emotes, a "rejoin last room" button, showing the host's custom card images when they are big data URLs (test with real images), and a TURN server option for networks where WebRTC can't connect directly.

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
