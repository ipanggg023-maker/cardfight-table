// Card round C: a [COST] paid "at the end of that battle / turn", and "choose a column".
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 9000;
const inst = (c) => ({ ...c, uid: ++uid });
const slot = (c) => ({ card: inst(c), rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
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

test("a [COST] after 'at the end of that battle' is paid then, and the next step needs it", () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](RC):When this unit boosts, this unit gets [Power]+5000 until end of that battle, and at the end of that battle, [COST][put this unit into soul], and draw a card.");
  same(a.costs, []);
  same(a.effects.map((e) => [e.type, e.later || "", e.onlyIf || ""]), [["power", "", ""], ["payCost", "battle", ""], ["draw", "battle", "did"]]);
});

test("end-of-turn steps run together: pay, then draw", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  const c = inst(unit(TP, "x", "Late Payer", 1, "[AUTO](RC):When this unit is placed on (RC), this unit gets [Power]+5000 until end of turn, and at the end of the turn, [COST][put this unit into soul], and draw a card."));
  p.hand.push(c);
  const r = Game.call(c.uid, "fl"); await settle(Game); await r;
  assert.equal(Game.power(0, "fl"), 15000);
  const hand = p.hand.length;
  const e = Game.endTurn(); await settle(Game); await e;
  assert.ok(p.soul.some((x) => x.uid === c.uid), "paid: into soul");
  assert.ok(S.players[0].hand.length >= hand + 1, "then drew");
});

test("choose a column: stand its rear-guards, they get +5000; two columns when the condition holds", async () => {
  const { Game, TP, S } = table();
  const [a] = TP.abilities("[AUTO](VC):When this unit attacks, choose a column, [Stand] all of your rear-guards in that column, and they get [Power]+5000 until end of turn. If you persona rode this turn, choose two instead of one.");
  same(a.effects.map((e) => e.type), ["chooseColumn", "stand", "power"]);
  same(a.effects[0].more, { n: 2, cond: { type: "persona" } });
  assert.equal(a.effects[1].target, "thatUnit");
  const p = S.players[0];
  p.slots.bl = slot(unit(TP, "b", "Back Left", 1));
  p.slots.bl.rest = true;
  p.slots.br = slot(unit(TP, "r", "Back Right", 1));
  p.slots.br.rest = true;
  const c = inst(unit(TP, "x", "Column Caller", 1, "[AUTO]:When this unit is placed on (RC), choose a column, [Stand] all of your rear-guards in that column, and they get [Power]+5000 until end of turn."));
  p.hand.push(c);
  const r = Game.call(c.uid, "fl"); await settle(Game); await r; // the test answers "Left column"
  assert.equal(p.slots.bl.rest, false, "left column stood");
  assert.equal(p.slots.br.rest, true, "right column untouched");
  assert.equal(Game.power(0, "fl"), 15000);
  assert.equal(Game.power(0, "bl"), 15000);
});
