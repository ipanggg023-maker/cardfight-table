# 07 · Cards, abilities and keywords

Source: CR 4.59 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)). Section numbers are given in each entry. Wording is paraphrased.

## Printed card fields (CR 2.1–2.18)

| Field | § | Notes for the data model |
|---|---|---|
| Name | 2.1 | A card can also count as another name ("also regarded as", or **DressUp – name** 14.52). This works in every zone, including deck building, so it is an `aliases[]` field |
| Clan | 2.2 | Written «Clan» in text. **Cray Elemental** and orders with no clan/nation belong to all clans/nations. "This card is also a «X»" adds one |
| Race | 2.3 | Written <Race>. There can be several, separated by "/" |
| Grade | 2.4 | 0–3; 4 for G units; "protect" for the Protect gift card |
| Power | 2.5 | A "+" after the power means nothing |
| Shield | 2.6 | Some units have none (`null`, which differs from 0). G units, G3s and some others print none |
| Critical | 2.7 | Usually 1 |
| Trigger icon | 2.8 | Type plus the power printed under it (`triggerPower`) |
| Type | 2.9 | main type / subtype / special type (below) |
| Skill icon | 2.10 | **Boost** (14.5), **Intercept** (14.4), **Twin Drive!!** (14.3.3), **Triple Drive!!!** (14.3.4) |
| Text | — | abilities |
| Flavor | — | none |
| Special icon | 2.13 | **Imaginary gift** (Force/Accel/Protect) or the **Persona Ride** icon |
| Nation | 2.14 | Six nation icons (old names); Supplement B maps D nation → clans. A nation card with no clan belongs to every clan of that nation |
| Art | — | none |
| Collection data | 2.16 | Number, artist, copyright. Some deck rules check the collection number (8.1.8–8.1.9). Restrictions sometimes apply per number |
| Drive | 2.17 | **Not printed.** Base 1; Twin = 2; Triple = 3; only the largest applies |
| Fighter icon | 2.18 | Aichi, Kai, Chrono, Shinemon, Ren, plus one added in 4.59. Effects can check it |
| Format icon | — | **D** (Standard) or **V** (V Premium). Shown on the card face; used for format legality ([Deck rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)) |

## Type system (CR 2.9)
- **Main types:** unit, order, heart, originalDress, crest, ride deck crest, growth factor, impact.
- **Subtypes** depend on the main type. The full type reads "subtype + main type":
  - units: (normal), **trigger**, **G**;
  - orders: normal, **blitz**, **set**, **arms**, plus set subtypes (Prison, Song, Music, Product, Scout, World…).
- **Special types** (e.g. **ticket**, attached) are separate, and effects that change types do not touch them (2.9.5).

| Object | What it is | Valid zones | Key fields |
|---|---|---|---|
| Normal unit | unit, no trigger icon | everywhere | full |
| Trigger unit | subtype trigger | everywhere | + trigger, triggerPower |
| G unit | subtype G; G deck ≤16 | G zone, VC/RC/GC | grade 4, stride cost, Triple Drive |
| Normal / blitz / set / arms order | order | hand, order area, order zone (set), VC (arms) | grade, text |
| Regalis Piece | any card with CONT Regalis Piece | | deck ≤1, resolve once per game |
| Sentinel | CONT keyword | | deck ≤4; guard text separate |
| **Token unit** (15.4.3) | pseudo-card | field only | type, grade, power, critical, name, race, skill icon, text. E.g. Plant (G0 5000 Boost), Shadow Army (G1 15000 Boost), Vision (G3 13000 Twin Drive), Evil Decoy, Skeleton Army, Mask of Domination, Blast |
| **Token set order** | pseudo-card | order zone only | Forge, Shinobi Scrolls, Destined Timepiece, SYSTEM CODE: Xceed |
| **Ticket** (15.5) | order + special type ticket | hand, order area; erased elsewhere | e.g. **Persona Shield** (G0 blitz: an attacked unit gets +10000; you may play up to two blitz orders this turn; cannot be discarded for ride-deck costs; +5000 more if the opponent's crest is not Energy Generator), **Quick Shield**, **Guardian Shield** |
| **Crest** (15.7) | pseudo-card | crest zone only | type, name, text. E.g. Chronojet Dragon, Dragheart Luard, Nightrose, the "Ability Kiwame" crests |
| **Ride deck crest** (2.9.3.6) | real card in the ride deck | ride deck → crest zone | e.g. **Energy Generator** |
| Gift markers (16.2.1.3) | records | circle / hand | Force/Accel/Protect I/II |
| Other markers | pseudo-cards | per text | Meer's Present (hand only), Cradle, Dragontree, Infinity Eyes |
| Gauge (4.15) | cards in the gauge zone | gauge | linked to a unit or player; drop when the unit leaves |

- A marker has only the information it is given. A missing number counts as 0 (15.1.2.4.2).
- Pseudo-cards outside their zone are erased by a rule action (13.8).

**Card states:** heart (stride), originalDress / overDress / XoverDress, attached, Alchemix, locked, deleted, legion/D-legion, rest/stand, face up/down (damage, bind, order zone).

## Ability types and text structure (CR 11.1)

| Kind | Template (paraphrased) | Notes |
|---|---|---|
| **ACT** | `ACT zone [restriction]: (condition) [cost] effect` | Played during play timing. Never plays itself, even with no cost |
| **AUTO** | `AUTO zone [restriction]: When (event), (condition) [cost] effect` or `At the beginning of (phase/step), …` | Triggers into **standby**. Its cost is paid at resolution. If the card's own move triggers it, no zone is written. In hidden zones it triggers only if the text says so |
| **CONT** | `CONT zone: effect` | With no zone written, it works in every zone |
| **Order ability** | order card text, no icon | resolves while the order is played |
| **Trigger ability** | effects of the trigger icon | see 02 |

**Zone tags:** (VC), (RC), (GC), (VC/RC), Hand, Soul, Drop, Order Zone, Crest, G zone, Bind, Damage, Ride Deck. "Unit" with no zone means a unit on the field (2.9.3.1.1).

**Restriction icons (CR 12.3):**

| Icon | Meaning | Engine |
|---|---|---|
| [1/Turn] | once per turn per ability, counted only once it changed the game state | `once:"turn"` |
| [1/Fight] | once per game per ability | `once:"game"` |
| **Divine Skill** | once used, no Divine Skill ability on any of your cards for the rest of the game; a standby one may be cancelled | per-player `divineUsed` |
| **Unique Skill** | same, for its own icon | per-player `uniqueUsed` |
| Regalis Piece | resolve limit 1 per game per player (14.51) | per-player counter |
| "cannot be used for the rest of that turn/game" | resolves even if a requirement fails, as long as the game state changed (11.2.1.1.1) | |

**Activation-condition keywords (CR 14.2):** each is a condition placed after the kind, the restriction or the zone.

| Keyword | Condition |
|---|---|
| Limit Break N (14.7) | damage ≥ N |
| Generation Break N (14.14) | face-up G cards on VC + G zone ≥ N |
| Brave (14.17) | hand ≤ 3 |
| Oracle (14.18) | hand ≥ 5 |
| Ritual (14.20) | count of grade 1s in drop |
| Unite (14.21) | calls made this turn |
| Thunderstrike N (14.28) | opponent's bind zone ≥ N |
| Darkness (14.32) | cards put into soul this turn other than by riding |
| Dark Device (14.38) | (set-specific) |
| White / Black Wings (14.43) | all face-up bind cards odd / even grade |
| Powerful (14.45) | soul has 0 cards |

**Other keyword abilities (CR 14):** Intercept, Boost, Restraint (cannot attack), Forerunner, Lord, Sentinel, Seek Mate / D-Seek Mate, Stride / Ultimate Stride, Resist, G Guardian, Rescue, Revelation, Blaze, Dominate, Engorge, Shadowstitch (when an attack against a vanguard does not hit, 14.27), Rush, Burst, Charge, Magia, Time Leap, Hollow, Harmony, Wave, Success, Bloom, Melody, overDress, DressBoost, Friend, Glitter, RevolDress/DrægDress, XoverDress, Cannonball, Regalis Piece, DressUp, UnisonDress, Overcharge, Malwyrm, **Ace Unit** (≤1 per deck), Rewrite, Mental Pollution, Happy Toys, SweetLink, Arma Arms, Fantôme Skill. There are 62 keyword sections in total.

## Costs (CR 11.7, 7.x)
- All costs are paid together with things you control. AUTO costs are all or nothing (11.9.5). "Pay all" costs can be paid even when the amount is 0 (11.7.3).
- Cost types:
  - CB N (with an optional filter: "CB N – (condition)"), SB N, EB N;
  - discard (filtered: grade, name, type);
  - rest this unit or other units;
  - retire your rear-guards (filtered);
  - put this card or a hand card into soul;
  - bind from hand or drop;
  - reveal from hand (decided first, revealed on payment);
  - return drop cards to the deck (Seek Mate);
  - lock your own unit (Reverse);
  - put a card into the order zone;
  - flip a G unit face up;
  - alternative call costs ("you may … to call this card", 11.7.1.1).
- Cost modifiers: "CB cost −1 next time" (7.28). Stride cost reductions do not apply to Ultimate Stride.
- Gains (not costs): CC N, SC N, EC N.

## Common effect patterns (unranked, inferred; no frequency data was found)
- **Stats:** +N power until end of turn / end of battle; +1 critical; drive +1; "set power to X"; "for each X, +N"; "during your turn" CONT +N.
- **Resources:** draw N; CC / SC / EC; heal.
- **Search:** look at the top N, add up to 1 to hand, the rest to the bottom or drop; search the deck for a named card, reveal, add, shuffle.
- **Call / ride:** superior call from deck / drop / soul / hand / ride deck / damage to RC (standing or rested); superior ride; put on the VC.
- **Removal:** retire an opponent's rear-guard (filters: front row, grade ≤ N, "opponent chooses"); bind; lock; return to hand or deck; put into soul.
- **Battle:** stand / rest units; "cannot be hit until end of battle"; "cannot guard from hand with grade ≥ N"; "must guard with 2+ cards"; "cannot intercept"; change the attack target; attack all front row / multi-target; stand and attack again; "cannot attack / boost".
- **Event triggers:**
  - when placed on VC/RC, when ridden upon, when this unit attacks/boosts, when the attack hits / does not hit, at the end of the battle this unit attacked;
  - when put into soul / drop / damage, when retired, when a trigger is revealed;
  - at the beginning of ride / main / battle / end phase.
- **Conditions:** "if your vanguard is (name)", "if you Persona Rode this turn", soul/drop/damage/hand/bind counts, energy ≥ N, "if you went second".
- **Structure:** "choose up to N"; "you may … If you do, …"; modal "choose one of the following"; "gets 'AUTO: …'" (grant ability); opponent-chosen effects.

## Glossary of key terms

| Term | Meaning (CR) |
|---|---|
| **Call** (6.2) | put a unit on an RC or GC. A **normal call** is the turn player from hand, by the rules, at normal cost. Anything else is a **superior call**. Calling onto an occupied RC retires the old unit. A called unit is a **new card**. overDress/XoverDress are not calls |
| **Ride** (6.3) | put a unit on the VC. A **normal ride** is from hand (same grade or +1) or from the ride deck (exactly +1, with discard). Anything else is a **superior ride**. "Put a rear-guard onto the VC" by an effect is a ride |
| **Place** (7.17) | any arrival on a circle from outside the circles, including call and ride. This is what "when placed" checks |
| **Move** (7.34) | circle to circle, including intercept and swaps. Not a ride or a call |
| **Retire** (7.18) | field → drop. Every field-to-drop move is a retire |
| **Bind** (7.29) | → bind zone |
| **Remove** (7.19) | leave the game (public) |
| **Lock / Unlock** (7.30–7.31) | turn face down + stand, making the circle a lock circle / turn face up; both make a new card |
| **Delete** (7.32) | the vanguard turns face down: text and printed power are lost, skill icons kept, same card |
| **Heal** (7.20) | damage card → drop |
| **Rest / Stand** (7.2) | change orientation. Rested units cannot attack or boost |
| **Boost** (7.47) | rest a standing back-row unit in the same column to add its power while it boosts |
| **Intercept** (14.4) | a front-row RC unit with the icon, not being attacked, moves to the GC (allowed even if rested) |
| **Guard** (6.2.4) | a GC unit adds its shield to its assigned attacked unit |
| **Hit** (10.7.1.2) | at the damage step, attacked unit power ≤ attacker power. A vanguard hit deals damage equal to the attacker's crit; a rear-guard hit is retired |
| **Drive check** (7.22) | top card → trigger zone → trigger → hand |
| **Damage check** (7.23, 13.6) | top card → trigger zone → trigger → damage zone |
| **Discard** (7.9) | deck/hand/gauge → drop |
| **Search** (7.11) | look through the deck, then shuffle. A searched card is not shuffled back in |
| **Choose** (7.50) | "N units get…" means choose N, as many as possible. "Up to N" allows 0 |
| **Resist** (14.15) | the opponent's effects cannot choose this card |
| **Cannot be affected** (12.5) | matching effects cannot choose or change it |
| **Activate** (7.15) | CONT: in effect. ACT: played. AUTO: triggered into standby |
| **Resolve** (11.8.3) | do the effects in written order |
| **Mandatory / optional** | standby AUTOs must be played (the owner orders them); "you may" parts are optional |
| **One-shot / continuous / replacement** (11.3) | a continuous effect with no stated duration lasts the game. "Instead" is a replacement and the original event does not happen |
| **Golden rules** (1.3) | text beats rules; impossible actions do nothing; partial actions are done as far as possible |
| **Final Rush / Final Burst** (7.42) | player statuses with no rule effect; Burst implies Rush |
| **World** (7.43) | per-player value set by effects |
| **Twin drive (action)** (7.46) | "perform twin drive" makes even a rear-guard check twice |
