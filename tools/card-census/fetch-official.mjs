// Downloads the official English card list (en.cf-vanguard.com, the site's own list API) into a gitignored folder,
// for checking the "Fill from card text" reader against every real card. Card text belongs to Bushiroad: never commit it.
// Run: node tools/card-census/fetch-official.mjs   (about 430 requests, one every 1.5 s)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "official");
fs.mkdirSync(dir, { recursive: true });
const API = "https://en.cf-vanguard.com/manage/en-api/cards";
const HEAD = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "application/json", Referer: "https://en.cf-vanguard.com/cardlist/" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(n) {
  for (let tries = 1; ; tries++) {
    try {
      const r = await fetch(`${API}?per_page=60&page=${n}`, { headers: HEAD });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (tries >= 5) throw e;
      console.log(`page ${n}: ${e.message}, retry ${tries}`);
      await sleep(5000 * tries);
    }
  }
}
const first = await page(1);
const total = first.total, pages = Math.ceil(total / first.per_page);
fs.writeFileSync(path.join(dir, "lists.json"), JSON.stringify({ nations: first.nations, clans: first.clans }, null, 1));
const cards = [...first.items];
console.log(`${total} cards, ${pages} pages`);
for (let n = 2; n <= pages; n++) {
  await sleep(1500);
  const p = await page(n);
  cards.push(...p.items);
  if (n % 25 === 0) { console.log(`page ${n}/${pages} · ${cards.length} cards`); fs.writeFileSync(path.join(dir, "cards.json"), JSON.stringify(cards)); }
}
fs.writeFileSync(path.join(dir, "cards.json"), JSON.stringify(cards));
console.log(`done: ${cards.length} cards → ${path.join(dir, "cards.json")}`);
