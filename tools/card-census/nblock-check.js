// Which ability lines end up with "No block for this ability yet" in the editor's Text check, over every official card.
// (A pasted card is read by TextParse, then CardCheck pairs each text line with a block.)
// Run: node tools/card-census/nblock-check.js [rows]
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..", "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["js/schema.js", "js/textparse.js", "js/cardcheck.js"])
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8") + "\n;this.TextParse = typeof TextParse !== 'undefined' ? TextParse : this.TextParse; this.CardCheck = typeof CardCheck !== 'undefined' ? CardCheck : this.CardCheck;", ctx);
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, "official", "cards.json"), "utf8"));
const ROWS = +process.argv[2] || 30;
const KIND = { 1: "Normal Unit", 2: "Trigger Unit", 3: "G Unit", 4: "Others", 5: "Normal Order", 6: "Blitz Order", 7: "Set Order", 8: "Trigger Order", 9: "Ride Deck Crest" };
const seen = new Set(), groups = {};
let cardsN = 0, withMissing = 0, lines = 0, missing = 0;
for (const c of cards) {
  const t = String(c.text || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(i|b|em|strong|font|sskl)[^>]*>/gi, "");
  if (!t.trim() || t.trim() === "-" || seen.has(t)) continue;
  seen.add(t);
  const page = `${c.card_name}\n${KIND[c.card_kind] || "Normal Unit"}Grade ${c.grade || ""}Power ${c.power || ""}Critical ${c.critical || ""}Shield ${c.shield || ""}\n${t}\nStandard${c.card_number}${c.rare || ""}`;
  const r = ctx.TextParse.parse(page, {});
  const { abilities, ...stats } = r;
  const card = { ...stats, abilities, text: ctx.TextParse.splitStats(page).rest };
  const a = ctx.CardCheck.analyze(card);
  cardsN++;
  let any = false;
  for (const it of a.items) {
    lines++;
    if (it.state !== "missing") continue;
    missing++; any = true;
    const k = it.text.replace(/"[^"]*"/g, '"X"').replace(/\d+/g, "N").replace(/<[^>]*>/g, "<C>").slice(0, 34);
    (groups[k] = groups[k] || { n: 0, ex: it.text.slice(0, 160), no: c.card_number }).n++;
  }
  if (any) withMissing++;
}
console.log(`${cardsN} texts · ${withMissing} with a "No block" line · ${missing} of ${lines} lines`);
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].n - a[1].n).slice(0, ROWS)) console.log(`${String(v.n).padStart(5)}  ${k}\n        ${v.no}: ${v.ex}`);
