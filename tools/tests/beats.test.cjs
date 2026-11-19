// The engine's named moments (beats) and the display state the screen reads (S.checking, S.resolving).
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

let uid = 5000;
const inst = (c) => ({ ...c, uid: ++uid });
const slot = (c) => ({ card: inst(c), rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });

// a battle-phase table: player 0 attacks with a grade 3 vanguard (twin drive) into a grade 3 vanguard
function table(vcText = "") {
  const { Game, TextParse: TP } = load();
  const main = Array.from({ length: 50 }, (_, i) => unit(TP, "m" + i, "Filler " + i, 1));
  const deck = { name: "t", format: "premium", ride: [], main, g: [] };
  Game.newGame(["A", "B"], [deck, deck], { first: 0 });
  const S = Game.state();
  Object.assign(S, { phase: "battle", active: 0, controller: 0, turn: 3, pending: null });
  S.players[0].slots.vc = slot(unit(TP, "v", "Attacker", 3, vcText));
  S.players[1].slots.vc = slot(unit(TP, "o", "Defender", 3));
  return { Game, TP, S };
}
const record = (Game) => { const kinds = []; Game.setPace((k) => { kinds.push(k); return Promise.resolve(); }); return kinds; };
async function attackAndTake(Game) {
  const a = Game.attack("vc", false, "vc"); await settle(Game); await a;
  const g = Game.confirmGuard(); await settle(Game); await g;
}

test("vanguard attack, twin drive, no triggers", async () => {
  const { Game } = table();
  const kinds = record(Game);
  await attackAndTake(Game);
  assert.deepEqual(kinds, ["attack", "guardTotal", "checkShow", "checkMove", "checkShow", "checkMove", "result", "checkShow", "checkMove"]);
});

test("trigger adds checkTrigger", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  p.deck.push(inst(unit(TP, "c", "Crit Trigger", 0, "", { type: "trigger", trigger: "crit" })));
  const kinds = [], seen = [];
  Game.setPace((k) => { kinds.push(k); if (k === "checkTrigger") seen.push(S.checking && { stage: S.checking.stage, type: S.checking.trig && S.checking.trig.type }); return Promise.resolve(); });
  await attackAndTake(Game);
  assert.deepEqual(kinds.slice(0, 5), ["attack", "guardTotal", "checkShow", "checkTrigger", "checkMove"]);
  assert.deepEqual(seen[0], { stage: "trigger", type: "crit" });
});

test("check numbering", async () => {
  const { Game, S } = table();
  const shown = [];
  Game.setPace((k) => { if (k === "checkShow") shown.push(`${S.checking.type}:${S.checking.n}/${S.checking.of}`); return Promise.resolve(); });
  await attackAndTake(Game);
  assert.deepEqual(shown, ["Drive:1/2", "Drive:2/2", "Damage:1/1"]);
});

test("refuses actions while a beat waits", async () => {
  const { Game, S } = table();
  let release = null;
  Game.setPace((k) => (k === "guardTotal" ? new Promise((r) => (release = r)) : Promise.resolve()));
  const a = Game.attack("vc", false, "vc"); await settle(Game); await a;
  const g = Game.confirmGuard();
  await settle(Game, 5);
  assert.ok(release, "the guard total waits");
  const phase = S.phase;
  const r = await Game.endTurn();
  assert.equal(r.ok, false);
  assert.equal(S.phase, phase);
  release(); await settle(Game); await g;
});

test("resolving marker", async () => {
  const { Game, S } = table("[AUTO](VC):When this unit attacks, draw a card.");
  record(Game);
  const a = Game.attack("vc", false, "vc"); await settle(Game); await a;
  assert.ok(S.resolving, "S.resolving is set");
  assert.equal(S.resolving.kind, "AUTO");
  assert.ok(S.resolving.n >= 1);
});

test("S.beat names the moment while it waits", async () => {
  const { Game, S } = table();
  const during = [];
  Game.setPace((k) => { during.push(`${k}=${S.beat}`); return Promise.resolve(); });
  await attackAndTake(Game);
  assert.ok(during.includes("guardTotal=guardTotal"));
  assert.equal(S.beat, null);
});

test("an interceptor is marked in the battle", async () => {
  const { Game, TP, S } = table();
  record(Game);
  S.players[1].slots.fl = slot(unit(TP, "i", "Interceptor", 2));
  const a = Game.attack("vc", false, "vc"); await settle(Game); await a;
  const uid = S.players[1].slots.fl.card.uid;
  const r = await Game.intercept("fl");
  assert.equal(r.ok, true);
  assert.deepEqual([...S.battle.intercepted], [uid]);
});

test("the call pause comes before the called unit's abilities", async () => {
  const { Game, TP, S } = table();
  const p = S.players[0];
  Object.assign(S, { phase: "main" });
  const c = { ...unit(TP, "cl", "Caller", 1, "[AUTO](RC):When this unit is placed on (RC), draw a card."), uid: 99001 };
  p.hand.push(c);
  const order = [];
  Game.setPace((k) => { order.push(`${k}:${(S.resolving && S.resolving.n) || 0}`); return Promise.resolve(); });
  const r = Game.call(c.uid, "fl"); await settle(Game); await r;
  const callAt = order.findIndex((x) => x.startsWith("call:"));
  assert.ok(callAt >= 0, "a call pause happened");
  assert.equal(order[callAt], "call:0", "nothing had resolved yet at the call pause");
});
