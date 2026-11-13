// Building blocks for card abilities. The editor builds its forms from this,
// and the engine executes each block by its `type`.
// To add a new block: add it here, then handle the same `type` in engine.js.

const TARGETS = {
  self: "this unit",
  vc: "your vanguard",
  placed: "the unit that was placed",
  attacker: "the attacking unit",
  allFront: "all your front row units",
  allFrontRC: "all your front row rear-guards",
  allMyRC: "all your rear-guards",
  allMyUnits: "all your units",
  chooseMy: "choose your unit(s)",
  chooseMyRC: "choose your rear-guard(s)",
  chooseMyFrontRC: "choose your front row rear-guard(s)",
  chooseMyBackRC: "choose your back row rear-guard(s)",
  chooseOppRC: "choose opponent's rear-guard(s)",
  chooseOppFrontRC: "choose opponent's front row rear-guard(s)",
  chooseOppUnit: "choose opponent's unit(s)",
  thatUnit: "that unit (the one the step before chose)",
  eventUnit: "the unit the timing is about (that placed / attacking / stood unit)",
  attacked: "your unit being attacked",
  myColumn: "your other units in this unit's column",
  oppColumn: "opponent's units in this unit's column",
  chooseOppColumn: "choose opponent's unit(s) in this unit's column",
};
const CONT_TARGETS = ["self", "vc", "allFront", "allFrontRC", "allMyRC", "allMyUnits"];

// Move cards (effect and cost) share these settings
const MOVE_PARAMS = [["from", "mfrom", "from"], ["to", "mto", "to"], ["n", "num", "how many"], ["upTo", "bool", "up to (may choose fewer)"], ["all", "bool", "all matching cards"],
  ["random", "bool", "at random"], ["look", "num", "look at the top (deck top only)"], ["rest", "lookRest", "the rest"], ["chooser", "chooser", "who chooses"], ["reveal", "bool", "reveal"], ["asRest", "bool", "call as [Rest]"], ["filter", "filter"]];
const PER = [["per", "count", "× for each card in (optional)"], ["perFilter", "filter", "counting only"]];
const SCHEMA = {
  kinds: {
    AUTO: "AUTO (triggers on an event)",
    ACT: "ACT (activate with a button)",
    CONT: "CONT (always on)",
    ORDER: "Normal Order (play from hand, main phase)",
    BLITZ: "Blitz Order (play from hand while guarding)",
    REPL: "Replacement (“if … would …, … instead”)",
  },
  // replacement events (kind REPL) and where the card goes instead
  replEvents: { wouldBeRetired: "If this unit would be retired", wouldBeRetiredByOpp: "If this unit would be retired by your opponent (effect or attack)", wouldLeaveGC: "If this card would be put into the drop from (GC)" },
  insteadTo: { stay: "it stays (nothing happens)", soul: "put it into your soul", hand: "return it to your hand", deckTop: "put it on top of your deck", deckBottom: "put it on the bottom of your deck", bind: "bind it", removed: "remove it from the game" },
  zones: { VC: "VC", RC: "RC", "VC/RC": "VC/RC", GC: "GC (guardian)", OZ: "Order zone (set orders)", hand: "Hand", drop: "Drop", soul: "Soul", damage: "Damage zone (face up)", bind: "Bind zone", G: "G zone (face up)", crest: "Crest zone", any: "Anywhere" },
  events: {
    placed: "When placed (on VC or RC)",
    placedVC: "When placed on VC (ridden)",
    riddenUpon: "When this unit is ridden upon",
    placedRC: "When placed on RC",
    allyPlacedRC: "When another unit is placed on your RC",
    placedGC: "When placed on GC",
    turnStart: "At the start of your turn",
    mainStart: "At the start of your main phase",
    battleStart: "At the start of your battle phase",
    attack: "When this unit attacks",
    boost: "When this unit boosts",
    attacked: "When this unit is attacked",
    attackHit: "When this unit's attack hits",
    battleEnd: "At the end of the battle this unit attacked",
    endTurn: "At the end of your turn",
    oppTurnStart: "At the start of your opponent's turn",
    oppTurnEnd: "At the end of your opponent's turn",
    overDrive: "When revealed as an over trigger in your drive check (its over-trigger text)",
    onStride: "When this G unit strides",
    dressed: "When this unit is put on RC with overDress / XoverDress",
    unlocked: "When this card is unlocked",
    boosted: "When this unit is boosted",
    intercepts: "When this unit intercepts",
    boostHit: "When the attack this unit boosted hits",
    allyAttacked: "When your unit is attacked (any of yours; also from hand)",
    toOrderZone: "When this card is put into the order zone",
    allyHit: "When your unit's attack hits (any of yours)",
    allyAttacks: "When your unit attacks (any of yours)",
    oppAttacks: "When your opponent's unit attacks (e.g. from hand)",
    guardStart: "At the beginning of the guard step (you are attacked)",
    attackNoHit: "When this unit's attack does not hit",
    retired: "When this unit is retired",
    allyRetired: "When your rear-guard is retired",
    oppRetired: "When your opponent's rear-guard is retired",
    oppPlacedRC: "When your opponent's rear-guard is placed",
    discarded: "When this card is discarded from hand",
    toSoul: "When this card is put into the soul",
    driveReveal: "When your drive check reveals a card",
    revealedDrive: "When this card is revealed in a drive check",
    damageReveal: "When your damage check reveals a card",
    revealedDamage: "When this card is revealed in a damage check",
    orderPlayed: "When you play an order",
    allyPlacedVC: "When your vanguard is placed (ride or stride; filter = the new vanguard)",
    leftGC: "When this card goes from (GC) to the drop",
    soulToDrop: "When this card goes from the soul to the drop",
    rcToSoul: "When this unit is put from (RC) into the soul",
    returnedHand: "When this unit is returned from (RC) to the hand",
    legion: "When your vanguard forms a Legion",
    harmonized: "When this unit becomes in harmony",
    originalDress: "When this card becomes an originalDress",
    stood: "When this unit stands (by an effect or in the stand phase)",
    toDamage: "When a card is put into your damage zone (damage check)",
    soulCharged: "When your card is put into your soul by Soul-Charge",
    eachTurnEnd: "At the end of each turn (yours and your opponent's)",
    attackStep: "At the beginning of your attack step (each battle)",
    hitOrBoost: "When its attack or the attack it boosted hits",
    armed: "When this card is Armed",
    allyDiscarded: "When your card is discarded from hand (filter = that card)",
    cardToSoul: "When a card is put into your soul (filter = that card)",
    soulBlasted: "When you Soul-Blast (N or more at once; by your vanguard's ability)",
    boundFromRC: "When this unit is bound from (RC)",
    oppBound: "When your opponent's rear-guard is bound",
    oppLocked: "When your opponent's rear-guard is locked by your card",
    oppUnlocked: "When your opponent's locked card is unlocked",
    allyStood: "When your unit [Stand]s by an effect (filter = that unit)",
    allyReturnedHand: "When your rear-guard is returned to hand",
    rcToDeck: "When this unit is put into your deck from (RC)",
    cardToOrderZone: "When a card is put into your order zone",
    sung: "When this Song is sung (order zone)",
    chosenBy: "When this unit is chosen by an ability (by your vanguard / a named card)",
    drew: "When you draw a card",
    replacedBy: "When your other unit is placed on this unit's circle",
    oppToDeck: "When your opponent's rear-guard is put into his or her deck (by your card)",
  },
  // events that are about another card: the AUTO ability may filter it ("when your grade 3 rear-guard is placed…")
  eventSubject: { allyHit: "the attacking unit", allyAttacked: "the attacked unit", placedRC: "the placed card", allyPlacedRC: "the placed card", oppPlacedRC: "the placed card", boosted: "the booster", allyAttacks: "the attacking unit",
    oppAttacks: "the attacking unit", guardStart: "the attacking unit", allyRetired: "the retired card", oppRetired: "the retired card", driveReveal: "the revealed card",
    damageReveal: "the revealed card", orderPlayed: "the order", riddenUpon: "the unit that rides this one", placedVC: "this new vanguard",
    allyPlacedVC: "the new vanguard", toDamage: "the card", soulCharged: "the card", legion: "the vanguard", allyDiscarded: "the discarded card", cardToSoul: "the card", oppBound: "the bound card", oppLocked: "the locked card", oppUnlocked: "the unlocked card", allyStood: "the unit", allyReturnedHand: "the card", cardToOrderZone: "the card" },
  fromEvents: { placed: 1, placedRC: 1, allyPlacedRC: 1, oppPlacedRC: 1, placedVC: 1, riddenUpon: 1 },

  conds: {
    myTurn: { label: "It is your turn", params: [], text: () => "it is your turn" },
    dressed: { label: "This unit is in overDress state", params: [], text: () => "this unit is in overDress state" },
    world: { label: "Your World is", params: [["text", "text", "World"]], text: (p) => `your World is "${p.text}"` },
    orderZone: { label: "Your order zone has N+ cards", params: [["n", "num"]], text: (p) => `your order zone has ${p.n}+ cards` },
    legion: { label: "Your vanguard is in Legion", params: [], text: () => "your vanguard is in Legion" },
    genBreak: { label: "Generation Break N (face-up G cards ≥ N)", params: [["n", "num"]], text: (p) => `[Generation Break ${p.n}]` },
    limitBreak: { label: "Limit Break N (your damage ≥ N)", params: [["n", "num"]], text: (p) => `[Limit Break ${p.n}]` },
    oppTurn: { label: "It is opponent's turn", params: [], text: () => "it is opponent's turn" },
    vcName: { label: "Your VC name contains", params: [["text", "text"]], text: (p) => `your vanguard has "${p.text}" in its name` },
    vcGrade: { label: "Your VC grade ≥", params: [["n", "num"]], text: (p) => `your vanguard is grade ${p.n}+` },
    oppVcGrade: { label: "Opponent VC grade ≥", params: [["n", "num"]], text: (p) => `opponent's vanguard is grade ${p.n}+` },
    myDamage: { label: "Your damage ≥", params: [["n", "num"]], text: (p) => `you have ${p.n}+ damage` },
    oppDamage: { label: "Opponent damage ≥", params: [["n", "num"]], text: (p) => `opponent has ${p.n}+ damage` },
    rearCount: { label: "Your rear-guards ≥", params: [["n", "num"]], text: (p) => `you have ${p.n}+ rear-guards` },
    soul: { label: "Your soul ≥", params: [["n", "num"]], text: (p) => `your soul has ${p.n}+ cards` },
    drop: { label: "Your drop ≥", params: [["n", "num"]], text: (p) => `your drop has ${p.n}+ cards` },
    hand: { label: "Your hand ≥", params: [["n", "num"]], text: (p) => `your hand has ${p.n}+ cards` },
    persona: { label: "You persona rode this turn", params: [], text: () => "you persona rode this turn" },
    playedOrder: { label: "You played an order this turn", params: [], text: () => "you played an order this turn" },
    targetVC: { label: "Attack target is a vanguard", params: [], text: () => "attacking a vanguard" },
    selfFront: { label: "This unit is in the front row", params: [], text: () => "this unit is in the front row" },
    selfBack: { label: "This unit is in the back row", params: [], text: () => "this unit is in the back row" },
    count: { label: "Count: number of cards / units (≥, ≤, =)", params: [["what", "count", "count"], ["op", "op", "is"], ["n", "num"], ["filter", "filter"]],
      text: (p) => `the number of ${flt(p.filter)} in ${cnt(p.what)} is ${OPS[p.op || "ge"]} ${p.n}` },
    unit: { label: "A unit is … (your vanguard / this unit / opponent's vanguard is a <clan>, grade, name…)", params: [["who", "who", "unit"], ["filter", "filter"]],
      text: (p) => `${SCHEMA.paramOptions.who[p.who || "vc"]} is ${flt(p.filter)}` },
    wentFirst: { label: "You went first", params: [], text: () => "you went first" },
    wentSecond: { label: "You went second", params: [], text: () => "you went second" },
    power: { label: "Power: a unit's [Power] is N or more (Success, \"if this unit's power is…\")", params: [["who", "powWho", "unit"], ["op", "op", "is"], ["n", "num"]],
      text: (p) => `${SCHEMA.paramOptions.powWho[p.who || "self"]}'s [Power] is ${OPS[p.op || "ge"]} ${p.n}` },
    inBattleAtt: { label: "During the battle this unit attacked", params: [], text: () => "during the battle this unit attacked" },
    inBattleBoost: { label: "During the battle this unit boosted", params: [], text: () => "during the battle this unit boosted" },
    boosted: { label: "This unit is boosted (this battle)", params: [], text: () => "this unit is boosted" },
    countVs: { label: "Count compared with the opponent (more / fewer … than your opponent)", params: [["what", "count", "your count"], ["op", "op", "is"], ["vs", "count", "than"]],
      text: (p) => `${cnt(p.what)} has ${OPS[p.op || "gt"]} cards than ${cnt(p.vs)}` },
    heart: { label: "Your heart card is … (Stride)", params: [["filter", "filter"]], text: (p) => `you have a heart card that is ${flt(p.filter)}` },
    ritual: { label: "Ritual N (N+ grade 1 cards in your drop)", params: [["n", "num"]], text: (p) => `[Ritual ${p.n}]` },
    byOpp: { label: "It was retired by your opponent's card", params: [], text: () => "it was retired by your opponent's card" },
    markers: { label: "Markers: count markers on circles", params: [["name", "text", "marker name (blank = any)"], ["where", "mwhere2", "on"], ["op", "op", "is"], ["n", "num"]],
      text: (p) => `${({ self: "this unit's circle has", vc: "your (VC) has", rc: "your (RC) have", all: "you have" })[p.where || "all"]} ${OPS[p.op || "ge"]} ${p.n || 1} ${p.name || ""} marker(s)` },
    sungThisTurn: { label: "Your vanguard sung a Song this turn", params: [], text: () => "you sung a Song this turn" },
    rodeFrom: { label: "Your vanguard was placed this turn by riding from …", params: [["filter", "filter", "the old vanguard"]], text: (p) => `your vanguard was placed this turn by riding from ${flt(p.filter)}` },
    onVC: { label: "This unit is on (VC)", params: [], text: () => "this unit is on (VC)" },
    onRC: { label: "This unit is on (RC)", params: [], text: () => "this unit is on (RC)" },
    gradeVs: { label: "Your vanguard's grade vs your opponent's vanguard's", params: [["op", "op", "is"]], text: (p) => `your vanguard's grade is ${({ lt: "lower than", le: "at most", eq: "the same as", ge: "at least", gt: "higher than" })[p.op || "lt"]} your opponent's vanguard's` },
    targetRC: { label: "This battle's attack is on a rear-guard", params: [], text: () => "it attacked a rear-guard" },
    byMe: { label: "It was by your own card's ability", params: [], text: () => "it was by your own card's ability" },
    mainPhase: { label: "During your main phase", params: [], text: () => "during your main phase" },
    battlePhase: { label: "During your battle phase", params: [], text: () => "during your battle phase" },
  },

  costs: {
    CB: { label: "Counter-Blast", params: [["n", "num"], ["filter", "filter", "only these cards (blank = any)"]], text: (p) => `Counter-Blast ${p.n}${p.filter && Object.keys(p.filter).length ? ` (${flt(p.filter)})` : ""}` },
    SB: { label: "Soul-Blast", params: [["n", "num"], ["filter", "filter", "only these cards (blank = any)"]], text: (p) => `Soul-Blast ${p.n}${p.filter && Object.keys(p.filter).length ? ` (${flt(p.filter)})` : ""}` },
    EB: { label: "Energy-Blast", params: [["n", "num"]], text: (p) => `Energy-Blast ${p.n}` },
    discard: { label: "Discard from hand", params: [["n", "num"], ["filter", "filter"]], text: (p) => `discard ${p.n} ${flt(p.filter)}` },
    move: { label: "Move cards (put a card from hand into soul, bind this card, put this unit on the bottom of the deck…)", params: MOVE_PARAMS, text: (p) => moveText(p) },
    restSelf: { label: "[Rest] this unit", params: [], text: () => "[Rest] this unit" },
    retireSelf: { label: "Retire this unit", params: [], text: () => "retire this unit" },
    selfToSoul: { label: "Put this unit into soul", params: [], text: () => "put this unit into soul" },
    retireRC: { label: "Retire your rear-guards", params: [["n", "num"], ["filter", "filter"]], text: (p) => `retire ${p.n} of your ${p.filter && Object.keys(p.filter).length ? flt(p.filter) + " " : ""}rear-guards` },
    oneOf: { label: "Pay one of these costs (set by the card text)", params: [], text: (p) => (p.options || []).map((opt) => opt.map((x) => (SCHEMA.costs[x.type] ? SCHEMA.costs[x.type].text(x) : x.type)).join(" & ")).join(" or ") },
    discardGrades: { label: "Discard cards whose grades total N or more", params: [["n", "num", "total grade"]], text: (p) => `discard cards from hand whose grades total ${p.n || 3} or more` },
    restRC: { label: "[Rest] your rear-guards", params: [["n", "num"], ["filter", "filter"]], text: (p) => `[Rest] ${p.n || 1} of your ${p.filter && Object.keys(p.filter).length ? flt(p.filter) + " " : ""}rear-guards` },
    gFaceUp: { label: "Turn face-down G zone card(s) face up", params: [["n", "num"], ["filter", "filter"]], text: (p) => `turn ${p.n || 1} ${flt(p.filter)} in your G zone face up` },
    dropToTop: { label: "Return drop cards to the top of the deck (Seek Mate)", params: [["n", "num"], ["maxTrig", "num", "max trigger units (D-Seek Mate: 2)"]],
      text: (p) => `return ${p.n || 4} cards from your drop to the top of your deck${p.maxTrig !== undefined && p.maxTrig !== "" ? ` (max ${p.maxTrig} trigger units)` : ""}` },
  },

  effects: {
    power: { label: "Power +", params: [["amount", "num"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"], ...PER],
      text: (p) => `${tgt(p)} get(s) [Power] +${p.amount}${per(p)} ${dur(p)}` },
    crit: { label: "Critical +", params: [["amount", "num"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"], ...PER],
      text: (p) => `${tgt(p)} get(s) [Critical] +${p.amount}${per(p)} ${dur(p)}` },
    drive: { label: "Drive +", params: [["amount", "num"]], text: (p) => `your vanguard gets drive +${p.amount} until end of turn` },
    stand: { label: "[Stand] unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `[Stand] ${tgt(p)}` },
    rest: { label: "[Rest] unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `[Rest] ${tgt(p)}` },
    retire: { label: "Retire unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `retire ${tgt(p)}` },
    bind: { label: "Bind unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `bind ${tgt(p)}` },
    draw: { label: "Draw", params: [["n", "num"], ...PER], text: (p) => `draw ${p.n}${per(p)}` },
    CC: { label: "Counter-Charge", params: [["n", "num"], ...PER], text: (p) => `Counter-Charge ${p.n}${per(p)}` },
    SC: { label: "Soul-Charge", params: [["n", "num"], ...PER], text: (p) => `Soul-Charge ${p.n}${per(p)}` },
    EC: { label: "Energy-Charge", params: [["n", "num"], ...PER], text: (p) => `Energy-Charge ${p.n}${per(p)}` },
    heal: { label: "Heal damage", params: [["n", "num"]], text: (p) => `heal ${p.n} damage` },
    move: { label: "★ Move cards (any zone → any zone: search, call from drop/soul, to hand/soul/deck/bind/damage, discard, mill…)", params: MOVE_PARAMS, text: (p) => moveText(p) },
    restrict: { label: "★ Restriction: cannot attack / boost / intercept / be chosen / be retired / stand / be attacked, Resist",
      params: [["what", "restrict", "unit"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"]],
      text: (p) => `${tgt(p)} ${SCHEMA.paramOptions.restrict[p.what || "cantAttack"]} ${dur(p)}` },
    playerRule: { label: "★ Player rule: cannot call to GC / RC, cannot intercept, must guard with 2+",
      params: [["who", "side", "who"], ["what", "prule", "rule"], ["dur", "dur"], ["filter", "filter", "cards it applies to"]],
      text: (p) => `${p.who === "me" ? "you" : "your opponent"} ${SCHEMA.paramOptions.prule[p.what || "cantGuard"]}${p.filter && Object.keys(p.filter).some((k) => p.filter[k] !== "" && p.filter[k] !== false && p.filter[k] !== "any") ? " (" + flt(p.filter) + ")" : ""} ${dur(p)}` },
    grant: { label: "★ Give an ability (gets [AUTO]…): gives ability number N of this card",
      params: [["ability", "num", "ability number on this card"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"]],
      text: (p) => `${tgt(p)} get(s) ability ${p.ability || "?"} ${dur(p)}` },
    token: { label: "★ Call token(s) (Plant, Shadow Army…: a library card with Token ticked)", params: [["name", "text", "token card name"], ["n", "num", "how many"], ["where", "tokenWhere", "to"]],
      text: (p) => `call ${p.n || 1} "${p.name || "?"}" token(s) to ${p.where === "empty" ? "open (RC)" : "(RC)"}` },
    ticket: { label: "★ Put ticket(s) into hand (Quick Shield, Persona Shield…: a library card with Ticket ticked)", params: [["name", "text", "ticket card name"], ["n", "num", "how many"], ["who", "side", "to"]],
      text: (p) => `put ${p.n || 1} "${p.name || "?"}" ticket(s) into ${p.who === "opp" ? "your opponent's" : "your"} hand` },
    crest: { label: "★ Get a crest (a library card with type Crest; its abilities work in the crest zone)", params: [["name", "text", "crest card name"]], text: (p) => `put the crest "${p.name || "?"}" into your crest zone` },
    setState: { label: "★ Put units into a named state (Mental Pollution, engorged, successful…)", params: [["name", "text", "state name"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"]],
      text: (p) => `${tgt(p)} become(s) [${p.name || "?"}] state ${dur(p)}` },
    rideBy: { label: "★ Ride by an effect (Superior Ride: from deck / drop / soul / hand / ride deck / this card)",
      params: [["from", "rideFrom", "ride a card from"], ["filter", "filter"], ["upTo", "bool", "may choose none"], ["stand", "bool", "ride it as [Stand]"]],
      text: (p) => `ride ${p.from === "self" ? "this card" : `${flt(p.filter)} from your ${SCHEMA.paramOptions.rideFrom[p.from || "deck"]}`}${p.stand ? " as [Stand]" : ""}` },
    chooseOpts: { label: "★ Choose N of the options (mark the option steps A, B, C…)", params: [["n", "num", "how many options"]], text: (p) => `choose ${p.n || 1} of the following` },
    shield: { label: "Shield + (while guarding)", params: [["amount", "num"]], text: (p) => `this guardian gets [Shield] +${p.amount}` },
    cantBeHit: { label: "Attacked unit cannot be hit", params: [], text: () => "the attacked unit cannot be hit this battle" },
    search: { label: "Search zone for card(s)", params: [["from", "from"], ["n", "num"], ["filter", "filter"], ["dest", "dest"]],
      text: (p) => `search your ${p.from} for up to ${p.n} ${flt(p.filter)} and ${destT(p.dest)}` },
    lookTop: { label: "Look at top N, take some", params: [["n", "num", "look at"], ["pick", "num", "take up to"], ["filter", "filter"], ["dest", "dest"], ["rest", "restDest"]],
      text: (p) => `look at the top ${p.n} cards, choose up to ${p.pick} ${flt(p.filter)} and ${destT(p.dest)}, ${p.rest === "bottom" ? "put the rest on the bottom" : "shuffle the deck"}` },
    seekMate: { label: "Seek Mate: legion with a card from the deck", params: [["text", "text", "mate name contains"]], text: (p) => `search your deck for "${p.text || "?"}" and Legion with it, then shuffle` },
    lock: { label: "Lock (face down; unlocks in its owner's end phase)", params: [["target", "target"], ["n", "num"]], text: (p) => `lock ${TARGETS[p.target] || "the chosen unit"}` },
    unlock: { label: "Unlock your locked cards", params: [["n", "num", "up to"]], text: (p) => `unlock up to ${p.n || 1} of your locked cards` },
    delete: { label: "Delete the opponent's vanguard", params: [["target", "target"]], text: () => "delete your opponent's vanguard" },
    timeLeap: { label: "Time Leap (bind, call a unit 1 grade higher from the deck)", params: [["target", "target"], ["n", "num"]], text: (p) => `Time Leap ${TARGETS[p.target] || "your rear-guards"}` },
    marker: { label: "Put a marker on a circle (Dragontree, Treasure, Cradle…)", params: [["name", "text", "marker name"], ["where", "mwhere", "on"], ["without", "bool", "only circles without this marker"], ["n", "num", "how many circles"], ["target", "target", "or on the chosen unit(s)"]],
      text: (p) => `put a ${p.name || "marker"} marker on ${p.target ? TARGETS[p.target] || "the chosen unit" : ({ rc: "your (RC)", units: "your (VC) or (RC)", vc: "your (VC)", self: "this unit's circle" })[p.where || "rc"]}${p.without ? " without one" : ""}${+p.n > 1 ? " ×" + p.n : ""}` },
    sing: { label: "Sing a face up Song from your order zone (its \"when sung\" ability, then it turns face down)", params: [["filter", "filter"]], text: (p) => `sing a face up Song${p.filter && Object.keys(p.filter).length ? " (" + flt(p.filter) + ")" : ""}` },
    flipOZ: { label: "Turn order zone card(s) face up / down", params: [["n", "num"], ["up", "bool", "face up (off = face down)"], ["upTo", "bool", "up to"]], text: (p) => `turn ${p.upTo ? "up to " : ""}${p.n || 1} card(s) in your order zone face ${p.up === false ? "down" : "up"}` },
    dealDamage: { label: "Deal damage (damage checks, triggers too)", params: [["n", "num"], ["who", "side", "to"]], text: (p) => `deal ${p.n || 1} damage to ${p.who === "me" ? "yourself" : "your opponent"}` },
    payCost: { label: "Pay a cost mid-ability (you may; next steps with “only if you did” need it)", params: [],
      text: (p) => `you may pay ${(p.costs || []).map((c) => (SCHEMA.costs[c.type] ? SCHEMA.costs[c.type].text(c) : c.type)).join(" & ") || "a cost"}` },
    manual: { label: "✋ Manual: do it by hand (Judge panel)", params: [["text", "text", "what to do"]], text: (p) => `[Manual] ${p.text || "do the card's text by hand"}` },
    setWorld: { label: "Set your World", params: [["text", "text", "World (e.g. Dark Night)"]], text: (p) => `your World becomes "${p.text || "?"}"` },
    gift: { label: "Gain an Imaginary Gift", params: [["kind", "giftKind", "gift"]], text: (p) => `gain Imaginary Gift: ${({ force: "Force", accel: "Accel", protect: "Protect" })[p.kind || "force"]}` },
    callFromHand: { label: "Call from hand", params: [["n", "num"], ["filter", "filter"]], text: (p) => `call up to ${p.n} ${flt(p.filter)} from hand to RC` },
  },

  paramOptions: {
    gift: { force: "Force", accel: "Accel", protect: "Protect" },
    mwhere: { rc: "one of your (RC)", units: "one of your (VC) or (RC)", vc: "your (VC)", self: "this unit's circle" },
    mwhere2: { all: "your circles (total)", self: "this unit's circle", vc: "your (VC)", rc: "your (RC) (total)" },
    dur: { turn: "until end of turn", battle: "until end of battle", oppTurn: "until end of your opponent's turn", nextTurn: "until end of your next turn", game: "for the rest of the game (while on the field)" },
    restrict: { cantAttack: "cannot attack", cantBoost: "cannot boost", cantIntercept: "cannot intercept", cantBeAttacked: "cannot be attacked",
      cantBeChosen: "cannot be chosen by your opponent's effects", resist: "gets [Resist]", cantBeRetired: "cannot be retired by your opponent's effects", cantStand: "does not stand", canBoost: "gets [Boost]", canIntercept: "gets [Intercept]", canAttackBack: "can attack from the back row", canInterceptBack: "can intercept from the back row" },
    prule: { cantGuard: "cannot call cards from hand to (GC)", cantCall: "cannot call cards to (RC)", cantIntercept: "cannot intercept", mustGuard2: "must call two or more cards from hand to guard" },
    side: { opp: "your opponent", me: "you" },
    tokenWhere: { any: "a (RC) you choose", empty: "an open (RC)" },
    powWho: { self: "this unit", vc: "your vanguard", anyRC: "one of your rear-guards", anyUnit: "one of your units", oppVc: "opponent's vanguard" },
    rideFrom: { deck: "deck", drop: "drop", soul: "soul", hand: "hand", rideDeck: "ride deck", bind: "bind zone", self: "this card itself" },
    from: { deck: "deck", drop: "drop", soul: "soul" },
    dest: { hand: "hand", RC: "RC (call)", soul: "soul" },
    restDest: { shuffle: "shuffle deck", bottom: "bottom of deck" },
    ctype: { any: "any card", unit: "normal unit", trigger: "trigger unit", anyunit: "any unit", order: "order", g: "G unit" },
    count: { myAutoMOD: "your AutoMOD gauges", myOrderZoneDown: "face down cards in your order zone", myOrderZoneUp: "face up cards in your order zone", myArms: "Arms on your vanguard", myLocked: "your locked cards", oppLocked: "opponent's locked cards", oppFrontRC: "opponent's front row rear-guards", myHand: "your hand", mySoul: "your soul", myDrop: "your drop", myDamage: "your damage zone", myDamageUp: "your face-up damage", myDamageDown: "your face-down damage",
      myBind: "your bind zone", myDeck: "your deck", myGUp: "your face-up G cards", myOrderZone: "your order zone", myRC: "your rear-guards", myFrontRC: "your front row rear-guards",
      myBackRC: "your back row rear-guards", myUnits: "your units", myRested: "your rested rear-guards", myEnergy: "your energy",
      oppHand: "opponent's hand", oppSoul: "opponent's soul", oppDrop: "opponent's drop", oppDamage: "opponent's damage zone", oppBind: "opponent's bind zone",
      oppRC: "opponent's rear-guards", oppUnits: "opponent's units",
      myColumn: "your other units in this unit's column", oppColumn: "opponent's units in this unit's column", imprisoned: "opponent's cards in your Prison", myCrest: "your crest zone", battleNo: "this turn's battles (this is the Nth)", lastCount: "cards the step before handled", lastMatch: "cards the step before handled (matching)" },
    op: { ge: "≥ (or more)", le: "≤ (or less)", eq: "= (exactly)", gt: "> (more than)", lt: "< (less than)" },
    who: { vc: "your vanguard", self: "this unit", oppVc: "opponent's vanguard", attacker: "the attacking unit", attacked: "the attacked unit" },
    mfrom: { self: "this card itself", automod: "your AutoMOD gauge", hand: "your hand", deck: "your deck (search)", deckTop: "the top of your deck (look at N)", drop: "your drop", soul: "your soul",
      damage: "your damage zone", bind: "your bind zone", gzone: "your G zone (face up)", orderZone: "your order zone",
      myRC: "your rear-guards", myFrontRC: "your front row rear-guards", myBackRC: "your back row rear-guards",
      oppHand: "opponent's hand", oppDeckTop: "the top of opponent's deck", oppDrop: "opponent's drop", oppSoul: "opponent's soul", oppDamage: "opponent's damage zone",
      oppRC: "opponent's rear-guards", oppFrontRC: "opponent's front row rear-guards" },
    mto: { hand: "hand", RC: "RC (call)", automod: "AutoMOD gauge (face up)", soul: "soul", drop: "drop (discard / retire)", deckTop: "top of the deck", deckBottom: "bottom of the deck", deck: "into the deck (shuffle)", bind: "bind zone",
      damageUp: "damage zone (face up)", damageDown: "damage zone (face down)", removed: "removed from the game", orderZone: "order zone", prison: "your Prison (imprison)" },
    chooser: { me: "you choose", opp: "your opponent chooses" },
    lookRest: { shuffle: "shuffle the rest into the deck", bottom: "the rest on the bottom", top: "the rest back on top", drop: "the rest into the drop", soul: "the rest into the soul" },
    trig: { "": "any", none: "not a trigger", any: "any trigger", crit: "critical", front: "front", draw: "draw", heal: "heal", over: "over", stand: "stand" },
    gradeVC: { "": "any", lt: "lower than your vanguard", le: "≤ your vanguard", eq: "same as your vanguard", ge: "≥ your vanguard", gt: "higher than your vanguard", plus1: "your vanguard's grade + 1" },
    onlyIf: { "": "always", did: "only if the step before did something (\"if you did\")", didNot: "only if the step before did nothing", match: "only if the step before's cards include…", noMatch: "only if they include none of…" },
    opt: { "": "—", A: "option A", B: "option B", C: "option C", D: "option D" },
    later: { "": "now", battle: "at the end of that battle", turn: "at the end of that turn" },
  },
};
const OPS = { ge: "≥", le: "≤", eq: "=", gt: ">", lt: "<" };
const cnt = (w) => SCHEMA.paramOptions.count[w || "mySoul"] || w;
const per = (p) => {
  if (!p.per) return "";
  const f = flt(p.perFilter, false).replace(/ ?card\(s\)$/, "");
  return ` for each ${f ? f + " " : ""}card in ${cnt(p.per)}`;
};
function moveText(p) {
  const O = SCHEMA.paramOptions;
  const look = p.from === "deckTop" || p.from === "oppDeckTop" ? `look at the top ${p.look || p.n || 1} cards, ` : "";
  const who = p.chooser === "opp" ? "your opponent chooses " : "choose ";
  const how = p.all ? "all" : `${p.upTo ? "up to " : ""}${p.n || 1}`;
  const rest = look ? `, ${O.lookRest[p.rest || "shuffle"]}` : "";
  return `${look}${p.from === "self" ? "put this card" : `${p.random ? "" : who}${how} ${flt(p.filter)} from ${look ? "among them" : O.mfrom[p.from || "drop"]}${p.random ? " at random" : ""}`}${p.reveal ? ", reveal" : ""} → ${O.mto[p.to || "hand"]}${rest}`;
}

function tgt(p) {
  const t = TARGETS[p.target] || "this unit";
  const extra = p.target && p.target.startsWith("choose") ? ` (${p.n || 1}${flt(p.filter, true)})` : "";
  return t + extra;
}
function dur(p) { return SCHEMA.paramOptions.dur[p.dur || "turn"]; }
function destT(d) { return { hand: "put into hand", RC: "call to RC", soul: "put into soul" }[d || "hand"]; }
function flt(f, short) {
  if (!f) return short ? "" : "card(s)";
  const bits = [];
  if (f.gmin !== undefined && f.gmin !== "") bits.push(`grade ${f.gmin}+`);
  if (f.gmax !== undefined && f.gmax !== "") bits.push(`grade ≤${f.gmax}`);
  if (f.name) bits.push(`"${f.name}"`);
  if (Array.isArray(f.nameAny) && f.nameAny.length) bits.push(f.nameAny.map((n) => `"${n}"`).join(" or "));
  if (f.ctype && f.ctype !== "any") bits.push(SCHEMA.paramOptions.ctype[f.ctype]);
  if (f.nameExact) bits.push(`named "${f.nameExact}"`);
  if (f.clan) bits.push(`<${f.clan}>`);
  if (Array.isArray(f.names) && f.names.length) bits.push(f.names.map((n) => `"${n}"`).join(" or "));
  if (f.kai) bits.push("with a Kai icon");
  if (f.trig) bits.push(f.trig === "none" ? "non-trigger" : f.trig === "any" ? "trigger" : f.trig + " trigger");
  if (f.sentinel === "yes") bits.push("sentinel");
  if (f.sameNameVC) bits.push("with your vanguard's name");
  if (f.gradeVC) bits.push("grade " + SCHEMA.paramOptions.gradeVC[f.gradeVC]);
  if (f.other) bits.push("other than this card");
  if (f.state) bits.push(`in [${f.state}] state`);
  if (f.restState) bits.push(f.restState === "rest" ? "rested" : "standing");
  if (!bits.length) return short ? "" : "card(s)";
  return short ? ", " + bits.join(", ") : bits.join(" ") + " card(s)";
}

function describeAbility(ab) {
  let s = `[${ab.kind}]`;
  if (["AUTO", "ACT", "CONT", "REPL"].includes(ab.kind)) s += `(${ab.zone || "VC"})`;
  if (ab.once === "turn") s += "[1/Turn]";
  if (ab.once === "game") s += "[1/Game]";
  if (ab.once === "divine") s += "[Divine Skill]";
  if (ab.once === "unique") s += "[Unique Skill]";
  if (ab.once === "nameTurn") s += "[same name 1/Turn]";
  if (ab.granted) s += "[given]";
  if ((ab.kind === "AUTO" || ab.kind === "REPL") && ab.mandatory) s += "[Mandatory]";
  s += ": ";
  if (ab.kind === "REPL") s += (SCHEMA.replEvents[ab.when] || "If …") + ", ";
  if (ab.kind === "AUTO") {
    s += SCHEMA.events[ab.when] || "?";
    if (ab.whenFrom) s += ` (${ab.whenFrom === "notHand" ? "not from hand" : "from " + ab.whenFrom})`;
    if (ab.whenFilter && Object.keys(ab.whenFilter).some((k) => ab.whenFilter[k] !== "" && ab.whenFilter[k] !== false && ab.whenFilter[k] !== "any")) s += ` (${SCHEMA.eventSubject[ab.when] || "card"}: ${flt(ab.whenFilter)})`;
    s += ", ";
  }
  const conds = (ab.conds || []).map((c) => SCHEMA.conds[c.type]?.text(c)).filter(Boolean);
  if (conds.length) s += "if " + conds.join(" and ") + ", ";
  const costs = (ab.costs || []).map((c) => SCHEMA.costs[c.type]?.text(c)).filter(Boolean);
  if (costs.length) s += `COST[${costs.join(" & ")}], `;
  let effs = (ab.effects || []).map((e) => {
    let t = SCHEMA.effects[e.type]?.text(e);
    if (!t) return "";
    if (ab.kind === "CONT") t = t.replace(/ until end of (turn|battle)$/, ""); // always-on: no duration
    const pre = e.onlyIf === "did" ? "if you did, " : e.onlyIf === "didNot" ? "if you did not, " : e.onlyIf === "match" ? `if it was ${flt(e.onlyFilter)}, ` : e.onlyIf === "noMatch" ? `if none was ${flt(e.onlyFilter)}, ` : "";
    const cond = e.ifCond && SCHEMA.conds[e.ifCond.type] ? `if ${SCHEMA.conds[e.ifCond.type].text(e.ifCond)}, ` : "";
    const when = e.later ? `at the end of that ${e.later}, ` : "";
    return (e.opt ? `[${e.opt}] ` : "") + when + pre + cond + t;
  }).filter(Boolean).join(", then ");
  if (ab.kind === "REPL") effs = `instead ${SCHEMA.insteadTo[ab.insteadTo || "stay"]}${effs ? ", then " + effs : ""}`;
  s += effs || "(no effect)";
  return s + ".";
}
