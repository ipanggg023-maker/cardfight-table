// Screen + clicks. Reads Game.state() and redraws everything on each change.

const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("en-US");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const hue = (s) => [...String(s || "x")].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

const ui = { sel: null, mode: null, attacker: null, boost: true, unitSel: null, mull: new Set(), pick: new Set(), hotseat: true, shown: 0 };
const seen = new Map(); // uid -> card, for the info panel

// ---------- setup ----------
async function loadSetup() {
  await DB.seedIfEmpty();
  const decks = await DB.all("decks");
  const byId = Object.fromEntries((await DB.all("cards")).map((c) => [c.id, c]));
  const opts = decks.map((d) => {
    const bad = validateDeck(d, byId);
    return `<option value="${esc(d.id)}">${esc(d.name)}${bad.length ? " ⚠ " + esc(bad[0]) : ""}</option>`;
  }).join("");
  $("#d1").innerHTML = opts;
  const me = typeof Auth !== "undefined" && Auth.get();
  if (me) { $("#n1").value = me.name; if (me.lastP2) $("#n2").value = me.lastP2; }
  $("#d2").innerHTML = opts;
  if (decks[1]) $("#d2").value = decks[1].id;
  [1, 2].forEach(renderMatPick);
}
function renderMatPick(seat) {
  const box = document.querySelector(`.matpick[data-seat="${seat}"]`);
  const cur = Mats.choice(seat), custom = Mats.customImg(seat);
  box.innerHTML = `<span class="mp-label">Playmat</span><div class="mp-row">${Object.entries(MATS).map(([k, m]) => {
    const th = k === "custom" ? custom : m.thumb;
    return `<button type="button" class="mp${cur === k ? " on" : ""}" data-mat="${k}" title="${esc(m.name)}">
      ${th ? `<img src="${esc(th)}" alt="">` : `<span class="mp-ph">${k === "custom" ? "＋" : "Classic"}</span>`}<small>${esc(k === "custom" && custom ? "My image" : m.name)}</small></button>`;
  }).join("")}</div><input type="file" accept="image/*" hidden>`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest(".mp");
  if (!b) return;
  const box = b.closest(".matpick"), seat = +box.dataset.seat;
  if (b.dataset.mat === "custom" && (!Mats.customImg(seat) || b.classList.contains("on"))) return box.querySelector("input").click();
  Mats.remember(seat, b.dataset.mat);
  renderMatPick(seat);
});
document.addEventListener("change", async (e) => {
  const inp = e.target.closest(".matpick input[type=file]");
  if (!inp || !inp.files[0]) return;
  const seat = +inp.closest(".matpick").dataset.seat;
  try { await Mats.saveCustom(seat, inp.files[0]); Mats.remember(seat, "custom"); renderMatPick(seat); }
  catch (err) { toast(err.message); }
});
async function startGame() {
  if (typeof Auth !== "undefined" && Auth.get()) Auth.set({ ...Auth.get(), lastP2: $("#n2").value.trim() });
  try {
    const decks = [await DB.loadDeck($("#d1").value), await DB.loadDeck($("#d2").value)];
    ui.hotseat = $("#hotseat").checked;
    ui.mats = [Mats.resolve(1, Mats.choice(1)), Mats.resolve(2, Mats.choice(2))];
    Game.newGame([$("#n1").value.trim() || "Player 1", $("#n2").value.trim() || "Player 2"], decks);
    Object.assign(ui, { sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set(), shown: -1 });
    $("#setup").hidden = true;
    render();
  } catch (e) { toast(e.message); }
}
const view = () => (ui.hotseat ? ui.shown : Game.state().controller);

// ---------- card drawing ----------
function cardHTML(c, s = {}, pi = null, key = null, extra = "") {
  seen.set(c.uid, c);
  const S = Game.state();
  const pw = pi !== null && key ? Game.power(pi, key) : c.power;
  const cr = pi !== null && key ? Game.crit(pi, key) : c.crit || 1;
  const img = c.image ? ` style="--h:${hue(c.nation)};background-image:linear-gradient(#0000 45%,#000c),url('${esc(c.image)}')"` : ` style="--h:${hue(c.nation)}"`;
  return `<div class="card${c.image ? " img" : ""}${s.rest ? " rest" : ""}${extra}" data-uid="${c.uid}"${img}>
    <div class="ctop"><span class="cg">${c.type === "order" ? "ORD" : "G" + c.grade}</span>
      ${c.trigger ? `<span class="ct t-${c.trigger}">${TRIG[c.trigger].icon}</span>` : ""}${c.sentinel ? `<span class="ct t-sent">◆</span>` : ""}${(c.abilities || []).length ? `<span class="ab">✦</span>` : ""}</div>
    <div class="cn">${esc(c.name)}</div>
    <div class="cs">${c.type === "order" ? "" : `<span class="cp${pw !== c.power ? " buffed" : ""}">${fmt(pw)}</span>`}${cr > 1 ? `<span class="cc">★${cr}</span>` : ""}${c.shield ? `<span class="csh">🛡${c.shield / 1000}k</span>` : ""}</div>
  </div>`;
}
function infoPanel(c) {
  if (!c) return `<p class="muted">Hover a card to see its details.</p>`;
  return `${c.image ? `<img src="${esc(c.image)}" alt="">` : ""}
    <h3>${esc(c.name)}</h3>
    <p class="muted">${c.type === "order" ? "Order" : "Grade " + c.grade} · ${esc(c.nation || "")}${c.race ? " · " + esc(c.race) : ""}</p>
    ${c.type !== "order" ? `<p>Power ${fmt(c.power)} · Shield ${fmt(c.shield || 0)} · Crit ${c.crit || 1}</p>` : ""}
    ${c.trigger ? `<p>${TRIG[c.trigger].icon} ${TRIG[c.trigger].name}: ${TRIG[c.trigger].desc}</p>` : ""}
    ${c.sentinel ? "<p>◆ Sentinel: discard 1 to make the attacked unit unhittable</p>" : ""}
    ${c.persona ? "<p>Persona Ride</p>" : ""}
    ${(c.abilities || []).map((a) => `<p class="abl">${esc(describeAbility(a))}</p>`).join("")}
    ${c.text ? `<p class="muted pre">${esc(c.text)}</p>` : ""}`;
}

const SLOT_LABEL = { vc: "VC", fl: "RC", fr: "RC", bl: "RC", bc: "RC", br: "RC" };
// Box [left, top, right, bottom] in % → CSS. The opponent's mat is turned 180°, so mirror it.
const boxCSS = (r, opp) => {
  const [l, t, rr, b] = opp ? [100 - r[2], 100 - r[3], 100 - r[0], 100 - r[1]] : r;
  return `left:${l}%;top:${t}%;width:${rr - l}%;height:${b - t}%`;
};
function sideHTML(pi, side) {
  const S = Game.state(), p = S.players[pi], v = view(), opp = side === "opp";
  const mat = (ui.mats && ui.mats[pi]) || { key: "classic", img: "" };
  const hl = (key) => {
    const c = [];
    if (S.battle) {
      if (pi === S.active && key === S.battle.att) c.push("attacking");
      if (pi !== S.active && key === S.battle.tgt) c.push("targeted");
    }
    if (side === "me" && (ui.attacker === key || ui.unitSel === key)) c.push("picked");
    if (opp && ui.attacker && Game.FRONT.includes(key) && p.slots[key]) c.push("can-target");
    if (side === "me" && ui.sel && S.phase === "main" && v === S.active && key !== "vc") c.push("can-drop");
    if (side === "me" && ui.sel && S.phase === "ride" && key === "vc") c.push("can-drop");
    return c.join(" ");
  };
  const slotH = (key) => {
    const [x, y] = MAT_LAYOUT.slots[key];
    const pos = opp ? `left:${100 - x}%;top:${100 - y}%` : `left:${x}%;top:${y}%`;
    return `<div class="slot ${key === "vc" ? "vcs" : ""} ${hl(key)}" style="${pos}" data-side="${side}" data-key="${key}"><span class="sl">${SLOT_LABEL[key]}</span>${p.slots[key] ? cardHTML(p.slots[key].card, p.slots[key], pi, key) : ""}</div>`;
  };
  p.damage.forEach((c) => seen.set(c.uid, c));
  const dmg = Array.from({ length: 6 }, (_, i) => {
    const c = p.damage[i];
    return c ? `<div class="dmgc${c.down ? " down" : ""}" data-uid="${c.uid}"><b>${i + 1}</b><span>${c.down ? "Face down" : esc(c.name)}</span></div>`
      : `<div class="dmgc empty"><b>${i + 1}</b></div>`;
  }).join("");
  const chip = (label, val, cls = "", zone = "") => zone
    ? `<button class="chip ${cls}" data-zone="${pi}:${zone}"><small>${label}</small><b>${val}</b></button>`
    : `<span class="chip ${cls}"><small>${label}</small><b>${val}</b></span>`;
  const L = MAT_LAYOUT, topDrop = p.drop[p.drop.length - 1];
  if (topDrop) seen.set(topDrop.uid, topDrop);
  return `<div class="mat ${mat.img ? "img" : "classic"} ${side}" style="${mat.img ? `--matimg:url('${esc(mat.img)}')` : ""}">
    <div class="mz info" style="${boxCSS(L.order, opp)}">
      <div class="pname">${esc(p.name)}${pi === S.active ? '<span class="turnmark">TURN</span>' : ""}</div>
      <div class="chips">${chip("Soul", p.soul.length, "", "soul")}${chip("CB", Game.faceUp(p), "cb")}
        ${p.useEnergy ? chip("Energy", p.energy, "en") : ""}${p.bind.length ? chip("Bind", p.bind.length, "", "bind") : ""}${opp ? chip("Hand", p.hand.length) : ""}</div>
    </div>
    <div class="mz damage" style="${boxCSS(L.damage, opp)}" title="Damage ${p.damage.length}/6">${dmg}</div>
    <div class="mz deck" style="${boxCSS(L.deck, opp)}"><small>Deck</small><b>${p.deck.length}</b></div>
    <button class="mz drop" style="${boxCSS(L.drop, opp)}" data-zone="${pi}:drop">${topDrop ? `<span class="top" data-uid="${topDrop.uid}">${esc(topDrop.name)}</span>` : ""}<small>Drop</small><b>${p.drop.length}</b></button>
    ${p.ride.length ? `<div class="mz ride" style="${boxCSS(L.ride, opp)}"><b>${p.ride.length}</b></div>` : ""}
    ${Object.keys(L.slots).map(slotH).join("")}
  </div>`;
}

// ---------- phase rail + cut-in banner ----------
const PHASES = [["ride", "Ride"], ["main", "Main"], ["battle", "Battle"], ["end", "End"]];
let lastBeat = "";
function renderRail(S) {
  $("#turnTag").textContent = S.phase === "mulligan" ? "Mulligan" : `Turn ${S.turn} · ${S.players[S.active].name}`;
  $("#rail").innerHTML = S.phase === "mulligan" ? "" : PHASES.map(([k, l]) => {
    const i = PHASES.findIndex(([x]) => x === S.phase), j = PHASES.findIndex(([x]) => x === k);
    return `<span class="${k === S.phase ? "on" : j < i ? "done" : ""}">${l}</span>`;
  }).join("");
  const beat = S.winner !== null ? "" : S.phase === "mulligan" ? "mulligan" : `${S.turn}:${S.phase}`;
  if (beat && beat !== lastBeat) {
    const newTurn = !lastBeat.startsWith(S.turn + ":");
    lastBeat = beat;
    const txt = S.phase === "mulligan" ? "Mulligan" : newTurn ? `Turn ${S.turn} · ${S.players[S.active].name}` : `${S.phase} phase`;
    showBanner(txt, newTurn && S.phase !== "mulligan" ? "Stand & Draw → " + S.phase + " phase" : "");
  }
}
let bannerT;
function showBanner(text, sub) {
  $("#bannerText").innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
  const b = $("#banner");
  b.hidden = false; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
  clearTimeout(bannerT); bannerT = setTimeout(() => (b.hidden = true), 1300);
}

// ---------- full render ----------
function render() {
  const S = Game.state();
  if (!S) return;
  if (ui.hotseat && ui.shown !== S.controller && S.winner === null) return showCurtain();
  $("#curtain").hidden = true;
  const v = view();
  $("#opp").innerHTML = sideHTML(1 - v, "opp");
  $("#me").innerHTML = sideHTML(v, "me");

  renderRail(S);
  const mid = S.battle ? `<small>ATTACK</small><b>${fmt(Game.attackPower())}</b>` : "";
  const gsh = S.battle ? S.battle.guards.reduce((n, c) => n + (c.shield || 0), 0) : 0;
  $("#def").innerHTML = S.battle ? `<small>DEFENSE</small><b>${fmt(Game.defensePower())}</b>${gsh ? `<span class="gsh">🛡 +${fmt(gsh)} guard</span>` : ""}${S.battle.perfect ? `<span class="perfect">🛡 Can't be hit</span>` : ""}` : "";
  if (S.reveal.length) mid += `<span class="reveal">${S.reveal.map((r) => `<span class="rv ${r.card.trigger ? "rt" : ""}">${r.type}: ${esc(r.card.name)} ${r.card.trigger ? TRIG[r.card.trigger].icon : ""}</span>`).join("")}</span>`;
  $("#mid").innerHTML = mid;
  document.querySelector(".center").classList.toggle("fighting", !!S.battle);
  document.body.classList.toggle("mats-classic", ui.mats ? ui.mats.every((m) => !m.img) : true);
  const guards = S.battle ? S.battle.guards : [];
  const shield = guards.reduce((n, c) => n + (c.shield || 0), 0);
  $("#gc").innerHTML = guards.length
    ? `<div class="gcards" title="+${fmt(shield)} shield">${guards.map((c) => cardHTML(c, {}, null, null, " mini")).join("")}</div>`
    : `<span class="gl">GC</span>`;

  const mine = S.players[v];
  const picked = (c) => (S.phase === "mulligan" ? ui.mull.has(c.uid) : ui.sel === c.uid) ? " picked" : "";
  $("#hand").innerHTML = mine.hand.map((c) => `<div class="hc${picked(c)}" data-hand="${c.uid}">${cardHTML(c)}</div>`).join("") || `<span class="hint">No cards in hand</span>`;
  $("#actions").innerHTML = actionsHTML(S, v);
  $("#log").innerHTML = S.log.map((l) => `<li>${esc(l)}</li>`).join("");
  renderPending(S, v);
  $("#win").hidden = S.winner === null;
  if (S.winner !== null) $("#winText").textContent = `${S.players[S.winner].name} wins!`;
}

function actionsHTML(S, v) {
  const b = (id, text, cls = "", data = "") => `<button data-act="${id}" class="${cls}" ${data}>${text}</button>`;
  const hint = (t) => `<p class="hint">${t}</p>`;
  if (S.winner !== null) return b("restart", "New game", "go");
  if (S.pending) return hint("Waiting for a choice…");
  const isActive = v === S.active;
  if (S.phase === "mulligan") return hint("Tap cards to send back") + b("mull", ui.mull.size ? `Redraw ${ui.mull.size}` : "Keep hand", "go");

  const selCard = ui.sel && S.players[v].hand.find((c) => c.uid === ui.sel);
  if (S.battle && !isActive) {
    let h = hint("Guard from hand · tap a front G2 to intercept");
    if (selCard && selCard.type === "order") h += b("play", `Play ${esc(selCard.name)}`, "go");
    return h + b("confirm", "Done guarding ▶", "go");
  }
  if (!isActive) return "";
  let h = "";
  if (S.phase === "ride") {
    const next = Game.nextRide(S.active);
    if (ui.mode === "rideDiscard") return hint(`Discard 1 card to ride ${esc(next.name)}`) + b("cancel", "Cancel");
    h += hint("Ride from the ride deck, or pick a hand card and tap VC");
    if (next) h += b("ride", `Ride ${esc(next.name)}`, "go");
    return h + b("skipRide", "Skip ride", "ghost");
  }
  if (S.phase === "main") {
    h += hint(ui.sel ? "Tap a circle to call" : ui.unitSel ? "Use an ACT, or tap a circle to move" : "Select a card or unit");
    if (selCard && selCard.type === "order") h += b("play", `Play ${esc(selCard.name)}`, "go");
    if (ui.unitSel) {
      Game.actList(S.active, ui.unitSel).forEach((a) => (h += b("actv", "ACT: " + esc(a.text.slice(0, 70)), a.ready ? "on" : "off", `data-i="${a.i}" title="${esc(a.text)}"`)));
    }
    return h + b("end", "End turn", "ghost") + b("battle", "Battle ▶", "go");
  }
  if (S.phase === "battle") {
    h += hint(ui.attacker ? "Tap a target" : "Tap a standing front unit to attack");
    if (ui.attacker && Game.boosterFor(S.active, ui.attacker)) h += b("boost", ui.boost ? "Boost: ON" : "Boost: OFF", ui.boost ? "on" : "");
    if (ui.attacker) h += b("cancel", "Cancel");
    return h + b("end", "End turn ▶", ui.attacker ? "ghost" : "go");
  }
  return "";
}

function renderPending(S, v) {
  const p = S.pending;
  if (!p || p.player !== v) { $("#choice").hidden = true; ui.pick.clear(); return; }
  $("#choice").hidden = false;
  $("#choicePrompt").textContent = p.prompt;
  $("#choiceOpts").innerHTML = p.options.map((o) => `<button class="opt${ui.pick.has(String(o.id)) ? " picked" : ""}" data-opt="${esc(o.id)}">
    ${o.card ? cardHTML(o.card, {}, null, null, " mini") : ""}<span>${esc(o.label)}</span></button>`).join("");
  const single = p.min === 1 && p.max === 1;
  $("#choiceOk").hidden = single;
  $("#choiceOk").textContent = `Confirm (${ui.pick.size}${p.min === p.max ? "/" + p.max : ", " + p.min + "–" + p.max})`;
}

function showCurtain() {
  const S = Game.state();
  let why = "Your turn";
  if (S.pending) why = "You have a choice to make";
  else if (S.phase === "mulligan") why = "Choose cards to redraw";
  else if (S.battle) why = "You are being attacked: choose guardians";
  $("#curtainText").innerHTML = `Pass the device to <b>${esc(S.players[S.controller].name)}</b><br><span>${why}</span>`;
  $("#curtain").hidden = false;
  $("#choice").hidden = true;
}

// ---------- interaction ----------
let toastT;
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}
async function act(promise) {
  const res = await promise;
  if (res && !res.ok) toast(res.msg);
  render();
}

function onSlot(side, key) {
  const S = Game.state(), v = view();
  if (S.winner !== null || S.pending) return;
  if (S.battle) { if (v !== S.active && side === "me") act(Game.intercept(key)); return; }
  if (v !== S.active || side !== "me" && S.phase !== "battle") return;
  if (S.phase === "ride") {
    if (side === "me" && key === "vc" && ui.sel) { const id = ui.sel; ui.sel = null; act(Game.rideFromHand(id)); }
    return;
  }
  if (S.phase === "main") {
    if (ui.sel) { const id = ui.sel; ui.sel = null; return act(Game.call(id, key)); }
    if (ui.unitSel && ui.unitSel !== key && ui.unitSel !== "vc" && key !== "vc" && S.players[v].slots[ui.unitSel]) {
      const from = ui.unitSel; ui.unitSel = null; return act(Game.move(from, key));
    }
    ui.unitSel = ui.unitSel === key || !S.players[v].slots[key] ? null : key;
    return render();
  }
  if (S.phase === "battle") {
    if (side === "me") {
      if (Game.canAttack(key)) { ui.attacker = ui.attacker === key ? null : key; ui.boost = true; }
      else toast("That unit can't attack (front row, standing)");
      return render();
    }
    if (ui.attacker) { const a = ui.attacker; ui.attacker = null; act(Game.attack(a, ui.boost, key)); }
  }
}
function onHand(uid) {
  const S = Game.state(), v = view();
  if (S.winner !== null || S.pending) return;
  if (S.phase === "mulligan") { ui.mull.has(uid) ? ui.mull.delete(uid) : ui.mull.add(uid); return render(); }
  const card = S.players[v].hand.find((c) => c.uid === uid);
  if (S.battle && v !== S.active) {
    if (card.type === "order") { ui.sel = ui.sel === uid ? null : uid; return render(); }
    return act(Game.guard(uid));
  }
  if (v !== S.active) return;
  if (ui.mode === "rideDiscard") { ui.mode = null; return act(Game.rideFromDeck(uid)); }
  ui.sel = ui.sel === uid ? null : uid;
  ui.unitSel = null;
  render();
}
function onAction(a, el) {
  switch (a) {
    case "mull": { const ids = [...ui.mull]; ui.mull = new Set(); return act(Game.mulligan(ids)); }
    case "ride": ui.mode = "rideDiscard"; ui.sel = null; return render();
    case "skipRide": return act(Game.skipRide());
    case "cancel": ui.mode = null; ui.attacker = null; return render();
    case "play": { const id = ui.sel; ui.sel = null; return act(Game.playOrder(id)); }
    case "actv": return act(Game.activate(ui.unitSel, +el.dataset.i));
    case "battle": Object.assign(ui, { sel: null, unitSel: null, mode: null }); return act(Game.toBattle());
    case "boost": ui.boost = !ui.boost; return render();
    case "confirm": ui.sel = null; return act(Game.confirmGuard());
    case "end": Object.assign(ui, { sel: null, attacker: null, unitSel: null, mode: null }); return act(Game.endTurn());
    case "restart": $("#setup").hidden = false; $("#win").hidden = true; return loadSetup();
  }
}
function onOpt(id) {
  const p = Game.state().pending;
  if (!p) return;
  if (p.min === 1 && p.max === 1) { ui.pick.clear(); return act(Promise.resolve(Game.answer([parseId(id)]))); }
  ui.pick.has(id) ? ui.pick.delete(id) : ui.pick.size < p.max && ui.pick.add(id);
  render();
}
const parseId = (id) => (/^\d+$/.test(id) ? +id : id);
function showZone(z) {
  const [pi, zone] = z.split(":");
  const S = Game.state(), cards = S.players[+pi][zone];
  $("#zoneTitle").textContent = `${S.players[+pi].name}: ${zone} (${cards.length})`;
  $("#zoneCards").innerHTML = cards.map((c) => cardHTML(c, {}, null, null, " mini")).join("") || "<p class='muted'>Empty</p>";
  $("#zone").hidden = false;
}

document.addEventListener("click", (e) => {
  const t = e.target;
  const btn = t.closest("[data-act]"); if (btn) return onAction(btn.dataset.act, btn);
  const opt = t.closest("[data-opt]"); if (opt) return onOpt(opt.dataset.opt);
  const zb = t.closest("[data-zone]"); if (zb) return showZone(zb.dataset.zone);
  const hand = t.closest("[data-hand]"); if (hand) return onHand(+hand.dataset.hand);
  const slot = t.closest("[data-key]"); if (slot) return onSlot(slot.dataset.side, slot.dataset.key);
});
let infoT;
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-uid]");
  clearTimeout(infoT);
  if (el && seen.has(+el.dataset.uid)) {
    $("#info").innerHTML = infoPanel(seen.get(+el.dataset.uid));
    $("#info").hidden = false;
  } else infoT = setTimeout(() => ($("#info").hidden = true), 250);
});
$("#logBtn").addEventListener("click", () => ($("#logDrawer").hidden = !$("#logDrawer").hidden));
$("#logClose").addEventListener("click", () => ($("#logDrawer").hidden = true));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { $("#logDrawer").hidden = true; $("#info").hidden = true; } });
$("#choiceOk").addEventListener("click", () => {
  act(Promise.resolve(Game.answer([...ui.pick].map(parseId))));
  ui.pick.clear();
});
$("#startBtn").addEventListener("click", startGame);
$("#curtainBtn").addEventListener("click", () => { ui.shown = Game.state().controller; render(); });
$("#winBtn").addEventListener("click", () => onAction("restart"));
$("#zoneClose").addEventListener("click", () => ($("#zone").hidden = true));
Game.setOnChange(render);
loadSetup();
