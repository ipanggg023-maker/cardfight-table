# Card and Ability Types: Glossary and Data Model Reference (Cardfight!! Vanguard, all eras to late 2026)

Main source: **Comprehensive Rules ver. 4.59, updated 28 Aug 2026** (called "CR" below). PDF: https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf, linked from the official rules index https://en.cf-vanguard.com/?p=11. Section numbers are CR sections. All wording here is paraphrased.
Other sources: Fighter's Rules https://en.cf-vanguard.com/howto/fighters_rules/ ; official overDress guide (2021) https://en.cf-vanguard.com/?p=44300 ; a community guide (secondary) https://steamah.com/cardfight-vanguard-dear-days-basics-to-advanced/
Not reachable: cardfight.fandom.com returned HTTP 402 (blocked), so no wiki pages are cited.

Era abbreviations: Original/Legion (2011–14), G (Stride, 2014–18), V (2018–21), D (overDress → Will+Dress → DivineZ, 2021–26).

---

## Q1: What fields does a card need to represent every card type?

### Takeaway
The CR lists 16 printed information fields, plus a hidden "Drive" value and a Fighter Icon. Type has three layers: main type, subtype and special type. Markers, tokens, tickets, crests and gift markers are "pseudo-cards" that carry only some of those fields. One card record with optional fields, a `mainType`/`subtype`/`specialType` split, and an `isPseudo` flag can represent every printed card and every marker.

### Cited Findings
**Printed information fields (CR 2.1–2.18)**
- The fields are Name, Clan, Race, Grade, Power, Shield, Critical, Trigger Icon, Type, Skill Icon, Text, Flavor, Special Icon, Nation, Art and Collection Data — [CR §2](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Name (2.1):** a card may also count as another name through a CONT ability ("also regarded as …") that works in every zone, including deck building (2.1.2). **DressUp – (name)** is the D-era keyword for the same thing (14.52) — CR
- **Clan (2.2):** written «Clan» in text. «Cray Elemental» cards belong to every clan and nation, and an order with no clan or nation also belongs to all (2.2.4–2.2.5). An effect can add a clan or nation with "This card is also a «X»" — CR
- **Race (2.3):** written <Race> in text. A card can have several races separated by "/" (2.3.4) — CR
- **Grade (2.4), Power (2.5), Shield (2.6), Critical (2.7):** some units have no shield (2.6.3). A "+" printed after power means nothing (2.5.3) — CR
- **Trigger Icon (2.8):** shows the trigger ability that is played when the card is put in the trigger zone — CR
- **Type (2.9):** main type is one of unit, order, heart, originalDress, crest, ride deck crest, growth factor or impact. Subtypes depend on the main type, and the full type is written "subtype + main type", e.g. "trigger unit" (2.9.6). Special types (e.g. "ticket", "attached") are separate: effects that change types don't touch them (2.9.5) — CR
- **Skill Icon (2.10):** Boost (14.5), Intercept (14.4), Twin Drive!! (14.3.3), Triple Drive!!! (14.3.4) — CR
- **Drive (2.17):** not printed. Every card starts at 1, and Twin/Triple Drive raise it. If a unit has several drive abilities, only the largest applies (14.3.2) — CR
- **Special Icon (2.13):** an imaginary gift icon (Force / Accel / Protect, V era), or the **Persona Ride** icon (2.13.3) — CR
- **Nation (2.14):** six nation icons (United Sanctuary, Dragon Empire, Star Gate, Dark Zone, Magallanica, Zoo). D-era nation names map to clans in CR Supplement B. A card with a nation but no clan belongs to all of that nation's clans — CR
- **Collection Data (2.16):** collection number, artist and copyright. Not game information, except that some deck-building effects check the collection number (8.1.8–8.1.9) — CR
- **Fighter Icon (2.18):** an icon at the bottom left (Aichi, Kai, Chrono, Shinemon, Ren, plus one added in 4.59) that effects can check ("a card with a Kai icon") — CR

**Card / object kinds**
- **Normal unit:** main type unit with no trigger icon. **Trigger unit:** subtype "trigger" — CR 2.9.6
- **G unit:** subtype "G", kept in the G deck (16 or fewer cards, 8.1.4.3) and played with a Stride skill (6.6, 14.12). A G unit that would leave the field goes face up to the G zone instead (4.4.2) — CR
- **Orders (11.8):** you can play one order per turn by default (order limit 1, 11.8.2.1.1.1). Grade must be ≤ your vanguard's grade. Main-phase orders are "non-blitz orders" (9.9.2.3). **Blitz orders** are played by the defending player in the guard step (10.5.1.2.5). After resolving, a non-set order goes to the drop zone (11.8.3.2). A **set order** goes to the Order Zone (4.17, 11.8.3.3), where it has an orientation (stand/rest) and a facing (face up/down) — CR
- **Regalis Piece (14.51):** a CONT keyword. Only 1 per deck. Each player may resolve only one Regalis Piece card per game unless an effect raises the limit; any further one goes to the drop zone without resolving — CR
- **Sentinel (14.10):** a CONT keyword that only limits deck building (max 4, 8.1.7). The "perfect guard" effect is separate card text. One guide says perfect-guard text usually costs a discard and makes the attacked unit unable to be hit that battle — [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf); [steamah guide (secondary)](https://steamah.com/cardfight-vanguard-dear-days-basics-to-advanced/)
- **Ride deck crest (2.9.3.6):** a card added to the ride deck during deck building, e.g. Energy Generator. In Standard the ride deck is G0 + G1 + G2 + G3 + a ride deck crest, and Energy Generator works with any nation. Some products have special ride decks: Griphosid (6 cards), Sephirosid, Touken Ranbu, Buddyfight, Kazuma Kiryu — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)
- **Markers and pseudo-cards (15.1–15.8):** a marker is either a pseudo-card or a record. A marker only has the information the rules or effects give it; a missing number counts as 0 (15.1.2.4.2) — CR
  - **Token units (15.4.3):** fields are type, grade, power, critical, name, race, skill icon and text. Examples: Plant (G0 5000, Boost), Shadow Army (G1 15000, Boost), Vision (G3 13000, Twin Drive), Evil Decoy, Skeleton Army, Mask of Domination, Blast — CR §15.4 + Supplement A1
  - **Token set orders:** e.g. Forge, Shinobi Scrolls, Destined Timepiece, SYSTEM CODE: Xceed — CR Supplement A1
  - **Tickets (15.5):** main type order with special type "ticket". Fields are type, grade, name and text. They only work in the hand and the order area and are erased anywhere else. Examples: Persona Shield (a G0 Blitz Order: +10000 to an attacked unit, lets you play up to two blitz orders this turn, and it can't be discarded for ride-deck costs), Quick Shield, Guardian Shield — CR §15.5 + Supplement A1
  - **Crests (15.7):** pseudo-cards in the Crest Zone (4.19) with type, name and text, active only there. Examples: Chronojet Dragon, Dragheart Luard, Nightrose, the "… Ability Kiwame" crests (Touken Ranbu) — CR
  - **Other markers:** Meer's Present (hand only), Cradle, Dragontree, Infinity Eyes. **Gift markers** (16.2.1.3) come from imaginary gifts (Force/Accel/Protect, type I or II) — CR §15–16
- **Gauge (4.15, 7.40):** cards in the gauge zone, either linked to a unit or player or with a name ("plant gauge"). They go to the drop zone when the linked unit leaves the field — CR
- **Game states that change a card:** heart (Stride), originalDress / overDress / XoverDress (D, 6.7–6.8), attached (6.9), Alchemix units (6.10), locked (7.30), deleted (7.32), legion / D-legion (6.4) — CR

**Deck rules a validator needs**
- Main deck is exactly 50 cards with no G units (8.1.4.1). The ride deck has 4+ cards (8.1.4.2). Max 4 copies per name across main + ride. Exactly 16 triggers across main + ride, with at most 4 heal and at most 1 over (8.1.6). At most 4 sentinels (8.1.7) and at most 1 Regalis Piece (8.1.8) — CR
- In Standard, critical, draw and front triggers are each capped at 8 — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)
- Formats: Standard (D icon cards, one nation, ride deck), V Premium (V icon, one clan, no ride deck), Premium Clan Fight (all cards, G decks allowed), Premium Extreme (mixed clans, triggers work without the same-clan condition) — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/)
- Energy can't go above 10, and you can't Energy-Blast more energy than you have — [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/); CR 7.48–7.49

### Inferences
- A suggested card record that extends the current Vanguard Table model:
  `{id, name, aliases[] (also-regarded-as / DressUp), mainType: unit|order|crest|rideDeckCrest|ticket|token|marker, subtype: normal|trigger|G|setOrder|blitzOrder|normalOrder, specialTypes[], grade, power, crit (default 1), shield|null, drive (default 1; 2 = Twin, 3 = Triple), skills[]: boost|intercept|twinDrive|tripleDrive, trigger: null|crit|draw|front|heal|stand|over, triggerPower (number on the icon, e.g. 10000), keywords[]: sentinel|regalisPiece|aceUnit|resist|restraint|lord|forerunner|..., personaRide:bool, gift: null|force1|force2|accel1|accel2|protect1|protect2, nations[], clans[], races[], fighterIcon, setCode, number, rarity, artist, image, text, abilities[]}`
- Stand triggers (11.10.2.4) still exist in older formats, so the current `trigger` enum (which has no "stand") cannot hold Premium cards.
- Tokens, tickets and crests can use the same record with `isPseudo:true` and a `validZones` list (e.g. ticket = hand + order area; crest = crest zone).

### Gaps
- The exact printed text of the **Energy Generator** crest (charge amount per turn, ACT abilities) is not in CR 4.59 or the Fighter's Rules page. Only the 10-energy cap and the blast rule are confirmed. Check the card itself before coding it.
- Supplement B (nation → clan mapping) was not extracted in full.

---

## Q2: What are all the ability types, qualifiers, costs, conditions and common effects?

### Takeaway
There are five ability categories: ACT, AUTO, CONT, order abilities and trigger abilities. Card text follows a fixed template: `TYPE zone [restriction]: (condition) [COST] effect`. Restrictions are icons (1/Turn, 1/Fight, divine and unique skill icons). Keyword conditions (Limit Break, Generation Break, Brave, Oracle and others) are "activation condition keywords". Costs are paid together, all or nothing.

### Cited Findings
**Ability categories and templates (CR 11.1)**
- **ACT:** template "ACT zone:(condition) [cost] effect". It can be played by a player who has a play timing. An ACT without a cost still has to be chosen; it never plays itself (11.1.1.1.2.1) — [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **AUTO:** templates "AUTO zone:When (condition), effect" and "AUTO zone:At the beginning of (phase/step), effect". If the card's own movement triggers it, the zone is left out ("AUTO:When…"). The event is called the trigger condition. AUTO abilities can carry a cost "[cost]" that is paid when they resolve (11.1.1.2.2). AUTO abilities in hidden zones only trigger if the card says so (11.1.1.2.1.1) — CR
- **CONT:** "CONT zone:effect". With no zone, it works in every zone (11.1.1.3) — CR
- **Order abilities:** the text of an order card, with no ACT/AUTO/CONT icon (11.1.1.4) — CR
- **Trigger abilities:** the effects of the trigger icon (11.1.1.5, 11.10) — CR

**Zone / circle qualifiers:** the zone tag says where the ability works: (VC), (RC), (GC), (VC/RC), Hand, Soul, Drop, Order Zone, and so on. An effect on a unit "with no zone" means a card on the field (2.9.3.1.1) — CR §11.1, 2.9.3.1.1

**Restriction icons (CR 12.3)**
- **[1/Turn]** = "during this turn" and **[1/Fight]** = "during this game". When they come right after AUTO/ACT or after the zone, the ability can't be used again for that period once the effect has changed the game state (12.3.2.3) — CR
- The **divine skill** and **unique skill** icons go before AUTO/ACT. After use, that player can't use any ability with the same icon for the rest of the game (12.3.3–12.3.4) — CR
- Text like "This ability cannot be used for the rest of that turn/game" still resolves even if a requirement isn't met, as long as the game state changed (11.2.1.1.1) — CR

**Activation-condition keywords (CR 14.2):** each is a CONT condition that sits after CONT/AUTO/ACT, the restriction icon or the zone.
- **Limit Break N (14.7):** you have N or more cards in your damage zone (usually 4, sometimes 5) — CR
- **Generation Break N (14.14):** you have N or more face-up G units on the field and in the G zone — CR
- Others: **Brave** (3 or fewer cards in hand, 14.17), **Oracle** (5 or more in hand, 14.18), **Ritual** (grade 1s in drop, 14.20), **Unite** (calls this turn, 14.21), **Thunderstrike N** (opponent's bind zone, 14.28), **Darkness** (cards put into soul this turn other than by riding, 14.32), **Dark Device** (14.38), **White Wings / Black Wings** (14.43), **Powerful** (soul has 0 cards, 14.45) — CR
- Other keyword abilities in §14: Forerunner, Lord, Restraint, Seek Mate / D-Seek Mate, Stride / Ultimate Stride, Resist (opponent can't choose it), G Guardian, Rescue, Revelation, Blaze, Dominate, Engorge, Shadowstitch, Rush, Burst, Charge, Magia, Time Leap, Hollow, Harmony, Wave, Success, Bloom, Melody, overDress, DressBoost, Friend, Glitter, RevolDress / DrægDress, XoverDress, Cannonball, Regalis Piece, DressUp, UnisonDress, Overcharge, Malwyrm, Ace Unit (max 1 in deck), Rewrite, Mental Pollution, Happy Toys, SweetLink, Arma Arms, Fantôme Skill — CR §14
- **Persona Ride (6.3.8, 7.15.1.4):** a *normal* ride from **hand** onto a vanguard with the same name, where both cards have the persona ride icon. Effect: draw 1, and until end of turn your units on front-row circles get +10000 — CR
- **"If your vanguard is X" / "during your turn" / "if you have N cards in soul":** these are ordinary written conditions (requirements, 11.2) and not keywords. Conditions written before a list are fixed when that part resolves (11.8.3.1.2.1) — CR

**Costs (11.7 + specific actions)**
- All costs are paid at the same time, and you pay with things you are the master of (11.7.1). An AUTO cost is all-or-nothing: if you can't pay all of it you pay none, and the text after the cost doesn't happen (11.9.5) — CR
- "Pay all" costs can be paid even when the amount is effectively 0 (11.7.3) — CR
- **Counter-Blast N (7.24):** turn N face-up damage-zone cards face down. "CB N – (condition)" limits which cards can be chosen — CR
- **Soul-Blast N (7.25):** move N cards from soul to the drop zone — CR
- **Energy-Blast N (7.49):** reduce your energy by N; you can't if you have less than N — CR
- **Discard (7.9):** any move from deck, hand or gauge to the drop zone counts as a discard — CR
- Other costs seen in text: rest a unit, retire rear-guards, put a card into soul, bind, reveal (revealed costs are decided first and revealed when paid, 7.10.2), and alternative call costs ("may (action) to call", 11.7.1.1). Riding from the ride deck needs a discard from hand ([official overDress guide](https://en.cf-vanguard.com/?p=44300)). Abilities can raise or lower cost numbers ("Counter-Blast cost −1 next time", 7.28) — CR

**Resource gains:** Counter-Charge N (turn face-down damage cards face up, 7.26), Soul-Charge N (top N cards of the deck go to soul, 7.27), Energy-Charge N (raise energy, capped at the limit; if nothing increases it doesn't count as a charge, 7.48) — CR

**Trigger effects (11.10.2):** each trigger gives power to a unit equal to the number on its icon (11.10.5), plus:
- **Critical:** +1 critical to a unit until end of turn
- **Draw:** draw 1
- **Stand** (older formats): stand a rear-guard, which then can't drive check this turn
- **Heal:** heal 1 if your damage ≥ the opponent's
- **Front:** all your front-row units get the power, and no single-unit power gain
- **Over:** remove this card from the game, draw 1, one unit gets +100,000,000, and on a drive check also do the extra text on the card
- Source: CR. The 2021 guide says an Over Trigger has a 50,000 shield when drawn: [overDress guide](https://en.cf-vanguard.com/?p=44300)

**Common effect verbs defined in CR §7:** stand/rest (7.2), face up/down (7.3), put (7.4), draw / move from deck (7.6), look at top N / look at up to N (7.7), switch (7.8), discard (7.9), reveal (7.10), search (7.11), shuffle (7.12; a searched card is not shuffled back in), declare (7.13), give/lose/get an ability (7.14), activate (7.15), "trigger unit is revealed" (7.16), place (7.17), retire (7.18), remove from game (7.19), heal (7.20), drive check (7.22), damage check (7.23), bind (7.29), lock/unlock (7.30–7.31), delete (7.32), time leap (7.33), move unit (7.34), deal damage (7.35), attack (7.36), battle (7.37), dominate (7.39), gauge (7.40), stage (7.41), Final Rush / Final Burst (7.42; a flag with no rules effect of its own), twin drive (7.46), boost (7.47), choose / cannot be chosen (7.50) — CR
- **Choose (7.50, 11.8.4):** "N units get…" means "choose N". With a fixed number you must choose as many as you can. With "up to N" you may choose 0 — CR

### Inferences
- A suggested ability schema:
  `{kind: ACT|AUTO|CONT|ORDER|TRIGGER, zones[], restriction: null|turn|fight|divine|unique, keywordConds[] (limitBreak:N, generationBreak:N, brave, oracle, darkness, …), when (event), conds[], costs[] (cb, sb, eb, discard, rest, retire, soul, bind, reveal), effects[] (list rows, each optional/mandatory), mayFlag, duration}`
- The current Vanguard Table field `once: ""|turn|game` maps to [1/Turn] / [1/Fight]. It is missing the divine and unique skill icon restrictions.

### Gaps
- **No official or community frequency data** for effect patterns on D/DivineZ cards was found. The list below is an inference from CR terms and familiarity with the templating, not a measured ranking. Running the CGS `effect` texts through a regex counter (CLAUDE.md task 2) would produce a real ranking.
- Likely common D/DivineZ patterns, unranked and inferred (~50): +N power until end of turn / end of that battle; +1 critical; drive +1; draw 1; CB1 / CB2 costs; SB1 / SB2 costs; EB2 / EB3 / EB7 costs; Energy-Charge N; soul-charge 1; counter-charge 1; look at top N, add 1 to hand, rest to drop / bottom; search deck for a named card, reveal, add to hand, shuffle; superior call from deck / drop / soul / hand to (RC); retire 1 opponent rear-guard (often grade ≤ N, front row); opponent chooses and retires; bind; lock; stand a rear-guard / stand the vanguard; rest a unit; put a card into soul; put on bottom of deck; "when placed on (VC)/(RC)"; "when this unit attacks"; "when this unit boosts"; "when attack hits"; "when attack does not hit" / "at the end of the battle this unit attacked"; "when ridden upon"; "when put into soul"; "when retired"; "at the beginning of your ride / main / battle phase"; "when your drive check reveals a trigger"; "during your turn" CONT +power; "if your vanguard is (name)" / "if you persona rode this turn"; "for each card in soul/drop, +power"; "cannot be hit until end of that battle" (perfect guard); "cannot guard from hand with grade ≥ N"; "cannot intercept"; "cannot call / ride grade N"; "+shield" to guardians; "choose up to N"; "you may … If you do, …" chains; "this ability cannot be used for the rest of that turn"; give a unit an ability ("gets 'AUTO …'"); Final Rush or other per-series flags; set order "Prison", "Alchemagic", "overDress" or "Arms" style series mechanics.

---

## Q3: What do the key terms mean exactly?

### Takeaway
The CR defines each term as a specific action. The ones an engine most needs:
- **Superior call / ride:** any call or ride that isn't the turn player's standard play from hand using the rules and the normal cost.
- **Retire:** field → drop zone.
- **Bind:** move to the bind zone.
- **Lock:** turn face down, with the circle becoming a lock type circle.
- **Hit:** at the damage step, the attacked unit's power is ≤ the attacker's power.

### Cited Findings
- **Call (6.2):** putting a unit on a rear-guard circle or guardian circle. A **normal call** is the turn player playing a unit from hand by the rules with no cost change. A **superior call** is any call that doesn't meet those conditions (effects, other zones, changed costs) (6.2.2). Placing a unit on a circle that already has one retires the old unit (6.2.3.4). A called unit is a new card (6.2.5). overDress / XoverDress placements are *not* calls (6.7.1.1, 6.8.1.1) — [CR](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Main-phase normal call:** a unit with grade ≤ your vanguard's grade, from hand to any rear-guard circle (9.9.2.1) — CR
- **Ride (6.3, 9.7.2):** putting a unit on the vanguard circle. A normal ride uses a hand card of the same grade or +1, or a face-down ride deck card of exactly +1. Anything else is a **superior ride** (6.3.2). "Put a rear-guard onto (VC)" by an ability also counts as a ride (7.4.1.1) — CR
- **Place (7.17):** any move onto a circle from outside a circle, including call and ride. This is what "when placed" checks — CR
- **Move (7.34):** circle-to-circle movement on the field, including intercepts and swaps. Riding and calling are not moves — CR
- **Retire (7.18):** field → owner's drop zone. Any field → drop move counts as retired — CR
- **Bind (7.29):** move cards to the owner's bind zone — CR
- **Lock / Unlock (7.30–7.31):** the card turns face down and stands. It counts as a new card that is neither standing nor resting, and its circle becomes a lock type circle. Unlocking turns it face up. "Put as a locked card" also exists. A locked G unit goes to the G zone — CR
- **Delete (7.32, G era):** the vanguard turns face down. It loses its printed power and its text, but keeps its skill icons — CR
- **Rest / Stand (7.2):** change orientation; a rested unit can't attack or boost. **Boost (7.47):** rest a standing unit in the same column to add its power to the attacker for that battle — CR
- **Intercept (14.4):** a front-row rear-guard with Intercept that is not being attacked can move to the guardian circle while another of your units is attacked — CR
- **Hit (10.7.1.2):** at the damage step, every attacked unit with power ≤ the attacker's power is hit. A vanguard hit deals damage equal to the attacker's critical. A rear-guard hit is retired (§10.7) — CR
- **Guard (6.2.4, 10.5):** units called to the guardian circle add their shield to the power of the attacked unit they were assigned to. A guard call from hand is a normal call (10.5.1.2.2.1) — CR
- **Drive check (10.6, 7.22):** reveal the top card into the trigger zone, resolve its trigger, then put it into hand. Repeat once per point of drive. **Damage check (13.6):** the card goes to the damage zone after its trigger resolves — CR
- **Unit (2.9.3.1.1):** "unit" with no zone named means a card with main type unit on the field — CR
- **Activate vs resolve (7.15, 11.8):** to "activate" a CONT means it is in effect; to activate an ACT means to play and resolve it; to activate an AUTO means its trigger condition is met and it goes into **standby**. **Resolve** means carrying out the effects in the order written (11.8.3.1.1) — CR
- **Mandatory vs optional:** standby AUTO abilities *must* be played, but the player picks the order of their own (11.9.4.1). Optional effects say "you may" — CR
- **Ordering:** at each check timing, rule actions resolve first, then imaginary gifts (turn player first), then the turn player's standby AUTO abilities, then the non-turn player's (11.6.1). An AUTO that triggers several times goes into standby that many times (11.9.3) — CR
- **Effect categories (11.3):** one-shot, continuous (lasts for a stated time; "during this game" if none is stated), and replacement. If a continuous effect's duration already contradicts the game state, the effect isn't created (11.3.1.2.1) — CR
- **Replacement ("instead", 11.3.1.3, 11.12):** the original event doesn't happen at all. With several replacements, the affected player or master picks the order, and each applies at most once. An optional "you may … instead. If you do …" isn't applied if the choice can't be done — CR
- **Continuous effect layering (11.11.1):** apply in this order: printed values → "original" changes → rule changes → gaining/losing abilities → non-numeric changes → ± changes → boost/guardian/legion/attach additions → "set to" values — CR
- **Golden rules (1.3):** card text beats the rules. Impossible actions do nothing, and partially possible actions are done as far as they can be. A negative or zero count does nothing — CR
- **Cannot be affected (12.5):** matching effects can't choose the card or change it. **Resist (14.15):** the opponent's effects can't choose the card — CR
- **Gauge zone, Crest Zone, Order Zone, Ride Deck Zone, G Zone, Trigger Zone, Order Area:** defined in CR 4.13–4.19. A ride-deck card that would go back to the deck goes face up to the ride deck zone instead (4.18.4) — CR
- **Durations in text:** "until end of turn" and "until end of that battle". Continuous effects with no stated duration last the whole game (11.3.1.2) — CR
- Common trigger wordings that appear as engine events in the CR: "at the beginning of (phase/step)" (11.1.1.2.1), "when placed" (7.17), "when attacks" (attack step §10.4), "when boosts" (7.47), "when hits" (10.7), "when an attack against a vanguard does not hit" (Shadowstitch, 14.27), "at the beginning of damage step" (10.7.1.1), "when (trigger unit) is revealed" (7.16), "when ridden upon" / "when a unit rides on this unit" (Forerunner wording, 14.8.2) — CR

### Inferences
- An engine should keep three things separate:
  - "placed" (any arrival on a circle) from "called" (RC/GC only) from "ridden" (VC);
  - "retired" (field → drop zone only) from "put into drop" by other means;
  - normal from superior calls, because cards check "if this unit was normal called" and "superior call" restrictions.
- "Hit" is decided only at the damage step, so "cannot be hit" can be an engine flag that is checked at 10.7.1.2.

### Gaps
- CR section 10.4 (exact list of attack-step trigger points) and section 13 (all rule actions) were not extracted in full.
- The CR doesn't define "pay life". No life-payment cost was found in Vanguard; damage-based costs are Counter-Blast or "put a card into the damage zone / deal damage to your vanguard" (e.g. Rescue, 14.19).
- The wiki (cardfight.fandom.com) was blocked, so the era history of each keyword (e.g. when Limit Break, Generation Break or Persona Ride first appeared) is not cited.
