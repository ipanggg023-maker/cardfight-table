# Plan: every card playable + admin tools + the next 4 features

Written 2026-11-13 from the card census (`docs/abilities/catalogue.md`, 14,904 unique English cards,
first trial decks → DZ-BT09). The admin enters card data; the game must be able to express every ability exactly.

## Where we are

- **25.5%** of unique cards (3,796) can be built today with only fully supported blocks.
  By era: Original 29% · G 18% · V 34% · D 24% · DZ 20%.
- Everything else needs at least one missing or partly supported pattern. The ✋ Manual block + Judge panel can
  play any card by hand, but the goal is automatic play.
- The gap is not hundreds of special cases. A small number of **general building blocks** cover most of it:

| Missing piece (general block) | Cards that use it | What it replaces |
|---|---:|---|
| **Move cards between any zones** (hand, deck top/bottom, drop, soul, damage, bind, field, G zone; who chooses; face up/down; reveal) | ~5,000 | to hand / to soul / to deck / to drop / bind / discard / call from drop, soul, bind / damage / heal variants |
| **Result branches** ("if you did", "if you put a card", "if you revealed a grade 3") | 1,391 | `k.ifDid`, `k.triggerIn` |
| **Card filters** everywhere (grade, name contains, clan/nation, type, trigger, state, power, column) | ~2,000 | clan conditions, discard filters, column checks |
| **Counts as numbers** ("for each", "the number of…", opponent counts) | ~2,200 | `e.forEach`, `k.counts`, `k.oppCounts` |
| **Granted abilities** ("this unit gets "[AUTO]…"", "gets all of the following") | 668 | `e.giveAbility` |
| **Restrictions** ("cannot attack / boost / intercept / be chosen / be retired / call to GC", Resist, Lord) | ~1,000 | `e.restrict`, `e.cantCall`, `e.cantGuard`, `e.resist`, `kw.lord` |
| **More timings** (attacks a vanguard, is boosted, guard step, placed from hand/deck/drop, retired, discarded, put into soul/drop, drive/damage check reveals, opponent calls, attack doesn't hit, paying a cost, order played) | ~3,500 | the ❌ Timing rows |
| **Abilities in other zones** (hand, drop, soul, damage, bind, G zone) | ~1,300 | the ❌ Zone rows |
| **Replacement effects** ("instead", "would be retired") | 406 | `e.instead` |
| **Modal choice** ("choose one of the following") | 161 | `e.choice` |
| **Ride by effect** (Superior Ride from deck/drop/soul/hand, ride as [Stand]) | 263 | `e.rideByEffect` |
| **Tokens, tickets, markers, crests, named states** | ~700 | Plant/Shadow Army tokens, Quick Shield tickets, Mental Pollution etc. |

## Phase 1: Admin tools for exact card work (first, because every later step is checked with them)

Done 2026-11-13: all of Phase 1 (1 status + per-set board, 2 text check, 3 test table, 4 reprints, 5 templates, 6 bulk edit, 7 history + restore, 8 review queue + shortcuts, 9 rulings notes).

1. **Card status everywhere.** Each card gets a status: ✅ automatic / ✋ uses Manual / ⚠ text not covered by blocks / ◻ no abilities.
   Filters in the Cards tab and a progress board (per set and per era: how many cards are done).
2. **Text ↔ blocks side by side.** The official text on the left, split into abilities and sentences; each block on the right
   lights up the sentence it covers. Uncovered sentences are red. Warns when the numbers differ (text says CB 2, block says CB 1).
3. **Test table (sandbox).** One click from the editor: a solo table with the card in hand or on a circle, a dummy opponent,
   buttons to fire events (ride, call, attack, boost, hit, end of battle/turn, damage check) and set damage/soul/drop.
   The log shows every ✦ ability step. Lets the admin prove each card works 100%.
4. **Reprints share one card.** Cards with the same name and text (reprints in other sets) are linked: edit once, all copies follow.
   Shows "used in N sets".
5. **Templates.** Save any ability as a template ("Sentinel perfect guard", "Forerunner", "On hit: draw") and insert it on any card.
   Comes with templates for every keyword in the catalogue.
6. **Bulk edit.** Multi-select cards → set clan/nation, flags, rarity, trigger, grade; copy abilities from one card to many.
7. **Card history + undo.** Every save keeps the previous version on the server (`card_history` table, admins only),
   with who/when, a diff view and "restore". Card edits also go into the admin log.
8. **Review queue.** A list of cards to do, ordered by what matters (cards in active Store boxes first, then popular sets),
   with "next card" navigation and keyboard shortcuts (save, next, test).
9. **Rulings notes.** A notes field per card for official Q&A / rulings, shown in the editor and the in-game card detail.

## Phase 2: Ability Language v2 (the engine)

Done 2026-11-13: steps 1–3 (filters + counts, Move cards, results + choose-one) step 4 (durations, restrictions, player rules, Resist, Lord, granted abilities) step 5 (timings, abilities in hand/drop/soul/damage/bind/G zone, same-name 1/Turn, Ritual) and steps 6–7 (replacement abilities, ride by an effect, "when X rides this unit"). Phase 2 complete. Census: 73.7% of cards fully covered (was 25.5%).

Built in steps, each one tested on real cards in the test table and with a full game. Ordered by how many cards each step unlocks.

1. **Filters + counts + targets.** One `filter` object (owner, zone, grade/range, name contains/exact, clan/nation, type,
   trigger, state, power ≥, column, face up/down, "other than this") used by targets, costs and conditions.
   One `count` value (cards in a zone matching a filter, damage, soul, G zone face up, battle number…) usable as
   a number anywhere ("+5000 for each", "if the number of…").
2. **Move cards.** One `move` effect: from zone(s) → to zone, how many (exactly / up to / all), who chooses (you / opponent),
   reveal, face up/down, top/bottom, "in any order", "then shuffle". Covers search, mill, to hand/soul/deck/drop/bind/damage,
   call from drop/soul/bind/deck, heal, discard, opponent discards. The old blocks become shortcuts for it.
3. **Results + branches.** Every step records what it did (cards moved, revealed, called, grades). Conditions
   "if you did / if a grade 3 was revealed / if you called a card" read it. Modal "choose one/N of the following".
4. **Durations + restrictions + granted abilities.** Durations: battle / turn / opponent's turn / your next turn / while.
   Restriction effects as live modifiers: cannot attack/boost/intercept/be chosen/be retired/be hit, opponent cannot call
   grade N+ to GC, must guard with 2+, Resist, Lord. "Gets "[AUTO]…"" and "gets all of the following" as abilities added
   to a unit for a duration.
5. **Timings + zones.** All ❌ timings in the catalogue, and abilities that work from hand, drop, soul, damage, bind and G zone.
   Same-name once-per-turn limit, "if you went second", Ritual, battle number.
6. **Replacement effects.** "Instead" / "would be retired/put into drop" handled before the event happens.
7. **Ride by effect.** Superior Ride from deck/drop/soul/hand, ride as [Stand], Break Ride / Cross Ride style "when your X rides this".

## Phase 3: Keywords and era mechanics

Done 2026-11-13: tokens, tickets, crests (library cards), Forerunner, Harmony, named states, columns, power conditions (Success), Prison, Music, cannot be called, keyword templates. Census: 86.1%. Not yet: trigger orders, Attach/Alchemix, grade change / "regarded as", copy abilities, extra attacks, original power changes (crest text), Song.

Forerunner, Lord, Glitter, Ritual, Harmony/Melody and the other D-era keyword skills (Happy Toys, Oversized!, Völundr,
ExplosiveGrowth, Rewrite, OverSoul), RevolDress / DressBoost, Prison/Song set orders, named states (Mental Pollution…),
**tokens** (Plant, Shadow Army, Hollow…), **tickets** (Quick Shield…), more **crests** (Standard stride crests such as
Chronojet's: +5000 per face-up G card), markers with counters, "cannot be called" restrictions, Attach/Alchemix,
trigger orders. Each keyword also gets a ready-made template (Phase 1.5).

## Phase 4: Text → blocks parser v2

Rewrite `js/textparse.js` on top of Ability Language v2, using the census patterns: paste or import official text and the
blocks fill themselves; the side-by-side view (Phase 1.2) shows what still needs a hand. Target: most cards need only a check.

## Phase 5: the four features

1. **Free starter deck for new players.** Admin picks a starter set in Settings (a list of cards, or "one of these
   boxes for free"); new accounts get it once (server-side, in the sign-up trigger). Also a "starter deck" choice screen.
2. **Animations and sound.** Pack opening (shine by rarity, slow reveal for RRR+), battle: attack swing, damage flip,
   trigger pop, ride flash, stride burst. Original sounds (no anime audio). Volume + mute, respects reduced motion,
   transform/opacity only (60 fps rule).
3. **Friends list and matchmaking.** Supabase: `friends` table (request / accept), online presence (Realtime),
   "Invite to match" (sends the room code automatically), and a quick-match queue (two waiting players get paired).
   Room codes stay as a fallback.
4. **Open rules items** (tokens/tickets, "cannot be called", Standard stride crests): done inside Phase 2.4 and Phase 3.

## Suggested order

Phase 1 (1–3 first) → Phase 2 steps 1–4 → starter deck (small, players need it) → Phase 2 steps 5–7 → Phase 3 →
Phase 4 → friends/matchmaking → animations/sound. Each step ends with tests, docs and a commit.
