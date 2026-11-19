# Aura and on-table choices — design + plan

Date: 2026-11-19. Small project; short design with its plan.

## The user's words

"When an ability can be used, the card gets an aura so you can see it can be used. No panel at all: abilities are used like normal cards. Abilities that draw or add power choose in the usual way, no panel." Choosing from the deck / drop / soul / the top cards: **a row of cards across the middle of the table is fine** (user, 2026-11-19).

## Design

- **Aura**: every card with an ability usable right now glows (`.aura`): own units with a ready [ACT] (`Game.actList(v, key)`), hand / drop / soul / bind / damage / G zone cards with a ready zone [ACT] (`Game.zoneActs(v)`; the drop pile box glows for drop cards), order zone cards with a ready [ACT] (`Game.orderZoneActs(v)`), and order cards in hand during your main phase.
- **Using it**: click the glowing card → a small menu at the card (like the on-table card menu `#domenu`) with its usable abilities ("Use: <short text>", and "Play" for an order); one click uses it. No dock buttons for abilities (`actv`, `zact`, `ozact`, `play` are removed from the dock).
- **Choices, all on the table** (the `#choice` window is never shown; "Show list" goes):
  - units → the glowing circles (as today);
  - yes / no ("Use the ability?") and "choose one of the following" → the question bar at the top with one button per answer;
  - cards in your hand → the hand cards glow, click to pick;
  - any other cards (deck, drop, soul, damage, look at the top N…) → `#cardrow`: the cards laid out across the middle of the table, click to pick;
  - several picks → "Confirm (n)" in the question bar.
- Draws and fixed power go straight through (the engine already does them without a choice).

## Calls (Claude's)

- The small menu at a glowing card is the "use like a normal card" step (Dear Days 2 also shows the ability before using it); it closes on any other click.
- The card row has no frame, title or close button; the question bar above it carries the prompt.
- The online opponent sees "<name> is choosing…" as today.

## Plan

1. **Aura + click to use**: `usableMap(S, v)` (keys `slot:<key>`, `uid:<uid>`, `zone:drop`) → `.aura` on slots, hand cards, order zone cards, the drop box; `#abmenu` on click; dock ability buttons removed. Check: test table with a card with an [ACT] — it glows, click → menu → used; no dock button.
2. **On-table choices**: `renderPending` never shows `#choice`; `choiceMode(p, S, v)` → `units | buttons | hand | row`; question bar with buttons / Confirm; hand cards `.can-choose`; `#cardrow`. Check: a yes/no, a search from the deck, a discard from hand, a choose-one-of-the-following, a unit choice — all answered without the window; no console errors.
3. Card rounds for the user's decks (separate rounds, measured with the card checker on the user's cards).
