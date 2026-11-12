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
const CGS_PLAYABLE = /^(Normal Unit|Trigger Unit|Normal Order|Blitz Order|Set Order|Trigger Order)$/;

function cgsTriggerGuess(d) {
  const m = String(d.effect || "").match(/\[(Critical|Draw|Heal|Front|Over)\]\s*trigger/i);
  if (m) return { critical: "crit", draw: "draw", heal: "heal", front: "front", over: "over" }[m[1].toLowerCase()];
  return null;
}

function cgsToCard(d, trigger) {
  const text = String(d.effect || "").trim();
  const isOrder = /Order/.test(d.type);
  const isTrig = d.type === "Trigger Unit";
  const guessed = text ? TextParse.parse(text) : {};
  const trig = isTrig ? (trigger !== undefined ? trigger : cgsTriggerGuess(d)) : null;
  const card = {
    name: String(d.name || "").trim(),
    type: isOrder ? "order" : isTrig ? "trigger" : "unit",
    grade: Number.isFinite(d.grade) ? d.grade : (guessed.grade ?? 0),
    power: isOrder ? 0 : (d.power ?? 0),
    shield: isOrder ? 0 : (d.shield ?? 0),
    crit: 1,
    trigger: trig || null,
    sentinel: /\[CONT\]\s*:\s*Sentinel/i.test(text),
    persona: /persona ride/i.test(text),
    nation: String(d.clan || ""),
    race: "",
    image: d.image_url || "",
    text,
    abilities: text ? TextParse.abilities(text, isOrder) : [],
    source: { from: "cgs", number: d.number || "", set: d.productName || "", setCode: d._set || "", url: d.url || "", cardType: d.type },
  };
  if (isTrig && !card.trigger) card.needsTrigger = true;
  return card;
}

// Pictures saved on this computer by Edit.py: vanguard_images/<set code>/<card number with / → _>.png
// (run Edit.py from the Vanguard folder so the path is relative to editor.html / index.html)
const cgsLocalImage = (setCode, number) => setCode && number ? `vanguard_images/${setCode}/${String(number).replace(/\//g, "_")}.png` : "";
