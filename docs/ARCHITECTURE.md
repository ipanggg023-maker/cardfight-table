# Vanguard Table – Architecture

Plain HTML/CSS/JS, no build step, no server. Opens from `file://` in Chrome/Edge. ~3,500 lines total.

## Page flow
```
login.html ──► lobby.html ──► index.html   (play, hot-seat 2 players)
                      └─────► editor.html  (cards, decks, card library, backup)
```
Every page loads `js/auth.js` in `<head>` (guest login + `Skin` + `Auth.require()` redirect).

## Modules
| File | Role | Depends on |
|---|---|---|
| `js/auth.js` | Guest user (`vt-user`), user chip, `Skin` (playmat look on/off) | – |
| `js/cards.js` | `TRIG` trigger table, `seedData()` sample decks | – |
| `js/schema.js` | Ability DSL: `SCHEMA.kinds/zones/events/conds/costs/effects`, `TARGETS`, `describeAbility()` | – |
| `js/db.js` | IndexedDB `vanguard-table` (stores `cards`, `decks`), export/import, `loadDeck()`, `validateDeck()` | cards |
| `js/engine.js` | Rules engine `Game` (no DOM). Phases, battle, triggers, abilities, choices | schema |
| `js/mats.js` | Playmats registry `MATS`, `MAT_LAYOUT` (% positions), per-seat choice + custom upload | – |
| `js/net.js` | Online play: PeerJS (loaded from unpkg only when going online), host/join, remote actions, image map | engine |
| `js/ui.js` | Game screen. Redraws everything from `Game.state()` on each change. `?online=host\|join` switches the setup panel to online | engine, mats, db, net |
| `js/textparse.js` | Official card text → stats + ability blocks (regex), CSV parsing | schema |
| `js/tcgapi.js` | tcgapi.dev client (via local relay) + `apiToCard()` | textparse |
| `js/cgs.js` | Card library from github.com/dragogodev/cgs JSON + `cgsToCard()` | textparse |
| `js/editor.js` | Editor UI: card form from SCHEMA, deck builder, Card library, Online cards, backup, CSV, link pictures | all above |
| `tools/tcgapi-proxy.ps1` | Local CORS relay for tcgapi.dev (port 8787) | – |

## Engine contract
- `Game.newGame(names, decks)` → `Game.state()` is the single source of truth.
- Every action is async: `mulligan, rideFromDeck, rideFromHand, skipRide, call, move, activate, playOrder, toBattle, attack, guard, intercept, confirmGuard, endTurn`. Each returns `{ok, msg}`.
- Player choices: engine sets `S.pending = {player, prompt, options[], min, max}` and awaits; UI calls `Game.answer(ids)`.
- `S.active` = turn player, `S.controller` = who must act now (used for hot-seat curtain).
- `Game.setOnChange(fn)` → UI re-renders.
- `Game.snapshot(seat)` → JSON-safe copy (Sets → arrays, no `image` fields). With a seat it hides the opponent's hand + ride deck, both decks (as `{hidden:true}` stubs with fake uids), and the opponent's pending options. `Game.load(state)` shows a snapshot; the pure helpers (`power`, `actList`, `nextRide`…) then work on it.

## Online play (js/net.js)
- Host = seat 0, runs the real engine. Peer id `vgtable-<CODE>` on the public PeerJS broker.
- Guest → host: `hello {name, deck, mat}`, `act {id, fn, args}`. Host → guest: `start {seat, mats, images}`, `state {s}`, `res {id, r}`.
- On the guest, `Net.join()` replaces the `Game` action methods with remote calls. The host only runs them when `S.controller` (or `S.pending.player` for `answer`) is the guest.
- Card images travel once in `start.images` (by card id); `imgOf(c)` in ui.js looks them up.
- UI: `ui.online = {seat}`; `view()` is fixed to that seat, no curtain; `myMove()` blocks clicks when it's not your move.

## Ability DSL (card.abilities[])
```js
{ kind: "AUTO"|"ACT"|"CONT"|"ORDER"|"BLITZ", zone: "VC"|"RC"|"VC/RC"|"GC"|"any",
  when: "<event>", once: ""|"turn"|"game",
  conds: [{type, ...}], costs: [{type, ...}], effects: [{type, ...}] }
```
- Conditions: myTurn, oppTurn, vcName, vcGrade, oppVcGrade, myDamage, oppDamage, rearCount, soul, drop, hand, persona, playedOrder, targetVC, selfFront, selfBack
- Costs: CB, SB, EB, discard, restSelf, retireSelf, selfToSoul, retireRC
- Effects: power, crit, drive, stand, rest, retire, bind, draw, CC, SC, EC, heal, shield, cantBeHit, search, lookTop, callFromHand (+ more in schema.js)
- Add a block: schema.js entry → handle `type` in engine.js (`effect()` / `condOK()` / `canPay()`+`pay()` / `fire()`) → editor picks it up automatically.

## Data
- Card: `{id, name, grade, type: unit|trigger|order, power, shield, crit, trigger, sentinel, persona, nation, race, image, text, abilities[], source?, needsTrigger?}`
- Deck: `{id, name, energy, ride:[4 ids G0..G3], main:[50 ids]}`
- localStorage keys: `vt-user`, `vt-skin`, `vt-mat-1/2`, `vt-mat-custom-1/2`, `vt-tcgapi-key`, `vt-tcgapi-relay`, `vt-cgs-local`

## Screen layout (index.html)
Two playmats meet in the middle (opponent's rotated 180°). Floating HUD: top-left (lobby, log ☰, turn), right edge phase rail, bottom-right action dock, hover card panel on the left, phase cut-in banner. ATK · GC · DEF float on the seam.
