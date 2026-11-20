// Card round G: ride with Soul-Blast instead of discarding, look at the whole deck, call by card type, discard-or-bottom,
// a pair called into one column, double Power/Critical, rear-guard drive checks, cannot be boosted, hollowed when retired,
// "either kind" filters. The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 9900;
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
const act = async (Game, p) => { const r = p; await settle(Game); return r; };

test("reader: the round G wordings", () => {
  const { TP } = table();
  same(TP.abilities('[CONT](VC):When you would ride from ride deck, you can ride with "[Soul-Blast 1]" instead of "choose a card from hand, and discard it".')[0].effects, [{ type: "rideAltSB", n: 1 }]);
  const [look] = TP.abilities('[AUTO]:When this unit is rode upon, look at the top seven cards of your deck, choose up to one grade 2 card from among them, reveal it and put it into hand, and shuffle the deck. If it was rode upon by a grade 3 or greater card with "Zed" in its card name, look at all of the deck instead of the top seven cards.');
  same(look.effects[0].lookMore, { all: true, cond: { type: "eventSubject", filter: { gmin: 3, name: "Zed" } } });
  const [nr] = TP.abilities("[AUTO](VC):When your rear-guard is retired, [COST][discard the top three cards of the deck], and you may call that retired card to (RC).");
  same(nr.costs, [{ type: "move", from: "deckTop", n: 3, to: "drop" }]);
  same(nr.effects, [{ type: "move", from: "drop", eventCard: true, to: "RC", n: 1, upTo: true }]);
  const [hr] = TP.abilities("[AUTO]:When this hollowed unit is retired from (RC), if you did not [Counter-Charge] this turn, [Counter-Charge 1].");
  assert.equal(hr.when, "retired");
  assert.ok(hr.conds.some((c) => c.type === "wasHollowed") && hr.conds.some((c) => c.type === "ccThisTurn" && c.not));
  const [arms] = TP.abilities('[ACT](VC):[COST][Discard a card from hand], look at the top three cards of your deck, choose up to one card with "Form" in its card name or up to one grade 2 or less card from among them, reveal it, put it into hand if it is a card with "Form" in its card name, and call it to (RC) if it is not. You may discard all of the remaining cards. If you did not discard them, put them on the bottom of the deck in any order.');
  same(arms.effects[0].filter, { anyOf: [{ name: "Form" }, { gmax: 2 }] });
  same(arms.effects[0].toIf, { filter: { nameNot: "Form" }, to: "RC" });
  assert.equal(arms.effects[0].rest, "dropOrBottom");
  assert.equal(TP.parse("[CONT]:This card's [AUTO] ability can be resolved even if you have resolved a Regalis Piece ability this fight.").regalisAgain, true);
});

test("ride from the ride deck paying Soul-Blast 1 instead of discarding", async () => {
  const { Game, TP, S } = table("ride");
  const p = S.players[0];
  p.slots.vc.card.abilities = TP.abilities('[CONT](VC):When you would ride from ride deck, you can ride with "[Soul-Blast 1]" instead of "choose a card from hand, and discard it".');
  p.hasRideDeck = true;
  p.ride = [inst(unit(TP, "g3", "Next Grade", 3))];
  p.soul = [inst(unit(TP, "s", "Soul Card", 1))];
  const hand = p.hand.length;
  assert.equal(Game.rideAlt(0), 1);
  await act(Game, Game.rideFromDeck(null));
  assert.equal(p.slots.vc.card.name, "Next Grade");
  assert.equal(p.hand.length, hand, "nothing discarded");
  assert.ok(p.drop.some((c) => c.name === "Soul Card"), "the soul card paid");
});

test("double [Power] and [Critical]; this unit cannot be boosted", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  p.slots.fl = slot(unit(TP, "f", "Front", 1));
  const [d] = TP.abilities("[ACT](VC):Double the [Power] and [Critical] of all of your front row units until end of turn.");
  p.slots.vc.card.abilities = [d];
  await act(Game, Game.activate("vc", 0));
  assert.equal(Game.power(0, "fl"), 20000);
  assert.equal(Game.crit(0, "fl"), 2);
  const [nb] = TP.abilities("[CONT](VC):This unit cannot be boosted.");
  p.slots.vc.card.abilities = [nb];
  p.slots.bc = slot(unit(TP, "b", "Booster", 1));
  assert.equal(Game.boosterFor(0, "vc"), null);
});

test("look at the top: unit cards to (RC), orders to hand", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  const order = { ...inst(unit(TP, "ord", "An Order", 1)), type: "order" };
  p.deck.push(order);
  p.slots.vc.card.abilities = TP.abilities("[ACT](VC):Look at the top one cards of your deck, choose and reveal up to one card with grade less than or equal to your vanguard's from among them, call it to (RC) if it is a unit card, and put it into hand if it is a normal order. Shuffle the deck.");
  await act(Game, Game.activate("vc", 0));
  assert.ok(p.hand.some((c) => c.uid === order.uid), "the order went to hand");
});

test("search two, call each of them to (RC) in the same column", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  p.deck.push(inst(unit(TP, "k1", "Knight A", 1, "", { aichi: true })), inst(unit(TP, "k2", "Knight B", 1, "", { aichi: true })));
  p.slots.vc.card.abilities = TP.abilities("[ACT](VC):Search your deck for up to two cards with an Aichi icon, call each of them to (RC) in the same column, and shuffle the deck.");
  const r = Game.activate("vc", 0);
  for (let i = 0; i < 60; i++) { // answer with as many as allowed (both knights), first column
    await new Promise((res) => setTimeout(res, 0));
    const P = Game.state().pending;
    if (P) Game.answer(P.options.slice(0, Math.max(P.min, P.max, 1)).map((o) => o.id));
  }
  await r;
  const names = ["fl", "bl"].map((k) => p.slots[k] && p.slots[k].card.name).sort();
  same(names, ["Knight A", "Knight B"]);
});

test("rear-guards drive check this turn", async () => {
  const { Game, TP, S } = table("battle");
  const p = S.players[0];
  p.slots.fl = slot(unit(TP, "f", "Front", 3));
  p.rgDriveTurn = S.turn;
  S.players[1].slots.vc.card.grade = 3;
  const deck = p.deck.length;
  const a = Game.attack("fl", false, "vc"); await settle(Game); await a;
  const g = Game.confirmGuard(); await settle(Game); await g;
  assert.ok(p.deck.length <= deck - 2, "a grade 3 rear-guard checked twice");
});
