# 06 · Mechanics reference (all eras)

Each entry lists: **Era · Formats where legal · Procedure · Edge cases**.

Format codes: **S** = Standard, **VP** = V Premium, **P** = Premium Clan Fight, **X** = Extreme Fight.

Main source: CR 4.59 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)), with section numbers given. **[unverified]** = from memory or secondary sources only.

Mechanics that only appear in card text (no CR section) are implemented as ordinary abilities: Break Ride, Persona Blast, Crossride, Megablast, Final Turn, Reverse, Ultimate Break, Prismagic.

---

## Original era (2011–2014)

### Limit Break (CR 14.7)
- **Era:** original (named in TD05/TD06; BT04 precursor — [Fandom (snippet)](https://cardfight.fandom.com/wiki/Limit_Break)).
- **Formats:** P, X; S on 2024 Premium Deckset reprints ([About](https://en.cf-vanguard.com/?p=38596)).
- **Procedure:** a condition keyword placed after CONT/AUTO/ACT. It is met when your damage zone has ≥ N cards (usually 4, sometimes 5). Face-down damage counts.
- **Edge:** the condition is checked when the ability triggers and again when it resolves, like any other condition.

### Break Ride [unverified details]
- **Era:** original (made official in TD08/TD09 — [Fandom (snippet)](https://cardfight.fandom.com/wiki/Break_Ride)).
- **Formats:** P, X.
- **Procedure:** a G3 has an AUTO with LB4: "when a (named/clan) G3 rides on this unit". It typically gives the new vanguard a large power bonus plus an extra effect.
- **Engine:** AUTO `riddenUpon` + condition LB4 + a filter on the rider. The ability resolves from the **soul** (CR 6.3.5.1). If the card leaves the soul before resolving, it cannot do anything that refers to itself.

### Stand trigger (CR 11.10.2.4)
- **Formats:** P, X.
- **Procedure:** choose a unit. If it is a rear-guard, stand it, and it cannot drive check in later battles this turn. Icon power goes to one unit (+5000 on old cards).

### Sentinel / perfect guard (CR 14.10, 8.1.7, 15.3.3)
- **Formats:** all.
- **Procedure:** Sentinel is a **deck-building keyword only** (≤4 per deck). The guard effect is card text: "when placed on GC, discard 1 card: one of your units cannot be hit until end of that battle".
- **Edge:** "Cannot be hit" beats any power, including +100M from an over trigger ([D-series](https://en.cf-vanguard.com/howto/d-series/)). Some D sentinels print other costs or effects, so read the card.

### Bind zone (CR 4.12, 7.29)
- **Formats:** all.
- **Procedure:** binding moves a card to its owner's public bind zone. A face-down bound card is visible only to its owner.
- **Edge:** piles are kept per binding effect. White/Black Wings (14.43) checks whether every face-up bind card has an odd or an even grade; an empty bind zone meets neither condition.

### Lock / Unlock (CR 7.30–7.31, 9.11.3)
- **Era:** Link Joker (2013).
- **Formats:** P, X, and S where cards use it.
- **Procedure (lock):**
  - The card turns face down and stands.
  - It counts as a **new card** with no information. It is neither standing nor resting for references.
  - Its circle becomes a lock circle, so nothing can be called there.
  - "Put as a locked card" drops whatever was on that circle.
  - A locked G unit goes face up to the G zone.
- **Procedure (unlock):** turn it face up in the stand position. This is not "standing", and it is a new card.
- **Edge:** the rules unlock only the **turn player's** locked cards, in that player's end phase. A lock placed by the opponent therefore lasts until your own end phase unless the card text says otherwise. Locking a unit with originalDress keeps the originalDress attached (7.30.7).

### Legion / Seek Mate / D-Legion (CR 6.4, 14.11)
- **Era:** 2014 (Legion Mate). Also the V-era V-Legion and the D-era D-Legion.
- **Formats:** P, X, VP, S (D-Legion cards).
- **Procedure:**
  - Seek Mate is an ACT. Conditions: this unit has never been in legion, and the opponent's vanguard is G3+.
  - Original/V cost: return 4 drop cards to the **top** of the deck in any order, plus any printed costs.
  - D-Seek Mate cost: return 4 drop cards to the deck, at most 2 of them trigger units.
  - Effect: search the deck for the named mate, place it beside the leader in the same orientation (**not a ride**), then shuffle.
- **Legion state:**
  - Both cards are vanguards, but only the **leader** can be attacked.
  - They rest and stand together. The legion attacks as one, with the mate's power added.
  - A boost may go onto either card.
  - **Drive and critical come from the leader.** Ride-grade checks use the leader.
  - Riding on a legion puts both cards into the soul. The legion ends if either card changes zone or becomes a heart.
- **Edge:**
  - Original-era Seek Mate usually also needed LB4 in the card text [unverified].
  - In a D-Legion, if both cards have the persona icon they lose it (6.4.1.3.1).
  - Overloaded-circle rule actions (13.3) do not break a legion.

### Card-text-only keywords [unverified details]
| Name | Pattern |
|---|---|
| Persona Blast | cost: discard a card with the same name as your vanguard |
| Crossride | CONT: +power if a named G3 is in the soul (+2000 in 2012) |
| Megablast | ACT with a big cost (e.g. CB5 + SB8) |
| Final Turn | flag text; the CR now has rule statuses **Final Rush / Final Burst** (7.42) with no rule effect of their own, and Burst implies Rush |
| Reverse | lock your own rear-guard as a cost; the unit gains "Reverse" and bonuses |

---

## G era (2014–2018)

### G deck and G zone (CR 4.14, 8.1.4.3, 8.2.1.5)
- **Formats:** P (0–16 G units of the clan); S only with listed ride decks or crests; X (CR base ≤16).
- **Procedure:**
  - The G deck holds ≤16 subtype-G cards, ≤4 per name, and starts face down in the G zone. Its owner may look at it.
  - Face-up G cards form a separate public pile.
  - A G unit that would leave the field goes **face up to the G zone** instead (4.4.2).

### Stride (CR 6.5, 6.6, 9.8, 14.12)
- **Formats:** P; S via crests or listed decks; X.
- **Timing:** the **stride step**, right after the ride step.
- **Condition:** both vanguards are G3+, **or** your vanguard was G3+ at the start of your turn. The latter is the V-era rule ([V System](https://en.cf-vanguard.com/howto/v-series/)).
- **Procedure:**
  1. Choose a face-down G unit and reveal it.
  2. Pay its **stride cost**. The default is discarding hand cards whose grades total ≥3; a card may print another cost.
  3. Put it on the VC in the current vanguard's orientation. This is **not a ride**, so ride triggers and gifts do not happen.
  4. The old vanguard (and its legion mate) becomes the **heart**.
- **Heart rules (6.5.2–6.5.4):**
  - A heart is no longer a unit; only its power and name can be referenced. "Unit" effects skip it unless they say heart.
  - The G unit gains the heart's name, and the heart's power is added to it. G units print 15000+, so the result is typically ~26000 [unverified].
  - A legion that becomes a heart keeps its legion state.
  - Riding onto a strided VC sends the hearts to the soul.
  - If the chosen heart leaves, a new non-G heart is chosen. If the G unit leaves while the heart has no other association, the heart returns as the vanguard in the G unit's place and orientation.
- **End phase (9.11.1):** every G unit on the VC/RC goes face up to the G zone (non-heart G units first, then G hearts). The heart becomes the vanguard again.
- **Drive:** stride G units usually print Triple Drive!!! [unverified, card text].
- **Standard crests:** Chronojet Dragon, Dragheart Luard, Alter Ego Messiah, Demon Stealth Dragon Shiranui "Oboro" and Masked Magician Harri let you stride (CR 18.6, Supplement A1). They often also set the original power of named G3s to 13000 and give front-row units +5000 per face-up G-zone card on your turn. The Chronojet crest also stops you from riding G3s without "Chronojet" in the name. Stride-cost cards appear in Special Fight Pack D 2024 Vol.6 ([cmd-sg](https://cmd-sg.blogspot.com/2025/02/cardfight-vanguard-overdresswilldressdi.html)).

### Grade 4 / G units in detail
| Property | Value |
|---|---|
| Subtype | **G** (the full type is written "G unit"); never in the main deck |
| Grade | 4 is printed. Grade-based effects see 4. Some G units in later sets have higher grades [unverified] |
| Power | 15000 printed + the heart's power while strided |
| Critical | printed (usually 1) |
| Drive | Triple Drive!!! icon on most stride units |
| Name | its own name **plus** the heart's name |
| Zone after use | G zone face up. Counts toward Generation Break |
| Types | stride G units (VC) and **G guardians** (GC; printed shield, e.g. 15000 [unverified]) |
| Ultimate Stride | variant with its own rules (below) |

### Generation Break N (CR 14.14)
- **Formats:** P, X; S with G decks.
- **Procedure:** the condition is met when the number of face-up G cards on your VC and in your G zone is ≥ N. Example card: Knight of Fragment ([Big Orbit (snippet)](https://www.bigorbitcards.co.uk/cardfight-vanguard/g-bt01-generation-stride/knight-of-fragment.html)).

### G guardian (Generation Guard) (CR 10.5.1.2.3, 14.16, 10.7.1.10)
- **Formats:** P, X.
- **Who/when:** the defender, during the guard step.
- **Conditions:** both vanguards are G3+, there are **at most 3 face-up G guardians** in your G zone, and you have a face-down G guardian.
- **Procedure:** reveal it, pay its printed cost (often discarding a grade 1+ or a heal [unverified]), and call it to the GC.
- **Edge:** at the end of the damage step, G guardians are retired **first** and go face up to the G zone, which raises Generation Break.

### Ultimate Stride (CR 6.6.3, 14.13)
- Its timing is printed on the card. The G card's nation must match your front VC.
- Needs ≥3 face-up cards in the G zone. Stride cost reductions do not apply.
- When it returns to the G zone, **all G-zone cards are removed from the game**.
- Gyze version: needs a G3+ vanguard and ≥5 different Zeroth Dragons in bind, and you remove all your other cards from circles, soul and G zone.

### Time Leap (CR 7.33, 14.34)
- **Era:** G (Gear Chronicle).
- **Procedure:** bind the chosen rear-guard(s). For each one, search the deck for up to 1 card exactly 1 grade higher, call them all at once, then shuffle.
- **End of turn:** each called unit goes to the bottom of the deck, and its bound partner is called back.

### Delete (CR 7.32)
- **Era:** G (Gyze, 2016–17).
- **Procedure:**
  - The vanguard turns face down but keeps its orientation. It stays the **same card** and keeps its modifiers.
  - Its power drops by its printed power. It loses all text but keeps its skill icons.
  - It can still attack, guard and be boosted.
  - It returns face up at the end of its owner's turn.
- **Edge:** if a deleted vanguard is ridden upon, all vanguards on that circle go face up into the soul.

### G assist (CR 9.5)
- **Formats:** VP, P, X (any player without a ride deck).
- **Procedure:**
  1. In the draw phase, check: vanguard below G3, and no unit of grade +1 in hand.
  2. Reveal your hand and look at the top 5.
  3. Take up to 1 unit of grade +1 and show it.
  4. If you took one, remove 2 hand cards from the game.
  5. Shuffle.
- Before 2018 the G assist rule was different; it was simplified to "remove 2" at the V change.

---

## V era (2018–2021)

### Front trigger (CR 11.10.2.6)
- All your front-row units get the icon power.
- No cap in VP/P. **≤8** in S.

### Imaginary gifts (CR 6.3.7, 11.6.1, 16)
- **Formats:** VP, P (gift-icon V cards). **Not X** ([FAQ](https://en.cf-vanguard.com/howto/imaginary-gift-faq/)). Not S (no gift icons in the pool).
- **Procedure:**
  - Riding a unit with a gift icon gives that gift. Effects can also give one.
  - Gifts resolve in check timing before AUTOs: the turn player's first.
  - The first I/II choice for each type is locked for the game.
  - After you resolve one type from a ride, rides with a different type give nothing.
- **Variants:** see the table in 04. Markers are rule modifications (layer 3).
- **Edge:** Accel circles are added left, then right, alternating, and pair up by column with the opponent's. If an Accel marker is removed, its unit retires and the circle vanishes. The Protect I card is erased outside the hand and GC.

### Mulligan change, [1/Turn] counting (V System)
- Mulligan: bottom, draw, then shuffle.
- A [1/Turn] use counts only once the game state has changed (CR 12.3.2.3).

---

## D era (overDress / will+Dress, 2021–2024)

### Ride deck (CR 4.18, 6.3.3.2.2, 9.7.2)
- **Formats:** S only.
- **Procedure:**
  - In the ride step, ride the face-down ride-deck unit that is **exactly +1 grade**.
  - A rules ride costs discarding 1 card from hand. Once per ride phase.
  - You may not also ride from hand that phase.
- **Edge:**
  - Ride-deck cards that would go to the deck go face up to the ride deck zone instead.
  - Effects can superior-ride from the ride deck without the discard.
  - The deck size history is in 03.

### Persona Ride (CR 6.3.8, 7.15.1.4, 7.6.4.1.1)
- **Formats:** S (also P with D cards, but P has no ride deck, so it happens through hand rides).
- **Procedure:** a **normal ride from hand** of a same-name card, where both cards have the icon. Draw 1 (counts as drawing by an ability). Until end of turn, units on **front-row circles** get +10000.
- **Edge:**
  - The bonus is **positional**: units called to the front later get it, and units moved to the back lose it. (The 2021 presentation described only "rear-guards called afterwards"; CR 4.59 wins.)
  - A superior ride never counts as a persona ride.
  - A D-Legion removes the icon from both cards.
  - There is no grade requirement in the CR.

### Over trigger (CR 11.10.2.7, 8.1.6.2)
- **Formats:** S, P (≤1; in P it is part of a choice restriction), X.
- **Procedure:**
  1. Remove the card from the game.
  2. Draw 1.
  3. One unit gets +100,000,000.
  4. If it was a **drive** check, also perform the card's printed over-trigger text.
- **Edge:**
  - In a damage check it is removed and **not** put into damage; the remaining checks continue.
  - It counts toward the 16 triggers.
  - A sentinel still stops the attack.
  - The [D-series page](https://en.cf-vanguard.com/howto/d-series/) calls it "once per fight". That follows from the card being removed after use.

### overDress (CR 6.7, 9.9.2.5, 14.42)
- **Formats:** S, P, X.
- **Procedure:**
  - In your main phase, put a hand unit that has overDress (grade ≤ vanguard) on top of one of your rear-guards that meets the printed condition. This is **not a call**.
  - The old unit becomes the **originalDress** under it. The new unit is "in overDress state" while it has an originalDress.
- **Edge:**
  - The stack moves as one. When it leaves the field, the cards separate. The originalDress is not "retired", and ride-deck cards return to the ride deck face up.
  - The originalDress cannot be soul-blasted.
  - An overDress unit can intercept with 5000 shield ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)).
- Related keywords: **DressBoost** (14.44), **RevolDress / DrægDress** (14.48: ride a unit standing after an attack), **DressUp – name** (14.52: an extra name), **UnisonDress** (14.53).

### XoverDress (CR 6.8, 14.49)
- **Procedure:** in the main phase, choose the required rear-guards, move them all onto one circle as originalDress, and put the card on top. Any other unit left on that circle is dropped by the next rule action.
- **Edge:** this is not overDress. XoverDress units do not count as "overDress" units.

### Set orders and the order zone (CR 4.17, 9.2.3, 11.8.3.3, 17.4–17.11)
- **Formats:** S, P, X.
- **Procedure:**
  - A set order resolves, then goes to the public **order zone**. There it has an orientation and a facing; face-down cards there have no information.
  - Your order zone stands in your stand phase.
  - Its abilities (CONT/AUTO/ACT, "Order Zone") work there.
- **Subtypes with rules:**
  - Prison: imprison opponent's cards.
  - Song: sing.
  - Music: goes to drop at the end phase.
  - Product: operate.
  - Scout / storage: 4.59 changed the storage counting rule.
  - Token set orders exist only in the order zone (15.4.4), e.g. Forge, Shinobi Scrolls, Destined Timepiece, SYSTEM CODE: Xceed.
- **World** (7.43): each player has a world value (blank by default). Effects set it, a new one replaces the old, and cards check it. The Dark Night / Abyssal Dark Night thresholds are card text [unverified].

### Order limit and blitz (CR 9.9.2.3, 10.5.1.2.5, 11.8.2)
- The limit is 1 order per turn per player by default. **Blitz orders count against the same limit.**
- The defender may play a blitz in your turn even after playing an order in their own turn, because the count resets each turn.
- An order's grade must be ≤ your vanguard's grade.

### Alchemagic (CR 7.44)
- **Formats:** S, P, X (Dark States cards).
- **Procedure:**
  1. While playing normal order A from hand, designate order B in your drop zone.
  2. B's costs and conditions are added after A's, and B's text is added after A's.
  3. A resolves (A's text first). A also gains B's CONT/AUTO abilities.
- **Edge:** "same name not allowed" and an extra CB1 come from keyword/card text [unverified].

### Arms (CR 17.7, 14.61)
- **Procedure:**
  - When played, an arms order whose "Arms – (name)" matches your vanguard's name goes onto that VC, attached to the vanguard. If nothing matches, it goes to drop.
  - It follows the vanguard when a same-name unit rides or strides onto it.
- **Edge:** if there are several with the same name, only the last placed is kept. It is dropped if the vanguard loses that name. Left/right arms are card text [unverified]. "Arma Arms" is a newer label.

### Crests (CR 4.19, 7.14.6, 11.4.4.1.1, 15.7)
- **Formats:** S.
- **Procedure:** ride deck crests go from the ride deck to the crest zone by their own text. "Gets a crest" creates a crest pseudo-card. Crest abilities work only in the crest zone and belong to the crest, not to the fighter.
- **Examples:** Energy Generator (energy; see 03), Chronojet/Messiah/Luard/Oboro/Harri (stride), Nightrose, Salome/Cecilia heart crests, the Touken Ranbu "Kiwame" crests, Mushiking.

### Regalis Piece (CR 14.51, 8.1.8)
- **Era:** D-BT08 onward.
- **Formats:** S, P, X.
- **Procedure:** ≤1 per deck. Each player may resolve Regalis Piece cards and abilities **once per game** (limit 1 unless raised). Any further one goes to drop without resolving.

### Attach (CR 6.9) / Alchemix (CR 6.10)
- **Attach:** a rear-guard goes under the VC and is not a vanguard. It cannot attack or be attacked, and its own abilities are nullified, but the vanguard gains its abilities and power. It detaches to an RC in the end phase.
- **Alchemix:** units stacked under an <Alchemix Body> token become one unit using the top card's information. Locking it erases the token and drops the rest.

---

## DivineZ (2024–2026)

### Energy (CR 3.1.3, 7.48–7.49, 13.13)
- **Formats:** S.
- Works only with the Energy Generator in your crest zone. Max 10.
- EB N cannot be paid with fewer than N. An Energy-Charge capped to 0 does not count as a charge.
- Generator text [unverified, retailer]: +3 if you went second, +3 at the start of each of your ride phases, ACT [1/Turn] EB7 draw 1.

### Divine Skill / Unique Skill (CR 12.3.3–12.3.5)
- **Formats:** S (P/X with DZ cards).
- **Procedure:** a restriction icon printed before AUTO/ACT. Once you use one, **no** ability with that icon on **any** of your cards can be used for the rest of the game. A standby AUTO with the icon may be cancelled instead of used.
- The official site calls it "once per fight" shared across your cards ([DZ-BT01](https://en.cf-vanguard.com/?p=59857)). Fated One units carry it.
- **Edge:** the nullification in a Divine Skill applies to the named unit only, so riding a new vanguard escapes it. This is card-specific and comes from a low-confidence community source.

### DivineZ generic cycle cards
- Discard from the ride deck or put on the GC, then pay CB1 or EB3 to draw. There is a second ability if you Persona Rode ([DZ-BT01](https://en.cf-vanguard.com/?p=59857)).

### Ace Unit (CR 14.56)
- ≤1 Ace Unit card per deck, regardless of name.

### Other DZ-era keyword labels (CR 14.x)
- Rewrite (ride from hand by an ACT), Overcharge, Malwyrm, Mental Pollution, SweetLink, Happy Toys (no effect), Fantôme Skill, Glitter, Friend, Cannonball, Harmony, Hollow, Dominate.
- Their effects are card text. Implement each as a label plus ordinary blocks.

---

## Format legality matrix

| Mechanic | S | VP | P | X |
|---|---|---|---|---|
| Ride deck, Persona Ride (by ride deck rules), crest, energy | ✔ | – | – | – |
| G assist | – | ✔ | ✔ | ✔ |
| Imaginary gifts | – | ✔ | ✔ | – |
| Stride / G zone / GB | crest or listed decks only | – | ✔ | ✔ |
| G guardian | – [unverified] | – | ✔ | ✔ |
| Stand trigger, +5000 icons | – | (+5000 possible) | ✔ | ✔ |
| Over trigger | ≤1 | – | ≤1 (choice) | ≤1 |
| Front trigger | ≤8 | ✔ | ✔ | ✔ |
| Same-clan trigger requirement | n/a | n/a | ✔ [inference] | – |
| Limit Break | reprints | ✔ (V cards) | ✔ | ✔ |
| Legion | D-Legion | V-Legion | all | all |
| overDress, set orders, Alchemagic, Arms, Regalis, Divine | ✔ | – | ✔ | ✔ |
| Lock, Delete, Time Leap | where cards use them | V cards only | ✔ | ✔ |
| Restriction list | ✔ | ✔ | ✔ | – |
