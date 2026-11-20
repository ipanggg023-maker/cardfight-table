// Card round B: "if A, or B" conditions, options with their own cost, "and <state>" conditions, "did not persona ride".
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 8000;
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
  S.players[0].soul = [];
  return { Game, TP, S };
}
async function callIt(Game, S, TP, text) {
  const p = S.players[0];
  const c = inst(unit(TP, "x", "Caller", 1, text));
  p.hand.push(c);
  const before = p.hand.length - 1;
  const r = Game.call(c.uid, "fl"); await settle(Game); await r;
  return p.hand.length - before;
}

test("'if A, or B' reads as either one", () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](RC):When this unit boosts, if your opponent has one or less rear-guards, or you played an order this turn, this unit gets [Power]+5000 until end of that battle.");
  same(a.conds, [{ type: "any", of: [{ type: "count", what: "oppRC", op: "le", n: 1 }, { type: "playedOrder" }] }]);
});

test("an 'or' condition works in the game", async () => {
  const text = "[AUTO](RC):When this unit is placed on (RC), if your soul has three or more cards, or you played an order this turn, draw a card.";
  let t = table();
  assert.equal(await callIt(t.Game, t.S, t.TP, text), 0, "neither: no draw");
  t = table();
  t.S.players[0].ordersThisTurn = 1;
  assert.equal(await callIt(t.Game, t.S, t.TP, text), 1, "the second one: draw");
});

test("an option whose cost can't be paid isn't offered", async () => {
  const { Game, TP, S } = table();
  const text = "[AUTO]:When this unit is placed on (RC), perform one of the following.\n・Draw a card.\n・[COST][Soul-Blast 1], and draw two cards.";
  const [a] = TP.abilities(text);
  assert.ok(a.effects.some((e) => e.type === "payCost" && e.must && e.opt === "B"));
  const p = S.players[0];
  const c = inst(unit(TP, "x", "Caller", 1, text));
  const before = p.hand.length;
  p.hand.push(c);
  const offered = [];
  const r = Game.call(c.uid, "fl");
  for (let i = 0; i < 60; i++) {
    await new Promise((res) => setTimeout(res, 0));
    const P = Game.state().pending;
    if (P) { if (/following/i.test(P.prompt || "")) offered.push(P.options.map((o) => o.id)); Game.answer(P.options.slice(0, Math.max(P.min, 1)).map((o) => o.id)); }
  }
  await r;
  for (const o of offered) assert.ok(!o.includes("B"), "B needs a soul card");
  assert.equal(p.hand.length, before + 1, "option A drew a card");
});

test("'Call this card to (RC) as [Rest]' calls it rested", () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO]:When this card is discarded from hand during your ride phase, perform one of the following.\n・Call this card to (RC) as [Rest].\n・[COST][Soul-Blast 1], and call this card to (RC).");
  same(a.effects.map((e) => e.type), ["chooseOpts", "move", "payCost", "move"]);
  assert.equal(a.effects[1].asRest, true);
});

test("'and all of your rear-guards have different card names from this card' is a condition", () => {
  const { TP } = table();
  const [a] = TP.abilities("[ACT](Drop):If your vanguard is grade 3 or greater, and all of your rear-guards have different card names from this card, [COST][Soul-Blast 2], and call this card to (RC).");
  assert.ok(a.conds.some((c) => c.type === "count" && c.what === "myRC" && c.op === "eq" && c.filter.sameNameSelf));
  assert.equal(a.effects.filter((e) => e.type === "manual").length, 0);
});

test("'if you did not persona ride this turn' is a condition, not 'if you didn't do it'", () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](RC):When this unit attacks, if you did not persona ride this turn, draw a card.");
  same(a.conds, [{ type: "persona", not: true }]);
  assert.equal(a.effects[0].onlyIf, undefined);
});
