// Official card text → card fields + ability blocks (Ability Language v2). Reader v2.
// It reads clause by clause. A clause it can't read is never dropped: it becomes a ✋ Manual step with that
// sentence, so the card still plays (by hand) and the editor's text check shows what to finish.
// Always check the result in the editor (Text check panel) before saving.

const TextParse = (() => {
  const numWord = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, any: 99 };
  const toNum = (s) => (s == null ? 1 : numWord[String(s).toLowerCase()] ?? (parseInt(String(s).replace(/,/g, ""), 10) || 1));
  const N = "(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";
  const rx = (s, f = "i") => new RegExp(s, f);

  // ---------- a card page pasted from the official card list (en.cf-vanguard.com/cardlist/?cardno=…) ----------
  // Copying the page gives (fields glued together, no separators — the " | " are drawn by CSS only):
  //   [VGE-…] product name                      (only if copied too)
  //   Dragonic Overlord                         name (maybe "（kana）")
  //   Normal UnitDragon EmpireFlame DragonKageroGrade 3Power 13000Critical 1Shield Twin Drive!!, Persona Ride
  //     D cards (Standard):     type · nation · [nation 2] · race · [clan] · Grade · Power · Critical · Shield · skills · trigger
  //     older cards:            type · clan · race · nation · Grade · Power · Critical · Shield · skills · trigger   ("-" = none)
  //   [AUTO](VC):…              ability text, one line each; clan names show as &lt;Royal Paladin&gt;
  //   flavor text
  //   StandardDZ-SS14/001ENTDillust/伊藤彰    format ("Standard", "V-Premium", "Standard/V-Premium", "G-Regulation" or nothing),
  //                                             card number, rarity, illustrator
  //   Prev / Next …             page buttons and anything after the last line are ignored
  // The " | " form ("Normal Unit | Dragon Empire | … | Grade 3 | …") and separate "Card No.: …" / "Rarity: …" lines work too.
  // The names below are the site's own nation and clan lists (cardlist search form).
  const NATIONS_D = ["Dragon Empire", "Dark States", "Brandt Gate", "Keter Sanctuary", "Stoicheia", "Lyrical Monasterio", "Touken Ranbu",
    "Record of Ragnarok", "SHAMAN KING", "BanG Dream!", "CoroCoro", "Buddyfight", "Cray Elemental"];
  const NATIONS_OLD = ["United Sanctuary", "Dragon Empire", "Dark Zone", "Star Gate", "Magallanica", "Zoo", "Cray Elemental", "BanG Dream! FILM LIVE"];
  const CLANS = ["Royal Paladin", "Oracle Think Tank", "Angel Feather", "Shadow Paladin", "Gold Paladin", "Genesis", "Kagero", "Nubatama", "Tachikaze",
    "Murakumo", "Narukami", "Nova Grappler", "Dimension Police", "Link Joker", "Spike Brothers", "Dark Irregulars", "Pale Moon", "Gear Chronicle",
    "Granblue", "Bermuda Triangle", "Aqua Force", "Megacolony", "Great Nature", "Neo Nectar", "Cray Elemental", "Etranger", "Touken Ranbu", "BanG Dream!",
    "Dragon Empire", "Magallanica", "Zoo", "Star Gate", "United Sanctuary", "Dark Zone"];
  const KNOWN = [...new Set([...NATIONS_D, ...NATIONS_OLD, ...CLANS])];
  const isKnown = (t, list) => list.some((n) => n.toLowerCase() === String(t).toLowerCase());
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // printed exactly like this on the site (case-sensitive, so "Zoo" never splits a race like "Zoological")
  // glued fields never have a space at the seam, so a name with a space next to it is part of a longer word ("CoroCoro Comic" is a race)
  const KNOWN_RE = new RegExp(`(?<! )(${KNOWN.sort((a, b) => b.length - a.length).map(reEsc).join("|")})(?! )(?!ers?(?:[A-Z|]|$))`, "g"); // …"Buddyfighter" is a race, "Lyrical Monasteriohololive" is two fields
  // every rarity the official card list uses (all 25,927 cards, 2026-11-13)
  const RARITIES = ["PR", "-", "RRR", "RR", "R", "C", "SP", "Ｒ", "Ｃ", "ЯЯЯ", "LR", "ORR", "DSR", "H", "T", "SSR", "WO", "10thRRR", "10thSEC", "10thSP", "SEC",
    "FFR", "FR", "Re", "SNR", "EX", "SECP", "SECV", "BSR", "LSP", "LSR", "MSP", "TD", "SR", "SD", "TDR", "ORRR", "Re+", "SIR", "TRR", "RGR", "SSP", "SKR", "VSR",
    "EXRRR", "EXC", "EXS", "R+", "EXP", "SER", "SER+", "15thSP", "RGGR", "TGR", "TGR+", "CR", "GCR", "LGRRR", "LGRR", "LGR", "LGTR", "PGS", "BR", "KR", "SFR",
    "GBPR", "GBPR+", "PGSP", "GR", "SCR", "SGR", "ZR", "WSP", "RE", "LD", "VR", "IMR", "OR", "SVR", "DR", "VDR", "XVR", "RLR", "ASR", "URR", "LIR", "OCR", "IGR", "SDS"];
  const RARITIES_BY_LEN = RARITIES.slice().sort((a, b) => b.length - a.length);
  const RAR_RE = RARITIES_BY_LEN.map(reEsc).join("|");
  const REG = "Standard\\/V-Premium|Standard|V-Premium|G-Regulation";
  const NUM = "[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\\/[A-Za-z0-9-]*?\\d+(?:S?EN|[ab]|[ABS])?(?:-[A-Z]{1,2})?";
  const FOOT = new RegExp(`^\\s*(${REG})?\\s*([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\\/)(.+)$`);
  // the page shows some entities as typed, sometimes without the ";" ("&ltMurakumo&gt")
  const decode = (s) => String(s).replace(/&lt;?/g, "<").replace(/&gt;?/g, ">").replace(/&quot;?/g, '"').replace(/&#0?39;?/g, "'").replace(/&nbsp;?/g, " ").replace(/&amp;?/g, "&");
  // the rarity right after the number: the longest one ("RRkoji" = RR + "koji"). Most illustrator names start in lower case or
  // Japanese; one that starts with a rarity's capital letter ("RRRyo-ta.H") can't be told apart — check the Rarity field then.
  function rarityAt(s) {
    return RARITIES_BY_LEN.find((r) => s.startsWith(r)) || "";
  }
  const okAfter = (s) => !s || !!rarityAt(s) || !/^[A-Za-z0-9]/.test(s);
  // the card number's part after "/": English numbers end in "EN" ("001EN", "T01EN", "10thSEC01EN", "VGP01SEN"), maybe "-R";
  // the others end at their digits ("VGP01", "VGS01a", "99A")
  function numberTail(s) {
    const en = s.match(/^[A-Za-z0-9＋+:-]*?\d+[A-Za-z-]*?EN/);
    if (en) {
      let num = en[0], rem = s.slice(num.length);
      const lab = rem.match(/^ (PR|SGR|[A-Z]{2,4})(?=\S)/); // special printings: "G-BT07/001EN SGR" (then the rarity)
      if (lab && okAfter(rem.slice(lab[0].length))) { num += lab[0]; rem = rem.slice(lab[0].length); }
      const us = rem.match(/^_\d+/); // trial deck copies: "DZ-TD01/001EN_16"
      if (us) { num += us[0]; rem = rem.slice(us[0].length); }
      for (const sx of (rem.match(/^-[A-Z]{1,2}/) || [""]).flatMap((x) => (x.length === 3 ? [x.slice(0, 2), x] : x ? [x] : []))) { // "-S" + "PR" before "-SP" + "R"
        if (okAfter(rem.slice(sx.length))) { num += sx; rem = rem.slice(sx.length); break; }
      }
      return [num, rem];
    }
    const x = s.match(/^[A-Za-z0-9＋+-]*?\d+(?!\d)([ab]|[ABS])?/);
    if (!x) return null;
    let num = x[0], rem = s.slice(num.length);
    if (x[1] && !okAfter(rem) && okAfter(x[1] + rem)) { num = num.slice(0, -1); rem = x[1] + rem; }
    const sx = rem.match(/^-[A-Z]/); // "D-TD03/003-T"
    if (sx && (okAfter(rem.slice(2)) || /^[a-z]/.test(rem.slice(2)))) { num += sx[0]; rem = rem.slice(2); }
    return [num, rem];
  }
  // the last line: format + number + rarity + illustrator
  function footer(l) {
    if (/\|/.test(l) || /\[(auto|act|cont)\]/i.test(l)) return null;
    const f = l.match(FOOT);
    if (!f) return null;
    const t = numberTail(f[3]);
    if (!t) return null;
    const m = [l, f[1], f[2] + t[0], t[1]];
    const rar = rarityAt(m[3]);
    const rest = m[3].slice(rar.length).trim();
    // a line that only starts with something number-like isn't the footer: it needs a format label, a rarity, or nothing but an illustrator after
    if (!m[1] && !rar && rest && / /.test(rest) && /[.!?]$/.test(rest)) return null;
    const reg = m[1] || "";
    return { number: m[2], rarity: rar.replace("Ｃ", "C").replace("Ｒ", "R"), illustrator: rest, icon: /Standard/.test(reg) ? "D" : /V-Premium/.test(reg) ? "V" : reg ? "-" : "" };
  }
  const TYPE_RE = /^\s*((?:normal|trigger|g|token) unit|(?:normal|blitz|set|trigger) order|ride deck crest|others)/i;
  // a few cards have no card type: the Grade…Power…Critical…Shield run is enough to know the stat line
  // (values may be "-" or empty; a few new set orders print "Critical 無", Japanese for "none")
  const STATS_RUN = /Grade\s*(?:\d+|-)?\s*Power\s*(?:\+?[\d,]+\+?|-)?\s*Critical\s*(?:\d+|-|無)?\s*Shield/;
  // the stat line, glued: put "|" between the fields again
  function unglue(l) {
    if (/\|/.test(l) || /\[(auto|act|cont)\]/i.test(l) || !(TYPE_RE.test(l) ? /grade|power|shield/i.test(l) : STATS_RUN.test(l))) return l;
    // type | middle (nation / race / clan) | Grade … Shield | tail (skills, trigger)
    const m = l.match(/^\s*(.*?)(Grade\s*(?:\d+|-)?)\s*(Power\s*(?:\+?[\d,]+\+?|-)?)\s*(Critical\s*(?:\d+|-|無)?)\s*(Shield\s*(?:[\d,]+|-)?)(.*)$/);
    if (!m) return l;
    const head = TYPE_RE.test(m[1]) ? m[1].replace(TYPE_RE, "$1|") : "|" + m[1];
    const [type, ...midParts] = head.split("|");
    const mid = midParts.join("").replace(KNOWN_RE, "|$1|");
    // skills and the trigger are glued without spaces ("Twin Drive!!-", "BoostFront +10000"): no word boundaries here
    const tail = m[6]
      .replace(/((?:Critical|Front|Draw|Heal|Over|Stand)(?: Trigger)?)\s*(\+\s*[\d,]+)/g, (x, t, p) => `|${/trigger/i.test(t) ? t : t + " Trigger"}|${p}|`)
      .replace(/((?:Critical|Front|Draw|Heal|Over|Stand) Trigger)(?!\|)/g, "|$1|")
      .replace(/(Twin Drive!*|Triple Drive!*|Persona Ride|Imaginary Gift\s*[:\-]?\s*(?:Force|Accel|Protect)|Regalis Piece|Boost|Intercept|Force|Accel|Protect|Kai|Sentinel)/g, "|$1|");
    return [type, mid, m[2], m[3], m[4], m[5], tail].join("|")
      .replace(/\|\s*[,、]\s*/g, "|").replace(/(^|\|)\s*-\s*(?=\||$)/g, "$1").replace(/\|\s*\|/g, "|").replace(/\|{2,}/g, "|");
  }
  const isPiped = (l) => /\|/.test(l) && !/\[(auto|act|cont)\]/i.test(l) &&
    /(^|\|)\s*((normal|trigger|g|token) unit|(normal|blitz|set|trigger) order|others|ride deck crest|grade\s*[\d-]|power\s*\+?\d|critical\s*\d|shield\b|twin drive|triple drive|persona ride)/i.test(l);
  const isNoLine = (l) => /^\s*(card\s*no\.?|number|rarity)\s*[:：\-]/i.test(l);
  const JUNK = /^(prev|next|return to search results|found in the following products|card list|product page|q&a containing.*|.*is used in the follow(ing)? deck recipes)$/i;

  // → {stats, rest}: the fields read from the pasted page and the ability text (the rest)
  function splitStats(text) {
    const raw = decode(String(text || "")).replace(/\r/g, "").split("\n");
    const lines = raw.map((l) => unglue(l.replace(/[\t ]+$/, "")));
    const statAt = lines.findIndex(isPiped);
    const out = {};
    // card number / rarity written on their own lines
    const noLines = [];
    lines.forEach((l, i) => { if (isNoLine(l)) noLines.push(i); });
    let footAt = -1, foot = null;
    if (statAt >= 0) {
      for (let i = lines.length - 1; i > statAt; i--) { const f = footer(lines[i].trim()); if (f) { footAt = i; foot = f; break; } }
    } else {
      // only a footer line (number + rarity) pasted, e.g. "DZ-SS03/018EN | RRR"
      const i = lines.findIndex((l) => /^\s*[A-Z0-9]+(?:-[A-Z0-9]+)*\/[A-Za-z0-9-]+\s*(\||$)/.test(l));
      if (i < 0 && !noLines.length) return { stats: out, rest: raw.join("\n").trim() };
      if (i >= 0) { const parts = lines[i].split("|").map((x) => x.trim()).filter(Boolean); out.number = parts[0]; for (const p of parts.slice(1)) if (isKnown(p, RARITIES)) out.rarity = p; lines[i] = ""; }
    }
    for (const i of noLines) {
      const m = lines[i].match(/^\s*(card\s*no\.?|number|rarity)\s*[:：\-]\s*(.+)$/i);
      if (m) { if (/rarity/i.test(m[1])) out.rarity = m[2].trim(); else out.number = m[2].trim(); }
      lines[i] = "";
    }
    if (foot) { out.number = foot.number; if (foot.rarity && foot.rarity !== "-") out.rarity = foot.rarity; if (foot.icon) out.icon = foot.icon; }
    if (statAt < 0) return { stats: out, rest: lines.filter((l) => l.trim()).join("\n").trim() };
    // the name: the line just before the stat line (not a product header "[VGE-…] …")
    for (let i = statAt - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (!l) continue;
      if (/^\[[^\]]+\]\s*\S/.test(l) && /cardfight|booster|deck|pack|series|set|collection|promo|pr card/i.test(l)) break;
      out.name = l.replace(/\s*（[^）]*）\s*$/, "").trim();
      break;
    }
    // what's between the stat line and the footer: ability text, then flavor text
    let body = lines.slice(statAt + 1, footAt >= 0 ? footAt : lines.length).map((l) => l.trim()).filter((l) => l && l !== "-" && !JUNK.test(l));
    // stat lines that wrapped onto the next lines (" | " form)
    let statText = lines[statAt];
    while (body.length && isPiped(body[0]) && !/\[(auto|act|cont)\]/i.test(body[0])) statText += "|" + body.shift();
    // fields
    const tokens = statText.split("|").flatMap((t) => (/drive|persona|boost|intercept|gift|force|accel|protect|kai/i.test(t) ? t.split(/[,、]/) : [t])).map((t) => t.trim().replace(/^-+(?=[A-Z])|(?<=[a-z!])-+$/g, "")).filter((t) => t && t !== "-" && t !== "無"); // "-" / "無" = none
    const gAt = tokens.findIndex((t) => /^grade\b/i.test(t));
    const mids = [];
    for (const [i, t] of tokens.entries()) {
      const low = t.toLowerCase().replace(/\s+/g, " ");
      let m;
      if ((m = low.match(/^(normal|trigger|g|token) unit$/))) { out.type = m[1] === "trigger" ? "trigger" : m[1] === "g" ? "g" : "unit"; if (m[1] === "token") out.token = true; }
      else if ((m = low.match(/^(normal|blitz|set|trigger) order$/))) { out.type = "order"; if (m[1] === "set") out.setOrder = true; if (m[1] === "trigger") out.triggerOrder = true; if (m[1] === "blitz") out.blitz = true; }
      else if (low === "ride deck crest" || (low === "crest" && i === 0)) out.type = "crest";
      else if (low === "others") out.others = true;
      else if ((m = low.match(/^(critical|front|draw|heal|over|stand) trigger$/))) { out.trigger = m[1] === "critical" ? "crit" : m[1]; out.type = out.type || "trigger"; }
      else if ((m = low.match(/^grade\s*[:\-]?\s*(\d+)?$/))) { if (m[1] != null) out.grade = +m[1]; }
      else if ((m = low.match(/^power\s*[:\-]?\s*(\+)?\s*([\d,]+)?(\+)?$/))) { if (m[2]) out.power = +m[2].replace(/,/g, ""); if (m[1] || m[3]) out.powerPlus = true; }
      else if ((m = low.match(/^critical\s*[:\-]?\s*(\d+)?$/))) { if (m[1]) out.crit = +m[1]; }
      else if ((m = low.match(/^shield\s*[:\-]?\s*([\d,]*|-)$/))) { if (m[1] !== "-") out.shield = m[1] ? +m[1].replace(/,/g, "") : 0; }
      else if ((m = low.match(/^\+\s*([\d,]+)$/))) out.trigPower = +m[1].replace(/,/g, "");
      else if (/^twin drive/.test(low)) out.drive = 2;
      else if (/^triple drive/.test(low)) out.drive = 3;
      else if (low === "boost") out.boost = true;
      else if (low === "intercept") out.intercept = true;
      else if (low === "persona ride") out.persona = true;
      else if (low === "kai" || low === "kai icon") out.kai = true;
      else if (low === "sentinel") out.sentinel = true;
      else if (low === "regalis piece") out.regalis = true;
      else if ((m = low.match(/^(?:imaginary gift\s*[:\-]?\s*)?(force|accel|protect)$/))) out.gift = m[1];
      else if (gAt < 0 || i < gAt) mids.push(t); // between the card type and Grade: nation / race / clan
    }
    // nation / clan / race by position (the site's order differs between D cards and older cards)
    let D;
    if (foot && foot.icon) D = foot.icon === "D";
    else { // no format label: a D nation first means a D card, unless that name is also an old clan and the line ends with an old nation
      const f = mids[0], l = mids[mids.length - 1];
      D = isKnown(f, NATIONS_D) && (!isKnown(f, CLANS) || !(mids.length > 1 && isKnown(l, NATIONS_OLD) && !isKnown(l, NATIONS_D)));
    }
    const races = [];
    const clean = (t) => t.replace(/^[-\s]+|[-\s]+$/g, "");
    if (D) {
      let k = 0;
      if (k < mids.length && isKnown(mids[k], [...NATIONS_D, ...NATIONS_OLD])) out.nation = mids[k++];
      if (k < mids.length && isKnown(mids[k], [...NATIONS_D, ...NATIONS_OLD]) && !(k === mids.length - 1 && isKnown(mids[k], CLANS))) out.nation2 = mids[k++];
      let end = mids.length;
      if (end - 1 >= k && isKnown(mids[end - 1], CLANS)) out.clan = mids[--end];
      for (let j = k; j < end; j++) races.push(clean(mids[j]));
    } else {
      let k = 0, end = mids.length;
      if (end > 0 && isKnown(mids[0], CLANS)) out.clan = mids[k++];
      if (end - 1 >= k && isKnown(mids[end - 1], [...NATIONS_OLD, ...NATIONS_D])) out.nation = mids[--end];
      else if (end - 1 >= k && !out.clan && isKnown(mids[end - 1], CLANS)) out.clan = mids[--end]; // a clan printed in the nation slot
      for (let j = k; j < end; j++) races.push(clean(mids[j]));
    }
    const race = races.filter(Boolean).join(" / ");
    if (race) out.race = race;
    // flavor text: the lines after the abilities that aren't rules text. Rules text is tagged ([AUTO]…, (…) reminders, ・ options)
    // or uses rules words in lower case ("rear-guard", "your", "until end of turn"…); flavor is story text ("Ride the Vanguard!").
    // rules-only words (story text says "hand" or "your" too, but not "rear-guard", "grade" or "until end of turn")
    const RULES_ANY = /\[[A-Za-z-]+\]|\((VC|RC|GC)\)|\b(draw (a|one|two|three|four) cards?|choose (one|two|three|up to|a|an|any)|retire|search your|look at|reveal|until end of (turn|that battle)|counter-blast|soul-blast|energy-blast|grade \d|additional effect)\b/i;
    const RULES_LOW = /\b(rear-guards?|vanguards?|your opponent|deck|drop zone|your drop|damage zone|this (card|unit)|cards? (from|in|with)|guardians?|triggers?|you may)\b/;
    const RULES = { test: (l) => RULES_ANY.test(l) || RULES_LOW.test(l) };
    const tagged = (l) => /^[\[(（・•【-]/.test(l) || /\]:/.test(l) || /\[(AUTO|ACT|CONT)\]/i.test(l) || /^(AUTO|ACT|CONT)\s*[:(]/.test(l) || /^additional effect/i.test(l);
    const isUnit = ["unit", "trigger", "g", "crest"].includes(out.type) || (!out.type && !out.others);
    // the site stores some quotation marks as line breaks: "…choose a card named" / "Covert Demonic Dragon, Mandala Lord" / "from your hand…"
    // → one line with the name in quotes again
    for (let i = 0; i + 2 < body.length; i++) {
      if (!/[.!?」)\]:]$/.test(body[i]) && body[i + 1].length <= 90 && !tagged(body[i + 1]) && /^[a-z,.)\]'’]/.test(body[i + 2])) {
        body.splice(i, 3, `${body[i]} "${body[i + 1]}"${/^[,.)\]'’]/.test(body[i + 2]) ? "" : " "}${body[i + 2]}`);
        i--;
      }
    }
    // a line that starts in lower case (or with , . ) ]) carries on the line before ("…cards with [Heal] Heal" / "in a deck.)")
    for (let i = 1; i < body.length; i++) {
      if (/^[a-z,.)\]]/.test(body[i]) && !/[.!?」]$/.test(body[i - 1])) { body.splice(i - 1, 2, body[i - 1] + (/^[,.)\]]/.test(body[i]) ? "" : " ") + body[i]); i--; }
    }
    // units: every rules line is tagged, so any untagged line at the end is flavor; orders' rules text is untagged, so it needs rules words
    const isFlavor = (l) => !tagged(l) && (isUnit || !RULES.test(l));
    for (let i = body.length - 1; i >= 0; i--) {
      if (i === 0 && !isUnit) break; // an order's only line is its effect
      if (isFlavor(body[i])) { body.splice(i, 1); continue; }
      break;
    }
    // "Others": ticket / token / crest / marker, from its text
    const restText = body.join("\n").trim();
    if (out.others) {
      if (/ticket card/i.test(restText) || /^quick shield$/i.test(out.name || "")) Object.assign(out, { type: "order", ticket: true, blitz: true });
      else if (/represents an? .*?token|this card is a token/i.test(restText) || out.power != null) Object.assign(out, { type: "unit", token: true });
      else if (/^\[CONT\]/i.test(restText) && out.grade == null) out.type = "crest";
      else out.marker = true;
      delete out.others;
    }
    // the printed skills list everything a unit has: no Boost / Intercept / drive / Persona Ride on the line means it has none
    if (out.grade != null && (out.type === "unit" || out.type === "trigger") && !out.token) {
      if (out.boost === undefined) out.boost = false;
      if (out.intercept === undefined) out.intercept = false;
      if (out.drive === undefined) out.drive = 1;
      if (out.persona === undefined) out.persona = false;
    }
    if (out.trigger === "over" && !out.trigPower) out.trigPower = 100000000;
    return { stats: out, rest: restText };
  }

  // ---------- stats ----------
  function stats(text) {
    const split = splitStats(text);
    text = split.rest;
    const out = {};
    const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };
    const g = grab(/grade\s*[:\-]\s*(\d)/i); if (g !== null) out.grade = +g;
    const p = grab(/power\s*[:\-]\s*([\d,]+)/i); if (p) out.power = +p.replace(/,/g, "");
    const sh = grab(/shield\s*[:\-]\s*([\d,]+)/i); if (sh) out.shield = +sh.replace(/,/g, "");
    const c = grab(/critical\s*[:\-]\s*(\d)/i); if (c) out.crit = +c;
    const n = grab(/nation\s*[:\-]\s*([^\n/|]+)/i); if (n) out.nation = n;
    const r = grab(/race\s*[:\-]\s*([^\n/|]+)/i); if (r) out.race = r;
    const t = text.match(/\b(critical|front|draw|heal|over|stand)\s+trigger\b/i);
    if (t && !/\[(auto|act|cont)\]/i.test(text.slice(0, t.index))) { out.trigger = t[1].toLowerCase() === "critical" ? "crit" : t[1].toLowerCase(); out.type = "trigger"; }
    if (/(^|\n|\]:?)\s*sentinel\b/i.test(text)) out.sentinel = true;
    // Persona Ride is a printed skill icon, never ability text ("activate persona ride" is an effect): only the stat line sets it
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
    const al = [...text.matchAll(/this card is (?:also )?regarded as "([^"]+)"/gi), ...text.matchAll(/^\[CONT\][^:\n]*:\s*this unit is (?:also )?regarded as "([^"]+)"\.?\s*$/gim)].map((m) => m[1]);
    if (al.length) out.alias = al;
    if (/this card is (regarded as being )?from all clans/i.test(text)) out.allClans = true;
    const sg = text.match(/while (?:you are )?paying the cost (?:for|of) \[?stride\]?,? this card gets grade \+(\d)/i);
    if (sg) out.strideGrade = +sg[1];
    if (/this card cannot be ridden/i.test(text)) out.cantBeRidden = true;
    const rf = text.match(/this card can only be ridden from (?:a |an )?(grade \d )?(?:card |unit )?(?:with "([^"]+)" in its card name|named "([^"]+)")/i);
    if (rf) out.rideFrom = { ...(rf[1] ? { gmin: +rf[1].match(/\d/)[0], gmax: +rf[1].match(/\d/)[0] } : {}), ...(rf[2] ? { name: rf[2] } : { nameExact: rf[3] }) };
    const onlyN = text.match(/you may only have (one|two|three|four|\d+) "([^"]+)" in (?:a|your) deck/i);
    if (onlyN) out.deckMax = toNum(onlyN[1]);
    const upToN = text.match(/you may have up to (\w+) "([^"]+)" in (?:a|your) deck/i);
    if (upToN) out.deckMax = toNum(upToN[1]);
    // "[CONT]:The normal ride of this card from a grade 3 card with a Kai icon and a different card name from this card also becomes a persona ride."
    if (/normal ride of this card from a grade 3 card with a kai icon and a different card name[^.]*also becomes a persona ride/i.test(text)) out.personaFromKai = true;
    // "[CONT](Hand):When this card would be discarded, it may be discarded as a grade 4 or 3…" (counts for the stride cost)
    const da = text.match(/may be discarded as a grade ((?:\d+(?:\s*or\s*)?)+)/i);
    if (da) out.discardAs = Math.max(...da[1].match(/\d+/g).map(Number));
    // a G unit's printed stride cost (the default is "discard cards whose grades total 3 or more")
    const sl = text.match(/\[Stride\][^\n]*?-Stride Step-[^\n]*/i);
    if (sl) {
      const l = sl[0];
      let m;
      if ((m = l.match(/discard an? (?:grade (\d+) )?card with "([^"]+)" in its card name/i))) out.strideCost = { grade: m[1] != null ? +m[1] : null, name: m[2] };
      else if (/same card name as a card on your \(VC\)/i.test(l)) out.strideCost = { sameNameVC: true };
      else if ((m = l.match(/sum of their grades being (\d+) or greater/i)) && +m[1] !== 3) out.strideCost = { sum: +m[1] };
    }
    return Object.assign(out, split.stats);
  }

  // ---------- normalising ----------
  const norm = (s) => String(s || "").replace(/\r/g, "").replace(/［/g, "[").replace(/］/g, "]").replace(/（/g, "(").replace(/）/g, ")")
    .replace(/\[COST\]\s*\[([^\]]*)\]\s*&\s*((?:[^\[\]]|\[[^\]]*\])*)\]/gi, "[COST][$1 & $2]")
    .replace(/&\s*Rest\]\s*this (unit|card)\]/gi, "& [Rest] this $1]")
    .replace(/\[COST\]\s*\[([^\[\]]*)\]\s*&\s*\[([^\[\]]*)\]/gi, "[COST][$1 & $2]")
    .replace(/\[COST\]\[Rest\]\s*this (unit|card)\]/gi, "[COST][[Rest] this $1]").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/　/g, " ")
    .replace(/\[\s*(power|critical|shield)\s*\]\s*([+-])\s*/gi, (m, a, b) => `[${a[0].toUpperCase() + a.slice(1).toLowerCase()}] ${b}`)
    .replace(/counter-?blast\s*\(?(\d+)\)?/gi, "Counter-Blast $1").replace(/soul-?blast\s*\(?(\d+)\)?/gi, "Soul-Blast $1")
    .replace(/energy-?blast\s*\(?(\d+)\)?/gi, "Energy-Blast $1").replace(/counter-?charge\s*\(?(\d+)\)?/gi, "Counter-Charge $1")
    .replace(/soul-?charge\s*\(?(\d+)\)?/gi, "Soul-Charge $1").replace(/energy-?charge\s*\(?(\d+)\)?/gi, "Energy-Charge $1")
    .replace(/\[cost\]\s*\[\s*\]/gi, "")
    .replace(/\((?:this ability is active|active on|active if|when a unit of the same clan|you may only have|this card is regarded|this card cannot|it will not be retired|the locked card|a unit with)[^()]*(?:\([^()]*\)[^()]*)*\)/gi, "")
    .replace(/\((?![^()]*\b(?:VC|RC|GC)\b\)$)[^()]{26,}(?:\([^()]*\)[^()]*)*\)/g, (m) => (/^\((VC|RC|GC|\[)/.test(m) ? m : ""))
    .replace(/\[(soul-charge|counter-charge|energy-charge) (\d+)\]/gi, "$1 $2")
    .replace(/\[(Counter|Soul|Energy)-Blast\]\s*(\d+)\]/gi, "[$1-Blast $2]") // typo on the site: "[Counter-Blast]1]"
    .replace(/(^|:)\s*\[Rest\] this (unit|card)\]/gi, "$1[[Rest] this $2]") // "[ACT](RC):[Rest] this unit] …" (old cost with a lost bracket)
    .replace(/＋/g, "+").replace(/ +/g, " ");

  // ---------- filters ("grade 3 or greater normal unit with "X" in its card name") ----------
  function filt(t) {
    const f = {};
    let m;
    if ((m = t.match(/grade (\d) or (less|lower)/i))) f.gmax = +m[1];
    else if ((m = t.match(/grade (\d) or (greater|higher|more)/i))) f.gmin = +m[1];
    else if ((m = t.match(/\bgrade (\d)\b/i))) { f.gmin = +m[1]; f.gmax = +m[1]; }
    const anyNames = t.match(/with ((?:"[^"]+"(?:,? (?:or|and\/or) )?){2,}) in (its|their) (different |original )?card names?/i);
    if (anyNames) f.nameAny = [...anyNames[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]); // "with "A" or "B" in its card name"
    else if ((m = t.match(/with "([^"]+)" in (its|their) (different |original )?card names?/i))) f.name = m[1];
    else if ((m = t.match(/(?:card|unit)s? named "([^"]+)"/i)) || (m = t.match(/^"([^"]+)"$/))) f.nameExact = m[1];
    if ((m = t.match(/<+([^>]+)>+/))) f.clan = m[1].trim();
    if (/same card name as (your|the) vanguard/i.test(t)) f.sameNameVC = true;
    if (/with an? kai icon/i.test(t)) f.kai = true;
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
    // the unit the timing is about: "that placed unit", "the unit that [Stand]", "that attacking unit", "the called unit"
    if (/^\s*(that (placed|attacking|called|boosted|stood|retired|bound) unit|the (placed|called|attacking) unit|the unit that \[stand\]|that unit that \[stand\])\b/i.test(t)) return { target: "eventUnit" };
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
  const durOf = (t) => (/until end of (your opponent'?s|the opponent'?s)( next)? turn/i.test(t) ? "oppTurn" : /until end of your next turn/i.test(t) ? "nextTurn"
    : /until end of (that|the) battle/i.test(t) ? "battle" : /until end of (the|this) fight/i.test(t) ? "game" : "turn");

  // ---------- timings ----------
  // [regex, event, zone hint, extra {conds, whenFilter, whenFrom}]
  const EVENTS = [
    // round 4: chosen by an ability, drawing, replaced on its circle, opponent's rear-guard into the deck
    [/when this unit is chosen by (?:the )?(?:ability|effect) of your ((?:grade \d or (?:greater|less) )?vanguard(?: with (?:"[^"]+"(?:,? or )?)+ in its card name)?)/i, "chosenBy", null, { byVCText: 1 }],
    [/when this unit is chosen by your vanguard'?s (?:ability|effect)/i, "chosenBy", null, { byVC: true }],
    [/when this unit is chosen by (?:the )?(?:ability|effect) of your ((?:grade \d or (?:greater|less) )?(?:card|unit)s?(?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)?)/i, "chosenBy", null, { byCard: 1 }],
    [/when you draw a card/i, "drew", null],
    [/when your other unit is placed on this unit'?s circle/i, "replacedBy", null],
    [/when your opponent'?s rear-guard is put into (?:his or her|their) deck(?: (?:due to|by) (?:an effect from )?(?:one of )?your (?:other )?cards?)?/i, "oppToDeck", null],
    [/when (?:this unit|it) (?:\[stand\]|stands) by the (?:ability|effect) of your ((?:grade \d or (?:greater|less) )?vanguard(?: with (?:"[^"]+"(?:,? or )?)+ in its card name)?)/i, "stood", null, { byVCText: 1 }],
    // round 2 (official list): columns, stands, discards, soul, binds, locks, Soul-Blast at once, order zone
    [/when your other (?:unit|rear-guard)s? (?:is|are) placed (?:on (?:an? )?\(RC\) )?in the same column as this unit/i, "allyPlacedRC", null, { column: true }],
    [/when your other (rear-guard|unit) in the same column as this unit is placed/i, "allyPlacedRC", null, { column: true }],
    [/when (?:this unit|it) (?:is )?(?:\[stand\]|stands|becomes \[stand\]) (?:by|due to) the (?:ability|effect) of your vanguard(?: with ((?:"[^"]+"(?:,? or )?)+) in its card name)?|when this unit is \[stand\] by your vanguard'?s (?:ability|effect)/i, "stood", null, { byVC: 1 }],
    [/when (?:this unit|it) (?:is )?(?:\[stand\]|stands) by the (?:ability|effect) of your ((?:grade \d or (?:greater|less) )?(?:card|unit)s?(?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)?)/i, "stood", null, { byCard: 1 }],
    [/when your ((?:grade \d or (?:greater|less) )?vanguard(?: with (?:"[^"]+"(?:,? or )?)+ in its card name)?) (?:\[stand\]|stands) by your card'?s (?:ability|effect)/i, "allyStood", null, { subjectText: 1, conds: [{ type: "byMe" }] }],
    [/when the unit armed with this card is attacked/i, "attacked", "VC"],
    [/when (this unit|it) (?:\[stand\]|stands) (?:by|due to) (?:an? |the )?(?:effect|ability) (?:from|of) (?:one of )?your (?:other )?cards?(?:'s)?(?: (?:ability|effect))?/i, "stood", null, { conds: [{ type: "byMe" }] }],
    [/when your (other )?(?:rear-guard|unit)s? in the same column as this unit (?:\[stand\]|stands?)/i, "allyStood", null, { column: true }],
    [/when your other ((?:(?!in the same)[^,])*?)(?:unit|rear-guard)s? (?:with "[^"]+" in (?:its|their) card names? )?(?:\[stand\]|stands?) (?:by|due to|from) (?:an? |the )?(?:card'?s )?(?:effect|ability)/i, "allyStood", null, { subjectOther: true, subjectText: 1 }],
    [/when your other card is discarded from (?:your )?hand/i, "allyDiscarded", null, { subjectOther: true }],
    [/when (?:this unit|it) is bound from \(RC\)(?: by the ability of your vanguard(?: with ((?:"[^"]+"(?:,? or )?)+) in its card name)?)?/i, "boundFromRC", "RC", { byVC: 1 }],
    [/when this unit is bound from \(RC\)/i, "boundFromRC", "RC"],
    [/when your opponent'?s (.*?)rear-guards? (?:is|are) bound/i, "oppBound", null, { subject: 1 }],
    [/when your opponent'?s (.*?)rear-guards? (?:is|are) locked/i, "oppLocked", null, { subject: 1 }],
    [/when your opponent'?s locked cards? (?:is|are) unlocked|when an opponent'?s locked card is unlocked/i, "oppUnlocked", null],
    [/when you \[?soul-blast (\d+)\]? or more(?: cards)? at the same time for the cost of your vanguard'?s abilit(?:y|ies)/i, "soulBlasted", null, { min: 1, byVC: true }],
    [/when a card is put into your order zone/i, "cardToOrderZone", null],
    [/when your other rear-guard is put into your soul/i, "cardToSoul", null, { subjectOther: true, whenFrom: "RC" }],
    [/when (?:a|your) card is put into your soul(?! by)/i, "cardToSoul", null],
    [/when your other rear-guard is returned to (?:your )?hand(?: by your vanguard'?s abilit(?:y|ies))?/i, "allyReturnedHand", null, { subjectOther: true }],
    [/when this unit is put into your deck from \(RC\)/i, "rcToDeck", "RC"],
    [/when the unit armed with this card attacks/i, "attack", "VC"],
    [/when this unit in the \[x?overdress\] state attacks( a vanguard)?/i, "attack", null, { conds: [{ type: "dressed" }] }],
    [/when this card is put in (?:the|your) order zone/i, "toOrderZone", "OZ"],
    // leaving a circle / zone
    [/when (?:this unit is |this card is )?retired from \(rc\) by (?:the ability of )?(?:one of )?your (?:own |other )?cards?'?s? ?(?:abilit(?:y|ies)|effects?)?|when (this unit|this card) is put into (the |your )?drop( zone)? from \(rc\) (?:due to|by) (?:an effect from )?(?:one of )?your (?:own |other )?cards?/i, "retired", "RC", { conds: [{ type: "byMe" }] }],
    [/when (this unit|this card) is put into (the |your )?drop( zone)? from \(rc\)|when (this unit is |this card is )?retired from \(rc\)/i, "retired", "RC"],
    [/when (this unit|this card) is put into (the |your )?drop( zone)? from \(gc\)|when (this unit is |this card is )?retired from \(gc\)/i, "leftGC", "GC"],
    [/when (this card|this unit) is put (?:into (?:the |your )?drop(?: zone)? from (?:your )?soul|from (?:your )?soul into (?:the |your )?drop(?: zone)?)/i, "soulToDrop", "soul"],
    [/when this unit is put (?:from \(rc\) into (?:your )?soul|into (?:your )?soul from \(rc\))/i, "rcToSoul", "RC"],
    [/when this unit is returned (?:to (?:your )?hand from \(rc\)|from \(rc\) to (?:your )?hand)/i, "returnedHand", "RC"],
    [/when your opponent'?s (.*?)rear-guards? (?:is|are) (?:put into the drop(?: zone)?|retired) (?:due to|by) (?:an effect (?:from|of) |the abilit(?:y|ies) of )?(?:one of )?your (?:other )?cards?(?:'s)?(?: abilit(?:y|ies)| effects?)?/i, "oppRetired", null, { subject: 1, conds: [{ type: "byMe" }] }],
    // the vanguard / field
    [/when your ((?:(?!rear-guard|opponent)[^,])*?) is placed on \(vc\)|when your ((?:(?!rear-guard|opponent)[^,])*?vanguard(?: with "[^"]*" in its card name)?) is placed\b/i, "allyPlacedVC", null, { subjectPlacedVC: true }],
    [/when your ((?:g unit|vanguard|unit)(?: with "[^"]*" in its (?:original )?card name)?|"[^"]+") (?:\[stride\]s?|strides)/i, "allyPlacedVC", null, { subjectPlacedVC: true, whenFrom: "G" }],
    [/when (?:an|your) opponent'?s (.*?)rear-guards? (?:is|are) put into the drop(?: zone)?(?! from)/i, "oppRetired", null, { subject: 1 }],
    [/when your (?:vanguard|unit) (?:\[legion\]|legions)|when this unit (?:\[legion\]|legions)/i, "legion", "VC"],
    [/when this unit becomes in harmony|when this unit is put in harmony/i, "harmonized", "RC"],
    [/when this card becomes an originaldress/i, "originalDress", "RC"],
    [/when (?:this unit|it) (?:\[stand\]|stands|becomes \[stand\])(?=\s*,)/i, "stood", null],
    [/when (?:a|your) card is put into your damage zone/i, "toDamage", null],
    [/when your card is put into your soul by \[?soul-?charge/i, "soulCharged", null],
    [/at the end of each turn/i, "eachTurnEnd", null],
    [/at the beginning of (?:your|the) attack step/i, "attackStep", null],
    [/when (?:its|this unit'?s) attack or the attack (?:it|this unit) boosted hits a vanguard/i, "hitOrBoost", "RC", { conds: [{ type: "targetVC" }] }],
    [/when (?:its|this unit'?s) attack or the attack (?:it|this unit) boosted hits/i, "hitOrBoost", "RC"],
    [/when this card (?:is|becomes) armed/i, "armed", null],
    [/when you play "([^"]+)"/i, "orderPlayed", null, { nameSubject: 1 }],
    [/when (this unit|this card) is put on \(vc\)|when this unit is put on your \(vc\)/i, "placedVC", "VC"],
    [/when (this unit|this card) is put on \(rc\)|when this unit is put on your \(rc\)/i, "placedRC", "RC"],
    [/when (this unit|this card) is put on \(gc\)/i, "placedGC", "GC"],
    [/when (this card|this unit) is put into (your )?soul/i, "toSoul", "soul"],
    [/when this unit intercepts/i, "intercepts", "RC"],
    [/when your (.*?)(vanguard|unit|rear-guard)(?: with "[^"]*" in its card name)? is attacked/i, "allyAttacked", null, { subjectAtt: true }],
    [/at the beginning of (the|your) end phase/i, "endTurn", null],
    [/when this card is put into (the|your) order zone/i, "toOrderZone", "OZ"],
    [/when this unit'?s drive check reveals (an? )?(.*?)(card|unit)?\s*,/i, "driveReveal", "VC", { subject: 2, subjectNoun: 3 }],
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
    [/when your (other )?((?:(?!opponent)[^,])*?)(rear-guards?|units?|<[^>]+>|"[^"]+")((?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)?) (is|are) placed(?: on( your| another)? \(rc\))?(?: from (?:your |the )?(deck|drop zone|drop|soul|hand|bind zone))?( in the same column as this unit)?(?=,| during| by| other|$)|when another (.*?) is placed on your \(rc\)/i, "allyPlacedRC", "RC", { allyPlaced: true }],
    [/when your opponent'?s (.*?)rear-guards? (is|are) placed|when your opponent calls/i, "oppPlacedRC", null, { subject: 1 }],
    [/at the beginning of your main phase/i, "mainStart", null],
    [/at the beginning of your battle phase/i, "battleStart", null],
    [/at the beginning of the guard step|at the beginning of your opponent'?s guard step/i, "guardStart", null],
    [/at the beginning of your (ride phase|turn|stand phase|draw phase)/i, "turnStart", null],
    [/at the beginning of your opponent'?s (turn|ride phase)/i, "oppTurnStart", null],
    [/at the end of the battle (?:that )?(?:this unit|it) attacked a rear-guard/i, "battleEnd", null, { conds: [{ type: "targetRC" }] }],
    [/at the end of the battle (?:that )?(?:this unit|it) attacked a vanguard/i, "battleEnd", null, { conds: [{ type: "targetVC" }] }],
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
    [/when your (.*?)(vanguard|unit|rear-guard)(?: with (?:"[^"]*"(?:,? or )?)+ in its card name)? attacks/i, "allyAttacks", null, { subjectWhole: true }],
    [/when your opponent'?s (.*?)(vanguard|unit|rear-guard) attacks/i, "oppAttacks", null],
    [/at the end of your opponent'?s turn/i, "oppTurnEnd", null],
    [/at the end of (your|that|the) turn|at the end of turn/i, "endTurn", null],
    [/when (this unit|this card) is retired/i, "retired", "RC"],
    [/when your (other )?(.*?)rear-guards? (is|are) retired/i, "allyRetired", null, { subject: 2 }],
    [/when your opponent'?s (.*?)rear-guards? (is|are) retired/i, "oppRetired", null, { subject: 1 }],
    [/when (this card is )?discarded from (your )?hand|when this card is discarded/i, "discarded", "hand"],
    [/when (this card is )?put into (your |the )?soul/i, "toSoul", "soul"],
    [/when your drive check reveals (an? )?(.*?)(card|unit)?\s*,/i, "driveReveal", null, { subject: 2, subjectNoun: 3 }],
    [/when (this card is )?revealed (for|in) a drive check/i, "revealedDrive", "any"],
    [/when your damage check reveals (an? )?(.*?)(card|unit)?\b,/i, "damageReveal", null, { subject: 2, subjectNoun: 3 }],
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
      const close = /,\s*$/.test(m[0]) ? 0 : after.search(/,/); // a pattern that already ends at the comma closes there
      const clause = body.slice(0, m.index + m[0].length + (close >= 0 ? close : 0));
      const rest = close >= 0 ? after.slice(close + 1) : after;
      const ab = { when, zoneHint: zone, conds: [...(extra.conds || [])] };
      if (extra.whenFrom) ab.whenFrom = extra.whenFrom;
      if (extra.whenFromGroup) ab.whenFrom = { deck: "deck", drop: "drop", "drop zone": "drop", soul: "soul", "bind zone": "bind" }[m[extra.whenFromGroup].toLowerCase()];
      if (extra.subject && m[extra.subject] && m[extra.subject].trim()) { const wf = filt((m[extra.subject].trim() + (extra.subjectNoun && m[extra.subjectNoun] ? " " + m[extra.subjectNoun] : "")).replace(/\s+/g, " ")); if (wf) ab.whenFilter = wf; }
      if (extra.subjectAtt) { const wf = filt(m[0].replace(/^when your /i, "").replace(/ is attacked$/i, "")); if (wf) ab.whenFilter = wf; }
      if (extra.subjectVC) { const wf = filt(m[0].replace(/^when your /i, "").replace(/'?s attack hits.*$/i, "")) || {}; ab.whenFilter = wf; ab.conds.push({ type: "unit", who: "attacker", filter: { ...wf } }); }
      if (extra.nameSubject) ab.whenFilter = { nameExact: m[extra.nameSubject] };
      if (extra.allyPlaced) {
        const subj = ((m[2] || "") + " " + (/^[<"]/.test(m[3] || "") ? m[3] : "") + (m[4] || "")).replace(/\s+/g, " ").trim();
        const wf = subj ? filt(subj) : null;
        if (wf && Object.keys(wf).length) ab.whenFilter = wf;
        if (/^"/.test(m[3] || "")) ab.whenFilter = { ...(ab.whenFilter || {}), nameExact: m[3].replace(/"/g, "") };
        if (m[1]) ab.whenFilter = { ...(ab.whenFilter || {}), other: true };
        if (m[8]) ab.whenColumn = true;
        if (m[7]) ab.whenFrom = { deck: "deck", drop: "drop", "drop zone": "drop", soul: "soul", hand: "hand", "bind zone": "bind" }[m[7].toLowerCase()];
      }
      if (extra.column) ab.whenColumn = true;
      if (extra.byVC) { const vf = extra.byVC !== true && m[extra.byVC] ? filt("with " + m[extra.byVC] + " in its card name") : null; ab.whenByVC = vf && Object.keys(vf).length ? vf : true; }
      if (extra.min) ab.whenMin = toNum(m[extra.min]);
      // "by the ability of your grade 3 or greater vanguard with "X" in its card name": a filter on your vanguard
      if (extra.byVCText) { const vf = filt(m[extra.byVCText].replace(/vanguard/i, "")) || {}; ab.whenByVC = Object.keys(vf).length ? vf : true; }
      if (extra.byCard && m[extra.byCard]) ab.whenByCard = filt(m[extra.byCard]) || {};
      if (extra.subjectOther) ab.whenFilter = { ...(ab.whenFilter || {}), other: true };
      if (extra.subjectText && m[extra.subjectText]) { const wf = filt(m[extra.subjectText]); if (wf && Object.keys(wf).length) ab.whenFilter = { ...(ab.whenFilter || {}), ...wf }; }
      if (extra.subjectPlacedVC) {
        const who = String(m[1] || m[2] || "").replace(/original card name/i, "card name").replace(/^"([^"]+)"$/, 'unit named "$1"').trim();
        const wf = filt(who.replace(/^(other )/i, ""));
        if (wf && Object.keys(wf).some((k) => k !== "type")) ab.whenFilter = wf;
      }
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
    if ((m = t.match(/(?:if )?your opponent'?s vanguard is (?:an? )?grade (\d)( or greater)?/i)) || (m = t.match(/if your opponent has an? grade (\d) or greater vanguard/i))) add({ type: "oppVcGrade", n: +m[1] });
    if ((m = t.match(rx(`if the number of rear-guards your opponent has is ${N} or (more|less|fewer)`)))) add({ type: "count", what: "oppRC", op: CMP(m[0]), n: toNum(m[1]) });
    if ((m = t.match(rx(`if the number of your (other )?(.*?)units?(?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)? is ${N} or (more|less|fewer)`))))
      add({ type: "count", what: "myUnits", op: CMP(m[0]), n: toNum(m[3]), filter: { ...(filt(m[0].replace(/ is .*$/i, "").replace(/^if the number of your (other )?/i, "")) || {}), ...(m[1] ? { other: true } : {}) } });
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
    if ((m = t.match(/if your (damage zone|soul|drop( zone)?|hand|order zone|bind zone) has no (face up |face down )?(.*?)cards?/i))) {
      const z = m[1].toLowerCase();
      add({ type: "count", what: z === "damage zone" ? (m[3] && /up/i.test(m[3]) ? "myDamageUp" : m[3] ? "myDamageDown" : "myDamage") : { soul: "mySoul", drop: "myDrop", "drop zone": "myDrop", hand: "myHand", "order zone": "myOrderZone", "bind zone": "myBind" }[z], op: "eq", n: 0, filter: filt(m[4] || "") });
    }
    if ((m = t.match(/if the number of (?:cards in )?your (damage zone|hand|soul|drop|rear-guards)(?: you have)? is (more|greater|less|fewer) than (?:the number of )?(?:cards in )?your opponent'?s/i))
      || (m = t.match(/if the number of (rear-guards) you have is (more|greater|less|fewer) than your opponent'?s/i))
      || (m = t.match(/if you have (more|fewer) (rear-guards) than your opponent/i))) {
      const word = /^(more|fewer)$/i.test(m[1]) ? m[2] : m[1], cmpw = /^(more|fewer)$/i.test(m[1]) ? m[1] : m[2];
      const k = { "damage zone": "Damage", hand: "Hand", soul: "Soul", drop: "Drop", "rear-guards": "RC" }[word.toLowerCase()];
      add({ type: "countVs", what: "my" + k, vs: "opp" + k, op: /more|greater/i.test(cmpw) ? "gt" : "lt" });
    }
    if (/if this unit is boosted/i.test(t)) add({ type: "boosted" });
    if (/during the battle (that )?this unit attacked/i.test(t)) add({ type: "inBattleAtt" });
    if (/during the battle (that )?this unit boosted/i.test(t)) add({ type: "inBattleBoost" });
    const zoneKey = (z) => ({ soul: "mySoul", drop: "myDrop", "drop zone": "myDrop", hand: "myHand", "order zone": "myOrderZone", "damage zone": "myDamage", "bind zone": "myBind" })[String(z).toLowerCase()];
    if (!out.some((c) => c.type === "count") && ((m = t.match(/if (?:there is|you have) an? (?:card named )?"([^"]+)" in your (soul|drop zone|drop|hand|order zone|damage zone|bind zone)/i))
      || (m = t.match(/if there is a card named "([^"]+)" in your (soul|drop zone|drop|hand|order zone|damage zone|bind zone)/i))))
      add({ type: "count", what: zoneKey(m[2]), op: "ge", n: 1, filter: { nameExact: m[1] } });
    if (!out.some((c) => c.type === "count") && (m = t.match(/if your (soul|drop zone|drop|hand|order zone|damage zone|bind zone) has (an?|two|three|four|five|\d+)(?: or more)? "([^"]+)"/i)))
      add({ type: "count", what: zoneKey(m[1]), op: "ge", n: toNum(m[2]), filter: { nameExact: m[3] } });
    if (!out.some((c) => c.type === "count") && (m = t.match(rx(`if the number of (.*?) in your (soul|drop zone|drop|hand|order zone|damage zone|bind zone) is ${N} or (more|greater|less|fewer)`))))
      add({ type: "count", what: zoneKey(m[2]), op: CMP(m[0]), n: toNum(m[3]), filter: filt(m[1]) });
    if ((m = t.match(/if you have another unit with "([^"]+)" in its card name/i))) add({ type: "count", what: "myUnits", op: "ge", n: 1, filter: { name: m[1], other: true } });
    if ((m = t.match(/if you have no (face up |face down )?(.*?)cards? in your (damage zone|soul|drop|hand|bind zone)/i)))
      add({ type: "count", what: /damage/i.test(m[3]) ? (m[1] && /up/i.test(m[1]) ? "myDamageUp" : m[1] ? "myDamageDown" : "myDamage") : zoneKey(m[3]), op: "eq", n: 0, filter: filt(m[2] || "") });
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
    if ((m = t.match(rx(`if your order zone has ${N} or more`)))) add({ type: "orderZone", n: toNum(m[1]) });
    // round 1 (official card list): frequent condition wordings
    if ((m = t.match(/if you have (?:an?|the) ((?:"[^"]+"(?:,? (?:or|and) )?)+) on your (?:\(VC\)(?: or \(RC\))?|\(RC\)|field|circles?)/i)))
      add({ type: "count", what: /^\(RC\)$/i.test(t.match(/on your (\([A-Z]+\))/i)?.[1] || "") && !/\(VC\)/i.test(m[0]) ? "myRC" : "myUnits", op: "ge", n: 1, filter: { names: [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) } });
    if ((m = t.match(/if you have another unit named "([^"]+)" on your \(RC\)/i))) add({ type: "count", what: "myRC", op: "ge", n: 1, filter: { nameExact: m[1], other: true } });
    if (/if this unit is on \(VC\)/i.test(t)) add({ type: "onVC" });
    else if (/if this unit is on \(RC\)/i.test(t)) add({ type: "onRC" });
    if ((m = t.match(/if the number of (?:cards in )?your (damage zone|hand|soul|drop|rear-guards) is (more|greater|less|fewer) than or equal to (?:the number of )?(?:cards in )?your opponent'?s/i)))
      add({ type: "countVs", what: "my" + { "damage zone": "Damage", hand: "Hand", soul: "Soul", drop: "Drop", "rear-guards": "RC" }[m[1].toLowerCase()], vs: "opp" + { "damage zone": "Damage", hand: "Hand", soul: "Soul", drop: "Drop", "rear-guards": "RC" }[m[1].toLowerCase()], op: /more|greater/i.test(m[2]) ? "ge" : "le" });
    if (/if your opponent has no rear-guards/i.test(t)) add({ type: "count", what: "oppRC", op: "eq", n: 0 });
    if ((m = t.match(/if your vanguard'?s grade is (less|lower|greater|higher) than (?:or equal to )?your opponent'?s vanguard'?s grade/i)))
      add({ type: "gradeVs", op: /less|lower/i.test(m[1]) ? (/or equal/i.test(m[0]) ? "le" : "lt") : (/or equal/i.test(m[0]) ? "ge" : "gt") });
    if ((m = t.match(/if your [Ww]orld is ([A-Z][A-Za-z ]+?)(?: or ([A-Z][A-Za-z ]+?))?(?=,|\.|$)/))) add({ type: "world", text: [m[1], m[2]].filter(Boolean).join("|") });
    // round 3 conditions
    if ((m = t.match(/if you have an? "([^"]+)" crest/i))) add({ type: "count", what: "myCrest", op: "ge", n: 1, filter: { nameExact: m[1] } });
    if ((m = t.match(/if you have an? face up card (?:named "([^"]+)"|with "([^"]+)" in its card name) in your damage zone/i))) add({ type: "count", what: "myDamageUp", op: "ge", n: 1, filter: m[1] ? { nameExact: m[1] } : { name: m[2] } });
    if (/if your opponent'?s front row has no rear-guards/i.test(t)) add({ type: "count", what: "oppFrontRC", op: "eq", n: 0 });
    if ((m = t.match(/if it is the first battle of (?:that|this|the) turn/i))) add({ type: "count", what: "battleNo", op: "eq", n: 1 });
    if (!out.some((c) => c.what === "battleNo") && (m = t.match(/if it is the (second|third|fourth|fifth|\d+)(?:st|nd|rd|th)? battle of this turn( or (more|later))?/i)))
      add({ type: "count", what: "battleNo", op: m[2] ? "ge" : "eq", n: { second: 2, third: 3, fourth: 4, fifth: 5 }[m[1].toLowerCase()] || +m[1] });
    if ((m = t.match(/if the number of (?:cards in )?your (damage zone|hand|soul|drop|rear-guards) is equal to or (more|greater|less|fewer) than (?:the number of )?(?:cards in )?your opponent'?s/i)))
      add({ type: "countVs", what: "my" + { "damage zone": "Damage", hand: "Hand", soul: "Soul", drop: "Drop", "rear-guards": "RC" }[m[1].toLowerCase()], vs: "opp" + { "damage zone": "Damage", hand: "Hand", soul: "Soul", drop: "Drop", "rear-guards": "RC" }[m[1].toLowerCase()], op: /more|greater/i.test(m[2]) ? "ge" : "le" });
    if (/if you have another unit with the same card name as this unit/i.test(t)) add({ type: "count", what: "myUnits", op: "ge", n: 1, filter: { sameNameSelf: true, other: true } });
    if (/if your opponent has an? locked card/i.test(t)) add({ type: "count", what: "oppLocked", op: "ge", n: 1 });
    if ((m = t.match(rx(`if you have ${N} or (more|less|fewer) locked cards`)))) add({ type: "count", what: "myLocked", op: CMP(m[0]), n: toNum(m[1]) });
    if ((m = t.match(rx(`if you have ${N} rear-guards$`)))) add({ type: "count", what: "myRC", op: "ge", n: toNum(m[1]) });
    if ((m = t.match(/if "([^"]+)" is in your (soul|drop|hand|damage zone|bind zone|order zone)/i))) add({ type: "count", what: zoneKey(m[2]), op: "ge", n: 1, filter: { nameExact: m[1] } });
    if (/if it is your battle phase/i.test(t)) add({ type: "battlePhase" });
    // "if this unit was placed by riding from "X" this turn", "if your vanguard was placed this turn by riding from a grade 3"
    if ((m = t.match(/if (?:this unit|your vanguard) was placed (?:this turn )?by riding from (?:a |an )?(.+?)(?: this turn)?(?=,|$)/i)))
      add({ type: "rodeFrom", filter: /^"[^"]+"$/.test(m[1].trim()) ? { nameExact: m[1].trim().replace(/"/g, "") } : filt(m[1]) || {} });
    if (/if it is your main phase/i.test(t)) add({ type: "mainPhase" });
    if (!out.some((c) => c.type === "count") && (m = t.match(/if you have an? (?:card|unit) with "([^"]+)" in its card name in your (soul|drop zone|drop|hand|damage zone|bind zone|order zone)/i)))
      add({ type: "count", what: zoneKey(m[2]), op: "ge", n: 1, filter: { name: m[1] } });
    if ((m = t.match(rx(`if the number of other (.*?)rear-guards you have is ${N} or (more|less|fewer)`)))) add({ type: "count", what: "myRC", op: CMP(m[0]), n: toNum(m[2]), filter: { ...(filt(m[1]) || {}), other: true } });
    if ((m = t.match(rx(`if you have ${N} or (more|less|fewer) cards in (?:your )?hand`)))) add({ type: "count", what: "myHand", op: CMP(m[0]), n: toNum(m[1]) });
    // round 3: "if you have four or more cards in your damage zone", "if the number of cards in your soul with "X" in its card name is three or more"
    if (!out.some((c) => c.type === "count") && (m = t.match(rx(`if you have ${N} or (more|less|fewer) (.*?)cards? in your (soul|drop zone|drop|damage zone|bind zone|order zone)`))))
      add({ type: "count", what: zoneKey(m[4]), op: CMP(m[0]), n: toNum(m[1]), filter: filt(m[3] || "") });
    if (!out.some((c) => c.type === "count") && (m = t.match(rx(`if the number of (.*?)cards? in your (soul|drop zone|drop|hand|order zone|damage zone|bind zone)( with "[^"]+" in (?:its|their) card names?)? is ${N} or (more|greater|less|fewer)`))))
      add({ type: "count", what: zoneKey(m[2]), op: CMP(m[0]), n: toNum(m[4]), filter: filt((m[1] || "") + (m[3] || "")) });
    if ((m = t.match(rx(`if the number of your (other )?(.*?)rear-guards is ${N} or (more|less|fewer)`)))) add({ type: "count", what: "myRC", op: CMP(m[0]), n: toNum(m[3]), filter: { ...(filt(m[2]) || {}), ...(m[1] ? { other: true } : {}) } });
    return { conds: out, read };
  }

  // ---------- costs ("[COST][Counter-Blast 1 & discard a card from your hand]") ----------
  function costsIn(s) {
    const out = [], unread = [];
    for (const part of s.split(/\s*&\s*/)) {
      const p = part.trim().replace(/^\[|\]$/g, "");
      if (!p) continue;
      let m;
      // "Counter-Blast 1-card with "Eradicator" in its card name": only those cards may be paid
      const paidWith = (q) => { const k = q.match(/[-‐–]\s*cards? with "([^"]+)" in (?:its|their) card names?/i) || q.match(/[-‐–]\s*"([^"]+)"/); return k ? { filter: { name: k[1] } } : {}; };
      if ((m = p.match(/^counter-blast (\d+)/i))) out.push({ type: "CB", n: +m[1], ...paidWith(p) });
      else if ((m = p.match(/^soul-blast (\d+)/i))) out.push({ type: "SB", n: +m[1], ...paidWith(p) });
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
      else if ((m = p.match(rx(`^choose (${N}) face down (.*?) (?:from|in) your g zone,? and turn (?:it|them) face up`)))) out.push({ type: "gFaceUp", n: toNum(m[1]), filter: filt(m[3].replace(/^cards?\b/i, "")) });
      else if ((m = p.match(rx(`^turn (${N}) (.*?)cards? (?:from|in) (?:your )?g zone (?:with .*? )?face up`)))) out.push({ type: "gFaceUp", n: toNum(m[1]), filter: filt(m[3] || "") });
      else if ((m = p.match(rx(`^choose (${N}) of your (other )?(.*?)rear-guards?,? and retire (it|them)`)))) out.push({ type: "retireRC", n: toNum(m[1]) });
      else if (/^\[?rest\]? this (unit|card)/i.test(p)) out.push({ type: "restSelf" });
      else if ((m = p.match(/^(counter|soul)-blast$/i))) out.push({ type: m[1].toLowerCase() === "counter" ? "CB" : "SB", n: 1 });
      else if (/^\[?rest\]?$/i.test(p)) out.push({ type: "restSelf" }); // "[COST][Rest]": rest this unit
      // "choose one or more cards from hand with the sum of their grades being 3 or greater, and discard them"
      else if ((m = p.match(/^choose one or more cards from (?:your )?hand with the sum of their grades being (\d+) or greater,? and discard them/i)) || (m = p.match(/^choose one or more cards with the sum of their grades being (\d+) or greater from your hand,? and discard them/i)))
        out.push({ type: "discardGrades", n: +m[1] });
      else if ((m = p.match(rx(`^reveal (${N} |a |an )?(.*?cards?(?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)?) from (?:your )?hand`)))) out.push({ type: "move", from: "hand", to: "hand", n: m[1] && /\d|two|three|four|five/i.test(m[1]) ? toNum(m[1].trim()) : 1, reveal: true, filter: filt(m[m.length - 1] || "") });
      // "choose one of your (other) rear-guards (with "X" in its card name), and put it into your soul / retire it / [Rest] it"
      else if ((m = p.match(rx(`^choose ${N} of your (other )?(.*?)rear-guards?(?: (?:with|named) [^,]*)?,? and (put (?:it|them) into (?:your )?soul|retire (?:it|them)|put (?:it|them) on the bottom of (?:your |the )?deck|return (?:it|them) to (?:your )?hand|\\[rest\\] (?:it|them))`)))) {
        const f = filt(p.replace(/,? and .*$/i, "").replace(/^choose \S+ of your /i, "")) || {};
        if (m[2]) f.other = true;
        const to = /soul/i.test(m[4]) ? "soul" : /retire/i.test(m[4]) ? "drop" : /bottom/i.test(m[4]) ? "deckBottom" : /hand/i.test(m[4]) ? "hand" : "rest";
        out.push(to === "drop" ? { type: "retireRC", n: toNum(m[1]), filter: f } : to === "rest" ? { type: "restRC", n: toNum(m[1]), filter: f } : { type: "move", from: "myRC", to, n: toNum(m[1]), filter: f });
      }
      else if ((m = p.match(rx(`^retire (?:${N} |an?)?(other|another) (.*?)rear-guards?`)))) out.push({ type: "retireRC", n: m[1] ? toNum(m[1]) : 1, filter: { ...(filt(m[3] || "") || {}), other: true } });
      else if ((m = p.match(rx(`^(?:choose ${N} (.*?)cards? from your damage zone,? and put (?:it|them)|put ${N} (.*?)cards? from your damage zone) on the (top|bottom) of (?:your|the) deck`))))
        out.push({ type: "move", from: "damage", to: m[5].toLowerCase() === "top" ? "deckTop" : "deckBottom", n: toNum(m[1] || m[3]), filter: filt(m[2] || m[4] || "") });
      else if ((m = p.match(rx(`^bind ${N} (.*?)cards? from your (drop|soul|hand|damage zone)`)))) out.push({ type: "move", from: { drop: "drop", soul: "soul", hand: "hand", "damage zone": "damage" }[m[3].toLowerCase()], to: "bind", n: toNum(m[1]), filter: filt(m[2] || "") });
      else if ((m = p.match(rx(`^put (?:the top )?${N} cards? from the top of your deck into (?:your )?(drop|soul|damage zone)`)))) out.push({ type: "move", from: "deckTop", to: /soul/i.test(m[2]) ? "soul" : /damage/i.test(m[2]) ? "damageUp" : "drop", n: toNum(m[1]) });
      else if (/^return this (unit|card) to (your )?hand/i.test(p)) out.push({ type: "move", from: "self", to: "hand" });
      else if (/^remove this (unit|card)/i.test(p)) out.push({ type: "move", from: "self", to: "removed" });
      else if ((m = p.match(rx(`^put ${N} (.*?)cards? from your (hand|soul|drop) into (?:your )?(drop|soul)`)))) out.push({ type: "move", from: m[3].toLowerCase(), to: m[4].toLowerCase(), n: toNum(m[1]), filter: filt(m[2] || "") });
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
      if (pm[6]) return { per: /units/i.test(pm[6]) ? "myUnits" : "myRC", perFilter: filt(pm[5] || "") };
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
    if ((m = t.match(/^choose (?:an?|one|up to one) (?:of your )?opponent'?s (.*?)rear-guards?$/i))) { ctx.last = { target: "chooseOppRC", n: 1, ...(/up to/i.test(t) ? { upTo: true } : {}), filter: filt(m[1]) || {} }; ctx.lastUsed = false; return []; }
    if ((m = t.match(/^choose (?:a|one|up to one) rear-guards? in your opponent'?s front row$/i))) { ctx.last = { target: "chooseOppFrontRC", n: 1 }; ctx.lastUsed = false; return []; }
    // stats
    const outs = [];
    if ((m = t.match(/\[Power\] ([+-])\s*([\d,]+)/i))) outs.push({ type: "power", amount: (m[1] === "-" ? -1 : 1) * +m[2].replace(/,/g, ""), dur, ...who(), ...per });
    if ((m = t.match(/\[Critical\] ([+-])\s*(\d+)/i))) outs.push({ type: "crit", amount: (m[1] === "-" ? -1 : 1) * +m[2], dur, ...who(), ...per });
    if ((m = t.match(/\[Shield\] \+\s*([\d,]+)/i)) && !/\[Power\]/i.test(t)) outs.push({ type: "shield", amount: +m[1].replace(/,/g, "") });
    if ((m = t.match(/drive ([+-])(\d+)/i))) outs.push({ type: "drive", amount: (m[1] === "-" ? -1 : 1) * +m[2] });
    if (outs.length) return outs;
    // resources
    if ((m = t.match(rx(`^draw ${N} cards?`))) || (m = t.match(/^draw (a|one) card/i))) return [{ type: "draw", n: toNum(m[1]), ...per }];
    if ((m = t.match(/^counter-charge (\d+)/i))) return [{ type: "CC", n: +m[1], ...per }];
    // round 1: "choose a card from your damage zone, and turn it face up" = Counter-Charge; the rest of these were common unread steps
    if ((m = t.match(rx(`^choose (?:up to )?${N} (?:face down )?(?:cards? )?(?:from|in) your damage zone,? and turn (?:it|them) face up`)))) return [{ type: "CC", n: toNum(m[1]) }];
    if ((m = t.match(rx(`^choose (?:up to )?${N} (?:face down )?cards? (?:from|in) your damage zone$`)))) { ctx.lastDamage = toNum(m[1]); return []; }
    if ((m = t.match(rx(`^put (up to )?${N} (.*?)cards? from your (hand|drop|soul) into (?:your |the )?(soul|drop|hand)$`))))
      return [{ type: "move", from: m[4].toLowerCase(), to: m[5].toLowerCase(), n: toNum(m[2]), upTo: !!m[1], filter: filt(m[3] || "") }];
    if ((m = t.match(rx(`^choose (up to )?(${N} |)(?:an)?other of your (.*?)$`))) && /<|"|rear-guard|unit/i.test(m[4])) {
      ctx.last = { target: /rear-guard/i.test(m[4]) ? "chooseMyRC" : "chooseMy", n: m[2] ? toNum(m[2].trim()) : 1, filter: { ...(filt(m[4]) || {}), other: true } }; ctx.lastUsed = false; return [];
    }
    if (/^turn (it|them) face up$/i.test(t) && ctx.lastDamage) return [{ type: "CC", n: ctx.lastDamage }];
    if ((m = t.match(rx(`^put the top (?:${N} )?cards? of your deck (face (?:down|up) )?into your damage zone`)))) return [{ type: "move", from: "deckTop", to: /up/i.test(m[2] || "") ? "damageUp" : "damageDown", n: m[1] ? toNum(m[1]) : 1 }];
    if (/^remove this card( from the game)?$/i.test(t)) return [{ type: "move", from: "self", to: "removed" }];
    if (/^bind this (unit|card)$/i.test(t)) return [{ type: "move", from: "self", to: "bind" }];
    // "get an Imaginary Gift:Force, put that marker on your (VC)", "you get two Imaginary Gift:Accel"
    if ((m = t.match(/^(?:you )?get (an?|one|two|three) imaginary gifts*:?s*(force|accel|protect)/i))) return Array.from({ length: toNum(m[1]) }, () => ({ type: "gift", kind: m[2].toLowerCase() }));
    if (/^put (that|the) marker on your (VC)$/i.test(t)) return [];
    if ((m = t.match(/^deal (one|two|three|d+) damage(?: to (?:your opponent|that unit|it|the vanguard))?$/i))) return [{ type: "dealDamage", n: toNum(m[1]), who: "opp" }];
    if (/^choose (one of )?your opponent'?s vanguards?$/i.test(t)) { ctx.last = { target: "oppVc" }; ctx.lastUsed = false; return []; }
    if (/^return this (unit|card) to (your|the) deck$/i.test(t)) return [{ type: "move", from: "self", to: "deck" }];
    if (/^return (it|that unit|them) to (your|the|his or her|its owner'?s) deck$/i.test(t))
      return ctx.last ? [{ type: "move", from: /Opp/.test(ctx.last.target || "") ? "oppRC" : "myRC", to: "deck", n: ctx.last.n || 1, filter: ctx.last.filter }] : [{ type: "move", from: "self", to: "deck" }];
    if ((m = t.match(/^(this unit|it|they) cannot be retired by (?:card )?effects$/i))) return [{ type: "restrict", what: "cantBeRetired", dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    // "choose one of your opponent's rear-guards, your opponent puts that unit on the bottom of his or her deck": the chosen unit moves
    if (ctx.last && /^your opponent puts (that unit|those units|it|them) /i.test(t)) return effectOf(t.replace(/^your opponent puts/i, "put"), ctx);
    if (/^choose an? units? being attacked$/i.test(t)) { ctx.last = { target: "attacked" }; ctx.lastUsed = false; return []; }
    if ((m = t.match(/(this unit|it|they) (?:gets? "boost",? and )?can intercept from the back row/i))) return [{ type: "restrict", what: "canInterceptBack", dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }, ...(/"boost"/i.test(t) ? [{ type: "restrict", what: "canBoost", dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }] : [])];
    if (/^can intercept from the back row$/i.test(t)) return [{ type: "restrict", what: "canInterceptBack", dur, ...(ctx.last ? { ...ctx.last } : { target: "self" }) }];
    if (/your opponent cannot call sentinels(?: to \(GC\))? from (?:his or her |their )?hand/i.test(t))
      return [{ type: "playerRule", who: "opp", what: "cantGuard", filter: { sentinel: "yes" }, dur: /for the battle|until end of (that|the) battle/i.test(t) ? "battle" : dur }];
    if ((m = t.match(rx(`^call (up to )?${N} (.*?)(?:cards? )?(?:with "([^"]+)" in (?:its|their) card names? )?(?:from your hand )?to \\(RC\\)(?: from your hand)?$`))) && /hand/i.test(t))
      return [{ type: "callFromHand", n: toNum(m[2]), filter: { ...(filt(m[3] || "") || {}), ...(m[4] ? { name: m[4] } : {}) } }];
    if ((m = t.match(/^soul-charge (\d+)/i))) return [{ type: "SC", n: +m[1], ...per }];
    if ((m = t.match(/^energy-charge (\d+)/i))) return [{ type: "EC", n: +m[1], ...per }];
    // stand / rest / retire / bind / lock
    if ((m = t.match(/^choose (one|a|up to one) of your (.*?)(?:units? )?(?:that is |which is )?being attacked/i))) { ctx.last = { target: "attacked", filter: filt(m[2]) }; ctx.lastUsed = false; return []; }
    if ((m = t.match(rx(`^choose (up to )?${N} of your (<+[^>]+>+)$`)))) { ctx.last = { target: "chooseMy", n: toNum(m[2]), filter: { clan: m[3].replace(/[<>]/g, "").trim() } }; ctx.lastUsed = false; return []; }
    if ((m = t.match(/(this unit|it|they) gets? "(boost|intercept)"/i))) return [{ type: "restrict", what: /boost/i.test(m[2]) ? "canBoost" : "canIntercept", dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if ((m = t.match(/(this unit|it|they|that unit) cannot be chosen by (your )?opponent'?s/i))) return [{ type: "restrict", what: "cantBeChosen", dur: /until end/i.test(t) ? dur : "game", ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if ((m = t.match(/(this unit|it|they|that unit) cannot \[stand\] during (your|your opponent'?s) next stand phase/i))) return [{ type: "restrict", what: "cantStand", dur: /opponent/i.test(m[2]) ? "oppTurn" : "nextTurn", ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if ((m = t.match(/(this unit|it|they) can attack from the back row/i))) return [{ type: "restrict", what: "canAttackBack", dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if (/he or she must call two or more|must call two or more (cards )?(from hand )?(to \(gc\) )?at the same time/i.test(t)) return [{ type: "playerRule", who: "opp", what: "mustGuard2", dur }];
    if (/^when your opponent would call cards from hand to \(gc\)$/i.test(t)) return [];
    if (/^(this card is (also )?regarded as "[^"]+"|this card is (regarded as being )?from all clans.*)$/i.test(t)) return []; // card fields (Also named / All clans)
    if (/^this unit is (also )?regarded as "[^"]+"$/i.test(t) && ctx.unconditional) return []; // card field Also named
    if (/^\[stand\] (this unit|it|them|that unit|your vanguard|all)/i.test(t)) return [{ type: "stand", ...(/this unit/i.test(t) ? { target: "self" } : /vanguard/i.test(t) ? { target: "vc" } : it()) }];
    if (/^\[rest\] (this unit)$/i.test(t)) return [{ type: "rest", target: "self" }];
    if (/^\[rest\] (it|them|that unit|this unit)/i.test(t)) return [{ type: "rest", ...(/this unit/i.test(t) ? { target: "self" } : it()) }];
    if (/^retire (it|them|that unit|those units)$/i.test(t) && ctx.last) return [{ type: "retire", ...useLast() }];
    if (/^retire that unit$/i.test(t)) return [{ type: "retire", target: "eventUnit" }]; // the unit the timing is about
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
    // round 3: "call up to one card from among them to (RC)", "call it to a (RC) as [Rest]"
    if (ctx.look && (m = t.match(rx(`^call (up to )?${N} (.*?)(?:cards?|units?)? from among them to (?:an? |an open )?\\(rc\\)( as \\[rest\\])?`)))) {
      const L = ctx.look; const e = { type: "move", from: "deckTop", look: L.n, n: toNum(m[2]), upTo: !!m[1], to: "RC", filter: { ...(L.filter || {}), ...(filt(m[3] || "") || {}) }, rest: "shuffle", ...(m[4] ? { asRest: true } : {}) };
      ctx.lookMove = e; return [e];
    }
    if (ctx.look && /^(you may )?call (it|that card|them) to (a |an open |an? )?\(rc\)( as \[rest\])?$/i.test(t)) {
      const L = ctx.look; const e = { type: "move", from: "deckTop", look: L.n, n: L.pick || 1, upTo: true, to: "RC", filter: L.filter, rest: "top", ...(/\[rest\]/i.test(t) ? { asRest: true } : {}) };
      ctx.lookMove = e; return [e];
    }
    if (ctx.look && /^(you may )?call (it|that card|them) to( an open)? \(rc\)$/i.test(t)) { const L = ctx.look; const e = { type: "move", from: "deckTop", look: L.n, n: L.pick || 1, upTo: true, to: "RC", filter: L.filter, rest: "top" }; ctx.lookMove = e; return [e]; }
    if (ctx.look && (m = t.match(rx(`^(?:choose|reveal|search for) (up to )?${N} (.*?)(?:cards?|units?|orders?)? from among (?:them|it)`)))) { ctx.look.pick = toNum(m[2]); ctx.look.upTo = !!m[1]; ctx.look.filter = filt(m[3]); return []; }
    if (ctx.look && /^(reveal (it|them),? and )?(put (it|them) into (your )?hand|call (it|them) to( an open)? \(rc\)|put (it|them) into (your )?soul|put (it|them) into (your )?drop|put (it|them) on the (top|bottom) of (your|the) deck)/i.test(t)) {
      const to = /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : /soul/i.test(t) ? "soul" : /drop/i.test(t) ? "drop" : /bottom/i.test(t) ? "deckBottom" : "deckTop";
      const L = ctx.look;
      const e = { type: "move", from: "deckTop", look: L.n, n: L.pick || 1, upTo: L.upTo !== false, to, filter: L.filter, reveal: /reveal/i.test(t), rest: "shuffle" };
      ctx.lookMove = e;
      return [e];
    }
    if (ctx.pick && /^put (it|them) on the top or bottom of (your|the) deck/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "move", from: P.from, to: "deckBottom", n: P.n, upTo: P.upTo, filter: P.filter }]; }
    if (ctx.look && (m = t.match(rx(`^put (up to )?${N} (.*?)cards? from among them (into (your )?(hand|soul|drop)|on the (top|bottom) of (your|the) deck)`)))) {
      const L = ctx.look;
      const to = /hand/i.test(m[4]) ? "hand" : /soul/i.test(m[4]) ? "soul" : /drop/i.test(m[4]) ? "drop" : /bottom/i.test(m[4]) ? "deckBottom" : "deckTop";
      const e = { type: "move", from: "deckTop", look: L.n, n: toNum(m[2]), upTo: !!m[1], to, filter: filt(m[3]), rest: "shuffle" };
      ctx.lookMove = e;
      return [e];
    }
    if (ctx.lookMove && /^discard the rest$/i.test(t)) { ctx.lookMove.rest = "drop"; return []; }
    if (ctx.look && (m = t.match(rx(`^search for (up to )?${N} (.*?)(?:cards?|units?)?(?: with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?)?$`)))) {
      ctx.look.pick = toNum(m[2]); ctx.look.upTo = !!m[1]; ctx.look.filter = filt(t.replace(/^search for (up to )?\S+ /i, "")); return [];
    }
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
    if (ctx.search && /^(reveal (it|them)(,| and| to your opponent,? and)? )?(put (it|them) into (your )?hand|call (it|them) to( an open| separate| separate open| open)? \(rc\)|put (it|them) into (your )?soul)/i.test(t)) {
      const s = ctx.search; ctx.search = null;
      return [{ type: "move", from: "deck", to: /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : "soul", n: s.n, upTo: true, filter: s.filter, reveal: /reveal/i.test(t) }];
    }
    // choose … from your drop / soul / damage zone / hand → hand / RC / soul / deck
    if ((m = t.match(rx(`^choose (up to )?${N} (.*?)(?:cards?|units?)? from (your |your opponent'?s |)(drop( zone)?|soul|damage zone|hand|bind zone|ride deck)`)))) {
      const zone = m[5].toLowerCase() === "ride deck" ? "rideDeck" : m[5].toLowerCase().replace(" zone", "");
      let tail = t.slice(m[0].length);
      // the filter may come after the zone: "from your soul with "Silver Thorn" in its card name"
      const after = tail.match(/^\s*(with (?:"[^"]+"(?:,? or )?)+ in (?:its|their) card names?|named "[^"]+")/i);
      if (after) tail = tail.slice(after[0].length);
      ctx.pick = { from: (/opponent/i.test(m[4]) ? "opp" + zone[0].toUpperCase() + zone.slice(1) : zone).replace(/^oppDrop$/, "oppDrop"), n: toNum(m[2]), upTo: !!m[1], filter: { ...(filt(m[3]) || {}), ...(after ? filt(after[1]) || {} : {}) } };
      if (!tail.trim()) return [];
      return effectOf(tail.replace(/^,?\s*(and )?/, ""), ctx);
    }
    if (ctx.pick && /^(reveal it,? and )?(put (it|them) into (your )?(hand|soul|drop)|call (it|them) to( an open| separate open| separate| open| an?)? \(rc\)|put (it|them) on the (top|bottom) of (your|the) deck|bind (it|them)|put (it|them) into (your |the )?damage zone|put (it|them) into (your |the )?order zone)/i.test(t)) {
      const P = ctx.pick; ctx.pick = null;
      const to = /order zone/i.test(t) ? "orderZone" : /hand/i.test(t) ? "hand" : /\(rc\)/i.test(t) ? "RC" : /soul/i.test(t) ? "soul" : /bottom/i.test(t) ? "deckBottom" : /top/i.test(t) ? "deckTop" : /bind/i.test(t) ? "bind" : /damage/i.test(t) ? "damageUp" : "drop";
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
    if ((m = t.match(rx(`^put the top (${N} )?cards? of your deck into (your |the )?(soul|drop zone|drop|damage zone)`)))) return [{ type: "move", from: "deckTop", look: m[2] ? toNum(m[2]) : 1, n: m[2] ? toNum(m[2]) : 1, all: true, to: /soul/i.test(m[4]) ? "soul" : /drop/i.test(m[4]) ? "drop" : "damageUp" }];
    if (/^put this (unit|card) on the bottom of (your |the )?deck/i.test(t)) return [{ type: "move", from: "self", to: "deckBottom" }];
    if ((m = t.match(rx(`^put (this unit|this card) into (your )?(soul|hand|drop)`)))) return [{ type: "move", from: "self", to: m[3].toLowerCase() }];
    if ((m = t.match(/^return (this unit|this card) to (your )?hand/i))) return [{ type: "move", from: "self", to: "hand" }];
    if ((m = t.match(/^put (it|them|that unit) on the (top|bottom) of (your|the|his or her|their) deck/i)) && ctx.last) return [{ type: "move", from: ctx.last.target && ctx.last.target.includes("Opp") ? "oppRC" : "myRC", to: m[2].toLowerCase() === "top" ? "deckTop" : "deckBottom", n: ctx.last.n || 1, filter: ctx.last.filter }];
    // restrictions / rules
    if (/cannot be hit/i.test(t)) return [{ type: "cantBeHit" }];
    if ((m = t.match(/^your opponent cannot call (.*?)(?:cards?|units?) (from (his or her |their )?hand )?to \(gc\)/i))) return [{ type: "playerRule", who: "opp", what: "cantGuard", dur, filter: filt(m[1]) }];
    if (/^your opponent cannot intercept/i.test(t)) return [{ type: "playerRule", who: "opp", what: "cantIntercept", dur }];
    if ((m = t.match(/(this unit|it|they) cannot (attack|boost|intercept|be attacked|stand)/i))) return [{ type: "restrict", what: { attack: "cantAttack", boost: "cantBoost", intercept: "cantIntercept", "be attacked": "cantBeAttacked", stand: "cantStand" }[m[2].toLowerCase()], dur, ...(/this unit/i.test(m[1]) ? { target: "self" } : it()) }];
    if (/gets? \[resist\]/i.test(t)) return [{ type: "restrict", what: "resist", dur, ...it({ target: "self" }) }];
    // tokens / tickets / states / ride / misc
    if ((m = t.match(rx(`^call (up to )?${N} "?([^"]+?)"? tokens? to (an open |your )?\\(rc\\)`)))) return [{ type: "token", name: m[3].trim(), n: toNum(m[2]), where: m[4] && /open/i.test(m[4]) ? "empty" : "any" }];
    if ((m = t.match(/^put an? "?([^"]+?)"? ticket into (your )?hand/i))) return [{ type: "ticket", name: m[1].trim(), n: 1, who: "me" }];
    if ((m = t.match(/(?:it|they|this unit) becomes? (?:in )?(?:the )?\[([^\]]+)\] state/i))) return [{ type: "setState", name: m[1], dur, ...it({ target: "self" }) }];
    if ((m = t.match(/^ride (it|this card) as \[(stand|rest)\]/i))) { const P = ctx.pick; ctx.pick = null; return [{ type: "rideBy", from: P ? P.from : "self", stand: /stand/i.test(m[2]), ...(P && P.filter && Object.keys(P.filter).length ? { filter: P.filter } : {}) }]; }
    if (ctx.pick && /^ride (it|that card)$/i.test(t)) { const P = ctx.pick; ctx.pick = null; return [{ type: "rideBy", from: P.from, ...(P.filter && Object.keys(P.filter).length ? { filter: P.filter } : {}) }]; }
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
      if (!q && depth === 0 && ch === ",") { out.push(cur); cur = ""; continue; }
      if (!q && depth === 0 && (ch === "." || ch === "!") && (s[i + 1] === " " || i === s.length - 1)) { out.push(cur, "§"); cur = ""; continue; }
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
    if (/this ability may only be used by a card with the same (card )?name once a turn/i.test(rest)) { ab.once = "nameTurn"; rest = rest.replace(/,?\s*this ability may only be used by a card with the same (card )?name once a turn\.?/i, ""); }
    if (/this ability cannot be used for the rest of (that|the) turn/i.test(rest)) { ab.once = "turn"; rest = rest.replace(/,?\s*this ability cannot be used for the rest of (that|the) turn\.?/i, ""); }
    // "(This effect is mandatory)": no "you may"
    if (/\(this (effect|ability) is mandatory\)/i.test(rest)) { ab.forceMandatory = true; rest = rest.replace(/\s*\(this (effect|ability) is mandatory\)\.?/gi, ""); }
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
    // "[Counter-Blast 1]-card with "X" in its card name]": only cards with that name may be paid (the blast cost gets a filter)
    const named = rest.match(/^[-‐–]\s*cards? with "([^"]+)" in (?:its|their) card names?\]\s*/i);
    if (named) {
      const blast = [...ab.costs].reverse().find((c) => c.type === "CB" || c.type === "SB");
      if (blast) blast.filter = { name: named[1] }; else unread.push(`the cards paid must have "${named[1]}" in their names`);
      rest = rest.slice(named[0].length);
    }
    // leading "during your (opponent's) turn / main phase / battle phase," before the timing
    const lead = rest.match(/^during your (opponent'?s )?(turn|main phase|battle phase),\s*/i);
    if (lead) { ab.conds.push({ type: lead[1] ? "oppTurn" : /main/i.test(lead[2]) ? "mainPhase" : /battle/i.test(lead[2]) ? "battlePhase" : "myTurn" }); rest = rest.slice(lead[0].length); }
    // timing
    if (kind === "AUTO") {
      const tm = timing(rest);
      if (tm) {
        ab.when = tm.when;
        if (tm.when === "placed") { ab.when = zone === "GC" ? "placedGC" : zone === "VC" ? "placedVC" : zone === "RC" ? "placedRC" : "placed"; if (!zone) ab.zone = "VC/RC"; }
        if (!zone && tm.zoneHint) ab.zone = tm.zoneHint;
        if (tm.whenFrom) ab.whenFrom = tm.whenFrom;
        if (tm.whenFilter) ab.whenFilter = tm.whenFilter;
        for (const k of ["whenColumn", "whenByVC", "whenMin", "whenByCard"]) if (tm[k]) ab[k] = tm[k];
        // "when …, during your (opponent's) turn," inside the timing clause
        if (/during your opponent'?s turn/i.test(tm.clause)) ab.conds.push({ type: "oppTurn" });
        else if (/during your turn/i.test(tm.clause)) ab.conds.push({ type: "myTurn" });
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
      const r = costsIn(m[1]);
      rest = rest.slice(m.index + m[0].length);
      // "[COST][Counter-Blast 1] or [Energy-Blast 3]": pay either one
      const alt = rest.match(/^\s*or \[((?:[^\[\]]|\[[^\]]*\])*)\]\s*,?/i);
      const r2 = alt ? costsIn(alt[1]) : null;
      if (alt && r.costs.length && r2.costs.length && !r.unread.length && !r2.unread.length) { ab.costs.push({ type: "oneOf", options: [r.costs, r2.costs] }); rest = rest.slice(alt[0].length); }
      else { ab.costs.push(...r.costs); unread.push(...r.unread.map((u) => "cost: " + u)); }
    }
    // conditions: only the "if …," clauses that come before the first effect apply to the whole ability
    const cl = clauses(rest.replace(/^\s*[,!.]\s*/, "").replace(/^play this with\s*[,!]?\s*/i, ""));
    const effectClauses = [];
    const isCond = (c) => /^(if|during|when|play this (only )?if)\b/i.test(c) && !/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid|searched)\b|^if not\b/i.test(c);
    // text before a [COST] that already does something ("this unit gets +2000, and if …, [COST][…], …"):
    // those effects don't depend on the cost, so they become a separate ability with the same timing
    const preCl = clauses(condText).filter((c) => c !== "§");
    let preEffects = [];
    if (preCl.some((c) => !isCond(c) && !/^(and|then)$/i.test(c) && !/^until end of/i.test(c)) && ab.costs.length) {
      const firstEff = preCl.findIndex((c) => !isCond(c));
      const lastCond = preCl.length - 1 - [...preCl].reverse().findIndex((c) => !isCond(c.replace(/^and\s+/i, "")));
      preEffects = preCl.slice(firstEff, lastCond + 1);
      preCl.splice(firstEff, lastCond + 1 - firstEff);
    }
    let started = false;
    for (const c of [...preCl, ...cl]) {
      if (!started && c === "§") continue;
      const cc = c.replace(/^and\s+/i, "");
      if (!started && isCond(cc)) {
        const r = condsIn(cc);
        if (r.conds.length) { ab.conds.push(...r.conds); continue; }
        if (/^during your turn/i.test(cc)) continue;
      }
      if (c !== "§") started = true;
      effectClauses.push(c);
    }
    if (preEffects.length && extraAbs) {
      const side = { kind, zone: ab.zone, once: "", conds: [], costs: [], effects: [] };
      side.when = ab.when; if (ab.whenFrom) side.whenFrom = ab.whenFrom; if (ab.whenFilter) side.whenFilter = ab.whenFilter;
      side.conds = ab.conds.filter((c) => c.type === "targetVC" || c.type === "limitBreak" || c.type === "genBreak" || c.type === "myTurn");
      side.effects = []; side.costs = []; side.mandatory = true; side.part = true; delete side.unread; // part of the line before (text check pairs it with that line)
      const sctx = {};
      for (const c of preEffects) { const cc = c.replace(/^and\s+/i, ""); if (/^until end of/i.test(cc)) { sctx.dur = durOf(cc); continue; } const es = effectOf(cc, sctx); if (es === null) side.effects.push({ type: "manual", text: c }); else side.effects.push(...es); }
      if (side.effects.length) (ab.siblings = ab.siblings || []).push(side);
    }
    // "choose / perform one of the following ・A ・B": the bullets become options A, B, C…
    const optParts = rest.split(/\s*・\s*/);
    let optClauses = [];
    if (optParts.length > 1 && /(choose|perform|activate) (one|two|three|\d|up to \w+|any number) of the (following|effects below)/i.test(optParts[0])) {
      const n = toNum((optParts[0].match(/(one|two|three|\d)\s+of the/i) || [])[1] || 1);
      ab.effects.push({ type: "chooseOpts", n });
      optClauses = optParts.slice(1).map((p, i) => ({ letter: "ABCDEF"[i], cl: clauses(p) }));
      const before = optParts[0].replace(/,?\s*(choose|perform|activate) (one|two|three|\d|up to \w+|any number) of the (following|effects below)[^,]*\.?$/i, "");
      effectClauses.splice(0, effectClauses.length, ...clauses(before).filter((c) => c !== "§" && !/^(if|during)\b/i.test(c)));
    }
    // effects
    const ctx = { unconditional: kind === "CONT" && !ab.conds.length };
    let onlyIf = "", onlyFilter = null;
    let later = "", ifCond = null;
    for (const c of effectClauses) {
      if (c === "§") { ifCond = null; onlyIf = ""; later = ""; continue; }
      let t = c.replace(/^(and then|and|then|also)\s+/i, "");
      if (/^(and|then|and then|also)$/i.test(c)) continue;
      // "at the end of that battle / turn, …": the following steps happen then
      const lt = t.match(/^at the end of (that|this|the) (battle|turn)$/i) || t.match(/^at the (?:beginning|start) of the end phase of (that|this) (turn)$/i);
      if (lt) { later = lt[2].toLowerCase(); continue; }
      // "If the revealed card is a <Royal Paladin>, …": the following steps need the revealed card to match
      const rvl = t.match(/^if (?:the revealed card|the card revealed(?: by this effect)?|that card) is (?:an? )?(.+?)$/i);
      if (rvl && filt(rvl[1]) && Object.keys(filt(rvl[1])).length) { onlyIf = "match"; onlyFilter = filt(rvl[1]); continue; }
      // "…, and if your opponent's vanguard is grade 3 or greater, …": a condition for the following steps
      if (/^if\b/i.test(t) && !/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid)\b/i.test(t)) {
        const r = condsIn(t);
        if (r.conds.length === 1) { ifCond = r.conds[0]; continue; }
      }
      // "until end of turn, this unit gets …": the duration comes first
      if (/^(until end of (turn|that battle|the battle|your opponent'?s (?:next )?turn|your next turn|the fight|this fight))$/i.test(t)) { ctx.dur = durOf(t); continue; }
      const iff = t.match(/^if you (do|did|put|called|retired|drew|revealed|discarded|bound|stood|chose|paid|searched)( not)?\b[^,]*?(?=,|$)/i);
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
      const qa = t.match(/^"(\[(AUTO|ACT|CONT)\][\s\S]*)"\.?$/i);
      if (qa) {
        const g = ability(qa[1], undefined, extraAbs);
        g.granted = true;
        extraAbs.push(g);
        ab.effects.push({ type: "grant", ability: -extraAbs.length, dur: ctx.dur || "turn", ...(ctx.last ? { ...ctx.last } : { target: "self" }) });
        continue;
      }
      // a second cost in the middle: "If you persona rode this turn, [COST][put a card from hand into soul], until end of turn, …"
      const pcm = t.match(/^\[COST\]\s*\[((?:[^\[\]]|\[[^\]]*\])*)\]\s*,?\s*(?:and\s+)?([\s\S]*)$/i);
      if (pcm) {
        const r = costsIn(pcm[1]);
        if (r.costs.length && !r.unread.length) {
          const step = { type: "payCost", costs: r.costs };
          if (ifCond) step.ifCond = ifCond;
          if (onlyIf) step.onlyIf = onlyIf;
          if (later) step.later = later;
          ab.effects.push(step);
          onlyIf = "did"; // the rest of the sentence needs the cost paid
          if (!pcm[2].trim()) continue;
          t = pcm[2].trim();
          if (/^(until end of (turn|that battle|the battle|your opponent'?s (?:next )?turn|your next turn))$/i.test(t)) { ctx.dur = durOf(t); continue; }
        }
      }
      const es0 = effectOf(t, ctx);
      if (es0 === null && /\b(is|are|has|have)\b/i.test(t) && !/\b(gets?|draw|call|put|retire|choose|look|search)\b/i.test(t)) {
        const r2 = condsIn("if " + t);
        if (r2.conds.length) { if (!ab.effects.length) ab.conds.push(...r2.conds); else ifCond = r2.conds[0]; continue; }
      }
      const es = es0;
      if (es === null) { ab.effects.push({ type: "manual", text: c.replace(/^and\s+/i, "") }); continue; }
      for (const e of es) { if (onlyIf) e.onlyIf = onlyIf; if (onlyIf === "match" && onlyFilter) e.onlyFilter = onlyFilter; if (later) e.later = later; if (ifCond) e.ifCond = ifCond; ab.effects.push(e); }
      if (es.length) onlyIf = onlyIf && /^(and|then)\b/i.test(c) ? onlyIf : onlyIf; // stays for the rest of the sentence
    }
    for (const o of optClauses) {
      const octx = {};
      for (const c of o.cl) {
        if (c === "§") continue;
        const es = effectOf(c, octx);
        if (es === null) ab.effects.push({ type: "manual", text: c, opt: o.letter });
        else es.forEach((e) => ab.effects.push({ ...e, opt: o.letter }));
      }
    }
    if (kind === "AUTO" && !/\byou may\b|\[COST\]/i.test(text) && !ab.costs.length) ab.mandatory = true;
    if (ab.forceMandatory) { if (kind === "AUTO") ab.mandatory = true; delete ab.forceMandatory; }
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
    // a set order whose own text is only "Play this if …!" has nothing more to do when played (its abilities are separate lines)
    const onlyPlayIf = (kind === "ORDER" || kind === "BLITZ") && ab.conds.length && /^play this (only )?if\b/i.test(text.trim()) && !/[.!]\s*\S/.test(text.trim().replace(/[.!]\s*$/, ""));
    if (!ab.effects.length && !unread.length && kind !== "CONT" && !onlyPlayIf) ab.effects.push({ type: "manual", text: text.replace(/^\[[^\]]*\]\s*(\([^)]*\))?:?/, "").slice(0, 200) });
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
    // over triggers: "Additional Effect - …" happens when revealed in a drive check (event overDrive)
    const ADD_EFF = /^additional effect\s*(?:\([^)]*\))?\s*[-–－]\s*/i;
    for (const l of lines) {
      if (!ADD_EFF.test(l)) continue;
      const a = ability(l.replace(ADD_EFF, ""), "ORDER", extraAbs);
      Object.assign(a, { kind: "AUTO", when: "overDrive", zone: "trigger", mandatory: !/\byou may\b/i.test(l) });
      out.push(a);
    }
    if (isOrder) {
      // trigger orders: "Play Effect (…) - …" is the order's own text
      const body = lines.filter((l) => !KEYWORD_LINE.test(l) && !/^\[(auto|act|cont)\]/i.test(l) && !ADD_EFF.test(l))
        .map((l) => l.replace(/^play effect\s*(?:\([^)]*\))?\s*[-–－]\s*/i, "")).join(" ");
      const blitz = /blitz order/i.test(text);
      if (body) out.push(ability(body, blitz ? "BLITZ" : "ORDER", extraAbs));
    }
    for (const l of lines) {
      if (!/^\[(auto|act|cont)\]/i.test(l)) continue;
      const before = out.length;
      const body = l.replace(/^\[(auto|act|cont)\]\s*(\([^)]*\))?\s*(\[[^\]]*\])*\s*:?\s*/i, "");
      if (/^(sentinel|forerunner|lord|boost|intercept|resist|harmony|restraint)\b\s*\.?\s*$/i.test(body)) continue; // a keyword: card field
      if (/^[A-Z][A-Za-z!'‐-]{2,20}( \d+)?\s*$/.test(body)) continue;
      // Legion (G era): "[ACT](VC):[Legion 20000]"Seeker, Light Blaze Dragon"" = if your opponent's vanguard is grade 3 or greater, return four
      // cards from your drop to the deck, search for the named mate and Legion (CR 6.4); the mate's name is the Seek Mate text
      const lg = body.match(/^\[legion (\d+)\]\s*"([^"]+)"\s*$/i);
      if (lg) { out.push({ kind: "ACT", zone: "VC", once: "", conds: [{ type: "oppVcGrade", n: 3 }], costs: [{ type: "dropToTop", n: 4 }], effects: [{ type: "seekMate", text: lg[2] }], legionPower: +lg[1] }); continue; }
      if (/^the normal ride of this card from a grade 3 card with a kai icon and a different card name[^.]*also becomes a persona ride\.?$/i.test(body)) continue; // card field personaFromKai
      // deck-building rules and card fields, not abilities: "You may only have one … in a deck", "You may have up to ten energy",
      // "This card cannot be ridden", "This card can only be ridden from a grade 3 with "X" in its card name"
      if (/^you may (only )?have (up to )?[^.]*\b(in (a|your) deck|energy)\.?$/i.test(body)) continue;
      if (/^this card (cannot be ridden|can only be ridden from [^.]*)\.?$/i.test(body)) continue;
      if (/^(hand:\s*)?while (you are )?paying the cost (for|of) \[?stride\]?,? this card gets grade \+\d\.?$/i.test(body)) continue; // card field strideGrade // Legion mate name (the Seek Mate ability carries it) // a keyword label only (Engorge, Blaze, Success 20000…): its effect is in other lines
      const a = ability(l, undefined, extraAbs);
      out.push(a);
      if (a.siblings) { out.push(...a.siblings); delete a.siblings; }
      void before;
    }
    // granted abilities go after the normal ones; fix the "ability number" of grant steps
    const all = [...out, ...extraAbs];
    for (const ab of out) for (const e of ab.effects) if (e.type === "grant" && e.ability < 0) e.ability = out.length + (-e.ability);
    for (const ab of extraAbs) for (const e of ab.effects) if (e.type === "grant" && e.ability < 0) e.ability = out.length + (-e.ability);
    return all;
  }

  function parse(text, hint = {}) {
    // the pasted page is read from the original text (norm() trims long reminder text such as "(This card is a ticket card…)")
    const sp = splitStats(text);
    const s = Object.assign(stats(norm(sp.rest)), sp.stats);
    const isOrder = s.type === "order" || /order/i.test(hint.type || "");
    if (isOrder) s.type = "order";
    const rest = sp.rest;
    if (s.type === "g" && !s.gKind) s.gKind = /\[G Guardian\]|Generation Guard|-?Guard Step-/i.test(rest) ? "guardian" : "stride";
    const abs = rest ? abilities(rest, isOrder) : [];
    // a blitz order / ticket: its text is played while guarding (the stat line said so; the ability text doesn't)
    if (s.blitz || /blitz/i.test(hint.type || "")) abs.forEach((a) => { if (a.kind === "ORDER") a.kind = "BLITZ"; });
    delete s.blitz;
    return { ...s, abilities: abs };
  }
  return { parse, stats, splitStats, abilities, filt, condsIn, costsIn };
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
