# Vanguard Table – Roadmap

Status as of 2026-11-12. Each task is written so it can be pasted into Claude Code.

## Done
- Guest login, lobby, sign-out
- Hot-seat game: mulligan, ride (ride deck / hand), call, move, orders (normal 1/turn, blitz), battle, boost, drive check, triggers (crit/front/draw/heal/over), guard, intercept, sentinel, damage check, counter-blast, energy, win/lose
- Ability engine (AUTO/ACT/CONT/ORDER/BLITZ) built from editor blocks
- Card editor (clan/race filters), deck builder with card pictures + clan/race/grade filters and rule checker, ✨ Quick deck (auto-builds a legal deck from your own cards of one clan: vanguard, style presets, fine-tune menus, auto or hand-picked ride line), ride deck picker with pictures + search, export/import, CSV import, text → ability parser
- Card library import (CGS GitHub data, 21k cards), tcgapi.dev import (needs key + relay)
- Local pictures: `vanguard_images` (Edit.py) + "Link pictures" folder matcher
- Playmats per player (Classic / overDress Red / Blue / custom upload), DD2-style HUD, phase banner
- Reader round 2: 44.5% fully read (from 38.2%), sentence-scoped conditions, cost-free parts before a mid-sentence cost, aliases, all clans, stride grade, gained Boost/Intercept, back-row attacks, count comparisons, text check fixes (2026-11-13)
- Phase 4 text reader v2: new blocks, choose → it / that unit, if you did, mid-sentence conditions, end of battle/turn steps, choose-one bullets, granted abilities, safe fallbacks, reader-check tool (2026-11-13)
- Phase 3 keywords: tokens, tickets, crests, Forerunner, Harmony, named states, columns, Success power condition, Prison, Music, cannot be called, keyword templates (2026-11-13)
- Ability Language v2 steps 6–7: replacement abilities (would be retired / leave the GC → instead), Superior Ride by an effect, ride source + "when X rides this unit" (2026-11-13)
- Ability Language v2 step 5: retired / discarded / boosted / guard step / no hit / drive & damage check reveals / opponent places / order played / put into soul timings, "placed from" and "the card it is about" filters, abilities in hand / drop / soul / damage / bind / G zone, same-name 1/Turn, Ritual (2026-11-13)
- Ability Language v2 step 4: until end of opponent's / next turn, restrictions, player rules (GC / RC / intercept / guard with 2+), Resist, Lord, granted abilities (2026-11-13)
- Ability Language v2 steps 1–3: richer filters, counts / for each, Move cards (any zone, effect + cost), if-you-did steps, choose N of the following (2026-11-13)
- Admin card tools part 2: reprints, templates, bulk edit, history + restore, review queue, progress per set, rulings notes (2026-11-13)
- Admin card tools part 1: card status + filter, text ↔ blocks check, test table (2026-11-13)
- Admin page: players (roles, coins, cards, bans, names), match and pack history, admin log (2026-11-12)
- Coins from online matches: both players report, paid when they agree, daily limit (2026-11-12)
- Store: boxes with rarity rates, pack opening on the server, collection, deck builder limited to owned cards, admin box editor + settings (2026-11-12)
- Shared card library (admins edit) + decks saved per account, offline outbox, card pictures in Storage (2026-11-12)
- Supabase accounts: sign in / create account / guest, roles + coins in `profiles`, admin RPCs (2026-11-12)
- Lock / Delete / Time Leap and the Manual block with a Judge panel (2026-11-12)
- D-era mechanics (2026-11-12): set orders + order zone (CONT/AUTO/ACT there), World, Arms, Alchemagic, Regalis Piece once per game, overDress / XoverDress, Divine Skill / Unique Skill, Ace Unit limit
- Imaginary gifts and Legion (2026-11-12): Force I/II, Accel I/II (extra front-row circles), Protect I/II; Seek Mate / Legion with drop-to-deck cost
- Stride / G zone (2026-11-12): G units (grade 4) in a G deck, stride step with heart, triple drive, Generation Break, G guardians, Ultimate Stride; Card library imports G units
- Formats (2026-11-12): Standard / V Premium / Premium / Premium Extreme per deck, format-aware deck check, editable restriction lists (Formats tab), first vanguard from the main deck + G assist for formats without a ride deck, Quick deck for every format
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
