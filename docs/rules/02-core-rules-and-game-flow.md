# 02 · Core rules and game flow (all formats)

Source: **Comprehensive Rules ver. 4.59, 2026-08-28** ("CR", section numbers given), https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf. One rulebook covers every format. Formats differ mainly in deck construction (see 03–05), not in turn structure. Everything below is paraphrased.

## Golden rules (CR 1.3)
- Card text overrides the rules.
- An impossible action does nothing. A partly possible action is done as far as it can be.
- A count of 0 or less does nothing.
- When both players must choose at the same time, the turn player chooses first and the other player chooses after seeing that choice (1.3.4).

## Zones (CR 4.x)

| Zone | Public? | Notes |
|---|---|---|
| Deck (4.5) | hidden, ordered | When several cards leave at once, they move one at a time |
| Hand (4.6) | hidden from the opponent | |
| Drop (4.7) | public | |
| Field (4.8–4.9) | public | 7 circles: front L/C/R, back L/C/R, plus the **guardian circle (GC)** "far front". Front-centre is the **VC**; the other five are **RCs**. Your left column is the opponent's right column (4.9.1.2). VC and each RC hold 1 card; GC holds many. Other circle types: Lock, Astral Plane, Stage |
| Soul (4.10) | public | Stack under the vanguard. **Not part of the field** |
| Damage (4.11) | public | Face-down cards are still public but have no card information. ≥6 cards = loss |
| Bind (4.12) | public | Face-down bound cards: only the owner may look. Kept in separate piles per effect |
| Trigger zone (4.13) | public | Drive-checked card → hand afterwards. Damage-checked card → damage zone afterwards |
| G zone (4.14) | face-down part hidden from the opponent | Starts as the face-down G deck. Face-up cards form a separate public pile. A card entering from elsewhere goes face up |
| Gauge (4.15) | hidden | Cards linked to a player or unit. A unit's gauge goes to drop when the unit leaves the circles or is locked |
| Order area (4.16) | public | Where an order sits while it is being played |
| Order zone (4.17) | public | Set orders, with orientation (stand/rest) and facing (up/down) |
| Ride deck zone (4.18) | hidden stack | A ride-deck card that would go to the deck goes **face up** here instead (4.18.4). Face-up cards here are public |
| Crest zone (4.19) | public | Crest pseudo-cards. A crest's abilities work only here, and a crest is erased anywhere else (15.7) |
| Removal (7.19) | public | Not a zone. Cards leave the game |
| Energy (3.1.3) | public number | Minimum 0. No maximum unless an effect sets one (Standard: 10 via Energy Generator). Any excess is cut by a rule action (13.13) |

Placement states (4.9.2.x):
- A card put on the GC enters **rested** unless stated otherwise.
- A card put on the VC (other than by stride) enters **standing**.
- A unit moving between RCs keeps its orientation.

## Setup (CR 8.2.1)
1. Show your decks.
2. Pick a **grade 0** from the ride deck, or from the main deck if you have no ride deck. Place it face down on the VC as the first vanguard.
3. Shuffle the main deck into the deck zone. Each player may also shuffle the opponent's deck.
4. Put the ride deck in the ride deck zone and the G deck face down in the G zone. Standard: the crest stays in the ride deck until its own text moves it (see 03).
5. Pick a player at random. **That player chooses who goes first** (EN rules since Jan 19 2024; before that the random winner went first — [cmd-sg (secondary)](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)).
6. Set vanguard damage counters to 0.
7. **Draw 5. Mulligan**, starting with the first player: put any number of cards **on the bottom** of the deck, draw that many, **then** shuffle (only if you returned at least 1). One mulligan per player. (The pre-2018 rule was shuffle back, then draw — [V System](https://en.cf-vanguard.com/howto/v-series/).)
8. **Stand Up!**: turn the vanguards face up (7.45). The first player becomes the turn player. "When you Stand Up" AUTOs resolve at the start of the first stand phase.

## Turn structure

```
Stand → Draw (draw step, G assist step) → Ride (ride step, stride step) → Main → Battle (Attack sub-phases) → End
```

### Stand phase (9.2)
1. Resolve pending Stand Up AUTOs.
2. "Beginning of turn" and "beginning of stand phase" abilities trigger → check timing.
3. Stand **all** your cards on the field and in your order zone.
4. Check timing.

### Draw phase (9.3–9.5)
- **Draw step**:
  1. "Beginning of draw phase" abilities trigger → check timing.
  2. **Draw 1**. This also happens on the first player's first turn; the CR has no exception.
  3. Check timing.
- **G assist step** (9.5): **skipped if you have a ride deck.** Otherwise:
  1. Allowed only if your vanguard is below G3 and your hand has no unit exactly 1 grade higher.
  2. Reveal your hand. Look at the top 5 cards and take up to 1 unit that is 1 grade higher, showing it.
  3. If you took a card, remove 2 cards from your hand from the game.
  4. Shuffle the deck either way.

### Ride phase (9.6–9.8, 6.3)
- **Ride step**:
  1. "Beginning of ride phase" abilities trigger → check timing. Energy Generator charges here.
  2. You **may normal-ride once**, using either:
     - a hand unit of the **same grade or +1**, or
     - a face-down ride-deck unit of **exactly +1**. A rules ride from the ride deck **costs discarding 1 card from hand** (6.3.3.2.2).
  3. Check timing.
- You cannot ride from both the ride deck and the hand in the same phase ([D-series](https://en.cf-vanguard.com/howto/d-series/)).
- **Ride procedure** (6.3.3):
  1. Reveal the card.
  2. Put it on the VC standing.
  3. All other cards on the VC (including hearts and legion mates) go to the soul. At the same moment the new card becomes the vanguard.
- After riding:
  - "When rode upon" AUTOs on the old vanguard trigger (6.3.5). They only see the card in the soul; if it has already left the soul, they cannot follow it.
  - Imaginary gifts resolve if the new vanguard has a gift icon (6.3.7).
  - **Persona Ride** (6.3.8) applies if it was a normal ride from hand onto a same-name vanguard and both cards have the persona icon.
- **Normal vs superior ride** (6.3.2): anything other than the rules ride above is a **superior ride**. "Put a rear-guard onto the VC" by an effect counts as a ride (7.4.1.1).
- **Stride step** (9.8, 6.6): allowed if both vanguards are G3+, or yours was G3+ at the start of your turn. Reveal a face-down G unit, pay its stride cost and put it on the VC. The old vanguard becomes the **heart**. In Standard you may stride only if an ability allows it (see 03 and 06).

### Main phase (9.9)
The turn player has play timing and may do any of these, any number of times, in any order:

| Action | Rule |
|---|---|
| **Normal call** (9.9.2.1) | A unit from hand with grade ≤ your vanguard's grade, to any RC. Calling onto an occupied RC **retires** the old unit (6.2.3.4). It enters standing and counts as a new card (6.2.5) |
| **Move** (9.9.2.2) | Swap the front and back RC of a column. If one is empty, the card simply moves |
| **Play an order** (9.9.2.3) | A non-blitz order with grade ≤ your vanguard. **Order limit: 1 per turn** by default, and blitz orders share it (11.8.2.1.1.1) |
| **ACT abilities** | Any number of times, within their own restrictions |
| **overDress / XoverDress** (9.9.2.5) | See 06 |
| Go to the battle phase | |

### Battle phase (CR 10): repeated Attack sub-phases

| Step | Procedure |
|---|---|
| **Start** (10.3) | The first time only: "beginning of battle phase" abilities → check timing. Choose whether to attack. **On the first player's first turn, no attack is possible** (10.3.2) |
| **Attack** (10.4.1) | 1. The battle begins; "beginning of attack step" AUTOs → check timing. 2. Choose a **standing front-row unit** (VC or RC) that can attack (Restraint prevents attacking). 3. Rest it; "when attacks" triggers. 4. Choose the target: the opponent's front-row vanguard (not a legion mate) or a front-row rear-guard; "when attacked" triggers. 5. Optionally **boost**: rest a standing unit with the Boost icon in the back circle of the same column; its power is added while it keeps boosting; "when boosts/boosted" triggers. 6. Check timing |
| **Guard** (10.5) | "Beginning of guard step" → check timing. Then the defender loops (play timing → act → check timing): **call units from hand to the GC** (a normal call that ignores vanguard grade, entering rested; with several attacked units, assign each guardian to one); **G guardian** (Premium; see 06); **intercept** (a front-row rear-guard with the Intercept icon that is not being attacked moves to the GC rested; allowed even if it is already rested, 14.4.2); **blitz order** (grade ≤ vanguard, within the order limit); or **pass** |
| **Drive** (10.6) | "Beginning of drive step" → check timing. If the attacker is a vanguard (or a rear-guard told to drive check): repeat once per point of **drive**: top card to the trigger zone face up → play its trigger → check timing → if the card is still in the trigger zone, put it into hand. Then check timing |
| **Damage** (10.7) | "Beginning of damage step" → check timing. **Compare**: each attacked unit with power **≤ attacker's power is hit** (ties hit). There is no comparison if the attacker or target left the field, changed master or changed circle. Check timing (hit AUTOs wait). If a vanguard is hit, **deal damage = attacker's critical** (≤0 = none). Check timing: damage checks happen here as rule actions (13.6). "Hit" events, then "did not hit" events → check timing. **Retire G guardians, then guardians, then hit rear-guards** → check timing |
| **Close** (10.8) | "Beginning of close step" and "end of battle" → check timing. "Until end of battle" effects end, and attacker/booster/attacked statuses end. Repeat until nothing is pending. Then go back to the Start step |

**Drive value** (2.17, 14.3): drive is not printed on the card. Base drive is 1. **Twin Drive!!** makes it 2 and **Triple Drive!!!** makes it 3. Only the largest drive ability applies. "Perform twin drive" makes even a rear-guard check twice (7.46).

### End phase (9.11)
1. G units on the VC/RC go face up to the G zone (non-heart first, then heart G units). The heart returns to the VC.
2. **Locked and deleted cards on the turn player's field** return to normal and face up.
3. Music orders go to drop. Astral Plane units go to the bottom of the deck. Attached units detach to RCs.
4. "When unlocked / turned face up / put into G zone" AUTOs → check timing.
5. "Beginning of end phase" and "end of turn" AUTOs (each once per end phase) → check timing.
6. **"Until end of turn" effects expire.**
7. Loop back to step 5 while anything is pending. Then the other player becomes the turn player.

### Durations
- Trigger power and critical last until end of turn (11.10.2).
- Boost lasts while boosting (10.4.1.12.1). Guardian shield lasts while guarding (6.2.4.1).
- "Until end of battle" ends in the close step. "Until end of turn" ends in the end phase.
- No stated duration means the rest of the game (11.3.1.2).
- A continuous effect from a **non-CONT** ability locks in the affected cards and value when it resolves (11.11.4). Example: "front-row rear-guards get +5000" still applies after a unit moves to the back row.

## Check timing and play timing (CR 11.6)

```
checkTiming():
  loop:
    1. do ALL pending rule actions at once; repeat until none        (13.x)
    2. turn player has an acquired imaginary gift? resolve one; goto 1
    3. non-turn player's gift? resolve one; goto 1
    4. turn player has standby AUTOs? they pick ONE, play+resolve; goto 1
    5. non-turn player's standby AUTOs? same; goto 1
    6. end
```
- A player gets **play timing** only after a check timing. They perform one action or do nothing (11.6.2).
- Standby AUTOs are **mandatory** to play, but their owner picks the order (11.9.4.1). An AUTO that triggers N times goes into standby N times (11.9.3). "You may" text is optional at resolution.
- AUTO costs are paid at resolution, all or nothing (11.9.5). If a cost cannot be paid in full, nothing after it happens.
- Continuous-effect layers (11.11.1):
  1. Printed values.
  2. "Original" changes.
  3. Rule changes (gift markers).
  4. Gaining and losing abilities.
  5. Non-numeric changes.
  6. ± changes.
  7. Boost, guardian, legion, attach and link additions.
  8. "Set to X" values.
  9. Ties: dependency first, then timestamp; at equal timestamps the turn player's effects count as earlier.
- Replacement effects ("instead", 11.12): the original event does not happen. The affected player orders multiple replacements, and each applies at most once.

## Rule actions (CR 13)

| § | Rule action |
|---|---|
| 13.2 | **Loss**: ≥6 damage, 0 cards in deck, or no vanguard and no soul. Simultaneous losses = draw (1.2.3) |
| 13.3 | Overloaded circle: all but the last-placed unit go to the soul (handles hearts and mates). Extra non-units go to drop |
| 13.4 | Illegal guardians: a GC unit with no attacked unit, or one belonging to the attacking player, goes to drop |
| 13.5 | No vanguard: ride a card from the soul. If none can be ridden, you lose |
| 13.6 | **Damage application**: while a player has pending damage ≥1, no trigger card is waiting and no other rule action is pending: −1 pending, top card to the trigger zone, play its trigger. This is the **damage check**. If both players have pending damage, only the turn player's is processed |
| 13.7 | **Damage resolution**: once the checked card is still in the trigger zone with nothing pending, it goes to the damage zone |
| 13.8 | Pseudo-cards outside their valid zone are erased |
| 13.9 | Illegal gauge cards go to drop |
| 13.10 | A trigger-zone card left over outside a check goes to drop |
| 13.11 | Illegal orders go to drop |
| 13.12 | Illegal attached cards |
| 13.13 | Excess energy is reduced to the maximum |

Consequences for an engine:
- "Deal damage" only raises a counter. Each damage check runs inside the check timing, and AUTOs set off by one damage trigger resolve **before the next card is checked**.
- The heal comparison happens while the checked card is still in the trigger zone, so a heal on the 6th damage check saves the player.
- Deck-out is checked at the next check timing, not at the moment of the draw (13.1.2).
- "Win/lose the game" effects apply immediately (1.2.5). Concession is immediate and cannot be forced or prevented (1.2.4).

## Triggers (CR 11.10)
Power = **the number printed under the icon** (11.10.5): +5000 on pre-V cards, +10000 on V/D cards. The player resolves the sub-abilities one at a time in any order (11.10.3). Several triggers resolve in any order (11.10.6). Effects last until end of turn. "Nullify trigger effects" stops the trigger from being played (11.10.4.2).

| Trigger | Sub-abilities | Formats in pool |
|---|---|---|
| **Critical** | +1 critical to one of your units; icon power to one unit (may be a different unit) | all |
| **Draw** | draw 1; icon power to one unit | all |
| **Heal** | if your damage ≥ the opponent's, choose 1 damage card and heal it (→ drop); icon power to one unit. The power part applies even without the heal | all (max 4) |
| **Front** | all your units in front-row circles get the icon power (no single-unit power) | V, D, DZ cards |
| **Stand** | choose a unit; if it is a rear-guard, stand it, and it **cannot drive check** in later battles this turn; icon power to one unit | Premium only (old cards) |
| **Over** | remove this card from the game; draw 1; one unit gets **+100,000,000**; if revealed by a **drive** check, also do the card's extra text | max 1 per deck; D cards (Standard, Premium) |

- An over trigger revealed in a damage check is removed, not put into damage. Later damage checks continue ([D-series](https://en.cf-vanguard.com/howto/d-series/)).
- A sentinel's "cannot be hit" still stops a +100M attack.
- The 2021 guide gives the over trigger a 50,000 shield value when held in hand. That is a printed card value ([guide](https://en.cf-vanguard.com/?p=44300)).
- **Same-clan trigger requirement** (inference): Extreme Fight explicitly lets triggers work "without the same-clan unit requirement" ([Deck rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)). This implies Premium Clan Fight keeps an old requirement that a unit of the same clan be present. No CR text was extracted for it **[unverified]**.

## Costs and resource actions (CR 7, 11.7)

| Abbrev. | Action | Rule |
|---|---|---|
| **CB N** Counter-Blast | turn N face-up damage cards face down | 7.24. "CB N – (condition)" limits which cards can be picked |
| **SB N** Soul-Blast | N soul cards → drop | 7.25 |
| **EB N** Energy-Blast | energy −N; not possible with fewer than N | 7.49 |
| **CC N** Counter-Charge | turn N face-down damage cards face up | 7.26 |
| **SC N** Soul-Charge | top N deck cards → soul | 7.27 |
| **EC N** Energy-Charge | energy +N, capped at the maximum; if nothing is added, it does not count as a charge | 7.48 |
| Discard | any move from deck, hand or gauge to drop | 7.9 |
| Others | rest a unit, retire a unit, put into soul, bind, reveal (cost decided first, then revealed), alternative call costs | 11.7.1.1 |

- All costs are paid **at the same time** with things you control (11.7.1).
- A blast written as an **effect** (not a cost) does nothing unless it can be done in full (7.24.3, 7.25.3).
- Cost modifiers exist, e.g. "CB cost −1 next time" (7.28).

## Win / loss summary
| Condition | When |
|---|---|
| 6+ damage | rule action at a check timing |
| Deck has 0 cards | rule action at a check timing |
| No vanguard and no soul | rule action (13.5) |
| Card says win/lose | immediately |
| Concession | immediately |
| Both lose at once | draw |
