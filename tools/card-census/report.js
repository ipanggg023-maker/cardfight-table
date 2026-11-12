// Writes docs/abilities/catalogue.md from tags.json (made by analyze.js).
// Card names only as examples; no card text is copied into the repo.
const fs = require("fs");
const path = require("path");
const d = JSON.parse(fs.readFileSync(path.join(__dirname, "tags.json"), "utf8"));
const ERAS = ["Original", "G", "V", "D", "DZ"];
const MARK = { Y: "✅ yes", P: "🟡 partly", N: "❌ no" };
const cats = [...new Set(d.T.map((t) => t.cat))];
let md = `# Card ability catalogue

Made by \`tools/card-census\` from the public CGS card data (every English card from the first trial decks
to DZ-BT09). Reprints with the same name and text count once: **${d.cards.toLocaleString()} unique cards**.

Each row is one pattern that appears in card text: a kind of ability, where it works, a limit, a timing,
a cost, a condition, an effect or a keyword. "Cards" = how many unique cards use it at least once.
"Engine" = whether the ability blocks in \`js/schema.js\` + \`js/engine.js\` can build it today.

**Cards that only use ✅ patterns today: ${d.fullyY.toLocaleString()} (${((d.fullyY / d.cards) * 100).toFixed(1)}%).**
Everything else needs at least one 🟡/❌ pattern (or the ✋ Manual block). The plan to close the gap is in
\`docs/abilities/PLAN.md\`.

Regex matching is approximate (±5–10% per row); it is meant to rank the work, not to judge single cards.
Re-run: \`node tools/card-census/fetch.mjs && node tools/card-census/analyze.js && node tools/card-census/report.js\`.

`;
for (const cat of cats) {
  const rows = d.T.filter((t) => t.cat === cat).sort((a, b) => b.n - a.n);
  md += `## ${cat}\n\n| Pattern | Cards | ${ERAS.join(" | ")} | Engine | Notes | Examples |\n|---|---:|${ERAS.map(() => "---:").join("|")}|---|---|---|\n`;
  for (const t of rows) md += `| ${t.label} | ${t.n} | ${ERAS.map((e) => t.era[e] || "").join(" | ")} | ${MARK[t.support]} | ${t.note || ""} | ${t.ex.slice(0, 3).join("; ")} |\n`;
  md += "\n";
}
fs.writeFileSync(path.join(__dirname, "..", "..", "docs", "abilities", "catalogue.md"), md);
console.log("wrote docs/abilities/catalogue.md");
