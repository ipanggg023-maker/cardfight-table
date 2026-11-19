# Boss Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins open time-limited boss fights (the bot with a chosen deck and advantages); players beat them from the lobby and get coins once per event.

**Architecture:** Event rows and the reward RPC live in Supabase (`supabase/008_bosses.sql`). The game reuses the bot game (`index.html?boss=<id>` / `?boss=try`); the engine gets per-player advantage fields set only by a `newGame` option. The admin page gets a Bosses tab; the lobby gets an Event tile for accounts.

**Tech Stack:** Plain browser JS, Supabase (supabase-js 2.45.4 via `Cloud.client()` / `Cloud.rpc()` in js/auth.js), Postgres SQL, Node `node:test` for the engine.

**Spec:** `docs/superpowers/specs/2026-11-19-boss-events-design.md`

## Global Constraints

- Coins are decided in SQL only (security definer + RLS); the browser never adds coins.
- Pay once per player per event, only while `active` and `now()` is between `starts_at` and `ends_at`, only for accounts that aren't banned, only when `turns >= 3`.
- The advantages change nothing in a game without the `boss` option.
- Never put the Supabase service_role key in the repo; the user runs SQL files in the dashboard SQL editor.
- Commits: `git -c user.email=334285765+ipanggg023-maker@users.noreply.github.com commit`, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push after merge (user-approved). In-game text English.

## Review Focus

1. **The SQL file has not been run yet** (no `bosses` table): the lobby and admin page must still work, with the Event tile hidden and the Bosses tab showing "Run supabase/008_bosses.sql first". → Task 3 and Task 4 browser checks against the current database.
2. **A boss deck card the player's browser doesn't have** (deleted card, or the player's local cards not synced): the boss page says which cards are missing instead of starting a broken game. → Task 3 test `bossDeckFromLayout reports missing cards`.
3. **Two wins in the same event** (or a refresh after the win): the second claim returns `already` and pays nothing; the win screen says "Already claimed". → Task 2 SQL logic (`on conflict do nothing` + `found` check) and Task 3 browser check.
4. **An event outside its dates or turned off**: the tile hides it, and a direct `?boss=<id>` link shows "This event is closed" (and the RPC returns `closed`). → Task 3 browser check with an ended boss.
5. **A guest opens `?boss=<id>`**: "Sign in to fight bosses" with a link to the login page; no crash. → Task 3 browser check as a guest.

---

### Task 1: Engine boss advantages

**Files:**
- Modify: `js/engine.js` (`newGame`, the 6-damage rule action ~159, `power()`, `dealDamage` finish beat ~2262), `js/ui.js` (plate "Damage x/6" ~420 uses `p.maxDamage || 6`)
- Create: `tools/tests/boss.test.cjs`

**Interfaces:**
- Produces: `Game.newGame(names, decks, { ..., boss: { seat: number, maxDamage?: number, extraDraw?: number, vcPower?: number } })`. Sets `S.players[seat].maxDamage` (every player defaults to 6), draws `extraDraw` cards for the boss right after the opening hand (before the mulligan), and `power(seat, "vc")` adds `vcPower` while `S.active !== seat`. `S.boss = { seat }` is kept for the screen.

- [ ] **Step 1: Failing tests** in `tools/tests/boss.test.cjs` (decks as in bot.test.cjs, copied helper):
  - `boss loses at 7 damage`: boss seat 1 with `maxDamage: 7`; give it 6 damage cards, run a rule check (e.g. `Game.endTurn()` round trip or an attack that deals 1) → `S.winner === null`; at 7 → `S.winner === 0`.
  - `normal games still lose at 6`: no boss option, 6 damage → winner set.
  - `extra card at the start`: `extraDraw: 1` → boss hand length = player hand length + 1 after `newGame`.
  - `vanguard power only on the player's turn`: `vcPower: 5000`; with `S.active = 0`, `Game.power(1, "vc")` = printed + 5000; with `S.active = 1`, = printed.
- [ ] **Step 2: Run** `node --test tools/tests/boss.test.cjs` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `node --test tools/tests/*.test.cjs` → all PASS.
- [ ] **Step 5: Commit.**

### Task 2: Database (`supabase/008_bosses.sql`)

**Files:** Create `supabase/008_bosses.sql`

**Interfaces:**
- Tables as in the spec (`bosses`, `boss_wins`), RLS: `bosses` select for `authenticated`; insert/update/delete only `is_admin()`. `boss_wins` select own (`owner = auth.uid()`) or `is_admin()`; no insert/update/delete grants.
- `public.claim_boss_reward(boss bigint, turns int) returns jsonb`, security definer, `set search_path = public`, granted to `authenticated` only. Order of checks: no `auth.uid()` → `{status:'guest'}`; profile banned → `{status:'closed'}`; boss missing / not active / outside dates → `{status:'closed'}`; `turns < 3` → `{status:'short'}`; lock the profile (`for update`); `insert into boss_wins … on conflict do nothing`; if no row inserted → `{status:'already', coins:0, balance}`; else add `reward` to `profiles.coins`, set `boss_wins.coins` → `{status:'paid', coins: reward, balance}`.
- Idempotent file (`create table if not exists`, `create or replace function`, `drop policy if exists` before `create policy`), comments in the style of 007.

- [ ] **Step 1: Write the file.**
- [ ] **Step 2: Review against Global Constraints and Review Focus 3–5** (read it once more line by line; the user runs it in the Supabase SQL editor).
- [ ] **Step 3: Commit.** CLAUDE.md "Sign-in & accounts" gets a `008_bosses.sql` line.

### Task 3: Boss game mode

**Files:**
- Modify: `js/ui.js` (boot `?boss=`, setup in boss mode, `startBoss()`, win screen claim), `js/db.js` (`bossDeckFromLayout`), `index.html` (`#bossBox` text in the setup panel), `style.css`
- Test: `tools/tests/boss.test.cjs`

**Interfaces:**
- Consumes: Task 1 `boss` option; Task 2 table and RPC; `Bot` from js/bot.js; `startBot()` style from ui.js.
- Produces:
  - `DB.bossDeckFromLayout(layout, byId) → { deck, missing: string[] }` (pure, same shape as `DB.loadDeck`; `missing` = card ids not in `byId`). Exported for Node by testing the pure function through a small copy-free module pattern: put it in `js/formats.js` as `deckFromLayout(layout, byId)` (formats.js is already loaded by Node tests and every page) and have `DB.loadDeck` use it too.
  - `ui.boss = { id, name, reward, adv, level, deckLayout, try: boolean }`; the bot game runs with `ui.bot = { seat: 1, level }` and `Game.newGame([me, boss.name], [myDeck, bossDeck], { boss: { seat: 1, ...adv }, extras })`.
  - On `S.winner === 0` in a non-try boss game: `Cloud.rpc("claim_boss_reward", { boss: id, turns: S.turn })` once per game; `#winCoins` shows "+N coins" / "Already claimed" / "Event closed" / "Game too short" / "Sign in to get the reward".
  - `?boss=try`: reads `sessionStorage["vt-boss-try"]` (JSON of the boss row written by the admin page), no claim.
  - Guests (`Auth.get().guest`) on `?boss=<id>`: the setup shows "Sign in to fight bosses" + link to login.html; no game.
- [ ] **Step 1: Failing test** `bossDeckFromLayout reports missing cards`: `deckFromLayout({format:"standard", ride:["a","b","c","d"], main:["a",…50], g:[]}, byIdWithout "c")` → `missing` deep-equals `["c"]`; with all present → `missing` is `[]` and `deck.main.length === 50`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `deckFromLayout` + the boss mode. **Step 4: Run** all tests → PASS.
- [ ] **Step 5: Browser checks** (Review Focus 2, 4, 5): `?boss=try` with a sessionStorage boss from the test decks → the game starts, the plate shows "Damage 0/7" for a maxDamage-7 boss; a guest on `?boss=1` → "Sign in…"; with no 008 tables → "This event is closed" (the load fails cleanly).
- [ ] **Step 6: Commit.**

### Task 4: Admin Bosses tab and lobby Event tile

**Files:**
- Modify: `admin.html` (tab button `data-atab="bosses"` + section), `js/admin.js` (list, form, save, delete, winners, Try), `lobby.html` (Event tile slot), `js/` lobby script (inline in lobby.html, as the other tiles), `style.css`, CLAUDE.md, docs/ROADMAP.md

**Interfaces:**
- Consumes: Task 2 tables; Task 3 `?boss=<id>` / `?boss=try` + `sessionStorage["vt-boss-try"]`.
- Admin tab: list of bosses (name, dates, active, reward, wins count from `boss_wins`); form fields: name, blurb, deck (select from `DB.all("decks")`; saved as the layout `{name, format, energy, ride, main, g, starter}`), level (easy/normal), advantages (three checkboxes: "Loses at 7 damage", "+1 card at the start", "Vanguard +5000 on your turn"), reward (number ≥ 0), starts / ends (`datetime-local`), active. Buttons: Save, Delete, "Try this boss" (writes sessionStorage, opens `index.html?boss=try`). Winners list for the selected boss (names from `admin_users()` matched by id, time, turns). Without the table: "Run supabase/008_bosses.sql first".
- Lobby: for accounts, after the page loads, `select * from bosses where active and now between dates` (client filter on dates is fine; RLS already limits writes) and `boss_wins` of the player; for each open boss a tile "⚔ Boss event: <name>", blurb, "Ends in 2d 4h", "+N coins" or "Beaten ✓", linking to `index.html?boss=<id>`. No tile when the query fails or nothing is open.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Browser checks:** the admin page and lobby work against the current database (before 008: no errors, tab shows the note, no tile). After the user runs 008 and signs in as an admin in the pane: create a boss with the test deck, Try it, open it, see the lobby tile, win once ("+N coins"), win again ("Already claimed"), the winner shows on the admin tab.
- [ ] **Step 3: Run** all Node tests → PASS. **Commit** (CLAUDE.md "Boss events" section, ROADMAP).
