// TCG API (tcgapi.dev) client + mapping into Vanguard Table cards.
// Calls go through the local relay (start-tcgapi-relay.bat) because the API blocks browser calls.
// Free plan: 100 requests/day, personal use. Every call below costs 1 request.

const TcgApi = (() => {
  const LS_KEY = "vt-tcgapi-key", LS_RELAY = "vt-tcgapi-relay";
  const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
  let lastLimit = null;

  const settings = () => ({ key: get(LS_KEY, ""), relay: get(LS_RELAY, "http://localhost:8787").replace(/\/+$/, "") });
  const save = (key, relay) => { set(LS_KEY, key.trim()); set(LS_RELAY, (relay || "http://localhost:8787").trim()); };

  async function call(path) {
    const { key, relay } = settings();
    if (!key) throw new Error("Add your TCG API key first");
    let r;
    try {
      r = await fetch(relay + path, { headers: { "X-API-Key": key } });
    } catch {
      throw new Error("Can't reach the relay. Double-click start-tcgapi-relay.bat in D:\\Vanguard and keep its window open.");
    }
    let body;
    try { body = await r.json(); } catch { body = {}; }
    if (body.rate_limit) lastLimit = body.rate_limit;
    if (!r.ok) {
      const msg = body.error?.message || body.error || body.message || `HTTP ${r.status}`;
      if (r.status === 401 || r.status === 403) throw new Error(`API key rejected: ${msg}`);
      if (r.status === 429) throw new Error("Daily request limit reached. It resets tomorrow (free plan: 100/day).");
      throw new Error(String(msg));
    }
    return body;
  }

  const GAME = "cardfight-vanguard";
  return {
    settings, save, limit: () => lastLimit,
    games: () => call("/v1/games"),
    sets: () => call(`/v1/games/${GAME}/sets`),
    setCards: (id, page = 1) => call(`/v1/sets/${encodeURIComponent(id)}/cards?page=${page}`),
    search: (q, page = 1) => call(`/v1/search?game=${GAME}&q=${encodeURIComponent(q)}&page=${page}`),
    card: (id) => call(`/v1/cards/${encodeURIComponent(id)}`),
  };
})();

// ---------- mapping ----------
// custom_attributes key names are not documented for Vanguard, so match loosely.
function apiAttrs(d) {
  const out = {};
  const src = { ...(d.custom_attributes || d.customAttributes || d.extended_data || {}) };
  if (Array.isArray(d.extended_data)) d.extended_data.forEach((x) => (src[x.name || x.displayName] = x.value));
  Object.entries(src).forEach(([k, v]) => { out[String(k).toLowerCase().replace(/[^a-z]/g, "")] = v; });
  return out;
}
const apiPick = (a, ...keys) => { for (const k of keys) if (a[k] !== undefined && a[k] !== null && a[k] !== "") return a[k]; return undefined; };
const stripHtml = (s) => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
const cleanName = (n) => String(n || "").replace(/\s*\((?:[A-Z]{1,4}\+?|SP|SEC|FFR|DSR|SR|Foil|Holo)[^)]*\)\s*$/i, "").replace(/\s*-\s*[A-Z0-9-]+\/[A-Z0-9]+EN\s*$/i, "").trim();
const apiNum = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : undefined; };

function apiToCard(d) {
  const a = apiAttrs(d);
  const text = stripHtml(apiPick(a, "description", "cardtext", "text", "effect", "ability", "abilities", "oracletext") || "");
  const gradeRaw = apiPick(a, "grade", "gradeskill", "gradeskillicon");
  const unitRaw = String(apiPick(a, "unit", "unittype", "cardtype", "type") || "");
  const trigRaw = String(apiPick(a, "trigger", "triggertype", "triggericon") || "").toLowerCase();
  const trig = /crit/.test(trigRaw) ? "crit" : /front/.test(trigRaw) ? "front" : /draw/.test(trigRaw) ? "draw" : /heal/.test(trigRaw) ? "heal" : /over/.test(trigRaw) ? "over" : null;
  const isOrder = /order/i.test(unitRaw) || /order/i.test(String(gradeRaw || ""));
  const guessed = text ? TextParse.parse(text) : {};
  const card = {
    name: cleanName(d.name || d.clean_name),
    type: isOrder ? "order" : trig ? "trigger" : "unit",
    grade: apiNum(gradeRaw) ?? guessed.grade ?? 0,
    power: apiNum(apiPick(a, "power")) ?? guessed.power ?? 0,
    shield: apiNum(apiPick(a, "shield")) ?? guessed.shield ?? 0,
    crit: apiNum(apiPick(a, "critical", "crit")) ?? guessed.crit ?? 1,
    trigger: trig || guessed.trigger || null,
    sentinel: /sentinel/i.test(text) || /sentinel/i.test(unitRaw),
    persona: /persona ride/i.test(text) || /persona/i.test(String(apiPick(a, "imaginarygift", "gift") || "")),
    nation: String(apiPick(a, "nation", "clan", "nations") || ""),
    race: String(apiPick(a, "race", "breed") || ""),
    image: d.image_url || "",
    text,
    abilities: text ? TextParse.abilities(text, isOrder) : [],
    source: { api: "tcgapi.dev", id: d.id, number: d.number || "", set: d.set_name || "", rarity: d.rarity || "" },
  };
  if (card.type === "order") { card.power = 0; card.shield = 0; }
  if (card.type !== "trigger") card.trigger = null;
  return card;
}
const isSingleCard = (d) => !d.product_type || /card/i.test(d.product_type);
