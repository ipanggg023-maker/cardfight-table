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
};
const CONT_TARGETS = ["self", "vc", "allFront", "allFrontRC", "allMyRC", "allMyUnits"];

// Move cards (effect and cost) share these settings
const MOVE_PARAMS = [["from", "mfrom", "from"], ["to", "mto", "to"], ["n", "num", "how many"], ["upTo", "bool", "up to (may choose fewer)"], ["all", "bool", "all matching cards"],
  ["random", "bool", "at random"], ["look", "num", "look at the top (deck top only)"], ["rest", "lookRest", "the rest"], ["chooser", "chooser", "who chooses"], ["reveal", "bool", "reveal"], ["filter", "filter"]];
const PER = [["per", "count", "× for each card in (optional)"], ["perFilter", "filter", "counting only"]];
const SCHEMA = {
  kinds: {
    AUTO: "AUTO (triggers on an event)",
    ACT: "ACT (activate with a button)",
    CONT: "CONT (always on)",
    ORDER: "Normal Order (play from hand, main phase)",
    BLITZ: "Blitz Order (play from hand while guarding)",
  },
  zones: { VC: "VC", RC: "RC", "VC/RC": "VC/RC", GC: "GC (guardian)", OZ: "Order zone (set orders)", any: "Anywhere" },
  events: {
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
  },

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
  },

  costs: {
    CB: { label: "Counter-Blast", params: [["n", "num"]], text: (p) => `Counter-Blast ${p.n}` },
    SB: { label: "Soul-Blast", params: [["n", "num"]], text: (p) => `Soul-Blast ${p.n}` },
    EB: { label: "Energy-Blast", params: [["n", "num"]], text: (p) => `Energy-Blast ${p.n}` },
    discard: { label: "Discard from hand", params: [["n", "num"], ["filter", "filter"]], text: (p) => `discard ${p.n} ${flt(p.filter)}` },
    move: { label: "Move cards (put a card from hand into soul, bind this card, put this unit on the bottom of the deck…)", params: MOVE_PARAMS, text: (p) => moveText(p) },
    restSelf: { label: "[Rest] this unit", params: [], text: () => "[Rest] this unit" },
    retireSelf: { label: "Retire this unit", params: [], text: () => "retire this unit" },
    selfToSoul: { label: "Put this unit into soul", params: [], text: () => "put this unit into soul" },
    retireRC: { label: "Retire your rear-guards", params: [["n", "num"]], text: (p) => `retire ${p.n} of your rear-guards` },
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
    manual: { label: "✋ Manual: do it by hand (Judge panel)", params: [["text", "text", "what to do"]], text: (p) => `[Manual] ${p.text || "do the card's text by hand"}` },
    setWorld: { label: "Set your World", params: [["text", "text", "World (e.g. Dark Night)"]], text: (p) => `your World becomes "${p.text || "?"}"` },
    gift: { label: "Gain an Imaginary Gift", params: [["kind", "giftKind", "gift"]], text: (p) => `gain Imaginary Gift: ${({ force: "Force", accel: "Accel", protect: "Protect" })[p.kind || "force"]}` },
    callFromHand: { label: "Call from hand", params: [["n", "num"], ["filter", "filter"]], text: (p) => `call up to ${p.n} ${flt(p.filter)} from hand to RC` },
  },

  paramOptions: {
    gift: { force: "Force", accel: "Accel", protect: "Protect" },
    dur: { turn: "until end of turn", battle: "until end of battle", oppTurn: "until end of your opponent's turn", nextTurn: "until end of your next turn", game: "for the rest of the game (while on the field)" },
    restrict: { cantAttack: "cannot attack", cantBoost: "cannot boost", cantIntercept: "cannot intercept", cantBeAttacked: "cannot be attacked",
      cantBeChosen: "cannot be chosen by your opponent's effects", resist: "gets [Resist]", cantBeRetired: "cannot be retired by your opponent's effects", cantStand: "does not stand" },
    prule: { cantGuard: "cannot call cards from hand to (GC)", cantCall: "cannot call cards to (RC)", cantIntercept: "cannot intercept", mustGuard2: "must call two or more cards from hand to guard" },
    side: { opp: "your opponent", me: "you" },
    from: { deck: "deck", drop: "drop", soul: "soul" },
    dest: { hand: "hand", RC: "RC (call)", soul: "soul" },
    restDest: { shuffle: "shuffle deck", bottom: "bottom of deck" },
    ctype: { any: "any card", unit: "normal unit", trigger: "trigger unit", anyunit: "any unit", order: "order", g: "G unit" },
    count: { myHand: "your hand", mySoul: "your soul", myDrop: "your drop", myDamage: "your damage zone", myDamageUp: "your face-up damage", myDamageDown: "your face-down damage",
      myBind: "your bind zone", myDeck: "your deck", myGUp: "your face-up G cards", myOrderZone: "your order zone", myRC: "your rear-guards", myFrontRC: "your front row rear-guards",
      myBackRC: "your back row rear-guards", myUnits: "your units", myRested: "your rested rear-guards", myEnergy: "your energy",
      oppHand: "opponent's hand", oppSoul: "opponent's soul", oppDrop: "opponent's drop", oppDamage: "opponent's damage zone", oppBind: "opponent's bind zone",
      oppRC: "opponent's rear-guards", oppUnits: "opponent's units", battleNo: "this turn's battles (this is the Nth)", lastCount: "cards the step before handled", lastMatch: "cards the step before handled (matching)" },
    op: { ge: "≥ (or more)", le: "≤ (or less)", eq: "= (exactly)", gt: "> (more than)", lt: "< (less than)" },
    who: { vc: "your vanguard", self: "this unit", oppVc: "opponent's vanguard", attacker: "the attacking unit", attacked: "the attacked unit" },
    mfrom: { self: "this card itself", hand: "your hand", deck: "your deck (search)", deckTop: "the top of your deck (look at N)", drop: "your drop", soul: "your soul",
      damage: "your damage zone", bind: "your bind zone", gzone: "your G zone (face up)", orderZone: "your order zone",
      myRC: "your rear-guards", myFrontRC: "your front row rear-guards", myBackRC: "your back row rear-guards",
      oppHand: "opponent's hand", oppDeckTop: "the top of opponent's deck", oppDrop: "opponent's drop", oppSoul: "opponent's soul", oppDamage: "opponent's damage zone",
      oppRC: "opponent's rear-guards", oppFrontRC: "opponent's front row rear-guards" },
    mto: { hand: "hand", RC: "RC (call)", soul: "soul", drop: "drop (discard / retire)", deckTop: "top of the deck", deckBottom: "bottom of the deck", bind: "bind zone",
      damageUp: "damage zone (face up)", damageDown: "damage zone (face down)", removed: "removed from the game", orderZone: "order zone" },
    chooser: { me: "you choose", opp: "your opponent chooses" },
    lookRest: { shuffle: "shuffle the rest into the deck", bottom: "the rest on the bottom", top: "the rest back on top", drop: "the rest into the drop", soul: "the rest into the soul" },
    trig: { "": "any", none: "not a trigger", any: "any trigger", crit: "critical", front: "front", draw: "draw", heal: "heal", over: "over", stand: "stand" },
    gradeVC: { "": "any", lt: "lower than your vanguard", le: "≤ your vanguard", eq: "same as your vanguard", ge: "≥ your vanguard", gt: "higher than your vanguard", plus1: "your vanguard's grade + 1" },
    onlyIf: { "": "always", did: "only if the step before did something (\"if you did\")", didNot: "only if the step before did nothing", match: "only if the step before's cards include…", noMatch: "only if they include none of…" },
    opt: { "": "—", A: "option A", B: "option B", C: "option C", D: "option D" },
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
  if (f.ctype && f.ctype !== "any") bits.push(SCHEMA.paramOptions.ctype[f.ctype]);
  if (f.nameExact) bits.push(`named "${f.nameExact}"`);
  if (f.clan) bits.push(`<${f.clan}>`);
  if (f.trig) bits.push(f.trig === "none" ? "non-trigger" : f.trig === "any" ? "trigger" : f.trig + " trigger");
  if (f.sentinel === "yes") bits.push("sentinel");
  if (f.sameNameVC) bits.push("with your vanguard's name");
  if (f.gradeVC) bits.push("grade " + SCHEMA.paramOptions.gradeVC[f.gradeVC]);
  if (f.other) bits.push("other than this card");
  if (!bits.length) return short ? "" : "card(s)";
  return short ? ", " + bits.join(", ") : bits.join(" ") + " card(s)";
}

function describeAbility(ab) {
  let s = `[${ab.kind}]`;
  if (["AUTO", "ACT", "CONT"].includes(ab.kind)) s += `(${ab.zone || "VC"})`;
  if (ab.once === "turn") s += "[1/Turn]";
  if (ab.once === "game") s += "[1/Game]";
  if (ab.once === "divine") s += "[Divine Skill]";
  if (ab.once === "unique") s += "[Unique Skill]";
  if (ab.kind === "AUTO" && ab.mandatory) s += "[Mandatory]";
  s += ": ";
  if (ab.kind === "AUTO") s += (SCHEMA.events[ab.when] || "?") + ", ";
  const conds = (ab.conds || []).map((c) => SCHEMA.conds[c.type]?.text(c)).filter(Boolean);
  if (conds.length) s += "if " + conds.join(" and ") + ", ";
  const costs = (ab.costs || []).map((c) => SCHEMA.costs[c.type]?.text(c)).filter(Boolean);
  if (costs.length) s += `COST[${costs.join(" & ")}], `;
  s += (ab.effects || []).map((e) => {
    let t = SCHEMA.effects[e.type]?.text(e);
    if (!t) return "";
    if (ab.kind === "CONT") t = t.replace(/ until end of (turn|battle)$/, ""); // always-on: no duration
    const pre = e.onlyIf === "did" ? "if you did, " : e.onlyIf === "didNot" ? "if you did not, " : e.onlyIf === "match" ? `if it was ${flt(e.onlyFilter)}, ` : e.onlyIf === "noMatch" ? `if none was ${flt(e.onlyFilter)}, ` : "";
    return (e.opt ? `[${e.opt}] ` : "") + pre + t;
  }).filter(Boolean).join(", then ") || "(no effect)";
  return s + ".";
}
