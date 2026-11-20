// Card round H: column battles, nullifying the opponent's Critical trigger, a reveal with options by card type,
// "placed by the <Keyword> ability", Strategy names put into soul this turn, ride-deck discards, remove-cost discount,
// a call behind the placed unit. The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 10500;
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
  S.players[0].slots.vc = slot(unit(TP, "v", "Vanguard", 3));
  S.players[1].slots.vc = slot(unit(TP, "o", "Other", 3));
  return { Game, TP, S };
}
const act = async (Game, p) => { const r = p; await settle(Game); return r; };

test("attacking a rear-guard battles every opponent rear-guard in that column", async () => {
  const { Game, TP, S } = table("battle");
  const p = S.players[0], o = S.players[1];
  p.slots.fl = slot({ ...unit(TP, "t", "Column Hitter", 2, "[CONT](RC):When this unit would attack a rear-guard, this unit battles all of your opponent's rear-guards in the same column as that unit."), power: 20000 });
  // the opponent's front right faces our front left; its back right is in the same column
  o.slots.fr = slot({ ...unit(TP, "a", "Front Target", 1), power: 8000 });
  o.slots.br = slot({ ...unit(TP, "b", "Back Partner", 1), power: 8000 });
  await act(Game, Game.attack("fl", false, "fr"));
  await act(Game, Game.confirmGuard());
  assert.ok(!o.slots.fr, "the target is retired");
  assert.ok(!o.slots.br, "the other rear-guard in that column is retired too");
});

test("nullify one effect of the opponent's next drive check Critical trigger", async () => {
  const { Game, TP, S } = table("battle");
  const [a] = TP.abilities("[ACT](VC):Until end of your opponent's next turn, when your opponent's drive check would next reveal a <Critical>, choose one of those trigger effects, and nullify it.");
  assert.ok(a.effects.some((e) => e.type === "nullifyCrit"), "reads as nullifyCrit");
  const p = S.players[0], o = S.players[1];
  o.nullifyCrit = { until: S.turn };
  p.deck.push(inst({ ...unit(TP, "c", "Crit Trigger", 0), type: "trigger", trigger: "crit" }));
  const crit = Game.crit(0, "vc");
  await act(Game, Game.attack("vc", false, "vc"));
  S.players[0].deck.push(S.players[0].deck.splice(S.players[0].deck.findIndex((c) => c.name === "Crit Trigger"), 1)[0]); // checked first
  await act(Game, Game.confirmGuard()); // drive check: the opponent answers "power" (the first option)
  assert.equal(Game.crit(0, "vc"), crit + 1, "the [Critical] still applies, the [Power] was nullified");
  assert.ok(o.nullified && o.nullified.type === "power");
});

test("reveal one of the top cards, then options by what it is", () => {
  const { TP } = table();
  const [a] = TP.abilities("Look at the top five cards of your deck, choose up to one card from among them, and reveal it. If you did not reveal a card, shuffle the deck, and draw a card. If you revealed a card, perform one of the following, and shuffle the deck.\n・If the revealed card is a unit card with grade less than or equal to your vanguard's grade, call it to (RC).\n・If the revealed card is a Moon card, put it into hand.", true);
  same(a.effects.map((e) => e.type), ["revealLook", "chooseOpts", "move", "move", "draw", "shuffleDeck"]);
  same(a.effects[2].filter, { gradeVC: "le", ctype: "anyunit" });
  same(a.effects[3].filter, { clan: "Moon" });
});

test("the revealed card goes to (RC) through the option", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  const u = inst(unit(TP, "u", "Small Unit", 1));
  p.deck.push(u);
  p.slots.vc.card.abilities = TP.abilities("[ACT](VC):Look at the top one cards of your deck, choose up to one card from among them, and reveal it. If you did not reveal a card, shuffle the deck, and draw a card. If you revealed a card, perform one of the following, and shuffle the deck.\n・If the revealed card is a unit card with grade less than or equal to your vanguard's grade, call it to (RC).\n・If the revealed card is a Moon card, put it into hand.");
  const hand = p.hand.length;
  await act(Game, Game.activate("vc", 0));
  assert.ok(["fl", "fr", "bl", "bc", "br"].some((k) => p.slots[k] && p.slots[k].card.uid === u.uid), "called");
  assert.equal(p.hand.length, hand, "no draw");
});

test("'placed on (VC) by the <Keyword> ability' and 'if your vanguard was placed by the <Keyword> ability this turn'", () => {
  const { TP } = table();
  same(TP.abilities("[AUTO]:When this unit is placed on (VC) by the <Dress> ability, draw a card.")[0].conds, [{ type: "vcPlacedByKw", kw: "Dress" }]);
  same(TP.abilities("[AUTO](RC):At the end of the battle this unit attacked, if your vanguard was placed by the <Dress> ability this turn, [COST][retire this unit], and draw a card.")[0].conds, [{ type: "vcPlacedByKw", kw: "Dress" }]);
});

test("two timings on one line become two abilities; ride-deck discards count", async () => {
  const { Game, TP, S } = table("ride");
  const abs = TP.abilities('[AUTO]:When this card is placed on a (RC) with a Tree marker from hand during your turn, or discarded from hand while riding from the ride deck during your turn, draw a card.');
  same(abs.map((a) => a.when), ["placedRC", "discarded"]);
  assert.equal(abs[1].whenRideCost, true);
  const p = S.players[0];
  p.hasRideDeck = true;
  p.ride = [inst(unit(TP, "g", "Next", 3))];
  const c = inst({ ...unit(TP, "d", "Discard Me", 1), abilities: [abs[1]] });
  p.hand.push(c);
  const hand = p.hand.length;
  await act(Game, Game.rideFromDeck(c.uid));
  assert.equal(p.hand.length, hand, "discarded one, drew one");
});

test("Strategy names already put into soul this turn; remove-cost discount; call behind the placed unit", () => {
  const { TP } = table();
  const [a] = TP.abilities("[AUTO](VC):At the beginning of your battle phase, choose a Strategy from your order zone with a different card name from cards put into soul from the order zone this turn, and put it into soul.");
  same(a.effects, [{ type: "move", from: "orderZone", to: "soul", n: 1, upTo: false, filter: { clan: "Strategy", notOzSouled: true } }]);
  same(TP.abilities('[ACT](Drop):[COST][Remove this card], choose one of your vanguards with "Zed" in its card name, and reduce the next number of cards you remove for the cost of that unit\'s ability by one until end of turn.')[0].effects, [{ type: "removeDiscount", n: 1 }]);
  const [f] = TP.abilities('[AUTO](Drop):When your unit with "Zed" in its card name is placed on (RC), [COST][Counter-Blast 1], and call this card to the back row (RC) in the same column as that unit. If that unit was placed by the ability of your vanguard with "Star" in its card name, this cost is reduced by [Counter-Blast 1].');
  same(f.effects, [{ type: "move", from: "self", to: "RCcolBack", colOfEvent: true }]);
  same(f.costIf, { cond: { type: "placedBy", filter: { name: "Star" } }, reduce: { type: "CB", n: 1 } });
});

test("a card regarded as another kind when revealed; a bind zone card that can't be moved", () => {
  const { TP } = table();
  const r = TP.parse('[CONT](Deck):If you have a vanguard with "Zed" in its card name, while this card is revealed by a Moon card\'s ability, this card is regarded as a Moon card.\n[CONT](Bind zone):This card cannot be chosen or moved to other zones by any player\'s card abilities.');
  same(r.alsoClan, ["Moon"]);
  assert.equal(r.bindLocked, true);
  same(r.abilities, []);
});
