// Official card text → card fields + ability blocks (Ability Language v2). Reader v2.
// It reads clause by clause. A clause it can't read is never dropped: it becomes a ✋ Manual step with that
// sentence, so the card still plays (by hand) and the editor's text check shows what to finish.
// Always check the result in the editor (Text check panel) before saving.

const TextParse = (() => {
  const numWord = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, any: 99 };
  const toNum = (s) => (s == null ? 1 : numWord[String(s).toLowerCase()] ?? (parseInt(String(s).replace(/,/g, ""), 10) || 1));
  const N = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)";
  const rx = (s, f = "i") => new RegExp(s, f);

  // ---------- stats (unchanged from v1) ----------
  function stats(text) {
    const out = {};
    const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };
    const g = grab(/grade\s*[:\-]\s*(\d)/i); if (g !== null) out.grade = +g;
    const p = grab(/power\s*[:\-]\s*([\d,]+)/i); if (p) out.power = +p.replace(/,/g, "");
    const sh = grab(/shield\s*[:\-]\s*([\d,]+)/i); if (sh) out.shield = +sh.replace(/,/g, "");
    const c = grab(/critical\s*[:\-]\s*(\d)/i); if (c) out.crit = +c;
    const n = grab(/nation\s*[:\-]\s*([^\n/|]+)/i); if (n) out.nation = n;
    const r = grab(/race\s*[:\-]\s*([^\n/|]+)/i); if (r) out.race = r;
    const t = text.match(/\b(critical|front|draw|heal|over|stand)\s+trigger\b/i);
    if (t && !/\[(auto|act|cont)\]/i.test(text.slice(0, t.index))) { out.trigger = t[1].toLowerCase(); out.type = "trigger"; }
    if (/(^|\n|\]:?)\s*sentinel\b/i.test(text)) out.sentinel = true;
    if (/persona ride/i.test(text)) out.persona = true;
    if (/(normal|blitz|set)\s+order/i.test(text)) out.type = "order";
    // keyword flags on their own lines
    const kw = (re) => rx(`(^|\\n|\\]:)\\s*\\[?${re}\\]?\\b`).test(text);
    if (kw("forerunner")) out.forerunner = true;
    if (kw("lord")) out.lord = true;
    if (kw("resist")) out.resist = true;
    if (kw("harmony")) out.harmony = true;
    if (/this card cannot be called/i.test(text)) out.cantBeCalled = true;
    if (/regalis piece/i.test(text)) out.regalis = true;
    if (/ace unit/i.test(text)) out.ace = true;
    if (/ultimate stride/i.test(text)) out.ultimate = true;
    if (/\(this card is a ticket card/i.test(text)) out.ticket = true;
    return out;
  }

  // ---------- normalising ----------
  const norm = (s) => String(s || "").replace(/\r/g, "").replace(/［/g, "[").replace(/］/g, "]").replace(/（/g, "(").replace(/）/g, ")")
    .replace(/\[COST\]\s*\[([^\]]*)\]\s*&\s*((?:[^\[\]]|\[[^\]]*\])*)\]/gi, "[COST][$1 & $2]")
    .replace(/&\s*Rest\]\s*this unit\]/gi, "& [Rest] this unit]").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/　/g, " ")
    .replace(/\[\s*(power|critical|shield)\s*\]\s*([+-])\s*/gi, (m, a, b) => `[${a[0].toUpperCase() + a.slice(1).toLowerCase()}] ${b}`)
    .replace(/counter-?blast\s*\(?(\d+)\)?/gi, "Counter-Blast $1").replace(/soul-?blast\s*\(?(\d+)\)?/gi, "Soul-Blast $1")
    .replace(/energy-?blast\s*\(?(\d+)\)?/gi, "Energy-Blast $1").replace(/counter-?charge\s*\(?(\d+)\)?/gi, "Counter-Charge $1")
    .replace(/soul-?charge\s*\(?(\d+)\)?/gi, "Soul-Charge $1").replace(/energy-?charge\s*\(?(\d+)\)?/gi, "Energy-Charge $1")
    .replace(/\[cost\]\s*\[\s*\]/gi, "")
    .replace(/\((?:this ability is active|active on|active if|when a unit of the same clan|you may only have|this card is regarded|this card cannot|it will not be retired|the locked card|a unit with)[^()]*(?:\([^()]*\)[^()]*)*\)/gi, "")
    .replace(/\((?![^()]*\b(?:VC|RC|GC)\b\)$)[^()]{26,}(?:\([^()]*\)[^()]*)*\)/g, (m) => (/^\((VC|RC|GC|\[)/.test(m) ? m : ""))
    .replace(/\[(soul-charge|counter-charge|energy-charge) (\d+)\]/gi, "$1 $2")
    .replace(/((?:counter|soul)-blast \d+)\s*[-‐–]\s*(?:card|cards) with "[^"]*" in (?:its|their) card names?/gi, "$1")
    .replace(/ +/g, " ");

  // ---------- filters ("grade 3 or greater normal unit with "X" in its card name") ----------
  function filt(t) {
    const f = {};
    let m;
    if ((m = t.match(/grade (\d) or (less|lower)/i))) f.gmax = +m[1];
    else if ((m = t.match(/grade (\d) or (greater|higher|more)/i))) f.gmin = +m[1];
    else if ((m = t.match(/\bgrade (\d)\b/i))) { f.gmin = +m[1]; f.gmax = +m[1]; }
    if ((m = t.match(/with "([^"]+)" in (its|their) (different )?card names?/i))) f.name = m[1];
    else if ((m = t.match(/(?:card|unit)s? named "([^"]+)"/i)) || (m = t.match(/^"([^"]+)"$/))) f.nameExact = m[1];
    if ((m = t.match(/<+([^>]+)>+/))) f.clan = m[1].trim();
    if (/same card name as (your|the) vanguard/i.test(t)) f.sameNameVC = true;
    if (/\bother\b/i.test(t)) f.other = true;
    if (/normal units?/i.test(t)) f.ctype = "unit";
    else if (/trigger units?/i.test(t)) f.ctype = "trigger";
    else if (/\borders?\b/i.test(t) && !/units?/i.test(t)) f.ctype = "order";
    else if (/\bunits?\b/i.test(t) && /cards?/i.test(t) === false && /grade/i.test(t)) f.ctype = "anyunit";
    if ((m = t.match(/\b(critical|front|draw|heal|over|stand) triggers?\b/i))) f.trig = m[1].toLowerCase();
    else if (/\btrigger units? or more|non-trigger|without a trigger/i.test(t)) f.trig = "none";
    if (/\bsentinels?\b/i.test(t)) f.sentinel = "yes";
    if ((m = t.match(/\[([A-Za-z!' ]+)\] state/))) f.state = m[1];
    if (/\brested\b|\[rest\] state/i.test(t)) f.restState = "rest";
    if (/with the same grade as (your|the) vanguard/i.test(t)) f.gradeVC = "eq";
    if (/grade (lower|less) than (your|the) vanguard/i.test(t)) f.gradeVC = "lt";
    return Object.keys(f).length ? f : undefined;
  }

  // ---------- targets ("choose up to two of your rear-guards in the back row") ----------
  function targetOf(t) {
    let m;
    const opp = /opponent'?s|his or her|their/i.test(t);
    if (/^\s*(this unit|this card|it itself)\b/i.test(t) && !/choose/i.test(t)) return { target: "self" };
    if (/all of your opponent'?s (front row )?rear-guards/i.test(t)) return { target: "chooseOppRC", n: 99, all: true };
    if (/all of your front row units/i.test(t)) return { target: "allFront" };
    if (/all of your front row rear-guards/i.test(t)) return { target: "allFrontRC" };
    if (/all of your (other )?rear-guards/i.test(t)) return { target: "allMyRC" };
    if (/all of your (other )?units/i.test(t)) return { target: "allMyUnits" };
    if ((m = t.match(rx(`choose (up to )?${N} of (your opponent'?s|your) (.*?)(rear-guards?|units?|vanguards?)\\b(.*)`)))) {
      const n = toNum(m[2]), mine = !/opponent/i.test(m[3]), what = m[5].toLowerCase(), mid = m[4] + " " + (m[6] || "");
      const front = /front row/i.test(mid), back = /back row/i.test(mid), col = /same column/i.test(mid);
      let target;
      if (what.startsWith("vanguard")) target = mine ? "vc" : "chooseOppUnit";
      else if (what.startsWith("rear-guard")) target = mine ? (front ? "chooseMyFrontRC" : back ? "chooseMyBackRC" : "chooseMyRC") : (col ? "chooseOppColumn" : front ? "chooseOppFrontRC" : "chooseOppRC");
      else target = mine ? "chooseMy" : "chooseOppUnit";
      const f = filt(mid + " " + what);
      return { target, n, filter: f, upTo: !!m[1] };
    }
    if (/your vanguard/i.test(t)) return { target: "vc" };
    if (/this unit|this card/i.test(t)) return { target: "self" };
    return opp ? { target: "chooseOppUnit", n: 1 } : { target: "self" };
  }
  const durOf = (t) => (/until end of (your opponent'?s|the opponent'?s) turn/i.test(t) ? "oppTurn" : /until end of your next turn/i.test(t) ? "nextTurn"
    : /until end of (that|the) battle/i.test(t) ? "battle" : /until end of (the|this) fight/i.test(t) ? "game" : "turn");

  // ---------- timings ----------
  // [regex, event, zone hint, extra {conds, whenFilter, whenFrom}]
  const EVENTS = [
    [/when (this unit|this card) is put on \(vc\)|when this unit is put on your \(vc\)/i, "placedVC", "VC"],
    [/when (this unit|this card) is put on \(rc\)|when this unit is put on your \(rc\)/i, "placedRC", "RC"],
    [/when (this unit|this card) is put on \(gc\)/i, "placedGC", "GC"],
    [/when (this card|this unit) is put into (your )?soul/i, "toSoul", "soul"],
    [/when this unit intercepts/i, "intercepts", "RC"],
    [/when this unit'?s drive check reveals (an? )?(.*?)(card|unit)?\b,/i, "driveReveal", "VC", { subject: 2 }],
    [/when the attack (this unit|it) boosted hits a vanguard/i, "boostHit", "RC", { conds: [{ type: "targetVC" }] }],
    [/when the attack (this unit|it) boosted hits/i, "boostHit", "RC"],
    [/when it boosts/i, "boost", "RC"],
    [/when an attack hits during the battle (that )?(this unit|it) (attacked|boosted)/i, "attackHit", null],
    [/when your (.*?)vanguard(?: with "[^"]*" in its card name)?'?s attack hits( a vanguard)?/i, "allyHit", null, { subjectVC: true }],
    [/during your end phase/i, "endTurn", null],
    [/when an attack hits a vanguard/i, "attackHit", null, { conds: [{ type: "targetVC" }] }],
    [/when your g unit (?:\[stride\]|strides?)|when your vanguard \[stride\]s?|when this unit \[stride\]s?/i, "onStride", "VC"],
    [/when an attack hits a vanguard during the battle (that|this) unit (attacked|boosted)/i, "attackHit", null, { conds: [{ type: "targetVC" }] }],
    [/when (the attack of )?(a|your) (.*?)(unit|vanguard|rear-guard) (that this unit boosted )?hits/i, "attackHit", null],
    [/when (this unit is|this card is) placed on \(vc\) from (your )?ride deck/i, "placedVC", "VC", { whenFrom: "rideDeck" }],
    [/when (this unit is|this card is) placed on \(vc\)|when this unit is (ridden|rode)\b(?! upon)|when placed on \(vc\)/i, "placedVC", "VC"],
    [/when (this unit is |)(?:rode|ridden) upon by (an? )?(.+?)(?=,)/i, "riddenUpon", "VC", { subject: 3 }],
    [/when (this unit is |)rode upon|when (this unit is |)ridden upon|when your (.+?) rides this unit|when (?:another|an?) (.+?) rides this unit/i, "riddenUpon", "VC"],
    [/when (this unit is |this card is |)placed on \(rc\) from (your )?hand|when placed (on \(rc\) )?from (your )?hand/i, "placedRC", "RC", { whenFrom: "hand" }],
    [/when (this unit is |this card is |)placed on \(rc\) other than from (your )?hand/i, "placedRC", "RC", { whenFrom: "notHand" }],
    [/when (this unit is |this card is |)placed (?:on \(rc\) )?from (your )?(deck|drop zone|drop|soul|bind zone)/i, "placedRC", "RC", { whenFromGroup: 3 }],
    [/when (this unit|this card) is placed on \(rc\)|when placed on \(rc\)/i, "placedRC", "RC"],
    [/when (this unit|this card) is placed on \(gc\)|when placed on \(gc\)/i, "placedGC", "GC"],
    [/when (this unit|this card) is placed\b|when placed\b/i, "placed", null],
    [/when your (other )?(.*?)(rear-guards?|units?) (is|are) placed on( your)? \(rc\)|when another (.*?) is placed on your \(rc\)/i, "allyPlacedRC", "RC", { subject: 2 }],
    [/when your opponent'?s (.*?)rear-guards? (is|are) placed|when your opponent calls/i, "oppPlacedRC", null, { subject: 1 }],
    [/at the beginning of your main phase/i, "mainStart", null],
    [/at the beginning of your battle phase/i, "battleStart", null],
    [/at the beginning of the guard step|at the beginning of your opponent'?s guard step/i, "guardStart", null],
    [/at the beginning of your (ride phase|turn|stand phase|draw phase)/i, "turnStart", null],
    [/at the beginning of your opponent'?s (turn|ride phase)/i, "oppTurnStart", null],
    [/at the end of the battle (that |this unit |it )?(this unit |it )?(attacked|boosted)/i, "battleEnd", null],
    [/at the end of the battle/i, "battleEnd", null],
    [/when (this unit'?s|its|the) attack (that this unit boosted |)hits a vanguard/i, "attackHit", null, { conds: [{ type: "targetVC" }] }],
    [/when (this unit'?s|its|the) attack (that this unit boosted |)hits/i, "attackHit", null],
    [/when (this unit'?s|its) attack does not hit|when the attack this unit .* does not hit/i, "attackNoHit", null],
    [/when this unit boosts( a vanguard)?/i, "boost", "RC"],
    [/when this unit is boosted/i, "boosted", null],
    [/when this unit is attacked/i, "attacked", null],
    [/when (this unit|it) attacks a vanguard/i, "attack", null, { conds: [{ type: "targetVC" }] }],
    [/when (this unit|it) attacks a rear-guard/i, "attack", null],
    [/when (this unit|it) attacks/i, "attack", null],
    [/when your (.*?)(vanguard|unit|rear-guard)(?: with "[^"]*" in its card name)? attacks/i, "allyAttacks", null, { subjectWhole: true }],
    [/when your opponent'?s (.*?)(vanguard|unit|rear-guard) attacks/i, "oppAttacks", null],
    [/at the end of your opponent'?s turn/i, "oppTurnEnd", null],
    [/at the end of (your|that|the) turn|at the end of turn/i, "endTurn", null],
    [/when (this unit|this card) is retired/i, "retired", "RC"],
    [/when your (other )?(.*?)rear-guards? (is|are) retired/i, "allyRetired", null, { subject: 2 }],
    [/when your opponent'?s (.*?)rear-guards? (is|are) retired/i, "oppRetired", null, { subject: 1 }],
    [/when (this card is )?discarded from (your )?hand|when this card is discarded/i, "discarded", "hand"],
    [/when (this card is )?put into (your |the )?soul/i, "toSoul", "soul"],
    [/when your drive check reveals (an? )?(.*?)(card|unit)?\b,/i, "driveReveal", null, { subject: 2 }],
    [/when (this card is )?revealed (for|in) a drive check/i, "revealedDrive", "any"],
    [/when your damage check reveals (an? )?(.*?)(card|unit)?\b,/i, "damageReveal", null, { subject: 2 }],
    [/when (this card is )?revealed (for|in) a damage check/i, "revealedDamage", "any"],
    [/when you play an? (.*?)order/i, "orderPlayed", null, { subject: 1 }],
    [/when (your g unit|this unit) strides|when (this unit|this card) is placed on \(vc\) by stride|when your vanguard strides/i, "onStride", "VC"],
    [/when this unit is put on \(rc\) with (x)?overdress|when placed by (x)?overdress/i, "dressed", "RC"],
    [/when (this card is )?unlocked/i, "unlocked", "RC"],
  ];
  // the timing clause: from the start of the body up to the comma that closes it
  function timing(body) {
    for (const [re, when, zone, extra = {}] of EVENTS) {
      const m = body.match(re);
      if (!m || m.index > 40) continue;
      const after = body.slice(m.index + m[0].length);
      const close = after.search(/,/);
      const clause = body.slice(0, m.index + m[0].length + (close >= 0 ? close : 0));
      const rest = close >= 0 ? after.slice(close + 1) : after;
      const ab = { when, zoneHint: zone, conds: [...(extra.conds || [])] };
      if (extra.whenFrom) ab.whenFrom = extra.whenFrom;
      if (extra.whenFromGroup) ab.whenFrom = { deck: "deck", drop: "drop", "drop zone": "drop", soul: "soul", "bind zone": "bind" }[m[extra.whenFromGroup].toLowerCase()];
      if (extra.subject && m[extra.subject] && m[extra.subject].trim()) { const wf = filt(m[extra.subject]); if (wf) ab.whenFilter = wf; }
      if (extra.subjectVC) { const wf = filt(m[0].replace(/^when your /i, "").replace(/'?s attack hits.*$/i, "")) || {}; ab.whenFilter = wf; ab.conds.push({ type: "unit", who: "attacker", filter: { ...wf } }); }
      if (extra.subjectWhole) { const wf = filt(m[0].replace(/^when your /i, "").replace(/ attacks$/i, "")); if (wf) ab.whenFilter = wf; }
      if (when === "riddenUpon" && !extra.subject && (m[3] || m[4])) { const wf = filt(m[3] || m[4]); if (wf) ab.whenFilter = wf; }
      return { ...ab, clause, rest: rest.trim() };
    }
    return null;
  }

  // ---------- conditions ("if …", "during your turn", "[Limit Break 4]") ----------
  const COUNT_ZONES = [["your soul", "mySoul"], ["your drop( zone)?", "myDrop"], ["your hand", "myHand"], ["your damage zone", "myDamage"], ["your bind zone", "myBind"],
    ["your order zone", "myOrderZone"], ["your g zone", "myGUp"], ["your opponent'?s damage zone", "oppDamage"], ["your opponent'?s hand", "oppHand"], ["your opponent'?s soul", "oppSoul"],
    ["your opponent'?s drop( zone)?", "oppDrop"], ["your crest zone", "myCrest"]];
  const CMP = (s) => (/or (more|greater)/i.test(s) ? "ge" : /or (less|fewer)/i.test(s) ? "le" : "eq");
  function condsIn(t) {
    const out = [];
    let m, read = 0;
    const add = (c, len) => { out.push(c); read += len || 1; };
    if (/during your turn/i.test(t) && !/opponent/i.test(t.match(/during your[^,]*turn/i)[0])) add({ type: "myTurn" });
    if (/during your opponent'?s turn/i.test(t)) add({ type: "oppTurn" });
    if ((m = t.match(/limit-?break (\d)/i))) add({ type: "limitBreak", n: +m[1] });
    if ((m = t.match(/generation break (\d)/i))) add({ type: "genBreak", n: +m[1] });
    if ((m = t.match(/ritual (\d)/i))) add({ type: "ritual", n: +m[1] });
    if ((m = t.match(/if you have an? (vanguard )?(?:with|named) "([^"]+)"/i)) || (m = t.match(/if your vanguard is "([^"]+)"/i)) || (m = t.match(/vanguard with "([^"]+)" in its card name/i)))
      add({ type: "vcName", text: m[m.length - 1] });
    if ((m = t.match(/if (?:you have a |your vanguard is (?:an? )?)grade (\d)( or greater)?( vanguard)?/i))) add({ type: "vcGrade", n: +m[1] });
    if ((m = t.match(/(?:if )?your opponent'?s vanguard is (?:an? )?grade (\d)( or greater)?/i))) add({ type: "oppVcGrade", n: +m[1] });
    if ((m = t.match(/if (you have an?|your vanguard is an?) <+([^>]+)>+ vanguard|if your vanguard is an? <+([^>]+)>+/i))) add({ type: "unit", who: "vc", filter: { clan: (m[2] || m[3]).trim() } });
    if ((m = t.match(rx(`if you have ${N} or (more|less|fewer) (other )?(.*?)units?\\b`)))) add({ type: "count", what: "myUnits", op: CMP(m[0]), n: toNum(m[1]), filter: filt(m[4] + (m[3] ? " other" : "")) });
    if ((m = t.match(rx(`if you have ${N} or (more|less|fewer) (other )?(.*?)rear-guards?`)))) add({ type: "count", what: "myRC", op: CMP(m[0]), n: toNum(m[1]), filter: filt(m[4] + (m[3] ? " other" : "")) });
    if ((m = t.match(rx(`if your opponent has ${N} or (more|less|fewer) rear-guards?`)))) add({ type: "count", what: "oppRC", op: CMP(m[0]), n: toNum(m[1]) });
    for (const [z, what] of COUNT_ZONES) {
      if ((m = t.match(rx(`if ${z} has ${N} or (more|less|fewer) (.*?)(cards?|units?)\\b`))) || (m = t.match(rx(`if the number of (.*?)cards? in ${z} is ${N} or (more|less|fewer)`)))) {
        const nIdx = m[0].startsWith("if the number") ? m.length - 2 : z.includes("(") ? 3 : 2;
        const filterText = m[0].startsWith("if the number") ? m[1] : m[m.length - 2];
        add({ type: "count", what, op: CMP(m[0]), n: toNum(m[nIdx]), filter: filt(filterText || "") });
        break;
      }
    }
    if (!out.length && (m = t.match(/if your (soul|drop|drop zone|hand|order zone|damage zone|bind zone) has an? (.*?)(card|unit|order)\b/i)))
      add({ type: "count", what: { soul: "mySoul", drop: "myDrop", "drop zone": "myDrop", hand: "myHand", "order zone": "myOrderZone", "damage zone": "myDamage", "bind zone": "myBind" }[m[1].toLowerCase()], op: "ge", n: 1, filter: filt(m[2] + m[3]) });
    if ((m = t.match(/if you have a (.*?)(card|unit) in your (soul|drop|hand)/i))) add({ type: "count", what: { soul: "mySoul", drop: "myDrop", hand: "myHand" }[m[3].toLowerCase()], op: "ge", n: 1, filter: filt(m[1]) });
    if ((m = t.match(/if you have an? (?:card|unit) named "([^"]+)" in your (soul|drop|hand|damage zone)/i)))
      add({ type: "count", what: { soul: "mySoul", drop: "myDrop", hand: "myHand", "damage zone": "myDamage" }[m[2].toLowerCase()], op: "ge", n: 1, filter: { nameExact: m[1] } });
    else if ((m = t.match(/if you have an? (?:card|unit) named "([^"]+)"/i))) add({ type: "count", what: "myUnits", op: "ge", n: 1, filter: { nameExact: m[1] } });
    if (!out.some((c) => c.type === "vcName" || c.type === "unit") && (m = t.match(/if you have an? (.*?)(vanguard|rear-guard|unit)\b(?! in your)/i)) && !/named/i.test(m[1]))
      add(/vanguard/i.test(m[2]) ? { type: "unit", who: "vc", filter: filt(m[1]) } : { type: "count", what: /rear-guard/i.test(m[2]) ? "myRC" : "myUnits", op: "ge", n: 1, filter: filt(m[1]) });
    if ((m = t.match(/if you have a heart card (?:with "([^"]+)" in its card name|named "([^"]+)"|(.*?))(?:,|$)/i))) add({ type: "heart", filter: m[1] ? { name: m[1] } : m[2] ? { nameExact: m[2] } : filt(m[3] || "") || {} });
    if (/persona rode/i.test(t)) add({ type: "persona" });
    if (/played an? (.*?)order this turn/i.test(t)) add({ type: "playedOrder" });
    if (!out.some((c) => c.type === "vcName") && (m = t.match(/your vanguard is .*?with "([^"]+)" in its card name/i))) add({ type: "vcName", text: m[1] });
    if (/if you went second/i.test(t)) add({ type: "wentSecond" });
    if (/if you went first/i.test(t)) add({ type: "wentFirst" });
    if (/if your vanguard is in legion|\[legion\]/i.test(t)) add({ type: "legion" });
    if (/overdress state|if this unit is in overdress/i.test(t)) add({ type: "dressed" });
    if ((m = t.match(/if it is the (second|third|fourth|fifth|\d+)(st|nd|rd|th)? battle of (that|the) turn( or (more|later))?/i)))
      add({ type: "count", what: "battleNo", op: m[4] ? "ge" : "eq", n: { second: 2, third: 3, fourth: 4, fifth: 5 }[m[1].toLowerCase()] || +m[1] });
    if ((m = t.match(/if you are in "([^"]+)"/i))) add({ type: "world", text: m[1] });
    if ((m = t.match(/if this unit is in the \[([^\]]+)\] state|if this unit is (engorged|successful|in harmony)/i))) add({ type: "unit", who: "self", filter: { state: (m[1] || m[2]).replace(/^in /, "") } });
    if ((m = t.match(/if (this unit'?s|your vanguard'?s) \[power\] is (\d+) or (greater|more)/i))) add({ type: "power", who: /vanguard/i.test(m[1]) ? "vc" : "self", op: "ge", n: +m[2] });
    if (/if you have (another unit|a unit) in the same column/i.test(t)) add({ type: "count", what: "myColumn", op: "ge", n: 1 });
    if (/if this unit is in the front row/i.test(t)) add({ type: "selfFront" });
    if (/if this unit is in the back row/i.test(t)) add({ type: "selfBack" });
    if ((m = t.match(/if your order zone has (\d+) or more/i))) add({ type: "orderZone", n: +m[1] });
    return { conds: out, read };
  }

  // ---------- costs ("[COST][Counter-Blast 1 & discard a card from your hand]") ----------
  function costsIn(s) {
    const out = [], unread = [];
    for (const part of s.split(/\s*&\s*/)) {
      const p = part.trim().replace(/^\[|\]$/g, "");
      if (!p) continue;
      let m;
      if ((m = p.match(/^counter-blast (\d+)/i))) out.push({ type: "CB", n: +m[1] });
      else if ((m = p.match(/^soul-blast (\d+)/i))) out.push({ type: "SB", n: +m[1] });
      else if ((m = p.match(/^energy-blast (\d+)/i))) out.push({ type: "EB", n: +m[1] });
      else if ((m = p.match(rx(`^(?:choose ${N} (.*?)(?:cards? )?from your hand,? and )?discard (them|it|${N} (.*?)cards? from (your )?hand|this card)`)))) {
        if (/this card/i.test(m[3])) out.push({ type: "move", from: "self", to: "drop" });
        else out.push({ type: "discard", n: toNum(m[1] || m[4]), filter: filt((m[2] || "") + " " + (m[5] || "")) });
      } else if (/^put this unit into (your )?soul/i.test(p)) out.push({ type: "selfToSoul" });
      else if (/^retire this unit/i.test(p)) out.push({ type: "retireSelf" });
      else if (/^\[?rest\]? this unit/i.test(p)) out.push({ type: "restSelf" });
      else if ((m = p.match(rx(`^retire ${N} (of your )?(other )?(.*?)rear-guards?`)))) out.push({ type: "retireRC", n: toNum(m[1]) });
      else if ((m = p.match(rx(`^choose (${N}) (.*?)cards? from your hand,? and reveal (it|them)`)))) out.push({ type: "move", from: "hand", to: "hand", n: toNum(m[1]), reveal: true, filter: filt(m[3]) });
      else if ((m = p.match(rx(`^choose (${N}) (.*?)cards? from your hand,? and put (it|them) into (your )?soul`)))) out.push({ type: "move", from: "hand", to: "soul", n: toNum(m[1]), filter: filt(m[3]) });
      else if ((m = p.match(rx(`^(?:choose (${N}) face down (.*?)cards? (?:from|in) your g zone,? and )?turn (?:it|them|(${N}) cards? (?:from|in) your g zone) face up`)))) out.push({ type: "gFaceUp", n: toNum(m[1] || m[4] || 1), filter: filt(m[2] || "") });
      else if ((m = p.match(/^(counter|soul)-blast$/i))) out.push({ type: m[1].toLowerCase() === "counter" ? "CB" : "SB", n: 1 });
      else if ((m = p.match(rx(`^reveal (${N} |a |an )?(.*?)cards? from your hand`)))) out.push({ type: "move", from: "hand", to: "hand", n: 1, reveal: true, filter: filt(m[2] || "") });
      else if ((m = p.match(rx(`^put ${N} (.*?)cards? from (your )?hand into (your )?soul`)))) out.push({ type: "move", from: "hand", to: "soul", n: toNum(m[1]), filter: filt(m[2]) });
      else if ((m = p.match(/^(bind|put) this (card|unit)( into| on the)? ?(bind zone|bottom of (your|the) deck|top of (your|the) deck|soul|drop)?/i)))
        out.push({ type: "move", from: "self", to: /^bind/i.test(p) || /bind/i.test(m[4] || "") ? "bind" : /bottom/i.test(p) ? "deckBottom" : /top/i.test(p) ? "deckTop" : /soul/i.test(p) ? "soul" : "drop" });
      else if ((m = p.match(rx(`^put ${N} (.*?)cards? from your drop( zone)? on the (top|bottom) of (your|the) deck`)))) out.push({ type: "move", from: "drop", to: m[4].toLowerCase() === "top" ? "deckTop" : "deckBottom", n: toNum(m[1]), filter: filt(m[2]) });
      else if ((m = p.match(rx(`^(?:choose ${N} (.*?)cards? from your drop,? and )?put them on the bottom of (the|your) deck`)))) out.push({ type: "move", from: "drop", to: "deckBottom", n: toNum(m[1]), filter: filt(m[2] || "") });
      else unread.push(p);
    }
    return { costs: out, unread };
  }

  // ---------- effects: one clause at a time ----------
  // ctx.last = the target of the previous "choose …" clause (for "and it/they get …")
  function effectOf(c, ctx) {
    const t = c.trim().replace(/^(and|then|also)\s+/i, "").replace(/^you may\s+/i, "").replace(/[.!]$/, "");
    if (!t) return [];
    let m;
    const dur = /until end of/i.test(t) ? durOf(t) : ctx.dur || durOf(t);
    const per = (() => {
      const pm = t.match(/for each (.*?)(card|unit)s? in (your (?:opponent'?s )?(soul|drop|hand|damage zone|bind zone|g zone|order zone))|for each of your (.*?)(rear-guards|units)/i);
      if (!pm) return {};
      if (pm[6]) return { per: pm[7] === "units" ? "myUnits" : "myRC", perFilter: filt(pm[6]) };
      const z = pm[3].toLowerCase();
      const what = (COUNT_ZONES.find(([re]) => rx(`^${re}$`).test(z)) || [])[1] || "mySoul";
      return { per: what, perFilter: filt(pm[1]) };
    })();
    // "it / they / that unit": the first time it means the choice itself, after that the units already chosen
    const useLast = () => { if (ctx.lastUsed) return { target: "thatUnit" }; ctx.lastUsed = true; return { ...ctx.last }; };
    const it = (fallback = { target: "self" }) => (/\b(it|they|them|that unit|those units)\b/i.test(t) && ctx.last ? useLast() : fallback);
    const who = () => (/^(this unit|this card)\b/i.test(t) ? { target: "self" } : /^(it|they|that unit|those units|these units|those|the chosen units?|that card)\b/i.test(t) && ctx.last ? useLast() : targetOf(t));
    // choose … (sets the target for "and it/they …")
    if ((m = t.match(rx(`^choose (up to )?${N} of (your|your opponent'?s) .*?(rear-guards?|units?|vanguards?)`))) && !/,/.test(t)) { ctx.last = targetOf(t); ctx.lastUsed = false; return []; }
    if (/^choose (one of )?your vanguards?$/i.test(t)) { ctx.last = { target: "vc" }; return []; }
    // stats
    const outs = [];
    if ((m = t.match(/\[Power\] ([+-])\s*([\d,]+)/i))) outs.push({ type: "power", amount: (m[1] === "-" ? -1 : 1) * +m[2].replace(/,/g, ""), dur, ...who(), ...per });
    if ((m = t.match(/\[Critical\] \+\s*(\d+)/i))) outs.push({ type: "crit", amount: +m[1], dur, ...who(), ...per });
    if ((m = t.match(/\[Shield\] \+\s*([\d,]+)/i)) && !/\[Power\]/i.test(t)) outs.push({ type: "shield", amount: +m[1].replace(/,/g, "") });
    if ((m = t.match(/drive ([+-])(\d+)/i))) outs.push({ type: "drive", amount: (m[1] === "-" ? -1 : 1) * +m[2] });
    if (outs.length) return outs;
    // resources
    if ((m = t.match(rx(`^draw ${N} cards?`))) || (m = t.match(/^draw (a|one) card/i))) return [{ type: "draw", n: toNum(m[1]), ...per }];
    if ((m = t.match(/^counter-charge (\d+)/i))) return [{ type: "CC", n: +m[1], ...per }];
    if ((m = t.match(/^soul-charge (\d+)/i))) return [{ type: "SC", n: +m[1], ...per }];
    if ((m = t.match(/^energy-charge (\d+)/i))) return [{ type: "EC", n: +m[1], ...per }];
    // stand / rest / retire / bind / lock
    if (/^\[stand\] (this unit|it|them|that unit|your vanguard|all)/i.test(t)) return [{ type: "stand", ...(/this unit/i.test(t) ? { target: "self" } : /vanguard/i.test(t) ? { target: "vc" } : it()) }];
    if (/^\[rest\] (this unit)$/i.test(t)) return [{ type: "rest", target: "self" }];
    if (/^\[rest\] (it|them|that unit|this unit)/i.test(t)) return [{ type: "rest", ...(/this unit/i.test(t) ? { target: "self" } : it()) }];
    if (/^retire (it|them|that unit|those units)$/i.test(t) && ctx.last) return [{ type: "retire", ...useLast() }];
    if (/^retire (this unit)$/i.test(t)) return [{ type: "retire", target: "self" }];
    if ((m = t.match(/^retire all of your opponent'?s (front row |back row )?rear-guards/i))) return [{ type: "move", from: m[1] && /front/i.test(m[1]) ? "oppFrontRC" : "oppRC", to: "drop", all: true }];
    if ((m = t.match(rx(`^retire (up to )?${N} of your opponent'?s (.*?)rear-guards?`)))) return [{ type: "retire", target: /front row/i.test(m[3]) ? "chooseOppFrontRC" : "chooseOppRC", n: toNum(m[2]), filter: filt(m[3]) }];
    if (/^bind (it|them|that unit)$/i.test(t) && ctx.last) return [{ type: "bind", ...ctx.last }];
    if (/^lock (it|them|that unit)$/i.test(t) && ctx.last) return [{ type: "lock", ...ctx.last }];
    if (/^delete (it|your opponent'?s vanguard)/i.test(t)) return [{ type: "delete", target: "chooseOppUnit" }];
    // opponent chooses and retires / discards
    if ((m = t.match(rx(`^your opponent chooses (up to )?${N} of (his or her|their) (.*?)rear-guards?,? and retires? (it|them)`)))) return [{ type: "move", from: "oppRC", to: "drop", n: toNum(m[2]), upTo: !!m[1], chooser: "opp", filter: filt(m[4]) }];
    if ((m = t.match(rx(`^your opponent chooses (up to )?${N} (.*?)cards? from (his or her|their) hand,? and discards? (it|them)`)))) return [{ type: "move", from: "oppHand", to: "drop", n: toNum(m[2]), upTo: !!m[1], chooser: "opp", filter: filt(m[3]) }];
    // look at the top N … choose … put into hand / call / soul (+ rest)
    if ((m = t.match(rx(`^look at (the top )?${N} cards? (from the top )?of your deck`)))) { ctx.look = { n: toNum(m[2]) }; return []; }
    if (/^look at the top card of your deck$/i.test(t)) { ctx.look = { n: 1 }; return []; }
    if ((m = t.match(rx(`^look at up to ${N} cards? from the top of your deck`)))) { ctx.look = { n: toNum(m[1]) }; return []; }
    if (ctx.look && /^put (it|them) on the top or bottom of (your|the) deck/i.test(t)) { const L = ctx.look; ctx.look = null; return [{ type: "move", from: "deckTop", look: L.n, n: L.n, upTo: true, to: "deckBottom", rest: "top" }]; }
    if ((m = t.match(rx(`^reveal the top (${N} )?cards? of your deck`)))) { ctx.look = { n: m[2] ? toNum(m[2]) : 1, reveal: true }; return []; }
    if (ctx.look && /^(you may )?call (it|that card|them) to( an open)? \(rc\)$/i.test(t)) { const L = ctx.look; const e = { type: "move", from: "deckTop", look: L.n, n: L.pick || 1, upTo: true, to: "RC", filter: L.filter, rest: "top" }; ctx.lookMove = e; return [e]; }
    if (ctx.look && (m = t.match(rx(`^(?:choose|reveal|search for) (up to )?${N} (.*?)(?:cards?|units?|orders?)? from among them`)))) { ctx.look.pick = toNum(m[2]); ctx.look.upTo = !!m[1]; ctx.look.filter = filt(m[3]); return []; }
    if (ctx.look && /^(reveal (it|them),? and )?(put (it|them) into (your )?hand|call (it|them) to( an open)? \(rc\)|put (it|them) into (your )?soul|put (it|them) into (your )?drop|put (it|them) on the (top|bottom) of (your|the) deck)/i.test(t)) {
      const to = /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : /soul/i.test(t) ? "soul" : /drop/i.test(t) ? "drop" : /bottom/i.test(t) ? "deckBottom" : "deckTop";
      const L = ctx.look;
      const e = { type: "move", from: "deckTop", look: L.n, n: L.pick || 1, upTo: L.upTo !== false, to, filter: L.filter, reveal: /reveal/i.test(t), rest: "shuffle" };
      ctx.lookMove = e;
      return [e];
    }
    if (ctx.pick && /^put (it|them) on the top or bottom of (your|the) deck/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: P.from, to: "deckBottom", n: P.n, upTo: P.upTo, filter: P.filter }]; }
    if (ctx.lookMove && /^put the rest (on the (top or )?(bottom|top) of (your|the) deck|into (your )?(drop|soul))/i.test(t)) {
      ctx.lookMove.rest = /bottom/i.test(t) ? "bottom" : /top/i.test(t) ? "top" : /drop/i.test(t) ? "drop" : "soul";
      return [];
    }
    if (/^shuffle (your|the) deck$/i.test(t)) return [];
    if (ctx.last && /^(put|return) (it|them|that unit|those units) (into (your |his or her |their )?(soul|hand|drop)|to (your |his or her |their |its owner'?s )?hand|on the (top|bottom) of (your|his or her|their|the) deck)/i.test(t)) {
      const L = ctx.last, opp = /Opp/.test(L.target || "");
      const to = /soul/i.test(t) ? "soul" : /hand/i.test(t) ? "hand" : /drop/i.test(t) ? "drop" : /bottom/i.test(t) ? "deckBottom" : "deckTop";
      return [{ type: "move", from: opp ? (/Front/.test(L.target) ? "oppFrontRC" : "oppRC") : /Front/.test(L.target || "") ? "myFrontRC" : /Back/.test(L.target || "") ? "myBackRC" : "myRC", to, n: L.all ? 1 : L.n || 1, all: !!L.all, upTo: !!L.upTo, filter: L.filter }];
    }
    if (/^reveal it(,| and)?$|^reveal it to your opponent$/i.test(t)) return [];
    // search the deck
    if ((m = t.match(rx(`^search (?:your deck |your deck and drop |your deck or drop (?:zone )?|your deck and drop zone )for (up to )?${N} (.*?)(?:cards?|units?|orders?)?(?: from your deck)?(?:,|$)`)))) { ctx.search = { n: toNum(m[2]), upTo: !!m[1], filter: filt(m[3]) }; return []; }
    if (ctx.search && /^discard (it|them)$/i.test(t)) { const S2 = ctx.search; ctx.search = null; return [{ type: "move", from: "deck", to: "drop", n: S2.n, upTo: true, filter: S2.filter }]; }
    if (ctx.search && /^(reveal (it|them)(,| and| to your opponent,? and)? )?(put (it|them) into (your )?hand|call (it|them) to( an open)? \(rc\)|put (it|them) into (your )?soul)/i.test(t)) {
      const s = ctx.search; ctx.search = null;
      return [{ type: "move", from: "deck", to: /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : "soul", n: s.n, upTo: true, filter: s.filter, reveal: /reveal/i.test(t) }];
    }
    // choose … from your drop / soul / damage zone / hand → hand / RC / soul / deck
    if ((m = t.match(rx(`^choose (up to )?${N} (.*?)(?:cards?|units?)? from (your|your opponent'?s) (drop( zone)?|soul|damage zone|hand|bind zone)`)))) {
      const zone = m[5].toLowerCase().replace(" zone", "").replace("damage", "damage").replace("bind", "bind");
      ctx.pick = { from: (/opponent/i.test(m[4]) ? "opp" + zone[0].toUpperCase() + zone.slice(1) : zone).replace(/^oppDrop$/, "oppDrop"), n: toNum(m[2]), upTo: !!m[1], filter: filt(m[3]) };
      const tail = t.slice(m[0].length);
      if (!tail.trim()) return [];
      return effectOf(tail.replace(/^,?\s*(and )?/, ""), ctx);
    }
    if (ctx.pick && /^(reveal it,? and )?(put (it|them) into (your )?(hand|soul|drop)|call (it|them) to( an open)? \(rc\)|put (it|them) on the (top|bottom) of (your|the) deck|bind (it|them)|put (it|them) into (your )?damage zone)/i.test(t)) {
      const P = ctx.pick; ctx.pick = null;
      const to = /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : /soul/i.test(t) ? "soul" : /bottom/i.test(t) ? "deckBottom" : /top/i.test(t) ? "deckTop" : /bind/i.test(t) ? "bind" : /damage/i.test(t) ? "damageUp" : "drop";
      return [{ type: "move", from: P.from, to, n: P.n, upTo: P.upTo, filter: P.filter }];
    }
    if (ctx.pick && /^(heal (it|them))$/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: "damage", to: "drop", n: P.n }]; }
    if (ctx.pick && /^discard (it|them)$/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: P.from, to: "drop", n: P.n, upTo: P.upTo, filter: P.filter }]; }
    if (ctx.pick && /^put (it|them) into (your )?drop$/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: P.from, to: "drop", n: P.n, upTo: P.upTo, filter: P.filter }]; }
    if ((m = t.match(rx(`^discard ${N} (.*?)cards? from your hand`)))) return [{ type: "move", from: "hand", to: "drop", n: toNum(m[1]), filter: filt(m[2]) }];
    if (/^bind (it|them)$/i.test(t) && ctx.pick) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: P.from, to: "bind", n: P.n, upTo: P.upTo, filter: P.filter }]; }
    if ((m = t.match(/^call this card to (a |an |your )?(back row |front row )?(open )?\(rc\)/i))) return [{ type: "move", from: "self", to: "RC" }];
    if ((m = t.match(rx(`^your opponent chooses (up to )?${N} (.*?)cards? from (his or her|their) (hand|drop|soul|damage zone)$`)))) { ctx.pick = { from: "opp" + m[5][0].toUpperCase() + m[5].slice(1).replace(" zone", ""), n: toNum(m[2]), upTo: !!m[1], filter: filt(m[3]), chooser: "opp" }; return []; }
    if ((m = t.match(rx(`^your opponent chooses (up to )?${N} of (his or her|their) (.*?)rear-guards?$`)))) { ctx.pick = { from: "oppRC", n: toNum(m[2]), upTo: !!m[1], filter: filt(m[4]), chooser: "opp" }; return []; }
    if (ctx.pick && ctx.pick.chooser === "opp" && /^(discards?|retires?|puts?|binds?) (it|them)( into (his or her|their) (soul|drop|hand))?/i.test(t)) {
      const P = ctx.pick; ctx.pick = null;
      return [{ type: "move", from: P.from, to: /soul/i.test(t) ? "soul" : /hand/i.test(t) ? "hand" : /bind/i.test(t) ? "bind" : "drop", n: P.n, upTo: P.upTo, filter: P.filter, chooser: "opp" }];
    }
    // call from hand
    if ((m = t.match(rx(`^call (up to )?${N} (.*?)(?:cards?|units?)? from (your )?hand to \\(rc\\)`)))) return [{ type: "callFromHand", n: toNum(m[2]), filter: filt(m[3]) }];
    // top of the deck → soul / damage / drop
    if ((m = t.match(rx(`^put the top (${N} )?cards? of your deck into (your )?(soul|drop|damage zone)`)))) return [{ type: "move", from: "deckTop", look: m[2] ? toNum(m[2]) : 1, n: m[2] ? toNum(m[2]) : 1, all: true, to: /soul/i.test(m[4]) ? "soul" : /drop/i.test(m[4]) ? "drop" : "damageUp" }];
    if ((m = t.match(rx(`^put (this unit|this card) into (your )?(soul|hand|drop)`)))) return [{ type: "move", from: "self", to: m[3].toLowerCase() }];
    if ((m = t.match(/^return (this unit|this card) to (your )?hand/i))) return [{ type: "move", from: "self", to: "hand" }];
    if ((m = t.match(/^put (it|them|that unit) on the (top|bottom) of (your|the|his or her|their) deck/i)) && ctx.last) return [{ type: "move", from: ctx.last.target && ctx.last.target.includes("Opp") ? "oppRC" : "myRC", to: m[2].toLowerCase() === "top" ? "deckTop" : "deckBottom", n: ctx.last.n || 1, filter: ctx.last.filter }];
    // restrictions / rules
    if (/cannot be hit/i.test(t)) return [{ type: "cantBeHit" }];
    if ((m = t.match(/^your opponent cannot call (.*?)(?:cards?|units?) (from (his or her|their) hand )?to \(gc\)/i))) return [{ type: "playerRule", who: "opp", what: "cantGuard", dur, filter: filt(m[1]) }];
    if (/^your opponent cannot intercept/i.test(t)) return [{ type: "playerRule", who: "opp", what: "cantIntercept", dur }];
    if ((m = t.match(/(this unit|it|they) cannot (attack|boost|intercept|be attacked|stand)/i))) return [{ type: "restrict", what: { attack: "cantAttack", boost: "cantBoost", intercept: "cantIntercept", "be attacked": "cantBeAttacked", stand: "cantStand" }[m[2].toLowerCase()], dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if (/gets? \[resist\]/i.test(t)) return [{ type: "restrict", what: "resist", dur, ...it({ target: "self" }) }];
    // tokens / tickets / states / ride / misc
    if ((m = t.match(rx(`^call (up to )?${N} "?([^"]+?)"? tokens? to (an open |your )?\\(rc\\)`)))) return [{ type: "token", name: m[3].trim(), n: toNum(m[2]), where: m[4] && /open/i.test(m[4]) ? "empty" : "any" }];
    if ((m = t.match(/^put an? "?([^"]+?)"? ticket into (your )?hand/i))) return [{ type: "ticket", name: m[1].trim(), n: 1, who: "me" }];
    if ((m = t.match(/(?:it|they|this unit) becomes? (?:in )?(?:the )?\[([^\]]+)\] state/i))) return [{ type: "setState", name: m[1], dur, ...it({ target: "self" }) }];
    if ((m = t.match(/^ride (it|this card) as \[(stand|rest)\]/i))) return [{ type: "rideBy", from: ctx.pick ? ctx.pick.from : "self", stand: /stand/i.test(m[2]) }];
    if (/^heal$/i.test(t)) return [{ type: "heal", n: 1 }];
    return null; // not read
  }

  // split an ability body into clauses: ", and", ", then", ". ", "," but not inside quotes or brackets
  function clauses(s) {
    const out = [];
    let depth = 0, q = false, cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') q = !q;
      if (!q && (ch === "[" || ch === "(")) depth++;
      if (!q && (ch === "]" || ch === ")")) depth = Math.max(0, depth - 1);
      if (!q && depth === 0 && (ch === "," || (ch === "." && s[i + 1] === " "))) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }

  // ---------- one ability ----------
  const ZONES = { vc: "VC", rc: "RC", "vc/rc": "VC/RC", gc: "GC", "vc/rc/gc": "VC/RC", hand: "hand", drop: "drop", "drop zone": "drop", soul: "soul", "damage zone": "damage", damage: "damage", "bind zone": "bind", "g zone": "G", "order zone": "OZ", "crest zone": "crest" };
  function ability(raw, kindHint, extraAbs) {
    const text = norm(raw);
    const head = text.match(/^\[(AUTO|ACT|CONT)\]\s*(?:\(([^)]*)\)|\[(soul|hand|drop|drop zone|damage zone|bind zone|g zone)\]|([A-Za-z ]+zone)(?=:))?/i);
    const kind = head ? head[1].toUpperCase() : kindHint || "AUTO";
    const zw = head && (head[2] || head[3] || head[4]);
    const zone = zw ? ZONES[zw.toLowerCase().trim()] : null;
    let rest = head ? text.slice(head[0].length) : text;
    const ab = { kind, zone: zone || (kind === "ORDER" || kind === "BLITZ" ? undefined : "VC"), once: "", conds: [], costs: [], effects: [] };
    if (kind === "ORDER" || kind === "BLITZ") delete ab.zone;
    const unread = [];
    if (/this ability cannot be used for the rest of (that|the) turn/i.test(rest)) { ab.once = "turn"; rest = rest.replace(/,?\s*this ability cannot be used for the rest of (that|the) turn\.?/i, ""); }
    // limits and labels before the colon: [1/Turn] [Limit Break 4] [Generation Break 2] [Divine Skill] …
    const pre = rest.match(/^((?:\s*\[[^\]]*\])*)\s*:?/);
    if (pre) {
      const tags = pre[1];
      if (/\[1\/turn\]/i.test(tags)) ab.once = "turn";
      if (/\[1\/fight\]|\[1\/game\]/i.test(tags)) ab.once = "game";
      if (/\[divine skill\]/i.test(tags)) ab.once = "divine";
      if (/\[unique skill\]/i.test(tags)) ab.once = "unique";
      ab.conds.push(...condsIn(tags).conds);
      rest = rest.slice(pre[0].length).trim();
    }
    rest = rest.replace(/^:\s*/, "");
    // old style cost right after the colon: "[Counter-Blast 1] When this unit attacks, you may pay the cost. If you do, …"
    let m = rest.match(/^\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*/);
    if (m && !/(blast|discard|retire|rest|soul|bind|put|reveal|choose|turn)/i.test(m[1])) m = null;
    if (m) { const r = costsIn(m[1]); ab.costs.push(...r.costs); unread.push(...r.unread); rest = rest.slice(m[0].length); }
    // leading "during your (opponent's) turn," before the timing
    const lead = rest.match(/^during your (opponent'?s )?turn,\s*/i);
    if (lead) { ab.conds.push({ type: lead[1] ? "oppTurn" : "myTurn" }); rest = rest.slice(lead[0].length); }
    // timing
    if (kind === "AUTO") {
      const tm = timing(rest);
      if (tm) {
        ab.when = tm.when;
        if (tm.when === "placed") { ab.when = zone === "GC" ? "placedGC" : zone === "VC" ? "placedVC" : zone === "RC" ? "placedRC" : "placed"; if (!zone) ab.zone = "VC/RC"; }
        if (!zone && tm.zoneHint) ab.zone = tm.zoneHint;
        if (tm.whenFrom) ab.whenFrom = tm.whenFrom;
        if (tm.whenFilter) ab.whenFilter = tm.whenFilter;
        ab.conds.push(...tm.conds);
        rest = tm.rest;
      } else { ab.when = "attack"; unread.push("timing: " + rest.split(",")[0]); }
    }
    rest = rest.replace(/you may pay the cost\.? if you do,?/i, "").replace(/^play this with\s*/i, "").trim();
    // new style cost: [COST][…]
    m = rest.match(/\[COST\]\s*\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*,?/i);
    let condText = "";
    if (m) {
      condText = rest.slice(0, m.index);
      const r = costsIn(m[1]); ab.costs.push(...r.costs); unread.push(...r.unread.map((u) => "cost: " + u));
      rest = rest.slice(m.index + m[0].length);
    }
    // conditions: "if …, " clauses before the effects (and before the cost)
    const cl = clauses(rest.replace(/^\s*[,!.]\s*/, "").replace(/^play this with\s*[,!]?\s*/i, ""));
    const effectClauses = [];
    for (const c of [...clauses(condText), ...cl]) {
      if (/^(if|during|when|play this (only )?if)\b/i.test(c) && !/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid)\b|^if not\b/i.test(c)) {
        const r = condsIn(c);
        if (r.conds.length) { ab.conds.push(...r.conds); continue; }
        if (/^during your turn/i.test(c)) continue;
      }
      effectClauses.push(c);
    }
    // "choose / perform one of the following ・A ・B": the bullets become options A, B, C…
    const optParts = rest.split(/\s*・\s*/);
    let optClauses = [];
    if (optParts.length > 1 && /(choose|perform|activate) (one|two|three|\d|up to \w+|any number) of the (following|effects below)/i.test(optParts[0])) {
      const n = toNum((optParts[0].match(/(one|two|three|\d)\s+of the/i) || [])[1] || 1);
      ab.effects.push({ type: "chooseOpts", n });
      optClauses = optParts.slice(1).map((p, i) => ({ letter: "ABCDEF"[i], cl: clauses(p) }));
      const before = optParts[0].replace(/,?\s*(choose|perform|activate) (one|two|three|\d|up to \w+|any number) of the (following|effects below)[^,]*\.?$/i, "");
      effectClauses.splice(0, effectClauses.length, ...clauses(before).filter((c) => !/^(if|during)\b/i.test(c)));
    }
    // effects
    const ctx = {};
    let onlyIf = "";
    let later = "", ifCond = null;
    for (const c of effectClauses) {
      let t = c.replace(/^(and then|and|then|also)\s+/i, "");
      if (/^(and|then|and then|also)$/i.test(c)) continue;
      // "at the end of that battle / turn, …": the following steps happen then
      const lt = t.match(/^at the end of (that|this|the) (battle|turn)$/i);
      if (lt) { later = lt[2].toLowerCase(); continue; }
      // "…, and if your opponent's vanguard is grade 3 or greater, …": a condition for the following steps
      if (/^if\b/i.test(t) && !/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid)\b/i.test(t)) {
        const r = condsIn(t);
        if (r.conds.length === 1) { ifCond = r.conds[0]; continue; }
      }
      // "until end of turn, this unit gets …": the duration comes first
      if (/^(until end of (turn|that battle|the battle|your opponent'?s turn|your next turn|the fight|this fight))$/i.test(t)) { ctx.dur = durOf(t); continue; }
      const iff = t.match(/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid)( not)?\b[^,]*?(?=,|$)/i);
      if (iff && /^if you (do|did)( not)?$/i.test(iff[0])) { onlyIf = iff[2] ? "didNot" : "did"; t = t.slice(iff[0].length).replace(/^,?\s*/, ""); if (!t) continue; }
      else if (iff) { onlyIf = iff[2] ? "didNot" : "did"; t = t.slice(iff[0].length).replace(/^,?\s*/, ""); if (!t) continue; }
      // a quoted ability given to units: "… gets "[AUTO](RC):…" until end of turn"
      const q = t.match(/gets? "(\[(AUTO|ACT|CONT)\][^"]+)"/i);
      if (q) {
        const g = ability(q[1], undefined, extraAbs);
        g.granted = true;
        extraAbs.push(g);
        ab.effects.push({ type: "grant", ability: -extraAbs.length, dur: durOf(t), ...(/this unit/i.test(t) ? { target: "self" } : ctx.last || { target: "self" }) });
        const powerToo = t.replace(q[0], "");
        const more = /\[(Power|Critical)\]/i.test(powerToo) ? effectOf(powerToo, ctx) : [];
        if (more) ab.effects.push(...more);
        continue;
      }
      const es = effectOf(t, ctx);
      if (es === null) { ab.effects.push({ type: "manual", text: c.replace(/^and\s+/i, "") }); continue; }
      for (const e of es) { if (onlyIf) e.onlyIf = onlyIf; if (later) e.later = later; if (ifCond) e.ifCond = ifCond; ab.effects.push(e); }
      if (es.length) onlyIf = onlyIf && /^(and|then)\b/i.test(c) ? onlyIf : onlyIf; // stays for the rest of the sentence
    }
    for (const o of optClauses) {
      const octx = {};
      for (const c of o.cl) {
        const es = effectOf(c, octx);
        if (es === null) ab.effects.push({ type: "manual", text: c, opt: o.letter });
        else es.forEach((e) => ab.effects.push({ ...e, opt: o.letter }));
      }
    }
    if (kind === "AUTO" && !/\byou may\b|\[COST\]/i.test(text) && !ab.costs.length) ab.mandatory = true;
    if (kind === "CONT") {
      ab.effects = ab.effects.map((e) => (e.type === "power" || e.type === "crit") ? (({ dur, ...x }) => x)(e) : e);
    }
    // merge consecutive manual steps into one
    const merged = [];
    for (const e of ab.effects) {
      const prev = merged[merged.length - 1];
      if (e.type === "manual" && prev && prev.type === "manual") prev.text += ", " + e.text; else merged.push(e);
    }
    ab.effects = merged;
    if (!ab.effects.length && !unread.length && kind !== "CONT") ab.effects.push({ type: "manual", text: text.replace(/^\[[^\]]*\]\s*(\([^)]*\))?:?/, "").slice(0, 200) });
    // never guess a timing: an AUTO whose timing wasn't read becomes a button with the whole text to do by hand
    if (unread.some((u) => u.startsWith("timing:"))) {
      ab.kind = "ACT";
      delete ab.when; delete ab.mandatory;
      ab.costs = []; ab.conds = [];
      ab.effects = [{ type: "manual", text: "Timing not read, do it at the right moment: " + text.replace(/^\[[^\]]*\]\s*(\([^)]*\))?:?/, "").slice(0, 300) }];
    } else if (unread.length) ab.effects.unshift({ type: "manual", text: "Also pay: " + unread.map((u) => u.replace(/^cost: /, "")).join(" & ") });
    if (unread.length) ab.unread = unread;
    return ab;
  }

  // ---------- split full text into abilities ----------
  // "[AUTO]…draw a card. [CONT](RC):…" on one line → two abilities (never inside quotes: "gets "[AUTO]…"")
  function splitAbilities(l) {
    const out = [];
    let q = false, start = 0;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === '"') q = !q;
      if (!q && i > start && /^\[(AUTO|ACT|CONT)\]/i.test(l.slice(i, i + 6)) && /[.!)\]]\s*$/.test(l.slice(start, i))) { out.push(l.slice(start, i).trim()); start = i; }
    }
    out.push(l.slice(start).trim());
    return out.filter(Boolean);
  }
  const KEYWORD_LINE = /^(\(.*\)|sentinel\b.*|forerunner\b.*|lord\b.*|\[?resist\]?.*|harmony\b.*|boost|intercept|twin drive!*|triple drive!*|persona ride.*|imaginary gift.*|regalis piece.*|ace unit.*|\[?(x)?overdress\]?.*|\[stride\].*|\[g guardian\].*|\[ultimate stride\].*|-$|.*\(this card is a ticket card.*\))$/i;
  function abilities(text, isOrder) {
    text = norm(text);
    const lines = [];
    for (const raw of text.split("\n")) {
      const l = raw.trim();
      if (!l) continue;
      if (/^[・•]/.test(l) && lines.length) lines[lines.length - 1] += " ・" + l.replace(/^[・•]\s*/, "");
      else lines.push(...splitAbilities(l));
    }
    const extraAbs = [];
    const out = [];
    if (isOrder) {
      const body = lines.filter((l) => !KEYWORD_LINE.test(l) && !/^\[(auto|act|cont)\]/i.test(l)).join(" ");
      const blitz = /blitz order/i.test(text);
      if (body) out.push(ability(body, blitz ? "BLITZ" : "ORDER", extraAbs));
    }
    for (const l of lines) {
      if (!/^\[(auto|act|cont)\]/i.test(l)) continue;
      const body = l.replace(/^\[(auto|act|cont)\]\s*(\([^)]*\))?\s*(\[[^\]]*\])*\s*:?\s*/i, "");
      if (/^(sentinel|forerunner|lord|boost|intercept|resist|harmony|restraint)\b\s*\.?\s*$/i.test(body)) continue; // a keyword: card field
      if (/^[A-Z][A-Za-z!'‐-]{2,20}( \d+)?\s*$/.test(body)) continue; // a keyword label only (Engorge, Blaze, Success 20000…): its effect is in other lines
      out.push(ability(l, undefined, extraAbs));
    }
    // granted abilities go after the normal ones; fix the "ability number" of grant steps
    const all = [...out, ...extraAbs];
    for (const ab of out) for (const e of ab.effects) if (e.type === "grant" && e.ability < 0) e.ability = out.length + (-e.ability);
    for (const ab of extraAbs) for (const e of ab.effects) if (e.type === "grant" && e.ability < 0) e.ability = out.length + (-e.ability);
    return all;
  }

  function parse(text, hint = {}) {
    const s = stats(norm(text));
    const isOrder = s.type === "order" || /order/i.test(hint.type || "");
    if (isOrder) s.type = "order";
    return { ...s, abilities: abilities(text, isOrder) };
  }
  return { parse, stats, abilities, filt, condsIn, costsIn };
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
