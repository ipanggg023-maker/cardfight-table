// Measures js/textparse.js on every unique card: how many abilities were read fully (no ✋ Manual step),
// and the most common clauses it could not read. Run: node tools/card-census/reader-check.js [sample-size]
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { load, abilities: lines } = require("./load");
const root = path.join(__dirname, "..", "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["js/schema.js", "js/textparse.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8") + "\n;this.SCHEMA = typeof SCHEMA !== 'undefined' ? SCHEMA : this.SCHEMA; this.TextParse = typeof TextParse !== 'undefined' ? TextParse : this.TextParse; this.describeAbility = typeof describeAbility !== 'undefined' ? describeAbility : this.describeAbility;", ctx);
const cards = load();
const sample = +process.argv[2] || cards.length;
let abs = 0, full = 0, cardsFull = 0, cardsWithText = 0, errors = 0;
const misses = {};
const examples = [];
for (const c of cards.slice(0, sample)) {
  if (!c.text) continue;
  cardsWithText++;
  let r;
  try { r = ctx.TextParse.parse(c.text, { type: c.type }); } catch (e) { errors++; if (errors < 4) console.log("ERROR", c.name, e.message); continue; }
  let allFull = true;
  for (const ab of r.abilities || []) {
    if (ab.granted) continue;
    abs++;
    const manual = (ab.effects || []).filter((e) => e.type === "manual");
    if (!manual.length && !ab.unread) full++;
    else {
      allFull = false;
      for (const m of [...manual.map((e) => e.text), ...(ab.unread || [])]) {
        const k = String(m).toLowerCase().replace(/"[^"]*"/g, '"X"').replace(/<[^>]*>/g, "<C>").replace(/\d+/g, "N").split(/\s+/).slice(0, 6).join(" ");
        misses[k] = (misses[k] || 0) + 1;
      }
      if (examples.length < 12 && Math.random() < 0.02) examples.push({ name: c.name, text: c.text.slice(0, 220), got: (r.abilities || []).map((a) => ctx.describeAbility(a)).join(" || ").slice(0, 300) });
    }
  }
  if (allFull) cardsFull++;
}
console.log(`cards with text ${cardsWithText}, fully read ${cardsFull} (${(cardsFull / cardsWithText * 100).toFixed(1)}%) · abilities ${abs}, fully read ${full} (${(full / abs * 100).toFixed(1)}%) · errors ${errors}`);
console.log(Object.entries(misses).sort((a, b) => b[1] - a[1]).slice(0, +process.argv[3] || 40).map(([k, v]) => `${String(v).padStart(5)}  ${k}`).join("\n"));
if (process.argv[4] === "ex") console.log(JSON.stringify(examples, null, 1));
