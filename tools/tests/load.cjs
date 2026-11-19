// Loads the browser engine into a Node vm context for tests (no DOM).
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const FILES = ["js/cards.js", "js/schema.js", "js/formats.js", "js/textparse.js", "js/engine.js"];

function load() {
  const ctx = { console, setTimeout, clearTimeout, Promise, structuredClone };
  vm.createContext(ctx);
  const src = FILES.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n");
  vm.runInContext(src + "\n;this.Game = Game; this.TextParse = TextParse;", ctx);
  return { Game: ctx.Game, TextParse: ctx.TextParse };
}

// a plain unit card (abilities read from text when given)
function unit(TP, id, name, grade, text = "", extra = {}) {
  return { id, name, grade, type: "unit", power: 10000, shield: 5000, crit: 1, abilities: text ? TP.abilities(text) : [], ...extra };
}

// answers every pending choice with the first options (as few as allowed, at least one)
async function settle(Game, rounds = 60) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 0));
    const P = Game.state().pending;
    if (P) Game.answer(P.options.slice(0, Math.max(P.min, 1)).map((o) => o.id));
  }
}

module.exports = { load, unit, settle, ROOT };
