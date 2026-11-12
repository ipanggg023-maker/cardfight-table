# Cardfight!! Vanguard: game flow and battle (rules-engine notes)

Main source: **Comprehensive Rules ver. 4.59, last updated 2026-08-28** (EN, 67 pages), linked from the official rules page https://en.cf-vanguard.com/howto/ . PDF: https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf (cited below as **[CR]** with rule numbers). Older 4.57 (2026-06-26) URL in search results now 404s. A Japanese rules PDF dated 2026-08-06 also exists: https://cf-vanguard.com/wordpress/wp-content/uploads/2026/08/06153545/vgd_rule_20260806.pdf (not read). The 4.59 changelog only lists small changes (new Fighter Icon, Restraint wording, order zone storage counting, Dominate wording) [CR changelog]. The cardfight.fandom.com wiki returned HTTP 402 to automated fetch, so it was not used.

Everything below is paraphrased. One rulebook covers all formats. Format differences mostly come from deck construction (which cards and decks are legal), not from different turn rules.

## Exact steps of each phase and battle step

### Takeaway
A turn runs Stand → Draw (Draw step, G Assist step) → Ride (Ride step, Stride step) → Main → Battle (repeated Attack Sub-Phases: Start → Attack → Guard → Drive → Damage → Close) → End. There is a check timing at almost every sub-step. The player going first cannot attack on their first turn. There is no draw skip.

### Cited Findings

**Zones** [CR 4.x]
- Deck (4.5): hidden, order matters. When several cards leave it at once, they move one at a time. Hand (4.6): hidden from the opponent, order doesn't matter. Drop (4.7): public, order doesn't matter.
- Field (4.8) has 7 circles (4.9.1): front left/centre/right, back left/centre/right, and "center far front" (the guardian circle).
  - Columns are left, centre and right. Your left column is the same column as the opponent's right column (4.9.1.2).
  - The front-centre circle is the Vanguard circle and the far-front circle is the Guardian circle. All the others are Rear-guard circles (4.9.2.3–4.9.2.5).
  - VC and RC hold 1 card each. GC can hold many cards (4.9.4).
  - Cards placed on GC enter in the rest state, unless stated otherwise (4.9.2.4.1). A card put on VC by anything other than stride enters standing (4.9.2.3.1). A unit moving between rear-guard circles keeps its orientation (4.9.2.5.1).
  - Other circle types: Lock, Astral Plane, Stage (4.9.2).
- Soul (4.10): cards stacked under the vanguard. Public and **not part of the field**.
- Damage zone (4.11): public. Cards turned face down stay public and have no card information. Having 6 or more cards here is a loss (4.11.4).
- Bind zone (4.12): public. Face-down bound cards can only be seen by their owner. Bound cards are kept in separate piles per effect that bound them.
- Trigger zone (4.13): public and ordered, new cards go on top. Drive-checked cards go to hand afterwards (4.13.1.1). Damage-checked cards go to the damage zone (4.13.1.2).
- G zone (4.14): starts as the face-down G deck. Its owner can look at it. Face-up cards are kept as a separate public stack. A card entering it from elsewhere goes face up (4.14.5).
- Gauge zone (4.15): hidden. Cards are linked to a player or a unit. A unit's gauge goes to drop by rule action when the unit leaves the circles or is locked (4.15.3.3).
- Order area (4.16): where an order sits while it is played. Order zone (4.17): for set orders. It is public and its cards have orientation and facing.
- Ride deck zone (4.18): face-down stack, other players can't see it. A ride-deck card that would go to the deck goes face up into the ride deck zone instead (4.18.4).
- Crest zone (4.19): public, holds crest pseudo-cards (e.g. Energy Generator). A crest's abilities are active only in the crest zone, and it is erased anywhere else (15.7.2–15.7.3).
- Removal: there is no zone. Removed cards leave the game, and their information is public (7.19).
- Energy is a per-player number, not a zone (3.1.3). Its minimum is 0 and it normally has no maximum, but effects can set one. If energy goes over that maximum, a rule action lowers it to the maximum (13.13).
- Imaginary gift markers (16.3, V-era mechanic):
  - Force: put a marker on a VC or RC (it stacks). Type I gives +10000 power during your turn. Type II makes the unit's original critical 2.
  - Accel: gain an extra front-row rear-guard circle, added alternately on the left and then the right. Type I gives +10000 during your turn. Type II draws 1 and gives +5000. If the marker is removed, the unit on that circle is retired and the circle disappears.
  - Protect: Type I puts a "protect" pseudo-card in hand. Type II puts a marker on an RC whose unit gets Shield +10000 when it intercepts.
  - The type (I/II) you choose first is locked for the rest of the game (16.3.1.3.1).
  - After you have resolved a gift from a ride, riding a unit with a different gift clan type doesn't resolve its gift (16.3.1.1).
  - Gifts are resolved when you ride a card that has a gift icon (6.3.7).

**Deck construction (current rules)** [CR 8.1]
- Main deck: exactly 50 cards, none with subtype G. Ride deck: 4 or more cards (the regulations moved to the Fighter's Rules page). G deck: up to 16 G cards.
- Max 4 copies of a name across main and ride deck. The G deck has its own separate limit of 4 per name.
- Exactly 16 triggers across main and ride deck. At most 4 heal and at most 1 over.
- At most 4 sentinels and at most 1 Regalis Piece.
- Standard also caps critical, draw and front triggers at 8 each. The ride deck is 5 cards: grades 0–3 plus a ride deck crest. Energy Generator is allowed as the crest for any nation — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)

**Setup** [CR 8.2.1]
1. Show your decks to the opponent.
2. Pick a grade 0 from the ride deck (or from the main deck if you have no ride deck) and place it face down on VC as the first vanguard.
3. Put the main deck in the deck zone and shuffle. Each player may also shuffle the opponent's deck.
4. Put the ride deck in the ride deck zone, and the G deck face down in the G zone.
5. Pick a player at random. That player chooses who goes first.
6. Set each player's vanguard damage to 0.
7. Draw 5. Mulligan, starting with the first player: put any number of cards on the bottom of the deck, draw the same number, then shuffle if you returned at least 1. Each player gets one mulligan only.
8. Turn the first vanguards face up ("Stand Up", 7.45). The first player becomes the turn player. Abilities that trigger on "when you Stand Up!!" resolve at the start of the first stand phase (9.2.1).

**Stand phase** [CR 9.2]
1. Resolve any pending "Stand Up" auto abilities.
2. "Beginning of turn" and "beginning of stand phase" abilities trigger, then a check timing.
3. The turn player stands every card on their field and in their order zone.
4. Check timing.

**Draw phase** [CR 9.3–9.5]
- Draw step:
  1. "Beginning of draw phase" abilities trigger, then a check timing.
  2. Draw 1. This also happens on the first player's first turn, because the rules have no exception.
  3. Check timing.
- G Assist step: skipped by players who have a ride deck.
  - Allowed if your vanguard is below grade 3 and your hand has no unit exactly 1 grade higher.
  - Reveal your hand. Look at the top 5 and take up to 1 unit that is 1 grade higher, showing it.
  - If you took a card, remove 2 cards from your hand from the game. Shuffle the deck either way.

**Ride phase** [CR 9.6–9.8, 6.3]
- Ride step:
  1. "Beginning of ride phase" abilities trigger, then a check timing.
  2. The turn player **may ride once** (a normal ride). The card can be a unit from hand of the **same grade or 1 grade higher** than the vanguard, or a face-down unit from the ride deck that is **exactly 1 grade higher**.
  3. Riding from the ride deck by the rules (not by an effect) costs a **discard of 1 card from hand** (6.3.3.2.2).
  4. Check timing.
- Ride procedure (6.3.3):
  1. Reveal the card.
  2. Place it on VC standing.
  3. Every other card on that VC, including heart and legion cards, goes to the soul. At the same moment, the new unit becomes the vanguard.
- "When rode upon" abilities trigger on the old vanguard (6.3.5).
- **Persona Ride** (6.3.8, 7.15.1.4): a normal ride from hand of a card with the same name as the current vanguard, where both have the persona ride icon. Draw 1, and your front-row units get +10000 until end of turn.
- Stride step: play a G unit's stride skill. You need both vanguards at grade 3 or higher, or your own vanguard at grade 3 or higher at the start of your turn (6.6.2). The old vanguard becomes the "heart".

**Main phase** [CR 9.9]: the turn player gets play timing and may do any of these, any number of times, in any order:
- Normal call: a unit with grade ≤ the vanguard's grade, from hand to any RC (9.9.2.1).
  - Calling onto an occupied RC **retires the old unit** (6.2.3.4).
  - A called unit enters standing (6.2.3.3.1) and counts as a new card (6.2.5).
- Move: swap the front and back rear-guard circles of a column where both are RCs (9.9.2.2). If one is empty, the card simply moves.
- Play a non-blitz order with grade ≤ the vanguard's grade. Limit 1 order per turn unless stated otherwise (9.9.2.3).
- Play ACT abilities.
- overDress (9.9.2.5).
- Pass to the battle phase.

**Battle phase / Attack Sub-Phase** [CR 10]
- **Start step** (10.3):
  - The first time this phase reaches the start step, "beginning of your battle phase" abilities trigger, then a check timing.
  - The turn player is the attacking player and the non-turn player is the defending player.
  - The turn player chooses whether to attack.
  - **On the first turn of the player going first, no attack is possible** and "don't attack" is chosen automatically (10.3.2).
- **Attack step** (10.4.1):
  1. The battle begins. "Beginning of attack step" abilities trigger, then a check timing.
  2. Choose a **standing unit on a front-row VC or RC** that is allowed to attack. Restraint prevents attacking (14.6).
  3. Rest it. The attack happens and "when attacks" triggers.
  4. Choose the target: the opponent's front-row vanguard (not a legion mate) or a front-row rear-guard. "When attacked" triggers.
  5. Optionally choose a standing unit with Boost in the back circle of the same column and rest it. Its power is added for as long as it keeps boosting. "When boosts" and "when boosted" trigger.
  6. Check timing.
- **Guard step** (10.5), a play-timing loop for the defending player. "Beginning of guard step" abilities trigger first. Each loop the defender may:
  - Pass. Go to the drive step if the attacker drive checks, otherwise to the damage step. The defender passes automatically if restricted or if the attacked unit is gone.
  - Call unit cards from hand to GC (a normal call that ignores vanguard grade). They enter rested.
    - Each guardian adds its shield to the attacked unit it guards for. With several attacked units, the defender picks one per guardian (6.2.4).
  - G Guardian (Premium): needs both vanguards at grade 3 or higher, at most 3 face-up G guardians in the G zone, and a face-down G guardian. Pay its cost and call it to GC (10.5.1.2.3).
  - Intercept: move front-row rear-guards that have Intercept and are not being attacked to GC in the rest state. This is allowed even if they are already rested (14.4.2).
  - Play a blitz order with grade ≤ the vanguard's grade, within the order limit of 1 per turn (10.5.1.2.5).
  - After each action there is a check timing, then the loop returns to play timing.
- **Drive step** (10.6):
  1. "Beginning of drive step" abilities trigger, then a check timing.
  2. If the attacker is a vanguard (or a rear-guard told by an effect to drive check):
     - If drive is 0 or less, skip the checks.
     - Otherwise put the top deck card face up into the trigger zone and play its trigger ability, if it has one.
     - Check timing. If the card is still in the trigger zone, put it into hand.
     - Repeat until the number of checks equals the unit's drive.
  3. Check timing.
- Drive values: drive is not printed on the card (2.17.2). Base drive is 1. Twin Drive!! gives +1 (2 checks) and Triple Drive!!! gives +2 (3 checks). Only the largest drive ability applies (14.3.2–14.3.4).
- **Damage step** (10.7.1):
  1. "Beginning of damage step" abilities trigger, then a check timing.
  2. Compare power. Every attacked unit whose power is **≤ the attacker's power is hit** (ties hit).
     - If the attacker or the target has left the field, changed master or changed circle, there is no comparison and no hit.
  3. Check timing. Hit / not-hit abilities don't trigger yet.
  4. If a vanguard is hit, deal damage equal to the attacker's critical. A critical of 0 or less deals none.
  5. Check timing. The damage itself is resolved in here through rule actions (13.6), which is where damage checks happen.
  6. "Hit" events, then "did not hit" events. Check timing.
  7. Retire all G guardians, then all guardians, then all hit rear-guards.
  8. Check timing.
- **Close step** (10.8):
  1. "Beginning of close step" and "end of battle" abilities trigger, then a check timing.
  2. "Until end of battle" effects expire. Attacker, booster and attacked statuses end.
  3. Repeat until nothing is pending.
  4. Return to the start step (or finish the attack, if this battle came from an "attack" effect).

**End phase** [CR 9.11]
1. G units on VC/RC go to the G zone face up, including heart G units.
2. Locked and deleted cards return to normal and turn face up.
3. Music orders go to drop. Units on Astral Plane circles go to the bottom of the deck. Attached units are detached and moved to RCs.
4. "When unlocked / turned face up / put into G zone" abilities trigger, then a check timing.
5. "Beginning of end phase" and "end of turn" abilities trigger (each only once per end phase), then a check timing.
6. **"Until end of turn" effects expire.**
7. Loop back to step 5 while anything is pending. When nothing is, the other player becomes the turn player.

**Durations**
- Trigger power and critical last until end of turn (11.10.2).
- Boost and guardian shield apply only while the boost or guard is ongoing (10.4.1.12.1, 6.2.4.1).
- "Until end of battle" effects expire in the close step (10.8.1.2). "Until end of turn" effects expire in the end phase after its check timing (9.11.9).
- A continuous effect from a non-CONT ability fixes the cards it affects, and its value, when it resolves (11.11.4). Example: "front-row rear-guards +5000" still applies to a unit that later moves to the back row.

### Inferences
- An engine can model the battle as a fixed step list with `checkTiming()` calls at the cited points. The guard step is a loop of "defender acts → check timing".
- The current engine's "Phases: mulligan → ride → main → battle → endTurn" leaves out the stand and draw phases as named steps. Ride also allows grade+0 from hand.

### Gaps
- The CR doesn't give the drive value for older vanguards that print no drive icon; it only says base drive is 1 (2.17). Old Premium grade 3s have Twin Drive printed.
- The ride deck count (5 in Standard) and the special cases come from the Fighter's Rules page, not the CR.

## Check timing vs play timing; ordering of multiple AUTO abilities

### Takeaway
Rule actions always resolve first and all at once. Next come imaginary gifts: the turn player's, then the non-turn player's. Then standby AUTO abilities are resolved **one at a time**: the turn player's first, in an order they choose, then the non-turn player's. After every single ability resolves, the process starts again from rule actions. Play timing (when a player may act) always comes after a check timing.

### Cited Findings
- Check timing procedure [CR 11.6.1]:
  1. Resolve all needed rule actions at once, and repeat until none are left.
  2. If the turn player has an acquired imaginary gift, they pick one and resolve it, then go back to step 1.
  3. Same for the non-turn player.
  4. If the turn player has any standby AUTO abilities, they pick one, play it and resolve it, then go back to step 1.
  5. Same for the non-turn player.
  6. End.
- Play timing [CR 11.6.2]: there is always a check timing before a player gets play timing. The player then performs one action or chooses to do nothing. Doing nothing moves the game on only if no new rule actions or AUTO abilities are pending.
- Rule actions are only checked during a check timing (13.1.2). Several rule actions happen at the same time (13.1.3).
- Losing conditions are applied by rule action during a check timing (1.2.2). Effects that say "win/lose the game" apply immediately without a check timing (1.2.5). A concession is immediate (1.2.4).
- When both players must choose at the same time, the turn player chooses first and the non-turn player chooses knowing that choice (1.3.4).
- Continuous effects apply in layers (11.11.1):
  1. Printed values.
  2. Gaining "original" information, then losing "original" information.
  3. Changes from rules.
  4. Gaining and losing abilities.
  5. Non-numeric changes.
  6. +/− changes.
  7. Boost, guardian shield, legion, attach and link changes.
  8. "Set to X" changes.
  9. Ties are broken by dependency, then by timestamp. When timestamps are equal, the turn player's effects count as earlier (11.11.3.1.1.2).
- Costs are all paid at the same time, using things the master controls (11.7.1). Cost actions:
  - Counter-Blast N: turn N face-up damage cards face down (7.24).
  - Soul-Blast N: move N soul cards to drop (7.25).
  - Counter-Charge N: turn N face-down damage cards face up (7.26).
  - Soul-Charge N: move the top N deck cards to soul (7.27).
  - Energy-Charge N: add N energy, stopping at the maximum (7.48).
  - Energy-Blast N: subtract N energy; not allowed if you have less than N (7.49).
  - When a blast appears as an effect rather than a cost, it does nothing if it can't be done in full (7.24.3, 7.25.3).
- Energy Generator (Standard crest): energy can only be used by a player with an Energy Generator in their crest zone. The maximum is 10 — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/). Retail listings show a 1/turn ACT that costs Energy-Blast 7 and draws 1 — [tcgsync DZ-SS09 listing](https://admintcg.tcgsync.com/products/energy-generator-dz-ss09-005en-dz-ss09-zero-tendo-start-deck), [totalcards D-PR/598EN](https://totalcards.net/products/cardfight-vanguard-energy-generator-d-pr-598en)

### Inferences
- Engine loop: `checkTiming(){ while(true){ if(ruleActions()) continue; if(gift(tp)) continue; if(gift(ntp)) continue; if(resolveOneAuto(tp)) continue; if(resolveOneAuto(ntp)) continue; break; } }`. Every player prompt should be preceded by `checkTiming()`.
- Damage checks are rule actions, so each damage card is checked within the check timing. AUTO abilities that a damage trigger sets off resolve before the next damage card is checked (see 13.6 and 13.7 below).

### Gaps
- I could not verify the exact Energy Generator charge text. I recall Energy-Charge 3 at the start of your ride phase, plus an extra Energy-Charge 3 at the start for the player going second, but I couldn't fetch the card text (HTTP 429). Check it with the official card list before coding.

## Trigger differences per format

### Takeaway
Under the current rules, every trigger icon's power bonus is **the number printed under the icon**. Modern cards print +10000; over triggers give +100000000. Every trigger's power goes to one unit you choose, except front, which boosts the whole front row. The heal trigger heals only if your damage is **at least equal to** the opponent's. Stand triggers are effectively Premium-only, since Standard deck rules list only critical, draw, front, heal and over.

### Cited Findings
- Trigger effects [CR 11.10.2]. Each power bonus is the number on the icon (11.10.5). Sub-abilities are played one at a time in an order you choose (11.10.3), and trigger effects last until end of turn.
  - Critical: +1 critical to one of your units, plus power to one unit. The two may be different units.
  - Draw: draw 1, plus power to one unit.
  - Stand: choose one of your units. If it is a rear-guard, stand it; that unit then can't drive check in later battles this turn. Also power to one unit.
  - Heal: if your damage zone has at least as many cards as the opponent's, choose a damage card and heal it (move it to drop, 7.20). Also power to one unit.
  - Front: all of your units in front-row circles get the power.
  - Over: remove this card from the game; draw 1; one unit gets +100000000 power; and if this came from a drive check, do what the card's text says.
- Effects that "nullify trigger effects" stop trigger abilities from being played (11.10.4.2). Several triggers at once resolve in any order (11.10.6).
- Format notes:
  - Standard (Nation Fight, D-icon cards, ride deck): 16 triggers, up to 4 heal, up to 1 over, at most 8 each of critical/draw/front. A G deck is allowed only with certain cards.
  - V Premium (Clan Fight, V-icon cards): no ride deck; uses the pre-May-2021 Standard rules.
  - Premium (all cards): no ride deck in Extreme Fight. G deck rules apply. In Extreme Fight trigger effects work "without the same-clan unit requirement" — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)
- Premium adds the Stand trigger (stand one rested rear-guard and give power). Stride/G zone are Premium, or Standard only for certain cards. Imaginary gifts belong to V-Premium/Premium. V-Premium/Premium have no ride deck. The 8-per-type trigger caps don't apply in V-Premium/Premium — [Welcome to V-Premium & Premium](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/)
- Ride from the ride deck requires a discard (6.3.3.2.2). The Fighter's Rules page also mentions a card ability that stops a card from being discarded "while riding from ride deck" [CR card supplement line, 2247].

### Inferences
- Older (pre-V) trigger icons printed +5000. Under the current rule (power = the printed number), Premium games with old cards would give +5000. Historically, before V, triggers also required a unit of the same clan on the field; Premium Extreme Fight explicitly drops that requirement, which implies Clan Fight keeps it. I have no CR text for this, so treat it as an inference.
- For the project's `TRIG` table: crit = {crit+1, power}, draw = {draw1, power}, front = {frontRowPower}, heal = {heal if myDamage >= oppDamage, power}, stand = {standRG, power}, over = {remove, draw1, +100000000, cardText if drive}.

### Gaps
- I didn't fetch the CR text on Clan Fight's same-clan trigger requirement or on old +5000 icons. The fandom wiki was blocked (402).
- Over trigger card-specific text (e.g. extra effects on drive check) varies per card. The rule only says to perform the printed text.

## All win/loss conditions and rule actions

### Takeaway
A player loses, by rule action at a check timing, if they have **6 or more damage**, **0 cards in their deck**, or **no vanguard and no cards in soul**. Card effects that say "win" or "lose" apply right away, a concession is immediate, and if both players lose at once the game is a draw. The other rule actions fix up the game state (extra units on a circle, illegal guardians, damage processing, leftover trigger cards, and so on).

### Cited Findings
- Win and loss [CR 1.2, 13.2]:
  - You lose with ≥6 damage cards, 0 deck cards, or no vanguard and an empty soul.
  - Simultaneous losses → draw (1.2.3).
  - Concession at any time loses immediately. Effects can't force or prevent a concession (1.2.4).
  - "Win/lose" effects end the game during their resolution (1.2.5).
- Deck-out happens at a check timing, not when you try to draw. Running out mid-effect only loses at the next check timing (13.1.2).
- Rule actions [CR 13]:
  - 13.3 Overloaded units: when a circle holds too many units, all but the last placed go to the soul. This handles legion mates, heart units and the like. Extra non-unit cards on a circle go to drop.
  - 13.4 Illegal guardians: units on GC with no unit being attacked, or units belonging to the attacker's player, go to drop.
  - 13.5 No vanguard: ride a card from the soul. If none can be ridden, lose. Heart cards lose their heart status and one becomes the vanguard.
  - 13.6 Damage application. Runs while a player's pending vanguard damage is 1 or more, no trigger card is waiting and no other rule action is pending. If both players have pending damage, only the turn player's is processed.
    1. Reduce the pending damage by 1.
    2. Put the top deck card into the trigger zone.
    3. Play its trigger. This is the "damage check".
  - 13.7 Damage resolution: when the damage-check card is still in the trigger zone, no rule action is pending and no AUTO is in standby, move it to the damage zone.
  - 13.8 Erase pseudo-cards that are outside their zone.
  - 13.9 Illegal gauge cards go to drop.
  - 13.10 A trigger zone card left over outside a drive or damage check goes to drop.
  - 13.11 Illegal orders: orders not being played, non-orders in the order area, and face-up orders on circles go to drop.
  - 13.12 Illegal attached cards.
  - 13.13 Excess energy is reduced to the maximum.
  - 13.14 Buddyfight-related.
- Dealing damage only increases the pending "vanguard damage" counter. The actual damage checks happen inside rule actions (7.35.1, 7.35.1.2).

### Inferences
- Order to implement damage in: set `pendingDamage += crit` → in the check timing loop, pop 1 → trigger-zone card → resolve the trigger (heal checks counts at that moment, before the card goes into the damage zone) → let AUTO abilities resolve → move the card to the damage zone → repeat. The 6-damage loss is checked at the next rule-action pass. This allows a heal on the 6th damage check to save the player, because the heal happens before the card is placed and the count happens afterwards.

### Gaps
- None major for current rules. Older formats (pre-2018 "G" era) may have had different damage-check wording; I didn't check the old PDFs (e.g. https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf).
