# One rulebook runs fifteen years of Vanguard

A fan-made Cardfight!! Vanguard simulator can be built on a single rule source. The current **Comprehensive Rules ver. 4.59 (28 Aug 2026)** still defines every mechanic from 2011 to today: Limit Break, Legion, Stride and G zone, imaginary gifts, ride deck, Persona Ride, over trigger, set orders, overDress, Alchemagic, Arms, Regalis Piece, Energy and Divine Skill. What changes between the three official formats is mostly **deck construction**, not the turn structure ([CR 4.59](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)). **Standard (Nation Fight)** uses D-icon cards with a 5-card ride deck (G0–G3 plus a crest), a separate 50-card main deck and energy. **V Premium** uses V-icon cards, one clan, no ride deck, G assist and imaginary gifts. **Premium** allows every card, with G decks, stand triggers and +5000 icons, and has an anything-goes **Extreme Fight** sub-format ([Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)). Vanguard Table's engine already plays a recognisable Standard game. Several core-loop details contradict the CR, however, and in every format: the first player skips the turn-1 draw yet may attack, the mulligan shuffles before redrawing, over triggers go to bind, heal compares damage at the wrong moment, and drive/boost/intercept are inferred from grade. More importantly, the engine has no check-timing queue, no abilities outside the circles and no format concept. Adding more effect blocks will not let the user "enter any card" until those structural layers exist. The detailed per-format material is split into `docs/rules/01`–`08`.

## Five card eras collapsed into three formats

The card game has run through five design eras:
- **Original** (Mar 2011–2014; BT/EB/TD codes): clans, +5000 triggers, the stand trigger, Limit Break, Break Ride, Lock and Legion ([About](https://en.cf-vanguard.com/?p=38596)).
- **G** (G-BT01 on **5 Dec 2014 JP / 13 Mar 2015 EN**): the G zone, Stride and Generation Break, then G guardians, Time Leap, Delete and Ultimate Stride ([G-BT01](https://en.cf-vanguard.com/products/gbt01/)).
- **V reboot** (rule change effective **1 Jun 2018**): +10000 triggers, the Front trigger, imaginary gifts, the bottom-then-shuffle mulligan and a simplified G assist ([V System](https://en.cf-vanguard.com/howto/v-series/)).
- **D series** (format change **14 May 2021**): clans became six nations, and the era brought the ride deck, Persona Ride, the over trigger, overDress, set orders, Alchemagic and crests ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)). Regalis Piece followed in D-BT08.
- **DivineZ** (DZ-BT01, mid-2024): officially "the next stage of the Standard format", adding Energy via the Energy Generator crest and the once-per-fight Divine Skill ([DZ-BT01 guide](https://en.cf-vanguard.com/?p=59857)).

Because DivineZ continues D rather than replacing it, **D and DZ share one Standard pool**. D-BT02 cards still appear on the restriction list effective **1 May 2026** ([Apr 2026 update](https://en.cf-vanguard.com/information/regarding-the-april-2026-deck-construction-rules-update/)). The final DivineZ anime arc aired in Nov 2026. A new series, "Veil Lift", was announced on 28 Oct 2026 for 2027, with no card-game changes disclosed yet ([ANN](https://www.animenewsnetwork.com/news/2026-10-28/cardfight-vanguard-announces-new-veil-lift-anime-2nd-season-of-ghost-meets-gal-mini-anime/.243287)).

The official nation mapping is Keter Sanctuary (from United Sanctuary), Dragon Empire, Brandt Gate (Star Gate), Dark States (Dark Zone), Stoicheia (Zoo and Magallanica merged) and Lyrical Monasterio (Bermuda Triangle) ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)). No official clan-by-clan table was found. The Premium FAQ confirms only examples, such as Dragon Empire covering Kagero, Nubatama, Tachikaze, Murakumo and Narukami ([Premium FAQ](https://en.cf-vanguard.com/howto/vgd_premium_faq/)).

The base deck rules shared by all formats are fixed in CR §8.1: an exactly 50-card main deck with no G units, ≤4 copies per name across main and ride deck, **exactly 16 triggers** with ≤4 heal and ≤1 over, ≤4 sentinels, ≤1 Regalis Piece, and a G deck of ≤16 ([CR 4.59](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)). Each format then layers its own rules on top:

| | Standard (Nation Fight) | V Premium (Clan Fight) | Premium Clan Fight | Premium Extreme Fight |
|---|---|---|---|---|
| Pool | D icon (D + DZ sets) + listed exceptions | V icon | all EN cards | all EN cards |
| Identity | one nation | one clan (Я and BanG Dream! exceptions) | one clan; D cards must match the clan's nation | none |
| Ride deck | **5: G0–G3 + crest** (Energy Generator for any nation); special variants (Griphosid 6, etc.) | none | none | none |
| Trigger caps | 16; over 1, heal 4, **crit/draw/front 8 each** | 16; heal 4 | 16; heal 4, over 1 (choice-restricted); stand allowed | same, triggers need no clan match |
| G deck | only for listed ride decks or crests | none | 0–16 of the clan | ≤16 |
| G assist | no | yes | yes | yes |
| Gifts | – | yes | yes | not acquirable |
| Restriction list | yes | yes | yes | **ignored** |

Sources: [Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/), [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/), [Welcome to V-Premium & Premium](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/), [Imaginary Gift FAQ](https://en.cf-vanguard.com/howto/imaginary-gift-faq/).

Restriction lists in all three formats use the same categories: Restricted (banned), Restricted to 1 or 2, Restricted as first vanguard, and Choice Restriction. A simulator should store them as editable data.

**The ride deck has changed size twice.** At D launch, four units were counted *inside* the 50. From **19 Jan 2024** the main deck became a full 50 on its own ([cmd-sg (secondary)](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)). The current Fighter's Rules require a fifth ride-deck card, the crest. The CR itself says only "four or more per the regulations", and the date the crest became mandatory was not found. The current answer is **5 + 50**.

## The turn is a fixed step list with check timings between every step

The CR turn runs as follows:
- **Stand → Draw** (draw step, then the G assist step, which is skipped by anyone with a ride deck).
- **Ride** (ride step, then stride step) → **Main**.
- **Battle**, as repeated attack sub-phases: start → attack → guard → drive → damage → close.
- **End** ([CR 9–10](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)).

Setup:
- Each player places a face-down G0 from the ride deck (or from the main deck without one) as the first vanguard.
- A random player **chooses** who goes first. This is EN practice since Jan 2024; before that the random winner simply went first.
- Each player draws 5. The mulligan puts cards on the **bottom**, then draws, then shuffles.

Several turn-flow details matter for an engine:
- **Both players draw every turn, including the first player's first turn.** That player simply cannot attack (CR 9.4.2, 10.3.2).
- A rules ride from the ride deck must be **exactly +1 grade** and **costs a hand discard**. A ride from hand may be the same grade or +1. Only one normal ride is allowed per turn (CR 6.3.3.2.2, 9.7.2).
- Main-phase calls need grade ≤ the vanguard's grade, and calling onto an occupied circle retires the old unit. The **order limit of one per turn is shared with blitz orders** played while guarding (CR 9.9.2.3, 10.5.1.2.5).
- An attacked unit is **hit when its power is ≤ the attacker's**, so ties hit.
- The **drive value is never printed**. It is 1, raised to 2 by the Twin Drive!! icon and 3 by Triple Drive!!!, and only the largest applies (CR 2.17, 14.3).
- At the end of a battle, G guardians retire first, then guardians, then hit rear-guards.

The heart of the engine is **check timing** (CR 11.6.1), a loop:
1. Resolve all rule actions at once.
2. Resolve imaginary gifts: the turn player's, then the non-turn player's.
3. Resolve the turn player's standby AUTO abilities **one at a time in an order they choose**, then the non-turn player's.
4. After each resolution, restart from rule actions.

Standby AUTOs are **mandatory** unless their text says "you may". Their costs are paid at resolution, all or nothing (CR 11.9.4–11.9.5). Rule actions handle the following (CR 13):
- the three losses: **6+ damage, an empty deck, or no vanguard and no soul**;
- overloaded circles and illegal guardians;
- excess energy;
- **damage itself**. "Deal damage" only adds to a pending counter. Each damage check then runs one card at a time inside the loop, and the checked card waits in the trigger zone while its trigger resolves.

That ordering is what lets a heal on the sixth check save the player. It also means the heal comparison ("your damage ≥ the opponent's") does not count the card being checked.

Trigger power is **the number printed under the icon** (CR 11.10.5): +5000 on pre-V cards, +10000 on V/D cards. The trigger types are:

| Trigger | Effect |
|---|---|
| Critical | +1 critical to one unit; power to one unit |
| Draw | draw 1; power to one unit |
| Heal | if your damage ≥ the opponent's, heal a damage card **of your choice**; power to one unit |
| Front | power to every front-row unit |
| Stand (Premium) | stand a rear-guard, which can then no longer drive check; power to one unit |
| Over | **remove from the game**, draw 1, **+100,000,000** to one unit, and its printed bonus text only on a drive check |

Over triggers revealed in a damage check are removed rather than placed into damage ([D-series](https://en.cf-vanguard.com/howto/d-series/)). A sentinel's "cannot be hit" still stops a +100M attack.

Costs are paid simultaneously. They include Counter-Blast (turn face-up damage down), Soul-Blast (soul to drop), **Energy-Blast** (not payable with fewer than N), discards, rests, retires and binds. Matching gains are Counter-Charge, Soul-Charge and Energy-Charge, the last capped at the maximum.

## Era mechanics reduce to a few engine primitives

Most mechanics are less exotic than their names suggest. **Limit Break N**, **Generation Break N**, Brave, Oracle, Thunderstrike and similar keywords are just **condition keywords**: damage ≥ N, face-up G cards ≥ N, hand ≤ 3, and so on (CR 14.2, 14.7, 14.14). An editor macro can expand each into existing condition rows. **Break Ride**, Persona Blast, Crossride, Megablast and Reverse have no rule section at all. They are card-text patterns, and their historical numbers are unverified because the fan wiki returned HTTP 402.

Only a handful of mechanics need real engine state:

**Stride** (CR 6.5–6.6, 9.8). In the stride step, if both vanguards are G3+ or yours was G3+ at the start of your turn:
1. Reveal a face-down grade-4 **G unit** from the G zone and pay its stride cost (by default, discard cards totalling grade 3).
2. Put it on the VC. This is **not a ride**.
3. The old vanguard becomes a **heart**. A heart is no longer a unit, but the G unit takes its name and adds its power.
4. In the end phase the G unit goes **face up** to the G zone and the heart returns.

That face-up count drives **Generation Break**. **G guardians** add a defender's option: if both vanguards are G3+ and no more than 3 face-up G guardians are in the G zone, a defender may call one to the GC (CR 10.5.1.2.3, 14.16). In Standard, stride exists only through specific crests such as **Chronojet Dragon** or listed ride-deck combinations, which since 6 Sep 2024 must be G0+G1+G2+G3 ([Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)).

**Legion** (CR 6.4) puts two vanguards side by side:
- Only the leader can be attacked.
- The two rest and stand together, and their power is combined.
- **The leader's drive and critical** are used.
- Seek Mate returns four drop cards to the deck.

**Imaginary gifts** (CR 16) resolve inside check timing whenever you ride a gift-icon unit:
- **Force**: a stacking circle marker, giving +10000 on your turn (I) or original critical 2 (II).
- **Accel**: an extra front-row circle, giving +10000 (I) or a draw plus +5000 (II).
- **Protect**: a sentinel pseudo-card in hand (I) or an intercept shield marker (II).
- The first I/II choice is **locked for the game**, and only one gift type per player can come from rides.

**Persona Ride** is a frequent source of confusion. The 2021 presentation described +10000 for front-row rear-guards called *afterwards* ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)). CR 4.59 instead defines it as a **positional status for the turn**: every unit on a front-row circle gets +10000, including the vanguard and units moved there later, and units leaving the front row lose it. The CR also requires a **normal ride from hand** onto a same-name vanguard where **both** cards carry the icon (CR 6.3.8, 7.15.1.4). The current CR wins.

The D/DZ toolkit adds these:
- **overDress**: not a call. The old rear-guard becomes the originalDress under the new card.
- **XoverDress**: several rear-guards merge under one card.
- **Set orders**: they persist in a public **order zone** with stand/rest and face states.
- **Alchemagic**: a played order absorbs a second order's costs and text from the drop zone.
- **Arms**: orders attach to a same-name vanguard.
- **Crests**: they live in a crest zone, and their abilities work only there.
- **Regalis Piece**: ≤1 per deck and resolvable once per game.
- **Divine/Unique Skill**: once one is used, no ability with that icon on any of your cards can be used again (CR 6.7–6.8, 7.44, 12.3.3, 14.51, 17.7).

**Energy** is a per-player number, usable only with the Energy Generator in your crest zone and **capped at 10** ([Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)). The Generator's exact text was not found in an official source. A retail listing gives:
- Energy-Charge 3 at the start of each of your ride phases;
- an extra 3 if you went second;
- an ACT [1/Turn] Energy-Blast 7: draw 1 ([listing](https://admintcg.tcgsync.com/products/energy-generator-dz-ss10-005en-dz-ss10-shiki-otei-start-deck)).

Treat that text as unverified until checked against the card.

On the card side, the CR lists 16 printed fields plus the hidden drive value. **Type has three layers**: main type (unit, order, crest, ride deck crest…), subtype (trigger, G, blitz, set, arms…) and special type (ticket). **Pseudo-cards** carry only partial fields and are erased outside their valid zones: tokens (e.g. Plant G0 5000 Boost), tickets (Persona Shield, Quick Shield), crests and gift markers (CR 2.9, 15). Ability templates follow a fixed shape: `KIND zone [restriction]: (condition) [cost] effect`. The CR defines 62 keyword sections in total.

## Vanguard Table plays Standard's skeleton but not its rules

The current engine (`js/engine.js`, `js/schema.js`, `js/db.js`) covers:
- the ride deck with its discard, calls and swaps;
- one normal order per turn;
- attack/boost/guard/intercept, with a built-in sentinel;
- drive and damage checks; crit/front/draw/heal/over triggers; energy;
- a DSL of **14 events, 16 conditions, 8 costs, 18 effects and 15 targets**.

Reading the code against CR 4.59 shows errors that affect **every format**:

| Bug | Code | Rule |
|---|---|---|
| First player skips the turn-1 draw | `startTurn(true)` after mulligan | 9.4.2 |
| First player can attack on turn 1 | `toBattle` has no check | 10.3.2 |
| Player 0 always goes first; no first/second choice | setup | 8.2.1.6 |
| Mulligan returns cards, shuffles, then draws | `mulligan()` | 8.2.1.8 |
| Over trigger goes to **bind**; no drive-check text | `confirmGuard` | 11.10.2.7 |
| Damage card enters the damage zone before its trigger, so heal miscounts and cannot choose | `confirmGuard`, `trigger()` | 13.6–13.7, 11.10.2.5 |
| Trigger power hard-coded at 10000 | `trigger()` | 11.10.5 |
| Drive = 2 if G3; boost if grade ≤1; intercept if grade 2 | `confirmGuard`, `boosterFor`, `intercept` | 2.17, 14.3–14.5 |
| Persona Ride needs grade ≥3, ignores ride source and old card's icon, one-shot buff | `doRide` | 6.3.8, 7.15.1.4 |
| Order grade not checked; blitz outside the order limit | `playOrder` | 9.9.2.3, 10.5.1.2.5 |
| Energy +3 every turn start, including turn 1, with no going-second bonus | `startTurn` | Generator text (unverified) |
| AUTOs fire immediately, all optional, only the active player's circles | `fire()` | 11.6.1, 11.9.4 |
| Trigger/sentinel counts ignore the ride deck; no 8-caps, nation, Regalis checks | `validateDeck` | 8.1.6–8.1.8 |

Beyond these bugs, the gaps are mostly **structural**:
- The card model lacks drive, skill icons, trigger power, clan, subtype, gift and format icons.
- The deck model lacks a crest slot, a G deck and a format.
- The engine lacks zones for removal, the trigger zone, the order zone, the crest zone and the G zone.
- Nothing fires from hand, soul, drop or damage, and opponent-side events never fire.
- CONT cannot touch the opponent's units.

The priority order follows from the rules:

| Priority | Formats | Work |
|---|---|---|
| **P0** | all | Fix the bugs above. Add the missing card fields. Build a both-player standby queue with owner-chosen order. Let abilities work from every zone |
| **P1** | Standard | Order zone and set orders. Crest zone with the Energy Generator as a real card. Regalis and Divine limits. overDress, Alchemagic, Arms, tickets and tokens. Generic DSL blocks. Format profiles with per-format validation |
| **P2** | V Premium, Premium | No-ride-deck play with G assist. Imaginary gifts. Legion. G zone, Stride, G guardian and Generation Break. Stand trigger, +5000 icons, Limit Break-style macros |
| **P3** | Premium (old clans) | Lock, delete, time leap, gauge, attach, worlds and clan keywords |

**The concrete plan has five layers.**

1. **Extend the data.** Cards get `skills[]`, `triggerPower`, `subtype`, `clans/nations/races[]`, `aliases[]`, `giftIcon`, `formatIcons`, G-unit costs, `overText` and `rideDeckRule`. Abilities get `mandatory` and a `restriction` of divine/unique/regalis. Decks get `format`, `crest` and `gdeck`. Old cards migrate by deriving skills from grade.
2. **Add `js/formats.js`.** It holds one profile per format (ride deck, crest/energy, G assist, gifts, stride, stand trigger, same-clan trigger, identity, pool icon, trigger caps) plus restriction lists as editable data. `validateDeck` reads them.
3. **Rebuild the engine core.** One `moveCard()` emits leave, enter and semantic events, and handles redirects (ride-deck card → ride deck face up, G unit → G zone, pseudo-cards erased). An event bus scans both players and all zones into a standby queue. `checkTiming()` runs the CR loop, with damage applied through rule actions. Phases and battle steps become explicit, each emitting `begin:` events. Triggers become a data table. A layered `stat()` function handles power, crit, drive, shield and flags. Optional mechanic modules cover orders, dress, gifts, legion, stride and lock.
4. **Widen the DSL with generic blocks** rather than per-card ones. Examples are `moveCards{from,to,n,filter,who,chooser}`, `restrict{who,what,dur}`, `ifThen`, `chooseOne`, `forEach`, `oppChooses` and `grantAbility`, plus count-based conditions and keyword macros.
5. **Add escape hatches in the editor.** A per-ability **Raw JSON** tab, and a **Manual effect** block that pauses the game, shows the card text and opens a **judge mode** where either player can move any card or adjust any value.

The full field lists, the block catalogue and a step-by-step build order with acceptance tests are in `docs/rules/08-engine-gaps-and-plan.md`.

## Conclusion

The research changes where the effort should go. The tempting path is to add one schema block per unfamiliar card, but most cards that fail today will fail because of the **missing check-timing queue, missing zones and wrong core-loop details**, not because a verb is missing. Fixing the dozen CR mismatches and adding a format profile turns the existing engine into a correct Standard engine. After that, V Premium and Premium are additive modules (G assist, gifts, Legion, Stride), because the CR keeps every old mechanic alive under one rulebook.

The second insight is that "enter any card" cannot rely on the DSL alone. With 62 keyword sections, collab-specific ride decks and crest-driven rule changes, some text will always outrun the block library. A **judge-mode fallback** is what makes the promise honest in a hot-seat game: the engine automates what it can, and the players resolve the rest by hand. Four facts should be confirmed against official material before coding: the Energy Generator's printed text, the Protect II and Accel II wording, Premium's same-clan trigger clause, and the image-only Standard exception and G-deck unlock lists.
