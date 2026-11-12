# 03 · Standard (Nation Fight)

The current main format, used for BCS 26/27 ([BCS](https://en.bushiroad.com/events/bcs2627/)). Sources: [Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/), [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/), CR 4.59 §8.1 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)), [D-series page](https://en.cf-vanguard.com/howto/d-series/), [DZ-BT01 guide](https://en.cf-vanguard.com/?p=59857).

## Card pool
- EN cards with the **D icon**: the D-series (2021+) and DivineZ `DZ-` sets, plus listed exceptions (non-D cards treated as their D versions). The exception list exists only as images on the Deck Construction page and is **not transcribed**.
- **One nation.** Cards with no clan and no nation may go in any deck.
- Buddyfight cards belong to a World that matches their icon. They are usable only if their World or race matches the starting vanguard's flag.
- No rotation has been announced as of Nov 2026: D-BT02 onward is still legal.

## Deck construction (current)

| Part | Rule |
|---|---|
| **Ride deck** | **5 cards**: one each of grade **0, 1, 2, 3** units + **1 ride deck crest**. Ride deck units must be of your nation or have no nation/clan. **Energy Generator** is allowed as the crest for every nation |
| **Main deck** | **Exactly 50** cards, none with subtype G (CR 8.1.4.1) |
| **G deck** | Only when the ride deck holds a **listed combination** (since Sep 6 2024 it must be G0+G1+G2+G3; before that G0+G1+G3). Each combination unlocks specific G units. ≤16 cards, ≤4 per name (CR 8.1.4.3, 8.1.5) |
| Copies | ≤4 per name across main + ride deck together. Cards with several names count against each name (8.1.5.2) |
| **Triggers** | **Exactly 16** across main + ride deck: **≤1 over, ≤4 heal, ≤8 critical, ≤8 draw, ≤8 front**. There are no stand triggers |
| Sentinels | ≤4 across main + ride deck (CR 8.1.7) |
| **Regalis Piece** | ≤1 card in the deck (CR 8.1.8). It can be resolved once per game (14.51.2.2.1) |
| Ace Unit | ≤1 Ace Unit card regardless of name (CR 14.56) |
| Deck-rule abilities | Cards that change deck rules ("you may include any number…") act as replacement effects; "this card" means the same collection number (8.1.3, 8.1.9) |

### Special ride decks ([Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/), ride-deck section dated Nov 5 2026)
| Starting G0 / product | Ride deck |
|---|---|
| Griphosid (G0) | 6 cards: Calamity G1–G3 + an over trigger + crest |
| Sephirosid | 5 cards with Blessing cards |
| Touken Ranbu | may use "Training Equipment" as the G3 (6 cards in some notes) |
| Buddyfight decks | + one Buddy Monster |
| Kazuma Kiryu (G0) | requires Yakuza G1–G3 |

Model these as a `rideDeckRule` override attached to the G0 card (see 08).

### Ride deck history (conflict note)
| Date | Rule |
|---|---|
| May 2021 (D launch) | Ride deck = 4 units (G0–G3) **counted inside** the 50 (46 main + 4 ride) ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)) |
| Jan 19 2024 (DivineZ) | Main deck is a full **50**, separate from the ride deck ([cmd-sg (secondary)](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html), [DZ-BT01](https://en.cf-vanguard.com/?p=59857)) |
| Current | **5-card** ride deck (4 units + crest) + 50 main. CR 8.1.4.2 only says "4 or more, per the regulations"; the 5-card count comes from the Fighter's Rules. The date the crest became mandatory is **[unverified]** |

**Current answer:** 5 + 50. Older documents saying "50 total" describe the 2021 rule.

## Setup and turn flow differences
- The first vanguard is the **G0 from the ride deck**.
- The ride deck goes to the ride deck zone face down. **No G assist step** (CR 9.5 skips it for players with a ride deck).
- Riding from the ride deck needs **exactly +1 grade** and costs **discarding 1 card from hand** (CR 6.3.3.2.2). It is once per ride phase. You cannot ride from both the hand and the ride deck in the same phase.
- Ride-deck cards that would go to the main deck return **face up** to the ride deck zone (CR 4.18.4). Some cards, e.g. the Persona Shield ticket, say they cannot be discarded for the ride-deck cost.
- A team event note: at Bushiroad Summer Fest 2026 (3-player teams), ride decks could not overlap ([BSF 2026](https://en.bushiroad.com/bsf2026/format/)).

## Energy and the Energy Generator crest
- Energy is a per-player number (CR 3.1.3). Energy-Charge and Energy-Blast are defined in CR 7.48–7.49. Excess energy is cut by a rule action (13.13).
- Energy can be used **only with an Energy Generator in your crest zone**. The maximum is **10**. Track it with official energy cards or a counter ([Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)).
- The Energy Generator is required in the ride deck for sanctioned D Standard, and its charge is **mandatory**. A forgotten charge must be corrected ([cmd-sg (secondary)](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)).
- **Card text [unverified: retailer listing DZ-SS10/005EN](https://admintcg.tcgsync.com/products/energy-generator-dz-ss10-005en-dz-ss10-shiki-otei-start-deck):**
  - Ride deck AUTO: when it would be ridden, it goes to the crest zone instead. If you went second, Energy-Charge 3.
  - CONT: your energy maximum is 10.
  - AUTO: at the beginning of your ride phase, Energy-Charge 3.
  - ACT [1/Turn]: Energy-Blast 7 to draw 1.
  - The exact moment the crest moves is uncertain. Check an official card image before coding.
- Crest abilities belong to the crest itself, not to the fighter (CR 11.4.4.1.1). "Gets a crest" creates a crest in the crest zone (CR 7.14.6).
- The Persona Shield ticket gets +5000 more if the opponent's crest is **not** Energy Generator (CR Supplement A1). Cards can therefore check which crest the opponent has.

## Persona Ride (Standard core mechanic)
- **Requirement** (CR 6.3.8): a **normal ride from hand** of a card with the same name as the current vanguard, where **both** have the Persona Ride icon. Riding from the ride deck never counts, and superior rides never count. The CR sets no grade requirement.
- **Effect** (CR 7.15.1.4): **draw 1** (this counts as drawing by an ability, 7.6.4.1.1), and until end of turn **your units get +10000 while they are on front-row circles**.
- **Scope conflict:** the 2021 presentation describes it as front-row rear-guards called *afterwards* getting +10000 ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)). **The current rule (CR 4.59) is a positional status**: it covers every unit on a front-row circle, including the vanguard, units already there, and units called or moved there later. A unit moved to the back row loses it.
- A ride-deck ride directly after a hand ride on the previous turn cannot be a persona ride ([overDress presentation](https://en.cf-vanguard.com/information/vg_project_2_presentation/)). This follows from the "from hand" rule.

## Standard mechanics checklist
| Mechanic | Present in Standard? | Ref |
|---|---|---|
| Ride deck + discard cost | yes | 06 §Ride deck |
| Persona Ride | yes | above |
| Energy / Energy Generator | yes | above |
| Over trigger (≤1) | yes | 02 §Triggers |
| Front trigger (≤8) | yes | |
| Set orders / order zone, Prison, Song, World, etc. | yes | 06 |
| Blitz orders, tickets (Quick Shield, Persona Shield…) | yes | 07 |
| overDress / XoverDress / DressUp / UnisonDress | yes | 06 |
| Alchemagic | yes | 06 |
| Arms | yes | 06 |
| Regalis Piece | yes (≤1, once per game) | 06 |
| Divine Skill / Unique Skill | yes (once per game per player) | 06 |
| D-Legion | yes (D cards) | 06 |
| Stride / G zone / Generation Break | **only** via listed ride decks or crests (Chronojet Dragon, Dragheart Luard, Alter Ego Messiah, Demon Stealth Dragon Shiranui "Oboro", Masked Magician Harri…) | 06 |
| Limit Break | yes, on 2024 Premium Deckset reprints ([About](https://en.cf-vanguard.com/?p=38596)) | |
| Imaginary gifts | no gift-icon cards in the pool | |
| Stand trigger | no | |
| G assist | no (ride deck) | |

Stride-enabling crests typically let you stride, set the original power of named G3s to 13000, and give front-row units +5000 per face-up G-zone card during your turn (CR Supplement A1; exact text per crest).

## Restriction list structure
Categories used on the Deck Construction page (Extreme Fight ignores all of them):

| Category | Meaning |
|---|---|
| Unrestricted | removed from the list |
| **Restricted** | banned |
| **Restricted to 1 / to 2** | max 1 or 2 copies |
| **Restricted as first vanguard** | may be in the deck but not as the first vanguard |
| **Choice Restriction** | from a group, pick one card (up to 4 copies) and none of the others |

- Older page lettering (secondary): A removed, B banned, C limit 1, D limit 2, E trigger restriction, F choice restriction, G G-deck regulation ([cmd-sg](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)).
- Recent Standard changes:
  - **Nov 7 2025**: Trickmoon → Restricted to 1; several cards unrestricted ([notice](https://en.cf-vanguard.com/information/regarding-the-november-2025-deck-construction-rules-update/)).
  - **Apr 1 2026** (effective **May 1 2026**): Defensing Roar Restricted; Choice Restriction between Rewrite the Star, Vyrgilla and Dragritter, Nirmihn; Vyrgilla, Rewrite Form: Alfknights → Restricted to 2; several Keter, Stoicheia and Brandt Gate cards Restricted. Stated reasons were usage and win rates, and **sentinel recycling lengthening games** ([notice](https://en.cf-vanguard.com/information/regarding-the-april-2026-deck-construction-rules-update/)).
  - Entries effective **Oct 30 2026** cover DZ-BT16 ([Deck rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)).
- Some entries apply per collection number. Store the list as editable data: `{format, name|cardId, limit: 0|1|2|"noFV"}` + `choiceGroups`.
