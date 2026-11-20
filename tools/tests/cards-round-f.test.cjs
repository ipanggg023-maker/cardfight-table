// Card round F: costs that change when you rode from hand, free ride from the ride deck, "placed by the ability of X",
// "If you revealed a card, or …", option conditions, order zone history, blitz rule.
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 9800;
const inst = (c) => ({ ...c, uid: ++uid });
const slot = (c) => ({ card: inst(c), rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
function table(phase = "main") {
  const { Game, TextParse: TP } = load();
  const main = Array.from({ length: 50 }, (_, i) => unit(TP, "m" + i, "Filler " + i, 1));
  const deck = { name: "t", format: "premium", ride: [], main, g: [] };
  Game.newGame(["A", "B"], [deck, deck], { first: 0 });
  const S = Game.state();
  Object.assign(S, { phase, active: 0, controller: 0, turn: 3, pending: null });
  S.players[0].slots.vc = slot(unit(TP, "v", "Vanguard", 2));
  S.players[1].slots.vc = slot(unit(TP, "o", "Other", 3));
  return { Game, TP, S };
}

test(`'If you rode this unit from hand, this cost is lost' / '… reduce this [Soul-Blast] cost by ①'`, () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO]:If you rode this unit from hand, this cost is lost. When this unit is placed on (VC), [COST][Counter-Blast 1], draw a card.");
  same(a.costIf, { cond: { type: "rodeFromHand" }, lose: true });
  assert.equal(a.when, "placedVC");
  const [b] = TP.abilities("[AUTO]:If you rode this unit from hand, reduce this [Soul-Blast] cost by ①. When this unit is placed on (VC), [COST][Soul-Blast 1], draw a card.");
  same(b.costIf, { cond: { type: "rodeFromHand" }, reduce: { type: "SB", n: 1 } });
});

test(`riding it from hand: the lost cost isn't paid (no damage needed)`, async () => {
  const { Game, TP, S } = table("ride");
  const p = S.players[0];
  const c = inst(unit(TP, "r", "Free Rider", 3, "[AUTO]:If you rode this unit from hand, this cost is lost. When this unit is placed on (VC), [COST][Counter-Blast 1], draw a card."));
  p.hand.push(c);
  p.damage = [];
  const hand = p.hand.length;
  const r = Game.rideFromHand(c.uid); await settle(Game); await r;
  assert.equal(p.slots.vc.card.uid, c.uid);
  assert.ok(p.hand.length >= hand, "drew a card without paying");
});

test(`free ride from the ride deck next turn`, async () => {
  const { Game, TP, S } = table();
  const [a] = TP.abilities("[AUTO]:When this unit is placed on (VC), during the ride phase of your next turn, when you would ride from ride deck, you can ride without discarding a card from hand.");
  same(a.effects, [{ type: "freeRide" }]);
  const p = S.players[0];
  p.hasRideDeck = true;
  p.ride = [inst(unit(TP, "g3", "Next Grade", 3))];
  p.freeRideTurn = S.turn;
  S.phase = "ride";
  const hand = p.hand.length;
  assert.equal(Game.rideFree(0), true);
  const r = Game.rideFromDeck(null); await settle(Game); await r;
  assert.equal(p.slots.vc.card.name, "Next Grade");
  assert.ok(p.hand.length >= hand, "no card discarded");
});

test(`'If this unit was placed by the ability of "X"' sees what placed it`, async () => {
  const { Game, TP, S } = table();
  const [g] = TP.abilities('[AUTO]:When this unit is placed on (RC), draw a card. If this unit was placed by the ability of "King Caller", this unit gets [Power]+5000 until end of turn.');
  assert.equal(g.effects[1].ifCond.type, "placedBy");
  const p = S.players[0];
  const knight = { ...unit(TP, "k", "Knight", 1), abilities: [g] };
  p.deck.push(inst(knight));
  p.slots.vc.card.name = "King Caller";
  p.slots.vc.card.abilities = TP.abilities('[ACT](VC):Search your deck for up to one "Knight", call it to (RC), and shuffle the deck.');
  const r = Game.activate("vc", 0); await settle(Game); await r;
  const k = ["fl", "fr", "bl", "bc", "br"].find((key) => p.slots[key] && p.slots[key].card.name === "Knight");
  assert.ok(k, "the knight was called");
  assert.equal(Game.power(0, k), 15000, "placed by King Caller: +5000");
});

test(`'choose a card from your ride deck, and you may reveal it. If you revealed a card, or …'`, () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO]:When this unit is placed on (VC) or (RC), choose a grade 3 card with an Aichi icon from your ride deck, and you may reveal it. If you revealed a card, or you have a grade 3 or greater vanguard with an Aichi icon, [COST][Counter-Blast 1] or [Energy-Blast 3], choose one of your opponent's rear-guards, retire it, and if this unit was placed on (VC), draw a card.");
  assert.equal(a.when, "placed");
  same(a.costs, []);
  same(a.effects.map((e) => e.type), ["revealPick", "payCost", "retire", "draw"]);
  assert.equal(a.effects[1].ifCond.type, "any");
  same(a.effects[1].ifCond.of[0], { type: "lastDid" });
  assert.equal(a.effects[1].costs[0].type, "oneOf");
  same(a.effects[3].ifCond, { type: "onVC" });
});

test(`option conditions: 'If you do not have a rear-guard with the same card name…' and 'If you called a card, …'`, () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](Drop):When your vanguard is placed, perform one of the following.\n・If you do not have a rear-guard with the same card name as this card, you may call this card to (RC). If you called a card, your vanguard and this unit get [Power]+5000 until end of turn.\n・[COST][Bind this card], choose one of your vanguard's [AUTO] abilities, and reduce its next [Counter-Blast] cost you pay by ① until end of turn.");
  const A = a.effects.filter((e) => e.opt === "A");
  assert.equal(A[0].ifCond.type, "count");
  same(A.slice(1).map((e) => [e.target, e.onlyIf]), [["vc", "did"], ["self", "did"]]);
  same(a.effects.filter((e) => e.opt === "B").map((e) => e.type), ["payCost", "cbDiscount"]);
  assert.equal(a.effects.find((e) => e.type === "cbDiscount").forCard, "vc");
});

test(`order zone history and played orders`, async () => {
  const { Game, TP, S } = table();
  same(TP.abilities("[AUTO](RC):When this unit boosts, if your Strategy card was put into the order zone this turn, draw a card.")[0].conds, [{ type: "ozPutThisTurn", filter: { clan: "Strategy" } }]);
  same(TP.abilities("[AUTO](RC):At the end of your turn, if you played an Ultimate Skill order this turn, draw a card.")[0].conds, [{ type: "playedOrder", filter: { clan: "Ultimate Skill" } }]);
  const p = S.players[0];
  const order = { ...inst(unit(TP, "o1", "Big Order", 1)), type: "order", race: "Ultimate Skill", abilities: TP.abilities("Draw a card.", true) };
  p.hand.push(order);
  const r = Game.playOrder(order.uid); await settle(Game); await r;
  same(p.playedLog.cards.map((c) => c.name), ["Big Order"]);
});

test(`'your opponent cannot play blitz orders'`, () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO]:When this unit attacks, until end of turn, your opponent cannot intercept, and cannot play blitz orders.");
  assert.ok(a.effects.some((e) => e.type === "playerRule" && e.what === "cantBlitz" && e.who === "opp"));
});

test(`'You cannot bind cards with the same card name as this card from drop until end of turn' = once a turn per name`, () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](Drop):When your vanguard is attacked, [COST][bind this card], and that unit gets [Power]+10000 until end of that battle. You cannot bind cards with the same card name as this card from drop until end of turn.");
  assert.equal(a.once, "nameTurn");
  same(a.effects.filter((e) => e.type === "manual"), []);
});
