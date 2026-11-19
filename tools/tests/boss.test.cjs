// Boss events: the boss's advantages (engine) and the boss deck from its saved layout.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit } = require("./load.cjs");

function deck(TP, tag) {
  const c = (id, grade, x = {}) => unit(TP, `${tag}-${id}`, `${tag} ${id}`, grade, "", { power: [6000, 8000, 10000, 13000][grade] || 10000, shield: grade >= 3 ? 0 : 10000, ...x });
  const main = [];
  for (let i = 0; i < 26; i++) main.push(c("g1-" + i, 1));
  for (let i = 0; i < 16; i++) main.push(c("g2-" + i, 2));
  for (let i = 0; i < 8; i++) main.push(c("g3-" + i, 3));
  return { name: tag, format: "standard", energy: true, ride: [c("r0", 0), c("r1", 1), c("r2", 2), c("r3", 3)], main, g: [] };
}
function game(boss) {
  const { Game, TextParse: TP } = load();
  Game.newGame(["P", "Boss"], [deck(TP, "A"), deck(TP, "B")], { first: 0, ...(boss ? { boss: { seat: 1, ...boss } } : {}) });
  return { Game, S: Game.state() };
}
const giveDamage = (S, pi, n) => { for (let i = 0; i < n; i++) S.players[pi].damage.push(S.players[pi].deck.pop()); };
async function ruleCheck(Game, S) { Object.assign(S, { phase: "main", active: 0, controller: 0, turn: 3, pending: null }); await Game.toBattle(); }

test("boss loses at 7 damage", async () => {
  const { Game, S } = game({ maxDamage: 7 });
  giveDamage(S, 1, 6);
  await ruleCheck(Game, S);
  assert.equal(S.winner, null, "6 damage isn't enough against this boss");
  giveDamage(S, 1, 1);
  S.phase = "main";
  await ruleCheck(Game, S);
  assert.equal(S.winner, 0);
});

test("normal games still lose at 6", async () => {
  const { Game, S } = game(null);
  giveDamage(S, 1, 6);
  await ruleCheck(Game, S);
  assert.equal(S.winner, 0);
});

test("extra card at the start", () => {
  const { S } = game({ extraDraw: 1 });
  assert.equal(S.players[1].hand.length, S.players[0].hand.length + 1);
});

test("vanguard power only on the player's turn", () => {
  const { Game, S } = game({ vcPower: 5000 });
  const printed = +S.players[1].slots.vc.card.power;
  S.active = 0;
  assert.equal(Game.power(1, "vc"), printed + 5000);
  S.active = 1;
  assert.equal(Game.power(1, "vc"), printed);
});
