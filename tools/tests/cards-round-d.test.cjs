// Card round D: the plant gauge (face-up cards under your Blast token).
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 9500;
const inst = (c) => ({ ...c, uid: ++uid });
const slot = (c) => ({ card: inst(c), rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
function table(extras = []) {
  const { Game, TextParse: TP } = load();
  const main = Array.from({ length: 50 }, (_, i) => unit(TP, "m" + i, "Filler " + i, 1));
  const deck = { name: "t", format: "premium", ride: [], main, g: [] };
  Game.newGame(["A", "B"], [deck, deck], { first: 0, extras });
  const S = Game.state();
  Object.assign(S, { phase: "main", active: 0, controller: 0, turn: 3, pending: null });
  S.players[0].slots.vc = slot(unit(TP, "v", "Vanguard", 3));
  S.players[1].slots.vc = slot(unit(TP, "o", "Other", 3));
  return { Game, TP, S };
}
const blast = (TP, text = "") => ({ ...unit(TP, "blast", "Blast", 0, text), token: true });
const plant = (TP) => ({ ...unit(TP, "plant", "Plant", 0), token: true, power: 5000 });

test("reader: plant gauge costs, timings, condition, per three gauges", () => {
  const { TP } = table();
  same(TP.abilities("[AUTO](VC):When this unit attacks, [COST][discard two plant gauges], draw a card.")[0].costs, [{ type: "discardPlant", n: 2 }]);
  same(TP.abilities("[ACT](RC)[1/Turn]:[COST][Put two or more, up to three other rear-guards face up as this unit's plant gauge], and draw a card.")[0].costs, [{ type: "rcToPlant", n: 2, min: 2, max: 3 }]);
  assert.equal(TP.abilities("[AUTO](Drop):When your plant gauge is put during your main phase, draw a card.")[0].when, "plantGauged");
  assert.equal(TP.abilities("[AUTO]:When this card is a plant gauge and is discarded during your turn, draw a card.")[0].when, "plantDiscarded");
  same(TP.abilities("[AUTO](RC):When this unit boosts, if you have six or more plant gauges, this unit gets [Power]+2000 until end of that battle.")[0].conds, [{ type: "count", what: "myPlantGauge", op: "ge", n: 6 }]);
  const [p] = TP.abilities("[CONT](RC):All of your front row units get [Power]+5000 for every three gauges that this unit have.");
  assert.equal(p.effects[0].per, "myPlantGauge");
  assert.equal(p.effects[0].perDiv, 3);
});

test("an order puts itself into the plant gauge instead of the drop", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  p.slots.fl = slot(blast(TP));
  const order = { ...inst(unit(TP, "o1", "Gauge Order", 1)), type: "order", abilities: TP.abilities("Put this card face up as your Blast token's plant gauge, draw a card.", true) };
  p.hand.push(order);
  const r = Game.playOrder(order.uid); await settle(Game); await r;
  assert.ok((p.slots.fl.gauge || []).some((c) => c.uid === order.uid), "under the Blast token");
  assert.ok(!p.drop.some((c) => c.uid === order.uid), "not in the drop");
});

test("Plant tokens go into the gauge instead, and the look grows with the gauge", async () => {
  const { TextParse } = load();
  const t = table([plant(TextParse)]);
  const p = t.S.players[0];
  p.slots.fl = slot(blast(t.TP));
  p.slots.fl.gauge = Array.from({ length: 5 }, (_, i) => ({ ...inst(unit(t.TP, "g" + i, "Old " + i, 1)), plant: true }));
  const [a] = t.TP.abilities("[ACT](VC)[1/Turn]:If you have a Blast token, when a Plant token would be placed on (RC) by this effect, put it face up as your Blast token's plant gauge instead. [COST][Counter-Blast 1], you call up to one Plant token to (RC), look at the top three cards of your deck, choose a card from among them, put it into hand, and shuffle the deck. If you have six or more plant gauges, look at the top five cards instead of three cards.");
  assert.equal(a.effects[0].toPlant, true);
  same(a.effects[1].lookMore, { n: 5, cond: { type: "count", what: "myPlantGauge", op: "ge", n: 6 } });
  p.slots.vc.card.abilities = [a];
  p.damage.push(p.deck.pop());
  const r = t.Game.activate("vc", 0); await settle(t.Game); await r;
  assert.equal(p.slots.fl.gauge.length, 6, "the Plant token became the 6th gauge");
  assert.ok(!["fr", "bl", "bc", "br"].some((k) => p.slots[k]), "no Plant token on a circle");
});

test("discarding plant gauges pays the cost; +5000 for every three gauges", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  p.slots.fl = slot(blast(TP, "[CONT](RC):All of your front row units get [Power]+5000 for every three gauges that this unit have."));
  p.slots.fl.gauge = Array.from({ length: 6 }, (_, i) => ({ ...inst(unit(TP, "g" + i, "Old " + i, 1)), plant: true }));
  assert.equal(Game.power(0, "vc"), 10000 + 10000, "6 gauges = +10000");
  const c = inst(unit(TP, "x", "Payer", 1, "[AUTO]:When this unit is placed on (RC), [COST][discard two plant gauges], draw a card."));
  p.hand.push(c);
  const r = Game.call(c.uid, "fr"); await settle(Game); await r;
  assert.equal(p.slots.fl.gauge.length, 4);
  assert.equal(Game.power(0, "vc"), 10000 + 5000, "4 gauges = +5000");
});
