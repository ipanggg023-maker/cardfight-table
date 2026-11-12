# 08 · Engine gaps and plan (Vanguard Table)

Compares `js/engine.js`, `js/schema.js`, `js/db.js` and `js/cards.js` (read 2026-11-12, not run) against CR 4.59 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)) and the [Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/). Line numbers refer to `engine.js` at commit 590fc3f.

## 1. What the engine supports today

| Area | Current behaviour |
|---|---|
| Card model | `{id,name,grade,type: unit|trigger|order, power, shield, crit, trigger: null|crit|front|draw|heal|over, sentinel, persona, nation, race, image, text, abilities[]}`. There are no fields for drive, skill icons, trigger power, clan, subtype, gift icon, format icon or aliases |
| Deck model | `{energy, ride:[4], main:[50]}`. There is no crest slot, no G deck and no format |
| `validateDeck` (db.js:63) | Checks: ride = 4 cards (G0–3); main = 50; 16 triggers (main only); heal ≤4; over ≤1; sentinel ≤4 (main only); copies ≤4. It does **not** check: crit/draw/front ≤8, nation/clan, D/V icon, Regalis ≤1, Ace Unit ≤1, G deck, restriction list, or triggers/sentinels in the ride deck |
| Turn flow | mulligan → `startTurn` (stand + draw + energy) → ride → main → battle → `endTurn`. No explicit stand, draw, G assist, stride or end-phase steps |
| Ride | From the ride deck (discard 1, next grade) or from hand (same grade or +1). Persona when `card.persona && grade≥3 && same name` |
| Main | Call (grade ≤ VC, replaces the occupant); front/back swap; ACT on field units; 1 normal order per turn |
| Battle | Front-row attacker → front-row target; boost if the back unit is grade ≤1; guard from hand; intercept if grade 2; sentinel built in; drive = `grade≥3 ? 2 : 1` + bonus; damage checks; 6 damage / deck-out loss |
| Triggers (`trigger()` l.361) | crit / front / draw / heal / over, hard-coded at +10000 (over +100M). Over goes to **bind** |
| Energy | If `deck.energy`: +3 at every turn start, cap 10 |
| DSL | 5 kinds (AUTO, ACT, CONT, ORDER, BLITZ); zones VC, RC, VC/RC, GC, any; `once` turn/game; **14 events, 16 conds, 8 costs, 18 effects, 15 targets** |
| Ability resolution | `fire()` runs one player's circle abilities immediately, in circle order, each with a yes/no prompt. There is no standby queue, the player cannot choose the order, the opponent's AUTOs don't fire (except `attacked`), and nothing works from hand/soul/drop. CONT affects only power and crit, and only your own units |

## 2. Wrong in every format (fix first)

| # | Bug | CR | Where |
|---|---|---|---|
| B1 | **The first player skips the turn-1 draw.** CR has no exception: both players draw every turn | 9.4.2 | `mulligan()` → `startTurn(true)` (l.412); log text at l.45 |
| B2 | **The first player can attack on turn 1.** CR forbids it | 10.3.2 | `toBattle` (l.514) has no turn-1 check |
| B3 | **The first player is always player 0.** CR: a random player chooses first or second. "Went second" also matters for the Energy Generator | 8.2.1.6 | setup (l.41–45) |
| B4 | **Mulligan shuffles before drawing**, so returned cards can come back. CR: put them on the bottom, draw, then shuffle | 8.2.1.8 | l.406–408 (`push` = top of the `pop()` deck) |
| B5 | **Over trigger goes to bind** and has no drive-check bonus text. CR: removed from the game; draw 1; +100M; drive check only → card text | 11.10.2.7 | l.596, l.611 |
| B6 | **The damage-check card enters the damage zone before its trigger resolves.** The heal comparison then counts it (e.g. 2 vs 3 damage heals when it shouldn't), and the heal removes the newest card instead of letting the player choose | 13.6–13.7, 11.10.2.5 | l.611–613, l.376–378 |
| B7 | **Trigger power is hard-coded at 10000.** CR: the number printed on the icon (5000 on old cards) | 11.10.5 | l.367–368 |
| B8 | **Drive comes from grade** (G3 = 2). CR: from skill icons (Twin = 2, Triple = 3), base 1, largest applies | 2.17, 14.3 | l.589 |
| B9 | **Boost (grade ≤1) and intercept (grade = 2) come from grade.** CR: Boost and Intercept icons; intercept allowed even while rested | 14.4, 14.5 | l.526, l.577 |
| B10 | **Persona Ride**: it requires grade ≥3 (CR doesn't), doesn't check that the ride was a normal ride **from hand**, and doesn't check the old card's icon. Its +10000 is a one-shot buff on current front units; CR makes it positional for the whole turn | 6.3.8, 7.15.1.4 | `doRide` l.421–425 |
| B11 | **Orders**: no grade ≤ vanguard check; blitz orders don't count toward the shared 1-order limit | 9.9.2.3, 10.5.1.2.5 | `playOrder` l.494–511 |
| B12 | **Energy** is +3 at every turn start, including the first player's turn 1, regardless of crest. Per the (unverified) Generator text, it should be +3 at the start of each of your ride phases while the crest is in the crest zone, +3 once if you went second, with an ACT EB7: draw 1 | 3.1.3, 13.13 | l.394 |
| B13 | **No check timing**: AUTOs resolve immediately in circle order, all as "you may", and only one player's fire. CR: rule actions → gifts → the turn player's standby AUTOs in the order they choose → the non-turn player's, looping; mandatory unless "you may" | 11.6.1, 11.9.4 | `fire()` / `fireAll()` |
| B14 | Losses are checked inline (`lose()` during a check). CR checks them at the next check timing; e.g. a deck-out during an effect loses only then | 13.1.2 | l.591, l.607, l.613 |
| B15 | Hit rear-guards are retired before guardians. CR order: G guardians → guardians → hit rear-guards, after the hit AUTOs | 10.7.1 | l.616–627 |
| B16 | Trigger counts and sentinel counts ignore the ride deck | 8.1.6–8.1.7 | db.js:71, 76 |

## 3. Missing features per format, ranked

**P0** = needed before any real card plays correctly. **P1** = needed by most Standard decks. **P2** = V Premium / common Premium. **P3** = niche.

| # | Gap | S | VP | P | X | Pri |
|---|---|---|---|---|---|---|
| 1 | Core-loop fixes B1–B16 | ✔ | ✔ | ✔ | ✔ | **P0** |
| 2 | Card fields: `drive`, `skills[]`, `triggerPower`, `clan`, `subtype`, `giftIcon`, `formatIcons`, `aliases`, `setCode`; ability `mandatory` | ✔ | ✔ | ✔ | ✔ | **P0** |
| 3 | Check-timing loop with a standby queue for both players, owner-chosen order, rule actions as a pass | ✔ | ✔ | ✔ | ✔ | **P0** |
| 4 | Abilities from every zone (hand, soul, drop, damage, bind, order zone, crest, G zone, ride deck) and opponent-side events | ✔ | ✔ | ✔ | ✔ | **P0** |
| 5 | Trigger zone, removal zone, order zone + set orders, crest zone + Energy Generator as a real card, Regalis limit, Divine/Unique Skill icons | ✔ | – | ✔ | ✔ | **P1** |
| 6 | Generic DSL blocks: move cards between any zones, superior call/ride, restrictions (cannot guard ≥N, cannot intercept…), target change, multi-attack, opponent chooses, for-each, if/then, modal choice, grant ability | ✔ | ✔ | ✔ | ✔ | **P1** |
| 7 | overDress / XoverDress / originalDress stacks; Alchemagic; Arms; tokens; tickets (Persona Shield etc.) | ✔ | – | ✔ | ✔ | **P1** |
| 8 | Format selector + per-format validation (nation/clan, icon, 8-caps, 5-card ride deck with crest and special ride decks, G deck, restriction list as data) | ✔ | ✔ | ✔ | ✔ | **P1** |
| 9 | Ride-deck-less play: first vanguard from main deck, G assist step, ride from hand only | – | ✔ | ✔ | ✔ | **P2** |
| 10 | Imaginary gifts (Force/Accel/Protect I/II, extra Accel circles, Protect card) | – | ✔ | ✔ | – | **P2** |
| 11 | Legion / Seek Mate / D-Legion | (D) | ✔ | ✔ | ✔ | **P2** |
| 12 | G zone, stride step, heart, G guardian, Generation Break, Ultimate Stride; G deck in Standard via crests | crest | – | ✔ | ✔ | **P2** |
| 13 | Limit Break & other condition keywords, stand trigger, same-clan trigger flag, Lord/Forerunner/Restraint/Resist | reprints | ✔ | ✔ | ✔ | **P2** |
| 14 | Lock/unlock, delete, time leap, gauge, attach, Alchemix, Astral Plane, music orders, worlds, clan-specific keywords | some | some | ✔ | ✔ | **P3** |

The ranking is an estimate from rule structure. No card counts per mechanic were found. Running the CGS `effect` texts through a counter (ROADMAP task 2) would give real numbers.

## 4. Plan: let the user enter any card

The approach has five layers. Each layer is plain JS, and the engine stays DOM-free.

### 4.1 Data model (db.js, editor card form)
```js
Card = {
  id, name, aliases: [],                       // DressUp / "also regarded as"
  grade, power, shield: null|number, crit: 1,
  type: "unit"|"order"|"crest"|"rideCrest"|"ticket"|"token"|"marker",
  subtype: ""|"trigger"|"G"|"blitz"|"set"|"arms"|"prison"|"song"|"music"|"world"|...,
  trigger: null|"crit"|"draw"|"heal"|"front"|"stand"|"over", triggerPower: 10000,
  overText: [effects],                         // over trigger extra, drive check only
  skills: ["boost","intercept","twinDrive","tripleDrive"],   // drive derived: 1/2/3
  keywords: ["sentinel","regalisPiece","aceUnit","resist","restraint","lord", ...],
  persona: false, giftIcon: null|"force"|"accel"|"protect",
  nations: [], clans: [], races: [], fighterIcon: null,
  formatIcons: ["D"]|["V"]|[], setCode, number, rarity,
  strideCost: [costs], gGuardianCost: [costs],                // G units
  rideDeckRule: null|{size, slots:[...]},       // Griphosid etc. (on the G0)
  validZones: null|["hand","GC"],               // pseudo-cards: erased elsewhere
  image, text, abilities: []
}
Ability = { kind, zones: [], once: ""|"turn"|"game", restriction: ""|"divine"|"unique"|"regalis",
            mandatory: true, keyword: ""|"LB"|"GB"|"Brave"|..., keywordN: 4,
            when, whenFilter, conds: [], costs: [], effects: [] }
Deck = { id, name, format: "standard"|"vpremium"|"premium"|"extreme",
         ride: [ids], crest: id|null, main: [50 ids], gdeck: [≤16 ids] }
```
- **Migration:** `inst()` fills the defaults. If `skills` is missing, derive it from grade (G0–1 boost, G2 intercept, G3 twinDrive), the same as today's behaviour. Set `triggerPower` to 10000 and `type:"trigger"` → `subtype:"trigger"`. Existing decks get `format:"standard"`, and their `energy` flag becomes `crest = Energy Generator`.
- **cgs.js / textparse.js:** map "Twin Drive", "Boost" and "Intercept" from the text where the data has them. The CGS data has no trigger icons, so the editor keeps the `needsTrigger` flag.

### 4.2 Format profiles (new `js/formats.js`, shared by db.js and engine.js)
```js
FORMATS = {
  standard: { rideDeck:true, rideDeckSize:5, crest:true, energy:true, gAssist:false,
              gifts:false, stride:"byCard", standTrigger:false, sameClanTrigger:false,
              identity:"nation", poolIcon:"D", trigTotal:16,
              trigCaps:{over:1, heal:4, crit:8, draw:8, front:8}, sentinelMax:4, copies:4 },
  vpremium: { rideDeck:false, gAssist:true, gifts:true, stride:false, identity:"clan", poolIcon:"V",
              trigCaps:{over:1, heal:4}, ... },
  premium:  { rideDeck:false, gAssist:true, gifts:true, stride:true, gdeckMax:16, standTrigger:true,
              sameClanTrigger:true, identity:"clan", nationToClan:true, ... },
  extreme:  { ...premium, identity:null, sameClanTrigger:false, gifts:false, restrictions:null }
}
RESTRICTIONS = { standard: [{name, limit:0|1|2|"noFV"}], choiceGroups: [[names]] , ... } // editable data
```
- `validateDeck(deck, byId, FORMATS[deck.format], RESTRICTIONS[deck.format])` checks:
  - pool icon and identity;
  - ride deck size and slots, with an override from the G0's `rideDeckRule`;
  - crest present (Standard);
  - 16 triggers and the caps, counted over **main + ride**;
  - sentinel ≤4, Regalis ≤1, Ace ≤1, copies ≤4 (main + ride; G deck separate), G deck ≤16 and subtype G;
  - the restriction list.
- Add a format dropdown in the deck builder, Quick deck and game setup, and show a format badge in the HUD.

### 4.3 Engine core (engine.js)
1. **Zones:** per player, add `removal, trigger, orderZone[{card,rest,faceDown}], crest[], gzone{down:[],up:[]}, gauge[], energyMax, extraRC[]` (Accel). Slots gain `under: {originalDress:[], hearts:[], arms:[], attached:[]}`, `locked`, `deleted`, `markers[]`.
2. **`moveCard(card, from, to, opts)`**: one function for every movement. It emits `leave:<zone>` / `enter:<zone>` plus semantic events (retired, bound, removed, putIntoSoul, discarded, drawn, placed, called{normal|superior}, ridden{normal|superior, fromRideDeck}). The redirects live here: ride-deck card → ride deck zone face up; G unit → G zone face up; pseudo-card outside `validZones` → erased.
3. **Event bus + standby + check timing:**
   ```js
   emit(ev, ctx)        // scan BOTH players, ALL zones; push matching AUTOs into S.standby (once per trigger)
   async checkTiming(){ for(;;){
     if (ruleActions()) continue;           // loss, overload, illegal guardian, damage application/resolution, excess energy, erase pseudo
     if (await gift(tp) || await gift(ntp)) continue;
     if (await resolveOne(tp) || await resolveOne(ntp)) continue;  // owner picks the order if >1
     break; } }
   ```
   Call `checkTiming()` before every prompt. Damage becomes `pendingDamage += crit`, and the checks happen inside `ruleActions()`, one card at a time.
4. **Explicit phases:** `stand → draw → gAssist? → ride → stride? → main → battle{start, attack, guard, drive, damage, close}* → end`. Emit `begin:<phase|step>` at each point. On turn 1 the first player draws but has no battle. Use the end-phase order from CR 9.11.
5. **Triggers:** a data table `TRIG[t] = {subs:[...]}` using `card.triggerPower`. Add stand. Over: removal + draw + 100M + `overText` on drive checks. Heal runs while the card is in the trigger zone, the player chooses the damage card, and the compare excludes the card being checked. `sameClanTrigger` applies when the format sets it.
6. **Stats:** `stat(pi, slot, key)` covers power, crit, drive, shield, grade, names, and flags (canAttack, canBoost, canIntercept, canBeChosen, canGuardFromHand). CONT may target the opponent's side. Apply the CR 11.11 layer order: printed → original → markers → ± → boost/guard → "set to". Persona Ride and gift markers become positional CONT rules, not one-shot `pow`.
7. **Restrictions:** `once` turn/game per ability; `S.divineUsed[pi]`, `S.uniqueUsed[pi]`, `S.regalisUsed[pi]` per player; `S.ordersThisTurn[pi]` shared by normal and blitz orders.
8. **Mechanic modules:** `orders.js` (set orders, order zone, Alchemagic, Arms), `dress.js` (overDress/XoverDress), `gifts.js`, `legion.js`, `stride.js` (G zone, heart, G guardian, GB, end-phase return), `lock.js` (lock/delete). Each one registers its events, effects and actions into SCHEMA and the engine. They load when the format or deck needs them.
9. **Online (net.js):** `snapshot(seat)` must hide the face-down G zone, the ride deck, face-down order-zone and bind cards, and the gauge.

### 4.4 DSL additions (schema.js + engine handlers)
- **Events** (add; each carries `ctx` = cause card, from/to zone, controller, normal/superior):
  - `ridden{fromRideDeck, persona}`, `strided`, `putIntoSoul`, `putIntoDrop`, `putIntoDamage`, `retired{byOpp}`, `bound`, `removed`, `discarded`, `drawn`;
  - `triggerRevealed{type, check:"drive"|"damage"}`, `oppAttacks`, `allyAttacked`, `attackNotHit`, `guardianCalled`, `intercepted`;
  - `orderPlayed{subtype}`, `setOrderPlaced`, `costPaid{CB|SB|EB}`, `energyCharged`, `giftGained`, `overDressed`, `locked`, `unlocked`, `putIntoGZone`;
  - `begin:<phase|step>`, `standUp`.
- **Conditions:**
  - generic `count{zone, who, op, n, filter}`, replacing soul/drop/hand/damage/rearCount;
  - `vc{name|grade|clan|nation}`, `attacker is …`, `boosted`, `rodeFromRideDeck`, `personaThisTurn`, `energy ≥ N`;
  - `orderZoneHas`, `crestIs`, `wentFirst/Second`, `turnStat{cardsIntoSoul, calls, …}`, `divineUnused`;
  - keyword macros: LB N, GB N, Brave, Oracle, Thunderstrike N, Darkness, Powerful, Wings.
- **Costs:** `CB{n, filter}`, `SB{n, filter}`, `EB n`, `discard{n, filter}`, `retire{n, filter}`, `rest{n, filter}`, `putIntoSoul{from}`, `bind{from}`, `reveal{from, filter}`, `returnToDeck{from, n}`, `lockOwn`, `flipG`, `restSetOrder`.
- **Effects:** generic `moveCards{from, to, n, upTo, filter, reveal, who, chooser, faceDown, rest}`. It covers superior call, return to hand/deck, put into soul/damage/bind, and remove. Add:
  - `superiorRide{from, filter}`, `stand/rest{targets}`, `restrict{who, what, dur}`, `cantBeHit`, `changeTarget`, `attackAll`, `canAttackAgain`;
  - `dealDamage n`, `heal{choose}`, `CC/SC/EC`, `setEnergyMax`, `setStat`, `grantAbility{target, ability, dur}`;
  - `createToken`, `giveTicket`, `giveGift`, `giveCrest`, `stride`, `legion`, `overDress`, `alchemagic`, `setWorld`;
  - `lookTop{n, then}`, `shuffle`, `chooseOne[options]`, `ifThen{cond, then, else}`, `forEach{count, effects}`, `oppChooses{...}`;
  - `ref` / `that` so later rows can point at the earlier result.
- **Targets:** add `oppVC`, `attacked`, `booster`, `boosted`, `sameColumn`, `that`, `allOpp*`, plus filters (clan, nation, race, trigger, power ≥, rest/stand, front/back, exact name vs contains, normal/superior called this turn).

### 4.5 Editor and UI
- **Card form:**
  - chips for skills and keywords;
  - triggerPower, subtype, clan/nation/race lists, gift and persona icons, format icons, setCode/number;
  - G-unit stride/G-guardian costs, overText, rideDeckRule.
- **Per ability:** a "Mandatory" toggle; a restriction picker (1/Turn, 1/Fight, Divine, Unique, Regalis); a keyword-macro dropdown that expands into rows.
- **Nested blocks** (`ifThen`, `chooseOne`, `forEach`) shown as indented lists. `describeAbility()` must cover every block.
- **Escape hatches**, essential for "any card":
  - a **Raw JSON** tab per ability, validated against SCHEMA;
  - a **Manual effect** block: the engine pauses, shows the card text, and opens **judge mode**, where either player can move any card between any zones, change power/crit, stand/rest, set energy, then confirm.
- **Game UI:**
  - viewers for the removal zone, order zone, crest zone, G zone (face-down count + face-up list) and trigger zone during checks;
  - gift markers and extra Accel circles in `MAT_LAYOUT`;
  - heart / originalDress / arms stack counts on circles; face-down locked slots;
  - an AUTO ordering prompt when more than one is in standby;
  - a "went first/second" choice at setup.

### 4.6 Build order and acceptance tests
| Step | Deliverable | Done when |
|---|---|---|
| 1 | Fix B1–B16 | A Standard hot-seat game follows CR: turn-1 draw, no turn-1 attack, choose first/second, bottom-mulligan, over removed, heal timing correct |
| 2 | Card fields + `formats.js` + validator | A 5+50 Standard deck with Energy Generator validates; an 8th+1 front trigger fails; a V deck fails in Standard |
| 3 | Zones + `moveCard` + event bus + `checkTiming` | Two AUTOs on the same event prompt for order; the opponent's "when your unit is attacked" fires; a hand/drop AUTO fires |
| 4 | Generic DSL + macros + Manual/judge mode | 20 random D/DZ cards entered without code changes (using Manual where needed) |
| 5 | Standard modules: crest/energy as a card, set orders, overDress, Alchemagic, Arms, Regalis, Divine, tickets, tokens | A full Standard game with set orders and an overDress deck |
| 6 | V Premium: no ride deck, G assist, gifts, Legion | A gift deck gains Force/Accel/Protect with the I/II lock |
| 7 | Premium: stride/heart/G guardian/GB, stand trigger, +5000, LB, lock/delete | A G-era deck strides, G guards, and GB counts correctly |
| 8 | Niche keywords as needed | — |

## 5. Known unknowns (verify before coding)
- Energy Generator exact text and the moment the crest moves (retailer listing only).
- Protect II / Accel II full text (CR 16.3.1.5–16.3.1.6).
- The same-clan trigger requirement wording for Premium Clan Fight.
- The current list of Standard non-D exceptions and G-deck unlock combinations (images on the Deck Construction page).
- Whether Premium Clan Fight allows a D ride deck. The Premium FAQ and the Welcome page say no.
