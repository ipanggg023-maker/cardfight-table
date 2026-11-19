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
