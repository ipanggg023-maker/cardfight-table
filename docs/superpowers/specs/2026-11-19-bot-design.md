# Bot opponent — design

Date: 2026-11-19. Project 3 of `2026-11-19-play-flow-design.md` (projects 1–2 are built). Boss events (project 4) will reuse this bot.

## Why

Since one-screen play was removed, the only way to play without a second person is a computer opponent. The user wants it for two things: practising, and testing their own decks. Boss events will be the same bot with its own deck and an advantage. The user handed the design choices to Claude ("do as you think best"), so every behaviour below is Claude's call unless marked as the user's.

## Decisions from the user (earlier in the conversation)

- Plays in the browser by play rules; offline; no paid AI service.
- Difficulty levels from easy to normal.
- Used for practice and deck testing; the editor's test table stays for single cards.
- Only the user's own cards and decks are used for testing (never the Card library imports).

## Goals / non-goals / anti-goals

- Goals: a full game against the bot plays to the end with no help; normal level is a fair, careful opponent (a decent player wins about half the time); every bot action is readable on screen at a person's pace.
- Non-goals: perfect play, look-ahead search, reading card text the engine can't do, online bot games, coins for bot games (boss events decide coins later).
- Anti-goals: the bot cheating (seeing your hand or deck order); the bot freezing the game (stuck on a choice, a manual step, a loop); the bot acting so fast you can't see what it did; easy level feeling random instead of beatable.

## Approaches (Claude's pick: A)

- **A. Rule scores (chosen).** At each decision the bot scores every legal move with simple Vanguard sense (power needed to hit, damage taken, cards left) and takes the best; easy level adds randomness and skips some thinking. Fast, offline, testable in Node.
- B. Look-ahead (try each move on a copy of the game). Stronger, but the engine pauses for choices mid-ability, so copying is complex and slow. A later "hard" level could add it.
- C. Scripts per deck. Only works for scripted decks; useless for testing new decks.

## How it works

- **Where it runs**: the host-style local game in `index.html?bot=<level>` (`easy` | `normal`). Seat 0 = the player (view), seat 1 = the bot. The engine runs in the page as on the test table; no network.
- **Starting a game**: a lobby tile "Play vs Bot" opens the setup screen with: your deck, the bot's deck (any of your decks, or "same as mine"), the level, and who goes first (random by default). No coins.
- **The bot module**: `js/bot.js`, global `Bot`. `Bot.start(seat, level)` subscribes to state changes; whenever `S.controller === seat` (or a pending choice / manual step belongs to the bot) and the engine is not busy, it waits its think time, then makes exactly one move through the same `Game.*` calls the screen uses. One move at a time; it re-reads the state after each move.
- **Fair by construction**: every decision is computed from `Game.snapshot(seat)` (the same redacted view an online opponent gets: your hand and every deck order hidden). The bot never reads `Game.state()` directly for decisions.
- **Pace**: about 0.6 s "thinking" before each bot action (on top of the battle moments), so the player sees each step. Hidden tab: no extra wait.
- **Manual card steps** (`S.judge` on the bot's side): the bot presses Skip; the log gets "Bot skips: <text>". Bot `once` choices it can't score: first legal option.
- **Never stuck**: if the bot's move is refused (`{ok:false}`), it tries its next-best move; after 3 refusals in one decision it takes the safe fallback (skip / end phase / no guard / first option) and logs it.

## Decisions the bot makes (normal level)

- **Mulligan**: return grade 3+ cards beyond one, and cards above grade 3 when the ride deck covers the grades (Standard); keep triggers and sentinels.
- **Ride**: always ride the ride deck when it can; otherwise the highest legal grade from hand. Discard for a ride cost: the least useful card (extra grade 3 first, then grade 0 non-triggers, never a sentinel when another card works).
- **Main phase**:
  - Call to fill the front row with the strongest units, and the back row with boosters (grade 0–1) behind the front units; replace a rear-guard only when the new one is stronger by 5000+.
  - Keep at least 2 shield cards (or a sentinel) in hand when the bot has 3+ damage.
  - Use ACT abilities and play orders when their costs are payable and they don't spend the last Counter-Blast needed for a vanguard ability; overDress / Stride / energy draw when available.
  - "You may" abilities (yes/no): yes, unless the cost is the last card in hand.
- **Battle**: attack with every unit that can usefully attack. Order: rear-guards that can hit the vanguard first, then the vanguard last (its drive checks then help the last attack), unless the opponent is at 5 damage (vanguard first). Boost whenever a booster is behind. Target the vanguard, unless a rear-guard attack can't reach the vanguard's power but can hit a strong rear-guard.
- **Guard** (the most important part): work out the hit shortfall and decide by the bot's damage:
  - 0–2 damage: don't guard rear-guard attacks; guard the vanguard only if cheap (one card).
  - 3 damage: guard the vanguard; guard rear-guards only if cheap.
  - 4–5 damage: guard everything that would hit, using the fewest shield points that are enough (+5000 margin against a drive trigger when the attacker is the vanguard); at 5 damage use a sentinel / perfect guard when the shortfall can't be covered.
  - Intercept with a grade 2 front rear-guard before spending hand cards, when that grade 2 isn't needed to attack next turn.
- **Trigger power / unit choices**: power to the unit whose attack is still to come (vanguard during drive check if it's the last attacker, else the next attacker); critical to the vanguard; heal when allowed.
- **Other choices** ("choose N cards…", "which unit"): score by power / grade for own units, by threat for the opponent's, else first legal option.

## Easy level (differences)

- Mulligan: keep everything.
- Calls in hand order, no replacements; attacks with the vanguard only on half of its turns' rear-guard attacks; target always the vanguard.
- Guards only at 4+ damage and only the vanguard; never intercepts; never uses a sentinel.
- 25% chance per decision to take a random legal move instead of the best.

## Screen

- The bot's plate shows "Bot · Normal" / "Bot · Easy". The usual moments, check zoom, SKILL strip and cut-ins play for its actions.
- While the bot thinks, its plate shows "thinking…".
- Win / lose screen: "Play again" restarts with the same decks and level; "Lobby".

## Testing

- Node (`tools/tests/bot.test.cjs`): bot vs bot (both levels) on simple decks — 20 games all end with a winner, no refused-move loops; the guard rule (normal bot at 5 damage guards a lethal attack it can cover; at 1 damage lets a rear-guard attack through); fairness (the bot's decision functions receive a snapshot where the opponent's hand has no names); manual step → Skip.
- Browser: one full game vs the normal bot with the user's test decks, no console errors.

## Calls made while writing this up (check these)

- Bot games give no coins (boss events will decide their own reward).
- Normal level target: a decent player wins about half the time; tune after play.
- Think time 0.6 s per action.

## Left to the builder

Exact scoring weights, the margin numbers inside the rules above, the setup screen's look (reuse the online setup panel style), and how the bot module is split into functions.
