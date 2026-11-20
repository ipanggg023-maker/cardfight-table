// Card round A: Hollow, the Aichi icon (like Kai), icon timings / conditions, small wordings.
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 7000;
const inst = (c) => ({ ...c, uid: ++uid });
const slot = (c) => ({ card: inst(c), rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
function table() {
  const { Game, TextParse: TP } = load();
  const main = Array.from({ length: 50 }, (_, i) => unit(TP, "m" + i, "Filler " + i, 1));
  const deck = { name: "t", format: "premium", ride: [], main, g: [] };
  Game.newGame(["A", "B"], [deck, deck], { first: 0 });
  const S = Game.state();
  Object.assign(S, { phase: "main", active: 0, controller: 0, turn: 3, pending: null });
  S.players[0].slots.vc = slot(unit(TP, "v", "Vanguard", 3));
  S.players[1].slots.vc = slot(unit(TP, "o", "Other", 3));
  return { Game, TP, S };
}
const read = (TP, t) => TP.abilities(t);
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
const manual = (abs) => abs.flatMap((a) => [...a.effects, ...a.costs]).filter((e) => e.type === "manual");

test("Hollow keyword: placed on (RC) → may become hollowed, retired at the end of turn", () => {
  const { TP } = table();
  const [a] = read(TP, "[AUTO]:Hollow (When placed on (RC), you may have it become hollowed. If you do, retire it at the end of turn)");
  assert.equal(a.when, "placedRC");
  same(a.effects.map((e) => e.type), ["hollow", "retire"]);
  assert.equal(a.effects[1].later, "turn");
});

test("a hollowed unit has the state, fires 'hollowed', and is retired at end of turn", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  const text = "[AUTO]:Hollow (When placed on (RC), you may have it become hollowed. If you do, retire it at the end of turn)\n[CONT](RC):If this unit is hollowed, this unit gets [Power]+10000.";
  const c = inst(unit(TP, "h", "Hollow Unit", 1, text));
  p.hand.push(c);
  const r = Game.call(c.uid, "fl"); await settle(Game); await r;
  assert.equal(p.slots.fl.card.uid, c.uid);
  assert.equal(Game.power(0, "fl"), 20000, "hollowed: +10000 from its own [CONT]");
  const e = Game.endTurn(); await settle(Game); await e;
  assert.ok(!p.slots.fl || !p.slots.fl.card || p.slots.fl.card.uid !== c.uid, "retired at the end of the turn");
  assert.ok(p.drop.some((x) => x.uid === c.uid));
});

test("'when this unit becomes hollowed other than during battle phase'", () => {
  const { TP } = table();
  const [a] = read(TP, "[AUTO](RC):When this unit becomes hollowed other than during battle phase, draw a card.");
  assert.equal(a.when, "hollowed");
  same(a.conds, [{ type: "battlePhase", not: true }]);
});

test("Aichi icon: stat line, filter, and icon timings keep the icon", () => {
  const { TP } = table();
  assert.equal(TP.parse("Normal Unit | Dragon Empire | Human | Grade 1 | Power 8000 | Critical 1 | Shield 5000 | Boost, Aichi").aichi, true);
  const [p] = read(TP, "[AUTO](Drop):When your grade 3 or greater vanguard with an Aichi icon is placed, [COST][Counter-Blast 1], and call this card to (RC).");
  assert.equal(p.when, "allyPlacedVC");
  same(p.whenFilter, { gmin: 3, aichi: true });
  const [at] = read(TP, "[AUTO](Drop):When your vanguard with a Kai icon is attacked, [COST][bind this card], and that unit gets [Power]+10000 until end of that battle.");
  assert.equal(at.when, "allyAttacked");
  assert.equal(at.whenFilter.kai, true);
  assert.equal(at.effects[0].target, "eventUnit", "'that unit' = the attacked unit");
  const [st] = read(TP, "[AUTO](RC):When your vanguard with a Kai icon [Stand] by your card's ability, you may [Stand] this unit.");
  assert.equal(st.when, "allyStood");
  assert.equal(st.whenFilter.kai, true);
  same(manual([p, at, st]), []);
});

test("'if you have a vanguard with a Kai icon' keeps the icon", () => {
  const { TP } = table();
  const [a] = read(TP, "[CONT](RC):If you have a grade 3 or greater vanguard with a Kai icon, this unit gets [Power]+5000.");
  assert.ok(a.conds.some((c) => c.type === "unit" && c.who === "vc" && c.filter.kai && c.filter.gmin === 3));
});

test("the Aichi persona ride line is a card field", () => {
  const { TP } = table();
  const t = "[CONT]:The normal ride of this card from a grade 3 card with an Aichi icon and a different card name from this card also becomes a persona ride.";
  assert.equal(TP.parse(t).personaFromAichi, true);
  same(read(TP, t), []);
});

test("zone counts: 'if your soul has three or more cards' is 3, not 1", () => {
  const { TP } = table();
  const [a] = read(TP, "[AUTO](VC):When this unit attacks, if your soul has three or more cards, draw a card.");
  same(a.conds, [{ type: "count", what: "mySoul", op: "ge", n: 3 }]);
  const [b] = read(TP, "[AUTO](VC):When this unit attacks, draw a card. If you hand has two or more cards, choose a card from your hand, and discard it.");
  same(b.effects[1].ifCond, { type: "count", what: "myHand", op: "ge", n: 2 });
});

test("'if this unit was placed from hand' checks the event's source", async () => {
  const { Game, TP, S } = table();
  const [a] = read(TP, "[AUTO]:When this unit is placed on (RC), draw a card. If this unit was placed from hand, this unit gets [Power]+5000 until end of turn.");
  same(a.effects[1].ifCond, { type: "eventFrom", from: "hand" });
  const p = S.players[0];
  const c = inst(unit(TP, "f", "From Hand", 1, "[AUTO]:When this unit is placed on (RC), if this unit was placed from hand, this unit gets [Power]+5000 until end of turn."));
  p.hand.push(c);
  const r = Game.call(c.uid, "fl"); await settle(Game); await r;
  assert.equal(Game.power(0, "fl"), 15000);
});

test("the Energy Generator crest text makes no abilities (the game runs it)", () => {
  const { TP } = table();
  const t = "[AUTO]:When you ride, put this card into the crest zone, and if you went second, [Energy-Charge 3].\n[CONT]:You may have up to ten energy.\n[AUTO]:At the beginning of your ride phase, [Energy-Charge 3].";
  same(read(TP, t), []);
});
