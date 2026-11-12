// Rules engine. All game state lives in S. No DOM access here.
// Actions are async because abilities can stop and ask a player to choose (Game.answer resumes).

const Game = (() => {
  const FRONT = ["fl", "vc", "fr"], BACK = ["bl", "bc", "br"], RC = ["fl", "fr", "bl", "bc", "br"];
  const UNITS = ["vc", ...RC];
  const BACK_OF = { fl: "bl", vc: "bc", fr: "br" };
  const PARTNER = { fl: "bl", bl: "fl", fr: "br", br: "fr" };
  const SLOT_NAME = { vc: "VC", fl: "front-left RC", fr: "front-right RC", bl: "back-left RC", bc: "back-center RC", br: "back-right RC" };

  let S = null, uidN = 0, resume = null;
  let onChange = () => {};

  const OK = { ok: true };
  const err = (msg) => ({ ok: false, msg });
  const inst = (def) => ({ ...JSON.parse(JSON.stringify(def)), uid: ++uidN, down: false });
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const slot = (card) => ({ card, rest: false, pow: 0, crit: 0, powB: 0, critB: 0 });
  const P = (i) => S.players[i];
  const over = () => S.winner !== null;
  const log = (m) => { S.log.unshift(m); if (S.log.length > 120) S.log.pop(); };

  // ---------- setup ----------
  function makePlayer(name, deck) {
    const ride = deck.ride.map(inst).sort((a, b) => a.grade - b.grade);
    const p = {
      name, deckName: deck.name, useEnergy: !!deck.energy, energy: 0,
      deck: shuffle(deck.main.map(inst)), ride: ride.slice(1),
      hand: [], soul: [], damage: [], drop: [], bind: [],
      slots: { vc: slot(ride[0]), fl: null, fr: null, bl: null, bc: null, br: null },
      driveBonus: 0, ordersThisTurn: 0, personaThisTurn: false,
    };
    for (let i = 0; i < 5; i++) p.hand.push(p.deck.pop());
    return p;
  }
  function newGame(names, decks) {
    uidN = 0;
    resume = null;
    S = {
      players: [makePlayer(names[0], decks[0]), makePlayer(names[1], decks[1])],
      active: 0, controller: 0, turn: 1, phase: "mulligan",
      rode: false, battle: null, winner: null, pending: null, busy: false,
      log: [], reveal: [], used: new Set(), usedGame: new Set(),
    };
    log(`Game start! ${S.players[0].name} goes first (no draw on turn 1)`);
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
    finally { S.busy = false; onChange(); }
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
    const opts = units.map((u) => ({ id: u.pi + ":" + u.key, label: `${u.pi === pi ? "Your" : "Opponent's"} ${SLOT_NAME[u.key]}: ${P(u.pi).slots[u.key].card.name}`, card: P(u.pi).slots[u.key].card }));
    const ids = await choose(pi, prompt, opts, exact ? n : 0, n);
    return ids.map((id) => ({ pi: +id.split(":")[0], key: id.split(":")[1] }));
  }

  // ---------- basic helpers ----------
  function lose(pi, why) {
    if (over()) return;
    S.winner = 1 - pi;
    S.battle = null;
    log(`🏆 ${P(S.winner).name} wins! (${P(pi).name}: ${why})`);
  }
  function draw(pi, n = 1) {
    const p = P(pi);
    for (let i = 0; i < n; i++) {
      if (!p.deck.length) return lose(pi, "deck is empty");
      p.hand.push(p.deck.pop());
    }
  }
  const faceUp = (p) => p.damage.filter((c) => !c.down).length;
  function match(c, f) {
    if (!f) return true;
    if (f.gmin !== undefined && f.gmin !== "" && c.grade < +f.gmin) return false;
    if (f.gmax !== undefined && f.gmax !== "" && c.grade > +f.gmax) return false;
    if (f.name && !c.name.toLowerCase().includes(f.name.toLowerCase())) return false;
    const t = f.ctype || "any";
    if (t === "unit" && c.type !== "unit") return false;
    if (t === "trigger" && c.type !== "trigger") return false;
    if (t === "anyunit" && c.type === "order") return false;
    if (t === "order" && c.type !== "order") return false;
    return true;
  }
  const zoneOf = (key) => (key === "vc" ? "VC" : "RC");
  const zoneOK = (abZone, zone) => !abZone || abZone === "any" || abZone === zone || (abZone === "VC/RC" && (zone === "VC" || zone === "RC"));
  const unitsAt = (pi, keys, f) => keys.filter((k) => P(pi).slots[k] && match(P(pi).slots[k].card, f)).map((key) => ({ pi, key }));

  // ---------- power (incl. CONT abilities) ----------
  function contTargets(t, k) {
    return { self: [k], vc: ["vc"], allFront: FRONT, allFrontRC: ["fl", "fr"], allMyRC: RC, allMyUnits: UNITS }[t || "self"] || [];
  }
  function cont(pi, key, stat) {
    const p = P(pi);
    let sum = 0;
    for (const k of UNITS) {
      const s = p.slots[k];
      if (!s) continue;
      for (const ab of s.card.abilities || []) {
        if (ab.kind !== "CONT" || !zoneOK(ab.zone, zoneOf(k))) continue;
        if (!(ab.conds || []).every((c) => condOK(pi, c, { key: k, card: s.card }))) continue;
        for (const e of ab.effects || []) {
          if (e.type === stat && contTargets(e.target, k).includes(key) && match(p.slots[key].card, e.filter)) sum += +e.amount || 0;
        }
      }
    }
    return sum;
  }
  function power(pi, key) {
    const s = P(pi).slots[key];
    return s ? s.card.power + s.pow + s.powB + cont(pi, key, "power") : 0;
  }
  function crit(pi, key) {
    const s = P(pi).slots[key];
    return s ? (s.card.crit || 1) + s.crit + s.critB + cont(pi, key, "crit") : 0;
  }

  // ---------- conditions & costs ----------
  function condOK(pi, c, ctx) {
    const p = P(pi), o = P(1 - pi), n = +c.n || 0;
    switch (c.type) {
      case "myTurn": return S.active === pi;
      case "oppTurn": return S.active !== pi;
      case "vcName": return p.slots.vc.card.name.toLowerCase().includes((c.text || "").toLowerCase());
      case "vcGrade": return p.slots.vc.card.grade >= n;
      case "oppVcGrade": return o.slots.vc.card.grade >= n;
      case "myDamage": return p.damage.length >= n;
      case "oppDamage": return o.damage.length >= n;
      case "rearCount": return RC.filter((k) => p.slots[k]).length >= n;
      case "soul": return p.soul.length >= n;
      case "drop": return p.drop.length >= n;
      case "hand": return p.hand.length >= n;
      case "persona": return p.personaThisTurn;
      case "playedOrder": return p.ordersThisTurn > 0;
      case "targetVC": return !!S.battle && S.battle.tgt === "vc";
      case "selfFront": return FRONT.includes(ctx.key);
      case "selfBack": return BACK.includes(ctx.key);
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
      case "discard": return p.hand.length >= n;
      case "restSelf": return selfThere(pi, ctx) && !P(pi).slots[ctx.key].rest;
      case "retireSelf": case "selfToSoul": return selfThere(pi, ctx) && ctx.key !== "vc";
      case "retireRC": return RC.filter((k) => p.slots[k] && k !== ctx.key).length >= n;
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
        const picked = await chooseCards(pi, `Discard ${n} card(s)`, p.hand, n, n);
        picked.forEach((x) => { p.hand.splice(p.hand.indexOf(x), 1); p.drop.push(x); });
        break;
      }
      case "restSelf": p.slots[ctx.key].rest = true; break;
      case "retireSelf": retire(pi, ctx.key); break;
      case "selfToSoul": p.soul.push(p.slots[ctx.key].card); p.slots[ctx.key] = null; break;
      case "retireRC": {
        const us = await chooseUnits(pi, `Retire ${n} of your rear-guards`, unitsAt(pi, RC).filter((u) => u.key !== ctx.key), n);
        us.forEach((u) => retire(u.pi, u.key));
        break;
      }
    }
  }

  // ---------- resolving abilities ----------
  const usedKey = (card, i) => `${card.uid}:${i}`;
  const gameKey = (pi, card, i) => `${pi}:${card.name}:${i}`;
  function ready(pi, card, ab, i, ctx) {
    if (ab.once === "turn" && S.used.has(usedKey(card, i))) return false;
    if (ab.once === "game" && S.usedGame.has(gameKey(pi, card, i))) return false;
    if (!(ab.conds || []).every((c) => condOK(pi, c, ctx))) return false;
    return (ab.costs || []).every((c) => canPay(pi, c, ctx));
  }
  async function resolve(pi, card, ab, i, ctx, ask) {
    if (!ready(pi, card, ab, i, ctx)) return false;
    if (ask && !(await yesNo(pi, `Use ability of ${card.name}?\n${describeAbility(ab)}`))) return false;
    if (!ready(pi, card, ab, i, ctx)) return false;
    if (ab.once === "turn") S.used.add(usedKey(card, i));
    if (ab.once === "game") S.usedGame.add(gameKey(pi, card, i));
    log(`✦ ${card.name}: ${describeAbility(ab)}`);
    for (const c of ab.costs || []) await pay(pi, c, ctx);
    for (const e of ab.effects || []) { if (over()) break; await effect(pi, e, { ...ctx, card }); }
    return true;
  }
  async function fire(pi, key, event, extra = {}) {
    const card = extra.card || (key && P(pi).slots[key] && P(pi).slots[key].card);
    if (!card || over()) return;
    const zone = extra.zone || zoneOf(key);
    const abs = card.abilities || [];
    for (let i = 0; i < abs.length; i++) {
      const ab = abs[i];
      if (ab.kind !== "AUTO" || ab.when !== event || !zoneOK(ab.zone, zone)) continue;
      await resolve(pi, card, ab, i, { key, zone, ...extra, card }, true);
    }
  }
  async function fireAll(pi, event, extra = {}) {
    for (const k of UNITS) if (P(pi).slots[k]) await fire(pi, k, event, extra);
  }

  // ---------- moving cards ----------
  function retire(pi, key) {
    const s = P(pi).slots[key];
    if (!s) return;
    P(pi).drop.push(s.card);
    P(pi).slots[key] = null;
  }
  function bindUnit(pi, key) {
    const s = P(pi).slots[key];
    if (!s) return;
    P(pi).bind.push(s.card);
    P(pi).slots[key] = null;
  }
  async function place(pi, card, key) {
    const p = P(pi);
    if (p.slots[key]) { log(`${p.slots[key].card.name} was replaced and retired`); retire(pi, key); }
    p.slots[key] = slot(card);
    log(`${p.name} calls ${card.name}`);
    await fire(pi, key, "placedRC");
    for (const k of UNITS) if (k !== key && p.slots[k]) await fire(pi, k, "allyPlacedRC", { placedKey: key });
  }
  async function callAnywhere(pi, card) {
    const opts = RC.map((k) => ({ id: k, label: `${SLOT_NAME[k]}${P(pi).slots[k] ? " (replace " + P(pi).slots[k].card.name + ")" : " (empty)"}` }));
    const [key] = await choose(pi, `Call ${card.name} to which circle?`, opts, 1, 1);
    await place(pi, card, key);
  }
  async function sendTo(pi, card, dest) {
    const p = P(pi);
    if (dest === "RC" && card.type !== "order") return callAnywhere(pi, card);
    if (dest === "soul") p.soul.push(card);
    else p.hand.push(card);
  }

  // ---------- effects ----------
  async function pickUnits(pi, e, ctx) {
    const n = +e.n || 1, f = e.filter, o = 1 - pi;
    const self = selfThere(pi, ctx) ? [{ pi, key: ctx.key }] : [];
    const label = `${SCHEMA.effects[e.type].label}${e.amount ? " " + e.amount : ""}: ${TARGETS[e.target] || ""}`;
    switch (e.target || "self") {
      case "self": return self;
      case "vc": return [{ pi, key: "vc" }];
      case "placed": return ctx.placedKey && P(pi).slots[ctx.placedKey] ? [{ pi, key: ctx.placedKey }] : [];
      case "attacker": return S.battle ? [{ pi: S.active, key: S.battle.att }] : [];
      case "allFront": return unitsAt(pi, FRONT, f);
      case "allFrontRC": return unitsAt(pi, ["fl", "fr"], f);
      case "allMyRC": return unitsAt(pi, RC, f);
      case "allMyUnits": return unitsAt(pi, UNITS, f);
      case "chooseMy": return chooseUnits(pi, label, unitsAt(pi, UNITS, f), n);
      case "chooseMyRC": return chooseUnits(pi, label, unitsAt(pi, RC, f), n);
      case "chooseMyFrontRC": return chooseUnits(pi, label, unitsAt(pi, ["fl", "fr"], f), n);
      case "chooseMyBackRC": return chooseUnits(pi, label, unitsAt(pi, BACK, f), n);
      case "chooseOppRC": return chooseUnits(pi, label, unitsAt(o, RC, f), n);
      case "chooseOppFrontRC": return chooseUnits(pi, label, unitsAt(o, ["fl", "fr"], f), n);
      case "chooseOppUnit": return chooseUnits(pi, label, unitsAt(o, UNITS, f), n);
      default: return [];
    }
  }
  async function effect(pi, e, ctx) {
    const p = P(pi), n = +e.n || 1, amt = +e.amount || 0;
    const battle = e.dur === "battle" && S.battle;
    switch (e.type) {
      case "power": case "crit": {
        for (const u of await pickUnits(pi, e, ctx)) {
          const s = P(u.pi).slots[u.key];
          if (!s) continue;
          if (e.type === "power") s[battle ? "powB" : "pow"] += amt;
          else s[battle ? "critB" : "crit"] += amt;
        }
        break;
      }
      case "stand": for (const u of await pickUnits(pi, e, ctx)) if (P(u.pi).slots[u.key]) P(u.pi).slots[u.key].rest = false; break;
      case "rest": for (const u of await pickUnits(pi, e, ctx)) if (P(u.pi).slots[u.key]) P(u.pi).slots[u.key].rest = true; break;
      case "retire": for (const u of await pickUnits(pi, e, ctx)) { if (u.key !== "vc") { log(`${P(u.pi).slots[u.key].card.name} is retired`); retire(u.pi, u.key); } } break;
      case "bind": for (const u of await pickUnits(pi, e, ctx)) { if (u.key !== "vc") { log(`${P(u.pi).slots[u.key].card.name} is bound`); bindUnit(u.pi, u.key); } } break;
      case "drive": p.driveBonus += amt; break;
      case "draw": draw(pi, n); break;
      case "CC": p.damage.filter((d) => d.down).slice(0, n).forEach((d) => (d.down = false)); break;
      case "SC": for (let i = 0; i < n && p.deck.length; i++) p.soul.push(p.deck.pop()); break;
      case "EC": p.energy = Math.min(10, p.energy + n); break;
      case "heal": for (let i = 0; i < n && p.damage.length; i++) p.drop.push(p.damage.pop()); break;
      case "shield": if (S.battle) S.battle.shieldBonus += amt; break;
      case "cantBeHit": if (S.battle) { S.battle.perfect = true; log("🛡 The attacked unit cannot be hit"); } break;
      case "search": {
        const zone = p[e.from || "deck"];
        const picked = await chooseCards(pi, `Search ${e.from || "deck"}: choose up to ${n}`, zone.filter((c) => match(c, e.filter)), 0, n);
        for (const c of picked) { zone.splice(zone.indexOf(c), 1); await sendTo(pi, c, e.dest); }
        if ((e.from || "deck") === "deck") shuffle(p.deck);
        break;
      }
      case "lookTop": {
        const top = p.deck.splice(Math.max(0, p.deck.length - n));
        const picked = await chooseCards(pi, `Top ${top.length} cards: choose up to ${+e.pick || 1}`, top.filter((c) => match(c, e.filter)), 0, +e.pick || 1);
        const rest = top.filter((c) => !picked.includes(c));
        if (e.rest === "bottom") p.deck.unshift(...rest); else { p.deck.push(...rest); shuffle(p.deck); }
        for (const c of picked) await sendTo(pi, c, e.dest);
        break;
      }
      case "callFromHand": {
        const picked = await chooseCards(pi, `Call up to ${n} from hand`, p.hand.filter((c) => c.type !== "order" && match(c, e.filter)), 0, n);
        for (const c of picked) { p.hand.splice(p.hand.indexOf(c), 1); await callAnywhere(pi, c); }
        break;
      }
    }
  }

  // ---------- triggers ----------
  async function trigger(pi, c) {
    const t = c.trigger;
    if (!t) return;
    const p = P(pi), o = P(1 - pi);
    const mine = unitsAt(pi, UNITS);
    log(`${TRIG[t].icon} ${TRIG[t].name} trigger!`);
    if (t === "front") { unitsAt(pi, FRONT).forEach((u) => (p.slots[u.key].pow += 10000)); return; }
    const amt = t === "over" ? 100000000 : 10000;
    const [pu] = await chooseUnits(pi, `${TRIG[t].name} trigger: power +${amt.toLocaleString()} to which unit?`, mine, 1);
    if (pu) p.slots[pu.key].pow += amt;
    if (t === "crit") {
      const [cu] = await chooseUnits(pi, "Critical trigger: critical +1 to which unit?", mine, 1);
      if (cu) p.slots[cu.key].crit += 1;
    }
    if (t === "draw" || t === "over") draw(pi, 1);
    if (t === "heal" && p.damage.length && p.damage.length >= o.damage.length) {
      p.drop.push(p.damage.pop());
      log(`♥ ${p.name} heals 1 damage`);
    }
  }

  // ---------- turn flow ----------
  async function startTurn(skipDraw) {
    const pi = S.active, p = P(pi);
    Object.values(p.slots).forEach((s) => s && (s.rest = false));
    S.used = new Set();
    Object.assign(p, { driveBonus: 0, ordersThisTurn: 0, personaThisTurn: false });
    S.rode = false;
    S.reveal = [];
    log(`— Turn ${S.turn}: ${p.name} —`);
    if (!skipDraw) draw(pi, 1);
    if (over()) return;
    S.phase = "ride";
    if (p.useEnergy) p.energy = Math.min(10, p.energy + 3);
    await fireAll(pi, "turnStart");
  }
  async function enterMain() {
    S.phase = "main";
    await fireAll(S.active, "mainStart");
  }
  const mulligan = (uids) => run(async () => {
    if (S.phase !== "mulligan") return err("Not in mulligan");
    const p = P(S.controller);
    const back = p.hand.filter((c) => uids.includes(c.uid));
    p.hand = p.hand.filter((c) => !uids.includes(c.uid));
    p.deck.push(...back);
    shuffle(p.deck);
    for (let i = 0; i < back.length; i++) p.hand.push(p.deck.pop());
    log(`${p.name} redraws ${back.length} card(s)`);
    if (S.controller === 0) { S.controller = 1; return; }
    S.controller = 0;
    await startTurn(true);
  });

  async function doRide(pi, card) {
    const p = P(pi), old = p.slots.vc.card;
    p.soul.push(old);
    p.slots.vc.card = card;
    S.rode = true;
    log(`${p.name} rides ${card.name} (G${card.grade})`);
    if (card.persona && card.grade >= 3 && old.name === card.name) {
      unitsAt(pi, FRONT).forEach((u) => (p.slots[u.key].pow += 10000));
      p.personaThisTurn = true;
      draw(pi, 1);
      log("✨ Persona Ride! Front row +10000, draw 1");
    }
    await fire(pi, null, "riddenUpon", { card: old, zone: "VC", riderKey: "vc" });
    await fire(pi, "vc", "placedVC");
    await enterMain();
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
    await doRide(pi, next);
  });
  const rideFromHand = (uid) => run(async () => {
    if (S.phase !== "ride") return err("You can only ride in the ride phase");
    const pi = S.active, p = P(pi);
    const card = p.hand.find((c) => c.uid === uid);
    if (!card || card.type === "order") return err("That card can't ride");
    const g = p.slots.vc.card.grade;
    if (card.grade !== g && card.grade !== g + 1) return err(`Ride grade ${g} or ${g + 1} only`);
    p.hand.splice(p.hand.indexOf(card), 1);
    await doRide(pi, card);
  });
  const skipRide = () => run(async () => {
    if (S.phase !== "ride") return err("Not in ride phase");
    log(`${P(S.active).name} does not ride`);
    await enterMain();
  });

  const call = (uid, key) => run(async () => {
    if (S.phase !== "main") return err("Call units in the main phase");
    if (!RC.includes(key)) return err("Rear-guard circles only");
    const pi = S.active, p = P(pi);
    const card = p.hand.find((c) => c.uid === uid);
    if (!card) return err("Card not in hand");
    if (card.type === "order") return err("Orders are played with the Play button");
    if (card.grade > p.slots.vc.card.grade) return err("Grade must be ≤ your vanguard");
    p.hand.splice(p.hand.indexOf(card), 1);
    await place(pi, card, key);
  });
  const move = (a, b) => run(async () => {
    if (S.phase !== "main") return err("Move units in the main phase");
    if (PARTNER[a] !== b) return err("Units move front/back in the same column only");
    const p = P(S.active);
    [p.slots[a], p.slots[b]] = [p.slots[b], p.slots[a]];
  });

  // ACT abilities of units on the field
  function actList(pi, key) {
    const s = P(pi).slots[key];
    if (!s) return [];
    return (s.card.abilities || []).map((ab, i) => ({ ab, i })).filter(({ ab }) => ab.kind === "ACT" && zoneOK(ab.zone, zoneOf(key)))
      .map(({ ab, i }) => ({ i, text: describeAbility(ab), ready: ready(pi, s.card, ab, i, { key, card: s.card }) }));
  }
  const activate = (key, i) => run(async () => {
    if (S.phase !== "main" || S.battle) return err("Use ACT abilities in your main phase");
    const pi = S.active, s = P(pi).slots[key];
    if (!s) return err("No unit there");
    const ab = (s.card.abilities || [])[i];
    if (!ab || ab.kind !== "ACT") return err("No such ability");
    if (!(await resolve(pi, s.card, ab, i, { key, zone: zoneOf(key), card: s.card }, false))) return err("Conditions or costs not met");
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
    if (!guarding && p.ordersThisTurn >= 1) return err("Only 1 normal order per turn");
    const found = orderAbility(card, kind);
    if (!found) return err(guarding ? "This is not a blitz order" : "This is not a normal order");
    const ctx = { key: null, zone: "hand", card };
    p.hand.splice(p.hand.indexOf(card), 1);
    if (!ready(pi, card, found.ab, found.i, ctx)) { p.hand.push(card); return err("Conditions or costs not met"); }
    p.ordersThisTurn++;
    log(`${p.name} plays ${card.name}`);
    await resolve(pi, card, found.ab, found.i, ctx, false);
    p.drop.push(card);
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
    return S.phase === "battle" && !S.battle && FRONT.includes(key) && !!s && !s.rest;
  }
  function boosterFor(pi, key) {
    const bk = BACK_OF[key], b = bk && P(pi).slots[bk];
    return b && !b.rest && b.card.grade <= 1 && b.card.type !== "order" ? bk : null;
  }
  const attack = (att, useBoost, tgt) => run(async () => {
    if (!canAttack(att)) return err("That unit can't attack");
    const ai = S.active, di = 1 - ai, p = P(ai);
    if (!FRONT.includes(tgt) || !P(di).slots[tgt]) return err("Attack an opponent's front row unit");
    p.slots[att].rest = true;
    const bk = useBoost ? boosterFor(ai, att) : null;
    if (bk) p.slots[bk].rest = true;
    S.battle = { att, tgt, boostKey: bk, guards: [], perfect: false, shieldBonus: 0 };
    S.reveal = [];
    log(`${p.slots[att].card.name}${bk ? " (boosted)" : ""} attacks ${P(di).slots[tgt].card.name}`);
    await fire(ai, att, "attack");
    if (bk) await fire(ai, bk, "boost");
    await fire(di, tgt, "attacked");
    if (!S.battle) return;
    if (!P(ai).slots[att] || !P(di).slots[tgt]) { log("A unit left the field; the battle ends"); await endBattle(); return; }
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
    d.hand.splice(d.hand.indexOf(card), 1);
    b.guards.push(card);
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
    if (s.card.grade !== 2) return err("Only grade 2 units can intercept");
    if (key === b.tgt) return err("The attacked unit can't intercept");
    b.guards.push(s.card);
    d.slots[key] = null;
    log(`${s.card.name} intercepts`);
  });
  const confirmGuard = () => run(async () => {
    const b = S.battle;
    if (!b) return err("No attack");
    const ai = S.active, di = 1 - ai, p = P(ai), d = P(di);
    S.controller = ai;
    if (b.att === "vc") {
      const n = (p.slots.vc.card.grade >= 3 ? 2 : 1) + p.driveBonus;
      for (let i = 0; i < n && !over(); i++) {
        if (!p.deck.length) return lose(ai, "deck is empty");
        const c = p.deck.pop();
        S.reveal.push({ type: "Drive", card: c });
        log(`Drive check: ${c.name}`);
        await trigger(ai, c);
        (c.trigger === "over" ? p.bind : p.hand).push(c);
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
          if (!d.deck.length) { lose(di, "deck is empty"); break; }
          const c = d.deck.pop();
          S.reveal.push({ type: "Damage", card: c });
          log(`Damage check: ${c.name}`);
          if (c.trigger === "over") d.bind.push(c); else d.damage.push(c);
          await trigger(di, c);
          if (d.damage.length >= 6) lose(di, "6 damage");
        }
      } else {
        log(`${d.slots[b.tgt].card.name} is retired`);
        retire(di, b.tgt);
      }
      if (!over()) await fire(ai, b.att, "attackHit");
    }
    await endBattle();
  });
  async function endBattle() {
    const b = S.battle;
    if (!b) return;
    const ai = S.active;
    P(1 - ai).drop.push(...b.guards);
    b.guards = [];
    if (!over()) await fire(ai, b.att, "battleEnd");
    S.players.forEach((pl) => Object.values(pl.slots).forEach((s) => s && (s.powB = 0, s.critB = 0)));
    S.battle = null;
    S.controller = ai;
  }

  const endTurn = () => run(async () => {
    if (S.battle) return err("Finish the battle first");
    if (S.phase === "mulligan") return err("Still in mulligan");
    await fireAll(S.active, "endTurn");
    S.players.forEach((pl) => Object.values(pl.slots).forEach((s) => s && Object.assign(s, { pow: 0, crit: 0, powB: 0, critB: 0 })));
    S.active = 1 - S.active;
    S.controller = S.active;
    S.turn++;
    await startTurn(false);
  });

  return {
    FRONT, RC, UNITS, BACK_OF,
    newGame, state: () => S, setOnChange: (f) => (onChange = f),
    power, crit, faceUp, nextRide, boosterFor, canAttack, actList, attackPower, defensePower,
    answer, mulligan, rideFromDeck, rideFromHand, skipRide, call, move, activate, playOrder,
    toBattle, attack, guard, intercept, confirmGuard, endTurn,
  };
})();
