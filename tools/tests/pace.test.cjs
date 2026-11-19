// How long the screen waits at each battle moment (js/pace.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Pace = require(path.join(__dirname, "..", "..", "js", "pace.js"));

test("check card shows for 1.2 s", () => assert.equal(Pace.ms("checkShow", {}), 1200));
test("reduced motion halves the wait", () => assert.equal(Pace.ms("checkShow", { reduced: true }), 600));
test("hidden tab waits 60 ms", () => assert.equal(Pace.ms("keyRide", { hidden: true, reduced: true }), 60));
test("test table waits 60 ms", () => assert.equal(Pace.ms("attack", { test: true }), 60));
test("unknown moment waits 400 ms", () => assert.equal(Pace.ms("nope", {}), 400));
test("every moment has its value", () => {
  const want = { draw: 300, ride: 450, keyRide: 1000, call: 300, attack: 600, guardTotal: 900, result: 500, checkShow: 1200, checkTrigger: 700, checkMove: 400, finish: 600 };
  for (const [k, v] of Object.entries(want)) assert.equal(Pace.ms(k, {}), v, k);
});
