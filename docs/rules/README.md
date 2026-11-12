# Vanguard rules reference (for the Vanguard Table engine)

Compiled 2026-11-12 from research notes in `research_notes/Cardfight Vanguard rules research/`. All text is paraphrased in our own words. Card and rule text is not copied. Items marked **[unverified]** come from memory or secondary sources only and must be checked before coding. Long-form synthesis: `reports/Cardfight Vanguard rules research.md`.

## Files

| File | What it covers |
|---|---|
| [01-history-and-eras.md](01-history-and-eras.md) | Timeline 2011–2026, set code prefixes, what each era added, clan → nation mapping |
| [02-core-rules-and-game-flow.md](02-core-rules-and-game-flow.md) | Zones, setup, mulligan, every phase and battle step, check/play timing, rule actions, trigger effects, costs, win/loss |
| [03-format-standard.md](03-format-standard.md) | Standard (Nation Fight): pool, deck rules, ride deck + crest, energy, Persona Ride, G deck exceptions, restriction list |
| [04-format-v-premium.md](04-format-v-premium.md) | V Premium (Clan Fight, V icon): no ride deck, G assist, imaginary gifts, Legion |
| [05-format-premium.md](05-format-premium.md) | Premium Clan Fight and Extreme Fight: all cards, stand triggers, +5000 icons, Stride/G zone, Limit Break, old keywords |
| [06-mechanics-reference.md](06-mechanics-reference.md) | One section per mechanic: era, legal formats, procedure, edge cases |
| [07-cards-abilities-keywords.md](07-cards-abilities-keywords.md) | Card fields and types (tokens, tickets, crests, markers), ability types and templates, restriction icons, costs, effect patterns, glossary |
| [08-engine-gaps-and-plan.md](08-engine-gaps-and-plan.md) | What `js/engine.js` / `js/schema.js` support, core-loop bugs, P0–P3 gaps per format, data model / DSL / engine / editor plan |

## Sources

Primary (official, Bushiroad):
- **Comprehensive Rules ver. 4.59, updated 2026-08-28** (EN, 67 pages). Cited as "CR" with section numbers. https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf (index: https://en.cf-vanguard.com/howto/). The 4.57 URL (2026-06-26) now returns 404. A JP rules PDF dated 2026-08-06 exists but was not read: https://cf-vanguard.com/wordpress/wp-content/uploads/2026/08/06153545/vgd_rule_20260806.pdf
- Comprehensive Rules, Nov 2014 (Legion era), cited as "CR2014": https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf
- Fighter's Rules: https://en.cf-vanguard.com/howto/fighters_rules/
- Deck Construction Rules and restriction lists: https://en.cf-vanguard.com/howto/fighters_rules/deckrules/ (also https://en.cf-vanguard.com/?p=59273)
- V System page (rule changes from 2018-06-01): https://en.cf-vanguard.com/howto/v-series/
- D-series / overDress system page: https://en.cf-vanguard.com/howto/d-series/ and the overDress presentation https://en.cf-vanguard.com/information/vg_project_2_presentation/ (guide: https://en.cf-vanguard.com/?p=44300; FAQ https://en.cf-vanguard.com/?p=44204)
- Welcome to V-Premium & Premium: https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/
- Premium FAQ: https://en.cf-vanguard.com/howto/vgd_premium_faq/
- Imaginary Gift FAQ: https://en.cf-vanguard.com/howto/imaginary-gift-faq/
- DZ-BT01 guide (DivineZ start): https://en.cf-vanguard.com/?p=59857
- About page: https://en.cf-vanguard.com/?p=38596
- Restriction updates: Nov 2025 https://en.cf-vanguard.com/information/regarding-the-november-2025-deck-construction-rules-update/ , Apr 2026 https://en.cf-vanguard.com/information/regarding-the-april-2026-deck-construction-rules-update/

Secondary (used only where marked):
- CMD Singapore summaries of the Fighter's Rules: https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html ; PR list https://cmd-sg.blogspot.com/2025/02/cardfight-vanguard-overdresswilldressdi.html
- Wikipedia (anime timeline): https://en.wikipedia.org/wiki/Cardfight!!_Vanguard
- Anime News Network (Veil Lift announcement, 2026-10-28): https://www.animenewsnetwork.com/news/2026-10-28/cardfight-vanguard-announces-new-veil-lift-anime-2nd-season-of-ghost-meets-gal-mini-anime/.243287
- Retail listings for Energy Generator text (not an official image): https://admintcg.tcgsync.com/products/energy-generator-dz-ss10-005en-dz-ss10-shiki-otei-start-deck
- Community guide: https://steamah.com/cardfight-vanguard-dear-days-basics-to-advanced/

**Not reachable:** cardfight.fandom.com returned HTTP 402 to automated fetches, so it was seen only through search snippets. Any claim that relies on it is cited as "(snippet)" or marked [unverified]. bcwsupplies also returned 403. The official Q&A database (https://en.cf-vanguard.com/howto/question/) was not searched.

## Open items to verify before coding
- Exact printed text of the **Energy Generator** crest. A retail listing gives: placed in the crest zone instead of being ridden, Energy-Charge 3 if you went second, Energy-Charge 3 at the start of each of your ride phases, max 10 energy, and an ACT [1/Turn] EB7 to draw 1.
- Protect II and Accel II full texts (CR 16.3.1.5–16.3.1.6).
- When the 5-card ride deck (with crest) and the 8-per-type trigger cap started.
- Historical numbers for Break Ride, Crossride, Megablast and Ultimate Break.
