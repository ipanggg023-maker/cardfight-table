# Play flow: online only, readable battles, bot, boss events — design

Date: 2026-11-19. Status: projects 1 and 2 designed in full; projects 3 and 4 have their decisions recorded and get their own design next.

## Why

Vanguard is turn-based, so the table can afford to play slowly. Today things happen faster than a player can read: a drive check card appears and is gone, a guard resolves without showing the totals, a draw just slides into the hand. The user wants every moment readable: who did what, which card came out, and what it caused. The goal is clarity and feedback, not lots of effects. Short animations for ordinary actions; bigger visuals and sound only for key moments.

## The four projects, in order

1. **Online only** (project 2 in the conversation, done first): remove one-screen (hot-seat) play.
2. **Readable battles**: animations and pacing (this document's main part).
3. **Bot opponent**: play against the computer to practise and to test decks.
4. **Boss events**: special bosses for a limited time; a win pays coins once per event.

## Goals / non-goals / anti-goals

- Goals: each event below is readable on both players' screens, in step; a battle with a twin drive takes about 4–5 s; turns don't feel padded.
- Non-goals: no rule changes, no card system changes, no file restructuring beyond what the change needs. No new image assets.
- Anti-goals (a failure even if it works): big effects on every action; waits a player has to click through; anything that lets the opponent see hidden cards (hand, draws, face-down cards); online screens drifting out of step; the next click acting on a moment the player hasn't been shown yet.

## Approaches considered (for project 2, readable battles)

- **A. Grow what's there (chosen by the user).** The engine already pauses with `beat(kind)` at checks and hit/guard; the screen's `FX` module animates from what changed. Add more named pauses and matching animations. Online stays in step because the host's pauses reach the guest in order. Smallest change; rules code untouched.
- B. A separate show timeline (engine runs ahead, screen plays a queue). Rejected: state runs ahead of what is shown, clicks could act on unseen moments, online needs its own sync.
- C. CSS only (longer transitions). Rejected: nothing waits, so a check card is gone before its zoom ends.

Pacing choice (user): **timed**, nobody clicks to continue.

## Project 1: online only

- Remove the local game: the setup screen's local start, the "Hide hands" row (`#hotseatRow`), the pass-the-device curtain (`showCurtain`), `ui.hotseat` / `ui.shown`, the "Turn n · Player" hot-seat banner text. `view()` becomes: online → your seat; test table / bot → seat 0.
- Lobby: the Play tile becomes Host / Join (the existing online tiles). Guests may still play online (they never earn coins, as today).
- "⚖ Fix a mistake" (`#fixBtn`) is removed. Manual card steps are still done on the table (`renderDoing`), as now.
- The editor's test table ("🧪 Test this card", `?test=`) stays.
- Engine and rules: no change.

## Project 2: readable battles

### Mechanism

- Engine: new `beat(kind)` calls at each moment below (engine.js already has `beat`, `Game.setPace`). Each beat calls `onChange()` first so the host broadcasts the snapshot, then waits.
- The check card gets a stage so the screen knows what to show: `S.checking.stage` = `"shown"` → `"trigger"` (trigger resolved, with what it gave and to which unit) → cleared when the card moves on. Only display state; no rule change.
- Screen: `FX` (ui.js) plays the animation for each new moment; `Game.setPace` maps beat kinds to durations (table below).
- Online: the guest renders each snapshot as it arrives and plays the same `FX`; the host's waits keep both in step. Hidden cards stay hidden: the guest sees only a card back flying to the opponent's hand.
- `prefers-reduced-motion`: no zoom or movement, about half the waits, still in order.
- Bot games use the same pacing (the bot's actions go through the same engine paths).

### Moments and timing (starting values; tune by playing)

| Moment | What is shown | Engine wait |
|---|---|---|
| Draw (turn draw, effect draws) | Owner: the card flies deck → hand and sits a little larger in the hand for 0.5 s. Opponent: a card back flies to that player's plate. | 0.3 s |
| Ride | The card flies hand / ride deck → VC, ring on the VC. | 0.45 s |
| Key ride: grade 3 ride, Persona Ride, Stride | Same, plus a name cut-in across the middle (card name + "PERSONA RIDE" / "STRIDE") and a sound. | 1.0 s |
| Call | The card flies to its circle, the circle glows once. | 0.3 s |
| Attack declared | Attacker lunges, arrow to the target, a small "ATK 23000 → 13000" tag between them (booster included). | 0.6 s |
| Guard / intercept | Each guardian flies into the GC as it is called; intercepting units carry an "INTERCEPT" tag; the shield total counts up. | none (player is choosing) |
| Guard total (before the result) | A clear "ATTACK 23000 vs DEFENSE 25000" bar over the battle row. | 0.9 s |
| Result | HIT! (shake on the target) or GUARD (as now). | 0.5 s |
| Drive / damage check | The card flies deck → trigger zone, then **zooms to the middle of the screen (large, both players)** for 1.2 s with "DRIVE CHECK 1/2" or "DAMAGE CHECK". | 1.2 s |
| Trigger applied | The trigger name bursts; a line runs from the check card to the chosen unit, which shows "+10000" / "★+1"; heal shows the damage card going to the drop; draw shows the drawn card. | 0.7 s |
| Card moves on | The check card goes to hand / damage zone / removed. | 0.4 s |
| Finishing hit (the damage that makes 6) | The last damage check keeps the zoom a little longer; then the win/lose cut-in with a sound. | +0.6 s |

A twin-drive vanguard attack with guard and no triggers: about 0.6 + 0.9 + 2×(1.2 + 0.4) + 0.5 ≈ 5 s.

### Sound

Short sounds made in the browser (Web Audio synth, no sound files): click (call), whoosh (attack), thud (hit), shield (guard), chime per trigger type, a chord for key rides and the win. A mute button on the table (top-left with the other HUD buttons), saved in localStorage `vt-sound`. No sound until the player has interacted with the page (browser rule).

### Calls made while writing this up (check these)

- While the defender is still choosing guardians, nothing waits: each guardian animates in as it is called. The engine waits only once the guard is confirmed (the guard-total bar).
- The editor's test table keeps today's short waits (it is a tool for checking a card, not a match).

### Left to the builder

Exact durations within the ranges above, easing, colours (use the existing tokens and `TRIG_COLOR`), the cut-in and zoom styling (original look, no official logos), and how the guard-total bar sits in the existing battle row.

## Project 3: bot opponent (decisions so far; full design next)

- Plays in the browser with play rules (attack order, when to guard, when to use abilities); works offline, costs nothing. No paid AI service.
- Difficulty levels from easy to normal.
- Used for practice and to test your own decks (the test table stays for single cards).
- Testing for the user: only the user's own cards and decks, never the Card library imports.

## Project 4: boss events (decisions so far; full design next)

- Admin page: make a boss (name, one of the admin's decks, start / end time, coin reward, bot level, a boss advantage such as one less damage or an extra first-turn card).
- Lobby: an Event tile with the boss, time left and reward.
- Reward: **once per player per event, only while the event is open**, decided in SQL (a security definer function records the payout and refuses a second one). A bot game runs in one browser, so a faked win can get at most one reward per event; accepted for a private game.
