# Card ability catalogue

Made by `tools/card-census` from the public CGS card data (every English card from the first trial decks
to DZ-BT09). Reprints with the same name and text count once: **14,904 unique cards**.

Each row is one pattern that appears in card text: a kind of ability, where it works, a limit, a timing,
a cost, a condition, an effect or a keyword. "Cards" = how many unique cards use it at least once.
"Engine" = whether the ability blocks in `js/schema.js` + `js/engine.js` can build it today.

**Cards that only use ✅ patterns today: 3,796 (25.5%).**
Everything else needs at least one 🟡/❌ pattern (or the ✋ Manual block). The plan to close the gap is in
`docs/abilities/PLAN.md`.

Regex matching is approximate (±5–10% per row); it is meant to rank the work, not to judge single cards.
Re-run: `node tools/card-census/fetch.mjs && node tools/card-census/analyze.js && node tools/card-census/report.js`.

## Kind

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| [AUTO] ability | 10432 | 1938 | 2267 | 1970 | 3021 | 1236 | ✅ yes |  | Dead Armor Dragon; Harmonics Messiah; Progenitor Dragon of Deep Sea, Balanerena |
| [CONT] ability | 3629 | 511 | 655 | 708 | 1195 | 560 | ✅ yes |  | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Quaking Heavenly Dragon, Astraios Dragon |
| [ACT] ability | 2292 | 430 | 620 | 460 | 564 | 218 | ✅ yes |  | Battle Sister, Panettone; Progenitor Dragon of Lightning Flame, Gilgal; Quaking Heavenly Dragon, Astraios Dragon |

## Zone

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Works on (RC) | 7354 | 1327 | 1505 | 1700 | 1929 | 893 | ✅ yes |  | Battle Sister, Panettone; Dead Armor Dragon; Stealth Fiend, Kurobane Tengu |
| Works on (VC) | 4019 | 991 | 1019 | 1025 | 742 | 242 | ✅ yes |  | Harmonics Messiah; Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena |
| Works from hand | 551 | 21 | 77 | 112 | 257 | 84 | ❌ no | abilities that start in the hand (discard → effect, ACT from hand) | Hard Tile Breaker; Curiophase Dragon; Neatness Meteor Shower |
| Works on (GC) | 547 | 9 | 58 | 176 | 172 | 132 | ✅ yes |  | Aurora Battle Princess, Agra Rouge; Ardor Hatchet Dragon; Impediment Slicer |
| Works from the G zone | 484 | 58 | 374 | 10 | 37 | 5 | 🟡 partly | G zone CONT/AUTO while face up | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Harmonics Messiah |
| Works from the drop zone | 140 | 3 | 26 | 23 | 23 | 65 | ❌ no |  | Mage of Entwined Roots, Amergin; Blaze Maiden, Cindi; Examination Monster, Imigrar |
| Works from the soul | 87 |  | 18 | 19 | 35 | 15 | ❌ no |  | Direful Doll, Violetta; Squalid Freaks; Flaming Pony |
| Revealed from the deck / damage check | 56 |  | 24 | 1 | 31 |  | 🟡 partly |  | Heart Thump Worker; Stealth Dragon, Noroi; Blink Messiah |
| Works from the order zone (set orders) | 30 |  |  |  | 3 | 27 | ✅ yes |  | For Now, Forget the Passage of Time; Pollution Monster, Polpollute; Extreme Satellite Weaponry, Euryanthe |
| Works from the bind zone | 18 | 1 | 7 |  | 9 | 1 | ❌ no |  | Protector of Memories, Gear Puppy; Stealth Dragon, Tsukuyodachi; Stealth Dragon, Raidon Kunai |
| Works from the damage zone | 10 |  | 6 | 3 | 1 |  | ❌ no |  | Black Prepare, Arakiba; Black Carve, Ezezel; Doctoroid Radlas |

## Limit

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Mandatory vs 'you may pay the cost' | 2437 | 894 | 1449 | 94 |  |  | ✅ yes |  | Chrono Dran G; Supremacy Dragon, Claret Sword Dragon; Chronojet Dragon |
| [1/Turn] or [N/Turn] | 1722 | 38 | 419 | 399 | 559 | 307 | ✅ yes |  | Harmonics Messiah; Quaking Heavenly Dragon, Astraios Dragon; Demon World Marquis, Amon |
| Generation Break N | 1579 | 93 | 1265 | 107 | 82 | 32 | ✅ yes |  | Chrono Dran G; Supremacy Dragon, Claret Sword Dragon; Chronojet Dragon |
| Limit Break N | 351 | 279 | 61 | 2 |  | 9 | ✅ yes |  | Beast Deity, Frog Master; Eradicator, Spark Horn Dragon; Goshawk Liberator, Cadeau |
| If you went second / first | 151 | 7 |  |  | 112 | 32 | ❌ no |  | Sunrise Egg; Harmonics Messiah; Energy Generator |
| Only once a turn by a card with the same name | 64 | 1 |  | 50 | 13 |  | ❌ no | limit shared by every copy of the card | Pirate Swordsman, Colombard; Top Idol, Aqua; Skull Witch, Nemain |
| Divine Skill / Unique / Dangerous | 62 |  |  |  | 2 | 60 | ✅ yes |  | Fated One of Time, Liael=Amorta; High Five!; Fated One of Unparalleled, Varga Dragres |
| Ritual N (grade 1s in drop) | 60 | 4 | 35 | 5 | 15 | 1 | ❌ no |  | Dragheart, Luard; Journey to be a Dragon; Dragwizard, Cian |
| Once per fight / per game | 10 |  |  |  |  | 10 | ✅ yes |  | Fated One of Unparalleled, Varga Dragres; Fated One of Guiding Star, Welstra "Blitz Arms"; Fated One of Miracles, Rezael |

## Timing

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| When placed (VC/RC) | 3847 | 525 | 848 | 899 | 1059 | 516 | ✅ yes |  | Stealth Fiend, Kurobane Tengu; Knight of Tenacity, Aidan; Holy Great Sage of Black Shadows, Isabelle |
| When this unit attacks | 2277 | 522 | 497 | 391 | 575 | 292 | ✅ yes |  | Harmonics Messiah; Pile Deletor, Jaluel; Dragontree of Ecliptic Decimation, Griphogila |
| At the end of the battle | 1185 | 85 | 222 | 207 | 432 | 239 | ✅ yes |  | Harmonics Messiah; Dragonic Overlord the End; Protector of Memories, Gear Puppy |
| When your G unit strides / when this strides | 1111 | 83 | 695 | 112 | 169 | 52 | ✅ yes |  | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Zeroth Dragon of Distant Sea, Megiddo |
| When it attacks a vanguard / rear-guard | 955 | 252 | 345 | 120 | 163 | 75 | 🟡 partly | target filter on the attack event | Dragontree of Ecliptic Decimation, Griphogila; Perfect Performance, Ange; Dragonic Overlord "The Яe-birth" |
| When the attack hits | 839 | 335 | 281 | 87 | 120 | 16 | ✅ yes |  | Progenitor Dragon of Lightning Flame, Gilgal; Knight of War Damage, Fosado; Slow Kiss ―♡→, Nonna |
| When ridden / rode upon | 628 | 3 | 1 | 191 | 331 | 102 | ✅ yes |  | Sunrise Egg; Barcgal; BCS24/25 World Finals, Akina Myodo |
| When your unit rides this / persona ride | 601 | 241 | 229 | 22 | 78 | 31 | 🟡 partly |  | Dragheart, Luard; Energy Generator; Supremacy Dragon, Claret Sword Dragon |
| At the beginning of the guard step / when you guard | 591 | 111 | 288 | 61 | 100 | 31 | 🟡 partly |  | Maiden of Blossom Rain; Steam Guard, Kastilia; Lizard Soldier, Bellog |
| When placed from hand / from deck / from drop | 534 | 40 | 79 | 124 | 172 | 119 | ❌ no | the source zone of the call | Nightmare Doll, Tosca; Knight of Thriving, Palsolo; Giant Deity of Distant World, Valkerion |
| When this unit boosts / is boosted | 466 | 159 | 73 |  | 163 | 71 | 🟡 partly | 'is boosted' missing | Trickmoon; Rapid Charger; Swell Assault |
| At the beginning of your turn / ride / main / battle phase | 285 | 54 | 57 | 55 | 79 | 40 | ✅ yes |  | Harmonics Messiah; Dragheart, Luard; Energy Generator |
| When this unit / another unit is retired | 277 | 8 | 66 | 52 | 91 | 60 | ❌ no |  | Knight of Grief, Grania; King of Masks, Dantarian; Knight of Instant Slash, Greete |
| At the end of your / your opponent's turn | 257 | 18 | 102 | 27 | 66 | 44 | ✅ yes |  | Blue Artillery Dragon, Inlet Pulse Dragon; Chronojet Dragon; Desert Gunner, Goudan |
| When another unit / your other rear-guard is placed | 236 | 27 | 117 | 30 | 39 | 23 | ✅ yes |  | Chrono Dran G; Practicing in Secret, Mayzie; Molecular Clause Dragon |
| When this card is discarded | 234 | 5 | 56 | 6 | 112 | 55 | ❌ no |  | Hard Tile Breaker; Big Snake Witch, Solaria; Adhesive Monster, Nelbetron |
| When you pay Counter-Blast / Soul-Blast | 156 | 29 | 70 | 2 | 52 | 3 | ❌ no |  | Laurel Knight, Sicilus; Divine Sword, Ame-no-Murakumo; Lava Flow Dragon |
| When the attack does not hit | 152 | 13 | 61 | 29 | 45 | 4 | ❌ no |  | Interdimensional Dragon, Lost Age Dragon; Super Cosmic Hero, X-rogue; Fast Chase Golden Knight, Cambell |
| When this card is put into the soul / drop / bind / damage | 148 | 48 | 57 | 10 | 21 | 12 | ❌ no |  | Neatness Meteor Shower; Stealth Dragon, Tsukuyodachi; Steam Performer, Tougue |
| When a trigger effect / heal / stand trigger happens | 140 | 5 | 17 | 52 | 53 | 13 | ❌ no |  | Battle Sister, Panettone; Dragontree of Ecliptic Decimation, Griphogila; Exquisite Knight, Olwein |
| When a drive check reveals … | 134 | 41 | 32 | 31 | 26 | 4 | ❌ no |  | Exquisite Knight, Olwein; Divine Sister, Lepisto; Knight of Endurance, Lucan |
| When this card is unlocked | 106 | 49 | 38 | 6 | 8 | 5 | ✅ yes |  | Star-vader, Chaos Breaker Dragon; Star-vader, Dust Tail Unicorn; Knight of Entropy |
| When your opponent calls / their unit is placed | 105 | 2 |  | 40 | 39 | 24 | ❌ no |  | Dead Armor Dragon; Dragon Knight, Barkil; Fleet Swallower |
| When this unit is attacked | 91 | 3 | 20 | 11 | 38 | 19 | ✅ yes |  | Prescription Angel; Invasion Monster, Azuzuradon; Stealth Dragon, Raidon Kunai |
| When put into the drop from the GC | 84 | 10 | 19 | 20 | 16 | 19 | ❌ no |  | Defensing Roar; Giro; Lizard Soldier, Barja |
| When placed with overDress | 61 | 1 |  |  | 55 | 5 | ✅ yes |  | Vairina Exspecta; Prayers That Will Reach Someday; Blaze Maiden, Cindi |
| When a damage check reveals … | 53 |  | 24 | 2 | 25 | 2 | ❌ no |  | Heart Thump Worker; Stealth Dragon, Noroi; Blink Messiah |
| When you play an order / set order | 25 |  |  |  | 14 | 11 | ❌ no |  | Roughkur Hammer Dragon; Cardinal Deus, Orfist; Proof of Hard Work, Wilista |
| At the close step / end of the close step | 10 | 10 |  |  |  |  | ❌ no |  | Spectral Duke Dragon; Reckless Express; Fierce Leader, Zachary |
| When you call a card / a unit is called | 5 | 1 |  | 3 | 1 |  | 🟡 partly |  | Furyminute Dragon; Heavy Armament Dragon, Fusillaider; Jocular Cicada |
| When you draw / your opponent draws | 5 | 1 |  | 4 |  |  | ❌ no |  | Weather Girl, Saft; Miko of Spiritual Light, Kinuka; Weal Crane |
| When you heal / damage is recovered | 0 |  |  |  |  |  | ❌ no |  |  |

## Cost

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Counter-Blast N | 4279 | 772 | 1073 | 806 | 1183 | 445 | ✅ yes |  | Harmonics Messiah; Progenitor Dragon of Lightning Flame, Gilgal; Dragonic Overlord the End |
| Soul-Blast N | 2527 | 243 | 518 | 550 | 885 | 331 | ✅ yes |  | Dead Armor Dragon; Progenitor Dragon of Lightning Flame, Gilgal; Stealth Fiend, Kurobane Tengu |
| Discard card(s) from hand | 1028 | 31 | 50 | 377 | 447 | 123 | ✅ yes |  | Harmonics Messiah; Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena |
| Put this unit / a card into the soul | 883 | 140 | 265 | 146 | 243 | 89 | 🟡 partly | only this unit | Battle Sister, Panettone; Demon World Marquis, Amon; Chrono Dran G |
| Energy-Blast N | 344 | 3 |  |  | 36 | 305 | ✅ yes |  | Energy Generator; Light Elemental, Popowa; Gear Goat of Aperture Leaping |
| Retire this unit | 329 | 15 | 66 | 68 | 119 | 61 | ✅ yes |  | Dead Armor Dragon; Flower of Ruined Castle, Empousa; Knight of Occult, Golmark |
| Turn a G zone card face up / face down G cost | 182 | 8 | 94 | 51 | 18 | 11 | ❌ no |  | Untainted Holy Damsel, Green Katrina; Heat Wave Beast, Geomaglass; Snow Element, Blizza |
| Bind this card / unit | 160 | 7 | 38 | 15 | 66 | 34 | ❌ no |  | Protector of Memories, Gear Puppy; Pure Fragrance Maiden, Lexy; Mt. Osore Le Voile, Oh!Oni |
| Discard a specific card (grade, trigger, name) | 138 | 5 |  | 13 | 92 | 28 | 🟡 partly | filter on discarded card | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Zeroth Dragon of Distant Sea, Megiddo |
| Retire your other rear-guard(s) | 133 | 2 | 1 | 41 | 59 | 30 | ✅ yes |  | Autumn's Turning Maiden, Rosie; Dragheart, Luard; Resolute Pair of Eyes |
| Opponent pays / both players pay | 118 | 11 | 107 |  |  |  | ❌ no |  | Heat Elemental, Magum; Snow Element, Blizza; Great Sage of Contradiction, Jirron |
| Put this unit on top / bottom of deck | 103 | 5 | 47 | 17 | 22 | 12 | ❌ no |  | Inconspicuous Ambuscade, Museta; Spiral Cutie Angel; Gear Goat of Aperture Leaping |
| Return drop cards to the deck (Seek Mate) | 101 | 78 | 18 | 5 |  |  | ✅ yes |  | Cornered Stealth Rogue, Benijishi; Dragheart, Luard; Seeker, Light Saver Dragon |
| [Rest] this unit | 95 | 9 | 29 | 24 | 25 | 8 | ✅ yes |  | Witch of White Revelation, Fertida; Maiden of Irradiate; Fide Gaon |
| Reveal a card from hand | 88 | 6 |  | 13 | 45 | 24 | ❌ no |  | Harmonics Messiah; Masque of Hydragrum; Eternal Light Dragon, Regulastar Dragon |
| Cost reduced / ignore cost | 59 | 8 | 11 | 10 | 20 | 10 | ❌ no |  | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Elementaria Sanctitude |
| Choice of costs ('CB 1 or EB 2') | 13 |  |  |  |  | 13 | ❌ no |  | Dragritter, Falhart; Steam Gunner, Tizkar; Bullet of Creation, Pansmermia |
| [Rest] other units | 10 |  |  | 5 | 3 | 2 | ❌ no |  | Brutal Jack; Coolbau; Sharp Split Dragon |
| Turn damage face down (CB) or up | 0 |  |  |  |  |  | 🟡 partly |  |  |

## Condition

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| If your vanguard is / has a name | 1942 | 142 | 442 | 109 | 663 | 586 | ✅ yes |  | Knight of Grief, Grania; Blue Artillery Dragon, Inlet Pulse Dragon; Knight of Occult, Golmark |
| If you did / if you put / if you revealed (result of the earlier part) | 1391 | 104 | 301 | 223 | 459 | 304 | ❌ no | branch on what the earlier step did | Steam Maiden, Elul; Dragontree of Ecliptic Decimation, Griphogila; Lady Battler of the White Dwarf |
| During your / your opponent's turn | 1231 | 121 | 225 | 230 | 456 | 199 | ✅ yes |  | Demon World Marquis, Amon; Steam Maiden, Elul; Dragontree of Ecliptic Decimation, Griphogila |
| Counts: hand / soul / drop / damage / rear-guards ≥ N | 1088 | 190 | 254 | 116 | 389 | 139 | 🟡 partly | bind zone, face-up damage, opponent counts missing | Harmonics Messiah; Dragonic Overlord the End; Dueling Dragon King, ZANGEKI |
| If your opponent's vanguard is grade N+ | 662 | 81 | 13 | 153 | 242 | 173 | ✅ yes |  | Holy Great Sage of Black Shadows, Isabelle; Barcgal; Maiden of Irradiate |
| Number of face-up G cards | 564 | 62 | 450 | 19 | 23 | 10 | ✅ yes |  | Untainted Holy Damsel, Green Katrina; Supremacy Dragon, Claret Sword Dragon; Chronojet Dragon |
| Same column / column of this unit | 559 | 59 | 144 | 85 | 192 | 79 | ❌ no |  | Gunburst Linebacker; Aegir-roll Dragon; Maiden of Irradiate |
| If you have a <clan>/<nation> vanguard or unit | 545 | 473 | 26 | 6 | 15 | 25 | ❌ no | clan/nation filters in conditions | Gear Goat of Aperture Leaping; Scale Dragon of the Magma Cave; Guardian of the Skies, Night Griffon |
| Opponent's counts (their damage, hand, rear-guards) | 264 | 37 | 67 | 73 | 69 | 18 | 🟡 partly |  | Demon World Marquis, Amon; Dragon Knight, Barkil; Star-vader, Chaos Breaker Dragon |
| If your vanguard is in Legion | 208 | 161 | 44 | 1 |  | 2 | ✅ yes |  | Seeker, Light Saver Dragon; Holy Edge Celestial, Malchidael; Onmyo Stealth Rogue, Seimei |
| If your vanguard is grade N+ | 182 | 4 | 3 | 73 | 59 | 43 | ✅ yes |  | Elementaria Sanctitude; Afflated Lemur; Curiophase Dragon |
| If you have a heart card with … | 176 | 4 | 136 | 5 | 12 | 19 | ❌ no |  | Duo Absolute Sister, Meer; Rain Element, Madew; Snow Element, Valancher |
| If your order zone has N+ / a set order | 155 | 1 |  |  | 80 | 74 | ✅ yes |  | Kanone Schnellkrieger; Butterfly Diagram Repeater; Result of the Experiment Henceforth |
| If you persona rode this turn | 134 |  |  |  | 79 | 55 | ✅ yes |  | Spiral Cutie Angel; Everspring Hunter, Emerence; Stealth Fiend, Kawasohime |
| If this unit's / your vanguard's power is N+ | 115 | 17 | 50 | 24 | 22 | 2 | ❌ no |  | Luster Impact Dragon; Dragon Undead, Malefic Dragon; Label Pangolin |
| If it is the Nth battle | 86 | 35 | 21 | 23 | 7 |  | ❌ no |  | Couple Dagger Sailor; Light Elemental, Honoly; Light Signals Penguin Soldier |
| If this unit is boosted / rested / in a state | 53 | 6 | 31 | 5 | 10 | 1 | ❌ no |  | Aegir-roll Dragon; Admired Sparkle, Spica; Brisk Medical, Iruel |
| If you are in Dark Night / Abyssal Dark Night | 50 |  |  |  | 47 | 3 | ✅ yes |  | Cardinal Principle, Cagula; Eclipsed Moonlight; Cardinal Fang, Raphilogg |
| If a trigger / grade N was revealed | 34 | 4 | 1 | 4 | 18 | 7 | ❌ no |  | Almajestar, Schwart=Sparda; Sheltered Girl of the Pharmacy, Mediell; Confident Aqua, Musette |
| If the attacking unit is a vanguard / rear-guard | 7 |  | 1 |  | 6 |  | ❌ no |  | Prepared for the Heat, Siana; Second Snake's Opinion, Siana; Hidden in Darkness |

## Effect

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Durations: until end of battle / turn | 7386 | 1256 | 1804 | 1250 | 2096 | 980 | ✅ yes |  | Battle Sister, Panettone; Dead Armor Dragon; Harmonics Messiah |
| Power +/− | 7042 | 1206 | 1495 | 1240 | 2090 | 1011 | ✅ yes |  | Harmonics Messiah; Progenitor Dragon of Lightning Flame, Gilgal; Dragonic Overlord the End |
| Draw N | 2467 | 257 | 461 | 596 | 800 | 353 | ✅ yes |  | Stealth Fiend, Kurobane Tengu; Quaking Heavenly Dragon, Astraios Dragon; Protector of Memories, Gear Puppy |
| Shuffle the deck | 2271 | 367 | 548 | 373 | 591 | 392 | ✅ yes |  | Harmonics Messiah; Chrono Dran G; Nightmare Doll, Tosca |
| Put a card into the hand (from drop / soul / damage / field) | 1582 | 195 | 329 | 203 | 568 | 287 | 🟡 partly | only from deck/top | Flower of Ruined Castle, Empousa; Lady Battler of the White Dwarf; Cherishing Knight, Branwen |
| Search your deck for a card | 1493 | 384 | 429 | 181 | 323 | 176 | ✅ yes |  | Harmonics Messiah; Chrono Dran G; Dragheart, Luard |
| Look at the top N cards, take some | 1354 | 145 | 237 | 284 | 420 | 268 | ✅ yes |  | Battle Sister, Panettone; Nightmare Doll, Tosca; Knight of Thriving, Palsolo |
| Reveal the top card / reveal from hand | 1275 | 156 | 217 | 203 | 452 | 247 | 🟡 partly |  | Dragontree of Ecliptic Decimation, Griphogila; Lady Battler of the White Dwarf; Blue Sky Knight, Altmile |
| G zone: turn face up/down, put into G zone, Stride from … | 965 | 87 | 708 | 81 | 58 | 31 | 🟡 partly |  | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Harmonics Messiah |
| For each … (scaling bonus) | 910 | 81 | 275 | 162 | 288 | 104 | ❌ no |  | Demon World Marquis, Amon; Steam Maiden, Elul; Dragontree of Ecliptic Decimation, Griphogila |
| Put a card on top / bottom of the deck | 904 | 122 | 280 | 153 | 234 | 115 | ❌ no |  | Battle Sister, Panettone; Mage of Entwined Roots, Amergin; Jewelry Light, Claseena |
| Shield + | 859 | 37 | 170 | 118 | 315 | 219 | ✅ yes |  | Heat Wave Beast, Geomaglass; Aurora Battle Princess, Agra Rouge; Demonic Lord of Hades Blaze, Baphormedes |
| Put a card into the soul (from field / hand / drop / deck) | 804 | 72 | 182 | 128 | 251 | 171 | 🟡 partly |  | Nightmare Doll, Tosca; Stealth Dragon, Gengan; Witch of White Revelation, Fertida |
| Soul-Charge N | 800 | 119 | 209 | 139 | 255 | 78 | ✅ yes |  | King of Masks, Dantarian; Afflated Lemur; Knight of War Damage, Fosado |
| Retire opponent's rear-guard(s) | 779 | 168 | 188 | 120 | 213 | 90 | ✅ yes |  | Chronojet Dragon; Dragheart, Luard; Balance Wiggler |
| [Stand] a unit | 736 | 101 | 139 | 109 | 246 | 141 | ✅ yes |  | Dragonic Overlord the End; Blue Artillery Dragon, Inlet Pulse Dragon; Flower of Ruined Castle, Empousa |
| Discard as an effect (you or opponent) | 707 | 63 | 187 | 146 | 225 | 86 | 🟡 partly |  | Stealth Fiend, Kurobane Tengu; Harmonics Messiah; Lady Battler of the White Dwarf |
| Gets an ability ("[AUTO]…") / gets all of the following | 668 | 51 | 292 | 27 | 124 | 174 | ❌ no | granted abilities | Untainted Holy Damsel, Green Katrina; Ancestral Dragon King of Zenith Colors, Founaherdio; Great Dragon Emperor of Distant Blaze, Gidoradevalt |
| Counter-Charge N | 606 | 20 | 225 | 96 | 210 | 55 | ✅ yes |  | Progenitor Dragon of Lightning Flame, Gilgal; Steam Maiden, Elul; Trickmoon |
| Critical + | 588 | 95 | 119 | 115 | 184 | 75 | ✅ yes |  | Demon World Marquis, Amon; Dragontree of Ecliptic Decimation, Griphogila; Vairina Exspecta |
| Heal: damage to the drop | 538 | 59 | 230 | 146 | 71 | 32 | ✅ yes |  | Source Dragon Deity of Blessings, Blessfavor; Happiness Noble, Fairoid; Sphere Magus |
| Cannot attack / boost / intercept / be chosen / be retired | 510 | 165 | 84 | 76 | 117 | 68 | ❌ no | restriction effects | Knight of Tenacity, Aidan; Knight of War Damage, Fosado; Trickstar |
| Cannot be hit | 486 | 65 | 124 | 117 | 150 | 30 | ✅ yes |  | Elementaria Sanctitude; Maiden of Blossom Rain; Steam Guard, Kastilia |
| Call from hand | 438 | 36 | 133 | 90 | 125 | 54 | ✅ yes |  | Dead Armor Dragon; Ancestral Dragon King of Zenith Colors, Founaherdio; Great Dragon Emperor of Distant Blaze, Gidoradevalt |
| Replacement: instead / would … | 406 | 13 | 8 | 85 | 167 | 133 | ❌ no |  | Pile Deletor, Jaluel; Demon World Marquis, Amon; Steam Maiden, Elul |
| Call from the deck | 400 | 78 | 135 | 72 | 83 | 32 | 🟡 partly |  | Chrono Dran G; Perfect Performance, Ange; Seeker, Thing Saver Dragon |
| Restand the vanguard / units after battle | 392 | 47 | 65 | 74 | 131 | 75 | ✅ yes |  | Dragonic Overlord the End; Blue Artillery Dragon, Inlet Pulse Dragon; Flower of Ruined Castle, Empousa |
| Grade +N / is regarded as | 348 | 45 | 102 | 19 | 123 | 59 | ❌ no |  | Protector of Memories, Gear Puppy; Pile Deletor, Jaluel; Steam Maiden, Elul |
| Bind a card (from field / hand / deck / drop) | 331 | 19 | 115 | 76 | 77 | 44 | 🟡 partly |  | Goddess of the Sun, Amaterasu; Chronojet Dragon G; Refresh Time, Portia |
| Drive +/− | 329 | 9 | 51 | 69 | 144 | 56 | ✅ yes |  | Dragonic Overlord the End; Demon World Marquis, Amon; Relation Weaver, Petralka |
| Your opponent chooses (and retires/discards) | 312 | 30 | 128 | 64 | 76 | 14 | ❌ no | the other player makes the choice | Stealth Fiend, Kurobane Tengu; Demon World Marquis, Amon; Security Upgrader |
| Opponent cannot call (grade N / sentinels) to GC / RC | 271 | 12 | 63 | 84 | 76 | 36 | ❌ no |  | Dead Armor Dragon; Chronojet Dragon; Fleet Swallower |
| Markers (Protect, Force, Accel, crests, counters) | 265 | 12 | 1 | 88 | 118 | 46 | 🟡 partly |  | Quaking Heavenly Dragon, Astraios Dragon; Dragontree of Ecliptic Decimation, Griphogila; Energy Generator |
| Put a card into the drop (mill / from soul) | 263 | 39 | 82 | 69 | 55 | 18 | 🟡 partly |  | Holy Great Sage of Black Shadows, Isabelle; Mage of Entwined Roots, Amergin; Giant Deity of Distant World, Valkerion |
| Ride by an effect (from deck / drop / soul / hand) | 263 | 41 | 36 | 45 | 95 | 46 | ❌ no | Superior Ride | Chronojet Dragon; Seeker, Thing Saver Dragon; Dragheart, Luard |
| Call tokens (Plant / Shadow Army / Hollow…) | 261 | 9 | 25 | 72 | 109 | 46 | ❌ no | tokens | Untainted Holy Damsel, Green Katrina; Sunlight Garden's Guide; Stealth Dragon, Gengan |
| Call from the drop zone | 234 | 13 | 25 | 39 | 104 | 53 | ❌ no |  | Knight of Occult, Golmark; Pirate Swordsman, Colombard; Spiritual Body Condensation |
| Call from the soul | 226 | 33 | 47 | 45 | 67 | 34 | ❌ no |  | King of Masks, Dantarian; Master of Gravity, Baromagnes; One Who Governs Chaos |
| Lock / unlock | 223 | 59 | 83 | 27 | 38 | 16 | ✅ yes |  | Harmonics Messiah; Star-vader, Chaos Breaker Dragon; Prelude of Genesis |
| Choose one / perform N of the following | 161 |  |  | 8 | 92 | 61 | ❌ no | modal choice | Master of Gravity, Baromagnes; Hulappoi Lilikkoi; Earnescorrect Follower, Ortiimo |
| Power − to opponent's units | 157 | 53 | 34 | 24 | 35 | 11 | 🟡 partly |  | Explosive! Melting Heart!; Invasion Monster, Azuzuradon; Fleeting Shine That Lights Life |
| Deal damage / put cards into the damage zone | 150 | 48 | 40 | 23 | 38 | 1 | ❌ no |  | Incise Angel; Knight of Instant Slash, Greete; Prescription Angel |
| Move a rear-guard to another circle / swap | 137 | 15 | 42 | 26 | 37 | 17 | ❌ no | move by effect | Zeroth Dragon of Distant Sea, Megiddo; Dragontree of Ecliptic Decimation, Griphogila; Empyrean Blue Dragon, Shelling Cannon Dragon |
| Tickets / Quick Shield / crest-like markers | 133 | 3 |  | 93 | 25 | 12 | ❌ no | tickets | Barcgal; Harmonics Messiah; Persona Shield |
| Cannot guard with … / guard restrictions | 120 | 10 | 55 | 17 | 34 | 4 | ❌ no |  | Chronojet Dragon; Evil Eye of Prohibition, Quen Lu; Thunder Elemental, Gororo |
| States: Mental Pollution, Harmony, Melody, Pleasure… | 85 | 3 | 52 | 21 | 2 | 7 | ❌ no | named states | Wonder Frill, Nanoka; Dreaming Step, Shizuku; Superb New Student, Shizuku |
| Resist (cannot be chosen by opponent's effects) | 72 | 5 | 61 |  | 5 | 1 | ❌ no |  | Dark Metal Chameleon; Dark Element, Dizmel; Lady Skylark |
| Energy (generate, check, use) | 68 | 3 |  |  | 12 | 53 | ✅ yes |  | Energy Generator; Construct Golem; Blitz Sales, Stil |
| Extra attacks / attack from the back row | 67 |  | 16 | 5 | 23 | 23 | ❌ no |  | Empyrean Blue Dragon, Shelling Cannon Dragon; Phantasmic Stealth Fiend, Megalonozuchi; Dragritter of Flame Blade, Grhy |
| World (Dark Night) | 65 | 3 | 1 | 1 | 51 | 9 | ✅ yes |  | Cardinal Fang, Marizma; Cardinal Principle, Cagula; Eclipsed Moonlight |
| Energy-Charge N | 62 | 3 |  |  | 11 | 48 | ✅ yes |  | Energy Generator; Construct Golem; Blitz Sales, Stil |
| Call from the bind zone / damage zone | 62 | 6 | 25 | 12 | 14 | 5 | ❌ no |  | Steam Maiden, Elul; Prescription Angel; Medical Gunner, Hermieres |
| [Rest] a unit | 57 | 11 | 28 | 9 | 9 |  | ✅ yes |  | Stealth Fiend, Gashadokuro; Slapstick Worker; Commander Laurel |
| Delete | 51 | 8 | 31 | 10 | 2 |  | ✅ yes |  | Pile Deletor, Jaluel; Clipping Deletor, Evo; Waving Deletor, Greidhol |
| Time Leap | 36 | 4 | 25 | 4 | 3 |  | ✅ yes |  | Chronojet Dragon G; Tick-away Dragon; Furyminute Dragon |
| Card name becomes / also has the name | 16 | 3 | 1 | 1 | 6 | 5 | ❌ no |  | Aurora Star, Coral; Epee De Justice, Thegrea; Desire Devil, Saasyou |
| Durations: until end of your opponent's / your next turn | 4 |  |  | 2 | 2 |  | ❌ no |  | Wandering Starhulk Deity, Brandt Ringer; Wandering Starhulk Ruler, Brandt; A Viridescent Flash, Rorowa |
| Copy / gain the abilities of another card | 4 |  |  | 1 | 2 | 1 | ❌ no |  | Exceptional Expertise, Rising Nova; Atrocious? Moth Girl, Maple |
| Change drive checks (choose order, more checks, check from…) | 3 | 1 | 1 |  | 1 |  | ❌ no |  | Evil-eye Hades Emperor, Shiranui "Mukuro"; Rondo of Eventide Moon, Feltyrosa; Goddess of Good Luck, Fortuna |
| Gives trigger effects (critical, front, heal, draw…) / triggers more | 0 |  |  |  |  |  | ❌ no |  |  |

## Keyword

| Pattern | Cards | Original | G | V | D | DZ | Engine | Notes | Examples |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| Stride / G unit / Ultimate Stride | 1109 | 83 | 695 | 112 | 169 | 50 | ✅ yes |  | Progenitor Dragon of Lightning Flame, Gilgal; Progenitor Dragon of Deep Sea, Balanerena; Zeroth Dragon of Distant Sea, Megiddo |
| Sentinel (perfect guard) | 652 | 71 | 149 | 182 | 183 | 67 | ✅ yes |  | Elementaria Sanctitude; Maiden of Blossom Rain; Steam Guard, Kastilia |
| Boost / Intercept / Twin Drive skill icons | 643 | 302 | 286 | 15 | 29 | 11 | ✅ yes |  | Elementaria Sanctitude; Diabolos Madonna, Mabel; Time Stamping Dragon |
| G Guardian | 330 | 16 | 147 | 78 | 72 | 17 | ✅ yes |  | Light Element, Agleam; Metal Element, Scryew; Dark Element, Dizmel |
| Forerunner | 291 | 95 | 191 | 2 | 3 |  | ❌ no |  | Chrono Dran G; Red Pulse Dracokid; Wingal Liberator |
| Set order / Prison / World / Song | 287 | 4 |  | 1 | 201 | 81 | 🟡 partly | Prison and Song subtypes missing | Kanone Schnellkrieger; Explosive! Melting Heart!; Flash Scissors Monster, Scissors Bar |
| Legion / Seek Mate | 208 | 161 | 44 | 1 |  | 2 | ✅ yes |  | Seeker, Light Saver Dragon; Holy Edge Celestial, Malchidael; Onmyo Stealth Rogue, Seimei |
| Lock (Link Joker) | 166 | 49 | 57 | 13 | 38 | 9 | ✅ yes |  | Star-vader, Chaos Breaker Dragon; Dragonic Overlord "The Яe-birth"; Prelude of Genesis |
| Lord (cannot attack without same clan) | 163 | 126 | 25 | 4 | 4 | 4 | ❌ no |  | Knight of Old Fate, Cordiela; Pentagonal Magus; Binary Star Twin Gunner |
| Imaginary Gift (Force/Accel/Protect) | 160 | 11 | 19 | 72 | 54 | 4 | ✅ yes |  | Quaking Heavenly Dragon, Astraios Dragon; Perfect Performance, Ange; Seeker, Thing Saver Dragon |
| Glitter (Bermuda) | 152 | 1 |  |  | 129 | 22 | ❌ no |  | Fountain of Knowledge, Eva; Result of the Experiment Henceforth; Shutter Chance, Ilse |
| overDress / XoverDress / RevolDress / DressBoost | 87 | 2 |  |  | 77 | 8 | 🟡 partly | RevolDress and DressBoost missing | Vairina Exspecta; Trickmoon; Prayers That Will Reach Someday |
| Melody / Harmony / Happy Toys / Oversized / Völundr / ExplosiveGrowth | 85 |  |  | 19 | 35 | 31 | ❌ no | D-era keyword skills | The Close Pair Under the Moonlit Night; Live in Utopia, Luka; 5 Together, Sonata |
| Persona Ride | 84 |  |  |  | 56 | 28 | ✅ yes |  | Oath of Vengeance, Thegrea; Masque of Hydragrum; Everspring Hunter, Emerence |
| Over trigger (+100M, its own text) | 75 | 1 |  | 2 | 42 | 30 | ✅ yes |  | Dragontree of Ecliptic Decimation, Griphogila; CARDFIGHT!! VANGUARD overDress; Spiritual King of Determination, Olbaria |
| Crests (Energy Generator and others) | 67 | 3 | 1 |  | 41 | 22 | 🟡 partly | only Energy Generator | Energy Generator; Footprints Marking Passage of Time; Prelude of Genesis |
| Arms (left/right) | 66 |  |  |  | 51 | 15 | ✅ yes |  | Sealed Blaze Dragon, Samahdi; Blaze Maiden, Cindi; Resourceful Mechanic, Winston |
| Blitz order | 53 |  |  | 1 | 22 | 30 | ✅ yes |  | Pure Fragrance Maiden, Lexy; Effervescent Shadow Dream Blade; Prepared for the Heat, Siana |
| Regalis Piece | 49 |  |  |  | 17 | 32 | ✅ yes |  | Union the Sky; Cardinal Fang, Raphilogg; Days of Training, Lascaria |
| Mate unit / ExtraDeck-like ('cannot be in your main deck') | 36 | 3 | 17 |  | 8 | 8 | 🟡 partly |  | Heat Elemental, Magum; Golden Dragon, Rising Shine Dragon; Holy Dragon, Religious Soul Saver |
| Alchemagic | 25 |  |  |  | 22 | 3 | ✅ yes |  | Fleet Swallower; Cursed Souls Squirming in Agony; Mysterious Rain Spiritualist, Zorga |
| Front trigger | 25 |  |  | 15 | 10 |  | ✅ yes |  | Wandering Starhulk Deity, Brandt Ringer; Fighting Fist Dragon, God Hand Dragon; Fusing Striker |
| Ace Unit | 6 |  |  |  |  | 6 | ✅ yes |  | Dragritter, Miqdard; Depravity Funeral Judgment, Valack; Veirmeil Exordia |
| Break Ride | 5 |  | 5 |  |  |  | ❌ no |  | Neumond Blaukluger; Brand-New-PR♥ISM, Glister Emeral; Spade Jack of Nightmareland |
| Cross Ride / Cross Break Ride | 0 |  |  |  |  |  | ❌ no |  |  |
| Trigger order | 0 |  |  |  |  |  | ❌ no |  |  |
| Stand trigger | 0 |  |  |  |  |  | ✅ yes |  |  |

