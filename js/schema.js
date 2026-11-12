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
  },

  costs: {
    CB: { label: "Counter-Blast", params: [["n", "num"]], text: (p) => `Counter-Blast ${p.n}` },
    SB: { label: "Soul-Blast", params: [["n", "num"]], text: (p) => `Soul-Blast ${p.n}` },
    EB: { label: "Energy-Blast", params: [["n", "num"]], text: (p) => `Energy-Blast ${p.n}` },
    discard: { label: "Discard from hand", params: [["n", "num"]], text: (p) => `discard ${p.n} card(s)` },
    restSelf: { label: "[Rest] this unit", params: [], text: () => "[Rest] this unit" },
    retireSelf: { label: "Retire this unit", params: [], text: () => "retire this unit" },
    selfToSoul: { label: "Put this unit into soul", params: [], text: () => "put this unit into soul" },
    retireRC: { label: "Retire your rear-guards", params: [["n", "num"]], text: (p) => `retire ${p.n} of your rear-guards` },
    dropToTop: { label: "Return drop cards to the top of the deck (Seek Mate)", params: [["n", "num"], ["maxTrig", "num", "max trigger units (D-Seek Mate: 2)"]],
      text: (p) => `return ${p.n || 4} cards from your drop to the top of your deck${p.maxTrig !== undefined && p.maxTrig !== "" ? ` (max ${p.maxTrig} trigger units)` : ""}` },
  },

  effects: {
    power: { label: "Power +", params: [["amount", "num"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"]],
      text: (p) => `${tgt(p)} get(s) [Power] +${p.amount} ${dur(p)}` },
    crit: { label: "Critical +", params: [["amount", "num"], ["target", "target"], ["n", "num", "how many (if choosing)"], ["dur", "dur"], ["filter", "filter"]],
      text: (p) => `${tgt(p)} get(s) [Critical] +${p.amount} ${dur(p)}` },
    drive: { label: "Drive +", params: [["amount", "num"]], text: (p) => `your vanguard gets drive +${p.amount} until end of turn` },
    stand: { label: "[Stand] unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `[Stand] ${tgt(p)}` },
    rest: { label: "[Rest] unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `[Rest] ${tgt(p)}` },
    retire: { label: "Retire unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `retire ${tgt(p)}` },
    bind: { label: "Bind unit", params: [["target", "target"], ["n", "num"], ["filter", "filter"]], text: (p) => `bind ${tgt(p)}` },
    draw: { label: "Draw", params: [["n", "num"]], text: (p) => `draw ${p.n}` },
    CC: { label: "Counter-Charge", params: [["n", "num"]], text: (p) => `Counter-Charge ${p.n}` },
    SC: { label: "Soul-Charge", params: [["n", "num"]], text: (p) => `Soul-Charge ${p.n}` },
    EC: { label: "Energy-Charge", params: [["n", "num"]], text: (p) => `Energy-Charge ${p.n}` },
    heal: { label: "Heal damage", params: [["n", "num"]], text: (p) => `heal ${p.n} damage` },
    shield: { label: "Shield + (while guarding)", params: [["amount", "num"]], text: (p) => `this guardian gets [Shield] +${p.amount}` },
    cantBeHit: { label: "Attacked unit cannot be hit", params: [], text: () => "the attacked unit cannot be hit this battle" },
    search: { label: "Search zone for card(s)", params: [["from", "from"], ["n", "num"], ["filter", "filter"], ["dest", "dest"]],
      text: (p) => `search your ${p.from} for up to ${p.n} ${flt(p.filter)} and ${destT(p.dest)}` },
    lookTop: { label: "Look at top N, take some", params: [["n", "num", "look at"], ["pick", "num", "take up to"], ["filter", "filter"], ["dest", "dest"], ["rest", "restDest"]],
      text: (p) => `look at the top ${p.n} cards, choose up to ${p.pick} ${flt(p.filter)} and ${destT(p.dest)}, ${p.rest === "bottom" ? "put the rest on the bottom" : "shuffle the deck"}` },
    seekMate: { label: "Seek Mate: legion with a card from the deck", params: [["text", "text", "mate name contains"]], text: (p) => `search your deck for "${p.text || "?"}" and Legion with it, then shuffle` },
    setWorld: { label: "Set your World", params: [["text", "text", "World (e.g. Dark Night)"]], text: (p) => `your World becomes "${p.text || "?"}"` },
    gift: { label: "Gain an Imaginary Gift", params: [["kind", "giftKind", "gift"]], text: (p) => `gain Imaginary Gift: ${({ force: "Force", accel: "Accel", protect: "Protect" })[p.kind || "force"]}` },
    callFromHand: { label: "Call from hand", params: [["n", "num"], ["filter", "filter"]], text: (p) => `call up to ${p.n} ${flt(p.filter)} from hand to RC` },
  },

  paramOptions: {
    gift: { force: "Force", accel: "Accel", protect: "Protect" },
    dur: { turn: "until end of turn", battle: "until end of battle" },
    from: { deck: "deck", drop: "drop", soul: "soul" },
    dest: { hand: "hand", RC: "RC (call)", soul: "soul" },
    restDest: { shuffle: "shuffle deck", bottom: "bottom of deck" },
    ctype: { any: "any card", unit: "normal unit", trigger: "trigger unit", anyunit: "any unit", order: "order" },
  },
};

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
  s += (ab.effects || []).map((e) => SCHEMA.effects[e.type]?.text(e)).filter(Boolean).join(", then ") || "(no effect)";
  return s + ".";
}
