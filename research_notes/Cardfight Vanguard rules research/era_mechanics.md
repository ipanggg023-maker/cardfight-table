# Cardfight!! Vanguard special mechanics by era (2011 to late 2026), for a simulator

Main sources used (fetched 2026-11-12):
- CR459 = Comprehensive Rules ver. 4.59, 28 Aug 2026 (latest linked from the official How-to page) — https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf (index page: https://en.cf-vanguard.com/howto/)
- CR2014 = Comprehensive Rules (Nov 2014, Legion era) — https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf
- DECK = Deck construction / formats page — https://en.cf-vanguard.com/howto/fighters_rules/deckrules/
- FR = Fighter's Rules page — https://en.cf-vanguard.com/howto/fighters_rules/
- DSYS = "New Vanguard system in overDress" page — https://en.cf-vanguard.com/howto/d-series/
- cardfight.fandom.com returned HTTP 402 to automated fetches, so no fandom pages could be read. Mechanics that exist only as card-text keywords (not defined in the CR) are therefore marked **[unverified: memory]** where no fetched source backs them.

Section numbers like "CR459 6.3.8" point into the 4.59 PDF.

## Q1. How is each mechanic performed and paid for, and what limits apply?

### Takeaway
The current CR (4.59) still defines almost every engine-level mechanic from all eras: lock, delete, bind, legion, D-legion, stride/heart, G guardian, Generation Break, ultimate stride, time leap, imaginary gifts, ride deck, persona ride, energy, crests, over trigger, set orders and order zone, Alchemagic, overDress/XoverDress, arms, Regalis Piece, Divine/Unique Skill icons, attach, Alchemix, worlds. A simulator can be built from CR459 alone. The older "keywords" (Break Ride, Persona Blast, Crossride, Megablast, Final Turn, Ultimate Break) are card-text patterns with no rule section; you implement them as normal abilities.

### Cited Findings

#### Core turn structure that the special mechanics hook into (CR459 s.9)
- Turn order: Stand phase, then Draw phase (draw step, then G assist step), then Ride phase (ride step, then stride step), then Main, Battle and End phases. Players with a ride deck skip G assist. — [CR459 9.2–9.11](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- G assist (G era, no ride deck only): if the vanguard is below grade 3 and your hand has no unit exactly 1 grade higher, reveal your hand, look at the top 5, take up to 1 unit of vanguard grade + 1 and show it, then remove 2 cards from your hand from the game. Shuffle the deck either way. — [CR459 9.5.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Normal ride: once in the ride step. Either a hand unit of the same grade or 1 grade higher than the vanguard (the legion leader is the reference), or a face-down ride-deck unit exactly 1 grade higher. — [CR459 9.7.2, 6.4.3.2.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Main phase actions: call units with grade ≤ any non-mate vanguard; swap front and back rear-guards in a column; play non-blitz orders with grade ≤ the vanguard while under the order limit (default 1 per turn); use ACT abilities; overDress. — [CR459 9.9.2](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- End phase order:
  1. All G units not in heart state go from circles to the G zone face up (repeat until none are left), then any G heart cards follow.
  2. Locked and deleted cards return face up.
  3. Music orders go to the drop zone; units on Astral Plane circles go to the bottom of the deck; attached units detach to rear-guard circles.
  4. "When unlocked / turned face up / put into G zone" triggers fire, then "end of turn" triggers.
  5. "Until end of turn" effects expire.
  — [CR459 9.11](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)

#### ORIGINAL ERA (2011–2014)

- **Limit Break (LB)**: a condition keyword on CONT, AUTO or ACT abilities. It is met when your damage zone holds at least the number shown (usually 4, sometimes 5). — [CR459 14.7](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Break Ride**: [unverified: memory, no CR section] An AUTO "Limit Break" ability that triggers when this vanguard is ridden by a specific card/clan grade 3. It typically gives the new vanguard +10000 power plus a bonus, once. Implement as an AUTO "when rode upon" with an LB4 condition.
- **Persona Blast**: [unverified: memory] A cost pattern: discard a card with the same name as your vanguard. It is not defined in CR459. Implement as a cost "discard 1 card named X from hand".
- **Crossride**: [unverified: memory] A CONT on a specific grade 3: if a named grade 3 is in your soul, this unit gets +2000 power (in the 2012 rules). Implement as CONT power + "soul contains card name" condition.
- **Megablast**: [unverified: memory] An ACT on the VC with a large cost: usually CB5 + SB8 (exact numbers vary by card). Implement as an ordinary ACT with costs.
- **Final Turn**: [unverified: memory] A card-text flag (Dimension Police / Gold Paladin "Final Turn" style) meaning "you lose at the end of this turn if you didn't win". Not a rule. The newer "Final Rush/Final Burst" are rule-level statuses (see below).
- **Stand trigger** (removed from the modern game; the CR still defines it):
  - 2014 rules: stand 1 rear-guard; +5000 power to any unit. — [CR2014 2.8.1.1.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf)
  - CR459 rules: choose a unit. If it is a rear-guard, stand it; from the next battle on it cannot drive check this turn. Separately, a unit gets the icon power. — [CR459 11.10.2.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Triggers in general**:
  - Each icon has sub-abilities that you play one by one in any order. Critical, draw and stand each have 2 sub-abilities; heal has 2, and its heal part requires your damage ≥ the opponent's; front has 1 ("all front row units get icon power").
  - Power = the number printed under the icon (modern +10000).
  - A drive-checked card still in the trigger zone goes to hand.
  - "Nullify trigger effects" stops the trigger from being played at all.
  — [CR459 11.10, 10.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Sentinel / perfect guard**:
  - Sentinel is a CONT keyword; a deck may hold at most 4 sentinels in total, main + ride deck. — [CR459 14.10, 8.1.7](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - The "perfect guard" effect is card text: AUTO when placed on GC, discard a card, and a chosen unit cannot be hit this battle. The CR's "Protect" pseudo-card uses this same template. — [CR459 15.3.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - An over trigger's +100M can still be stopped by a sentinel's "cannot be hit". — [DSYS](https://en.cf-vanguard.com/howto/d-series/)
- **Bind zone**:
  - "Bind" moves cards to the owner's bind zone. — [CR459 7.29](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - The bind zone is public. Cards can be bound face down, and then only the owner may look at them; face-down bound cards have no information. Text marked "Bind Zone" is active only there. — [CR2014 4.9, 3.1.1.3.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf)
  - White Wings / Black Wings (Alestiel): the condition is that every face-up bind card has an odd or an even grade. An empty bind zone meets neither. Face-down cards are ignored. — [CR459 14.43](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Lock / Unlock** (Link Joker):
  - Locking turns the card face down and stands it. It counts as a new card with no information and is neither standing nor resting for references. Its circle becomes a "lock" circle, so nothing can be called there.
  - "Put as a locked card" retires (drops) whatever was on that circle immediately.
  - A G unit that gets locked goes to the G zone face up.
  - Unlock = turn face up in stand. This is not "standing", and the card is a new card.
  - All locked cards on the turn player's field unlock in that player's end phase.
  — [CR459 7.30, 7.31, 9.11.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Note on timing: CR459 9.11.3 says "in your field", so locks placed by the opponent on your units stay until YOUR end phase. Check card text, since many cards say "until end of opponent's turn".
- **Reverse** (Link Joker "Reverse" units, 2014): [unverified: memory] Card text that locks your own rear-guard as a cost, with the unit gaining "Reverse" and big bonuses. No CR section. Implement as abilities plus a "reversed" flag.
- **Delete** (Gyze era, 2016–17):
  - A deleted vanguard is turned face down but keeps its orientation. It is the same unit. Its power drops by its printed power (so it is usually 0 plus modifiers), and it loses all text while keeping skill icons.
  - It can still attack, guard and be boosted. Legion state is kept.
  - It returns face up at the end of its owner's turn.
  - If it is ridden upon, all vanguards on that circle go to the soul face up.
  — [CR459 7.32, 9.11.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)

#### LEGION (2014–15) and V-era / D-era Legion

- Seek Mate is an ACT. Conditions: this unit has never been in legion, and the opponent's vanguard is grade 3+.
  - Original/V Seek Mate cost: return 4 cards from the drop zone to the TOP of the deck in any order, plus the card's own printed costs.
  - Effect: search the deck for 1 named mate, legion it as legion mate, shuffle. Usable once per game.
  - D-Seek Mate (D-legion, newer) cost: return 4 cards from the drop to the deck, of which at most 2 may be trigger units. The trigger exceptions are icon images that did not extract.
  — [CR459 14.11](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Legion state:
  - The mate is placed beside the leader in the same orientation. This is not a ride.
  - Both are vanguards. Only the leader can be attacked or forced to be attacked.
  - Both rest or stand together. The legion attacks as both units; the mate's power is added to the leader.
  - Boost may go onto either unit.
  - Drive checks and critical use the LEGION LEADER's drive and crit. Damage = leader's crit.
  - Ride-grade checks use the leader. Riding on a legion sends both to the soul.
  - The legion ends if either card changes zone or becomes a heart.
  — [CR459 6.4, 10.4.1.3, 10.4.1.12.1, 10.6.1.2.1, 10.7.1.2, 10.7.1.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- D-legion: if both cards have the persona ride icon, they lose it while D-legioned. — [CR459 6.4.1.3.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- The 2014 rules agree: the mate cannot attack separately, both rest, combined power, damage = leader crit. — [CR2014 10.1.24](https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf)
- [unverified: memory] Original-era legions usually also required Limit Break 4 on the Seek Mate ACT (card text, not rule). V-era Seek Mate needs no LB, and the V-era Legion leader's printed power was typically 13000.

#### G ERA (2015–2017)

- **G deck / G zone**: up to 16 cards with subtype G and at most 4 per name. They go face down into the G zone at setup. — [CR459 8.1.4.3, 8.1.5, 8.2.1.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Stride (normal)**:
  - When: the stride step, right after the ride step.
  - Condition: both vanguards are grade 3+, OR your vanguard was grade 3+ at the start of your turn.
  - Default cost: discard cards from hand with total grade ≥ 3. A card's stride skill may print a different timing or cost.
  - Procedure: reveal the face-down G card, pay, and put it on VC in the current vanguard's orientation. This is NOT a ride. The old vanguard(s) become "heart" cards under it.
  - The G unit gains the heart's card name and adds the heart's power to its own (G units print 15000+; [unverified] the typical result is 26000).
  — [CR459 6.5, 6.6.2, 9.8, 14.12.3.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Heart rules**:
  - A heart card loses the unit type and keeps only power and name for references.
  - Effects on "units" don't reach it unless they say "heart".
  - A legion that becomes a heart keeps its legion state and is restored afterwards.
  - Riding on a strided VC puts all hearts into the soul.
  - When the G unit leaves (end phase → G zone face up), the heart returns to VC in the same orientation.
  — [CR459 6.5.2–6.5.4, 9.11.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Generation Break (GB)**: a condition keyword met when the number of face-up G cards in your G zone plus on your VC is at least N. — [CR459 14.14](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **G guardian (Generation Guard)**:
  - Who and when: the non-turn player, during the guard step.
  - Conditions: both vanguards are grade 3+, at most 3 face-up G guardians in the G zone, and a face-down G guardian available.
  - Procedure: flip it, pay its printed cost (usually discard a grade 1+ or a heal [unverified]), and call it to GC.
  - G guardians are retired first at the end of the battle and go to the G zone face up, which raises GB.
  — [CR459 10.5.1.2.3, 14.16, 10.7.1.10](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Triple drive**: [unverified: memory] Stride G units print "Triple Drive!!!" (drive 3). The engine-level rule is just "drive value" (CR459 10.6.1.3 loops checks up to drive).
- **Ultimate Stride**:
  - Timing as printed; the G card's nation must match your front VC.
  - You need ≥ 3 face-up cards in the G zone. Cost-reduction effects for stride don't apply.
  - When it returns to the G zone, ALL cards in the G zone are removed from the game.
  - Gyze cards use separate conditions: a grade 3+ vanguard, ≥ 5 different Zeroth Dragons in bind, and removing all your other cards from circles, soul and G zone.
  — [CR459 6.6.3, 14.13](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Time Leap** (G era, Gear Chronicle):
  - Bind the chosen rear-guard(s). For each one, search the deck for up to 1 card exactly 1 grade higher and call them all at once, then shuffle.
  - At end of turn, put each called unit on the bottom of the deck, and its bound partner is called back.
  — [CR459 7.33, 14.34](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Stride restricted by format: you may still set up a G deck; "can perform Stride" effects (e.g. D-era crests such as Chronojet/Messiah/Luard crests) re-enable normal stride. — [CR459 18.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Those D-era stride crests typically: allow Stride, set the original power of the named grade 3s to 13000, and give front-row units +5000 per face-up G zone card during your turn. — [CR459 Supplement A1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)

#### V ERA (2018–2020)

- **Imaginary Gift**: when you ride a card with a gift icon, you resolve that gift type. You may also get one from an effect. Only one gift clan type is allowed per player from rides: if you have resolved Force from a ride, later Accel rides do nothing. — [CR459 6.3.7, 16.3.1.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - You choose I or II the first time. Every later gift of that clan type in the game must use the same choice unless an effect specifies otherwise. — [CR459 16.3.1.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Gift marker text applies as a rule modification, not as an ability effect. — [CR459 16.2.1.3.1.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - **Force I**: put a marker on any VC or RC (it stacks). During your turn the unit on that circle gets +10000.
  - **Force II**: the unit on that circle has original critical 2.
  — [CR459 16.3.1.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - **Accel**: gain a new front-row RC. The 1st goes left of the leftmost front circle, the 2nd right of the rightmost, alternating after that. Both players' accel circles pair up by column (one player's 1st with the other's 2nd, and so on).
    - Accel I: the unit there gets +10000 during your turn.
    - Accel II: draw 1 card now; the unit there gets +5000 during your turn.
    - If the marker is removed, the unit there retires and the circle vanishes.
    — [CR459 16.3.1.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - **Protect I**: put a "Protect" pseudo-card into your hand. It has Sentinel and the text "when placed on GC, discard a card: one of your units cannot be hit this battle". Its grade is "protect". It exists only in hand or on GC and is erased anywhere else.
  - **Protect II**: put a marker on one RC. The unit there gets AUTO "when it intercepts, Shield +10000".
  — [CR459 16.3.1.6, 15.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - [unverified: memory] In V-series the gift icon was on all grade 3 units, so you gained 1 gift per grade-3 ride (each turn you rode or persona-rode a G3). Standard V-era G3s printed 13000 power.
- **V-Premium / V-era Stride / Ultimate Break**: [unverified: memory]
  - V-era "V Premium" re-introduced older mechanics in V-clan reprints: V-Legion; Stride with G units via V-series G cards [uncertain]; "Ultimate Break" = a condition keyword like Limit Break, but needing 5 damage.
  - Not defined in CR459 under those names; implement as a damage ≥ 5 condition.
- V Premium format bans ride decks (so no persona ride from ride deck, no crests). — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)

#### D / overDress ERA (2021–2023) and DivineZ (2024–2026)

- **Ride deck**:
  - Standard deck: 50-card main deck + a 5-card ride deck (G0, G1, G2, G3 + 1 "ride deck crest"). The G0 is the first vanguard. — [FR](https://en.cf-vanguard.com/howto/fighters_rules/)
  - At D launch the ride deck was 4 cards (G0–G3) and counted toward the 50. — [DSYS](https://en.cf-vanguard.com/howto/d-series/)
  - Special ride decks exist with 6 cards (e.g. Griphosid with an over trigger and Calamity cards; Touken Ranbu) or with set structures (Sephirosid). — [FR](https://en.cf-vanguard.com/howto/fighters_rules/)
  - Ride cost: reveal the ride-deck card, and if this is not an effect ride, discard 1 card from hand. The ride-deck card must be exactly vanguard grade + 1. — [CR459 6.3.3.2.2, 9.7.2](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Ride-deck cards that would go to the main deck return face up to the ride deck zone instead. Face-up cards there are public and ordered by the owner. — [CR459 4.18](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Card limits count main + ride deck together: ≤ 4 per name, exactly 16 triggers (heal ≤ 4, over ≤ 1, crit/draw/front ≤ 8 each in Standard), ≤ 4 sentinels, ≤ 1 Regalis Piece. — [CR459 8.1.5–8.1.8](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf); [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- **Persona Ride**:
  - Requirements: a NORMAL ride FROM HAND of a card with the same name as the current vanguard, where both cards have the persona ride icon. Riding from the ride deck never counts.
  - Effect: draw 1 card, and until end of turn your units get +10000 power while they are on front-row circles. This is a status on circles, so a unit called to the front row later also gets it, and a unit moved to the back row loses it.
  - The draw counts as "drawing by a card's ability".
  — [CR459 6.3.8, 7.15.1.4, 7.6.4.1.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf); FAQ [en.cf-vanguard.com/?p=44204](https://en.cf-vanguard.com/?p=44204)
  - Superior (effect) rides of a same-name card do not persona ride, because 6.3.8 requires a normal ride. — [CR459 6.3.2, 6.3.8](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Energy and Energy Generator crest**:
  - Each player has an energy value, minimum 0 and no maximum unless an effect sets one. — [CR459 3.1.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Energy-charge X: add X, capped at the limit. If the cap means nothing is added, it counts as not charged.
  - Energy-blast X: subtract X; it cannot be paid if energy < X.
  - Rule action: energy above the cap is cut down to the cap.
  — [CR459 7.48, 7.49, 13.13](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Energy works only with an Energy Generator in the crest zone. The maximum is 10. Energy Generator is allowed in every nation's ride deck. — [FR](https://en.cf-vanguard.com/howto/fighters_rules/)
  - Energy Generator card text (retailer listing of DZ-SS10/005EN):
    - Ride Deck AUTO: when it would be ridden, it goes to the crest zone instead; if you went second, Energy-Charge 3.
    - CONT: you may hold up to 10 energy.
    - AUTO: at the start of your ride phase, Energy-Charge 3.
    - ACT [1/turn]: Energy-Blast 7 to draw a card.
    — [tcgsync listing](https://admintcg.tcgsync.com/products/energy-generator-dz-ss10-005en-dz-ss10-shiki-otei-start-deck)
  - [uncertain] The exact moment the crest moves (most likely when your first ride from the ride deck happens, i.e. when your G0 is ridden upon at turn 1) should be checked against an official card image.
- **Crests (general)**: crest pseudo-cards / ride-deck crests live in the public crest zone, and their abilities work only there. "Gets a crest" creates the crest in your crest zone. — [CR459 4.19, 7.14.6, 11.4.4.1.1, 15.7](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Other crests listed in Supplement A1: Chronojet Dragon, Alter Ego Messiah, Dragheart Luard, Demon Stealth Dragon Shiranui "Oboro", Masked Magician Harri, Nightrose, Salome/Cecilia "heart" crests, Touken Ranbu "Kiwame" crests, Mushiking.
  - Examples of what they do: "You can Stride", or "you cannot ride a different name; same-name cards become G3/13000/crit 1 with Twin Drive and Persona Ride".
  — [CR459 Supplement A1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Over Trigger**:
  - Four sub-abilities:
    1. Remove this card from the game.
    2. Draw 1 card.
    3. One of your units gets +100,000,000 power.
    4. If this was a drive check, do the extra effect printed on the card (the "over trigger effect").
  - Deck limit: max 1 over trigger in the main + ride deck, and it counts toward the 16 triggers.
  - On a damage check it is removed and NOT put into damage.
  — [CR459 11.10.2.7, 8.1.6.2](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf); [DSYS](https://en.cf-vanguard.com/howto/d-series/)
  - In Premium (all clans), a choice restriction lets you play only one of: Zeroth Dragons of Zenith Peak, Ultima, or over triggers (up to 4 copies). — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- **Set orders / order zone**:
  - A set order resolves and then goes to the public order zone, where cards have orientation and facing; face-down ones have no information. The order zone stands during your stand phase. — [CR459 4.17, 11.8.3.3, 9.2.3](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Order limit: 1 order per turn by default. Normal orders are played in your main phase. Blitz orders are played by the defender in the guard step with grade ≤ their vanguard, and they share the same order limit. — [CR459 9.9.2.3, 10.5.1.2.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Token set orders exist only in the order zone. — [CR459 15.4.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Subtypes with special rules: Prison (Imprison), Song (sing), Music (goes to drop at end phase), Product (operate), Scout/storage. — [CR459 17.4–17.11](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **World / Dark Night / Abyssal Dark Night / Stray Garden**:
  - Each player has a "world" value, blank by default. Effects set it, and a new world replaces the old. It has no rule meaning; cards just check it. — [CR459 7.43](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - [unverified: memory] World set-order text: if your order zone holds only World cards, 1 World = Dark Night and 2+ = Abyssal Dark Night.
- **Alchemagic**:
  - While playing order A, you designate order B from your drop zone. [unverified: the "drop zone, same name not allowed, pay CB1 extra" details come from card/keyword text, not CR459.]
  - B's costs and conditions are added after A's, and B's text after A's; then A resolves. A also gains any CONT/AUTO abilities B has.
  — [CR459 7.44](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Prisms / Prismagic**: [unverified: memory, not in CR459] Lyrical Monasterio/"Prism" set orders and a "Prismagic" keyword exist in card text only. No rule section was found. Implement as card text.
- **overDress**:
  - In your main phase, put a hand unit (grade ≤ vanguard) with overDress onto one of your rear-guards that matches the printed condition. This is NOT a call.
  - The old unit becomes "originalDress" under it. The new unit is in the overDress state as long as it has originalDress.
  - The stack moves together, and leaving the field breaks the stack into normal cards. Ride-deck cards return to the ride deck face up.
  — [CR459 6.7, 9.9.2.5, 14.42](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Related keywords: DressBoost, RevolDress/DrägDress (ride a unit in stand after an attack), DressUp (extra card name), UnisonDress. — [CR459 14.44, 14.48, 14.52, 14.53](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **XoverDress**:
  - In the main phase, pick the required rear-guards matching the condition, move them all onto one circle as originalDress, and put the card on top. Any other unit left on that circle is dropped at the next rule action.
  - This is NOT overDress: XoverDress units don't count as "overDress" units.
  — [CR459 6.8, 14.49](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Arms (left/right arms orders)**:
  - When played, an arms order whose "Arms – (name)" matches a vanguard name goes onto that VC, associated with the vanguard. If there is no match, it goes to the drop zone.
  - It follows the vanguard when ridden or strode by a same-name unit.
  - Multiples of the same name on one circle: keep the last one placed. The arms order is dropped if the vanguard loses the name.
  — [CR459 17.7](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - [unverified: memory] Left/right distinction is card text (one left and one right per vanguard).
  - "Arma Arms" is a newer keyword label. — [CR459 14.61](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Regalis Piece**: max 1 per deck. Each player can resolve Regalis Piece cards/abilities only once per game (the limit is 1 unless raised). Extra ones go to the drop zone without effect. — [CR459 14.51, 8.1.8](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- **Divine Skill / Unique Skill** (DivineZ, 2024+):
  - Both are restriction icons printed before AUTO/ACT. After you use one, you cannot use any ability with that icon for the rest of the game. This is shared across ALL your cards, so effectively once per game per player.
  - A standing-by AUTO with the icon may be cancelled instead of used.
  — [CR459 12.3.3–12.3.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - An official announcement calls it a "once per fight" limit shared across your cards. — [en.cf-vanguard.com/?p=59857](https://en.cf-vanguard.com/?p=59857)
- **Other keywords in CR459 (mostly D/DZ)**:
  - Final Rush / Final Burst: player statuses with no rule meaning; Burst implies Rush. — [CR459 7.42](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Attach: a rear-guard goes onto the VC and is not a vanguard. It cannot attack or be attacked, and its abilities are nullified, but the vanguard gains its abilities and power. It returns to RC at the end phase. — [CR459 6.9, 9.11.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Alchemix: units stacked under an <Alchemix Body> token become one unit, using the top card's info. — [CR459 6.10](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Ace Unit: at most 1 Ace Unit card in the whole deck, whatever the name. — [CR459 14.56](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Restraint: the unit cannot attack (updated in 4.59). — [CR459 14.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Label-only keywords whose abilities are card text: Rewrite (ride from hand by ACT), Overcharge, Malwyrm, Mental Pollution, SweetLink, Happy Toys (no effect), Fantôme Skill, Glitter, Friend, Powerful (soul = 0), Cannonball, Harmony, Hollow, Dominate. — [CR459 14.25–14.62](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - Twin drive: "perform twin drive" makes even a rear-guard drive check twice. — [CR459 7.46](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
  - The 4.59 changelog (28 Aug 2026) lists only small changes: a new Fighter icon, a Restraint update, the storage counting rule, and Dominate wording. — [CR459 changelog](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)

### Inferences
- A practical simulator split:
  - **Engine rules**: ride deck + discard cost, persona ride, energy (cap 10 via crest), crest zone, over trigger (remove/draw/+100M/drive bonus), set orders + order zone + blitz timing + order limit, lock/delete/bind, legion, stride + heart + G zone + GB + G guardian, imaginary gifts, overDress/XoverDress, arms, Regalis/Divine/Unique once-per-game flags.
  - **Card-text only**: Break Ride, Persona Blast, Crossride, Megablast, Final Turn, Reverse, Ultimate Break, Prismagic, most DZ keywords.
- Persona ride +10000 should be modelled as a per-player "front row bonus until end of turn" that applies by position, not as a buff on specific units.
- Divine Skill can be one per-player boolean: `usedDivine`. Unique Skill is a second boolean. Regalis is a counter with limit 1.

### Gaps
- cardfight.fandom.com could not be fetched (HTTP 402), so exact historical numbers for Break Ride, Crossride (+2000?), Megablast costs, Ultimate Break and V-premium Stride are from memory only.
- The exact Energy Generator ride-deck trigger wording ("when ridden" vs "when your first vanguard is rode upon") comes from a retailer listing. Not checked on an official card image.
- No source for Prisms/Prismagic or DivineZ 2025–2026 set-specific new keywords beyond what CR459 lists (Malwyrm, Mental Pollution, SweetLink, Arma Arms, Fantôme Skill, Ace Unit, Overcharge, Rewrite). Their exact effects are card text.
- Exact G guardian costs and stride G-unit power (15000) are not in the CR (they are card text).

## Q2. Which formats allow each mechanic today?

### Takeaway
There are three official formats in late 2026:
- **Standard** (D-icon cards, one nation, ride deck + crest): ride deck, persona ride, energy, over trigger, set orders, overDress, Divine Skill. Stride only via special crests/combinations.
- **V Premium** (V-icon cards, one clan, no ride deck): imaginary gifts, V-legion, etc.
- **Premium** (all EN cards): Clan Fight allows everything inc. G decks. Extreme Fight mixes clans, has no ride decks, and triggers ignore clan.

### Cited Findings
- Standard (Nation Fight):
  - English D-icon cards plus listed equivalents, one nation.
  - 5-card ride deck + 50 main; 16 triggers (≤ 1 over, ≤ 4 heal, ≤ 8 each crit/draw/front).
  - G decks only for listed ride-deck combinations (Chronojet, Messiah, Dragheart, Masked Magician...).
  — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- V Premium (Clan Fight): V-icon cards, one clan, ride decks not allowed. — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- Premium (Clan Fight):
  - All English cards, one clan; nation cards must match the clan's nation.
  - G zone 0–16 cards of the clan; you must answer honestly if asked about the G deck count.
  - Neon Gyze lets any Zeroth Dragon into the G deck.
  — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/); [FR](https://en.cf-vanguard.com/howto/fighters_rules/)
- Premium (Extreme Fight): all cards and clans mixed, no ride deck, triggers don't need the clan match, and restrictions don't apply. — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)
- At D launch, the ride deck was Standard-only and not usable in V Premium or Premium. — [DSYS](https://en.cf-vanguard.com/howto/d-series/)
- The restriction list includes entries applicable from 1 May 2026. — [DECK](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/)

### Inferences
- For a hot-seat simulator, a "format" setting could toggle: ride deck on/off, G deck on/off, imaginary gifts (V cards), clan/nation match for triggers, and trigger caps.
- Since ride decks are banned in V Premium and Extreme, persona ride and Energy Generator are effectively Standard (or Premium Clan Fight) features.

### Gaps
- Whether Premium Clan Fight currently allows a D ride deck was not stated explicitly on the page (only V Premium and Extreme forbid it).
- No official doc on stride legality in Standard beyond the "listed combinations".

## Q3. Known tricky interactions

### Takeaway
Most bugs in a simulator come from zone/identity rules:
- locked, unlocked and called cards count as new cards;
- deleted cards are the same card;
- hearts are not units;
- overDress is not a call;
- legion drive and crit use the leader;
- persona ride works by position;
- energy is capped;
- the over trigger leaves the game.

### Cited Findings
- Called/ridden cards are new cards (lose prior buffs); unlocked cards are new cards and arrive standing without counting as "stand". — [CR459 6.2.5, 6.3.4, 7.31](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Deleted units keep modifiers given to them and stay the same card. A deleted vanguard with no text can be boosted, as in the official Alfred example. — [CR459 7.32.2, 7.32.6](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- "When rode upon" abilities only see the card in the zone it first went to (soul). If it moved on before resolving (e.g. soul blasted), it can't be called from the drop. — [CR459 6.3.5.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Guardian shield adds to the chosen attacked unit's power. With multiple attacked units (multi-target attacks), the defender assigns each guardian. Guardians are illegal if no unit is being attacked. — [CR459 6.2.4, 10.4.1.10, 13.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Power order of application: printed → "original" changes → rule modifications (gift markers) → ability gain/loss → non-numeric → +/- → boost/guardian/legion/attach additions → "set to" values last. — [CR459 11.11.1](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Damage only happens if the attacker is still on its circle with the same master. Critical ≤ 0 deals no damage. — [CR459 10.7.1.2.1, 10.7.1.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- End of battle: G guardians retire first (to the G zone face up), then guardians, then hit rear-guards. — [CR459 10.7.1.10](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Locking an Alchemix unit erases the token and drops the rest. Locking a unit with originalDress keeps the originalDress associated with the locked card. — [CR459 6.10.4, 7.30.7](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- A blitz order counts against the same 1-order-per-turn limit, tracked per player, so the defender can play a blitz in your turn even if they played an order in their own turn. "Number of times played this turn" resets each turn. — [CR459 10.5.1.2.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- A heal trigger heals only if your damage ≥ the opponent's. The power part still applies regardless. — [CR459 11.10.2.5](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- When a strided G unit's chosen heart leaves, a new non-G heart is chosen. If the G unit leaves while the heart has no other association, the heart returns as a unit in the G unit's place and orientation. — [CR459 6.5.4](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)
- Divine Skill: per community reports, a vanguard's ability nullification from a Divine Skill applies to that unit only, and riding a new vanguard escapes it. This is card-specific, not a rule. — [reddit thread](https://cal1.lr.ggtyler.dev/r/cardfightvanguard/comments/1g9rdum/i_need_help_understanding_how_blangdmires_divine) (community source, low confidence)

### Inferences
- Engine data model suggestions:
  - Slot flags: `locked`, `deleted`, `hearts[]`, `originalDress[]`, `arms[]`, `attached[]`, `giftMarkers[]`.
  - Player fields: `energy`/`energyMax`, `crests[]`, `orderZone[]`, `world`, `giftChoice{Force,Accel,Protect}`, `divineUsed`, `uniqueUsed`, `regalisUsed`, `ordersThisTurn`, `personaFrontBonus`.
- Over trigger: send to a "removed" zone, never to damage or hand.

### Gaps
- No fetched FAQ on edge cases like persona ride after a legion, or over trigger + "nullify triggers", beyond the CR text quoted. The official Q&A database (https://en.cf-vanguard.com/howto/question/) was not searched due to the tool budget.
