// What the other screen may see: the online snapshot must hide a player's hand (their draws included).
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, unit, settle } = require("./load.cjs");

test("snapshot hides drawn cards", async () => {
  const { Game, TextParse: TP } = load();
  const main = Array.from({ length: 50 }, (_, i) => unit(TP, "m" + i, "Secret Card " + i, 1, "", { image: "secret.png", text: "secret text" }));
  const deck = { name: "t", format: "premium", ride: [], main, g: [] };
  Game.newGame(["Host", "Guest"], [deck, deck], { first: 0 });
  const m0 = Game.mulligan([]); await settle(Game); await m0;
  const m1 = Game.mulligan([]); await settle(Game); await m1;
  const S = Game.state();
  assert.ok(S.players[0].hand.length >= 5, "the host drew cards");
  const forGuest = Game.snapshot(1), forHost = Game.snapshot(0);
  for (const c of forGuest.players[0].hand) {
    assert.ok(!c.name || !/Secret Card/.test(c.name), "no name leaks: " + c.name);
    assert.ok(!c.image, "no picture leaks");
    assert.ok(!c.text, "no text leaks");
  }
  assert.ok(forHost.players[0].hand.some((c) => /Secret Card/.test(c.name)), "the owner still sees their hand");
});
