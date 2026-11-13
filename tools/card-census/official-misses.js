// What the reader can't read yet, over every unique ability text on the official card list (official/cards.json).
// Run: node tools/card-census/official-misses.js [timing|cost|step|all] [rows] [words]
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..", "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["js/schema.js", "js/textparse.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8") + "\n;this.TextParse = typeof TextParse !== 'undefined' ? TextParse : this.TextParse;", ctx);
const TP = ctx.TextParse;
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, "official", "cards.json"), "utf8"));
const [mode = "all", rowsArg, wordsArg] = process.argv.slice(2);
const ROWS = +rowsArg || 40, WORDS = +wordsArg || 6;
const ORDER_KIND = new Set(["5", "6", "7", "8"]);
const seen = new Set();
const miss = {};
let abilities = 0, full = 0, cardsN = 0, cardsFull = 0;
const key = (t) => t.toLowerCase().replace(/"[^"]*"/g, '"X"').replace(/<[^>]*>/g, "<C>").replace(/\d+/g, "N").split(/\s+/).slice(0, WORDS).join(" ");
for (const c of cards) {
  const t = String(c.text || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(i|b|em|strong|font|sskl)[^>]*>/gi, "");
  if (!t.trim() || t.trim() === "-" || seen.has(t)) continue;
  seen.add(t);
  // read it as a pasted page, like the editor does
  const kind = { 1: "Normal Unit", 2: "Trigger Unit", 3: "G Unit", 4: "Others", 5: "Normal Order", 6: "Blitz Order", 7: "Set Order", 8: "Trigger Order", 9: "Ride Deck Crest" }[c.card_kind] || "Normal Unit";
  const page = `${c.card_name}\n${kind}Grade ${c.grade || ""}Power ${c.power || ""}Critical ${c.critical || ""}Shield ${c.shield || ""}\n${t}\nStandard${c.card_number}${c.rare || ""}`;
  let abs;
  try { abs = TP.parse(page, {}).abilities; } catch (e) { (miss["ERROR " + e.message] = miss["ERROR " + e.message] || { n: 0, ex: c.card_name }).n++; continue; }
  const real = abs.filter((a) => !a.part && !a.granted);
  cardsN++;
  let cardOk = real.length > 0;
  for (const a of real) {
    abilities++;
    const steps = (a.effects || []).filter((e) => e.type === "manual");
    if (!steps.length) { full++; continue; }
    cardOk = false;
    for (const e of steps) {
      const txt = String(e.text);
      const cat = /^Timing not read/.test(txt) ? "timing" : /^Also pay/.test(txt) ? "cost" : "step";
      if (mode !== "all" && mode !== cat) continue;
      const body = txt.replace(/^Timing not read, do it at the right moment:\s*/, "").replace(/^Also pay:\s*/, "");
      const focus = cat === "timing" ? ((body.match(/(?:^|:)\s*((?:when|at the|during|if)[^,]*)/i) || [])[1] || body) : body;
      const k = cat + " · " + key(focus);
      if (!miss[k]) miss[k] = { n: 0, ex: body.slice(0, 220), card: c.card_number };
      miss[k].n++;
    }
  }
  if (cardOk) cardsFull++;
}
console.log(`${cardsN} unique texts · ${cardsFull} fully read (${(100 * cardsFull / cardsN).toFixed(1)}%) · abilities ${abilities}, ${full} fully read (${(100 * full / abilities).toFixed(1)}%)`);
for (const [k, v] of Object.entries(miss).sort((a, b) => b[1].n - a[1].n).slice(0, ROWS)) console.log(`${String(v.n).padStart(5)}  ${k}\n        ${v.card}: ${v.ex}`);
