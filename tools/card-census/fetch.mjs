// Downloads the public CGS Vanguard card data (all sets) into data/ next to this script.
import fs from "fs";
import path from "path";
const BASE = "https://raw.githubusercontent.com/dragogodev/cgs/master/Cardfight%20Vanguard/";
const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "data");
fs.mkdirSync(out, { recursive: true });
const get = async (u) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u); if (r.ok) return r.json(); if (r.status === 404) return null; } catch {} await new Promise((r) => setTimeout(r, 800)); } return null; };
const sets = await get(BASE + "AllSets.json");
fs.writeFileSync(path.join(out, "AllSets.json"), JSON.stringify(sets));
let n = 0, cards = 0, miss = [];
const queue = [...sets];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    const url = s.cardsUrl || `${BASE}sets/${encodeURIComponent(s.code)}.json`;
    const data = await get(url);
    if (!data) { miss.push(s.code); continue; }
    fs.writeFileSync(path.join(out, String(s.code).replace(/[^\w.-]/g, "_") + ".json"), JSON.stringify(data));
    n++; cards += Array.isArray(data) ? data.length : 0;
  }
}));
console.log(JSON.stringify({ sets: sets.length, downloaded: n, cards, missing: miss.slice(0, 20), missingCount: miss.length }));
