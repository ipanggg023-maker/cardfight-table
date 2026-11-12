# Vanguard Table

A private fan-made Vanguard simulator for playing with friends on one screen.
Not for sale or public distribution (cards and art belong to Bushiroad).

## Files
- `index.html` — play the game (double-click to open)
- `editor.html` — add/edit cards, build decks, backup
- `images/` — optional folder for card pictures

## Adding a real card
1. Open `editor.html` → **+ New card**
2. Fill name, card type, grade, power, shield, critical, trigger, nation
3. Image: **Upload image** (stored in the browser) or type a path like `images/vyrgilla.png`
4. Paste the official text into **Card text** (shown when you hover the card in game)
5. **+ Add ability** for each ability and build it from blocks (see below)
6. **Save card**

## Link pictures to cards
Put card pictures in a folder inside D:\Vanguard (e.g. `images`), named after the card (`Rewrite the Star, Vyrgilla.png`) or its card number (`DZ-BT01_001EN.png`).
Editor → **Backup** → **Pick picture folder…**. Matching cards get their picture.

## Faster ways to add cards
- **Fill from card text:** in a card, open "Fill from card text", paste the stats + [AUTO]/[ACT]/[CONT] text, press Fill. Stats and abilities are guessed; check the purple lines and fix anything wrong.
- **Bulk CSV import:** Editor → Backup → "Download CSV template", fill it in Excel/Google Sheets (one card per row), save as CSV UTF-8, then "Import CSV". Same name = update. Abilities are built from the `text` column.

## Import cards from the Card library (free, no key)
Editor → **Card library**. Card data comes from the Card Game Simulator community files on GitHub (github.com/dragogodev/cgs). Needs internet, no key, no relay.
1. Pick a set, or press **Load all sets** once (about 18 MB) and search by name.
2. Trigger units: the files don't include the trigger icon. If the card text doesn't name it, pick its type from the picture in the small "? trigger" box before you press **Import**. Cards left on "?" show ⚠ in the Cards tab and the deck checker asks you to fix them.
3. Critical is always set to 1 (the files don't have it). G units, markers and crests are not shown because the game doesn't use them yet.
Same name = update (abilities you already fixed are kept).
**Local pictures:** if you saved the pictures yourself with Edit.py (run it inside the Vanguard folder so it makes `vanguard_images`), tick "Use pictures from the vanguard_images folder" before importing, or press "Switch my imported cards to local pictures" for cards you already imported. Cards then load from your disk, offline and faster. Card art belongs to Bushiroad: keep it to private play with friends.

## Import cards from tcgapi.dev (online)
1. Get a free API key at https://tcgapi.dev (free plan: 100 requests/day, personal use only).
2. Double-click **start-tcgapi-relay.bat** and keep the black window open. (The API blocks calls from web pages, so this small relay on your PC passes them through. It only listens on your own computer.)
3. Editor → **Online cards** → paste the key → **Save & test**.
4. Search a name or pick a set, then **Import** (or **Import all on this page**).
Each search, set page or card detail costs 1 request. Abilities are built from the card text, so check them in the Cards tab.
Card art belongs to Bushiroad. Keep it to private play with friends; don't publish it.

## Building abilities
Each ability = Kind + (Zone) + (When) + Limit + Conditions + Costs + Effects.
The purple line shows how the engine reads it. Check that it matches the real text.

| Real card text | Build it as |
|---|---|
| `[AUTO](VC):When this unit attacks, [COST][Counter-Blast 1], …` | Kind AUTO, Zone VC, When "this unit attacks", Cost Counter-Blast 1 |
| `[ACT](VC)[1/Turn]:[COST][Energy-Blast 3], …` | Kind ACT, Zone VC, Limit 1/Turn, Cost Energy-Blast 3 |
| `[CONT](RC):If you have 4+ rear-guards, this unit gets [Power]+5000` | Kind CONT, Zone RC, Condition rear-guards ≥ 4, Effect Power +5000 target "this unit" |
| `choose one of your opponent's rear-guards, and bind it` | Effect Bind unit, target "choose opponent's rear-guard(s)", n 1 |
| `call a grade 2 from your drop to (RC)` | Effect Search zone, from drop, n 1, filter min 2 max 2, dest RC |
| `look at the top 5 cards, choose up to 1 … put into hand, shuffle` | Effect Look at top N: n 5, take 1, dest hand, shuffle |
| Normal order card | Card type Order, ability Kind "Normal Order" |
| Blitz order | Card type Order, ability Kind "Blitz Order" |

Example — Rewrite the Star, Vyrgilla style ACT:
Kind ACT · Zone VC · 1/Turn · Cost Energy-Blast 3 · Effects: Bind (choose opponent's rear-guard, 1) → Search (drop, 1, grade 2–2, dest RC)

Abilities that need a block that doesn't exist yet: write the card text anyway and ask Claude Code to add the block (see CLAUDE.md).

## Playmats
On the Start screen each player picks a playmat: Classic, overDress Red, overDress Blue, or **My own image** (any picture with the standard mat layout: order zone top-left, damage bottom-left, circles in the middle, deck right, drop bottom-right).
Your half of the table uses your mat; the opponent's is turned around. The playmat art belongs to Bushiroad: private play only.

## Decks
Editor → **Decks** → **+ New deck**: pick the 4 ride deck cards, add 50 main deck cards with +/−,
tick Energy Generator if your deck uses energy. The checker shows what's still illegal.

## Backup (important)
Cards are saved inside the browser. Use **Backup → Export** often and keep the .json file here.
Give the file to a friend and they can **Import** it to get the same cards.
Use the same browser for `index.html` and `editor.html`.
