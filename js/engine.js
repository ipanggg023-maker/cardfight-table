// Rules engine. All game state lives in S. No DOM access here.
// Actions are async because abilities can stop and ask a player to choose (Game.answer resumes).

const Game = (() => {
  const FRONT = ["fl", "vc", "fr"], BACK = ["bl", "bc", "br"], RC = ["fl", "fr", "bl", "bc", "br"];
  const UNITS = ["vc", ...RC];
  const BACK_OF = { fl: "bl", vc: "bc", fr: "br" };
  const PARTNER = { fl: "bl", bl: "fl", fr: "br", br: "fr" };
  const SLOT_NAME = { vc: "VC", fl: "front-left RC", fr: "front-right RC", bl: "back-left RC", bc: "back-center RC", br: "back-right RC" };
  const slotName = (k) => SLOT_NAME[k] || "accel circle";
  // Each player's circles: the 6 standard ones + accel circles from Accel gifts (front row, rear-guard)
  const accelKeys = (pi) => ((S && S.players[pi].accel) || []).map((a) => a.key);
  const frontOf = (pi) => [...FRONT, ...accelKeys(pi)];
  const rcOf = (pi) => [...RC, ...accelKeys(pi)];
  const unitsOf = (pi) => [...UNITS, ...accelKeys(pi)];

  let S = null, uidN = 0, resume = null;
  let onChange = () => {};

  const OK = { ok: true };
  const err = (msg) => ({ ok: false, msg });
  const inst = (def) => ({ ...JSON.parse(JSON.stringify(def)), uid: ++uidN, down: false });
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const slot = (card) => ({ card, rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
  const P = (i) => S.players[i];
  const over = () => S.winner !== null;
  // Skill icons (CR 2.17, 14.3–14.5). Cards made before these fields existed fall back to the usual
  // values for their grade: Twin Drive on grade 3+, Boost on grade 0–1, Intercept on grade 2.
  const flag = (v, dflt) => (v === true || v === "1" ? true : v === false || v === "0" ? false : dflt);
  const driveOf = (c) => +c.drive || (c.type === "g" ? 3 : c.grade >= 3 ? 2 : 1);
  const canBoostIcon = (c) => c.type !== "order" && flag(c.boost, c.grade <= 1);
  const canInterceptIcon = (c) => c.type !== "order" && flag(c.intercept, c.grade === 2);
  // Trigger power is the number printed on the icon (CR 11.10.5): 10000 on V/D cards, 5000 on old ones
  const trigPower = (c) => +c.trigPower || (c.trigger === "over" ? 100000000 : 10000);
  const log = (m) => { S.log.unshift(m); if (S.log.length > 120) S.log.pop(); };

  // ---------- setup ----------
  // deck: {name, format, energy, ride:[G0..G3 cards] (ride-deck formats), starter (other formats), main:[50]}
  function makePlayer(name, deck) {
    const hasRideDeck = !!(deck.ride && deck.ride.length);
    const main = deck.main.map(inst);
    let ride = [], first;
    if (hasRideDeck) {
      ride = deck.ride.map(inst).sort((a, b) => a.grade - b.grade);
      first = ride.shift(); // the ride deck's grade 0 is the first vanguard
    } else {
      // no ride deck (V Premium / Premium): the first vanguard is a grade 0 taken from the main deck (CR 8.2.1.2)
      let i = deck.starter ? main.findIndex((c) => c.id === deck.starter.id) : -1;
      if (i < 0) i = main.findIndex((c) => c.grade === 0 && c.type !== "order");
      first = i >= 0 ? main.splice(i, 1)[0] : main.shift();
    }
    const p = {
      name, deckName: deck.name, format: deck.format || "standard", hasRideDeck,
      useEnergy: !!deck.energy, energy: 0,
      deck: shuffle(main), ride,
      hand: [], soul: [], damage: [], drop: [], bind: [], removed: [],
      gDeck: (deck.g || []).map(inst), gUp: [], vcGradeAtStart: 0, // G zone: face down / face up (CR 4.14)
      giftType: "", giftVariant: {}, marks: {}, accel: [], legionUsed: [], // imaginary gifts, Legion
      orderZone: [], world: "", regalisUsed: 0, divineUsed: false, uniqueUsed: false, // D era: set orders, World, once-per-game skills
      slots: { vc: slot(first), fl: null, fr: null, bl: null, bc: null, br: null },
      driveBonus: 0, ordersThisTurn: 0, personaThisTurn: false, personaFront: false,
      orderTurn: -1, egTurn: -1, // turn number of the last order played / Energy Generator draw (1 each per turn)
    };
    for (let i = 0; i < 5; i++) p.hand.push(p.deck.pop());
    return p;
  }
  // opts.first: 0 / 1 = that player goes first; anything else = random (CR 8.2.1.6)
  function newGame(names, decks, opts = {}) {
    uidN = 0;
    resume = null;
    const first = opts.first === 0 || opts.first === 1 ? opts.first : Math.floor(Math.random() * 2);
    S = {
      players: [makePlayer(names[0], decks[0]), makePlayer(names[1], decks[1])],
      first, active: first, controller: first, turn: 1, phase: "mulligan",
      rode: false, battle: null, winner: null, pending: null, busy: false,
      log: [], reveal: [], used: new Set(), usedGame: new Set(),
      queue: [], loss: [null, null], // waiting AUTO abilities; pending losses (decided at check timing)
    };
    depth = 0; inCheck = false; qN = 0;
    log(`Game start! ${P(first).name} goes first (draws on turn 1 but can't attack)`);
    // Energy Generator: the player who went second Energy-Charges 3 when it is placed in the crest zone
    const second = P(1 - first);
    if (second.useEnergy) { second.energy = 3; log(`${second.name} went second: Energy-Charge 3`); }
    return S;
  }

  // Wrap every player action: one at a time, redraw after.
  async function run(fn) {
    if (!S) return err("No game");
    if (S.busy) return err("Finish the current choice first");
    if (over()) return err("Game over");
    S.busy = true;
    try { return (await fn()) || OK; }
    catch (e) { console.error(e); return err(e.message); }
    finally { ruleActions(); S.busy = false; onChange(); }
  }

  // ---------- choices ----------
  // options: [{id, label, card?}] → resolves to array of chosen ids
  function choose(pi, prompt, options, min = 1, max = 1) {
    if (!options.length) return Promise.resolve([]);
    max = Math.min(max, options.length);
    min = Math.min(min, max);
    if (min === options.length) return Promise.resolve(options.map((o) => o.id)); // no real choice
    return new Promise((res) => {
      const prev = S.controller;
      S.pending = { player: pi, prompt, options, min, max };
      S.controller = pi;
      resume = (ids) => { S.pending = null; S.controller = prev; resume = null; res(ids); };
      onChange();
    });
  }
  function answer(ids) {
    const p = S && S.pending;
    if (!p || !resume) return err("Nothing to answer");
    if (ids.length < p.min || ids.length > p.max) return err(`Choose ${p.min === p.max ? p.min : p.min + "–" + p.max}`);
    resume(ids);
    return OK;
  }
  async function yesNo(pi, prompt) {
    const r = await choose(pi, prompt, [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }], 1, 1);
    return r[0] === "yes";
  }
  const cardOpts = (cards) => cards.map((c) => ({ id: c.uid, label: c.name, card: c }));
  async function chooseCards(pi, prompt, cards, min, max) {
    const ids = await choose(pi, prompt, cardOpts(cards), min, max);
    return ids.map((id) => cards.find((c) => c.uid === id));
  }
  async function chooseUnits(pi, prompt, units, n, exact = true) {
    units = units.filter((u) => u.pi === pi || !(restricted(u.pi, u.key, "resist") || restricted(u.pi, u.key, "cantBeChosen")));
    const opts = units.map((u) => ({ id: u.pi + ":" + u.key, label: `${u.pi === pi ? "Your" : "Opponent's"} ${slotName(u.key)}: ${P(u.pi).slots[u.key].card.name}`, card: P(u.pi).slots[u.key].card }));
    const ids = await choose(pi, prompt, opts, exact ? n : 0, n);
    return ids.map((id) => ({ pi: +id.split(":")[0], key: id.split(":")[1] }));
  }

  // ---------- basic helpers ----------
  // A loss condition is noted here and decided at the next check timing (CR 13.1.2, 13.2)
  function lose(pi, why) { if (!over() && !S.loss[pi]) S.loss[pi] = why; }
  // Rule actions: 6+ damage loses; pending losses are decided; both at once = draw game (CR 13.2–13.3)
  function ruleActions() {
    if (!S || over()) return;
    // the Protect gift card only exists in the hand or on the guardian circle (CR 15.3)
    S.players.forEach((p) => ["drop", "soul", "bind", "damage", "removed", "deck"].forEach((z) => { if (p[z].some((c) => c.protect)) p[z] = p[z].filter((c) => !c.protect); }));
    S.players.forEach((p, pi) => { if (p.damage.length >= 6 && !S.loss[pi]) S.loss[pi] = "6 damage"; });
    const [a, b] = S.loss;
    if (!a && !b) return;
    S.battle = null;
    S.queue = [];
    if (a && b) { S.winner = -1; log(`🤝 Draw game! (${P(0).name}: ${a} · ${P(1).name}: ${b})`); return; }
    const pi = a ? 0 : 1;
    S.winner = 1 - pi;
    log(`🏆 ${P(S.winner).name} wins! (${P(pi).name}: ${S.loss[pi]})`);
  }
  function draw(pi, n = 1) {
    const p = P(pi);
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) return lose(pi, "deck is empty");
      p.hand.push(p.deck.pop());
    }
  }
  const faceUp = (p) => p.damage.filter((c) => !c.down).length;
  // Card filter (Ability Language v2). env = {pi, ctx} enables the fields that compare with your vanguard / this card.
  function match(c, f, env = {}) {
    if (!f || !c) return !!c || !f;
    if (f.gmin !== undefined && f.gmin !== "" && c.grade < +f.gmin) return false;
    if (f.gmax !== undefined && f.gmax !== "" && c.grade > +f.gmax) return false;
    if (f.name && !c.name.toLowerCase().includes(f.name.toLowerCase())) return false;
    const t = f.ctype || "any";
    if (t === "unit" && c.type !== "unit") return false;
    if (t === "trigger" && c.type !== "trigger") return false;
    if (t === "anyunit" && c.type === "order") return false;
    if (t === "order" && c.type !== "order") return false;
    if (t === "g" && c.type !== "g") return false;
    if (f.nameExact && c.name.toLowerCase() !== String(f.nameExact).toLowerCase()) return false;
    if (f.clan) { const w = String(f.clan).toLowerCase(); if (![c.nation, c.clan, c.race].some((x) => x && String(x).toLowerCase().includes(w))) return false; }
    if (f.trig && f.trig !== "") {
      if (f.trig === "none" ? !!c.trigger : f.trig === "any" ? !c.trigger : c.trigger !== f.trig) return false;
    }
    if (f.sentinel === "yes" && !c.sentinel) return false;
    if (f.sentinel === "no" && c.sentinel) return false;
    if (env.pi !== undefined && S) {
      const vc = P(env.pi).slots.vc && P(env.pi).slots.vc.card;
      if (f.sameNameVC && (!vc || c.name !== vc.name)) return false;
      if (f.gradeVC && vc) {
        const g = vc.grade, x = c.grade;
        if (!({ lt: x < g, le: x <= g, eq: x === g, ge: x >= g, gt: x > g, plus1: x === g + 1 })[f.gradeVC]) return false;
      }
      if (f.other && env.ctx && env.ctx.card && c.uid === env.ctx.card.uid) return false;
    }
    return true;
  }
  // ---------- counts (for "for each…", "if the number of…") ----------
  function countOf(pi, what, f, ctx = {}) {
    const p = P(pi), o = P(1 - pi), env = { pi, ctx };
    const m = (list) => (list || []).filter((c) => match(c, f, env)).length;
    const units = (q, keys) => keys.filter((k) => q.slots[k] && !q.slots[k].locked && match(q.slots[k].card, f, env)).length;
    switch (what) {
      case "myHand": return m(p.hand);
      case "mySoul": return m(p.soul);
      case "myDrop": return m(p.drop);
      case "myDamage": return m(p.damage);
      case "myDamageUp": return m(p.damage.filter((d) => !d.down));
      case "myDamageDown": return m(p.damage.filter((d) => d.down));
      case "myBind": return m(p.bind);
      case "myDeck": return m(p.deck);
      case "myGUp": return m(p.gUp) + (p.slots.vc.card.type === "g" && match(p.slots.vc.card, f, env) ? 1 : 0);
      case "myOrderZone": return m(p.orderZone);
      case "myRC": return units(p, rcOf(pi));
      case "myFrontRC": return units(p, frontOf(pi).filter((k) => k !== "vc"));
      case "myBackRC": return units(p, BACK);
      case "myUnits": return units(p, unitsOf(pi));
      case "myRested": return rcOf(pi).filter((k) => p.slots[k] && p.slots[k].rest && match(p.slots[k].card, f, env)).length;
      case "myEnergy": return p.energy || 0;
      case "oppHand": return m(o.hand);
      case "oppSoul": return m(o.soul);
      case "oppDrop": return m(o.drop);
      case "oppDamage": return m(o.damage);
      case "oppBind": return m(o.bind);
      case "oppRC": return units(o, rcOf(1 - pi));
      case "oppUnits": return units(o, unitsOf(1 - pi));
      case "battleNo": return S.battleNo || 0;
      case "lastCount": return ctx.last ? ctx.last.count : 0;
      case "lastMatch": return (ctx.last && ctx.last.cards ? ctx.last.cards : []).filter((c) => match(c, f, env)).length;
      default: return 0;
    }
  }
  const times = (pi, e, ctx) => (e.per ? countOf(pi, e.per, e.perFilter, ctx) : 1); // "for each …"
  const cmp = (a, op, b) => (op === "le" ? a <= b : op === "eq" ? a === b : op === "lt" ? a < b : op === "gt" ? a > b : a >= b);
  const zoneOf = (key) => (key === "vc" ? "VC" : "RC");
  const zoneOK = (abZone, zone) => !abZone || abZone === "any" || abZone === zone || (abZone === "VC/RC" && (zone === "VC" || zone === "RC"));
  // card zones that hold abilities of their own (CR 11.1.4): [AUTO](Hand), [ACT](Drop), [CONT](G zone)…
  const CARD_ZONES = { hand: "hand", drop: "drop", soul: "soul", damage: "damage", bind: "bind", G: "gUp" };
  // locked cards are not units with information (CR 7.30), so effects never pick them as units
  const unitsAt = (pi, keys, f, env = {}) => keys.filter((k) => P(pi).slots[k] && !P(pi).slots[k].locked && match(P(pi).slots[k].card, f, env)).map((key) => ({ pi, key }));

  // ---------- power (incl. CONT abilities) ----------
  function contTargets(pi, t, k) {
    return { self: [k], vc: ["vc"], allFront: frontOf(pi), allFrontRC: frontOf(pi).filter((x) => x !== "vc"), allMyRC: rcOf(pi), allMyUnits: unitsOf(pi) }[t || "self"] || [];
  }
  // Cards whose abilities work from a circle: the unit, plus arms attached to the vanguard (CR 17.7)
  // locked or deleted cards have no text (CR 7.30, 7.32)
  const sourcesAt = (p, k) => (p.slots[k] && !p.slots[k].locked && !p.slots[k].deleted ? [p.slots[k].card, ...(k === "vc" ? p.slots.vc.arms || [] : [])] : []);
  // Every ability working on a circle: the cards' own abilities (except "granted only" ones, which only exist when an
  // effect gives them) + abilities granted to the unit for a while (slot.extra). Items: {card, ab, i, src}
  function abilitiesAt(pi, k) {
    const p = P(pi), out = [];
    sourcesAt(p, k).forEach((card, src) => (card.abilities || []).forEach((ab, i) => { if (!ab.granted) out.push({ card, ab, i, src }); }));
    const sl = p.slots[k];
    if (sl && !sl.locked && !sl.deleted) (sl.extra || []).forEach((x, j) => out.push({ card: sl.card, ab: x.ab, i: "x" + j, src: 0 }));
    return out;
  }
  const ownAbilities = (card) => (card.abilities || []).map((ab, i) => ({ card, ab, i, src: 0 })).filter((x) => !x.ab.granted);
  function cont(pi, key, stat) {
    const p = P(pi);
    let sum = 0;
    const add = (card, k, zone, list) => {
      for (const { ab } of list) {
        if (ab.kind !== "CONT" || !zoneOK(ab.zone, zone)) continue;
        if (!(ab.conds || []).every((c) => condOK(pi, c, { key: k, card }))) continue;
        for (const e of ab.effects || []) {
          if (e.type === stat && contTargets(pi, e.target, k).includes(key) && match(p.slots[key].card, e.filter, { pi, ctx: { key: k, card } })) sum += (+e.amount || 0) * times(pi, e, { key: k, card });
        }
      }
    };
    for (const k of unitsOf(pi)) for (const x of abilitiesAt(pi, k)) add(x.card, k, zoneOf(k), [x]);
    for (const card of p.orderZone || []) add(card, null, "OZ", ownAbilities(card)); // set orders in the order zone (CR 4.17)
    for (const [zone, z] of Object.entries(CARD_ZONES)) for (const card of p[z] || []) { // [CONT](G zone) / (Drop)…
      if (!(card.down && zone === "damage") && (card.abilities || []).some((ab) => ab.kind === "CONT" && ab.zone === zone)) add(card, null, zone, ownAbilities(card).filter((x) => x.ab.zone === zone));
    }
    return sum + mods(pi, key, stat);
  }
  // ---------- timed modifiers, restrictions, player rules (Ability Language v2 step 4) ----------
  // slot.mods: {stat: "power"|"crit"|"no", what?, amount?, until: turn number it ends after, battle: ends with the battle}
  const mods = (pi, key, stat) => ((P(pi).slots[key] || {}).mods || []).filter((m) => m.stat === stat).reduce((n, m) => n + (+m.amount || 0), 0);
  // the turn number whose end a duration reaches ("until end of your opponent's turn" = the next opponent turn's end)
  function untilOf(pi, d) {
    if (d === "oppTurn") return S.active === pi ? S.turn + 1 : S.turn;
    if (d === "nextTurn") return S.active === pi ? S.turn + 2 : S.turn + 1;
    if (d === "game") return Infinity;
    return S.turn;
  }
  const LONG = new Set(["oppTurn", "nextTurn", "game"]);
  function addMod(pi, key, m) { const sl = P(pi).slots[key]; if (sl) (sl.mods = sl.mods || []).push(m); }
  // a unit-level restriction: timed (slot.mods "no"), from CONT abilities ("restrict" effects), or a card keyword (resist)
  function restricted(pi, key, what) {
    const sl = P(pi).slots[key];
    if (!sl) return false;
    if (what === "resist" && sl.card.resist) return true;
    if ((sl.mods || []).some((m) => m.stat === "no" && m.what === what)) return true;
    const p = P(pi);
    const hit = (k, zone, list) => list.some(({ ab, card }) => ab.kind === "CONT" && zoneOK(ab.zone, zone)
      && (ab.conds || []).every((c) => condOK(pi, c, { key: k, card }))
      && (ab.effects || []).some((e) => e.type === "restrict" && e.what === what && contTargets(pi, e.target, k).includes(key) && match(sl.card, e.filter, { pi, ctx: { key: k, card } })));
    for (const k of unitsOf(pi)) if (hit(k, zoneOf(k), abilitiesAt(pi, k))) return true;
    for (const card of p.orderZone || []) if (hit(null, "OZ", ownAbilities(card))) return true;
    return false;
  }
  // player rules: S.rules (timed) + CONT "playerRule" effects. {pi: the player it binds, what, filter}
  function ruleOn(pi, what, card) {
    const ok = (r) => r.pi === pi && r.what === what && (!card || match(card, r.filter));
    if ((S.rules || []).some(ok)) return true;
    for (const owner of [0, 1]) {
      const p = P(owner);
      const lists = [...unitsOf(owner).map((k) => [k, zoneOf(k), abilitiesAt(owner, k)]), ...(p.orderZone || []).map((c) => [null, "OZ", ownAbilities(c)])];
      for (const [k, zone, list] of lists) for (const { ab, card: src } of list) {
        if (ab.kind !== "CONT" || !zoneOK(ab.zone, zone) || !(ab.conds || []).every((c) => condOK(owner, c, { key: k, card: src }))) continue;
        for (const e of ab.effects || []) if (e.type === "playerRule" && ok({ pi: e.who === "me" ? owner : 1 - owner, what: e.what, filter: e.filter })) return true;
      }
    }
    return false;
  }
  // end of a battle / turn: timed things run out
  function expire(battleOnly) {
    const keep = (m) => (battleOnly ? !m.battle : !m.battle && m.until > S.turn);
    S.players.forEach((pl) => Object.values(pl.slots).forEach((sl) => { if (sl) { if (sl.mods) sl.mods = sl.mods.filter(keep); if (sl.extra) sl.extra = sl.extra.filter(keep); } }));
    if (S.rules) S.rules = S.rules.filter(keep);
  }
  function power(pi, key) {
    const p = P(pi), s = p.slots[key];
    if (!s || s.locked) return 0;
    // Persona Ride: units on your front-row circles get +10000 until end of turn (CR 7.15.1.4).
    // It belongs to the circles, so units called there later this turn get it too.
    const persona = p.personaFront && frontOf(pi).includes(key) ? 10000 : 0;
    const heart = s.heart ? (+s.heart.power || 0) + (s.heartMate ? +s.heartMate.power || 0 : 0) : 0; // stride: the heart's power is added (CR 6.5.2)
    const mate = s.mate ? +s.mate.power || 0 : 0; // legion: the mate's power is added (CR 6.4)
    const base = s.deleted ? 0 : s.card.power; // Delete: power drops by its printed power (CR 7.32)
    return Math.max(0, base + heart + mate + s.pow + s.powB + persona + giftPower(pi, key) + cont(pi, key, "power"));
  }
  function crit(pi, key) {
    const s = P(pi).slots[key];
    if (!s) return 0;
    const m = P(pi).marks[key];
    const base = m && m.forceII ? 2 : s.card.crit || 1; // Force II: the unit on that circle has original critical 2
    return Math.max(0, base + s.crit + s.critB + cont(pi, key, "crit"));
  }
  // Gift bonuses during your turn: Force I +10000 per marker; accel circle +10000 (I) / +5000 (II) (CR 16.3)
  function giftPower(pi, key) {
    if (!S || S.active !== pi) return 0;
    const p = P(pi), m = p.marks[key];
    let n = m && m.forceI ? 10000 * m.forceI : 0;
    const a = p.accel.find((x) => x.key === key);
    if (a) n += a.variant === "II" ? 5000 : 10000;
    return n;
  }

  // ---------- conditions & costs ----------
  function condOK(pi, c, ctx) {
    const p = P(pi), o = P(1 - pi), n = +c.n || 0;
    switch (c.type) {
      case "myTurn": return S.active === pi;
      case "oppTurn": return S.active !== pi;
      case "legion": return !!p.slots.vc.mate;
      case "dressed": return !!(ctx.key && p.slots[ctx.key] && p.slots[ctx.key].under && p.slots[ctx.key].under.length); // in overDress state
      case "world": return (p.world || "").toLowerCase() === String(c.text || "").toLowerCase();
      case "orderZone": return (p.orderZone || []).length >= n;
      case "vcName": return [p.slots.vc.card, p.slots.vc.heart, p.slots.vc.mate].some((x) => x && x.name.toLowerCase().includes((c.text || "").toLowerCase()));
      case "genBreak": return gFaceUp(p) >= n;   // Generation Break N (CR 14.14)
      case "limitBreak": return p.damage.length >= n; // Limit Break N (CR 14.7)
      case "vcGrade": return p.slots.vc.card.grade >= n;
      case "oppVcGrade": return o.slots.vc.card.grade >= n;
      case "myDamage": return p.damage.length >= n;
      case "oppDamage": return o.damage.length >= n;
      case "rearCount": return rcOf(pi).filter((k) => p.slots[k]).length >= n;
      case "soul": return p.soul.length >= n;
      case "drop": return p.drop.length >= n;
      case "hand": return p.hand.length >= n;
      case "persona": return p.personaThisTurn;
      case "playedOrder": return p.ordersThisTurn > 0;
      case "targetVC": return !!S.battle && S.battle.tgt === "vc";
      case "selfFront": return frontOf(pi).includes(ctx.key);
      case "selfBack": return BACK.includes(ctx.key);
      case "count": return cmp(countOf(pi, c.what || "mySoul", c.filter, ctx), c.op || "ge", n);
      case "unit": { // a unit (your vanguard, this unit, the opponent's vanguard, the attacker / attacked unit) matches a filter
        const at = (q, k) => (q && q.slots[k] ? q.slots[k].card : null);
        const card = { vc: at(p, "vc"), self: ctx.key ? at(p, ctx.key) : ctx.card, oppVc: at(o, "vc"),
          attacker: S.battle ? at(P(S.active), S.battle.att) : null, attacked: S.battle ? at(P(1 - S.active), S.battle.tgt) : null }[c.who || "vc"];
        return !!card && match(card, c.filter, { pi, ctx });
      }
      case "wentFirst": return S.first === pi;
      case "ritual": return p.drop.filter((x) => x.grade === 1 && x.type !== "order").length >= n; // Ritual N (CR 14.37)
      case "byOpp": return ctx.by !== undefined && ctx.by !== null && ctx.by !== pi; // retired by the opponent's card
      case "wentSecond": return S.first !== pi;
      default: return true;
    }
  }
  const selfThere = (pi, ctx) => ctx.key && P(pi).slots[ctx.key] && P(pi).slots[ctx.key].card.uid === ctx.card.uid;
  function canPay(pi, c, ctx) {
    const p = P(pi), n = +c.n || 1;
    switch (c.type) {
      case "CB": return faceUp(p) >= n;
      case "SB": return p.soul.length >= n;
      case "EB": return p.energy >= n;
      case "discard": return p.hand.filter((x) => match(x, c.filter, { pi, ctx })).length >= n;
      case "move": return moveCandidates(pi, c, ctx).length >= (c.from === "self" ? 1 : n);
      case "restSelf": return selfThere(pi, ctx) && !P(pi).slots[ctx.key].rest;
      case "retireSelf": case "selfToSoul": return selfThere(pi, ctx) && ctx.key !== "vc";
      case "retireRC": return rcOf(pi).filter((k) => p.slots[k] && k !== ctx.key).length >= n;
      case "dropToTop": { const max = c.maxTrig === "" || c.maxTrig === undefined ? n : +c.maxTrig; return p.drop.length >= n && p.drop.filter((x) => !x.trigger).length + Math.min(max, p.drop.filter((x) => x.trigger).length) >= n; }
      default: return true;
    }
  }
  async function pay(pi, c, ctx) {
    const p = P(pi), n = +c.n || 1;
    switch (c.type) {
      case "CB": p.damage.filter((d) => !d.down).slice(0, n).forEach((d) => (d.down = true)); break;
      case "SB": {
        const picked = await chooseCards(pi, `Soul-Blast ${n}: choose cards from soul`, p.soul, n, n);
        picked.forEach((x) => { p.soul.splice(p.soul.indexOf(x), 1); p.drop.push(x); });
        break;
      }
      case "EB": p.energy -= n; break;
      case "discard": {
        const picked = await chooseCards(pi, `Discard ${n} card(s)`, p.hand.filter((x) => match(x, c.filter, { pi, ctx })), n, n);
        picked.forEach((x) => { p.hand.splice(p.hand.indexOf(x), 1); p.drop.push(x); discarded(pi, x); });
        break;
      }
      case "restSelf": p.slots[ctx.key].rest = true; break;
      case "retireSelf": retireBy(pi, ctx.key, pi); break;
      case "selfToSoul": p.soul.push(p.slots[ctx.key].card); p.slots[ctx.key] = null; break;
      case "dropToTop": {
        // choose N drop cards (at most maxTrig trigger units) and put them on top of the deck (CR 14.11)
        const max = c.maxTrig === "" || c.maxTrig === undefined ? n : +c.maxTrig;
        let picked = [];
        for (let tries = 0; tries < 5; tries++) {
          picked = await chooseCards(pi, `Return ${n} cards from your drop to the top of your deck${max < n ? ` (at most ${max} trigger units)` : ""}`, p.drop, n, n);
          if (picked.filter((x) => x.trigger).length <= max) break;
          log(`At most ${max} trigger units. Choose again.`);
        }
        picked.forEach((x) => { p.drop.splice(p.drop.indexOf(x), 1); p.deck.push(x); });
        break;
      }
      case "move": await moveCards(pi, { ...c, upTo: false }, ctx); break;
      case "retireRC": {
        const us = await chooseUnits(pi, `Retire ${n} of your rear-guards`, unitsAt(pi, rcOf(pi)).filter((u) => u.key !== ctx.key), n);
        us.forEach((u) => retireBy(u.pi, u.key, pi));
        break;
      }
    }
  }

  // ---------- resolving abilities ----------
  const usedKey = (card, i) => `${card.uid}:${i}`;
  const gameKey = (pi, card, i) => `${pi}:${card.name}:${i}`;
  function ready(pi, card, ab, i, ctx) {
    const pl = P(pi);
    if (card.regalis && pl.regalisUsed >= 1) return false;       // Regalis Piece: once per game (CR 14.51)
    if (ab.once === "divine" && pl.divineUsed) return false;     // Divine Skill: one per game across all your cards (CR 12.3.3)
    if (ab.once === "unique" && pl.uniqueUsed) return false;     // Unique Skill: same, separate icon
    if (ab.once === "turn" && S.used.has(usedKey(card, i))) return false;
    if (ab.once === "nameTurn" && S.used.has(`${pi}:name:${card.name}:${i}`)) return false; // "may only be used by a card with the same name once a turn"
    if (ab.once === "game" && S.usedGame.has(gameKey(pi, card, i))) return false;
    if (!(ab.conds || []).every((c) => condOK(pi, c, ctx))) return false;
    // Seek Mate needs a vanguard that has never been in legion (CR 14.11)
    if ((ab.effects || []).some((e) => e.type === "seekMate")) {
      const vs = P(pi).slots.vc;
      if (vs.mate || vs.card.type === "g" || P(pi).legionUsed.includes(vs.card.uid)) return false;
    }
    return (ab.costs || []).every((c) => canPay(pi, c, ctx));
  }
  async function resolve(pi, card, ab, i, ctx, ask) {
    if (!ready(pi, card, ab, i, ctx)) return false;
    if (ask && !(await yesNo(pi, `Use ability of ${card.name}?\n${describeAbility(ab)}`))) return false;
    if (!ready(pi, card, ab, i, ctx)) return false;
    if (ab.once === "turn") S.used.add(usedKey(card, i));
    if (ab.once === "nameTurn") S.used.add(`${pi}:name:${card.name}:${i}`);
    if (ab.once === "game") S.usedGame.add(gameKey(pi, card, i));
    if (ab.once === "divine") P(pi).divineUsed = true;
    if (ab.once === "unique") P(pi).uniqueUsed = true;
    if (card.regalis) P(pi).regalisUsed++;
    log(`✦ ${card.name}: ${describeAbility(ab)}`);
    depth++; // abilities triggered while this resolves wait for the next check timing
    try {
      for (const c of ab.costs || []) await pay(pi, c, ctx);
      await runEffects(pi, ab.effects || [], { ...ctx, card });
    } finally { depth--; }
    await settle();
    return true;
  }
  // ---------- check timing (CR 11.6) ----------
  // AUTO abilities don't resolve on the spot: they wait in S.queue. At a check timing rule actions
  // come first, then the turn player resolves their waiting abilities one by one in the order they
  // choose, then the other player; abilities triggered meanwhile join the queue.
  let depth = 0, inCheck = false, qN = 0;
  function collect(pi, key, event, extra = {}) {
    if (over()) return;
    const list = extra.card ? ownAbilities(extra.card) : key ? abilitiesAt(pi, key) : [];
    const zone = extra.zone || zoneOf(key);
    for (const { card, ab, i } of list) {
      if (ab.kind !== "AUTO" || ab.when !== event || (event !== "overDrive" && !zoneOK(ab.zone, zone))) continue;
      if (!whenOK(pi, ab, extra, card)) continue;
      S.queue.push({ id: ++qN, pi, i, ab, card, ctx: { key, zone, ...extra, card } });
    }
  }
  // AUTO event details: extra.subject = the card the event is about (placed / retired / revealed / discarded…), extra.from = where it came from
  function whenOK(pi, ab, extra, card) {
    if (ab.whenFilter && Object.keys(ab.whenFilter).length && !(extra.subject && match(extra.subject, ab.whenFilter, { pi, ctx: { card } }))) return false;
    if (ab.whenFrom) {
      const from = extra.from || "";
      if (ab.whenFrom === "notHand" ? from === "hand" : from !== ab.whenFrom) return false;
    }
    return true;
  }
  function collectAll(pi, event, extra = {}) {
    for (const k of unitsOf(pi)) if (P(pi).slots[k]) collect(pi, k, event, extra);
    for (const card of P(pi).orderZone || []) collect(pi, null, event, { ...extra, card, zone: "OZ" });
    collectZones(pi, event, extra);
  }
  // abilities on cards in the hand, drop, soul, damage zone, bind zone or G zone (face up) that listen to this event
  function collectZones(pi, event, extra = {}) {
    const p = P(pi);
    for (const [zone, z] of Object.entries(CARD_ZONES)) for (const card of p[z] || []) {
      if (card.down && zone === "damage") continue; // face-down cards have no abilities
      if (card === extra.card) continue; // already collected as the event's own card
      if ((card.abilities || []).some((ab) => ab.kind === "AUTO" && ab.when === event && ab.zone === zone)) collect(pi, null, event, { ...extra, card, zone });
    }
  }
  async function settle() { if (depth === 0 && !inCheck) await checkTiming(); }
  async function fire(pi, key, event, extra = {}) { collect(pi, key, event, extra); await settle(); }
  async function fireAll(pi, event, extra = {}) { collectAll(pi, event, extra); await settle(); }
  async function checkTiming() {
    inCheck = true;
    try {
      for (;;) {
        ruleActions();
        if (over()) return;
        let mine = S.queue.filter((q) => q.pi === S.active);
        if (!mine.length) mine = S.queue.filter((q) => q.pi !== S.active);
        if (!mine.length) return;
        let item = mine[0];
        if (mine.length > 1) {
          const opts = mine.map((q) => ({ id: "q" + q.id, label: `${q.card.name}: ${describeAbility(q.ab || q.card.abilities[q.i])}`, card: q.card }));
          const [pick] = await choose(item.pi, "Choose which of your abilities resolves next", opts, 1, 1);
          item = mine.find((q) => "q" + q.id === pick) || item;
        }
        S.queue.splice(S.queue.indexOf(item), 1);
        const ab = item.ab || item.card.abilities[item.i];
        if (ab) await resolve(item.pi, item.card, ab, item.i, item.ctx, !ab.mandatory); // mandatory = no "you may"
      }
    } finally { inCheck = false; }
  }

  // ---------- moving cards ----------
  // ---------- G zone ----------
  const gFaceUp = (p) => p.gUp.length + (p.slots.vc && p.slots.vc.card.type === "g" ? 1 : 0);
  function toGZone(p, g) {
    if (g.ultimate) { // Ultimate Stride: when it returns, the whole G zone is removed from the game (CR 14.13)
      p.removed.push(g, ...p.gUp, ...p.gDeck);
      p.gUp = []; p.gDeck = [];
      log(`${g.name} returns: the G zone of ${p.name} is removed from the game`);
    } else p.gUp.push(g);
  }
  // A card leaving a circle: G units go face up to the G zone; a strided vanguard's heart becomes the vanguard again
  function leaveCircle(pi, key, dest) {
    const p = P(pi), s = p.slots[key];
    if (!s) return;
    if (s.card.type === "g") {
      toGZone(p, s.card);
      if (key === "vc" && s.heart) { s.card = s.heart; s.heart = null; s.mate = s.heartMate || null; s.heartMate = null; return; }
    } else p[dest].push(s.card);
    if (s.under && s.under.length) p.drop.push(...s.under); // the originalDress separates (CR 6.7)
    p.slots[key] = null;
  }
  function retire(pi, key) { leaveCircle(pi, key, "drop"); }
  function bindUnit(pi, key) { leaveCircle(pi, key, "bind"); }
  // from = where the card came from ("hand", "deck", "drop", "soul", "bind", "damage"…), for "when placed from hand" etc.
  async function place(pi, card, key, from = "") {
    const p = P(pi);
    if (p.slots[key]) { log(`${p.slots[key].card.name} was replaced and retired`); retireBy(pi, key, null); }
    p.slots[key] = slot(card);
    log(`${p.name} calls ${card.name}${from && from !== "hand" ? " from the " + from : ""}`);
    collect(pi, key, "placedRC", { from, subject: card });
    for (const k of unitsOf(pi)) if (k !== key && p.slots[k]) collect(pi, k, "allyPlacedRC", { placedKey: key, from, subject: card });
    collectZones(pi, "allyPlacedRC", { placedKey: key, from, subject: card });
    collectAll(1 - pi, "oppPlacedRC", { from, subject: card });
    await settle();
  }
  async function callAnywhere(pi, card, from = "") {
    const opts = rcOf(pi).map((k) => ({ id: k, label: `${slotName(k)}${P(pi).slots[k] ? " (replace " + P(pi).slots[k].card.name + ")" : " (empty)"}` }));
    const [key] = await choose(pi, `Call ${card.name} to which circle?`, opts, 1, 1);
    await place(pi, card, key, from);
  }
  // a rear-guard is retired: its "when retired" abilities (it is in the drop now), "when your other rear-guard is retired",
  // and the opponent's "when your opponent's rear-guard is retired" (CR 11.2.1: look-back triggers)
  function retireBy(pi, key, byPi) {
    const sl = P(pi).slots[key];
    if (!sl) return;
    const card = sl.card, wasLocked = sl.locked;
    retire(pi, key);
    if (wasLocked || key === "vc") return;
    collect(pi, null, "retired", { card, zone: "RC", subject: card, by: byPi });
    collectAll(pi, "allyRetired", { subject: card, by: byPi });
    collectAll(1 - pi, "oppRetired", { subject: card, by: byPi });
  }
  // Replacement abilities (kind "REPL", CR 11.4): "If this unit would be retired, … instead". Before the event happens,
  // a matching REPL ability may run (optional ones ask; costs must be paid); then the card goes to ab.insteadTo
  // ("stay" = it stays where it is) and the event doesn't happen. Returns the destination, or null when nothing replaced it.
  async function replaceFor(pi, card, events, ctx) {
    const list = ctx.key ? abilitiesAt(pi, ctx.key) : ownAbilities(card);
    for (const { card: c, ab, i } of list) {
      if (ab.kind !== "REPL" || !events.includes(ab.when)) continue;
      if (ab.zone && ab.zone !== "any" && !zoneOK(ab.zone, ctx.zone)) continue;
      if (!ready(pi, c, ab, i, ctx)) continue;
      if (!ab.mandatory && !(await yesNo(pi, `${c.name}: replace it?\n${describeAbility(ab)}`))) continue;
      if (await resolve(pi, c, ab, i, ctx, false)) return ab.insteadTo || "stay";
    }
    return null;
  }
  const PLACE_NAME = { stay: "stays", soul: "goes to the soul", hand: "goes to the hand", deckTop: "goes on top of the deck", deckBottom: "goes to the bottom of the deck", bind: "is bound", removed: "is removed" };
  // retire a rear-guard, unless a replacement ability says otherwise. Returns true when it was retired.
  async function retireUnit(pi, key, byPi) {
    const sl = P(pi).slots[key];
    if (!sl || key === "vc") return false;
    const events = ["wouldBeRetired", ...(byPi !== null && byPi !== undefined && byPi !== pi ? ["wouldBeRetiredByOpp"] : [])];
    const to = sl.locked ? null : await replaceFor(pi, sl.card, events, { key, zone: zoneOf(key), card: sl.card, by: byPi });
    if (!to) { retireBy(pi, key, byPi); return true; }
    const c = sl.card;
    if (to !== "stay" && P(pi).slots[key] && P(pi).slots[key].card === c && takeAnywhere(pi, c)) await putCard(pi, c, to, pi);
    log(`↺ ${c.name} ${PLACE_NAME[to] || "goes to " + to} instead of being retired`);
    return false;
  }
  // a card goes from the hand to the drop by a cost or an effect (discarding)
  function discarded(pi, card) { collect(pi, null, "discarded", { card, zone: "hand", subject: card }); }
  async function sendTo(pi, card, dest, from = "deck") {
    const p = P(pi);
    if (dest === "RC" && card.type !== "order") return callAnywhere(pi, card, from);
    if (dest === "soul") p.soul.push(card);
    else p.hand.push(card);
  }

  // ---------- effects ----------
  // Effects run in order. Each step's result {count, cards} is "the step before" for the next one:
  // e.onlyIf: "did" / "didNot" / "match" (its cards include e.onlyFilter) / "noMatch" → "if you did…", "if a grade 3 was revealed…".
  // A "chooseOpts" step asks which option letters (e.opt = "A".."D" on the following steps) to perform.
  async function runEffects(pi, effs, ctx) {
    let last = null, opts = null;
    for (const e of effs) {
      if (over()) break;
      if (e.type === "chooseOpts") {
        const letters = [...new Set(effs.filter((x) => x.opt).map((x) => x.opt))].sort();
        const opt = letters.map((L) => ({ id: L, label: `${L}: ${effs.filter((x) => x.opt === L).map((x) => SCHEMA.effects[x.type] ? SCHEMA.effects[x.type].text(x) : x.type).join(", then ")}` }));
        const k = Math.max(1, +e.n || 1);
        opts = new Set(await choose(pi, `Choose ${k} of the following`, opt, Math.min(k, opt.length), Math.min(k, opt.length)));
        last = { count: opts.size, cards: [] };
        continue;
      }
      if (e.opt && !(opts && opts.has(e.opt))) continue;
      if (e.onlyIf) {
        const L = last || { count: 0, cards: [] };
        const hit = (L.cards || []).some((c) => match(c, e.onlyFilter, { pi, ctx }));
        const ok = { did: L.count > 0, didNot: L.count === 0, match: hit, noMatch: !hit }[e.onlyIf];
        if (ok === false) continue;
      }
      const r = await effect(pi, e, { ...ctx, last });
      last = r && typeof r === "object" ? { count: r.count || 0, cards: r.cards || [] } : { count: 1, cards: [] };
    }
    return last;
  }
  // ---------- Move cards (Ability Language v2): any zone → any zone ----------
  // e = {from, to, n, upTo, all, random, look (deck top: how many to look at), rest (where the rest go), filter, chooser: "me"|"opp", reveal}
  const ZONE_OF = { hand: "hand", deck: "deck", deckTop: "deck", drop: "drop", soul: "soul", damage: "damage", bind: "bind", gzone: "gUp", orderZone: "orderZone",
    oppHand: "hand", oppDeckTop: "deck", oppDrop: "drop", oppSoul: "soul", oppDamage: "damage", oppBind: "bind" };
  const FIELD_FROM = { myRC: "rc", myUnits: "units", myFrontRC: "front", myBackRC: "back", oppRC: "rc", oppUnits: "units", oppFrontRC: "front" };
  const sideOf = (pi, from) => (String(from).startsWith("opp") ? 1 - pi : pi);
  function moveCandidates(pi, e, ctx) {
    const side = sideOf(pi, e.from), q = P(side), env = { pi, ctx };
    if (e.from === "self") return ctx.card ? [ctx.card] : [];
    if (FIELD_FROM[e.from]) {
      const keys = { rc: rcOf(side), units: unitsOf(side), front: frontOf(side).filter((k) => k !== "vc"), back: BACK }[FIELD_FROM[e.from]];
      return unitsAt(side, keys, e.filter, env).filter((u) => !(e.filter && e.filter.other && ctx.key === u.key && side === pi));
    }
    if (e.from === "deckTop" || e.from === "oppDeckTop") return q.deck.slice(-Math.max(1, +e.look || +e.n || 1)).filter((c) => match(c, e.filter, env));
    return (q[ZONE_OF[e.from] || "drop"] || []).filter((c) => match(c, e.filter, env));
  }
  // take a card off wherever it is (zones or a circle). Returns false for G units (they go to the G zone instead)
  function takeAnywhere(side, card) {
    const q = P(side);
    for (const z of ["hand", "deck", "drop", "soul", "damage", "bind", "gUp", "orderZone", "removed"]) {
      const i = (q[z] || []).indexOf(card);
      if (i >= 0) { q[z].splice(i, 1); return true; }
    }
    for (const k of unitsOf(side)) {
      if (q.slots[k] && q.slots[k].card === card) {
        if (k === "vc") return false; // the vanguard only leaves by riding
        leaveCircle(side, k, "drop");
        const i = q.drop.indexOf(card);
        if (i < 0) return false;
        q.drop.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  async function putCard(side, c, to, actor, from = "") {
    const q = P(side);
    switch (to) {
      case "hand": q.hand.push(c); break;
      case "deckTop": q.deck.push(c); break;
      case "deckBottom": q.deck.unshift(c); break;
      case "soul": q.soul.push(c); break;
      case "bind": q.bind.push(c); break;
      case "removed": q.removed.push(c); break;
      case "damageUp": c.down = false; q.damage.push(c); break;
      case "damageDown": c.down = true; q.damage.push(c); break;
      case "orderZone": q.orderZone.push(c); break;
      case "RC": if (c.type === "order") q.drop.push(c); else await callAnywhere(side, c, from); break;
      default: q.drop.push(c);
    }
  }
  const ZONE_NAME = { hand: "hand", deck: "deck", deckTop: "top of the deck", drop: "drop", soul: "soul", damage: "damage zone", bind: "bind zone", gzone: "G zone", orderZone: "order zone",
    deckBottom: "bottom of the deck", damageUp: "damage zone", damageDown: "damage zone (face down)", RC: "RC", removed: "removed zone",
    myRC: "rear-guards", myUnits: "units", myFrontRC: "front row rear-guards", myBackRC: "back row rear-guards", self: "this card" };
  async function moveCards(pi, e, ctx) {
    const side = sideOf(pi, e.from), q = P(side), env = { pi, ctx };
    const chooser = e.chooser === "opp" ? 1 - pi : pi;
    const n = Math.max(1, +e.n || 1);
    const zn = (z) => ZONE_NAME[String(z).replace(/^opp/, "").replace(/^[A-Z]/, (m) => m.toLowerCase())] || ZONE_NAME[z] || z;
    let picked = [];
    // from the field: choose units, then they leave their circles
    if (FIELD_FROM[e.from]) {
      const units = moveCandidates(pi, e, ctx);
      const us = e.all ? units : await chooseUnits(chooser, `Choose ${e.upTo ? "up to " : ""}${n} unit(s): to ${zn(e.to)}`, units, Math.min(n, units.length), !e.upTo);
      for (const u of us) {
        if (u.pi !== pi && e.to === "drop" && restricted(u.pi, u.key, "cantBeRetired")) { log(`${P(u.pi).slots[u.key].card.name} can't be retired`); continue; }
        const c = P(u.pi).slots[u.key] && P(u.pi).slots[u.key].card;
        if (c && e.to === "drop") { if (await retireUnit(u.pi, u.key, pi)) { const q2 = P(u.pi), di = q2.drop.indexOf(c); if (di >= 0) { q2.drop.splice(di, 1); picked.push(c); } } continue; }
        if (c && takeAnywhere(u.pi, c)) picked.push(c);
      }
    } else if (e.from === "self") {
      if (ctx.card && takeAnywhere(pi, ctx.card)) picked = [ctx.card];
    } else {
      const deckTop = e.from === "deckTop" || e.from === "oppDeckTop";
      const look = deckTop ? q.deck.splice(Math.max(0, q.deck.length - Math.max(1, +e.look || n))) : null;
      const pool = look || q[ZONE_OF[e.from] || "drop"];
      const cands = pool.filter((c) => match(c, e.filter, env));
      if (look && e.reveal) log(`${q.name} reveals ${look.map((c) => c.name).join(", ") || "nothing"}`);
      if (e.all) picked = cands.slice();
      else if (e.random) { const tmp = cands.slice(); shuffle(tmp); picked = tmp.slice(0, n); }
      else if (deckTop && !e.look) picked = cands.slice(-n); // "put the top N cards into …": no choice
      else picked = await chooseCards(chooser, `${look ? `Top ${look.length} cards` : `${chooser !== side ? "Opponent's " : ""}${zn(e.from)}`}: choose ${e.upTo ? "up to " : ""}${n} → ${zn(e.to)}`, cands, e.upTo ? 0 : Math.min(n, cands.length), Math.min(n, cands.length));
      for (const c of picked) pool.splice(pool.indexOf(c), 1);
      if (look) {
        const rest = look.filter((c) => !picked.includes(c));
        const r = e.rest || "shuffle";
        if (r === "bottom") q.deck.unshift(...rest);
        else if (r === "top") q.deck.push(...rest);
        else if (r === "drop") q.drop.push(...rest);
        else if (r === "soul") q.soul.push(...rest);
        else { q.deck.push(...rest); shuffle(q.deck); }
      }
      if (e.from === "deck" || e.from === "oppDeck") shuffle(q.deck); // searching the deck shuffles it
    }
    // a deck search into the hand stays secret unless the card says "reveal"
    const secret = (e.from === "deck" || e.from === "deckTop") && e.to === "hand" && !e.reveal;
    if (picked.length) log(`${q.name}: ${secret ? picked.length + " card(s)" : picked.map((c) => c.name).join(", ")} → ${zn(e.to)}`);
    const fromName = { deckTop: "deck", oppDeckTop: "deck", gzone: "G zone" }[e.from] || String(e.from || "").replace(/^opp/, "").toLowerCase();
    for (const c of picked) {
      await putCard(side, c, e.to, pi, fromName);
      if (e.to === "soul") collect(side, null, "toSoul", { card: c, zone: "soul", subject: c });
      if (e.to === "drop" && (e.from === "hand" || e.from === "oppHand")) discarded(side, c);
    }
    if (!picked.length) log(`Move: no card (${zn(e.from)} → ${zn(e.to)})`);
    return { count: picked.length, cards: picked };
  }
  async function pickUnits(pi, e, ctx) {
    const n = +e.n || 1, f = e.filter, o = 1 - pi, env = { pi, ctx };
    const self = selfThere(pi, ctx) ? [{ pi, key: ctx.key }] : [];
    const label = `${SCHEMA.effects[e.type].label}${e.amount ? " " + e.amount : ""}: ${TARGETS[e.target] || ""}`;
    switch (e.target || "self") {
      case "self": return self;
      case "vc": return [{ pi, key: "vc" }];
      case "placed": return ctx.placedKey && P(pi).slots[ctx.placedKey] ? [{ pi, key: ctx.placedKey }] : [];
      case "attacker": return S.battle ? [{ pi: S.active, key: S.battle.att }] : [];
      case "allFront": return unitsAt(pi, frontOf(pi), f, env);
      case "allFrontRC": return unitsAt(pi, ["fl", "fr"], f, env);
      case "allMyRC": return unitsAt(pi, rcOf(pi), f, env);
      case "allMyUnits": return unitsAt(pi, unitsOf(pi), f, env);
      case "chooseMy": return chooseUnits(pi, label, unitsAt(pi, unitsOf(pi), f, env), n);
      case "chooseMyRC": return chooseUnits(pi, label, unitsAt(pi, rcOf(pi), f, env), n);
      case "chooseMyFrontRC": return chooseUnits(pi, label, unitsAt(pi, ["fl", "fr"], f, env), n);
      case "chooseMyBackRC": return chooseUnits(pi, label, unitsAt(pi, BACK, f, env), n);
      case "chooseOppRC": return chooseUnits(pi, label, unitsAt(o, rcOf(o), f, env), n);
      case "chooseOppFrontRC": return chooseUnits(pi, label, unitsAt(o, ["fl", "fr"], f, env), n);
      case "chooseOppUnit": return chooseUnits(pi, label, unitsAt(o, unitsOf(o), f, env), n);
      default: return [];
    }
  }
  async function effect(pi, e, ctx) {
    const k = times(pi, e, ctx); // "for each …"
    const p = P(pi), n = (+e.n || 1) * (["draw", "CC", "SC", "EC", "heal"].includes(e.type) ? k : 1), amt = (+e.amount || 0) * k;
    const battle = e.dur === "battle" && S.battle;
    switch (e.type) {
      case "move": return moveCards(pi, e, ctx);
      case "chooseOpts": return { count: 1 }; // handled in runEffects
      case "rideBy": { // Superior Ride: ride a card from hand / deck / drop / soul / ride deck / this card, by an effect
        const src = e.from || "deck";
        const zone = src === "rideDeck" ? p.ride : src === "self" ? null : p[src];
        const pool = src === "self" ? (ctx.card ? [ctx.card] : []) : (zone || []).filter((c) => c.type !== "order" && c.type !== "g" && match(c, e.filter, { pi, ctx }));
        const [c] = src === "self" ? pool : await chooseCards(pi, `Ride by effect: choose a card from your ${src === "rideDeck" ? "ride deck" : src}`, pool, e.upTo ? 0 : Math.min(1, pool.length), 1);
        if (src === "deck") shuffle(p.deck);
        if (!c) return { count: 0 };
        if (src === "self") { if (!takeAnywhere(pi, c)) return { count: 0 }; } else zone.splice(zone.indexOf(c), 1);
        if (src === "deck") shuffle(p.deck);
        await doRide(pi, c, false, { effect: true, from: src, stand: !!e.stand });
        return { count: 1, cards: [c] };
      }
      case "restrict": { // "cannot attack / boost / intercept / be chosen / be retired / stand / be attacked", Resist
        const us = await pickUnits(pi, e, ctx);
        for (const u of us) addMod(u.pi, u.key, { stat: "no", what: e.what, until: untilOf(pi, e.dur || "turn"), battle: e.dur === "battle" && !!S.battle });
        if (us.length) log(`🚫 ${us.map((u) => P(u.pi).slots[u.key].card.name).join(", ")}: ${SCHEMA.paramOptions.restrict[e.what] || e.what}`);
        return { count: us.length };
      }
      case "playerRule": { // "your opponent cannot call grade 1+ from hand to GC", "cannot intercept", "must guard with 2+"…
        const who = e.who === "me" ? pi : 1 - pi;
        (S.rules = S.rules || []).push({ pi: who, what: e.what, filter: e.filter, until: untilOf(pi, e.dur || "turn"), battle: e.dur === "battle" && !!S.battle });
        log(`🚫 ${P(who).name}: ${SCHEMA.paramOptions.prule[e.what] || e.what}`);
        return { count: 1 };
      }
      case "grant": { // "this unit gets "[AUTO]…" until end of turn": gives ability number N of this card (marked "granted only")
        const src = ctx.card && (ctx.card.abilities || [])[(+e.ability || 1) - 1];
        if (!src) { log("Grant: no such ability on this card"); return { count: 0 }; }
        const us = await pickUnits(pi, e, ctx);
        for (const u of us) { const sl = P(u.pi).slots[u.key]; if (sl) (sl.extra = sl.extra || []).push({ ab: src, until: untilOf(pi, e.dur || "turn"), battle: e.dur === "battle" && !!S.battle }); }
        if (us.length) log(`✨ ${us.map((u) => P(u.pi).slots[u.key].card.name).join(", ")} gain(s): ${describeAbility(src)}`);
        return { count: us.length };
      }
      case "power": case "crit": {
        const us = await pickUnits(pi, e, ctx);
        for (const u of us) {
          const s = P(u.pi).slots[u.key];
          if (!s) continue;
          if (LONG.has(e.dur)) { addMod(u.pi, u.key, { stat: e.type, amount: amt, until: untilOf(pi, e.dur) }); continue; }
          if (e.type === "power") s[battle ? "powB" : "pow"] += amt;
          else s[battle ? "critB" : "crit"] += amt;
        }
        return { count: us.length, cards: us.map((u) => P(u.pi).slots[u.key] && P(u.pi).slots[u.key].card).filter(Boolean) };
      }
      case "stand": for (const u of await pickUnits(pi, e, ctx)) if (P(u.pi).slots[u.key] && !restricted(u.pi, u.key, "cantStand")) P(u.pi).slots[u.key].rest = false; break;
      case "rest": for (const u of await pickUnits(pi, e, ctx)) if (P(u.pi).slots[u.key]) P(u.pi).slots[u.key].rest = true; break;
      case "retire": { const out = []; for (const u of await pickUnits(pi, e, ctx)) { if (u.pi !== pi && restricted(u.pi, u.key, "cantBeRetired")) { log(`${P(u.pi).slots[u.key].card.name} can't be retired`); continue; } if (u.key !== "vc" && P(u.pi).slots[u.key]) { const c = P(u.pi).slots[u.key].card; if (await retireUnit(u.pi, u.key, pi)) { log(`${c.name} is retired`); out.push(c); } } } return { count: out.length, cards: out }; }
      case "bind": for (const u of await pickUnits(pi, e, ctx)) { if (u.key !== "vc") { log(`${P(u.pi).slots[u.key].card.name} is bound`); bindUnit(u.pi, u.key); } } break;
      case "drive": p.driveBonus += amt; break;
      case "draw": draw(pi, n); return { count: n };
      case "CC": p.damage.filter((d) => d.down).slice(0, n).forEach((d) => (d.down = false)); break;
      case "SC": for (let i = 0; i < n && p.deck.length; i++) { const c = p.deck.pop(); p.soul.push(c); collect(pi, null, "toSoul", { card: c, zone: "soul", subject: c }); } break;
      case "EC": p.energy = Math.min(10, p.energy + n); break;
      case "heal": for (let i = 0; i < n && p.damage.length; i++) p.drop.push(p.damage.pop()); break;
      case "shield": if (S.battle) S.battle.shieldBonus += amt; break;
      case "cantBeHit": if (S.battle) { S.battle.perfect = true; log("🛡 The attacked unit cannot be hit"); } break;
      case "search": {
        const zone = p[e.from || "deck"];
        const picked = await chooseCards(pi, `Search ${e.from || "deck"}: choose up to ${n}`, zone.filter((c) => match(c, e.filter, { pi, ctx })), 0, n);
        for (const c of picked) { zone.splice(zone.indexOf(c), 1); await sendTo(pi, c, e.dest, e.from || "deck"); }
        if ((e.from || "deck") === "deck") shuffle(p.deck);
        return { count: picked.length, cards: picked };
      }
      case "lookTop": {
        const top = p.deck.splice(Math.max(0, p.deck.length - n));
        const picked = await chooseCards(pi, `Top ${top.length} cards: choose up to ${+e.pick || 1}`, top.filter((c) => match(c, e.filter, { pi, ctx })), 0, +e.pick || 1);
        const rest = top.filter((c) => !picked.includes(c));
        if (e.rest === "bottom") p.deck.unshift(...rest); else { p.deck.push(...rest); shuffle(p.deck); }
        for (const c of picked) await sendTo(pi, c, e.dest);
        return { count: picked.length, cards: picked };
      }
      case "gift": await giveGift(pi, e.kind || "force", false); break;
      case "lock": // Lock (CR 7.30): face down, standing; the circle is a lock circle until unlocked
        for (const u of await pickUnits(pi, e, ctx)) {
          const sl = P(u.pi).slots[u.key];
          if (!sl || u.key === "vc") continue;
          if (sl.card.type === "g") { leaveCircle(u.pi, u.key, "drop"); continue; } // a locked G unit goes to the G zone
          Object.assign(sl, { locked: true, rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
          log(`🔒 ${sl.card.name} is locked`);
        }
        break;
      case "unlock": {
        const keys = rcOf(pi).filter((k) => p.slots[k] && p.slots[k].locked);
        const picked = await choose(pi, `Unlock up to ${n} of your locked cards`, keys.map((k) => ({ id: k, label: slotName(k) })), 0, n);
        for (const k of picked) unlockAt(pi, k);
        break;
      }
      case "delete": // Delete (CR 7.32): the opponent's vanguard turns face down, loses its printed power and text
        for (const u of await pickUnits(pi, e, ctx)) {
          if (u.key !== "vc") continue;
          const sl = P(u.pi).slots.vc;
          if (!sl.deleted) { sl.deleted = true; log(`⛔ ${sl.card.name} is deleted`); }
        }
        break;
      case "timeLeap": { // Time Leap (CR 7.33): bind, call a unit 1 grade higher from the deck, swap back at end of turn
        const us = await pickUnits(pi, e, ctx);
        const calls = [];
        for (const u of us) {
          if (u.pi !== pi || u.key === "vc") continue;
          const old = p.slots[u.key].card;
          bindUnit(pi, u.key);
          const opts = p.deck.filter((c) => c.type !== "order" && c.grade === old.grade + 1);
          const [c] = await chooseCards(pi, `Time Leap ${old.name}: choose a grade ${old.grade + 1} unit from your deck`, opts, 0, 1);
          if (c) { p.deck.splice(p.deck.indexOf(c), 1); calls.push({ key: u.key, card: c, back: old.uid }); }
        }
        shuffle(p.deck);
        for (const x of calls) { await place(pi, x.card, x.key, "deck"); p.slots[x.key].timeLeap = x.back; } // called all at once
        break;
      }
      case "manual": await manualEffect(pi, ctx, e.text); break;
      case "setWorld": p.world = e.text || ""; log(`🌐 ${p.name}'s World is now ${p.world || "(none)"}`); break;
      case "seekMate": {
        // Seek Mate (CR 6.4, 14.11): legion with a named card from the deck; a unit only legions once
        const vs = p.slots.vc;
        if (vs.mate || vs.card.type === "g") { log("Already in legion"); break; }
        if (p.legionUsed.includes(vs.card.uid)) { log(`${vs.card.name} has already been in legion`); break; }
        const want = (e.text || "").toLowerCase();
        const found = p.deck.filter((c) => c.type !== "order" && (!want || c.name.toLowerCase().includes(want)));
        const [m] = await chooseCards(pi, `Seek Mate: choose ${e.text || "a card"} from your deck to legion with`, found, found.length ? 1 : 0, 1);
        shuffle(p.deck);
        if (!m) { log("Seek Mate: no mate found (deck shuffled)"); break; }
        p.deck.splice(p.deck.indexOf(m), 1);
        vs.mate = m;
        p.legionUsed.push(vs.card.uid, m.uid);
        log(`⚭ ${p.name}: ${vs.card.name} and ${m.name} form a Legion`);
        break;
      }
      case "callFromHand": {
        const picked = await chooseCards(pi, `Call up to ${n} from hand`, p.hand.filter((c) => c.type !== "order" && match(c, e.filter, { pi, ctx })), 0, n);
        for (const c of picked) { p.hand.splice(p.hand.indexOf(c), 1); await callAnywhere(pi, c, "hand"); }
        return { count: picked.length, cards: picked };
      }
    }
  }

  // ---------- Imaginary gifts (CR 6.3.7, 16) ----------
  const GIFT = { force: "Force", accel: "Accel", protect: "Protect" };
  const GIFT_OPTS = {
    force: [["I", "Force I: marker on a circle, +10000 during your turn (stacks)"], ["II", "Force II: marker on a circle, the unit there has critical 2"]],
    accel: [["I", "Accel I: a new front-row rear-guard circle, +10000 during your turn"], ["II", "Accel II: a new front-row rear-guard circle, +5000 during your turn, draw 1"]],
    protect: [["I", "Protect I: a Protect card in your hand (guard: discard 1, can't be hit)"], ["II", "Protect II: marker on a rear-guard circle, Shield +10000 when it intercepts"]],
  };
  async function giveGift(pi, kind, fromRide) {
    const p = P(pi);
    if (!GIFT[kind] || p.format === "extreme") return; // no gifts in Extreme Fight
    if (fromRide) { if (p.giftType && p.giftType !== kind) return; p.giftType = kind; } // one gift type from rides
    let v = p.giftVariant[kind];
    if (!v) { // the first I/II choice for a type is kept for the whole game (CR 16.3.1.3)
      const [pick] = await choose(pi, `Imaginary Gift: ${GIFT[kind]}. Choose I or II (kept for the whole game)`, GIFT_OPTS[kind].map(([id, label]) => ({ id, label })), 1, 1);
      v = p.giftVariant[kind] = pick || "I";
    }
    const circle = async (keys, prompt) => {
      const [k] = await choose(pi, prompt, keys.map((k) => ({ id: k, label: `${slotName(k)}${p.slots[k] ? ": " + p.slots[k].card.name : " (empty)"}` })), 1, 1);
      return k;
    };
    const mark = (k, name) => { p.marks[k] = p.marks[k] || {}; p.marks[k][name] = (p.marks[k][name] || 0) + 1; };
    if (kind === "force") mark(await circle(unitsOf(pi), `Force ${v}: put the marker on which circle?`), "force" + v);
    if (kind === "accel") { // circles are added left, right, left… of the front row (CR 16.3.1.5)
      const n = p.accel.length, key = "x" + (n + 1);
      p.accel.push({ key, variant: v, side: n % 2 === 0 ? "L" : "R", idx: Math.floor(n / 2) });
      p.slots[key] = null;
      if (v === "II") draw(pi, 1);
    }
    if (kind === "protect") {
      if (v === "I") p.hand.push({ uid: ++uidN, id: "gift-protect", name: "Protect", type: "unit", grade: 0, power: 0, shield: 0, crit: 0, sentinel: true, protect: true, abilities: [], text: "Imaginary gift. Put it on your guardian circle: discard a card, one of your units can't be hit this battle. Only exists in your hand or on the guardian circle." });
      else mark(await circle(rcOf(pi), "Protect II: put the marker on which rear-guard circle?"), "protectII");
    }
    log(`🎁 ${p.name} gets Imaginary Gift: ${GIFT[kind]} ${v}`);
  }

  // ---------- triggers ----------
  // check: "drive" | "damage". The checked card is in the trigger zone while this runs (CR 11.10).
  async function trigger(pi, c, check) {
    const t = c.trigger;
    if (!t || !TRIG[t]) return;
    const p = P(pi), o = P(1 - pi);
    const mine = unitsAt(pi, unitsOf(pi)), amt = trigPower(c);
    log(`${TRIG[t].icon} ${TRIG[t].name} trigger!`);
    if (t === "front") { unitsAt(pi, frontOf(pi)).forEach((u) => (p.slots[u.key].pow += amt)); return; }
    if (t === "over") draw(pi, 1);
    const [pu] = await chooseUnits(pi, `${TRIG[t].name} trigger: power +${amt.toLocaleString()} to which unit?`, mine, 1);
    if (pu) p.slots[pu.key].pow += amt;
    if (t === "crit") {
      const [cu] = await chooseUnits(pi, "Critical trigger: critical +1 to which unit?", mine, 1);
      if (cu) p.slots[cu.key].crit += 1;
    }
    if (t === "draw") draw(pi, 1);
    if (t === "stand") { // Premium: stand one of your rear-guards
      const rested = unitsAt(pi, rcOf(pi)).filter((u) => p.slots[u.key].rest);
      const [su] = await chooseUnits(pi, "Stand trigger: stand which rear-guard?", rested, 1);
      if (su) { p.slots[su.key].rest = false; log(`${p.slots[su.key].card.name} stands`); }
    }
    if (t === "heal") {
      // Only if your damage ≥ opponent's; the checked card isn't in the damage zone yet, so it doesn't count
      if (p.damage.length && p.damage.length >= o.damage.length) {
        const [h] = await chooseCards(pi, "Heal trigger: choose 1 damage to heal", p.damage, 1, 1);
        if (h) { p.damage.splice(p.damage.indexOf(h), 1); p.drop.push(h); log(`♥ ${p.name} heals ${h.name}`); }
      } else log("Heal trigger: no heal (your damage is less than your opponent's)");
    }
    // Over trigger on a drive check: the card's own "over trigger" text (AUTO "When revealed as an over trigger in your drive check")
    if (t === "over" && check === "drive") await fire(pi, null, "overDrive", { card: c, zone: "trigger" });
  }

  // ---------- turn flow ----------
  // Stand phase → draw phase (both players draw every turn, CR 9.4.2) → ride phase
  async function startTurn() {
    const pi = S.active, p = P(pi);
    p.vcGradeAtStart = p.slots.vc.card.grade;
    (p.orderZone || []).forEach((c) => (c.rest = false));
    for (const k of unitsOf(pi)) { const sl = p.slots[k]; if (sl && !restricted(pi, k, "cantStand")) sl.rest = false; }
    S.used = new Set();
    S.battleNo = 0;
    Object.assign(p, { driveBonus: 0, ordersThisTurn: 0, personaThisTurn: false, personaFront: false });
    S.rode = false;
    S.reveal = [];
    log(`— Turn ${S.turn}: ${p.name} —`);
    draw(pi, 1);
    ruleActions();
    if (over()) return;
    S.phase = "ride";
    await gAssist(pi);
    // Energy Generator: Energy-Charge 3 at the beginning of your ride phase, max 10
    if (p.useEnergy) p.energy = Math.min(10, p.energy + 3);
    collectAll(pi, "turnStart");
    collectAll(1 - pi, "oppTurnStart");
    await settle();
  }
  // G assist step (CR 9.5), only for players without a ride deck: vanguard below grade 3 and no unit
  // of the next grade in hand → may reveal the hand, look at the top 5, take up to 1 unit of the next
  // grade; if you take one, remove 2 cards from your hand from the game. Then shuffle.
  async function gAssist(pi) {
    const p = P(pi), g = p.slots.vc.card.grade;
    if (p.hasRideDeck || g >= 3 || !p.deck.length) return;
    if (p.hand.some((c) => c.type !== "order" && c.grade === g + 1)) return;
    if (!(await yesNo(pi, `G assist: you have no grade ${g + 1} unit in hand. Reveal your hand and look at the top 5 cards of your deck for one?`))) return;
    log(`${p.name} uses G assist. Hand: ${p.hand.map((c) => c.name).join(", ") || "(empty)"}`);
    const top = p.deck.slice(-5);
    const picks = top.filter((c) => c.type !== "order" && c.grade === g + 1);
    const [c] = await chooseCards(pi, `G assist: take up to 1 grade ${g + 1} unit from the top 5`, picks, 0, 1);
    if (c) {
      p.deck.splice(p.deck.indexOf(c), 1);
      p.hand.push(c);
      log(`${p.name} reveals ${c.name} and puts it into hand`);
      const k = Math.min(2, p.hand.length);
      const gone = await chooseCards(pi, "G assist: remove 2 cards from your hand from the game", p.hand, k, k);
      gone.forEach((x) => { p.hand.splice(p.hand.indexOf(x), 1); p.removed.push(x); });
      if (gone.length) log(`${p.name} removes ${gone.map((x) => x.name).join(", ")} from the game`);
    } else log(`${p.name} finds no grade ${g + 1}`);
    shuffle(p.deck);
  }
  async function enterMain() {
    if (S.phase === "ride" && canStride(S.active)) { S.phase = "stride"; return; } // stride step (CR 9.8)
    S.phase = "main";
    await fireAll(S.active, "mainStart");
  }
  // ---------- Stride (CR 6.5, 9.8, 14.12) ----------
  const strideUnits = (p) => p.gDeck.filter((c) => c.gKind !== "guardian" && (!c.ultimate || p.gUp.length >= 3));
  const handGrades = (cards) => cards.reduce((n, c) => n + (+c.grade || 0), 0);
  function canStride(pi) {
    const p = P(pi), o = P(1 - pi);
    if (!strideUnits(p).length || p.slots.vc.card.type === "g") return false;
    const ok = (p.slots.vc.card.grade >= 3 && o.slots.vc.card.grade >= 3) || p.vcGradeAtStart >= 3;
    return ok && handGrades(p.hand) >= 3; // default stride cost: discard cards with total grade 3+
  }
  const stride = () => run(async () => {
    if (S.phase !== "stride") return err("Stride in the stride step, right after the ride step");
    const pi = S.active, p = P(pi);
    if (!canStride(pi)) return err("You can't stride now");
    const [g] = await chooseCards(pi, "Stride: choose a G unit from your G zone", strideUnits(p), 1, 1);
    if (!g) return err("No G unit chosen");
    const picked = await chooseCards(pi, `Stride ${g.name}: discard cards from your hand whose grades total 3 or more`, p.hand, 1, p.hand.length);
    const total = handGrades(picked);
    if (total < 3) return err(`Those cards total grade ${total}; you need 3 or more`);
    picked.forEach((x) => { p.hand.splice(p.hand.indexOf(x), 1); p.drop.push(x); });
    p.gDeck.splice(p.gDeck.indexOf(g), 1);
    const vs = p.slots.vc;
    vs.heart = vs.card; // the old vanguard becomes the heart (not a ride: no ride abilities, no gifts)
    vs.heartMate = vs.mate || null; vs.mate = null; // a legion stays a legion as the heart
    vs.card = g;
    log(`⇧ ${p.name} strides ${g.name} (heart: ${vs.heart.name}) · discarded total grade ${total}`);
    collect(pi, "vc", "onStride");
    await settle();
    S.phase = "main";
    await fireAll(pi, "mainStart");
  });
  const skipStride = () => run(async () => {
    if (S.phase !== "stride") return err("Not in the stride step");
    S.phase = "main";
    await fireAll(S.active, "mainStart");
  });
  // End phase (CR 9.11.1): G units on the field go face up to the G zone; hearts become vanguards again
  function returnGUnits() {
    S.players.forEach((p, pi) => { for (const k of unitsOf(pi)) if (p.slots[k] && p.slots[k].card.type === "g") leaveCircle(pi, k, "drop"); });
  }
  // ---------- G guardian (CR 10.5.1.2.3, 14.16) ----------
  function canGGuard(di) {
    const d = P(di);
    if (!S.battle || di === S.active) return false;
    if (S.players.some((pl) => pl.slots.vc.card.grade < 3)) return false;
    if (d.gUp.filter((c) => c.gKind === "guardian").length > 3) return false;
    return d.gDeck.some((c) => c.gKind === "guardian") && d.hand.some((c) => c.type !== "order" && c.grade >= 1);
  }
  const gGuard = () => run(async () => {
    const b = S.battle, di = 1 - S.active, d = P(di);
    if (!b) return err("No attack");
    if (!canGGuard(di)) return err("You can't call a G guardian now");
    const [g] = await chooseCards(di, "G guardian: choose one to call to the guardian circle", d.gDeck.filter((c) => c.gKind === "guardian"), 1, 1);
    if (!g) return err("No G guardian chosen");
    // default cost: discard a grade 1 or greater card (card-specific costs can be added as abilities)
    const [x] = await chooseCards(di, `${g.name}: discard a grade 1 or greater card`, d.hand.filter((c) => c.type !== "order" && c.grade >= 1), 1, 1);
    if (!x) return err("No card discarded");
    d.hand.splice(d.hand.indexOf(x), 1);
    d.drop.push(x);
    d.gDeck.splice(d.gDeck.indexOf(g), 1);
    b.guards.push(g);
    log(`${d.name} calls G guardian ${g.name} (shield ${(g.shield || 0).toLocaleString()})`);
    collect(di, null, "placedGC", { card: g, zone: "GC" });
    await settle();
  });
  const mulligan = (uids) => run(async () => {
    if (S.phase !== "mulligan") return err("Not in mulligan");
    const p = P(S.controller);
    // CR 8.2.1.8: returned cards go to the bottom, draw that many, then shuffle (deck top = end of the array)
    const back = p.hand.filter((c) => uids.includes(c.uid));
    p.hand = p.hand.filter((c) => !uids.includes(c.uid));
    p.deck.unshift(...back);
    for (let i = 0; i < back.length; i++) p.hand.push(p.deck.pop());
    shuffle(p.deck);
    log(`${p.name} redraws ${back.length} card(s)`);
    if (S.controller === S.first) { S.controller = 1 - S.first; return; }
    S.controller = S.first;
    await startTurn();
  });

  // opts: {effect: true (ride by a card's effect: no persona, no "rode this turn", stays in this phase), from, stand}
  async function doRide(pi, card, fromHand, opts = {}) {
    const p = P(pi), vs = p.slots.vc;
    let old = vs.card;
    if (vs.heart) { toGZone(p, old); old = vs.heart; vs.heart = null; if (vs.heartMate) { p.soul.push(vs.heartMate); vs.heartMate = null; } }
    if (vs.mate) { p.soul.push(vs.mate); vs.mate = null; } // riding on a legion puts both into the soul (CR 6.4)
    if (vs.arms && vs.arms.length && card.name !== old.name) { p.drop.push(...vs.arms); vs.arms = []; } // arms follow only a same-name ride (CR 17.7)
    p.soul.push(old);
    p.slots.vc.card = card;
    if (!opts.effect) S.rode = true;
    if (opts.effect) vs.rest = opts.stand ? false : vs.rest; // "ride it as [Stand]"
    log(`${p.name} rides ${card.name} (G${card.grade})${opts.effect ? " by an effect" : ""}`);
    // Persona Ride (CR 6.3.8): a normal ride from hand onto a vanguard with the same name, both with the icon
    if (!opts.effect && fromHand && card.persona && old.persona && old.name === card.name) {
      p.personaFront = true;
      p.personaThisTurn = true;
      draw(pi, 1);
      log("✨ Persona Ride! Draw 1, your front row gets +10000 this turn");
    }
    if (card.gift) await giveGift(pi, card.gift, true); // gifts resolve before AUTOs (CR 11.6.1)
    const from = opts.from || (fromHand ? "hand" : "rideDeck");
    collect(pi, null, "riddenUpon", { card: old, zone: "VC", riderKey: "vc", subject: card, from });
    collect(pi, "vc", "placedVC", { from, subject: card });
    await settle();
    if (!opts.effect) await enterMain();
  }
  const nextRide = (pi) => P(pi).ride.find((c) => c.grade === P(pi).slots.vc.card.grade + 1) || null;
  const rideFromDeck = (discardUid) => run(async () => {
    if (S.phase !== "ride") return err("You can only ride in the ride phase");
    const pi = S.active, p = P(pi), next = nextRide(pi);
    if (!next) return err("No next grade in ride deck");
    const hi = p.hand.findIndex((c) => c.uid === discardUid);
    if (hi < 0) return err("Choose a card in hand to discard");
    p.drop.push(p.hand.splice(hi, 1)[0]);
    p.ride.splice(p.ride.indexOf(next), 1);
    await doRide(pi, next, false);
  });
  const rideFromHand = (uid) => run(async () => {
    if (S.phase !== "ride") return err("You can only ride in the ride phase");
    const pi = S.active, p = P(pi);
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.type === "order" || card.protect) return err("That card can't ride");
    const g = p.slots.vc.card.grade;
    if (card.grade !== g && card.grade !== g + 1) return err(`Ride grade ${g} or ${g + 1} only`);
    p.hand.splice(p.hand.indexOf(card), 1);
    await doRide(pi, card, true);
  });
  const skipRide = () => run(async () => {
    if (S.phase !== "ride") return err("Not in ride phase");
    log(`${P(S.active).name} does not ride`);
    await enterMain();
  });

  const call = (uid, key) => run(async () => {
    if (S.phase !== "main") return err("Call units in the main phase");
    if (!rcOf(S.active).includes(key)) return err("Rear-guard circles only");
    if (P(S.active).slots[key] && P(S.active).slots[key].locked) return err("That circle is locked");
    const pi = S.active, p = P(pi);
    const card = p.hand.find((c) => c.uid === uid);
    if (!card) return err("Card not in hand");
    if (card.type === "order") return err("Orders are played with the Play button");
    if (card.protect) return err("Protect can only be put on the guardian circle");
    if (card.grade > p.slots.vc.card.grade) return err("Grade must be ≤ your vanguard");
    if (ruleOn(pi, "cantCall", card)) return err(`${card.name} can't be called now`);
    p.hand.splice(p.hand.indexOf(card), 1);
    await place(pi, card, key, "hand");
  });
  const move = (a, b) => run(async () => {
    if (S.phase !== "main") return err("Move units in the main phase");
    if (PARTNER[a] !== b) return err("Units move front/back in the same column only");
    const p = P(S.active);
    [p.slots[a], p.slots[b]] = [p.slots[b], p.slots[a]];
  });

  // ACT abilities of units on the field
  // src: 0 = the unit, 1.. = arms attached to the vanguard
  function actList(pi, key) {
    const out = [];
    abilitiesAt(pi, key).forEach(({ card, ab, i, src }) => {
      if (ab.kind === "ACT" && zoneOK(ab.zone, zoneOf(key)))
        out.push({ i, src, text: (src ? card.name + ": " : "") + (typeof i === "string" ? "(granted) " : "") + describeAbility(ab), ready: ready(pi, card, ab, i, { key, card }) });
    });
    return out;
  }
  const activate = (key, i, src = 0) => run(async () => {
    if (S.phase !== "main" || S.battle) return err("Use ACT abilities in your main phase");
    const pi = S.active;
    const x = abilitiesAt(pi, key).find((y) => String(y.i) === String(i) && y.src === +src);
    if (!x) return err("No unit there");
    const card = x.card, ab = x.ab;
    if (!ab || ab.kind !== "ACT") return err("No such ability");
    if (!(await resolve(pi, card, ab, i, { key, zone: zoneOf(key), card }, false))) return err("Conditions or costs not met");
  });
  // Set orders in the order zone with ACT abilities (zone "Order zone")
  function orderZoneActs(pi) {
    const out = [];
    (P(pi).orderZone || []).forEach((card) => (card.abilities || []).forEach((ab, i) => {
      if (ab.kind === "ACT" && zoneOK(ab.zone, "OZ")) out.push({ uid: card.uid, i, text: card.name + ": " + describeAbility(ab), ready: ready(pi, card, ab, i, { key: null, zone: "OZ", card }) });
    }));
    return out;
  }
  // ACT abilities of cards in your hand / drop / soul / damage / bind / G zone ([ACT](Drop) etc.)
  function zoneActs(pi) {
    const p = P(pi), out = [];
    for (const [zone, z] of Object.entries(CARD_ZONES)) for (const card of p[z] || []) {
      if (card.down && zone === "damage") continue;
      (card.abilities || []).forEach((ab, i) => {
        if (ab.kind === "ACT" && ab.zone === zone && !ab.granted)
          out.push({ uid: card.uid, i, zone, text: `${card.name} (${zone}): ${describeAbility(ab)}`, ready: ready(pi, card, ab, i, { key: null, zone, card }) });
      });
    }
    return out;
  }
  const activateZone = (uid, i) => run(async () => {
    const pi = S.battle && S.controller !== S.active ? S.controller : S.active, p = P(pi);
    for (const [zone, z] of Object.entries(CARD_ZONES)) {
      const card = (p[z] || []).find((c) => c.uid === uid);
      if (!card) continue;
      const ab = (card.abilities || [])[i];
      if (!ab || ab.kind !== "ACT" || ab.zone !== zone) return err("No such ability");
      if (!S.battle && S.phase !== "main") return err("Use ACT abilities in your main phase");
      if (!(await resolve(pi, card, ab, i, { key: null, zone, card }, false))) return err("Conditions or costs not met");
      return;
    }
    return err("Card not found");
  });
  const activateOrderZone = (uid, i) => run(async () => {
    if (S.phase !== "main" || S.battle) return err("Use ACT abilities in your main phase");
    const pi = S.active, card = (P(pi).orderZone || []).find((c) => c.uid === uid);
    const ab = card && (card.abilities || [])[i];
    if (!ab || ab.kind !== "ACT") return err("No such ability");
    if (!(await resolve(pi, card, ab, i, { key: null, zone: "OZ", card }, false))) return err("Conditions or costs not met");
  });

  // Orders from hand
  function orderAbility(card, kind) { return (card.abilities || []).map((ab, i) => ({ ab, i })).find(({ ab }) => ab.kind === kind); }
  const playOrder = (uid) => run(async () => {
    const guarding = S.battle && S.controller !== S.active;
    const pi = guarding ? 1 - S.active : S.active, p = P(pi);
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.type !== "order") return err("Not an order card");
    const kind = guarding ? "BLITZ" : "ORDER";
    if (!guarding && (S.phase !== "main" || S.battle)) return err("Normal orders: your main phase only");
    if (card.grade > p.slots.vc.card.grade) return err("An order's grade must be ≤ your vanguard's");
    if (p.orderTurn === S.turn) return err("Only 1 order per turn (blitz orders count too)");
    const found = orderAbility(card, kind);
    if (!found) return err(guarding ? "This is not a blitz order" : "This is not a normal order");
    const ctx = { key: null, zone: "hand", card };
    p.hand.splice(p.hand.indexOf(card), 1);
    p.ordersThisTurn++;
    p.orderTurn = S.turn;
    // A second Regalis Piece goes to the drop without resolving (CR 14.51.2.2.1)
    if (card.regalis && p.regalisUsed >= 1) { log(`${p.name} plays ${card.name}: Regalis Piece already used this game, it goes to the drop`); p.drop.push(card); return; }
    let ab = found.ab;
    // Alchemagic (CR 7.44): also designate a normal order in your drop; its conditions, costs and effects are added after this one's
    if (!guarding && card.alchemagic) {
      // (a used Regalis Piece can't come back this way: it resolves once per game)
      const others = p.drop.filter((c) => c.type === "order" && c.name !== card.name && orderAbility(c, "ORDER") && !(c.regalis && p.regalisUsed >= 1));
      if (others.length && await yesNo(pi, `Alchemagic: also use a normal order from your drop with ${card.name}?`)) {
        const [b] = await chooseCards(pi, "Alchemagic: choose the order from your drop", others, 1, 1);
        const bab = b && orderAbility(b, "ORDER").ab;
        if (bab) {
          ab = { ...ab, conds: [...(ab.conds || []), ...(bab.conds || [])], costs: [...(ab.costs || []), ...(bab.costs || [])], effects: [...(ab.effects || []), ...(bab.effects || [])] };
          if (b.regalis) p.regalisUsed++; // resolving a Regalis Piece's text uses the once-per-game limit
          log(`⚗ Alchemagic: ${card.name} + ${b.name}`);
        }
      }
    }
    if (!ready(pi, card, ab, found.i, ctx)) { p.ordersThisTurn--; p.orderTurn = -1; p.hand.push(card); return err("Conditions or costs not met"); }
    log(`${p.name} plays ${card.name}`);
    await resolve(pi, card, ab, found.i, ctx, false);
    await fireAll(pi, "orderPlayed", { subject: card });
    const vs = p.slots.vc;
    if (card.arms) {
      // Arms (CR 17.7): attaches to your vanguard if its name matches; only the last one with the same name stays
      const need = String(card.armsName || "").toLowerCase();
      const names = [vs.card, vs.heart, vs.mate].filter(Boolean).map((c) => c.name.toLowerCase());
      if (!need || names.some((n) => n.includes(need))) {
        vs.arms = vs.arms || [];
        const same = vs.arms.find((a) => a.name === card.name);
        if (same) { vs.arms.splice(vs.arms.indexOf(same), 1); p.drop.push(same); }
        vs.arms.push(card);
        log(`${card.name} is attached to ${vs.card.name} (Arms)`);
        return;
      }
      log(`${card.name}: no vanguard named "${card.armsName}", it goes to the drop`);
    }
    if (card.setOrder) { p.orderZone.push(card); log(`${card.name} goes to the order zone`); return; } // set order (CR 4.17)
    p.drop.push(card);
  });

  // Energy Generator crest: ACT [1/Turn] Energy-Blast 7 → draw 1 (main phase)
  const energyDraw = () => run(async () => {
    const pi = S.active, p = P(pi);
    if (!p.useEnergy) return err("No Energy Generator");
    if (S.phase !== "main" || S.battle) return err("Use it in your main phase");
    if (p.egTurn === S.turn) return err("Once per turn");
    if (p.energy < 7) return err("Needs 7 energy");
    p.energy -= 7;
    p.egTurn = S.turn;
    draw(pi, 1);
    log(`${p.name}: Energy Generator, Energy-Blast 7 → draw 1`);
  });

  // ---------- overDress (CR 6.7) / XoverDress (CR 6.8) ----------
  // card.dress: has overDress; card.overDress: name the rear-guard must contain ("" = any). card.xoverDress: required names "A | B".
  const dressTargets = (pi, card) => rcOf(pi).filter((k) => {
    const s = P(pi).slots[k];
    return s && (!card.overDress || [s.card, ...(s.under || [])].some((c) => c.name.toLowerCase().includes(String(card.overDress).toLowerCase())));
  });
  async function dressOnto(pi, card, key, under) {
    const p = P(pi);
    p.hand.splice(p.hand.indexOf(card), 1);
    const old = p.slots[key];
    p.slots[key] = { ...slot(card), rest: old ? old.rest : false, under };
    log(`👗 ${p.name}: ${card.name} ${card.xoverDress ? "XoverDress" : "overDress"} onto ${under.map((c) => c.name).join(" + ")}`);
    collect(pi, key, "dressed");
    for (const k of unitsOf(pi)) if (k !== key && p.slots[k]) collect(pi, k, "allyPlacedRC", { placedKey: key });
    await settle();
  }
  const overDress = (uid, key) => run(async () => {
    if (S.phase !== "main" || S.battle) return err("overDress in your main phase");
    const pi = S.active, p = P(pi), card = p.hand.find((c) => c.uid === uid);
    if (!card || !card.dress || card.xoverDress) return err("That card has no overDress");
    if (card.grade > p.slots.vc.card.grade) return err("Grade must be ≤ your vanguard");
    if (!dressTargets(pi, card).includes(key)) return err(card.overDress ? `overDress onto a rear-guard named "${card.overDress}"` : "overDress onto one of your rear-guards");
    const s = p.slots[key];
    await dressOnto(pi, card, key, [s.card, ...(s.under || [])]); // the old unit becomes the originalDress (not a call)
  });
  const xoverDress = (uid) => run(async () => {
    if (S.phase !== "main" || S.battle) return err("XoverDress in your main phase");
    const pi = S.active, p = P(pi), card = p.hand.find((c) => c.uid === uid);
    if (!card || !card.xoverDress) return err("That card has no XoverDress");
    if (card.grade > p.slots.vc.card.grade) return err("Grade must be ≤ your vanguard");
    const needs = String(card.xoverDress).split("|").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const keys = [];
    for (const nm of needs) {
      const opts = rcOf(pi).filter((k) => p.slots[k] && !keys.includes(k) && p.slots[k].card.name.toLowerCase().includes(nm));
      if (!opts.length) return err(`XoverDress needs a rear-guard named "${nm}"`);
      const [k] = await choose(pi, `XoverDress ${card.name}: choose the rear-guard "${nm}"`, opts.map((k) => ({ id: k, label: `${slotName(k)}: ${p.slots[k].card.name}`, card: p.slots[k].card })), 1, 1);
      keys.push(k);
    }
    const [dest] = keys.length > 1 ? await choose(pi, "XoverDress: put it on which of those circles?", keys.map((k) => ({ id: k, label: slotName(k) })), 1, 1) : keys;
    const under = keys.flatMap((k) => [p.slots[k].card, ...(p.slots[k].under || [])]);
    keys.forEach((k) => { if (k !== dest) p.slots[k] = null; });
    await dressOnto(pi, card, dest, under);
  });

  function unlockAt(pi, k) {
    const sl = P(pi).slots[k];
    if (!sl || !sl.locked) return;
    sl.locked = false; sl.rest = false; // turned face up in the stand position (CR 7.31)
    log(`🔓 ${sl.card.name} is unlocked`);
    collect(pi, k, "unlocked");
  }
  // End phase (CR 9.11): the turn player's locked and deleted cards return; Time Leap units swap back
  function endPhaseReturns(pi) {
    const p = P(pi);
    for (const k of unitsOf(pi)) {
      const sl = p.slots[k];
      if (!sl) continue;
      if (sl.locked) unlockAt(pi, k);
      if (sl.deleted) { sl.deleted = false; log(`${sl.card.name} is no longer deleted`); }
      if (sl.timeLeap) {
        const back = p.bind.find((c) => c.uid === sl.timeLeap);
        p.deck.unshift(sl.card); // the leaped unit goes to the bottom of the deck
        if (sl.under && sl.under.length) p.drop.push(...sl.under);
        p.slots[k] = back ? slot(back) : null;
        if (back) p.bind.splice(p.bind.indexOf(back), 1);
        log(`⏱ Time Leap ends: ${back ? back.name + " returns" : "the circle is empty"}`);
      }
    }
  }
  // ---------- manual effects / judge mode ----------
  // A "Manual" block pauses the game: the players do the card's text by hand with judgeOp() (move any card,
  // change power/critical, rest/stand, energy, shuffle), then answer Done. judgeOp() also works any time in hot-seat.
  async function manualEffect(pi, ctx, text) {
    S.judge = { by: pi, text: text || (ctx.card && ctx.card.text) || "Do this card's text by hand" };
    log(`✋ ${ctx.card ? ctx.card.name + ": " : ""}manual effect, resolve it by hand`);
    try { await choose(pi, `✋ Manual: ${S.judge.text}\nUse the Judge panel to do it, then press Done.`, [{ id: "done", label: "Done ✓" }, { id: "skip", label: "Skip (do nothing)" }], 1, 1); }
    finally { S.judge = null; }
  }
  const ZONES = ["hand", "deck", "drop", "soul", "damage", "bind", "removed", "orderZone", "gUp", "gDeck"];
  function judgeOp(op) {
    if (!S || over()) return err("No game");
    const p = P(op.pi);
    if (!p) return err("No such player");
    const findCard = () => {
      for (const z of ZONES) { const i = (p[z] || []).findIndex((c) => c.uid === op.uid); if (i >= 0) return { z, i, card: p[z][i] }; }
      for (const k of unitsOf(op.pi)) if (p.slots[k] && p.slots[k].card.uid === op.uid) return { k, card: p.slots[k].card };
      return null;
    };
    switch (op.op) {
      case "move": {
        const at = findCard();
        if (!at) return err("Card not found");
        if (at.z) p[at.z].splice(at.i, 1);
        else { const sl = p.slots[at.k]; if (at.k === "vc") return err("Ride or stride to change the vanguard"); p.slots[at.k] = null; if (sl.under) p.drop.push(...sl.under); }
        const c = at.card;
        if (op.to === "deckTop") p.deck.push(c);
        else if (op.to === "deckBottom") p.deck.unshift(c);
        else if (op.to === "damageDown") { c.down = true; p.damage.push(c); }
        else if (op.to === "damage") { c.down = false; p.damage.push(c); }
        else if (ZONES.includes(op.to)) p[op.to].push(c);
        else if (rcOf(op.pi).includes(op.to)) { if (p.slots[op.to]) p.drop.push(p.slots[op.to].card); p.slots[op.to] = slot(c); }
        else return err("Unknown destination");
        log(`⚖ ${p.name}: ${c.name} → ${op.to}`);
        break;
      }
      case "power": { const sl = p.slots[op.key]; if (!sl) return err("No unit"); sl.pow += +op.amount || 0; log(`⚖ ${sl.card.name} power ${op.amount > 0 ? "+" : ""}${op.amount}`); break; }
      case "crit": { const sl = p.slots[op.key]; if (!sl) return err("No unit"); sl.crit += +op.amount || 0; log(`⚖ ${sl.card.name} critical ${op.amount > 0 ? "+" : ""}${op.amount}`); break; }
      case "rest": { const sl = p.slots[op.key]; if (!sl) return err("No unit"); sl.rest = !!op.value; log(`⚖ ${sl.card.name} ${sl.rest ? "rests" : "stands"}`); break; }
      case "lock": { const sl = p.slots[op.key]; if (!sl || op.key === "vc") return err("Rear-guards only"); sl.locked = !sl.locked; log(`⚖ ${sl.card.name} ${sl.locked ? "locked" : "unlocked"}`); break; }
      case "flip": { const c = p.damage.find((x) => x.uid === op.uid); if (!c) return err("Not in damage"); c.down = !c.down; log(`⚖ ${c.name} turned face ${c.down ? "down" : "up"}`); break; }
      case "energy": p.energy = Math.max(0, Math.min(10, p.energy + (+op.amount || 0))); log(`⚖ ${p.name} energy ${p.energy}`); break;
      case "shuffle": shuffle(p.deck); log(`⚖ ${p.name} shuffles the deck`); break;
      case "draw": draw(op.pi, 1); log(`⚖ ${p.name} draws 1`); break;
      default: return err("Unknown judge action");
    }
    ruleActions();
    onChange();
    return OK;
  }

  // ---------- test table (index.html?test=<card id>): put a card anywhere and fire its events ----------
  // ops: ride {uid} · call {uid, key} · fire {key, event} · fill {zone, n} (top deck cards → soul/drop/damage/hand/bind, gUp from the G deck)
  const testOp = (op) => run(async () => {
    const pi = op.pi ?? 0, p = P(pi);
    const take = (uid) => {
      for (const z of ZONES) { const i = (p[z] || []).findIndex((c) => c.uid === uid); if (i >= 0) return p[z].splice(i, 1)[0]; }
      return null;
    };
    switch (op.op) {
      case "ride": {
        const card = take(op.uid);
        if (!card) return err("Card not found");
        const vs = p.slots.vc, old = vs.card;
        if (vs.heart) { toGZone(p, old); p.soul.push(vs.heart); vs.heart = null; } else p.soul.push(old);
        vs.card = card;
        log(`🧪 ${p.name} rides ${card.name}`);
        if (card.gift) await giveGift(pi, card.gift, true);
        collect(pi, null, "riddenUpon", { card: old, zone: "VC", riderKey: "vc" });
        collect(pi, "vc", "placedVC");
        await settle();
        break;
      }
      case "call": {
        if (!rcOf(pi).includes(op.key)) return err("Pick a rear-guard circle");
        const card = take(op.uid);
        if (!card) return err("Card not found");
        log(`🧪 test call`);
        await place(pi, card, op.key);
        break;
      }
      case "fire": {
        if (!p.slots[op.key]) return err("No unit on that circle");
        log(`🧪 event “${op.event}” on ${p.slots[op.key].card.name}`);
        collect(pi, op.key, op.event);
        await settle();
        break;
      }
      case "fill": {
        const n = Math.max(1, +op.n || 1);
        for (let i = 0; i < n; i++) {
          if (op.zone === "gUp") { if (!p.gDeck.length) break; p.gUp.push(p.gDeck.pop()); continue; }
          const c = p.deck.pop();
          if (!c) break;
          if (op.zone === "damage") { c.down = false; p.damage.push(c); } else p[op.zone].push(c);
        }
        log(`🧪 ${p.name}: +${n} ${op.zone === "gUp" ? "face-up G card" : op.zone}`);
        break;
      }
      default: return err("Unknown test action");
    }
  });

  // ---------- battle ----------
  const toBattle = () => run(async () => {
    if (S.phase !== "main") return err("Not in main phase");
    S.phase = "battle";
    log("⚔ Battle phase");
    await fireAll(S.active, "battleStart");
  });
  function canAttack(key) {
    const s = S.players[S.active].slots[key];
    // the first player can't attack on their first turn (CR 10.3.2)
    return S.phase === "battle" && S.turn > 1 && !S.battle && frontOf(S.active).includes(key) && !!s && !s.rest && !s.locked
      && !restricted(S.active, key, "cantAttack") && !lordBlocks(S.active, key);
  }
  // Lord: this unit can't attack while you have a unit of another clan / nation
  function lordBlocks(pi, key) {
    const c = P(pi).slots[key].card;
    if (!c.lord) return false;
    const clan = (x) => String(x.clan || x.nation || "").trim().toLowerCase();
    const mine = clan(c);
    return !!mine && unitsOf(pi).some((k) => P(pi).slots[k] && !P(pi).slots[k].locked && clan(P(pi).slots[k].card) && clan(P(pi).slots[k].card) !== mine);
  }
  function boosterFor(pi, key) {
    const bk = BACK_OF[key], b = bk && P(pi).slots[bk];
    return b && !b.rest && !b.locked && canBoostIcon(b.card) && !restricted(pi, bk, "cantBoost") ? bk : null;
  }
  const attack = (att, useBoost, tgt) => run(async () => {
    if (!canAttack(att)) return err("That unit can't attack");
    const ai = S.active, di = 1 - ai, p = P(ai);
    if (!frontOf(di).includes(tgt) || !P(di).slots[tgt] || P(di).slots[tgt].locked) return err("Attack an opponent's front row unit");
    if (restricted(di, tgt, "cantBeAttacked")) return err("That unit can't be attacked");
    p.slots[att].rest = true;
    const bk = useBoost ? boosterFor(ai, att) : null;
    if (bk) p.slots[bk].rest = true;
    S.battle = { att, tgt, boostKey: bk, guards: [], perfect: false, shieldBonus: 0 };
    S.battleNo = (S.battleNo || 0) + 1; // "the Nth battle of that turn"
    S.reveal = [];
    log(`${p.slots[att].card.name}${bk ? " (boosted)" : ""} attacks ${P(di).slots[tgt].card.name}`);
    collect(ai, att, "attack");
    if (bk) { collect(ai, bk, "boost"); collect(ai, att, "boosted", { subject: p.slots[bk].card }); }
    collect(di, tgt, "attacked");
    collectAll(ai, "allyAttacks", { subject: p.slots[att].card, attKey: att });
    collectZones(di, "oppAttacks", { subject: p.slots[att].card });
    await settle();
    if (!S.battle) return;
    if (!P(ai).slots[att] || !P(di).slots[tgt]) { log("A unit left the field; the battle ends"); await endBattle(); return; }
    // guard step begins (CR 10.4.3)
    await fireAll(di, "guardStart", { subject: p.slots[att].card });
    if (!S.battle) return;
    S.controller = di;
  });
  function attackPower() {
    const b = S.battle;
    return power(S.active, b.att) + (b.boostKey && P(S.active).slots[b.boostKey] ? power(S.active, b.boostKey) : 0);
  }
  function defensePower() {
    const b = S.battle;
    return power(1 - S.active, b.tgt) + b.guards.reduce((n, c) => n + (c.shield || 0), 0) + b.shieldBonus;
  }
  const guard = (uid) => run(async () => {
    const b = S.battle, di = 1 - S.active, d = P(di);
    if (!b) return err("No attack to guard");
    const card = d.hand.find((c) => c.uid === uid);
    if (!card) return err("Card not in hand");
    if (card.type === "order") return err("Orders can't guard. Blitz orders use the Play button");
    if (ruleOn(di, "cantGuard", card)) return err(`${card.name} can't be called to the guardian circle now`);
    d.hand.splice(d.hand.indexOf(card), 1);
    b.guards.push(card);
    b.handGuards = (b.handGuards || 0) + 1;
    await fire(di, null, "placedGC", { card, zone: "GC" });
    // Built-in sentinel only when the card doesn't already describe its own guard ability
    const ownGuardAbility = (card.abilities || []).some((a) => a.kind === "AUTO" && a.when === "placedGC");
    if (card.sentinel && !ownGuardAbility) {
      if (!d.hand.length) { log("No card to discard; sentinel has no effect"); return; }
      const [x] = await chooseCards(di, `${card.name}: discard 1 card to make the attacked unit impossible to hit`, d.hand, 1, 1);
      d.hand.splice(d.hand.indexOf(x), 1);
      d.drop.push(x);
      b.perfect = true;
      log("🛡 Perfect guard!");
    }
  });
  const intercept = (key) => run(async () => {
    const b = S.battle, di = 1 - S.active, d = P(di), s = d.slots[key];
    if (!b) return err("No attack");
    if (!["fl", "fr"].includes(key) || !s) return err("Only front row rear-guards can intercept");
    if (s.locked) return err("A locked card can't intercept");
    if (!canInterceptIcon(s.card)) return err("This unit has no Intercept skill");
    if (key === b.tgt) return err("The attacked unit can't intercept");
    if (restricted(di, key, "cantIntercept") || ruleOn(di, "cantIntercept")) return err("This unit can't intercept now");
    b.guards.push(s.card);
    const pm = d.marks[key];
    if (pm && pm.protectII) { b.shieldBonus += 10000 * pm.protectII; log(`Protect II: Shield +${(10000 * pm.protectII).toLocaleString()}`); }
    d.slots[key] = null;
    log(`${s.card.name} intercepts`);
  });
  const confirmGuard = () => run(async () => {
    const b = S.battle;
    if (!b) return err("No attack");
    const ai = S.active, di = 1 - ai, p = P(ai), d = P(di);
    if (b.handGuards === 1 && ruleOn(di, "mustGuard2")) return err("You must call two or more cards from your hand to guard (or none)");
    S.controller = ai;
    if (b.att === "vc") {
      const n = driveOf(p.slots.vc.card) + p.driveBonus;
      for (let i = 0; i < n && !over(); i++) {
        if (!p.deck.length) { lose(ai, "deck is empty"); ruleActions(); return; }
        const c = p.deck.pop();
        S.reveal.push({ type: "Drive", card: c });
        log(`Drive check: ${c.name}`);
        collectAll(ai, "driveReveal", { subject: c });
        collect(ai, null, "revealedDrive", { card: c, zone: "deck", subject: c });
        await trigger(ai, c, "drive");
        if (c.trigger === "over") { p.removed.push(c); log(`${c.name} is removed from the game`); } else p.hand.push(c);
      }
    }
    if (over()) return;
    const atk = attackPower(), def = defensePower();
    const hit = !b.perfect && atk >= def;
    log(`${atk.toLocaleString()} vs ${def.toLocaleString()} → ${hit ? "HIT!" : "guarded"}`);
    if (hit) {
      if (b.tgt === "vc") {
        const n = crit(ai, b.att);
        for (let i = 0; i < n && !over(); i++) {
          if (!d.deck.length) { lose(di, "deck is empty"); ruleActions(); break; }
          const c = d.deck.pop();
          S.reveal.push({ type: "Damage", card: c });
          log(`Damage check: ${c.name}`);
          collectAll(di, "damageReveal", { subject: c });
          collect(di, null, "revealedDamage", { card: c, zone: "deck", subject: c });
          await trigger(di, c, "damage");
          if (c.trigger === "over") { d.removed.push(c); log(`${c.name} is removed from the game`); } else d.damage.push(c);
          ruleActions(); // 6 damage is a rule action, checked after each damage check
        }
      } else b.hitUid = d.slots[b.tgt].card.uid;
      if (!over()) await fire(ai, b.att, "attackHit");
    } else if (!over() && P(ai).slots[b.att]) await fire(ai, b.att, "attackNoHit");
    await endBattle();
  });
  async function endBattle() {
    const b = S.battle;
    if (!b) return;
    const ai = S.active;
    const d = P(1 - ai);
    b.guards.filter((c) => c.type === "g").forEach((g) => toGZone(d, g));
    for (const c of b.guards.filter((x) => x.type !== "g")) { // "if this card would be put into the drop from (GC), … instead"
      const to = c.protect ? null : await replaceFor(1 - ai, c, ["wouldLeaveGC"], { key: null, zone: "GC", card: c });
      if (to && to !== "stay") { await putCard(1 - ai, c, to, 1 - ai); log(`↺ ${c.name} ${PLACE_NAME[to] || "goes to " + to} instead of the drop`); }
      else d.drop.push(c);
    }
    b.guards = [];
    if (b.hitUid && d.slots[b.tgt] && d.slots[b.tgt].card.uid === b.hitUid) { const hc = d.slots[b.tgt].card; if (await retireUnit(1 - ai, b.tgt, ai)) log(`${hc.name} is retired`); }
    if (!over()) await fire(ai, b.att, "battleEnd");
    S.players.forEach((pl) => Object.values(pl.slots).forEach((s) => s && (s.powB = 0, s.critB = 0)));
    expire(true);
    S.battle = null;
    S.controller = ai;
  }

  const endTurn = () => run(async () => {
    if (S.battle) return err("Finish the battle first");
    if (S.phase === "mulligan") return err("Still in mulligan");
    returnGUnits();
    endPhaseReturns(S.active);
    collectAll(S.active, "endTurn");
    collectAll(1 - S.active, "oppTurnEnd");
    await settle();
    if (over()) return;
    P(S.active).personaFront = false;
    S.players.forEach((pl) => Object.values(pl.slots).forEach((s) => s && Object.assign(s, { pow: 0, crit: 0, powB: 0, critB: 0 })));
    expire(false);
    S.active = 1 - S.active;
    S.controller = S.active;
    S.turn++;
    await startTurn(false);
  });

  // ---------- online sync ----------
  // Plain JSON copy of the state. With a seat, hides what that player may not see:
  // the opponent's hand and ride deck, both decks' order, and the opponent's choice options.
  // Card images are left out (sent once at game start) to keep messages small.
  function snapshot(seat = null) {
    const s = JSON.parse(JSON.stringify({ ...S, used: [...S.used], usedGame: [...S.usedGame] }, (k, v) => (k === "image" ? undefined : v)));
    if (seat === null) return s;
    let fake = 0;
    const hide = (cards) => cards.map(() => ({ uid: -(++fake), name: "?", hidden: true, type: "unit", grade: 0, power: 0 }));
    s.players.forEach((p, i) => {
      p.deck = hide(p.deck);
      if (i !== seat) {
        p.hand = hide(p.hand); p.ride = hide(p.ride); p.gDeck = hide(p.gDeck || []);
        Object.values(p.slots).forEach((sl) => { if (sl && sl.locked) sl.card = hide([sl.card])[0]; });
      }
    });
    if (s.pending && s.pending.player !== seat) s.pending.options = [];
    return s;
  }
  // Show a received snapshot (guest side). Pure helpers (power, actList…) then work on it.
  function load(state) {
    S = { ...state, used: new Set(state.used), usedGame: new Set(state.usedGame) };
    resume = null;
    onChange();
  }

  return {
    FRONT, RC, UNITS, BACK_OF, frontOf, rcOf, unitsOf,
    newGame, state: () => S, setOnChange: (f) => (onChange = f), snapshot, load, checkTiming,
    power, crit, faceUp, nextRide, boosterFor, canAttack, actList, attackPower, defensePower,
    answer, mulligan, rideFromDeck, rideFromHand, skipRide, call, move, activate, playOrder,
    toBattle, attack, guard, intercept, confirmGuard, endTurn, energyDraw, judgeOp, testOp, zoneActs, activateZone, overDress, xoverDress, dressTargets, orderZoneActs, activateOrderZone, stride, skipStride, gGuard, canStride, canGGuard, gFaceUp,
    driveOf, canBoostIcon, canInterceptIcon, trigPower, giftPower,
  };
})();
