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

  // ---------- decisions (Task 1: simple placeholders; the normal / easy rules replace them) ----------
  function decide(view, seat, level) {
    const me = view.players[seat];
    if (view.pending && view.pending.player === seat) return answerMoves(view, seat, level);
    switch (view.phase) {
      case "mulligan": return [{ fn: "mulligan", args: [[]] }];
      case "ride": return rideMoves(view, seat, level);
      case "stride": return [{ fn: "skipStride", args: [] }];
      case "main": return [{ fn: "toBattle", args: [] }];
      case "battle":
        if (view.battle && view.active !== seat) return [{ fn: "confirmGuard", args: [] }];
        if (view.active === seat && !view.battle) {
          const out = [];
          if (Game.canAttack("vc")) out.push({ fn: "attack", args: ["vc", true, "vc"] });
          out.push({ fn: "endTurn", args: [] });
          return out;
        }
        return [];
      default: return [];
    }
  }
  function answerMoves(view, seat) {
    const P = view.pending, ids = P.options.map((o) => o.id);
    if (ids.includes("skip") && view.judge) return [{ fn: "answer", args: [["skip"]] }]; // a card step the bot can't do by hand
    if (ids.length === 2 && ids.includes("yes") && ids.includes("no")) return [{ fn: "answer", args: [["no"]] }];
    return [{ fn: "answer", args: [ids.slice(0, Math.max(P.min, Math.min(1, P.max)))] }];
  }
  function rideMoves(view, seat) {
    const me = view.players[seat], out = [];
    const vcG = me.slots.vc ? +me.slots.vc.card.grade : 0;
    if (me.hasRideDeck && (me.ride || []).some((c) => +c.grade === vcG + 1) && me.hand.length) out.push({ fn: "rideFromDeck", args: [me.hand[me.hand.length - 1].uid] });
    for (const c of [...me.hand].filter((x) => x.type !== "order" && (+x.grade === vcG || +x.grade === vcG + 1)).sort((a, b) => b.grade - a.grade)) out.push({ fn: "rideFromHand", args: [c.uid] });
    out.push({ fn: "skipRide", args: [] });
    return out;
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
    for (let i = 0; i < 200 && !done; i++) {
      await tick();
      const S = Game.state();
      if (!done && S.pending) return { ok: true, waiting: true }; // the action goes on after the choice
    }
    if (!done) { await p; }
    return done || { ok: true };
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
      if (r && r.ok !== false) return { ok: true, fn: m.fn };
      refused++;
    }
    const fb = fallback(Game.snapshot(seat), seat);
    note(`🤖 fallback: ${fb.fn}`);
    const r = await run(fb);
    return { ok: !!(r && r.ok !== false), fn: fb.fn };
  }

  return { LEVELS, THINK_MS, wants, decide, step, fallback, random: Math.random };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Bot;
