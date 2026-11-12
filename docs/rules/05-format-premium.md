# 05 · Premium (Clan Fight and Extreme Fight)

Premium allows **every EN card ever released**. Sources: [Deck Construction Rules](https://en.cf-vanguard.com/howto/fighters_rules/deckrules/), [Fighter's Rules](https://en.cf-vanguard.com/howto/fighters_rules/), [Premium FAQ](https://en.cf-vanguard.com/howto/vgd_premium_faq/), [Welcome to V-Premium & Premium](https://en.cf-vanguard.com/welcome-to-v-premium-premium-format/), CR 4.59 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/2026/08/28105858/Cardfight-Vanguard-Comprehensive-Rules-4.59.pdf)), CR 2014 ([PDF](https://en.cf-vanguard.com/wordpress/wp-content/uploads/CFV_Comprehensive_Rules141121.pdf)). The Premium Weekend circuit (Aug 2026–Mar 2027) uses Premium ([X](https://x.com/cfvanguard_en/status/2019627335134155060)).

## Premium Clan Fight: deck construction
| Item | Rule |
|---|---|
| Pool | All EN cards |
| Identity | **One clan**. D-icon (nation) cards must belong to the nation that clan maps to, e.g. Dragon Empire covers Kagero, Nubatama, Tachikaze, Murakumo and Narukami. Olbaria counts for all nations and clans |
| Main deck | Exactly 50, no G units |
| Ride deck | **None**: ride-deck cards go in the main deck. Note: the Deck Construction page says explicitly only that V Premium and Extreme forbid it, but the Premium FAQ and the Welcome page say Premium has no ride deck |
| G deck | **0–16 G units of the deck's clan**, ≤4 per name. Fixed for the whole tournament. You must answer honestly if asked how many it holds |
| Triggers | Exactly 16; ≤4 heal; ≤1 over. **No 8-per-type cap. Stand triggers allowed. Over triggers allowed** |
| Sentinels / Regalis / Ace | ≤4 / ≤1 / ≤1 |
| Clan exceptions | Royal Paladin may run up to 4 "Blaster Dark". Link Joker may use "Я" cards. With Neon Gyze in the main deck, any Zeroth Dragon may go in the G deck |
| Choice restriction | Only one of: Zeroth Dragons of Zenith Peak, Ultima, **or over triggers** (up to 4 copies of the chosen card) |

Restrictions (examples):
- Commander Laurel (non-V) is Restricted to 1, and Magical Calico is Restricted as first vanguard ([cmd-sg (secondary)](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)).
- **Apr 2026** (effective May 1): Sleeve Tugging Belle Restricted; Ichikishima and Dreaming Dragon → Restricted to 1; Turmoil Star-vader, Zinc → Restricted to 2; Variants Hardleg and Deep Gelidus → Choice Restriction ([notice](https://en.cf-vanguard.com/information/regarding-the-april-2026-deck-construction-rules-update/)).

## Premium Extreme Fight (sub-format)
- **Any mix** of clans and nations, all EN cards, **no ride deck**.
- **Trigger effects work without the usual same-clan requirement.**
- **The restriction list does not apply.**
- Imaginary gifts cannot be acquired ([Imaginary Gift FAQ](https://en.cf-vanguard.com/howto/imaginary-gift-faq/)).
- G deck: the CR base rule (≤16 G units) presumably applies. The clan-match rule for the G deck is not stated for Extreme **[unverified]**.

## Turn-flow differences from Standard
| Topic | Premium |
|---|---|
| First vanguard | Any G0 from the main deck |
| **G assist step** | Active (no ride deck) |
| Ride | From hand only, same grade or +1 |
| **Stride step** | Active if you have a G deck: both vanguards G3+, or yours was G3+ at the start of your turn |
| **G guardian** | In the guard step (see 06) |
| Gifts | V cards in the deck can grant them (Clan Fight) |
| Energy | Only if a D card brings an Energy Generator. Without a ride deck the crest cannot be placed normally, so in practice there is no energy **[inference]** |

## Old-card behaviour a Premium engine must support

### Triggers
- **+5000 icons**: pre-V cards print +5000. The CR rule is "power = printed number" (11.10.5), so store `triggerPower` per card. +5000 and +10000 cards can be mixed ([V System](https://en.cf-vanguard.com/howto/v-series/)).
- **Stand trigger** (CR 11.10.2.4): choose a unit; if it is a rear-guard, stand it, and it **cannot drive check** in later battles this turn; plus icon power to one unit. CR 2014 wording was "stand 1 rear-guard, +5000 to a unit" (2.8.1.1.4). Ruling (secondary): if a rear-guard told to drive check reveals a stand trigger during its own drive check, that check is still completed ([cmd-sg](https://cmd-sg.blogspot.com/2025/03/cardfight-vanguard-english-fighters.html)).
- **Same-clan requirement**: the Extreme Fight exemption implies that Clan Fight still requires it (a trigger does nothing without a same-clan unit). The exact CR text was not extracted **[unverified]**. In a one-clan Clan Fight deck this almost never matters. Implement it as a format flag.

### Drive
- Old G3s print **Twin Drive!!** and stride G units print **Triple Drive!!!**. Drive comes from skill icons only (CR 14.3); grade does not decide it.

### Old keywords (all still in CR 4.59; detail in 06)
| Keyword | Era | Type | Implementation |
|---|---|---|---|
| **Limit Break N** (14.7) | Original | condition: damage ≥ N (usually 4) | condition macro |
| **Break Ride** | Original | card-text pattern: LB4 AUTO "when ridden upon by X" giving the new vanguard a bonus [unverified details] | AUTO `riddenUpon` + LB4 |
| Persona Blast | Original | cost: discard a card with the same name as the vanguard [unverified] | cost `discard{name: vc}` |
| Crossride | Original | CONT: +power if a named G3 is in the soul (+2000 in 2012) [unverified] | CONT + soul-name condition |
| Megablast | Original | ACT with a large cost, e.g. CB5 + SB8 [unverified] | normal ACT |
| Final Turn | Original | card-text flag [unverified] | card text |
| **Lock / Unlock** (7.30–7.31) | Link Joker 2013 | keyword action | engine action |
| Reverse | Link Joker 2014 | card text + a flag [unverified] | ability + `reversed` flag |
| **Legion / Seek Mate** (6.4, 14.11) | 2014 | field state | engine module |
| **Stride, heart, G zone** (6.5–6.6) | G | field state | engine module |
| **Generation Break N** (14.14) | G | condition: face-up G on VC + G zone ≥ N | condition macro |
| **G guardian** (14.16) | G | guard-step action | engine module |
| **Ultimate Stride** (14.13) | G | stride variant | engine module |
| **Time Leap** (7.33, 14.34) | G Gear Chronicle | keyword action | engine action |
| **Delete** (7.32) | G Gyze | keyword action | engine action |
| Brave / Oracle / Ritual / Unite / Thunderstrike / Darkness / Dark Device / White & Black Wings / Powerful | various | condition keywords (CR 14.17–14.45) | condition macros |
| Forerunner / Lord / Restraint / Resist / Rescue / Revelation / Blaze / Dominate / Engorge / Shadowstitch / Rush / Burst / Charge / Magia / Hollow / Harmony / Wave / Success / Bloom / Melody | various | keyword abilities (CR 14.x) | macros or engine flags |

- **Lord** (14.x): the unit cannot attack if you have a unit of another clan.
- **Forerunner**: when a same-clan unit rides on it, you may call it to an RC.
- **Restraint** (14.6, updated in 4.59): the unit cannot attack.
- **Resist** (14.15): the opponent's effects cannot choose it.

### Zones and states
- G zone (face-down + face-up piles), heart, lock circles, deleted vanguards, bind zone (Thunderstrike, Wings), gauge (plant gauge), Astral Plane circles and music orders (end-phase handling, CR 9.11), attach (6.9), Alchemix (6.10).

## Engine profiles
```js
FORMATS.premium = { rideDeck:false, crest:false, energy:false, gAssist:true, gifts:true,
  stride:true, gGuardian:true, gdeckMax:16, standTrigger:true, sameClanTrigger:true,
  poolIcon:null, identity:"clan", nationMapsToClan:true,
  trigTotal:16, trigCaps:{heal:4, over:1}, sentinelMax:4, copies:4, restrictions:"premium" }
FORMATS.extreme = { ...FORMATS.premium, identity:null, sameClanTrigger:false,
  gifts:false, restrictions:null }
```
