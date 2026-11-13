// Card data from the Card Game Simulator community repo (github.com/dragogodev/cgs, folder "Cardfight Vanguard").
// Plain JSON files on raw.githubusercontent.com, which allows browser calls, so no key or relay is needed.
// Each set file: [{name, number, url, image_url, effect, productName, type, clan, grade, power, shield}]
// The data has no trigger icon or critical, so trigger units get their type from the text when it says so,
// otherwise the player picks it (cgsTriggerGuess returns null and the card is marked needsTrigger).

const Cgs = (() => {
  const BASE = "https://raw.githubusercontent.com/dragogodev/cgs/master/Cardfight%20Vanguard/";
  const cache = new Map(); // set code -> cards
  let sets = null;

  async function getJSON(url) {
    let r;
    try { r = await fetch(url); } catch { throw new Error("Can't reach GitHub. Check your internet connection."); }
    if (!r.ok) throw new Error(`GitHub answered ${r.status} for ${url.split("/").pop()}`);
    return r.json();
  }
  async function allSets() {
    if (!sets) {
      const list = await getJSON(BASE + "AllSets.json");
      sets = list.map((s) => ({ code: String(s.code), name: s.name, cardsUrl: s.cardsUrl || `${BASE}sets/${s.code}.json` }));
    }
    return sets;
  }
  async function setCards(code) {
    if (!cache.has(code)) {
      const s = (await allSets()).find((x) => x.code === code);
      const list = await getJSON(s ? s.cardsUrl : `${BASE}sets/${code}.json`);
      cache.set(code, list.map((d) => ({ ...d, _set: code })));
    }
    return cache.get(code);
  }
  // Loads every set (about 240 small files, ~18 MB) once, 8 at a time.
  async function everything(onProgress) {
    const list = await allSets();
    let done = 0;
    const queue = list.slice();
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift();
        try { await setCards(s.code); } catch { /* skip a broken set */ }
        onProgress && onProgress(++done, list.length);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return list.flatMap((s) => cache.get(s.code) || []);
  }
  return { allSets, setCards, everything, loaded: () => cache.size };
})();

// Card types the game can use. G units, markers and crests are skipped.
const CGS_PLAYABLE = /^(Normal Unit|Trigger Unit|G Unit|Normal Order|Blitz Order|Set Order|Trigger Order)$/;

function cgsTriggerGuess(d) {
  const m = String(d.effect || "").match(/\[(Critical|Draw|Heal|Front|Over)\]\s*trigger/i);
  if (m) return { critical: "crit", draw: "draw", heal: "heal", front: "front", over: "over" }[m[1].toLowerCase()];
  return null;
}

function cgsToCard(d, trigger) {
  const text = String(d.effect || "").trim();
  const isOrder = /Order/.test(d.type);
  const isTrig = d.type === "Trigger Unit";
  const isG = d.type === "G Unit";
  // G units (grade 4): stride units or G guardians (text mentions the guard step / Generation Guard)
  const gKind = isG ? (/Generation Guard|-Guard Step-|G guardian/i.test(text) ? "guardian" : "stride") : undefined;
  const guessed = text ? TextParse.parse(text, { type: d.type }) : {};
  const trig = isTrig ? (trigger !== undefined ? trigger : cgsTriggerGuess(d)) : null;
  const card = {
    name: String(d.name || "").trim(),
    type: isOrder ? "order" : isTrig ? "trigger" : isG ? "g" : "unit",
    grade: Number.isFinite(d.grade) ? d.grade : isG ? 4 : (guessed.grade ?? 0),
    power: isOrder ? 0 : (d.power ?? 0),
    shield: isOrder ? 0 : (d.shield ?? 0),
    crit: 1,
    trigger: trig || null,
    sentinel: /\[CONT\]\s*:\s*Sentinel/i.test(text),
    persona: /persona ride/i.test(text),
    nation: String(d.clan || ""),
    clan: /^(D|DZ)-/i.test(String(d.number || "")) ? "" : String(d.clan || ""),
    icon: /^(D|DZ)-/i.test(String(d.number || "")) ? "D" : /^V-/i.test(String(d.number || "")) ? "V" : "-",
    race: "",
    image: d.image_url || "",
    text,
    abilities: text ? TextParse.abilities(text, isOrder) : [],
    source: { from: "cgs", number: d.number || "", set: d.productName || "", setCode: d._set || "", url: d.url || "", cardType: d.type },
  };
  if (isTrig && !card.trigger) card.needsTrigger = true;
  for (const k of ["forerunner", "lord", "resist", "harmony", "cantBeCalled", "ace", "ultimate"]) if (guessed[k]) card[k] = true;
  card.abilities.forEach((a) => delete a.unread);
  if (d.type === "Set Order") card.setOrder = true;
  if (/Regalis Piece/i.test(text)) card.regalis = true;
  if (/Alchemagic/i.test(text)) card.alchemagic = true;
  const armsM = isOrder && text.match(/\bArms\s*[-–]\s*["“]?([^"”\n\]]+)["”]?/i);
  if (armsM) { card.arms = true; card.armsName = armsM[1].trim(); }
  if (!isOrder && /XoverDress/i.test(text)) card.xoverDress = card.xoverDress || "";
  else if (!isOrder && /overDress/i.test(text)) {
    card.dress = true;
    const od = text.match(/overDress\s*[-–]\s*["“]([^"”]+)["”]/i);
    if (od) card.overDress = od[1].trim();
  }
  const giftM = text.match(/Imaginary Gift\s*[:：]?\s*(Force|Accel|Protect)/i);
  if (giftM && !isG) card.gift = giftM[1].toLowerCase();
  if (isG) { card.gKind = gKind; if (/Ultimate Stride/i.test(text)) card.ultimate = true; if (gKind === "stride") card.drive = 3; }
  return card;
}

// ---------- Import everything ----------
// One game card per name + text (reprints merge); every printing is kept in card.prints [{setCode, set, number, image}].
// Card types: units, triggers, G units, orders; tickets ("This card is a ticket card") and tokens (type "Others" named "… Token"
// or with stats and no text) become ticket / token cards. Markers and ride deck crests are skipped.
const cgsGameKey = (d) => String(d.name || "").trim().toLowerCase() + "|" + String(d.effect || "").toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
function cgsKind(d) {
  const text = String(d.effect || "");
  if (CGS_PLAYABLE.test(d.type)) return "card";
  if (!d.type) return d.power != null || d.grade != null ? "card" : null; // a few real cards have no type in the data
  if (d.type !== "Others") return null; // ride deck crests (Energy Generator is built in), markers…
  if (/ticket card/i.test(text) || /^quick shield$/i.test(d.name || "")) return "ticket";
  if (/represents an? .*?token/i.test(text) || (d.grade != null && d.power != null)) return "token";
  if (d.grade == null && d.power == null && /^\[CONT\]/i.test(text.trim())) return "crest";
  return null; // markers (Imaginary Gift, Treasure, Cradle…)
}
// the editor card for one game card from the library (all printings in card.prints)
function cgsGameCard(g, trigger) {
  const d = g.d;
  const type = d.type || (d.power == null && /play this|order/i.test(d.effect || "") ? "Normal Order" : "Normal Unit");
  const card = cgsToCard({ ...d, type: g.kind === "ticket" ? "Blitz Order" : g.kind === "card" ? type : "Normal Unit" }, trigger);
  if (g.kind === "ticket") Object.assign(card, { type: "order", ticket: true, grade: card.grade || 0 });
  if (g.kind === "ticket") card.abilities.forEach((ab) => { if (ab.kind === "ORDER") ab.kind = "BLITZ"; }); // tickets are played while guarding (blitz)
  if (g.kind === "token") Object.assign(card, { type: "unit", token: true, power: d.power || 0, grade: d.grade || 0 });
  if (g.kind === "crest") { Object.assign(card, { type: "crest", grade: 0, power: 0, shield: 0 }); card.abilities.forEach((a) => { a.zone = "crest"; }); }
  card.abilities.forEach((a) => delete a.unread);
  // over triggers are the only grade 0 triggers with 50000 shield (D / DZ era): certain without the icon
  if (card.type === "trigger" && !card.trigger && +d.shield >= 50000 && (d.grade || 0) === 0) { card.trigger = "over"; card.trigPower = 100000000; delete card.needsTrigger; }
  card.prints = g.prints;
  card.source = { ...card.source, setCode: g.prints[0].setCode, set: g.prints[0].set, number: g.prints[0].number, gameKey: g.key };
  return card;
}
// entries: all set files' rows (with _set). Returns [{key, card, prints}] in set order.
function cgsGameCards(entries, setNames) {
  const map = new Map();
  for (const d of entries) {
    const kind = cgsKind(d);
    if (!kind) continue;
    const key = cgsGameKey(d);
    const print = { setCode: d._set, set: setNames[d._set] || d.productName || "", number: d.number || "", image: d.image_url || "", url: d.url || "" };
    const g = map.get(key);
    if (g) { if (!g.prints.some((p) => p.number === print.number && p.setCode === print.setCode)) g.prints.push(print); continue; }
    map.set(key, { key, d, kind, prints: [print] });
  }
  return [...map.values()];
}
// Pictures saved on this computer by Edit.py: vanguard_images/<set code>/<card number with / → _>.png
// (run Edit.py from the Vanguard folder so the path is relative to editor.html / index.html)
const cgsLocalImage = (setCode, number) => setCode && number ? `vanguard_images/${setCode}/${String(number).replace(/\//g, "_")}.png` : "";
