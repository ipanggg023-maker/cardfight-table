// Census: every pattern (timing, zone, limit, condition, cost, effect, keyword) → how many cards use it, per era,
// and whether the engine supports it (Y yes, P partly, N no). Output: tags.json + report.md (card names only, no card text).
const fs = require("fs");
const { load, abilities } = require("./load");
const cards = load();
const ERAS = ["Original", "G", "V", "D", "DZ"];
// [id, category, label, regex (on lower-cased ability text), support, note]
const T = [
  // ---------- ability kinds & where they work ----------
  ["kind.auto", "Kind", "[AUTO] ability", /^\[auto\]/, "Y"],
  ["kind.act", "Kind", "[ACT] ability", /^\[act\]/, "Y"],
  ["kind.cont", "Kind", "[CONT] ability", /^\[cont\]/, "Y"],
  ["zone.vc", "Zone", "Works on (VC)", /\]\(vc\)|\(vc\/rc|\(vc\):/, "Y"],
  ["zone.rc", "Zone", "Works on (RC)", /\]\(rc\)|vc\/rc\)|\(rc\):/, "Y"],
  ["zone.gc", "Zone", "Works on (GC)", /\]\(gc\)|\(gc\):/, "Y"],
  ["zone.hand", "Zone", "Works from hand", /\]\(hand\)|\(hand\):|^\[(auto|act)\]:when this card is (discarded|put into)/, "N", "abilities that start in the hand (discard → effect, ACT from hand)"],
  ["zone.drop", "Zone", "Works from the drop zone", /\]\(drop( zone)?\)|\(drop\):/, "N"],
  ["zone.soul", "Zone", "Works from the soul", /\]\(soul\)|\(soul\):/, "N"],
  ["zone.damage", "Zone", "Works from the damage zone", /\]\(damage( zone)?\)/, "N"],
  ["zone.bind", "Zone", "Works from the bind zone", /\]\(bind( zone)?\)/, "N"],
  ["zone.gzone", "Zone", "Works from the G zone", /\]\(?g zone\)?:|\(vc\/rc\/gc or g zone\)|or g zone\)/, "P", "G zone CONT/AUTO while face up"],
  ["zone.oz", "Zone", "Works from the order zone (set orders)", /\]\(order zone\)|order zone\):/, "Y"],
  ["zone.deck", "Zone", "Revealed from the deck / damage check", /when revealed (for|in) a (damage|drive) check|when this card is revealed/, "P"],
  // ---------- limits ----------
  ["lim.1turn", "Limit", "[1/Turn] or [N/Turn]", /\[\d+\/turn\]|once per turn/, "Y"],
  ["lim.1fight", "Limit", "Once per fight / per game", /\[1\/fight\]|once per fight|once per game/, "Y"],
  ["lim.samename", "Limit", "Only once a turn by a card with the same name", /same card name once a turn|same name (may only|can only)/, "N", "limit shared by every copy of the card"],
  ["lim.divine", "Limit", "Divine Skill / Unique / Dangerous", /\[(divine|unique|dangerous) skill\]/, "Y"],
  ["lim.lb", "Limit", "Limit Break N", /limit-?break \d/, "Y"],
  ["lim.gb", "Limit", "Generation Break N", /generation break \d/, "Y"],
  ["lim.ritual", "Limit", "Ritual N (grade 1s in drop)", /ritual \d/, "N"],
  ["lim.wentSecond", "Limit", "If you went second / first", /if you went (second|first)/, "Y"],
  ["lim.notcostpaid", "Limit", "Mandatory vs 'you may pay the cost'", /you may pay the cost/, "Y"],
  // ---------- timings ----------
  ["t.placed", "Timing", "When placed (VC/RC)", /when (this unit is )?placed|when placed/, "Y"],
  ["t.placedFromHand", "Timing", "When placed from hand / from deck / from drop", /placed (on \(rc\) )?from (hand|your hand|deck|drop|soul)/, "N", "the source zone of the call"],
  ["t.rode", "Timing", "When ridden / rode upon", /when (this unit is )?rode upon|when rode upon|when this unit is ridden/, "Y"],
  ["t.rideOn", "Timing", "When your unit rides this / persona ride", /rides this (unit|card)|when (you|your) .*ride/, "P"],
  ["t.attack", "Timing", "When this unit attacks", /when (this unit|it) attacks/, "Y"],
  ["t.attackVG", "Timing", "When it attacks a vanguard / rear-guard", /attacks a (vanguard|rear-guard)/, "P", "target filter on the attack event"],
  ["t.boost", "Timing", "When this unit boosts / is boosted", /when this unit (boosts|is boosted)|the attack this unit boosted/, "P", "'is boosted' missing"],
  ["t.attacked", "Timing", "When this unit is attacked", /when this unit is attacked|when (your|this) .* is attacked/, "Y"],
  ["t.hit", "Timing", "When the attack hits", /attack hits|when it hits/, "Y"],
  ["t.noHit", "Timing", "When the attack does not hit", /does not hit|did not hit/, "N"],
  ["t.battleEnd", "Timing", "At the end of the battle", /at the end of (the|that) battle/, "Y"],
  ["t.turnStart", "Timing", "At the beginning of your turn / ride / main / battle phase", /at the (beginning|start) of (your|the) (turn|ride phase|main phase|battle phase|stand phase|draw phase)/, "Y"],
  ["t.guardStep", "Timing", "At the beginning of the guard step / when you guard", /guard step|when (it|this unit) is placed on \(gc\)|when (you|your opponent) guard/, "P"],
  ["t.closeStep", "Timing", "At the close step / end of the close step", /close step/, "N"],
  ["t.endTurn", "Timing", "At the end of your / your opponent's turn", /at the end of (your|the|your opponent's) turn/, "Y"],
  ["t.driveCheck", "Timing", "When a drive check reveals …", /drive check reveals|revealed (for|in) a drive check|when your drive check/, "N"],
  ["t.damageCheck", "Timing", "When a damage check reveals …", /damage check reveals|revealed for a damage check/, "N"],
  ["t.trigger", "Timing", "When a trigger effect / heal / stand trigger happens", /when (a|your) .*trigger|trigger effect/, "N"],
  ["t.retired", "Timing", "When this unit / another unit is retired", /is retired|are retired|would be retired/, "N"],
  ["t.otherPlaced", "Timing", "When another unit / your other rear-guard is placed", /when (another|your other|a) .*(is placed|are placed)/, "Y"],
  ["t.oppCalls", "Timing", "When your opponent calls / their unit is placed", /when your opponent('s)? (calls?|would call|rear-guard is placed)/, "N"],
  ["t.discarded", "Timing", "When this card is discarded", /when this card is discarded|when (a|this) card is discarded/, "N"],
  ["t.toSoul", "Timing", "When this card is put into the soul / drop / bind / damage", /when this (card|unit) is put (into|in) (your |the )?(soul|drop|bind|damage)/, "N"],
  ["t.sentToDrop", "Timing", "When put into the drop from the GC", /from \(gc\)|from the guardian circle/, "N"],
  ["t.stride", "Timing", "When your G unit strides / when this strides", /\[stride\](s)?|when your g unit|when this unit strides|stride step/, "Y"],
  ["t.heal", "Timing", "When you heal / damage is recovered", /when (you|your) (heal|recover)|heal trigger/, "N"],
  ["t.cardCalled", "Timing", "When you call a card / a unit is called", /when you call|when .* is called/, "P"],
  ["t.drawn", "Timing", "When you draw / your opponent draws", /when (you|your opponent) draws?/, "N"],
  ["t.counterBlast", "Timing", "When you pay Counter-Blast / Soul-Blast", /when you (pay|counter-blast|soul-blast)|while you are paying the cost/, "N"],
  ["t.orderPlayed", "Timing", "When you play an order / set order", /when you (play|activate) (an?|your) .*order|when an order/, "N"],
  ["t.unlocked", "Timing", "When this card is unlocked", /is unlocked|turns face up/, "Y"],
  ["t.dressed", "Timing", "When placed with overDress", /overdress|xoverdress/, "Y"],
  // ---------- costs ----------
  ["c.cb", "Cost", "Counter-Blast N", /counter-?blast/, "Y"],
  ["c.sb", "Cost", "Soul-Blast N", /soul-?blast/, "Y"],
  ["c.eb", "Cost", "Energy-Blast N", /energy-?blast/, "Y"],
  ["c.discard", "Cost", "Discard card(s) from hand", /\[cost\]\[[^\]]*discard|\[discard [^\]]*from (your )?hand/, "Y"],
  ["c.discardFilter", "Cost", "Discard a specific card (grade, trigger, name)", /discard an? (grade|trigger|normal|order|card with|"|<)/, "Y", "filter on discarded card"],
  ["c.restSelf", "Cost", "[Rest] this unit", /\[rest\] this unit\]|\[\[rest\] this unit\]/, "Y"],
  ["c.retireSelf", "Cost", "Retire this unit", /retire this unit\]|retire this unit &/, "Y"],
  ["c.retireOther", "Cost", "Retire your other rear-guard(s)", /\[[^\]]*retire (a|an|n|one|two|another|\d)[^\]]*rear-guard/, "Y"],
  ["c.toSoul", "Cost", "Put this unit / a card into the soul", /\[[^\]]*put (this unit|this card|a card|a unit)[^\]]*soul/, "Y", "only this unit"],
  ["c.toDeck", "Cost", "Put this unit on top / bottom of deck", /\[[^\]]*put this (unit|card) on the (top|bottom)/, "Y"],
  ["c.bindSelf", "Cost", "Bind this card / unit", /\[[^\]]*bind this (card|unit)/, "Y"],
  ["c.reveal", "Cost", "Reveal a card from hand", /\[[^\]]*reveal (a|an|this)/, "Y"],
  ["c.gFaceUp", "Cost", "Turn a G zone card face up / face down G cost", /turn (a|one|\d) card(s)? from (your )?g zone face up|choose a face down card from your g zone/, "N"],
  ["c.restOther", "Cost", "[Rest] other units", /\[[^\]]*\[rest\] (n|two|three|\d|other|your other)/, "N"],
  ["c.flipDamage", "Cost", "Turn damage face down (CB) or up", /turn (n|\d|a) card(s)? in (your )?damage zone face/, "P"],
  ["c.dropToTop", "Cost", "Return drop cards to the deck (Seek Mate)", /from your drop zone .*(into|to) your deck|seek mate/, "Y"],
  ["c.alt", "Cost", "Choice of costs ('CB 1 or EB 2')", /\[[^\]]* or (counter|soul|energy)-?blast/, "N"],
  ["c.payOpp", "Cost", "Opponent pays / both players pay", /your opponent pays|both players/, "N"],
  ["c.costReduce", "Cost", "Cost reduced / ignore cost", /costs? (is|are) reduced|without paying|ignore the cost/, "N"],
  // ---------- conditions ----------
  ["k.vcName", "Condition", "If your vanguard is / has a name", /if your vanguard (is|has) "|your vanguard is "|vanguard with "/, "Y"],
  ["k.vcGrade", "Condition", "If your vanguard is grade N+", /if your vanguard is grade/, "Y"],
  ["k.oppVcGrade", "Condition", "If your opponent's vanguard is grade N+", /opponent's vanguard is grade/, "Y"],
  ["k.clan", "Condition", "If you have a <clan>/<nation> vanguard or unit", /if you have an? <|if your vanguard is an? </, "Y", "clan/nation filters in conditions"],
  ["k.counts", "Condition", "Counts: hand / soul / drop / damage / rear-guards ≥ N", /if (your|the number of cards in your) (hand|soul|drop|damage zone|bind zone) (has|is)|if you have \d+ or more rear-guards|if the number of/, "Y", "bind zone, face-up damage, opponent counts missing"],
  ["k.oppCounts", "Condition", "Opponent's counts (their damage, hand, rear-guards)", /if your opponent has|your opponent's (damage|hand|soul|drop)/, "Y"],
  ["k.myTurn", "Condition", "During your / your opponent's turn", /during your (opponent's )?turn/, "Y"],
  ["k.battleN", "Condition", "If it is the Nth battle", /battle of that turn or more|\w+ battle of (the|that) turn/, "Y"],
  ["k.persona", "Condition", "If you persona rode this turn", /persona rode/, "Y"],
  ["k.legion", "Condition", "If your vanguard is in Legion", /\[legion\]|legion/, "Y"],
  ["k.heart", "Condition", "If you have a heart card with …", /heart card|heart with/, "N"],
  ["k.gzoneUp", "Condition", "Number of face-up G cards", /face up card(s)? in your g zone|face up g unit/, "Y"],
  ["k.ifDid", "Condition", "If you did / if you put / if you revealed (result of the earlier part)", /if you (did|do|put|revealed|called|retired|searched|discarded|drew|bound|stood)/, "Y", "branch on what the earlier step did"],
  ["k.power", "Condition", "If this unit's / your vanguard's power is N+", /'s \[power\] is \d/, "N"],
  ["k.state", "Condition", "If this unit is boosted / rested / in a state", /if this unit (is|was) (boosted|rested|standing|\[rest\]|\[stand\])|state\]|\[[a-z ]+ state\]/, "N"],
  ["k.world", "Condition", "If you are in Dark Night / Abyssal Dark Night", /dark night/, "Y"],
  ["k.orderZone", "Condition", "If your order zone has N+ / a set order", /order zone has/, "Y"],
  ["k.triggerIn", "Condition", "If a trigger / grade N was revealed", /if (it|the revealed card) is a (trigger|grade)|if a .* trigger/, "Y"],
  ["k.columns", "Condition", "Same column / column of this unit", /same column|this unit's column/, "N"],
  ["k.attackedByVG", "Condition", "If the attacking unit is a vanguard / rear-guard", /if the attacking unit is|attacked by a (vanguard|rear-guard)/, "N"],
  // ---------- effects: units ----------
  ["e.power", "Effect", "Power +/−", /\[power\] ?[+-]|\[power\]\s*\+/, "Y"],
  ["e.powerMinus", "Effect", "Power − to opponent's units", /\[power\] ?-\d/, "Y"],
  ["e.crit", "Effect", "Critical +", /\[critical\] ?\+/, "Y"],
  ["e.drive", "Effect", "Drive +/−", /drive [+-]\d|drive check .* additional|gets drive/, "Y"],
  ["e.shield", "Effect", "Shield +", /\[shield\] ?\+/, "Y"],
  ["e.stand", "Effect", "[Stand] a unit", /\[stand\] (it|them|this unit|that unit|n of|up to|all)|\[stand\] it/, "Y"],
  ["e.rest", "Effect", "[Rest] a unit", /\[rest\] (it|them|that unit|n of|up to|all)/, "Y"],
  ["e.retireOpp", "Effect", "Retire opponent's rear-guard(s)", /retire (it|them|that unit|all of your opponent|n of your opponent)/, "Y"],
  ["e.oppChooses", "Effect", "Your opponent chooses (and retires/discards)", /your opponent chooses/, "Y", "the other player makes the choice"],
  ["e.untilEnd", "Effect", "Durations: until end of battle / turn", /until end of (that battle|the battle|turn)/, "Y"],
  ["e.untilOpp", "Effect", "Durations: until end of your opponent's / your next turn", /until end of (your opponent's turn|your next turn|the next turn)/, "N"],
  ["e.giveAbility", "Effect", "Gets an ability (\"[AUTO]…\") / gets all of the following", /gets? "\[|gets all of the following|this card gets all/, "N", "granted abilities"],
  ["e.cantBeHit", "Effect", "Cannot be hit", /cannot be hit/, "Y"],
  ["e.restrict", "Effect", "Cannot attack / boost / intercept / be chosen / be retired", /cannot (attack|boost|intercept|be chosen|be retired|be attacked|stand|be returned|be put)/, "N", "restriction effects"],
  ["e.cantCall", "Effect", "Opponent cannot call (grade N / sentinels) to GC / RC", /cannot call|must call/, "N"],
  ["e.cantGuard", "Effect", "Cannot guard with … / guard restrictions", /cannot guard|must guard|cannot be guarded|cannot call (cards?|.{0,40}) (from (his or her|their) hand )?to \(gc\)|guard with (two|\d|n) or more/, "N"],
  ["e.resist", "Effect", "Resist (cannot be chosen by opponent's effects)", /\[resist\]|resist/, "N"],
  ["e.move", "Effect", "Move a rear-guard to another circle / swap", /move (it|this unit|them)|to another \(rc\)|switch (it|its position)|exchange/, "N", "move by effect"],
  ["e.gradeUp", "Effect", "Grade +N / is regarded as", /grade \+\d|is (also )?regarded as/, "N"],
  ["e.nameChange", "Effect", "Card name becomes / also has the name", /card name (becomes|is also)|regarded as (having|a card named)/, "N"],
  ["e.triggerEffect", "Effect", "Gives trigger effects (critical, front, heal, draw…) / triggers more", /trigger effects? (twice|again|happen)|gets the (critical|front|draw|heal) trigger/, "N"],
  ["e.driveCheckMod", "Effect", "Change drive checks (choose order, more checks, check from…)", /drive check (is|from)|additional drive check|perform a drive check/, "N"],
  // ---------- effects: cards & zones ----------
  ["e.draw", "Effect", "Draw N", /draw (a card|\d+|n|two|three)/, "Y"],
  ["e.cc", "Effect", "Counter-Charge N", /counter-?charge/, "Y"],
  ["e.sc", "Effect", "Soul-Charge N", /soul-?charge/, "Y"],
  ["e.ec", "Effect", "Energy-Charge N", /energy-?charge/, "Y"],
  ["e.heal", "Effect", "Heal: damage to the drop", /heal|put (a|one|n) card(s)? from your damage zone into your drop/, "Y"],
  ["e.damage", "Effect", "Deal damage / put cards into the damage zone", /deal \d+ damage|deal n damage|put (it|the top card|.*) into (your|their|your opponent's) damage zone/, "P"],
  ["e.searchDeck", "Effect", "Search your deck for a card", /search (your )?deck|search for up to/, "Y"],
  ["e.lookTop", "Effect", "Look at the top N cards, take some", /look at (the )?top|look at (up to )?\w+ cards? from the top/, "Y"],
  ["e.reveal", "Effect", "Reveal the top card / reveal from hand", /reveal (the top|n cards from the top|\d cards from the top|it|them|up to)/, "Y"],
  ["e.callDeck", "Effect", "Call from the deck", /call (it|them|up to .*|a card) .*from (your|the) deck|search your deck for .* call it/, "Y"],
  ["e.callDrop", "Effect", "Call from the drop zone", /from your drop( zone)?,? (and )?call|call .* from (your )?drop/, "Y"],
  ["e.callSoul", "Effect", "Call from the soul", /from your soul,? (and )?call|call .* from (your )?soul/, "Y"],
  ["e.callHand", "Effect", "Call from hand", /call .* from (your )?hand|from your hand,? (and )?call/, "Y"],
  ["e.callBind", "Effect", "Call from the bind zone / damage zone", /call .* from (your )?(bind|damage)|from your (bind|damage) zone,? (and )?call/, "Y"],
  ["e.toHand", "Effect", "Put a card into the hand (from drop / soul / damage / field)", /(from your (drop|soul|damage zone|bind zone)[^.]*into your hand)|(return (it|this unit|that unit) to (your|its owner's) hand)|put it into (your )?hand/, "Y", "only from deck/top"],
  ["e.toSoul", "Effect", "Put a card into the soul (from field / hand / drop / deck)", /put (it|them|that unit|this unit|a card|the top card|.*) into (your )?soul/, "Y"],
  ["e.toDeck", "Effect", "Put a card on top / bottom of the deck", /on the (top|bottom) of (your|the|their|his or her|its owner's) deck/, "Y"],
  ["e.toDrop", "Effect", "Put a card into the drop (mill / from soul)", /put (it|them|.*) into (your |the )?drop/, "Y"],
  ["e.bind", "Effect", "Bind a card (from field / hand / deck / drop)", /\bbind (it|them|that|n|up to|all|this|the top|a card)/, "Y"],
  ["e.discardEffect", "Effect", "Discard as an effect (you or opponent)", /discard (a card|n cards|\d cards|it|them)|your opponent discards/, "Y"],
  ["e.shuffle", "Effect", "Shuffle the deck", /shuffle (your|the) deck/, "Y"],
  ["e.rideByEffect", "Effect", "Ride by an effect (from deck / drop / soul / hand)", /(?<!st)ride (it|this card|that card|them|that) (as \[stand\]|from)|superior ride|(?<!st)ride (it|this card)\b|(?<!st)ride .{0,40} from (your )?(deck|drop|soul|hand)/, "N", "Superior Ride"],
  ["e.callToken", "Effect", "Call tokens (Plant / Shadow Army / Hollow…)", /token|plant|shadow army|hollow/, "N", "tokens"],
  ["e.ticket", "Effect", "Tickets / Quick Shield / crest-like markers", /ticket|quick shield/, "N", "tickets"],
  ["e.marker", "Effect", "Markers (Protect, Force, Accel, crests, counters)", /marker|crest/, "P"],
  ["e.energy", "Effect", "Energy (generate, check, use)", /energy/, "Y"],
  ["e.choice", "Effect", "Choose one / perform N of the following", /choose (one|n|\d) of the following|perform (one|n|\d|all) of the following/, "Y", "modal choice"],
  ["e.forEach", "Effect", "For each … (scaling bonus)", /for each|for every/, "Y"],
  ["e.instead", "Effect", "Replacement: instead / would …", /instead|would be|would (retire|leave|be put)/, "N"],
  ["e.copy", "Effect", "Copy / gain the abilities of another card", /gets the (abilities|same abilities)|same ability as|copies/, "N"],
  ["e.extraAttack", "Effect", "Extra attacks / attack from the back row", /can attack from the back row|attack again|additional battle|(\w+) more attack/, "N"],
  ["e.vcStand", "Effect", "Restand the vanguard / units after battle", /\[stand\] (your vanguard|this unit)/, "Y"],
  ["e.gzone", "Effect", "G zone: turn face up/down, put into G zone, Stride from …", /g zone/, "P"],
  ["e.lock", "Effect", "Lock / unlock", /\block\b|\bunlock/, "Y"],
  ["e.delete", "Effect", "Delete", /\bdelete/, "Y"],
  ["e.timeLeap", "Effect", "Time Leap", /time leap/, "Y"],
  ["e.world", "Effect", "World (Dark Night)", /\bworld\b/, "Y"],
  ["e.statusState", "Effect", "States: Mental Pollution, Harmony, Melody, Pleasure…", /\[[a-z ]+ state\]|in harmony|harmony|melody|pleasure|ruin|mental pollution/, "N", "named states"],
  // ---------- keywords & card types ----------
  ["kw.sentinel", "Keyword", "Sentinel (perfect guard)", /sentinel/, "Y"],
  ["kw.forerunner", "Keyword", "Forerunner", /forerunner/, "N"],
  ["kw.lord", "Keyword", "Lord (cannot attack without same clan)", /\blord\b/, "N"],
  ["kw.boostIcon", "Keyword", "Boost / Intercept / Twin Drive skill icons", /\[boost\]|\[intercept\]|twin drive|triple drive/, "Y"],
  ["kw.persona", "Keyword", "Persona Ride", /persona ride/, "Y"],
  ["kw.stride", "Keyword", "Stride / G unit / Ultimate Stride", /\[stride\]|ultimate stride/, "Y"],
  ["kw.gguard", "Keyword", "G Guardian", /g guardian/, "Y"],
  ["kw.legion", "Keyword", "Legion / Seek Mate", /legion|seek mate/, "Y"],
  ["kw.lockKw", "Keyword", "Lock (Link Joker)", /\block\b/, "Y"],
  ["kw.breakRide", "Keyword", "Break Ride", /break ride|when your .* rides this unit/, "N"],
  ["kw.crossRide", "Keyword", "Cross Ride / Cross Break Ride", /cross ride|cross break/, "N"],
  ["kw.overDress", "Keyword", "overDress / XoverDress / RevolDress / DressBoost", /overdress|xoverdress|revoldress|dressboost/, "P", "RevolDress and DressBoost missing"],
  ["kw.glitter", "Keyword", "Glitter (Bermuda)", /\[glitter\]|glitter/, "N"],
  ["kw.melody", "Keyword", "Melody / Harmony / Happy Toys / Oversized / Völundr / ExplosiveGrowth", /\[(melody|happy toys|oversized!|völundr|explosivegrowth|rewrite|oversoul)\]/, "N", "D-era keyword skills"],
  ["kw.arms", "Keyword", "Arms (left/right)", /\barms\b|left deity arms|right deity arms/, "Y"],
  ["kw.alchemagic", "Keyword", "Alchemagic", /alchemagic/, "Y"],
  ["kw.regalis", "Keyword", "Regalis Piece", /regalis piece/, "Y"],
  ["kw.setOrder", "Keyword", "Set order / Prison / World / Song", /set order|prison|\bsong\b/, "P", "Prison and Song subtypes missing"],
  ["kw.blitz", "Keyword", "Blitz order", /blitz order/, "Y"],
  ["kw.triggerOrder", "Keyword", "Trigger order", /trigger order/, "N"],
  ["kw.gift", "Keyword", "Imaginary Gift (Force/Accel/Protect)", /imaginary gift|\b(force|accel|protect) (i|ii)\b|(force|protect) marker|accel circle/, "Y"],
  ["kw.ace", "Keyword", "Ace Unit", /ace unit|\[ace\]/, "Y"],
  ["kw.mateUnit", "Keyword", "Mate unit / ExtraDeck-like ('cannot be in your main deck')", /cannot be in your main deck|mate unit/, "P"],
  ["kw.giftMarker", "Keyword", "Crests (Energy Generator and others)", /crest/, "P", "only Energy Generator"],
  ["kw.overTrigger", "Keyword", "Over trigger (+100M, its own text)", /over trigger|\[over\]/, "Y"],
  ["kw.standTrigger", "Keyword", "Stand trigger", /stand trigger/, "Y"],
  ["kw.frontTrigger", "Keyword", "Front trigger", /front trigger|\[front\]/, "Y"],
];
const re = T.map((t) => [t, t[3]]);
const stats = Object.fromEntries(T.map((t) => [t[0], { n: 0, era: Object.fromEntries(ERAS.map((e) => [e, 0])), ex: [] }]));
let fullyY = 0;
const perCard = [];
for (const c of cards) {
  const text = abilities(c.text).join("\n").toLowerCase();
  if (!text) { fullyY++; continue; }
  const hit = new Set();
  for (const a of abilities(c.text)) {
    const s = a.toLowerCase();
    // effects and conditions are matched without the cost brackets; "you may pay the cost. If you do" is the normal optional cost
    const eff = s.replace(/\[cost\]\[(?:[^\[\]]|\[[^\]]*\])*\]/g, " ")
      .replace(/\[[^\]]*(?:counter-?blast|soul-?blast|energy-?blast|discard|retire this|put this unit into|reveal a|bind this)[^\]]*\]/g, " ")
      .replace(/you may pay the cost\.? if you do,?/g, " ");
    for (const [t, r] of re) if (r.test(["Effect", "Condition"].includes(t[1]) ? eff : s)) hit.add(t[0]);
  }
  for (const id of hit) {
    const st = stats[id];
    st.n++; st.era[c.era]++;
    if (st.ex.length < 4 && !st.ex.includes(c.name)) st.ex.push(c.name);
  }
  const need = [...hit].filter((id) => T.find((t) => t[0] === id)[4] !== "Y");
  if (!need.length) fullyY++;
  perCard.push({ name: c.name, era: c.era, need });
}
fs.writeFileSync(__dirname + "/tags.json", JSON.stringify({ T: T.map((t) => ({ id: t[0], cat: t[1], label: t[2], support: t[4], note: t[5] || "", ...stats[t[0]] })), cards: cards.length, fullyY }, null, 1));
// which missing tags unlock the most cards (cards whose only missing need is that tag, then greedy)
const gain = {};
for (const p of perCard) if (p.need.length === 1) gain[p.need[0]] = (gain[p.need[0]] || 0) + 1;
console.log("cards", cards.length, "need nothing extra", fullyY, (fullyY / cards.length * 100).toFixed(1) + "%");
console.log("single-blocker gains", Object.entries(gain).sort((a, b) => b[1] - a[1]).slice(0, 25));
const eraNeeds = {};
for (const p of perCard) { eraNeeds[p.era] = eraNeeds[p.era] || [0, 0]; eraNeeds[p.era][0]++; if (!p.need.length) eraNeeds[p.era][1]++; }
console.log("by era (cards with text, fully covered)", eraNeeds);
