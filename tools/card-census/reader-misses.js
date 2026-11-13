// Lists the reader's most common misses with one real example each (the ability line it came from).
// Run: node tools/card-census/reader-misses.js [rows]
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load } = require("./load");
const root = path.join(__dirname, "..", "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["js/schema.js", "js/textparse.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8") + "\n;this.TextParse = typeof TextParse !== 'undefined' ? TextParse : this.TextParse;", ctx);
const rows = +process.argv[2] || 40;
const miss = {};
for (const c of load()) {
  if (!c.text) continue;
  for (const ab of ctx.TextParse.parse(c.text, { type: c.type }).abilities) {
    for (const e of ab.effects || []) {
      if (e.type !== "manual") continue;
      const t = String(e.text).replace(/^(Timing not read, do it at the right moment: |Also pay: )/, (m) => (m.startsWith("Timing") ? "TIMING " : "COST "));
      const k = t.toLowerCase().replace(/"[^"]*"/g, '"X"').replace(/<[^>]*>/g, "<C>").replace(/\d+/g, "N").split(/\s+/).slice(0, 6).join(" ");
      if (!miss[k]) miss[k] = { n: 0, ex: t.slice(0, 200), card: c.name };
      miss[k].n++;
    }
  }
}
for (const [k, v] of Object.entries(miss).sort((a, b) => b[1].n - a[1].n).slice(0, rows)) console.log(`${String(v.n).padStart(4)}  ${k}\n        ex: ${v.ex}`);
