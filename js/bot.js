// The bot opponent. One move at a time, through the same Game.* calls the screen uses.
// Fair by construction: hands, deck order and face-down cards come only from Game.snapshot(seat);
// public helpers (power, canAttack, boosterFor, attack / defense power, actList) read the open table.
// Never stuck: after 3 refused moves in one decision it takes a safe fallback and logs it.
const Bot = (() => {
  const LEVELS = ["easy", "normal"];
  const THINK_MS = 600;
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // is it this seat's turn to act (a choice to answer, or the turn / guard step to play)?
  function wants(seat) {
    const S = Game.state();
    if (!S || S.winner !== null) return false;
    if (S.pending) return S.pending.player === seat;
    return !S.busy && S.controller === seat;
  }

  // ---------- decisions ----------
  const FRONT_RC = ["fl", "fr"], BEHIND = { fl: "bl", vc: "bc", fr: "br" };
  const shieldOf = (c) => (c && c.type !== "order" && !c.protect ? +c.shield || 0 : 0);
  const isUnit = (c) => c && c.type !== "order" && c.type !== "g" && !c.protect && !c.token && !c.ticket;
  const acts = { turn: -1, n: 0 }; // ACT uses this turn (a ready ability without a limit must not loop)
  let strideTried = -1; // one stride attempt per turn (a refused stride must not loop)

  // easy level: 25% of decisions take a random move from the list instead of the best
  function decide(view, seat, level) {
    const moves = decideBest(view, seat, level);
    if (level === "easy" && moves.length > 1 && Bot.random() < 0.25) {
      const i = 1 + Math.floor(Bot.random() * (moves.length - 1));
      return [moves[i], ...moves.filter((_, j) => j !== i)];
    }
    return moves;
  }
  function decideBest(view, seat, level) {
    if (view.pending && view.pending.player === seat) return answerMoves(view, seat, level);
    switch (view.phase) {
      case "mulligan": return [{ fn: "mulligan", args: [mulliganPick(view, seat, level)] }];
      case "ride": return rideMoves(view, seat, level);
      case "stride":
        if (strideTried === view.turn) return [{ fn: "skipStride", args: [] }];
        strideTried = view.turn;
        return [{ fn: "stride", args: [] }, { fn: "skipStride", args: [] }];
      case "main": return [...callPlan(view, seat, level), ...actPlan(view, seat, level), ...orderPlan(view, seat, level), { fn: "toBattle", args: [] }];
      case "battle":
        if (view.battle && view.active !== seat) return guardPlan(view, seat, level);
        if (view.active === seat && !view.battle) return [...attackPlan(view, seat, level), { fn: "endTurn", args: [] }];
        return [];
      default: return [];
    }
  }

  // ---------- choices ----------
  function answerMoves(view, seat, level) {
    const P = view.pending, ids = P.options.map((o) => o.id), me = view.players[seat];
    if (ids.includes("skip") && view.judge) return [{ fn: "answer", args: [["skip"]] }]; // a card step the bot can't do by hand
    if (ids.length === 2 && ids.includes("yes") && ids.includes("no")) return [{ fn: "answer", args: [[me.hand.length <= 1 ? "no" : "yes"]] }];
    const n = Math.max(P.min, Math.min(1, P.max));
    // trigger power / critical: to the attacker still to come, else the vanguard
    if (/trigger: (power|critical)/i.test(P.prompt) && ids.every((id) => /^\d+:/.test(id))) {
      const mine = ids.filter((id) => +id.split(":")[0] === seat);
      const vc = `${seat}:vc`;
      let pick = vc;
      if (!/critical/i.test(P.prompt) && view.active === seat) {
        const att = view.battle && view.battle.att;
        const next = FRONT_RC.filter((k) => k !== att && me.slots[k] && !me.slots[k].rest).map((k) => `${seat}:${k}`).find((id) => mine.includes(id));
        if (next && att === "vc") pick = next; // the vanguard is attacking now: help the next attacker
        else if (att && att !== "vc" && mine.includes(`${seat}:${att}`)) pick = `${seat}:${att}`; // a rear-guard's own drive... (rare) keep it on the attacker
      }
      if (!mine.includes(pick)) pick = mine[0] || ids[0];
      return [{ fn: "answer", args: [[pick]] }];
    }
    // "discard cards whose grades total N" (stride cost): highest grades first until the total is reached
    const tot = P.prompt.match(/grades? total(?:s)? (\d+)/i);
    if (tot && P.options.every((o) => o.card)) {
      const want = +tot[1], picked = [];
      let sum = 0;
      for (const o of [...P.options].sort((a, b) => (+b.card.grade || 0) - (+a.card.grade || 0))) { if (sum >= want || picked.length >= P.max) break; picked.push(o.id); sum += +o.card.grade || 0; }
      if (picked.length >= P.min) return [{ fn: "answer", args: [picked] }];
    }
    return [{ fn: "answer", args: [ids.slice(0, n)] }];
  }

  // ---------- mulligan and ride ----------
  function mulliganPick(view, seat, level) {
    if (level === "easy") return [];
    const me = view.players[seat], out = [];
    let g3 = 0, g2 = 0;
    for (const c of me.hand) {
      const g = +c.grade;
      if (g >= 3) { if (++g3 > 1) out.push(c.uid); }
      else if (g === 2 && me.hasRideDeck) { if (++g2 > 2) out.push(c.uid); }
    }
    return out;
  }
  // the least useful hand card (to discard for a cost)
  function discardPick(cards, vcGrade = 0) {
    const score = (c) => (c.sentinel ? 100 : 0) + (c.trigger ? 40 : 0) + (+c.grade >= 3 && cards.filter((x) => +x.grade >= 3).length > 1 ? -30 : 0) + (+c.grade === 0 && !c.trigger ? -20 : 0) + (+c.power || 0) / 1000;
    return [...cards].sort((a, b) => score(a) - score(b))[0];
  }
  function rideMoves(view, seat) {
    const me = view.players[seat], out = [];
    const vcG = me.slots.vc ? +me.slots.vc.card.grade : 0;
    if (me.hasRideDeck && (me.ride || []).some((c) => +c.grade === vcG + 1) && Game.rideFree(seat)) out.push({ fn: "rideFromDeck", args: [null] }); // free ride (no discard)
    else if (me.hasRideDeck && (me.ride || []).some((c) => +c.grade === vcG + 1) && me.hand.length) out.push({ fn: "rideFromDeck", args: [discardPick(me.hand, vcG).uid] });
    for (const c of [...me.hand].filter((x) => isUnit(x) && (+x.grade === vcG + 1 || +x.grade === vcG)).sort((a, b) => b.grade - a.grade || b.power - a.power)) out.push({ fn: "rideFromHand", args: [c.uid] });
    out.push({ fn: "skipRide", args: [] });
    return out;
  }

  // ---------- main phase ----------
  function callPlan(view, seat, level) {
    const me = view.players[seat], vcG = me.slots.vc ? +me.slots.vc.card.grade : 0;
    let hand = me.hand.filter((c) => isUnit(c) && +c.grade <= vcG);
    if (level === "easy") {
      const open = ["fl", "fr", "bl", "bc", "br"].filter((k) => !me.slots[k]);
      return hand.length && open.length ? [{ fn: "call", args: [hand[0].uid, open[0]] }] : [];
    }
    // from 3 damage keep 2 shield cards (or a sentinel) in hand
    const keep = (c) => {
      if (me.damage.length < 3) return true;
      const rest = me.hand.filter((x) => x !== c);
      return rest.some((x) => x.sentinel) || rest.filter((x) => shieldOf(x) > 0).length >= 2;
    };
    hand = hand.filter(keep);
    const out = [];
    const byPower = [...hand].sort((a, b) => (+b.power || 0) - (+a.power || 0));
    for (const k of FRONT_RC) {
      const sl = me.slots[k], best = byPower.find((c) => !c.trigger) || byPower[0];
      if (!best) break;
      if (!sl) out.push({ fn: "call", args: [best.uid, k], why: "front" });
      else if (!sl.locked && (+best.power || 0) >= Game.power(seat, k) + 5000) out.push({ fn: "call", args: [best.uid, k], why: "replace" });
    }
    const boosters = hand.filter((c) => +c.grade <= 1 && !c.trigger).sort((a, b) => (+b.power || 0) - (+a.power || 0));
    for (const [f, b] of Object.entries(BEHIND)) if (me.slots[f] && !me.slots[b] && boosters[0]) out.push({ fn: "call", args: [boosters[0].uid, b], why: "booster" });
    return out;
  }
  function actPlan(view, seat, level) {
    if (level === "easy") return [];
    if (acts.turn !== view.turn) { acts.turn = view.turn; acts.n = 0; }
    if (acts.n >= 3) return [];
    const out = [];
    for (const k of ["vc", "fl", "fr", "bl", "bc", "br"]) {
      const sl = view.players[seat].slots[k];
      if (!sl) continue;
      for (const a of Game.actList(seat, k) || []) {
        if (!a.ready) continue;
        // an ability whose steps are all done by hand would be skipped: don't pay its cost
        const ab = !a.src && typeof a.i === "number" ? (sl.card.abilities || [])[a.i] : null;
        if (ab && (ab.effects || []).length && ab.effects.every((e) => e.type === "manual")) continue;
        out.push({ fn: "activate", args: [k, a.i, a.src || 0], why: "act" });
      }
    }
    return out.slice(0, 2);
  }
  // orders from hand (the engine allows one a turn plus extras), then the Energy Generator draw
  function orderPlan(view, seat, level) {
    if (level === "easy") return [];
    const me = view.players[seat], out = [];
    for (const c of me.hand) {
      if (c.type !== "order" || c.protect || c.ticket) continue;
      const ab = (c.abilities || []).find((a) => a.kind === "ORDER");
      if (ab && (ab.effects || []).length && ab.effects.every((e) => e.type === "manual")) continue;
      out.push({ fn: "playOrder", args: [c.uid], why: "order" });
    }
    if (me.useEnergy && me.energy >= 7 && me.egTurn !== view.turn) out.push({ fn: "energyDraw", args: [], why: "energy" });
    return out.slice(0, 2);
  }

  // ---------- battle ----------
  function attackPlan(view, seat, level) {
    const opp = 1 - seat, me = view.players[seat];
    const keys = ["fl", "fr", "vc"].filter((k) => Game.canAttack(k));
    if (!keys.length) return [];
    const power = (k) => Game.power(seat, k) + (Game.boosterFor(seat, k) ? Game.power(seat, Game.boosterFor(seat, k)) : 0);
    const oppVc = Game.power(opp, "vc");
    let order;
    if (level === "easy") order = keys;
    else {
      const rg = keys.filter((k) => k !== "vc").sort((a, b) => power(b) - power(a));
      order = view.players[opp].damage.length >= 5 && keys.includes("vc") ? ["vc", ...rg] : [...rg.filter((k) => power(k) >= oppVc), ...rg.filter((k) => power(k) < oppVc), ...(keys.includes("vc") ? ["vc"] : [])];
    }
    return order.map((k) => {
      let tgt = "vc";
      if (level !== "easy" && k !== "vc" && power(k) < oppVc) {
        const t = ["fl", "fr"].filter((x) => view.players[opp].slots[x] && Game.power(opp, x) >= 10000 && power(k) >= Game.power(opp, x)).sort((a, b) => Game.power(opp, b) - Game.power(opp, a))[0];
        if (t) tgt = t;
      }
      return { fn: "attack", args: [k, true, tgt] };
    });
  }
  function guardPlan(view, seat, level) {
    const me = view.players[seat], B = view.battle, done = [{ fn: "confirmGuard", args: [] }];
    if (B.perfect) return done;
    const atk = Game.attackPower(), def = Game.defensePower();
    if (atk < def) return done;
    const dmg = me.damage.length, onVc = B.tgt === "vc";
    const need = atk - def + 1 + (B.att === "vc" && level !== "easy" ? 5000 : 0);
    const cards = me.hand.filter((c) => shieldOf(c) > 0 && !c.sentinel).sort((a, b) => shieldOf(a) - shieldOf(b));
    const total = cards.reduce((n, c) => n + shieldOf(c), 0);
    const one = cards.find((c) => shieldOf(c) >= need);
    // "rear-guard attacks" = attacks made by rear-guards; an attack on a rear-guard only retires it
    const byVc = B.att === "vc";
    let guard;
    if (level === "easy") guard = dmg >= 4 && onVc;
    else if (!onVc) guard = dmg >= 3 && !!one;
    else if (dmg >= 4) guard = true;
    else if (dmg === 3) guard = byVc || !!one;
    else guard = byVc && !!one;
    if (!guard) return done;
    const out = [];
    // intercept first (normal, 3+ damage): a grade 2 front rear-guard that isn't the attacked unit
    if (level !== "easy" && dmg >= 3) for (const k of FRONT_RC) {
      const sl = me.slots[k];
      if (sl && k !== B.tgt && !sl.locked && Game.canInterceptIcon(sl.card)) out.push({ fn: "intercept", args: [k], why: "intercept" });
    }
    if (one) out.push({ fn: "guard", args: [one.uid] });
    else if (total >= need) out.push({ fn: "guard", args: [cards[cards.length - 1].uid] }); // the biggest first; the next decision adds more
    else if (dmg >= 5 && onVc && level !== "easy") {
      const sent = me.hand.find((c) => c.sentinel);
      if (sent) out.push({ fn: "guard", args: [sent.uid] });
    }
    if (!out.length) return done;
    // an intercept that alone can't help when no hand card follows is still fine: it adds shield
    return [...out, ...done];
  }

  // the move that always works when nothing else did
  function fallback(view, seat) {
    if (view.pending && view.pending.player === seat) {
      const ids = view.pending.options.map((o) => o.id);
      if (ids.includes("skip")) return { fn: "answer", args: [["skip"]] };
      if (ids.includes("no") && ids.includes("yes")) return { fn: "answer", args: [["no"]] };
      return { fn: "answer", args: [ids.slice(0, Math.max(view.pending.min, 0) || (view.pending.min === 0 ? 0 : 1))] };
    }
    if (view.phase === "mulligan") return { fn: "mulligan", args: [[]] };
    if (view.phase === "ride") return { fn: "skipRide", args: [] };
    if (view.phase === "stride") return { fn: "skipStride", args: [] };
    if (view.phase === "main") return { fn: "toBattle", args: [] };
    if (view.battle && view.active !== seat) return { fn: "confirmGuard", args: [] };
    return { fn: "endTurn", args: [] };
  }
  function note(text) { const S = Game.state(); if (!S) return; S.log.unshift(text); S.logN = (S.logN || 0) + 1; }

  // run one Game action; return when it's done, or when it stops to wait for a choice (anyone's)
  async function run(m) {
    if (m.fn === "answer") return Game.answer(...m.args);
    if (typeof Game[m.fn] !== "function") return { ok: false, msg: "no such action" };
    let done = null;
    const p = Promise.resolve(Game[m.fn](...m.args)).then((r) => (done = r || { ok: true }));
    // keep watching while the action runs (on-screen pauses can take seconds): a choice for anyone means the move is made
    const t0 = Date.now();
    while (!done) {
      await new Promise((r) => setTimeout(r, 20));
      const S = Game.state();
      if (!done && S && S.pending) return { ok: true, waiting: true }; // the action goes on after the choice
      if (!done && Date.now() - t0 > 120000) return { ok: true, waiting: true }; // never hang the bot loop
    }
    return done;
  }

  // make one move for this seat
  async function step(seat, level = "normal") {
    if (!wants(seat)) return { ok: false, fn: "none" };
    const view = Game.snapshot(seat);
    let moves = [];
    try { moves = Bot.decide(view, seat, level) || []; } catch (e) { moves = []; }
    let refused = 0;
    for (const m of moves) {
      if (refused >= 3) break;
      const r = await run(m);
      if (r && r.ok !== false) {
        if (m.fn === "activate") acts.n++; // at most 3 ability uses a turn
        if (m.fn === "answer" && view.judge && m.args[0][0] === "skip") note(`Bot skips: ${view.judge.text}`); // a card step it can't do by hand
        return { ok: true, fn: m.fn };
      }
      refused++;
    }
    const fb = fallback(Game.snapshot(seat), seat);
    note(`🤖 fallback: ${fb.fn}`);
    const r = await run(fb);
    return { ok: !!(r && r.ok !== false), fn: fb.fn };
  }

  return { LEVELS, THINK_MS, wants, decide, step, fallback, random: Math.random, _: { guardPlan, attackPlan, callPlan, mulliganPick, discardPick } };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Bot;
