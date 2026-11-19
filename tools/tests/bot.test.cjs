// The bot opponent (js/bot.js): plays whole games, never gets stuck, decides from the fair view.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit } = require("./load.cjs");

let uidN = 70000;
// a playable deck: Standard (ride deck G0–G3) or Premium (starter G0 in the main deck + a G deck)
function deck(TP, format = "standard", tag = "A") {
  const c = (id, grade, x = {}) => unit(TP, `${tag}-${id}`, `${tag} ${id}`, grade, "", { power: [6000, 8000, 10000, 13000][grade] || 10000, shield: grade >= 3 ? 0 : grade === 2 ? 5000 : 10000, ...x });
  const main = [];
  for (let i = 0; i < 14; i++) main.push(c("g1-" + i, 1));
  for (let i = 0; i < 12; i++) main.push(c("g2-" + i, 2));
  for (let i = 0; i < 8; i++) main.push(c("g3-" + i, 3));
  for (let i = 0; i < 8; i++) main.push(c("crit-" + i, 0, { type: "trigger", trigger: "crit", shield: 15000 }));
  for (let i = 0; i < 4; i++) main.push(c("draw-" + i, 0, { type: "trigger", trigger: "draw", shield: 15000 }));
  for (let i = 0; i < 4; i++) main.push(c("heal-" + i, 0, { type: "trigger", trigger: "heal", shield: 15000 }));
  if (format === "standard") {
    const ride = [c("r0", 0), c("r1", 1), c("r2", 2), c("r3", 3)];
    return { name: tag, format, energy: true, ride, main, g: [] };
  }
  main.pop(); const starter = c("start", 0); main.push(starter);
  const g = Array.from({ length: 8 }, (_, i) => c("G" + i, 4, { type: "g", gKind: "stride", power: 15000, shield: 0 }));
  return { name: tag, format, ride: [], starter: starter.id, main, g };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
async function play(levels = ["normal", "normal"], format = "standard") {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "P1"], [deck(TP, format, "A"), deck(TP, format, "B")], {});
  const S = Game.state();
  let steps = 0, afterOver = 0;
  for (; steps < 4000 && S.winner === null; steps++) {
    let moved = false;
    for (const seat of [0, 1]) if (Bot.wants(seat)) { await Bot.step(seat, levels[seat]); moved = true; break; }
    if (!moved) await tick();
  }
  for (const seat of [0, 1]) if (Bot.wants(seat)) afterOver++;
  return { S, steps, afterOver, Game, Bot };
}

test("bot vs bot ends", async () => {
  for (let i = 0; i < 20; i++) {
    const { S, steps } = await play(i < 15 ? ["normal", "normal"] : ["easy", "normal"]);
    assert.notEqual(S.winner, null, `game ${i} ended (steps ${steps}, turn ${S.turn}, phase ${S.phase})`);
  }
});

test("premium games end", async () => {
  for (let i = 0; i < 5; i++) {
    const { S, steps } = await play(["normal", "normal"], "premium");
    assert.notEqual(S.winner, null, `premium game ${i} ended (steps ${steps}, turn ${S.turn}, phase ${S.phase})`);
  }
});

test("stops at game over", async () => {
  const { afterOver } = await play();
  assert.equal(afterOver, 0);
});

// a fresh game with the bot (seat 1) on turn, main phase
function botMain() {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "Bot"], [deck(TP, "standard", "A"), deck(TP, "standard", "B")], { first: 1 });
  const S = Game.state();
  Object.assign(S, { phase: "main", active: 1, controller: 1, turn: 3, pending: null });
  return { Game, TP, Bot, S };
}

test("manual step is skipped", async () => {
  const { Game, Bot, S } = botMain();
  const vc = S.players[1].slots.vc.card;
  vc.abilities = [{ kind: "ACT", zone: "VC", once: "", conds: [], costs: [], effects: [{ type: "manual", text: "x" }] }];
  const act = Game.activate("vc", 0);
  for (let i = 0; i < 5 && !S.judge; i++) await tick();
  assert.ok(S.judge, "the manual step is waiting");
  const r = await Bot.step(1, "normal");
  await act;
  assert.equal(r.ok, true);
  assert.equal(S.judge, null);
});

test("refused moves fall back", async () => {
  const { Bot, S } = botMain();
  const real = Bot.decide;
  Bot.decide = () => [{ fn: "call", args: [-1, "fl"] }, { fn: "call", args: [-2, "fl"] }, { fn: "call", args: [-3, "fl"] }];
  try {
    const r = await Bot.step(1, "normal");
    assert.equal(r.ok, true);
    assert.equal(r.fn, "toBattle");
    assert.ok(S.log.some((l) => l.startsWith("🤖 fallback")), "the fallback is logged");
  } finally { Bot.decide = real; }
});

test("decides from the snapshot", async () => {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "P1"], [deck(TP, "standard", "A"), deck(TP, "standard", "B")], {});
  const real = Bot.decide, leaks = [];
  Bot.decide = (view, seat, level) => {
    for (const c of view.players[1 - seat].hand) if (c.name && /^[AB] /.test(c.name)) leaks.push(c.name);
    return real(view, seat, level);
  };
  try {
    const S = Game.state();
    for (let i = 0; i < 300 && S.winner === null; i++) { let moved = false; for (const seat of [0, 1]) if (Bot.wants(seat)) { await Bot.step(seat, "normal"); moved = true; break; } if (!moved) await tick(); }
  } finally { Bot.decide = real; }
  assert.deepEqual(leaks, []);
});

// ---------- Task 2: normal level rules ----------
const mk = (TP, id, grade, x = {}) => ({ ...unit(TP, id, id, grade, "", { power: [6000, 8000, 10000, 13000][grade] || 10000, shield: grade >= 3 ? 0 : 10000, ...x }), uid: ++uidN });
const sl = (card) => ({ card, rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
// seat 0 attacks the bot (seat 1); the bot has `dmg` damage and `hand`
function botDefends(TP0, { dmg, oppVc = 13000, attacker = "vc", attPower, hand }) {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "Bot"], [deck(TP, "standard", "A"), deck(TP, "standard", "B")], { first: 0 });
  const S = Game.state(), me = S.players[1], op = S.players[0];
  Object.assign(S, { phase: "battle", active: 0, controller: 0, turn: 4, pending: null, battle: null });
  op.slots.vc = sl(mk(TP, "OppVC", 3, { power: attacker === "vc" ? attPower : oppVc }));
  if (attacker !== "vc") op.slots[attacker] = sl(mk(TP, "OppRG", 2, { power: attPower }));
  me.slots.vc = sl(mk(TP, "BotVC", 3, { power: 13000 }));
  me.damage = Array.from({ length: dmg }, (_, i) => mk(TP, "D" + i, 1));
  me.hand = hand(TP);
  op.deck.push(mk(TP, "top1", 1), mk(TP, "top2", 1)); // no triggers on the drive checks
  return { Game, Bot, S, TP };
}
async function botGuardPhase(Game, Bot, S) {
  const fns = [];
  for (let i = 0; i < 30 && S.battle; i++) {
    if (Bot.wants(1)) { const r = await Bot.step(1, "normal"); fns.push(r.fn); }
    else if (S.pending && S.pending.player === 0) Game.answer(S.pending.options.slice(0, Math.max(S.pending.min, 1)).map((o) => o.id));
    else await tick();
  }
  return fns;
}

test("guards a lethal attack it can cover", async () => {
  const { Game, Bot, S } = botDefends(null, { dmg: 5, attPower: 23000, hand: (TP) => [mk(TP, "S1", 1, { shield: 10000 }), mk(TP, "S2", 1, { shield: 10000 })] });
  await Game.attack("vc", false, "vc");
  const fns = await botGuardPhase(Game, Bot, S);
  assert.deepEqual(fns.filter((f) => f === "guard").length, 2, `guards with both cards (moves: ${fns.join(",")})`);
  assert.equal(S.players[1].damage.length, 5, "the attack didn't hit");
});

test("lets an early rear-guard attack through", async () => {
  const { Game, Bot, S } = botDefends(null, { dmg: 1, attacker: "fl", attPower: 18000, hand: (TP) => [mk(TP, "S1", 1, { shield: 10000 })] });
  await Game.attack("fl", false, "vc");
  const moves = Bot.decide(Game.snapshot(1), 1, "normal");
  assert.equal(moves[0].fn, "confirmGuard");
});

test("sentinel at 5 damage", async () => {
  const { Game, Bot, S } = botDefends(null, { dmg: 5, attPower: 53000, hand: (TP) => [mk(TP, "S1", 1, { shield: 10000 }), mk(TP, "Sent", 1, { shield: 0, sentinel: true })] });
  await Game.attack("vc", false, "vc");
  const moves = Bot.decide(Game.snapshot(1), 1, "normal");
  const sent = S.players[1].hand.find((c) => c.sentinel);
  assert.equal(moves[0].fn, "guard");
  assert.equal(moves[0].args[0], sent.uid);
});

test("attacks rear-guards first, vanguard last", async () => {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "Bot"], [deck(TP, "standard", "A"), deck(TP, "standard", "B")], { first: 1 });
  const S = Game.state(), me = S.players[1], op = S.players[0];
  Object.assign(S, { phase: "battle", active: 1, controller: 1, turn: 4, pending: null, battle: null });
  me.slots.vc = sl(mk(TP, "BotVC", 3, { power: 13000 }));
  me.slots.fl = sl(mk(TP, "BotFL", 2, { power: 18000 }));
  op.slots.vc = sl(mk(TP, "OppVC", 3, { power: 13000 }));
  op.damage = [mk(TP, "x1", 1), mk(TP, "x2", 1)];
  const moves = Bot.decide(Game.snapshot(1), 1, "normal");
  assert.equal(moves[0].fn, "attack");
  assert.equal(moves[0].args[0], "fl");
});

test("fills the front row with the strongest", async () => {
  const { Game, TextParse: TP, Bot } = load();
  Game.newGame(["P0", "Bot"], [deck(TP, "standard", "A"), deck(TP, "standard", "B")], { first: 1 });
  const S = Game.state(), me = S.players[1];
  Object.assign(S, { phase: "main", active: 1, controller: 1, turn: 4, pending: null });
  me.slots.vc = sl(mk(TP, "BotVC", 2, { power: 10000 }));
  for (const k of ["fl", "fr", "bl", "bc", "br"]) me.slots[k] = null;
  me.hand = [mk(TP, "P8", 1, { power: 8000 }), mk(TP, "P10", 2, { power: 10000 }), mk(TP, "P12", 2, { power: 12000 })];
  await Bot.step(1, "normal");
  await Bot.step(1, "normal");
  const front = ["fl", "fr"].map((k) => me.slots[k] && me.slots[k].card.name).sort();
  assert.deepEqual(front, ["P10", "P12"]);
});
