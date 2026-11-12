# Vanguard Table

Private fan-made Cardfight!! Vanguard simulator (hot-seat, 2 players, one screen). Not for sale.
The user writes Thai; they asked for replies in English to save tokens. Keep in-game text English.
The user enters real card data and images themselves through the editor. Do not bulk-add Bushiroad card data or art yourself.

## Docs
- `docs/ARCHITECTURE.md` modules, engine contract, ability DSL, storage keys
- `docs/ROADMAP.md` done list + next tasks (copy-paste ready)
- `docs/START-IN-CLAUDE-CODE.md` first prompt and testing tips
- `docs/rules/` official rules reference (CR ver. 4.59, Aug 2026): history, core game flow, one file per format (Standard / V Premium / Premium), mechanics (Stride, gifts, Legion…), card/ability types, and `08-engine-gaps-and-plan.md` (what the engine gets wrong + the plan to support every card). Read the relevant file before changing rules code. Raw notes: `research_notes/`, long report: `reports/`

## Run
No build step. Open `login.html` in Chrome/Edge. Flow: login.html → lobby.html → index.html (game) / editor.html (cards, decks).

## Sign-in
`js/auth.js`: guest only, stored in localStorage key `vt-user` `{name, color, guest, since, lastP2}`. Pages call `Auth.require()` in <head> (redirects to login). `mountUserChip()` fills `[data-userchip]`. To add real accounts later, replace Auth.get/set/clear with server calls; pages don't need to change.

## Design
The UI follows the 'Vanguard Table UI' design canvas (login, lobby, fight table, trigger choice, card editor). Colors/fonts are the tokens at the top of style.css; login/lobby styles in pages.css. Keep the look original: no official logos, art or anime catchphrases.

## Game screen layout (HUD v3, Dear Days 2 style)
Field first; everything else sits on the edges so the table stays clear:
- top-left `.hud-tl`: back to lobby, log drawer (☰), turn tag. Log lives in `#logDrawer` (hidden by default).
- right edge `#rail`: phase rail (Ride/Main/Battle/End). Phase/turn changes play a short cut-in `#banner` (`showBanner()` in ui.js; respects reduced motion).
- bottom-right `#actions.dock`: one-line hint + primary button (gold) + secondary (`ghost`).
- `#info`: card detail floats on the left only while hovering a card.
- center row = ATTACK (left) · guardian circle `#gc` (middle, guardians shown inside) · DEFENSE + guard shield total (right). Fixed height so the field doesn't jump.
- spacing scales with card size (`--cw`), see the v3.1 block in style.css.
- Zones are small counters next to each field (`.zb`); Bind/Ride/Energy only show when relevant.
CSS: "HUD layout v3" blocks at the end of style.css. Card size scales with the screen (`--cw` on body.game).

## Playmats (js/mats.js)
- Each player picks a mat on the setup screen (`.matpick`): Classic (CSS + circle sprites), overDress Red/Blue (`assets/mats/*.jpg`, supplied by the user for private play), or their own uploaded image (resized to 1600px JPEG in localStorage `vt-mat-custom-<seat>`). Choice in `vt-mat-<seat>`; resolved into `ui.mats[pi]` at game start.
- `sideHTML()` draws each half as `.mat` (aspect 2000:1017) with slots/zones absolutely placed from `MAT_LAYOUT` (% of the image). Opponent's mat is rotated 180° and positions are mirrored (`boxCSS(r, opp)`).
- The two mats touch; the ATK · GC · DEF row floats on the seam, so the printed half "G" circles of both mats form the guardian circle.
- Sizes: `--mw/--mh` on body.game; card `--ch` = 30% of mat height. See the "v4" blocks in style.css.
- Custom images must use the same standard layout or cards won't line up.

## Skin & assets
- `assets/banner.png`, `assets/playmat.jpg` come from the CGS community repo (github.com/dragogodev/cgs, folder "Cardfight Vanguard"). Private play only, not for publishing.
- `assets/mat/rc.png`, `vc.png`, `gc.png` are transparent circles cut from that playmat (rear-guard, vanguard, guardian circle).
- `Skin` in `js/auth.js` sets `html.skin-mat` from localStorage `vt-skin` ("mat" default, "classic" = original look). Toggle on the lobby page (bottom left).
- CSS for the skin is the "playmat skin" block at the end of style.css (`.slot::before` circles, `.center::before` ellipse, `.vg-banner`).

## Loading screen & 60 fps
- `js/loader.js` (in every page <head>, right after auth.js): loading screen from first paint until window load + fonts + `Loader.wait(promise)`; min 1 s, max 5 s. App links fade it in, then navigate (`Loader.go(url)`); `Loader.canLeave` lets a page veto (editor: unsaved changes). `Loader.show(msg)` returns hide() for in-page work; `Loader.progress(0..1)`. The game uses it at start/join/rematch while `Pics` loads (`loadingTable()`).
- 60 fps rules: never rebuild big lists/tables on small changes. Patch in place (`setHTML` skips unchanged HTML; game: `renderSide`/`placeCard`/`renderHand`; editor deck builder and Quick deck are built once then patched, + / − only updates counts). Draw long picture lists in chunks (`fillChunked`, 48 per task). Debounce typing. Only animate transform/opacity; no layout properties (margin, width) or filters in transitions. Never wait on requestAnimationFrame alone (paused in background tabs): pair it with a timer.

## Files
- `js/cards.js` — `TRIG` trigger definitions. No sample cards: `DB.removeSamples()` deletes the old sample decks once per browser (flag `vt-samples-removed`)
- `js/schema.js` — ability building blocks: `SCHEMA.kinds/zones/events/conds/costs/effects`, `TARGETS`, `describeAbility()`
- `js/formats.js` — `FORMATS` (standard / vpremium / premium / extreme: ride deck or not, crest, G assist, card pool icon, one nation/clan, trigger caps), `validateDeck()` (format-aware), `iconOf()` (D/V from the card or its collection number), `CLAN_NATION` (old clan → D nation, clan rows unverified), `Restrictions` (editable lists in localStorage `vt-restrict`, edited in the editor's Formats tab). Loaded before db.js on every page
- `js/db.js` — IndexedDB store `vanguard-table` (stores `cards`, `decks`), export/import, `loadDeck()` (returns `{format, energy, ride, starter, main}`)
- `js/engine.js` — rules engine `Game`. No DOM. All actions are async and wrapped in `run()`
- `js/ui.js` — game screen, drawn from `Game.state()`. Redraws are patches, not rebuilds: `renderSide()` builds each mat once and updates slots/zones in place, `placeCard()`/`patchCard()` keep card elements (and their pictures) alive, `renderHand()` is keyed by uid, `setHTML()` skips unchanged HTML. Engine changes go through `scheduleRender()` (one redraw per frame). Pictures come from `Pics` (preloaded + decoded at game start, retry, fallback to `source.imageWeb`). Only animate transform/opacity in CSS
- `js/editor.js` — editor; forms are generated from SCHEMA. Quick deck: `quickBuild()` with style presets `QUICK_PRESETS` and option menus `QUICK_OPTS` (triggers, grade split, sentinels, pick priority, copies, orders, ride line auto/manual). `pickCard()` = big picture picker with search (ride deck slots). Pictures in editor grids use `imgTag()` (queued loader, local↔web fallback via `card.source.imageWeb`, retry, name placeholder): don't use `loading="lazy"`, it left Card library pictures blank
- `js/textparse.js` — `TextParse.parse(text)` best-effort official text → stats + ability blocks (regex based); `parseCSV`, `cardFromRow` for bulk import. Improve regexes here when a card's text is misread
- `js/tcgapi.js` — tcgapi.dev client (`TcgApi`) + `apiToCard()` mapping. The API has no CORS, so calls go through `tools/tcgapi-proxy.ps1` (started by `start-tcgapi-relay.bat`, http://localhost:8787, forwards GET /v1/* with X-API-Key). Vanguard `custom_attributes` key names are undocumented: `apiAttrs()` lowercases keys and `apiToCard()` matches several spellings; use the Raw data panel in the Online tab to adjust the mapping. Free plan 100 req/day; cards cached in our DB (allowed while subscribed, per their licensing page)
- `js/cgs.js` — Card library tab: reads Card Game Simulator JSON from raw.githubusercontent.com/dragogodev/cgs (`AllSets.json`, `sets/<code>.json`; fields name, number, effect, type, clan, grade, power, shield, image_url). No trigger icon or critical in that data: `cgsTriggerGuess()` reads it from text when possible, otherwise the user picks it and unset cards get `needsTrigger` (⚠ in list, validateDeck error). `CGS_PLAYABLE` filters out G units/markers/crests. `cgsLocalImage(set, number)` → `vanguard_images/<set>/<number with _>.png` (folder made by the user's Edit.py); "Use pictures from vanguard_images" checkbox (localStorage `vt-cgs-local`) + relink button in the Card library tab
- `style.css` shared, `editor.css` editor only

## Data model
Card: `{id, name, grade, type: unit|trigger|order, power, shield, crit, trigger: null|crit|front|draw|heal|over|stand, trigPower?, drive?, boost?, intercept?, sentinel, persona, nation, race, image, text, abilities[]}`. Missing drive/boost/intercept fall back to grade (Twin Drive on G3+, Boost on G0–1, Intercept on G2); missing trigPower = 10000 (over 100M)
Ability: `{kind: AUTO|ACT|CONT|ORDER|BLITZ, zone, when, once: ""|turn|game, mandatory?, conds[], costs[], effects[]}`; each row is `{type, ...params}`. `mandatory` AUTOs resolve without asking (no "you may"). `when: "overDrive"` = an over trigger's own text, only on drive checks
Deck: `{id, name, format, energy, ride:[4 card ids G0..G3] (Standard), starter: card id (formats without a ride deck: a G0 that is one of the 50), main:[50 card ids]}`. Card also has `clan` (older cards), `icon` ("D"|"V"|"-"|"" = auto), `regalis`; G units: `type: "g"`, grade 4, `gKind: "stride"|"guardian"`, `ultimate`, drive 3 by default. Deck also `g:[ids]`, `gUnlock`

## Engine notes
- `S.active` = turn player, `S.controller` = who must act now (defender while guarding, chooser during `S.pending`)
- Choices: `choose(pi, prompt, options, min, max)` returns a Promise; UI calls `Game.answer(ids)`. Auto-resolves when there's no real choice
- Slots `{card, rest, pow, crit, powB, critB}`; pow/crit reset at end of turn, powB/critB at end of battle. CONT bonuses computed live in `power()`/`crit()`
- Phases: mulligan → ride → main → battle → (endTurn) ride…. `S.first` = who went first (random unless chosen); both players draw every turn; no attacks on turn 1; mulligan = bottom, draw, shuffle
- Check timing (CR 11.6): `fire()`/`collect()` put AUTO abilities in `S.queue`; `checkTiming()` runs rule actions, then the turn player resolves their waiting abilities in the order they pick (prompt when 2+), then the other player; abilities triggered while one resolves (`depth`>0) wait. Simultaneous events (attack+boost+attacked, placedRC+allyPlacedRC, riddenUpon+placedVC, turnStart+oppTurnStart) are collected together first
- Stride / G zone (CR 6.5, 9.8, 14.12–14.16): decks have `g:[≤16 G unit ids]` (Premium/Extreme; Standard only with `deck.gUnlock`). Player `gDeck` (face down, hidden from the opponent online) and `gUp` (face up). Phase `stride` sits between ride and main when `canStride()` (both vanguards G3+ or yours was G3+ at turn start, hand grades ≥3): `Game.stride()` (pick G unit, discard total grade 3+, old vanguard → `slots.vc.heart`, power adds the heart's, names include it) or `skipStride()`. End phase `returnGUnits()`: G units → `gUp`, heart back to vanguard. `leaveCircle()` sends G units to the G zone instead of drop/bind. `gGuard()` in the guard step (both vanguards G3+, ≤3 face-up G guardians, default cost: discard a grade 1+ card [unverified]); G guardians go to `gUp` at end of battle. Ultimate Stride needs 3 face-up G cards and removes the whole G zone when it returns. Conditions `genBreak` / `limitBreak`, event `onStride`
- Formats in the engine: each player has `hasRideDeck`; without one the first vanguard comes from the main deck and the G assist step runs at the start of the ride phase (`gAssist()`, CR 9.5). Energy only with the Energy Generator crest (Standard)
- Losses: `lose()` only notes `S.loss[pi]`; `ruleActions()` decides at check timing / after each damage check / after every action. Both at once = draw game (`S.winner = -1`)
- Rules follow docs/rules (CR 4.59). Fixed: B1–B16 of `docs/rules/08-engine-gaps-and-plan.md`. Still open: formats, zones (G/order/crest), gifts, Stride, Legion, more DSL blocks
- Damage cards have `down` (face down) for Counter-Blast

## Adding a new ability block
1. Add it to `SCHEMA.effects` (or conds/costs/events) with `label`, `params`, `text()`
2. Handle the same `type` in `effect()` / `condOK()` / `canPay()`+`pay()` in engine.js, or `fire(...)` the new event at the right moment
3. The editor picks it up automatically. Test by building a card with it and playing a game

## Online play
`js/net.js` + `index.html?online=host|join` (lobby tiles). Host runs the engine and sends `Game.snapshot(1)` (hidden info removed) after each change; guest's `Game` actions become remote calls. Details in docs/ARCHITECTURE.md. Needs internet (PeerJS from unpkg + public broker); hot-seat doesn't.
Local test: `node tools/serve.mjs` (or the "vanguard" entry in .claude/launch.json), open host and join pages in two tabs.

## Not implemented yet (good next tasks)
- Imaginary gifts, Legion, set orders/order zone, Regalis Piece once-per-game, "cannot be called" type restrictions, Standard stride crests (Chronojet etc.: power/+5000 per face-up G card)
- Opponent-chosen effects (e.g. "your opponent chooses…"), abilities from soul/drop/hand zones, drop-zone ACT
- Ride from ride deck alternative costs written on ride-line cards
- Animations and sound

## Testing
After engine changes, play one full game (both decks) and watch the log for ✦ ability lines and errors in the console.

## Status (handoff from claude.ai, 2026-11-12)
Done: guest login, lobby, hot-seat game with working ability engine, card/deck editor, text→ability parser, CSV import,
tcgapi.dev importer (+ local relay), Card library importer (CGS GitHub data), playmat skin + banner.
Untested with real data: tcgapi.dev attribute names (needs a real key), card images hotlinked from en.cf-vanguard.com.

## Suggested next tasks
1. Online play polish (see ROADMAP task 1).
2. Improve `js/textparse.js` using the CGS data: run every `effect` through `TextParse.abilities` in Node and list texts that produce no/partial abilities, then add regexes and SCHEMA blocks for the most common ones.
3. Trigger type for CGS cards: data has no icon. Ideas: shield value hints, or a per-set picker that shows card images in a grid.
4. Real accounts + cloud save (replace Auth.get/set/clear; keep DB API).
5. Animations/sound, drag-and-drop calls, G zone/Stride, set orders, imaginary gifts.
