# Vanguard Table engine gap analysis: Standard (D/DivineZ), V-Premium, Premium

Sources used throughout:
- CR = Cardfight!! Vanguard Comprehensive Rules ver. 4.59 (updated 2026-08-28), linked from the official how-to page: https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf (index: https://en.cf-vanguard.com/howto/). The text was pulled out of the PDF with pdftotext. Section numbers below are CR numbers.
- DCR = Deck Construction Rules: https://en.cf-vanguard.com/howto/fighters_rules/deckrules/
- FR = Fighters' Rules: https://en.cf-vanguard.com/howto/fighters_rules/
- VP = "Welcome to V-Premium & Premium format": https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/
- DS = overDress/D-series system page: https://en.cf-vanguard.com/howto/d-series/
- Local code, read in full: D:/Vanguard/js/engine.js, D:/Vanguard/js/schema.js, D:/Vanguard/js/db.js, D:/Vanguard/js/cards.js, D:/Vanguard/docs/ARCHITECTURE.md, D:/Vanguard/docs/ROADMAP.md

## What does the current engine/DSL support exactly (inventory)?

### Takeaway
The engine covers the core Standard loop: ride deck, call, battle, triggers, guard, damage, energy. It has a small DSL with 5 ability kinds, 14 AUTO events, 16 conditions, 8 costs, 18 effects, 15 targets, and CONT that affects only power and critical. There is no format setting, no check-timing queue, and no zones beyond hand/deck/soul/drop/damage/bind/ride deck. Card stats such as drive, boost and intercept are guessed from grade, not read from the card. Several core loop details differ from CR 4.59. The biggest are a first-turn draw skip, a first-turn attack being allowed, mulligan order, and over triggers going to bind.

### Cited Findings
**Inventory: data model** (db.js, CLAUDE.md)
- Card `{id,name,grade,type: unit|trigger|order, power, shield, crit, trigger: null|crit|front|draw|heal|over, sentinel, persona, nation, race, image, text, abilities[]}`. There are no fields for drive, skill icons (boost/intercept/twin drive), trigger power value, clan, subtype (G / set / blitz / arms / Regalis), gift icon or format icon (D / V).
- Deck `{energy, ride:[4], main:[50]}`. There is no G deck, no crest slot and no format.
- `validateDeck` checks: ride deck of 4 cards graded 0,1,2,3; main deck of 50; exactly 16 triggers in the main deck only; heal ≤4; over ≤1; sentinel ≤4 (main only); ≤4 copies per name across main+ride. It does not check the Standard cap of 8 each for crit/draw/front, nation/clan, Regalis Piece ≤1, or G deck rules.

**Inventory: engine flow** (engine.js)
- Phases: mulligan → ride → main → battle → endTurn. The stand phase is folded into `startTurn` (stand all, then draw). There is no draw-phase or G-assist event, no stride step and no end-phase step processing beyond "endTurn" AUTO and power resets.
- Ride: from the ride deck (discard 1 card; next grade only) or from hand (same grade or +1). Persona Ride requires `card.persona && grade≥3 && same name`. It gives +10000 to the units currently in the front row, draws 1, and sets `personaThisTurn`.
- Call: grade ≤ vanguard, to any RC, replacing (retiring) an occupant. Move: front/back swap in the same column.
- Orders: normal order (1 per turn, main phase), blitz order (while guarding). After resolving, the order goes to drop. There is no set order zone.
- Battle: front row units attack front row targets. Boost is allowed if the back unit has grade ≤1 and is not an order. Guard from hand: any non-order unit, shield summed. Intercept: front RC, grade 2, not the attacked unit. Sentinel is built in as "discard 1 → perfect guard". Drive = 2 if vanguard grade ≥3, else 1, plus `driveBonus`. Damage check, then 6 damage = lose, deck-out = lose.
- Triggers (`TRIG`): crit, front, draw, heal, over, all at +10000 (over +100,000,000). The heal check compares damage counts. The over trigger goes to **bind** and draws 1.
- Energy: if `deck.energy`, +3 at every turn start, capped at 10.

**Inventory: DSL** (schema.js)
- Kinds: AUTO, ACT, CONT, ORDER, BLITZ. Zones: VC, RC, VC/RC, GC, any. Once: turn / game (game = name + index).
- Events (14): placedVC, riddenUpon, placedRC, allyPlacedRC, placedGC, turnStart, mainStart, battleStart, attack, boost, attacked, attackHit, battleEnd, endTurn.
- Conds (16): myTurn, oppTurn, vcName, vcGrade, oppVcGrade, myDamage, oppDamage, rearCount, soul, drop, hand, persona, playedOrder, targetVC, selfFront, selfBack.
- Costs (8): CB, SB, EB, discard, restSelf, retireSelf, selfToSoul, retireRC.
- Effects (18): power, crit, drive, stand, rest, retire, bind, draw, CC, SC, EC, heal, shield, cantBeHit, search (deck/drop/soul → hand/RC/soul), lookTop, callFromHand.
- Targets (15): self, vc, placed, attacker, allFront, allFrontRC, allMyRC, allMyUnits, chooseMy, chooseMyRC, chooseMyFrontRC, chooseMyBackRC, chooseOppRC, chooseOppFrontRC, chooseOppUnit. Filter: gmin, gmax, name contains, ctype.
- How abilities run: `fire()` checks only the cards on one player's circles, or the single card passed for riddenUpon/placedGC. Abilities resolve immediately, in circle order, with a yes/no prompt. There is no standby queue, no choice of order and no non-turn-player AUTO, except `attacked` on the defender. CONT is computed live, only for `power`/`crit`, and only from your own units onto your own units.

**Core-loop differences from CR 4.59 (bugs to fix regardless of format)**
- First-turn draw: CR 9.4.2 says the turn player always draws in the draw step; CR has no exception for the first turn. The engine calls `startTurn(true)`, which skips that draw. — [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- First-turn attack: CR 10.3.2 says that on the first turn of the player going first, no attack can be made. The engine allows `toBattle`/`attack` on turn 1. — [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Mulligan: CR 8.2.1.8 says to put the cards on the **bottom**, draw the same number, *then* shuffle, so a player cannot redraw the cards they returned. The engine shuffles before drawing. — CR
- Over trigger: CR 11.10.2.7 has four sub-abilities: remove the card from the game (removal, not bind), draw 1, +100,000,000 power, and, if it was revealed by a drive check, perform its text. — CR. The D-series page also says it can trigger only "once per fight". — [DS](https://en.cf-vanguard.com/howto/d-series/)
- Trigger power: CR 11.10.5 says the power equals the number printed on the trigger icon (e.g. +10000). Older Premium cards print other values, so this must be a card field. — CR
- Heal: CR 4.13 / 13.6–13.7 put a damage-check card in the **trigger zone** while its trigger resolves, and move it to the damage zone afterward. So the heal comparison ("your damage ≥ opponent's", CR 11.10.2.5) must not count the card being checked. The engine pushes it to damage first. The heal also lets the player *choose* which damage card to heal; the engine pops the last one. — CR
- Persona Ride: CR 6.3.8 says it needs a normal ride **from hand**, the same card name, and **both** cards with the persona icon. CR 7.15.1.4 says front-row units get +10000 *while on front row circles* until end of turn, so units called to the front later also get it. The engine gives a flat bonus to whatever is in the front row at that moment and does not check the old card's icon. — CR
- Intercept / Boost / Drive are **skill icons** on the card (CR 14.3, 14.4, 14.5), not grade rules. Intercept is allowed even while the unit is rested (14.4.2). Only the largest drive ability applies (14.3.2). — CR
- Check timing: CR 11.6.1 resolves rule actions first, then imaginary gifts (turn player, then non-turn player), then the turn player's standby AUTOs (they choose the order), then the non-turn player's, repeating until nothing is left. Rule actions include losing, overloaded circles, illegal guardians, damage application/resolution and excess energy (CR 13.x). — CR
- Mandatory vs optional: the engine asks "Use ability?" for every AUTO. Real cards distinguish "you may" from mandatory text; this needs a flag.

### Inferences
- About half the gaps are structural rather than missing DSL blocks: zones, check timing, card fields, format. Adding effect blocks alone will not make "any card" playable. The order is: fix the core loop, then data model and format, then zones and mechanics, then DSL breadth.

### Gaps
- I did not test the engine at runtime. All findings come from reading the code.

## What is missing per format, ranked by how many real cards need it?

### Takeaway
Standard (D/DZ) needs the least structural work: order zone/set orders, removal zone, crest zone with Energy Generator, Regalis Piece, Divine Skill restriction, overDress/XoverDress, and a broad DSL. Some Standard decks now also use a G deck (Stride). V-Premium adds no ride deck, G assist, imaginary gifts, Twin Drive icons and Legion. Premium adds G zone/Stride/G Guardian/Generation Break, stand triggers, +5000-era trigger icons, Limit Break, lock, and dozens of clan keywords (CR 14.x has 62 keyword sections). The ranking below is by how many cards a missing feature blocks. It is my estimate from the rules structure; I did not count cards.

### Cited Findings: format rules
- **Standard (Nation Fight)**: one nation; cards with the "D" icon; a **5-card ride deck** + 50-card main deck; exactly 16 triggers across main + ride; caps of 1 over, 4 heal, and **8 each** of critical/draw/front; a G deck only with specific listed ride decks; per-card restrictions (0/1/2/choice), some from 2026-05-01. — [DCR](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- The Standard ride deck is G0, G1, G2 and G3 units plus a **ride deck crest** ("Energy Generator" allowed for all nations). Variants: Griphosid makes a 6-card ride deck (Calamity G1–3 + over trigger + crest); Sephirosid, Touken Ranbu (6 cards) and Buddyfight (+1 Buddy Monster) are others. — [FR](https://en.cf-vanguard.com/howto/fighters_rules/)
- Conflict: the older D-series page says main + ride deck total 50, which is different from CR 8.1.4.1 (the main deck alone is exactly 50 non-G cards) and DCR (5 + 50). Follow CR 4.59 / DCR. — [DS](https://en.cf-vanguard.com/howto/d-series/) vs [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- General deck rules (all formats): main deck exactly 50 cards without subtype G; ride deck ≥4 cards; G deck ≤16 cards of subtype G; ≤4 copies of a name across main + ride, and separately ≤4 in the G deck; exactly 16 triggers; ≤4 heal; ≤1 over; ≤4 sentinels (CR 8.1.4–8.1.7, 14.10.2). Regalis Piece: only 1 such card per deck, and resolution limit 1 per game (CR 14.51). — CR
- **V-Premium (Clan Fight)**: one clan; "V" icon cards only; **no ride decks**; Я cards from other clans are allowed but lose their text. — [DCR](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/). Imaginary gifts apply in V-Premium and Premium. — [VP](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/)
- **Premium (Clan Fight / Extreme Fight)**: all cards; clan match (nation cards must match the clan's nation); G deck 0–16 cards of the same clan; Extreme Fight lets you mix clans, makes triggers work without clan match, and has no card restrictions. — [DCR](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/), [FR](https://en.cf-vanguard.com/howto/fighters_rules/). The 8-per-type trigger cap does not apply to V-Premium or Premium; the stand trigger exists in Premium only. — [VP](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/)
- **G assist step** (CR 9.5): only for players **without** a ride deck. If the vanguard is below grade 3 and the hand has no unit one grade higher, reveal the hand, look at the top 5, take up to 1 unit one grade higher, then remove 2 cards from hand (from the game) and shuffle. — CR
- **Stride** (CR 6.5, 6.6, 9.8, 9.11.1): in the stride step, if both vanguards are grade ≥3 or yours was grade ≥3 at turn start, reveal a face-down G unit, pay its stride cost, and put it on VC. The old vanguard becomes a "heart" and the G unit takes its power/name per VP. At the end phase all G units go to the G zone face up. G Guardian (CR 14.16) calls a G unit to GC in the opponent's guard step. Generation Break (CR 14.14) counts face-up G units on VC + G zone. Stride can be enabled by crests such as "Chronojet Dragon" ("You can perform [Stride]…") even in Standard (CR Supplement A1, CR 18.6). — CR, [VP](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/)
- **Imaginary Gift** (CR 16.2–16.3): riding a unit with a gift icon gives a gift. The first gift type choice (I/II) is kept for later gifts, and a later ride with a different clan type does nothing. Force: a marker on a VC/RC; I = +10000 during your turn, II = original critical becomes 2 (stackable). Accel: gain an extra front-row RC (left first, then right); I = that circle's unit gets +10000 during your turn; II = draw (CR 7.6.4.1.1 mentions Accel II drawing). Protect: I = create a "protect" pseudo-card (a blitz-style guard card) in hand; II is a CONT marker (I did not extract the full text). Gifts resolve inside check timing (CR 11.6.1.2–3). — CR
- **Stand trigger** (CR 11.10.2.4): choose a unit; if it is a rear-guard, stand it (it cannot drive check later that turn); plus power. — CR
- **Zones the engine lacks** (CR 4.13–4.19): Trigger Zone; G Zone (face-down stack + face-up pile); Gauge Zone; Order Area (orders while resolving); **Order Zone** (set orders, with stand/rest and face up/down states); Ride Deck Zone (exists); **Crest Zone** (public, crest pseudo-cards). Removal (CR 7.19) is public. — CR
- **Card types** (CR 2.9): main types unit / order / heart / originalDress / crest / ride deck crest / growth factor / impact; subtypes (e.g. G, set, blitz, arms); special types (attached). Pseudo-cards (CR 15.x, Supplement A1): token units (e.g. "Plant" G0 5000 Boost; "Shadow Army" G1 15000 Boost), token set orders, **tickets** ("Quick Shield", "Guardian Shield", "Persona Shield"), markers, crests, and record markers (gift). — CR
- **Keyword actions in CR 7.x** that the engine lacks: lock/unlock (7.30–31; a locked card is face down and standing until end phase, 9.11.3), delete (7.32), time leap (7.33), switch, reveal, remove, increase/decrease, attack-target change (7.38), dominate (7.39), gauge (7.40), Alchemagic (7.44: play order B together with order A, adding B's cost and text), boost (7.47), energy-charge (7.48), choose / cannot be chosen (7.50, Resist 14.15). — CR
- **Field-building keyword actions** (CR 6.x): Legion/D-Legion (6.4: two vanguards, combined power, leader's critical), Stride/heart (6.5–6.6), overDress (6.7: placing a unit on top of an RC unit, which becomes "originalDress"; not a call), XoverDress (6.8), Attach (6.9: a rear-guard attached under the VC, released at end phase), Alchemix (6.10). — CR
- **Keyword abilities in CR 14.x** (62 sections): Intercept, Boost, Restraint (cannot attack), Limit Break, Forerunner (when ridden on by same clan, call it), Lord (cannot attack if you have a unit of another clan), Sentinel, Seek Mate, Stride Skill, Ultimate Stride, Generation Break, Resist, G Guardian, Brave (hand ≤3), Oracle, Rescue, Ritual, Unite, Revelation, Blaze, Dominate, Engorge, Shadowstitch, Thunderstrike, Rush, Burst, Charge, Darkness, Magia, Time Leap, Hollow, Harmony, Wave, Dark Device, Success, Bloom, Melody, White/Black Wings, DressBoost, Powerful, Friend, Glitter, RevolDress, XoverDress, Cannonball, Regalis Piece, DressUp, UnisonDress, Overcharge, Malwyrm, Ace Unit, Rewrite, Mental Pollution, Happy Toys, SweetLink, Arma Arms, and others. — CR section index
- **Restriction icons** (CR 12.3): 1/Turn, 1/Game, and a **Divine Skill** restriction icon (12.3.3). The official site says Divine Skill can be used only once per fight, shared across all your cards. — CR; [About Cardfight!! Vanguard](https://en.cf-vanguard.com/?p=38596)
- **Energy**: CR 3.1.3 says energy has a lower limit of 0 and an upper limit only if an effect sets one; CR 13.13 is the excess-energy rule action. The Energy Generator is a ride deck crest placed when you ride; it gives energy used for abilities. — CR; [About](https://en.cf-vanguard.com/?p=38596)
- **Arms orders** (CR 17.7): if a unit with the named card is on your VC, the arms order goes onto that VC circle instead of the drop zone. — CR
- **End phase** (CR 9.11): G units return to the G zone; unlock / turn face up; music orders to drop; Astral Plane units to the bottom of the deck; attached units detach; "when put into G zone" and end-of-turn AUTOs fire. — CR
- **Battle steps** (CR 10.4–10.8): attack step (the battle begins, "beginning of attack step" AUTO), guard step (play timing: call guardians from hand **without** a vanguard-grade check, intercept, blitz orders), drive step (each drive check goes to the trigger zone, the trigger resolves, then check timing), damage step (compare power; the hit/no-hit AUTOs wait until damage is dealt; if a unit left the field or moved, it does not hit), close step ("end of battle" AUTO, then battle-duration effects end). Illegal guardians are sent to drop (CR 13.4). — CR

### Ranked gap list (priority, formats, estimated card reach)
P0 is needed before *any* real card works correctly. P1 is needed by most Standard decks. P2 covers V-Premium / common Premium. P3 covers niche or old clans.

| # | Gap | Formats | Priority |
|---|---|---|---|
| 1 | Core-loop fixes (turn-1 draw / no turn-1 attack, mulligan, over → removal + text, heal timing, persona per CR) | all | P0 |
| 2 | Card fields: `drive`, `skills[]` (boost/intercept/twinDrive/tripleDrive/sentinel/restraint/resist…), `triggerPower`, `clan`, `subtype`, `icons` (persona/gift/format), `mandatory` per ability | all | P0 |
| 3 | Check-timing queue (standby AUTOs, the turn player orders them, both players' AUTOs, mandatory vs optional) | all | P0 |
| 4 | Opponent-side events (when the opponent's unit attacks/is placed, during the opponent's turn) and AUTO/ACT/CONT from hand, soul, drop, damage, bind, order zone, crest zone, G zone | all | P0 |
| 5 | Removal zone, trigger zone (visible state), order zone + set orders (stand/rest, face up/down), crest zone (Energy Generator), Regalis Piece limit, Divine Skill restriction | Standard | P1 |
| 6 | DSL breadth (see the next question): superior call from deck/drop/soul/damage, superior ride, bind/remove/return to deck, cannot guard / cannot call grade X to GC / cannot intercept, attack-target change, multi-attack, stand units, opponent chooses, "for each X", counting conditions | all | P1 |
| 7 | overDress / XoverDress / originalDress stacks; Alchemagic; Arms orders; tokens and tickets | Standard (D) | P1 |
| 8 | Format selector + per-format deck validation (nation/clan, icon, 8-cap, ride deck variants with crest, G deck ≤16, Regalis Piece ≤1, restricted list as data) | all | P1 |
| 9 | No-ride-deck play: G assist step, ride from hand only | V-Premium, Premium | P2 |
| 10 | Imaginary gifts (Force/Accel/Protect I/II, extra Accel circles, protect pseudo-card) | V-Premium, Premium | P2 |
| 11 | Legion / Seek Mate (two vanguards, combined power) | V-Premium, Premium | P2 |
| 12 | G zone + stride step + heart + G guardian + Generation Break + Ultimate Stride | Premium (+ some Standard via crests) | P2 |
| 13 | Limit Break (damage ≥N), Brave, Lord, Forerunner, Restraint, stand trigger, +5000 icons | Premium | P2 |
| 14 | Lock/unlock, delete, dominate, time leap, gauge, attach, Astral Plane, music orders, clan-specific keywords | Premium (old clans), some Standard collabs | P3 |

### Inferences
- The engine's current `trigger()` hard-codes +10000. Using `card.triggerPower` (default 10000) lets old +5000 cards work without new code.
- Most keyword abilities in CR 14 are named shortcuts for a condition (Limit Break = damage ≥N, Brave = hand ≤3, Generation Break = face-up G ≥N) or a canned AUTO (Forerunner). They can be editor "macros" that expand into existing DSL rows, which is much cheaper than engine code.

### Gaps
- I could not extract the full Energy Generator crest text from CR 4.59 (it is not in Supplement A1). The engine's "+3 per turn, cap 10" is unverified against current card text. The Protect II and Accel II full texts were also not extracted.
- I found no official card counts per mechanic, so the ranking is an estimate.
- I did not look at DivineZ-era mechanics beyond Divine Skill and Energy. Any 2026 keywords appear only as CR section names.

## What concrete schema/engine/editor additions would let the user enter any card themselves?

### Takeaway
Do it in five layers, all plain JS with a DOM-free engine. (1) Extend the card/deck model with every printed field. (2) Add a format profile object that drives validation and turn flow. (3) Replace inline `fire()` with an event bus plus standby queue and generic zones. (4) Widen the DSL with generic, parameterised blocks (move-card, superior call, restrict, choose-by-opponent) instead of one block per card. (5) Add an editor "raw JSON / script" escape hatch for anything the blocks cannot express. With these, the user can enter any card without code changes in most cases.

### Cited Findings (rules that drive the design)
- Ability categories are ACT, AUTO, CONT, order and trigger (CR 11.1). ACT is written as zone + condition + [cost] + effect (CR 11.1.1.1.1). Costs are paid all at once, or the play is cancelled (CR 11.8.2.2). — CR
- Normal vs superior call/ride (CR 6.2.2, 6.3.2): effects that call or ride are "superior". Deck-construction CONT abilities apply as replacement effects before the game (CR 8.1.3). — CR
- Continuous effects and replacement effects have their own application order (CR 11.11, 11.12). — CR

### Plan: 1. Data model (db.js, editor card form)
```js
Card += {
  clan, nation[], race[], formatIcons: ["D","V"],   // validation
  subtype: "" | "G" | "set" | "blitz" | "arms" | "regalis" | "music" | ...,
  drive: null,            // null = derive from skills (twinDrive etc.)
  skills: ["boost","intercept","twinDrive","tripleDrive","sentinel","restraint","resist","lord","forerunner"],
  triggerPower: 10000,    // CR 11.10.5; 5000 for older cards
  trigger: null|crit|front|draw|heal|over|stand,
  overText: [effects],    // over trigger extra (drive check only, CR 11.10.2.7)
  giftIcon: null|"force"|"accel"|"protect", persona: bool,
  strideCost: [costs], gGuardian: {costs:[], shield}, // G units
  isToken: bool, isTicket: bool, isCrest: bool,
}
Ability += { mandatory: bool, restriction: ""|"turn"|"game"|"divine"|"regalis",
             keyword: "LB"|"GB"|"Brave"|..., keywordN: 4 }
Deck += { format: "standard"|"vpremium"|"premium"|"extreme", crest: cardId|null,
          gdeck: [≤16 ids], tokens: [ids] /* tickets, markers available */ }
```
- Make `inst()` copy the new fields. Keep old cards working by defaulting: `skills` derived from grade (G0–1 boost, G2 intercept, G3 twinDrive) when missing, `triggerPower` = 10000.

### Plan: 2. Format profiles (new js/formats.js, DOM-free, shared by db.js and engine.js)
```js
FORMATS.standard = { rideDeck: true, crest: true, giftsOn: false, strideOn: "byCard",
  gAssist: false, trigCaps: {over:1, heal:4, crit:8, draw:8, front:8}, trigTotal:16,
  sentinelMax:4, copies:4, poolKey:"nation", icon:"D", energy:true, standTrigger:false }
FORMATS.vpremium = { rideDeck:false, giftsOn:true, gAssist:true, icon:"V", poolKey:"clan", trigCaps:{over:1, heal:4}, ... }
FORMATS.premium  = { rideDeck:false, giftsOn:true, gAssist:true, strideOn:true, gdeckMax:16, standTrigger:true, poolKey:"clan", ... }
```
- `validateDeck(deck, byId, format)` reads the profile. The restricted list is editable data (`{name, max}` per format), so the user can update it when the Fighters' Rules change. Ride-deck variants (Griphosid etc.) can be a "ride deck regulation" override on the G0 card: `rideDeckRule: {size, slots:[...]}`.
- Add a format dropdown in the deck builder and game setup.

### Plan: 3. Engine core (engine.js; keep it DOM-free)
- **Zones**: add `removal, trigger, orderZone, crest, gzone{down:[], up:[]}, markers[]` and `extraRC[]` (Accel) per player. Write a generic `moveCard(pi, card, fromZone, toZone, opts)` that every effect uses. It fires `leave:<zone>` and `enter:<zone>` events (put into soul / drop / bind / damage, retired, bound, removed).
- **Check timing**: `emit(event, ctx)` collects matching AUTOs from **both** players and **all** zones (each ability's `zone` now includes hand/soul/drop/damage/bind/orderZone/crest/gzone) into `S.standby`. `checkTiming()` runs rule actions (6 damage, deck-out, illegal guardian, excess energy, overloaded circle), then gifts, then the turn player's standby (they choose the order if there are several), then the non-turn player's, and loops. Call it at every CR check point: stand, draw, ride step, stride step, start of main, each battle step, end phase.
- **Phases**: explicit `stand → draw (+gAssist) → ride → stride → main → battle(attack/guard/drive/damage/close) → end`, with events for each "at the beginning of …" (CR 9.x / 10.x). Turn 1: draw normally, no battle for the first player.
- **Triggers**: data-driven table `TRIG[t].subs` with `triggerPower` from the card; add stand; over → removal, plus `overText` only from a drive check; heal while the card sits in the trigger zone, with a choice of which damage card.
- **Battle**: `attack` supports multi-target (Legion and "attack all"), `changeTarget`, drive count from skills + effects, "cannot be hit", "cannot guard with grade ≥N", "must guard with 2+ cards", per-battle restrictions stored in `S.battle.restrict`. Guard has no vanguard-grade check (CR 10.5.1.2.2.2).
- **CONT**: generalise `cont()` into `stat(pi, key, statName)` covering power, crit, drive, shield, grade, name, plus flags (canAttack, canBoost, canIntercept, cannotBeChosen/resist, cannotBeCalled). Allow `side: "opp"` targets for CONT that weakens the opponent's units.
- **Restriction icons**: `once: "divine"` uses a per-player `S.divineUsed[pi]` across all cards. `"regalis"` uses a per-player counter with a limit of 1 (CR 14.51.2.2).
- **Persona Ride**: per CR 6.3.8 / 7.15.1.4, store a turn-long CONT "front row +10000" instead of one-shot pow.
- **Mechanic modules** (each a small file, loaded only if the format or deck needs it): `gifts.js` (Force/Accel/Protect), `stride.js` (G zone, heart, G guardian, end-phase return), `legion.js`, `dress.js` (overDress/XoverDress/originalDress stack under RC), `orders.js` (set orders, order zone, Alchemagic, Arms). Each registers its events/effects into SCHEMA and engine hooks, so engine.js stays readable.
- **Opponent choices**: `choose()` already takes a player index. New effect param `chooser: "self"|"opp"`.

### Plan: 4. DSL additions (schema.js + engine handlers)
- **Events** (add): `riddenUponBy` (with filter), `rideFromRideDeck`, `personaRide`, `putIntoSoul`, `putIntoDrop`, `putIntoDamage`, `retired` (self/other, by opponent's effect), `bound`, `removed`, `discarded`, `drawn`, `drive/damageCheckTrigger` (with trigger type), `oppAttacks`, `oppUnitAttacked`, `attackNotHit`, `guardianCalled`, `intercepted`, `orderPlayed` (blitz/normal/set), `setOrderPlaced`, `CB/SBpaid`, `energyCharged`, `stride`, `strideStep`, `gAssistStep`, `drawPhase`, `endPhase`, `beginStandPhase/standUp`, `giftGained`, `overDressed`, `locked/unlocked`, `turnedFaceUp`, `putIntoGZone`, and generic `beginStep:<step>`. Each event carries `ctx` (the card that caused it, the source zone, who controls it).
- **Conds** (add): `damage ≤ / =` comparisons (generic `count {zone, who, op, n, filter}` replaces soul/drop/hand/damage/rearCount); `limitBreak N`, `genBreak N`, `brave`; `vcHasName/grade/clan`; `oppTurn` in battle; `attackingUnit is …`; `boosted`; `thisRide was from ride deck / hand`; `persona this turn`; `energy ≥ N`; `orderZone has card named`; `crest is …`; `firstOrSecond`; `cardsPutIntoSoulThisTurn ≥ N` (needs per-turn counters `S.turnStats`); `unitsWithFilter count`; `divine skill unused`.
- **Costs** (add): `CBchoose` (pick which face-up damage cards), `EB`, `discardFilter`, `retireUnits{filter, n}`, `soulBlastFilter`, `putFromHandIntoSoul`, `bindFromHand/drop`, `putIntoOrderZone`, `restUnits{filter,n}`, `restSetOrder`, `flipGUnitFaceUp` (stride/GB costs), `lockOwn`, `returnToDeck`, `revealFromHand`, `payEnergy`.
- **Effects** (add): a generic `moveCards {from: deck|top|drop|soul|damage|bind|hand|removal|gzone|orderZone, to: hand|RC|VC(ride)|soul|drop|bind|removal|deckTop|deckBottom|damage(face up/down)|orderZone, n, filter, reveal, who: self|opp, chooser}`. This covers superior call/ride, return to hand/deck, put into damage, and bind from anywhere. Then: `superiorCall {from, to: specific circle|anyRC, standOrRest}`, `superiorRide {from, filter}`, `stand/rest {filter, n}`, `lock/unlock`, `restrict {who, what: guardGrade≥N|callToGC|intercept|blitz|attack|boost|beHit|beChosen|ride, dur}`, `perfectGuard/cantBeHit`, `changeTarget`, `additionalAttack`/`attackAgain` (stand + "can attack again"), `extraDrive`, `damage N` (deal damage), `heal choose`, `counterCharge/soulCharge/energyCharge`, `energyMaxSet`, `createToken {name}`, `giveTicket {name}`, `giveGift {type}`, `stride {from G zone}`, `legion`, `overDress`, `alchemagic`, `setOrder`, `revealTop/checkTop + conditional`, `shuffle`, `chooseOne [options]` (modal effects), `forEach {count, effect}`, `ifThen {cond, effects, else}`, `oppChooses {what}`, `grantAbility {target, ability, dur}` (needed for "gets 'AUTO: …'" text), `setStat {power/crit/grade/name}`, `cannotBeChosen` / `resist`. Effects need a `ref` slot so later rows can refer to "that unit" or "the card put into hand" (`ctx.last`).
- **Targets**: add `oppVC`, `attacked`, `booster`, `boostedUnit`, `sameColumn`, `drivenUnit`, `that` (the previous effect's result), `allOppRC`, `allOppFront`, plus filters for clan/nation/race/trigger type/power ≥, rest/stand, front/back, and `name exact` vs `contains`.
- **Macros** (editor only): keywords like Limit Break 4, Generation Break 2, Brave, Forerunner, Lord, Restraint, Resist, Sentinel and Persona Ride expand to the rows above, so the user picks one item.

### Plan: 5. Editor/UI
- Card form: new fields (drive/skills chips, trigger power, subtype, clan, gift icon, format icons, G-unit stride cost / G guardian). A "Mandatory" toggle and restriction picker (1/Turn, 1/Game, Divine Skill, Regalis Piece) per ability. A keyword-macro dropdown.
- Ability block list grouped as Events / Conditions / Costs / Effects, with nested `ifThen`/`chooseOne`/`forEach` blocks shown as indented sub-lists. A **"Raw JSON" tab** for each ability, validated against SCHEMA, as the escape hatch. A **"Manual effect"** block (`type: "manual", note`) that pauses the game, shows the card text, and opens a free-move "judge mode" so both players can carry out unsupported text by hand (move any card between any zones, change power/crit, stand/rest).
- Game UI: zone viewers for removal, order zone, crest, G zone (face-down count + face-up list), gift markers on circles, extra Accel circles in MAT_LAYOUT, a heart card under the stridden VC, an originalDress stack count, locked (face-down) slots, a trigger zone display during checks, an AUTO ordering prompt when several are standby, and a format badge.
- `describeAbility` must cover every new block so the log stays readable. textparse.js should emit the new blocks for common phrases (ROADMAP task 2).

### Inferences
- The "manual effect + judge mode" escape hatch matters most for "the user can enter ANY card". With 62 keyword sections plus collab-specific rules (CR 17.x), some cards will never fit the DSL cleanly. A free-move fallback keeps those cards playable in hot-seat.
- Suggested build order: core-loop fixes → card fields + format profiles + validation → zones + moveCard + check-timing queue → DSL generic blocks + macros → Standard modules (set orders, crest/energy, overDress, Regalis/Divine) → V-Premium (no ride deck, G assist, gifts, Legion) → Premium (stride, GB, stand trigger, lock) → niche keywords.
- Online play (net.js) sends full state snapshots. New zones must be added to `snapshot()` hiding: the face-down G zone, face-down order zone cards and the opponent's hand-side tickets are hidden info.

### Gaps
- The exact text of Energy Generator, the Protect II marker and the newest 2026 keywords (CR 4.59 adds a new Fighter Icon and changed Restraint) was not checked line by line. Re-read CR 4.59 sections 3.1.3, 12.3.3, 14.6 and 16.3.1.6 before coding those modules.
- I did not use cardfight.fandom.com; all mechanic claims come from official CR/site pages.
