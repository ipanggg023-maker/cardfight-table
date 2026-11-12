// Shared loader: all unique cards (name + text), with era from the card number.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "data"); // downloaded by fetch.mjs (gitignored: card text belongs to Bushiroad)
function era(num) {
  const n = String(num || "").toUpperCase();
  if (/^DZ-|^D-PR\/?DZ|DZ/.test(n) && /DZ/.test(n)) return "DZ";
  if (/^D-|^D[A-Z]*-|^VGE-D/.test(n) || /^D-/.test(n)) return "D";
  if (/^V-|^VGE-V/.test(n)) return "V";
  if (/^G-|^VGE-G/.test(n)) return "G";
  return "Original";
}
function load() {
  const seen = new Map();
  for (const f of fs.readdirSync(dir)) {
    if (f === "AllSets.json") continue;
    for (const c of JSON.parse(fs.readFileSync(path.join(dir, f)))) {
      const text = String(c.effect || "").replace(/\r/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/　/g, " ").trim();
      const key = c.name + "|" + text;
      if (seen.has(key)) continue;
      seen.set(key, { name: c.name, number: c.number, type: c.type, clan: (c.clan || "").trim(), grade: c.grade, text, era: era(c.number) });
    }
  }
  return [...seen.values()];
}
// One ability per line; lines starting with a bullet belong to the line before.
function abilities(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[・•\-]/.test(line) && out.length) out[out.length - 1] += " " + line;
    else out.push(line);
  }
  return out;
}
module.exports = { load, abilities };
