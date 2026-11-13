// Checks "Fill from card text" against every card on the official card list: each card is rendered exactly as copying
// its page gives it (en.cf-vanguard.com renders the fields with no separators), read by TextParse, and every field is
// compared with the site's own data. Needs tools/card-census/official/cards.json (fetch-official.mjs).
// Run: node tools/card-census/paste-check.js [examples per problem]
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..", "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["js/schema.js", "js/textparse.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8") + "\n;this.TextParse = typeof TextParse !== 'undefined' ? TextParse : this.TextParse;", ctx);
const TP = ctx.TextParse;
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, "official", "cards.json"), "utf8"));
const SHOW = +process.argv[2] || 3;

// --- the page, as innerText gives it (same order and labels as the site's renderCardDetail) ---
const KIND = { 1: "Normal Unit", 2: "Trigger Unit", 3: "G Unit", 4: "Others", 5: "Normal Order", 6: "Blitz Order", 7: "Set Order", 8: "Trigger Order", 9: "Ride Deck Crest" };
const reg = (v) => { const r = String(v || ""), p = []; if (r.includes("D")) p.push("Standard"); if (r.includes("V")) p.push("V-Premium"); if (r === "G") p.push("G-Regulation"); return p.join("/"); };
// innerText of the page: <br> → new line, the few allowed tags vanish, entities stay as typed in the data (the page shows "&lt;Royal Paladin&gt;")
const text = (v) => String(v || "").replace(/\r?\n/g, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(i|em|b|strong|font|sskl)[^>]*>/gi, "");
const decode = (s) => String(s).replace(/&lt;?/g, "<").replace(/&gt;?/g, ">").replace(/&quot;?/g, '"').replace(/&#0?39;?/g, "'").replace(/&nbsp;?/g, " ").replace(/&amp;?/g, "&");
function pageText(c) {
  const isD = String(c.regulation || "").includes("D");
  const kind = c.card_kind_name || KIND[c.card_kind] || "";
  const f = [kind];
  if (isD) { f.push(c.country || ""); if (c.country2) f.push(c.country2); f.push(c.tribe || ""); if (c.clan) f.push(c.clan); }
  else f.push(c.clan || "", c.tribe || "", c.country || "");
  f.push("Grade " + (c.grade || ""), "Power " + (c.power || ""), "Critical " + (c.critical || ""), "Shield " + (c.shield || ""), String(c.skill_icon || "").replace(/\*/g, "、"), c.card_trigger || "");
  const lines = [c.card_name + (c.card_name_kana ? "（" + c.card_name_kana + "）" : ""), f.join("")];
  const eff = text(c.text).split("\n").map((l) => l.trim()).filter(Boolean);
  lines.push(...eff);
  const fl = text(c.flavor).split("\n").map((l) => l.trim()).filter(Boolean);
  lines.push(...fl);
  lines.push(reg(c.regulation) + (c.card_number || "") + (c.rare || "") + (c.illustrator || ""));
  lines.push("Prev", "Next");
  return { text: lines.join("\n"), effect: eff.join("\n") };
}

// --- what the fields should be ---
const blank = (v) => v === "" || v == null || ["-", "無"].includes(String(v).trim());
const num = (v) => (blank(v) ? null : +String(v).replace(/[^\d]/g, ""));
// where two texts first differ
const diffAt = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };
const norm = (s) => String(s || "").replace(/[“”"]/g, "").replace(/\s+([,.])/g, "$1").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
const problems = {};
const add = (k, c, got, want, extra) => { (problems[k] = problems[k] || []).push({ no: c.card_number, name: c.card_name, got, want, extra }); };
let n = 0;
const seenText = new Set(), ab = { cards: 0, cardsFull: 0, total: 0, full: 0 };
for (const c of cards) {
  n++;
  const { text: t, effect } = pageText(c);
  let s, rest;
  try { ({ stats: s, rest } = TP.splitStats(t)); } catch (e) { add("ERROR " + e.message, c, "", ""); continue; }
  const k = +c.card_kind;
  const wantType = { 1: "unit", 2: "trigger", 3: "g", 5: "order", 6: "order", 7: "order", 8: "order", 9: "crest" }[k];
  if (wantType && s.type !== wantType) add("type", c, s.type, wantType);
  if (norm(s.name) !== norm(decode(c.card_name))) add("name", c, s.name, c.card_name);
  const nations = [c.country, c.country2].filter((x) => !blank(x));
  if (nations.length && norm(s.nation) !== norm(nations[0])) add("nation", c, s.nation, nations[0]);
  if (!blank(c.country2) && norm(s.nation2) !== norm(c.country2)) add("nation2", c, s.nation2, c.country2);
  if (!blank(c.clan) && norm(s.clan) !== norm(c.clan)) add("clan", c, s.clan, c.clan);
  if (!blank(c.tribe) && norm(s.race) !== norm(c.tribe)) add("race", c, s.race, c.tribe);
  if (blank(c.tribe) && s.race) add("race (should be empty)", c, s.race, "");
  if (!blank(c.grade) && s.grade !== num(c.grade)) add("grade", c, s.grade, c.grade);
  if (!blank(c.power) && s.power !== num(c.power)) add("power", c, s.power, c.power);
  if (!blank(c.critical) && s.crit !== num(c.critical)) add("critical", c, s.crit, c.critical);
  if (!blank(c.shield) && s.shield !== num(c.shield)) add("shield", c, s.shield, c.shield);
  const sk = String(c.skill_icon || "").toLowerCase();
  if (/twin drive/.test(sk) && s.drive !== 2) add("skill: twin drive", c, s.drive, 2, c.skill_icon);
  if (/triple drive/.test(sk) && s.drive !== 3) add("skill: triple drive", c, s.drive, 3, c.skill_icon);
  if (/boost/.test(sk) !== !!s.boost && (k === 1 || k === 2)) add("skill: boost", c, s.boost, /boost/.test(sk), c.skill_icon);
  if (/intercept/.test(sk) !== !!s.intercept && (k === 1 || k === 2)) add("skill: intercept", c, s.intercept, /intercept/.test(sk), c.skill_icon);
  if (/persona ride/.test(sk) !== !!s.persona && (k === 1 || k === 2)) add("skill: persona ride", c, s.persona, /persona ride/.test(sk), c.skill_icon);
  const gift = (sk.match(/imaginary gift\s*[:：]?\s*(force|accel|protect)/) || [])[1];
  if (gift && s.gift !== gift) add("skill: imaginary gift", c, s.gift, gift, c.skill_icon);
  const trig = String(c.card_trigger || "").toLowerCase();
  const tw = (trig.match(/(critical|front|draw|heal|over|stand)/) || [])[1];
  if (tw && s.trigger !== (tw === "critical" ? "crit" : tw)) add("trigger", c, s.trigger, tw, c.card_trigger);
  const tp = (trig.match(/\+\s*([\d,]+)/) || [])[1];
  if (tp && s.trigPower !== +tp.replace(/,/g, "")) add("trigger power", c, s.trigPower, tp, c.card_trigger);
  if (norm(s.number) !== norm(c.card_number)) add("card number", c, s.number, c.card_number);
  if (!blank(c.rare) && norm(s.rarity) !== norm(String(c.rare).replace("Ｃ", "C").replace("Ｒ", "R"))) add("rarity", c, s.rarity, c.rare);
  const wantIcon = String(c.regulation || "").includes("D") ? "D" : String(c.regulation || "").includes("V") ? "V" : null;
  if (wantIcon && s.icon !== wantIcon) add("format icon", c, s.icon, wantIcon, reg(c.regulation));
  { const a = norm(rest), b = norm(decode(effect)).replace(/^-$/, ""); if (a !== b) { const i = diffAt(a, b); add("ability text (what's left after the stats)", c, a.slice(Math.max(0, i - 40), i + 80), b.slice(Math.max(0, i - 40), i + 80)); } }
  // abilities: how many of this card's abilities the reader turns into blocks with nothing left to do by hand
  if (rest && !seenText.has(norm(rest))) {
    seenText.add(norm(rest));
    let abs = [];
    try { abs = TP.parse(t, {}).abilities; } catch (e) { add("ERROR parse " + e.message, c, "", ""); }
    const real = abs.filter((a) => !a.part && !a.granted);
    const manual = (a) => (a.effects || []).some((e) => e.type === "manual") || (a.unread && a.unread.length);
    ab.total += real.length; ab.full += real.filter((a) => !manual(a)).length; ab.cards++; if (real.length && real.every((a) => !manual(a))) ab.cardsFull++;
  }
}
const keys = Object.keys(problems).sort((a, b) => problems[b].length - problems[a].length);
console.log(`${n} cards checked · ${keys.length ? keys.map((k) => `${k}: ${problems[k].length}`).join(" · ") : "no problems"}`);
console.log(`abilities (unique texts): ${ab.cards} cards, ${ab.cardsFull} fully read (${(100 * ab.cardsFull / Math.max(1, ab.cards)).toFixed(1)}%) · ${ab.total} abilities, ${ab.full} fully read (${(100 * ab.full / Math.max(1, ab.total)).toFixed(1)}%)`);
for (const k of keys) {
  console.log(`\n== ${k} (${problems[k].length})`);
  for (const p of problems[k].slice(0, SHOW)) console.log(`  ${p.no} ${p.name} | got ${JSON.stringify(p.got)} | want ${JSON.stringify(p.want)}${p.extra ? " | " + p.extra : ""}`);
}
