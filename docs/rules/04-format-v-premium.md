# 04 · V Premium (Clan Fight)

The V-era Standard format, renamed **V Premium** when overDress launched in 2021 ([ANN](https://www.animenewsnetwork.com/press-release/2021-01-19/cardfight-vanguard-overdress-new-animation-and-gameplay-changes-revealed/.168566)). Sources: [Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/), [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/), [Welcome to V-Premium & Premium](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/), [V System page](https://en.cf-vanguard.com/howto/v-series/), CR 4.59 §16 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)).

## Card pool and deck construction
| Item | Rule |
|---|---|
| Pool | EN cards with the **V icon**. V-SD01/V-SD02 cards 001–014 count as V |
| Identity | **One clan** |
| Clan exceptions | **Link Joker** may include "Я" cards from other clans; they lose their original text and icons. **35 BanG Dream! collab cards** (Poppin'Party, Afterglow, Pastel*Palettes, Roselia, Hello Happy World!, Morfonica, RAISE A SUILEN) may be used in any clan |
| Main deck | Exactly **50** (CR 8.1.4.1) |
| Ride deck | **None** |
| G deck | None. V Premium has no G zone, and V-era stride is **[unverified]** |
| Triggers | Exactly **16**; **≤4 heal**, ≤1 over (CR base; V cards have no over triggers). **No 8-per-type cap**: front triggers are unlimited |
| Sentinels | ≤4 (CR 8.1.7; the start date of this cap is [unverified]) |
| Copies | ≤4 per name |
| Rules basis | "Pre-May 2021 Standard rules" (old V-Standard) |

- Restriction list (secondary summary, [cmd-sg](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)): bans include Black Observe, Hamiel; Bluish Flame Liberator, Percival. Errata cards include Samurai Chieftain, HYU-GA; Top Idol, Riviere; Steel Whip of Turbulence, Gheorghe.
- Neither the Nov 2025 nor the Apr 2026 update changed V Premium ([Apr 2026](https://en.cf-vanguard.com/information/regarding-the-april-2026-deck-construction-rules-update/)).

## How a V Premium game differs from Standard
| Topic | V Premium |
|---|---|
| First vanguard | Any grade 0 from the main deck, placed face down (CR 8.2.1.2) |
| G assist step | **Active** (CR 9.5). If your vanguard is below G3 and your hand has no unit 1 grade higher: reveal your hand, look at the top 5, take up to 1 unit 1 grade higher, then remove 2 cards from hand from the game, then shuffle |
| Ride | From hand only: same grade or +1. No ride-deck discard cost |
| Persona Ride | Not in the pool (no persona icons on V cards) |
| Energy / crests | None |
| Triggers | Mostly +10000. Front trigger gives +10000 to the whole front row. Some V-era reprints may print +5000; use the printed number (CR 11.10.5) |
| Drive | Grade 3 units print **Twin Drive!!**. Read it from the card, not from the grade |
| Gifts | **Imaginary gifts** are the defining mechanic. Each clan has one gift type ([Welcome page](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/)) |
| Legion | V-Legion via Seek Mate (see below) |

## Imaginary gifts (CR 16, [V System](https://en.cf-vanguard.com/howto/v-series/), [Imaginary Gift FAQ](https://en.cf-vanguard.com/howto/imaginary-gift-faq/))
- **Gain**: when you ride a unit with a gift icon (6.3.7), or when an effect gives you one. Gifts resolve **inside check timing**, after rule actions and before AUTOs: the turn player's first, then the opponent's (11.6.1).
- **One clan type per player from rides**: after you resolve, say, Force from a ride, riding a unit with a different gift icon does nothing (16.3.1.1).
- **I/II lock-in**: the variant (I or II) you choose for the first gift of a type applies to every later gift of that type for the rest of the game, unless an effect says otherwise (16.3.1.3).
- Marker text works as a **rule modification**, not an ability. It is layer 3 in the CR 11.11 order (16.2.1.3.1.1).
- Gifts cannot be acquired in Extreme Fight ([FAQ](https://en.cf-vanguard.com/howto/imaginary-gift-faq/)).
- How often you gain one: in V, every G3 printed the clan's gift icon, so each G3 ride (including a same-name re-ride) gives a gift **[unverified: memory]**. V G3s typically printed 13000 power **[unverified]**.

| Gift | Variant I | Variant II |
|---|---|---|
| **Force** | Put a marker on any of your VC/RC (markers stack). During your turn the unit on that circle gets +10000 | Marker: the unit on that circle has original critical 2 |
| **Accel** | Gain a new **front-row RC**: the 1st goes left of the leftmost front circle, the 2nd right of the rightmost, alternating after that. Both players' accel circles pair up by column. The unit there gets +10000 during your turn | Gain an accel circle the same way; **draw 1** now; the unit there gets +5000 during your turn (full text [unverified]) |
| **Protect** | Put a **Protect** pseudo-card into your hand. It has Sentinel and grade "protect"; when placed on the GC you discard a card and one of your units cannot be hit this battle. It exists only in hand or on the GC and is erased elsewhere (15.3) | Put a marker on one RC: the unit there gets "when it intercepts, Shield +10000" (full text [unverified]) |

If an Accel marker is removed, the unit on that circle is retired and the circle disappears (16.3.1.5).

## Legion in V Premium (CR 6.4, 14.11)
- **Seek Mate** is an ACT. It needs a unit that has never been in legion and an opponent vanguard of G3+.
- Cost: return **4 cards from drop to the top of the deck** in any order, plus any printed costs. Effect: search the deck for the named mate, legion it, shuffle.
- V-era Seek Mate did not need Limit Break **[unverified: memory]**.
- See 06 for the full rules of the legion state.

## Other V-era rule points ([V System](https://en.cf-vanguard.com/howto/v-series/))
- Mulligan: return cards to the bottom, draw, then shuffle. This is now the rule in all formats.
- [1/Turn] limits count only once the cost is paid. This is CR 12.3.2.3 today.
- "Ultimate Break" is said to be an LB-style condition needing 5 damage **[unverified: memory]**. If it exists on V cards, implement it as `damage ≥ 5`.

## Engine profile
```js
FORMATS.vpremium = { rideDeck:false, crest:false, energy:false, gAssist:true, gifts:true,
  stride:false, standTrigger:false, poolIcon:"V", identity:"clan",
  trigTotal:16, trigCaps:{heal:4, over:1}, sentinelMax:4, copies:4,
  restrictions:"vpremium" }
```
