// Best-effort reader for official-style card text → card fields + ability blocks.
// It guesses; always check the purple preview lines in the editor before saving.

const TextParse = (() => {
  const numWord = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  const toNum = (s) => (s == null ? 1 : numWord[String(s).toLowerCase()] ?? (parseInt(String(s).replace(/,/g, ""), 10) || 1));
  const NUM = "(\\d+|a|an|one|two|three|four|five|six|seven)";
  const COST_RE = /\[COST\]\s*\[(.+?)\](?=\s*[,.])/i;

  // ---------- stats ----------
  function stats(text) {
    const out = {};
    const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };
    const g = grab(/grade\s*[:\-]?\s*(\d)/i); if (g !== null) out.grade = +g;
    const p = grab(/power\s*[:\-]?\s*([\d,]+)/i); if (p) out.power = +p.replace(/,/g, "");
    const sh = grab(/shield\s*[:\-]?\s*([\d,]+)/i); if (sh) out.shield = +sh.replace(/,/g, "");
    const c = grab(/critical\s*[:\-]?\s*(\d)/i); if (c) out.crit = +c;
    const n = grab(/nation\s*[:\-]\s*([^\n/|]+)/i); if (n) out.nation = n;
    const r = grab(/race\s*[:\-]\s*([^\n/|]+)/i); if (r) out.race = r;
    const t = text.match(/\b(critical|front|draw|heal|over)\s+trigger\b/i);
    if (t) { out.trigger = t[1].toLowerCase(); out.type = "trigger"; }
    if (/\bsentinel\b/i.test(text)) out.sentinel = true;
    if (/persona ride/i.test(text)) out.persona = true;
    if (/(normal|blitz|set)\s+order/i.test(text)) out.type = "order";
    return out;
  }

  // ---------- one ability ----------
  const EVENTS = [
    [/when this unit is placed on \(vc\)|when this unit is ridden|when this card is placed on \(vc\)/i, "placedVC", "VC"],
    [/when this unit is ridden upon|when ridden upon/i, "riddenUpon", "VC"],
    [/when (this unit|this card) is placed on \(rc\)/i, "placedRC", "RC"],
    [/when your other (rear-guard|unit) is placed on \(rc\)|when another .* is placed on your \(rc\)/i, "allyPlacedRC", "RC"],
    [/when (this unit|this card) is placed on \(gc\)|when placed on \(gc\)/i, "placedGC", "GC"],
    [/at the beginning of your main phase/i, "mainStart", null],
    [/at the beginning of your battle phase/i, "battleStart", null],
    [/at the beginning of your (ride phase|turn|stand phase)/i, "turnStart", null],
    [/at the end of the battle (that |this unit )?(this unit )?attacked/i, "battleEnd", null],
    [/when this unit'?s attack hits/i, "attackHit", null],
    [/when this unit boosts/i, "boost", null],
    [/when this unit is attacked/i, "attacked", null],
    [/when this unit attacks/i, "attack", null],
    [/at the end of (your|that) turn|at the end of turn/i, "endTurn", null],
  ];

  function conds(t) {
    const out = [];
    let m;
    if ((m = t.match(/vanguard with "([^"]+)" in its card name/i))) out.push({ type: "vcName", text: m[1] });
    if ((m = t.match(/if your vanguard is grade (\d)/i))) out.push({ type: "vcGrade", n: +m[1] });
    if ((m = t.match(/opponent'?s vanguard is grade (\d)/i))) out.push({ type: "oppVcGrade", n: +m[1] });
    if ((m = t.match(new RegExp(`if you have ${NUM} or more rear-guards`, "i")))) out.push({ type: "rearCount", n: toNum(m[1]) });
    if ((m = t.match(/your opponent'?s damage zone has (\d+) or more/i))) out.push({ type: "oppDamage", n: +m[1] });
    if ((m = t.match(/your damage zone has (\d+) or more/i))) out.push({ type: "myDamage", n: +m[1] });
    if ((m = t.match(/your soul has (\d+) or more/i))) out.push({ type: "soul", n: +m[1] });
    if ((m = t.match(/your drop has (\d+) or more/i))) out.push({ type: "drop", n: +m[1] });
    if (/persona rode this turn/i.test(t)) out.push({ type: "persona" });
    if (/played an order this turn/i.test(t)) out.push({ type: "playedOrder" });
    if (/during your turn/i.test(t)) out.push({ type: "myTurn" });
    if (/during your opponent'?s turn/i.test(t)) out.push({ type: "oppTurn" });
    if (/attacks? a vanguard/i.test(t)) out.push({ type: "targetVC" });
    return out;
  }

  function costs(t) {
    const m = t.match(COST_RE);
    if (!m) return [];
    const s = m[1], out = [];
    let x;
    if ((x = s.match(/counter-?blast\s*(\d+)/i))) out.push({ type: "CB", n: +x[1] });
    if ((x = s.match(/soul-?blast\s*(\d+)/i))) out.push({ type: "SB", n: +x[1] });
    if ((x = s.match(/energy-?blast\s*(\d+)/i))) out.push({ type: "EB", n: +x[1] });
    if ((x = s.match(new RegExp(`discard ${NUM} cards? from (your )?hand`, "i")))) out.push({ type: "discard", n: toNum(x[1]) });
    if (/put this unit into (your )?soul/i.test(s)) out.push({ type: "selfToSoul" });
    if (/retire this unit/i.test(s)) out.push({ type: "retireSelf" });
    if (/\[?rest\]? this unit/i.test(s)) out.push({ type: "restSelf" });
    if ((x = s.match(new RegExp(`retire ${NUM} of your (other )?rear-guards`, "i")))) out.push({ type: "retireRC", n: toNum(x[1]) });
    return out;
  }

  function target(t, oppOK = true) {
    if (/all of your front row units/i.test(t)) return { target: "allFront" };
    if (/all of your front row rear-guards/i.test(t)) return { target: "allFrontRC" };
    if (/all of your rear-guards/i.test(t)) return { target: "allMyRC" };
    if (/all of your units/i.test(t)) return { target: "allMyUnits" };
    const W = "[^,]*?"; // allows words like "grade 2" between "your" and "rear-guards"
    const pick = (re) => t.match(new RegExp(`choose (up to )?${NUM} of ${re}`, "i"));
    let m;
    if (oppOK && (m = pick(`your opponent'?s ${W}front row rear-guards`))) return { target: "chooseOppFrontRC", n: toNum(m[2]) };
    if (oppOK && (m = pick(`your opponent'?s ${W}rear-guards`))) return { target: "chooseOppRC", n: toNum(m[2]) };
    if (oppOK && (m = pick(`your opponent'?s ${W}units`))) return { target: "chooseOppUnit", n: toNum(m[2]) };
    if ((m = pick(`your ${W}front row rear-guards`))) return { target: "chooseMyFrontRC", n: toNum(m[2]) };
    if ((m = pick(`your ${W}back row rear-guards`))) return { target: "chooseMyBackRC", n: toNum(m[2]) };
    if ((m = pick(`your ${W}rear-guards`))) return { target: "chooseMyRC", n: toNum(m[2]) };
    if ((m = pick(`your ${W}vanguards`))) return { target: "vc" };
    if ((m = pick(`your ${W}units`))) return { target: "chooseMy", n: toNum(m[2]) };
    if (/this unit/i.test(t)) return { target: "self" };
    return { target: "self" };
  }
  function gradeFilter(t) {
    const f = {};
    let m;
    if ((m = t.match(/grade (\d) or less/i))) f.gmax = +m[1];
    if ((m = t.match(/grade (\d) or greater/i))) f.gmin = +m[1];
    if ((m = t.match(/\bgrade (\d)\b(?! or)/i))) { f.gmin = +m[1]; f.gmax = +m[1]; }
    if ((m = t.match(/with "([^"]+)" in (its|their) card names?/i))) f.name = m[1];
    if (/normal unit/i.test(t)) f.ctype = "unit";
    if (/order card/i.test(t)) f.ctype = "order";
    return Object.keys(f).length ? f : undefined;
  }

  function effects(t) {
    // only look at the part after the cost (if any)
    const cm = t.match(COST_RE);
    const body = cm ? t.slice(cm.index + cm[0].length) : t.replace(/^\[(AUTO|ACT|CONT)\][^:]*:/i, "");
    const out = [];
    const parts = body.split(/,?\s*(?:and then|then|\. )\s*/i);
    for (const p of parts) {
      let m;
      const dur = /end of (that|the) battle/i.test(p) ? "battle" : "turn";
      if ((m = p.match(/\[Power\]\s*\+\s*([\d,]+)/i))) out.push({ type: "power", amount: +m[1].replace(/,/g, ""), dur, ...target(p, false) });
      if ((m = p.match(/\[Critical\]\s*\+\s*(\d+)/i))) out.push({ type: "crit", amount: +m[1], dur, ...target(p, false) });
      if ((m = p.match(/drive\s*\+\s*(\d+)/i))) out.push({ type: "drive", amount: +m[1] });
      if ((m = p.match(new RegExp(`draw ${NUM} cards?`, "i")))) out.push({ type: "draw", n: toNum(m[1]) });
      if ((m = p.match(/counter-?charge\s*(\d+)/i))) out.push({ type: "CC", n: +m[1] });
      if ((m = p.match(/soul-?charge\s*(\d+)/i))) out.push({ type: "SC", n: +m[1] });
      if ((m = p.match(/energy-?charge\s*(\d+)/i))) out.push({ type: "EC", n: +m[1] });
      if (/\[Stand\]/i.test(p) && !/as \[Stand\]/i.test(p)) out.push({ type: "stand", ...target(p, false), filter: gradeFilter(p) });
      if (/\bretire (it|them)\b/i.test(p) || /,\s*retire\b/i.test(p)) out.push({ type: "retire", ...target(p), filter: gradeFilter(p) });
      if (/\bbind (it|them)\b/i.test(p)) out.push({ type: "bind", ...target(p), filter: gradeFilter(p) });
      if (/cannot be hit/i.test(p)) out.push({ type: "cantBeHit" });
      if ((m = p.match(/\[Shield\]\s*\+\s*([\d,]+)/i))) out.push({ type: "shield", amount: +m[1].replace(/,/g, "") });
      if ((m = p.match(new RegExp(`look at the top ${NUM} cards? of your deck`, "i")))) {
        const pick = p.match(new RegExp(`choose up to ${NUM}`, "i"));
        out.push({ type: "lookTop", n: toNum(m[1]), pick: pick ? toNum(pick[1]) : 1, filter: gradeFilter(p),
          dest: /call/i.test(body) ? "RC" : /soul/i.test(body) ? "soul" : "hand", rest: /bottom of/i.test(body) ? "bottom" : "shuffle" });
      }
      if ((m = p.match(new RegExp(`search your deck for up to ${NUM}`, "i")))) {
        out.push({ type: "search", from: "deck", n: toNum(m[1]), filter: gradeFilter(p), dest: /call/i.test(p) ? "RC" : "hand" });
      }
      if ((m = p.match(new RegExp(`choose (up to )?${NUM} .*?from your (drop|soul)`, "i")))) {
        out.push({ type: "search", from: m[3].toLowerCase(), n: toNum(m[2]), filter: gradeFilter(p), dest: /call/i.test(p) ? "RC" : /soul/i.test(p.split(/from your/i)[1] || "") ? "soul" : "hand" });
      }
      if (/heal/i.test(p) && /damage/i.test(p) && /choose .* damage zone/i.test(p)) out.push({ type: "heal", n: 1 });
    }
    return out;
  }

  function ability(chunk) {
    const head = chunk.match(/^\[(AUTO|ACT|CONT)\]\s*(\((VC\/RC|VC|RC|GC)\))?/i);
    let kind = head ? head[1].toUpperCase() : "AUTO";
    let zone = head && head[3] ? head[3].toUpperCase() : null;
    const ab = { kind, zone: zone || "VC", once: /\[1\/Turn\]/i.test(chunk) ? "turn" : /\[1\/Fight\]|\[1\/Game\]|regalis piece|divine skill/i.test(chunk) ? "game" : "",
      conds: [], costs: [], effects: [] };
    if (kind === "AUTO") {
      const ev = EVENTS.find(([re]) => re.test(chunk));
      ab.when = ev ? ev[1] : "attack";
      if (!zone && ev && ev[2]) ab.zone = ev[2];
    }
    ab.conds = conds(chunk);
    if (kind !== "CONT") ab.costs = costs(chunk);
    ab.effects = effects(chunk);
    if (kind === "CONT") ab.effects = ab.effects.filter((e) => e.type === "power" || e.type === "crit");
    return ab;
  }

  // Split full card text into abilities. Lines that start with [AUTO]/[ACT]/[CONT] begin a new ability.
  function abilities(text, isOrder) {
    const chunks = text.split(/(?=\[(?:AUTO|ACT|CONT)\])/i).map((s) => s.trim()).filter((s) => /^\[(AUTO|ACT|CONT)\]/i.test(s));
    const abs = chunks.map(ability);
    if (isOrder) {
      const body = text.replace(/^[\s\S]*?(normal|blitz) order[^\n]*\n?/i, "");
      const ab = ability(body);
      ab.kind = /blitz order/i.test(text) ? "BLITZ" : "ORDER";
      delete ab.zone; delete ab.when;
      ab.conds = conds(body);
      ab.costs = costs(body);
      ab.effects = effects(body);
      return [ab];
    }
    return abs;
  }

  function parse(text) {
    const s = stats(text);
    return { ...s, abilities: abilities(text, s.type === "order") };
  }
  return { parse, stats, abilities };
})();

// ---------- CSV ----------
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
const CSV_COLUMNS = ["name", "type", "grade", "power", "shield", "critical", "trigger", "sentinel", "persona", "nation", "race", "image", "text"];

// One CSV row → card object (abilities optionally guessed from the text column)
function cardFromRow(r, guessAbilities) {
  const yes = (v) => /^(1|y|yes|true|x)$/i.test(v || "");
  const trig = (r.trigger || "").toLowerCase().replace(/\s*trigger/, "").trim();
  const type = (r.type || "").toLowerCase().startsWith("order") ? "order" : trig ? "trigger" : "unit";
  const card = {
    name: r.name, type,
    grade: +r.grade || 0, power: +(r.power || "0").replace(/,/g, "") || 0, shield: +(r.shield || "0").replace(/,/g, "") || 0,
    crit: +r.critical || 1, trigger: ["crit", "critical", "front", "draw", "heal", "over"].includes(trig) ? (trig === "critical" ? "crit" : trig) : null,
    sentinel: yes(r.sentinel), persona: yes(r.persona), nation: r.nation || "", race: r.race || "", image: r.image || "", text: r.text || "",
    abilities: [],
  };
  if (guessAbilities && card.text) card.abilities = TextParse.abilities(card.text, type === "order");
  if (/\bsentinel\b/i.test(card.text)) card.sentinel = true;
  return card;
}
