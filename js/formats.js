// Play formats and deck rules. No DOM: shared by the editor, the lobby and the game.
// Sources: docs/rules/03-format-standard.md, 04-format-v-premium.md, 05-format-premium.md
// (Comprehensive Rules ver. 4.59, Fighter's Rules, Deck Construction Rules, as of Nov 2026).

const FORMATS = {
  standard: {
    label: "Standard", sub: "Nation Fight · D cards · ride deck + crest",
    rideDeck: true,        // 4 units G0–G3 + crest; first vanguard = ride deck G0; no G assist
    crest: true,           // Energy Generator (deck.energy)
    gAssist: false,
    poolIcon: "D",         // only cards with the D icon
    identity: "nation",    // one nation (cards with no nation/clan go anywhere)
    trigCaps: { heal: 4, over: 1, crit: 8, draw: 8, front: 8 },
    standTrigger: false,
    gDeck: "unlock",       // only with a listed ride deck / crest (deck.gUnlock)
    restrictions: true,
  },
  vpremium: {
    label: "V Premium", sub: "Clan Fight · V cards · no ride deck",
    rideDeck: false, crest: false, gAssist: true,
    poolIcon: "V", identity: "clan",
    trigCaps: { heal: 4, over: 1 },
    standTrigger: false,
    gDeck: false,
    restrictions: true,
  },
  premium: {
    label: "Premium", sub: "Clan Fight · all cards · no ride deck",
    rideDeck: false, crest: false, gAssist: true,
    poolIcon: null, identity: "clanPremium", // one clan; D cards must be from that clan's nation
    trigCaps: { heal: 4, over: 1 },
    standTrigger: true,
    gDeck: true,           // 0–16 G units of the clan
    restrictions: true,
  },
  extreme: {
    label: "Premium Extreme", sub: "Any clans mixed · all cards · no restriction list",
    rideDeck: false, crest: false, gAssist: true,
    poolIcon: null, identity: null,
    trigCaps: { heal: 4, over: 1 },
    standTrigger: true,
    gDeck: true,
    restrictions: false,
  },
};
const DEFAULT_FORMAT = "standard";
const gDeckAllowed = (deck) => { const F = FORMATS[formatOf(deck)]; return F.gDeck === true || (F.gDeck === "unlock" && !!deck.gUnlock); };
const formatOf = (deck) => FORMATS[deck && deck.format] ? deck.format : DEFAULT_FORMAT;

// Old clan → D nation (official at nation level; the clan rows are [unverified], see docs/rules/01).
const CLAN_NATION = {
  "royal paladin": "Keter Sanctuary", "oracle think tank": "Keter Sanctuary", "angel feather": "Keter Sanctuary",
  "shadow paladin": "Keter Sanctuary", "gold paladin": "Keter Sanctuary",
  "kagero": "Dragon Empire", "tachikaze": "Dragon Empire", "murakumo": "Dragon Empire", "narukami": "Dragon Empire",
  "nubatama": "Dragon Empire", "gear chronicle": "Dragon Empire",
  "nova grappler": "Brandt Gate", "dimension police": "Brandt Gate", "link joker": "Brandt Gate",
  "dark irregulars": "Dark States", "spike brothers": "Dark States", "pale moon": "Dark States",
  "megacolony": "Stoicheia", "great nature": "Stoicheia", "neo nectar": "Stoicheia", "granblue": "Stoicheia",
  "aqua force": "Stoicheia", "genesis": "Stoicheia",
  "bermuda triangle": "Lyrical Monasterio",
};
const NATIONS = ["Keter Sanctuary", "Dragon Empire", "Brandt Gate", "Dark States", "Stoicheia", "Lyrical Monasterio"];
const fmtNorm = (s) => String(s || "").trim().toLowerCase();
const isNationName = (s) => NATIONS.some((n) => fmtNorm(n) === fmtNorm(s));
// Cards with no clan or nation (and "Cray Elemental") belong to every deck (CR 2.2.4–2.2.5)
const isNeutral = (c) => { const k = fmtNorm(c.clan || c.nation); return !k || k === "cray elemental" || k === "-"; };

// Card pool icon: the card's own field, else guessed from its collection number (D-/DZ- = D, V- = V).
function iconOf(c) {
  if (c.icon === "D" || c.icon === "V" || c.icon === "-") return c.icon;
  const num = String((c.source && c.source.number) || c.number || "");
  if (/^(D|DZ)-/i.test(num)) return "D";
  if (/^V-/i.test(num)) return "V";
  return "";
}
// Identity strings for the deck checks
function cardNation(c) {
  if (c.nation && isNationName(c.nation)) return c.nation;
  return CLAN_NATION[fmtNorm(c.clan || c.nation)] || c.nation || "";
}
function cardClan(c) {
  if (c.clan) return c.clan;
  return c.nation && !isNationName(c.nation) ? c.nation : ""; // old cards imported with the clan in "nation"
}

// ---------- restriction lists (editable, stored in this browser) ----------
// { [format]: [{ name, rule: "banned"|"1"|"2"|"noFV" }], choice: { [format]: [[name, name, …], …] } }
const Restrictions = (() => {
  const KEY = "vt-restrict";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    all: load,
    save: (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; } },
    of: (fmt) => { const d = load(); return { list: d[fmt] || [], choice: (d.choice && d.choice[fmt]) || [] }; },
  };
})();
const RESTRICT_RULES = { banned: "Restricted (banned)", 1: "Restricted to 1", 2: "Restricted to 2", noFV: "Not as first vanguard" };

// ---------- deck check ----------
// deck: {format, ride:[ids G0..G3] (ride-deck formats), starter: id (other formats), energy, main:[50 ids]}
// Returns a list of problems (empty = legal).
// tokens, tickets and crests are made by effects; they can't be put in a deck (CR 15.4–15.7)
const notForDecks = (c) => !!(c && (c.token || c.ticket || c.type === "crest"));
function validateDeck(deck, byId) {
  const F = FORMATS[formatOf(deck)], errs = [];
  const main = deck.main.map((id) => byId[id]).filter(Boolean);
  const missing = deck.main.length - main.length;
  if (missing) errs.push(`${missing} card(s) in this deck were deleted`);
  let ride = [], extra = [];
  const made = [...main, ...(deck.ride || []).map((id) => byId[id]), ...(deck.g || []).map((id) => byId[id])].filter(notForDecks);
  if (made.length) errs.push(`Tokens, tickets and crests can't be in a deck: ${[...new Set(made.map((c) => c.name))].join(", ")}`);
  if (F.rideDeck) {
    ride = (deck.ride || []).map((id) => byId[id]);
    if (ride.length !== 4 || ride.some((c) => !c)) errs.push("Ride deck needs 4 units (grade 0–3)");
    else if (ride.map((c) => c.grade).join() !== "0,1,2,3") errs.push("Ride deck must be grade 0, 1, 2, 3");
    if (F.crest && !deck.energy) errs.push("Ride deck needs a crest: tick Energy Generator");
  } else {
    const st = byId[deck.starter];
    if (!st) errs.push("Choose a grade 0 first vanguard");
    else {
      if (st.grade !== 0 || st.type === "order") errs.push("The first vanguard must be a grade 0 unit");
      if (!deck.main.includes(deck.starter)) errs.push("The first vanguard must be one of the 50 main deck cards");
    }
  }
  if (main.length !== 50) errs.push(`Main deck has ${main.length}/50 cards`);
  // G deck (CR 8.1.4.3): up to 16 G units, max 4 per name; G units never go in the main deck
  const gcards = (deck.g || []).map((id) => byId[id]).filter(Boolean);
  if (main.some((c) => c.type === "g")) errs.push("G units go in the G deck, not the main deck");
  if (gcards.some((c) => c.type !== "g")) errs.push("Only G units can go in the G deck");
  if (gcards.length > 16) errs.push(`G deck has ${gcards.length}/16 cards`);
  if (gcards.length && !gDeckAllowed(deck)) errs.push(F.gDeck === "unlock" ? "Standard allows a G deck only with a listed ride deck: tick \"My ride deck unlocks a G deck\"" : `${F.label} has no G deck`);
  const gNames = {};
  gcards.forEach((c) => (gNames[c.name] = (gNames[c.name] || 0) + 1));
  Object.entries(gNames).forEach(([n, k]) => { if (k > 4) errs.push(`G deck: "${n}" ${k} copies (max 4)`); });
  // triggers, sentinels and copies count across the main deck and the ride deck (CR 8.1.5–8.1.7)
  const both = [...main, ...ride.filter(Boolean)];
  const count = (fn) => both.filter(fn).length;
  const trig = count((c) => c.trigger);
  if (trig !== 16) errs.push(`Triggers: ${trig}/16`);
  const noType = both.filter((c) => c.type === "trigger" && !c.trigger);
  if (noType.length) errs.push(`Set the trigger type: ${[...new Set(noType.map((c) => c.name))].join(", ")}`);
  for (const [t, max] of Object.entries(F.trigCaps)) {
    const n = count((c) => c.trigger === t);
    if (n > max) errs.push(`Max ${max} ${typeof TRIG !== "undefined" && TRIG[t] ? TRIG[t].name.toLowerCase() : t} triggers (${n})`);
  }
  if (!F.standTrigger && count((c) => c.trigger === "stand")) errs.push("Stand triggers are not allowed in this format");
  if (count((c) => c.sentinel) > 4) errs.push("Max 4 sentinels");
  if (count((c) => c.regalis) > 1) errs.push("Max 1 Regalis Piece");
  if (count((c) => c.ace) > 1) errs.push("Max 1 Ace Unit (CR 14.56)");
  const names = {};
  both.forEach((c) => (names[c.name] = (names[c.name] || 0) + 1));
  Object.entries(names).forEach(([n, k]) => { if (k > 4) errs.push(`"${n}": ${k} copies (max 4${F.rideDeck ? " incl. ride deck" : ""})`); });
  // card pool
  const all = [...both, ...gcards];
  if (F.poolIcon) {
    const bad = [...new Set(all.filter((c) => iconOf(c) && iconOf(c) !== F.poolIcon).map((c) => c.name))];
    if (bad.length) errs.push(`Not ${F.poolIcon}-icon cards (not legal in ${F.label}): ${bad.slice(0, 4).join(", ")}${bad.length > 4 ? "…" : ""}`);
    const unknown = all.filter((c) => !iconOf(c)).length;
    if (unknown) errs.push(`${unknown} card(s) have no format icon set (D / V). Set it in the card editor`);
  }
  // one nation / one clan
  const pool = all.filter((c) => !isNeutral(c));
  if (F.identity === "nation") {
    const ns = [...new Set(pool.map(cardNation).filter(Boolean))];
    if (ns.length > 1) errs.push(`One nation only: ${ns.join(", ")}`);
  } else if (F.identity === "clan") {
    const cs = [...new Set(pool.map(cardClan).filter(Boolean))];
    if (cs.length > 1) errs.push(`One clan only: ${cs.join(", ")}`);
  } else if (F.identity === "clanPremium") {
    // one clan; D-icon cards must belong to that clan's nation (Deck Construction Rules)
    const old = pool.filter((c) => iconOf(c) !== "D"), d = pool.filter((c) => iconOf(c) === "D");
    const cs = [...new Set(old.map(cardClan).filter(Boolean))];
    if (cs.length > 1) errs.push(`One clan only: ${cs.join(", ")}`);
    const home = cs.length === 1 ? CLAN_NATION[fmtNorm(cs[0])] : null;
    const ns = [...new Set(d.map(cardNation).filter(Boolean))];
    if (home && ns.some((n) => n !== home)) errs.push(`D cards must be from ${home} (the ${cs[0]} nation)`);
    else if (!home && ns.length > 1) errs.push(`One nation only for D cards: ${ns.join(", ")}`);
  }
  // restriction list
  if (F.restrictions) {
    const R = Restrictions.of(formatOf(deck));
    for (const r of R.list) {
      const n = names[r.name] || 0;
      if (!n && r.rule !== "noFV") continue;
      if (r.rule === "banned" && n) errs.push(`"${r.name}" is restricted (banned) in ${F.label}`);
      if ((r.rule === "1" || r.rule === "2") && n > +r.rule) errs.push(`"${r.name}" is restricted to ${r.rule}`);
      if (r.rule === "noFV") {
        const fv = F.rideDeck ? byId[(deck.ride || [])[0]] : byId[deck.starter];
        if (fv && fv.name === r.name) errs.push(`"${r.name}" can't be the first vanguard`);
      }
    }
    for (const group of R.choice) {
      const used = group.filter((nm) => names[nm]);
      if (used.length > 1) errs.push(`Choice restriction: only one of ${used.join(", ")}`);
    }
  }
  return errs;
}
