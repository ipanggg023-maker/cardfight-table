// Card check: compares a card's official text with its ability blocks (no DOM).
// CardCheck.analyze(card) → { status, items, extraBlocks, counts }
//   status: "auto" (every text ability is built with blocks) · "manual" (uses a ✋ Manual block) ·
//           "gaps" (text not covered, numbers differ, or the text needs a block the game doesn't have yet) ·
//           "vanilla" (no text, no abilities) · "none" (text but no blocks at all)
//   items: one per text ability / keyword line: {text, kind, ab (block index or null), state: ok|warn|missing|flag|note, notes[]}
// Used by the editor (status badges, filter, the side-by-side text check). Update GAPS when the engine learns new blocks.
const CardCheck = (() => {
  const STATUS = {
    auto: { icon: "✅", label: "Automatic" },
    manual: { icon: "✋", label: "Uses Manual" },
    gaps: { icon: "⚠", label: "Needs work" },
    none: { icon: "◻", label: "No blocks yet" },
    vanilla: { icon: "·", label: "No abilities" },
  };
  // Patterns in card text that no block can do yet (from docs/abilities/catalogue.md). Remove a row when its block exists.
  // Covered since Ability Language v2 step 1–3: for each, if you did, choose one of the following, top/bottom of deck,
  // moves from drop/soul/bind, opponent chooses, went first/second, battle number (Move cards, counts, onlyIf, chooseOpts).
  const GAPS = [
    [/gets? "\[|gets all of the following|this card gets all/, "granted ability (gets \"[AUTO]…\")"],
    [/cannot (attack|boost|intercept|be chosen|be retired|be attacked|stand|be returned)/, "restriction (“cannot …”)"],
    [/cannot call|must call|cannot guard|must guard|cannot be guarded/, "call / guard restriction"],
    [/\bresist\b/, "Resist"],
    [/instead|would be (retired|put|bound)/, "replacement (“instead / would be”)"],
    [/(?<!st)ride (it|this card|that card) (as \[stand\]|from)|superior ride|(?<!st)ride .{0,40} from (your )?(deck|drop|soul)/, "ride by an effect"],
    [/same column|this unit's column/, "columns"],
    [/until end of (your opponent's turn|your next turn|the next turn)/, "duration until the opponent's / next turn"],
    [/\btoken\b|\bplant\b|shadow army|\bhollow\b/, "tokens"],
    [/ticket|quick shield/, "tickets"],
    [/\bforerunner\b/, "Forerunner"],
    [/\blord\b/, "Lord"],
    [/\bglitter\b/, "Glitter"],
    [/\britual \d/, "Ritual"],
    [/\[[a-z ]+ state\]|mental pollution|\bharmony\b|\bmelody\b/, "named states"],
    [/grade \+\d|is (also )?regarded as/, "grade change / regarded as"],
    [/deal \d+ damage|into (your|their|your opponent's) damage zone/, "deal damage"],
    [/when this card is discarded|when (this card is )?discarded from/, "timing: discarded"],
    [/is retired|are retired/, "timing: retired"],
    [/when (it|this unit) is boosted|when this unit is boosted/, "timing: is boosted"],
    [/drive check reveals|damage check reveals|revealed (for|in) a (drive|damage) check/, "timing: drive / damage check reveals"],
    [/does not hit|did not hit/, "timing: attack does not hit"],
    [/placed (on \(rc\) )?from (hand|your hand|deck|drop|soul)|other than from your hand/, "timing: placed from a zone"],
    [/when your opponent('s)? (calls?|would call|rear-guard is placed)/, "timing: opponent calls"],
    [/heart card|heart with/, "heart conditions"],
  ];
  const lower = (s) => String(s || "").toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  // one ability per line; bullet lines join the line before
  function textLines(text) {
    const out = [];
    for (const raw of String(text || "").replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^[・•]/.test(line) && out.length) out[out.length - 1] += " " + line;
      else out.push(line);
    }
    return out;
  }
  // keyword lines that card fields (not blocks) cover
  function flagLine(l, c) {
    if (/^\(.*\)$/.test(l)) return { note: "reminder text" };
    if (/^sentinel\b/.test(l)) return c.sentinel ? { ok: "Sentinel box" } : { warn: "Tick “Sentinel”" };
    if (/^persona ride/.test(l)) return c.persona ? { ok: "Persona Ride box" } : { warn: "Tick “Persona Ride”" };
    if (/^regalis piece/.test(l)) return c.regalis ? { ok: "Regalis box" } : { warn: "Tick “Regalis Piece”" };
    if (/^ace unit|^\[ace unit\]/.test(l)) return c.ace ? { ok: "Ace box" } : { warn: "Tick “Ace Unit”" };
    if (/^imaginary gift/.test(l)) return c.gift ? { ok: "Gift icon" } : { warn: "Pick the Imaginary Gift icon" };
    if (/^\[?ultimate stride\]?/.test(l)) return c.ultimate ? { ok: "Ultimate Stride box" } : { warn: "Tick “Ultimate Stride”" };
    if (/^\[stride\]/.test(l)) return c.type === "g" ? { ok: "G unit type" } : { warn: "Set the type to G unit" };
    if (/^\[g guardian\]/.test(l)) return c.type === "g" && c.gKind === "guardian" ? { ok: "G guardian kind" } : { warn: "Set type G unit + kind G guardian" };
    if (/^\[?xoverdress\]?/.test(l)) return c.xoverDress ? { ok: "XoverDress names" } : { warn: "Fill “XoverDress: needed rear-guards”" };
    if (/^\[?overdress\]?/.test(l)) return c.dress ? { ok: "overDress box" } : { warn: "Tick “overDress”" };
    if (/^(boost|intercept|twin drive|triple drive)\b/.test(l)) return { ok: "skill icon" };
    return null;
  }
  const kindOf = (l, c) => {
    const m = l.match(/^\[(auto|act|cont)\]/);
    if (m) return m[1].toUpperCase();
    if (c.type === "order") return /blitz/.test(lower(c.text)) ? "BLITZ" : "ORDER";
    return null;
  };
  // numbers in the text vs numbers in the blocks
  const nums = (l, re) => [...l.matchAll(re)].map((m) => +m[1]);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const costTotal = (ab, type) => sum((ab.costs || []).filter((r) => r.type === type).map((r) => +r.n || 1));
  function compare(l, ab) {
    const notes = [];
    const want = (label, textN, blockN) => { if (textN !== blockN) notes.push(`${label}: text ${textN}, blocks ${blockN}`); };
    want("Counter-Blast", sum(nums(l, /counter-?blast\s*\(?(\d+)/g)), costTotal(ab, "CB"));
    want("Soul-Blast", sum(nums(l, /soul-?blast\s*\(?(\d+)/g)), costTotal(ab, "SB"));
    want("Energy-Blast", sum(nums(l, /energy-?blast\s*\(?(\d+)/g)), costTotal(ab, "EB"));
    const eff = (type, key = "amount") => (ab.effects || []).filter((r) => r.type === type).map((r) => +r[key] || 0);
    for (const p of nums(l, /\[power\]\s*\+\s*(\d+)/g)) if (!eff("power").includes(p)) notes.push(`Power +${p} in the text, not in the blocks`);
    for (const p of nums(l, /\[critical\]\s*\+\s*(\d+)/g)) if (!eff("crit").includes(p)) notes.push(`Critical +${p} in the text, not in the blocks`);
    if (/draw (a|\d+) cards?/.test(l) && !(ab.effects || []).some((r) => r.type === "draw")) notes.push("The text draws, the blocks don't");
    if (/counter-?charge/.test(l) && !(ab.effects || []).some((r) => r.type === "CC")) notes.push("Counter-Charge in the text, not in the blocks");
    if (/soul-?charge/.test(l) && !(ab.effects || []).some((r) => r.type === "SC")) notes.push("Soul-Charge in the text, not in the blocks");
    // where it works and how often
    const z = (l.match(/^\[(?:auto|act|cont)\]\(([^)]*)\)/) || [])[1];
    const zone = { vc: "VC", rc: "RC", "vc/rc": "VC/RC", gc: "GC", "vc/rc/gc": "VC/RC" }[z || ""];
    if (zone && ab.zone && ab.zone !== zone && ab.zone !== "any") notes.push(`Zone: text (${z.toUpperCase()}), block ${ab.zone}`);
    if (/\[1\/turn\]/.test(l) && ab.once !== "turn") notes.push("Text says [1/Turn]; set Limit to 1/Turn");
    if (/\[1\/fight\]|once per fight/.test(l) && ab.once !== "game") notes.push("Text says once per fight; set Limit to 1/Game");
    if (/\[divine skill\]/.test(l) && ab.once !== "divine") notes.push("Text says Divine Skill; set the Limit");
    if (ab.kind === "AUTO" && ab.mandatory && /you may/.test(l)) notes.push("Text says “you may” but the block is Mandatory");
    return notes;
  }
  function gapsIn(l) {
    const eff = l.replace(/\[cost\]\[(?:[^\[\]]|\[[^\]]*\])*\]/g, " ").replace(/you may pay the cost\.? if you do,?/g, " ");
    return GAPS.filter(([re]) => re.test(eff)).map(([, label]) => label);
  }
  const usesManual = (ab) => (ab.effects || []).some((r) => r.type === "manual");

  const cache = new WeakMap();
  function analyze(c) {
    if (!c) return null;
    if (cache.has(c) && cache.get(c).text === c.text && cache.get(c).abJson === JSON.stringify(c.abilities)) return cache.get(c).res;
    const abs = c.abilities || [];
    const items = [];
    const used = new Set();
    let next = 0;
    for (const raw of textLines(c.text)) {
      const l = lower(raw);
      const f = flagLine(l, c);
      if (f) { items.push({ text: raw, kind: null, ab: null, state: f.note ? "note" : f.ok ? "flag" : "warn", notes: [f.ok || f.warn || f.note] }); continue; }
      const kind = kindOf(l, c);
      if (!kind) { items.push({ text: raw, kind: null, ab: null, state: "note", notes: ["no [AUTO]/[ACT]/[CONT] mark: check it by eye"] }); continue; }
      // pair with the next block of the same kind (orders: any order block)
      let i = abs.findIndex((ab, k) => k >= next && !used.has(k) && (ab.kind === kind || (kind === "ORDER" && ab.kind === "BLITZ") || (kind === "BLITZ" && ab.kind === "ORDER")));
      if (i < 0) i = abs.findIndex((ab, k) => !used.has(k) && ab.kind === kind);
      if (i < 0) { items.push({ text: raw, kind, ab: null, state: "missing", notes: ["No block for this ability yet", ...gapsIn(l).map((g) => "Needs: " + g)] }); continue; }
      used.add(i); next = i + 1;
      const ab = abs[i];
      const notes = compare(l, ab);
      const manual = usesManual(ab);
      if (!manual) notes.push(...gapsIn(l).map((g) => "Needs a block the game doesn't have yet: " + g));
      items.push({ text: raw, kind, ab: i, state: notes.length ? "warn" : "ok", manual, notes });
    }
    const extraBlocks = abs.map((_, i) => i).filter((i) => !used.has(i));
    let status;
    if (!items.some((it) => it.kind) && !abs.length) status = items.some((it) => it.state === "warn") ? "gaps" : "vanilla";
    else if (!abs.length) status = "none";
    else if (items.some((it) => it.state === "missing" || it.state === "warn")) status = "gaps";
    else if (abs.some(usesManual)) status = "manual";
    else status = "auto";
    const res = { status, items, extraBlocks };
    cache.set(c, { text: c.text, abJson: JSON.stringify(c.abilities), res });
    return res;
  }
  return { analyze, STATUS, GAPS, textLines };
})();
