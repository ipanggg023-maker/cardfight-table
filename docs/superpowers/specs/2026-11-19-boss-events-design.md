# Boss events — design

Date: 2026-11-19. Project 4 of `2026-11-19-play-flow-design.md`. Builds on the bot (`js/bot.js`, `2026-11-19-bot-design.md`). Approved by the user ("จัดการเลย").

## Why

The user wants special boss fights from time to time: an admin opens a boss for a limited time, players beat it, and a win pays coins. It gives players a reason to come back and a use for the bot beyond practice. Gacha stays play-earned coins only.

## Decisions (the user's)

- A boss = the bot with a deck the admin chose and an advantage; open for a limited time.
- A win pays coins **once per player per event, only while the event is open**, decided in SQL. A faked win can get at most one reward per event (accepted for a private game).

## Calls made by Claude (approved with the design)

- Admin page gets a **Bosses** tab: name, one line of text, boss deck (picked from the admin's decks and **copied into the event**, because decks are private to their owner), bot level (Easy / Normal), advantages, coin reward, start / end date-time, active on/off, list of who beat it.
- Advantages, any combination:
  - `maxDamage: 7`: the boss loses at 7 damage instead of 6.
  - `extraDraw: 1`: the boss draws 1 extra card at the start (before the mulligan).
  - `vcPower: 5000`: the boss's vanguard gets +5000 power during the player's turns.
- Lobby **Event** tile, only for accounts (bosses live in the database, which guests can't read; guests get no coins anyway). Shows the open boss (or bosses): name, line of text, time left, reward, "Beaten ✓" when already paid.
- The player fights with one of their own decks (the usual deck checks and collection limits). Retries unlimited while the event is open. Losing costs nothing.
- Reward check in SQL: event active and within its dates, the player has an account and isn't banned, the game lasted at least 3 turns (same rule as online matches), and no earlier payout for this event. The win screen shows "+N coins" / "Already claimed" / "Event closed".
- **"Try this boss"** button on the admin page: plays the boss locally (no reward) before opening it.

## Goals / non-goals / anti-goals

- Goals: an admin can create, try, open and close a boss without touching SQL; a player sees it in the lobby, fights it, and gets paid once.
- Non-goals: leaderboards, boss-only art or music, special boss AI beyond the bot levels, rewards other than coins.
- Anti-goals: paying twice for one event; paying a guest; a boss that can't be played because a card in its deck is missing for the player; the advantages changing the rules for anyone but the boss.

## Approach

One sensible way (no real alternatives): event rows in Supabase (`supabase/008_bosses.sql`), the game reuses the bot game (`index.html?boss=<id>`), the engine gets per-player advantage fields set only by `newGame` options, the reward is one security-definer RPC. A client-side reward was ruled out by the project rule that coins are decided in SQL.

## Data (`supabase/008_bosses.sql`)

- `bosses`: `id bigserial`, `name text`, `blurb text`, `deck jsonb` (the deck layout `{name, format, energy, ride[], main[], g[], starter}` with card ids), `level text` ('easy' | 'normal'), `adv jsonb` (`{maxDamage?, extraDraw?, vcPower?}`), `reward int`, `starts_at timestamptz`, `ends_at timestamptz`, `active bool default true`, `created_at`. RLS: signed-in users read rows; admins (`is_admin()`) insert / update / delete.
- `boss_wins`: `boss_id`, `owner uuid`, `turns int`, `coins int`, `at timestamptz`, primary key (`boss_id`, `owner`). RLS: owners read their own rows, admins read all; no direct writes.
- RPC `claim_boss_reward(boss bigint, turns int) returns jsonb` (security definer): `{status: 'paid' | 'already' | 'closed' | 'short' | 'guest', coins, balance}`. Locks the profile row like `report_match`. Inserts the win and adds `reward` coins in one transaction.

## Engine (rules unchanged for normal games)

`Game.newGame(names, decks, { boss: { seat, maxDamage, extraDraw, vcPower } })` sets `p.maxDamage` (default 6, used by the 6-damage rule action and the screen's "x/6"), draws `extraDraw` extra cards for the boss before the mulligan, and adds `vcPower` to the boss vanguard's power while `S.active !== seat`. Nothing else reads these.

## Screen

- `index.html?boss=<id>`: loads the event (Cloud), shows the bot setup with "Your deck" only (the boss deck and level are fixed), starts the bot game with the boss's name, deck, level and advantages. On a win the screen calls `claim_boss_reward` once and shows the result on the win screen. "Play again" fights the same boss.
- Admin preview: `index.html?boss=try` with the boss settings passed from the admin page through `sessionStorage` (no reward).
- Plates show the boss's damage limit ("Damage 3/7").

## Testing

- Node: engine advantages (loses at 7 not 6; extra card drawn; +5000 only on the player's turn; normal games unchanged); bot vs boss game ends.
- SQL: reviewed; the user runs `008_bosses.sql` in the Supabase SQL editor; then a browser check with an admin account (the user signs in).
- Browser: admin creates + tries a boss; a player account sees the tile, wins, is paid once, the second win says "Already claimed".

## Left to the builder

Layout of the Bosses tab and the Event tile (follow the Store / admin styles), time-left wording, exact SQL policy names.
