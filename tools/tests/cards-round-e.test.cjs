// Card round E: quoted names / given abilities with quotes inside, "placed by riding from "X"", blast costs with a name after the bracket.
// The wordings here are short generic rule phrasings written for the tests, not card text.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./load.cjs");
const same = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);
const TP = load().TextParse;

test(`a given ability with a quoted name inside stays whole`, () => {
  const abs = TP.abilities('[AUTO](VC):When this unit attacks, choose one of your rear-guards, and it gets "[AUTO](RC):When this unit attacks, if you have a vanguard with "Zed" in its card name, draw a card." until end of turn.');
  const [a] = abs;
  same(a.effects.filter((e) => e.type === "manual"), []);
  assert.ok(a.effects.some((e) => e.type === "grant"));
  const given = abs.find((x) => x.granted);
  assert.ok(given && given.conds.some((c) => c.type === "vcName" && c.text === "Zed"));
});

test(`'call it to (RC), and it gets "[ACT]…"' gives the ability to the called unit`, () => {
  const [a] = TP.abilities('[AUTO]:When this unit is placed on (VC), choose a "Pup" from your soul, call it to (RC), and it gets "[ACT](RC):[COST][Rest] this unit], search your deck for up to one "Pal", call it to (RC), and shuffle the deck." until end of this fight.');
  assert.equal(a.effects[0].filter.nameExact, "Pup");
  const g = a.effects.find((e) => e.type === "grant");
  assert.equal(g.target, "thatUnit");
});

test(`'When this unit is placed by riding from "X"' = placed on (VC) + rode from X`, () => {
  const [a] = TP.abilities('[AUTO]:When this unit is placed by riding from "Old Friend, Rex", draw a card.');
  assert.equal(a.when, "placedVC");
  same(a.conds, [{ type: "rodeFrom", filter: { nameExact: "Old Friend, Rex" } }]);
});

test(`'rode upon by "A, B"' keeps the comma and inner quotes of the name`, () => {
  const [a] = TP.abilities('[AUTO]:When this unit is rode upon by "Sky Rider, "Bright" Wing", draw a card.');
  same(a.whenFilter, { nameExact: 'Sky Rider, "Bright" Wing' });
  same(a.effects, [{ type: "draw", n: 1 }]);
});

test(`'[Soul-Blast 2] cards with "X" in their card names]' filters the blast`, () => {
  const [a] = TP.abilities('[ACT](Drop):[COST][Soul-Blast 2] cards with "Zed" in their card names], call this card to (RC).');
  same(a.costs, [{ type: "SB", n: 2, filter: { name: "Zed" } }]);
  same(a.effects.filter((e) => e.type === "manual"), []);
});

test(`'choose one of your units with "X", and that unit and this unit get' keeps the choice`, () => {
  const [a] = TP.abilities('[AUTO]:When this unit is placed on (RC), choose one of your units with "Zed" in its card name, and that unit and this unit get [Power]+5000 until end of turn.');
  assert.equal(a.effects[0].target, "chooseMy");
  same(a.effects[0].filter, { name: "Zed" });
  assert.equal(a.effects[1].target, "self");
});
