// Screen + clicks. Reads Game.state() and redraws everything on each change.

const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString("en-US");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const hue = (s) => [...String(s || "x")].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

const ui = { sel: null, mode: null, attacker: null, boost: true, unitSel: null, mull: new Set(), pick: new Set(), hotseat: true, shown: 0, online: null };
const seen = new Map(); // uid -> card, for the info panel
const ONLINE = new URLSearchParams(location.search).get("online"); // "host" | "join" | null
const imgOf = (c) => (typeof Net !== "undefined" ? Net.img(c) : c.image || "");

// ---------- card pictures: preloaded, kept decoded in memory, with fallback ----------
// Every picture of both decks starts loading when the game starts, so cards never pop in blank.
// A picture that fails is retried once, then the card uses its backup web picture (source.imageWeb),
// then the plain coloured card. When a picture's state changes the table redraws once.
const Pics = (() => {
  const st = new Map(); // url -> {img, ok: null (loading) | true | false, src}
  let redraw = () => {}, t = 0;
  const changed = () => { clearTimeout(t); t = setTimeout(() => redraw(), 60); };
  function load(url) {
    let e = st.get(url);
    if (e) return e;
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    e = { img, ok: null, src: url, tries: 0 };
    e.p = new Promise((settle) => {
      img.onload = () => {
        const done = () => { e.ok = true; e.src = img.src; settle(true); };
        // decode() can stall in background tabs: never wait more than 1 s for it
        Promise.race([img.decode ? img.decode() : Promise.resolve(), new Promise((r) => setTimeout(r, 1000))]).then(done, done);
      };
      img.onerror = () => {
        if (++e.tries < 2) { setTimeout(() => { img.src = url + (url.includes("?") ? "&" : "?") + "r=" + e.tries; }, 1200); return; }
        e.ok = false;
        settle(false);
        changed();
      };
    });
    img.src = url;
    st.set(url, e);
    return e;
  }
  // The picture to draw for card c right now ("" = none)
  function url(c) {
    if (!c || c.hidden) return "";
    for (const u of [imgOf(c), c.source && c.source.imageWeb]) {
      if (!u) continue;
      const e = load(u);
      if (e.ok !== false) return e.src;
    }
    return "";
  }
  // Resolves when every picture started so far has loaded or failed; onProgress(0..1)
  function settled(onProgress) {
    const all = [...st.values()];
    let n = 0;
    if (!all.length) { if (onProgress) onProgress(1); return Promise.resolve(); }
    return Promise.all(all.map((e) => e.p.then(() => { n++; if (onProgress) onProgress(n / all.length); })));
  }
  return { url, load, settled, onRedraw: (f) => (redraw = f), get size() { return st.size; } };
})();
// Loading screen while the table's pictures load (1–5 s, see loader.js), then the table appears complete
async function loadingTable(msg) {
  const hide = Loader.show(msg);
  try {
    preloadPictures();
    Loader.progress(0);
    await Promise.race([Pics.settled((f) => Loader.progress(f)), new Promise((r) => setTimeout(r, 5000))]); // max 5 s
  } finally { hide(); }
}
// Load every picture the game can show: all cards of both players (+ playmats, + online image map)
function preloadPictures() {
  const S = Game.state();
  if (!S) return;
  S.players.forEach((p) => {
    [...p.deck, ...p.hand, ...p.ride, ...p.soul, ...p.damage, ...p.drop, ...p.bind, ...Object.values(p.slots).filter(Boolean).map((s) => s.card)].forEach((c) => Pics.url(c));
  });
  if (typeof Net !== "undefined") Object.values(Net.images).forEach((u) => u && Pics.load(u));
  (ui.mats || []).forEach((m) => m && m.img && Pics.load(m.img));
}
// Online: you may only act when the engine is waiting on your seat.
const myMove = () => !ui.online || Game.state().controller === ui.online.seat;

// ---------- setup ----------
async function loadSetup() {
  await DB.removeSamples();
  const decks = await DB.all("decks");
  const byId = Object.fromEntries((await DB.all("cards")).map((c) => [c.id, c]));
  const opts = decks.map((d) => {
    const bad = validateDeck(d, byId);
    return `<option value="${esc(d.id)}">${esc(d.name)}${bad.length ? " ⚠ " + esc(bad[0]) : ""}</option>`;
  }).join("") || `<option value="">No decks yet: build one in the editor</option>`;
  $("#d1").innerHTML = opts;
  const me = typeof Auth !== "undefined" && Auth.get();
  if (me) { $("#n1").value = me.name; if (me.lastP2) $("#n2").value = me.lastP2; }
  $("#d2").innerHTML = opts;
  if (decks[1]) $("#d2").value = decks[1].id;
  await Mats.probe();
  [1, 2].forEach(renderMatPick);
  if (ONLINE && !ui.netReady) setupOnline();
}

// ---------- online setup (host / join) ----------
const netStatus = (t) => ($("#netStatus").textContent = t);
async function setupOnline() {
  ui.netReady = true;
  document.body.classList.add("online", "online-" + ONLINE);
  $("#onlineBox").hidden = false;
  $("#hotseatRow").hidden = true;
  $("#n1Label").textContent = "Your name";
  $("#setup h1").textContent = ONLINE === "host" ? "Host online" : "Join online";
  const btn = $("#startBtn");
  if (ONLINE === "join") { btn.textContent = "Join game"; netStatus("Type the host's room code, pick your deck, then join."); return; }
  btn.disabled = true;
  btn.textContent = "Waiting for opponent…";
  netStatus("Opening a room…");
  try {
    $("#roomCode").textContent = await Net.host(onNet);
    netStatus("Send this code to your opponent. Keep this page open.");
  } catch (e) { netStatus(e.message); btn.textContent = "Couldn't open a room"; }
}
function onNet(ev) {
  if (ev.type === "joined") {          // host: guest is here
    ui.guest = ev;
    netStatus(`${ev.name} joined with “${ev.deck.name}”. Press Start when ready.`);
    Object.assign($("#startBtn"), { disabled: false, textContent: "Start game" });
  } else if (ev.type === "start") {    // guest: host started the match
    Object.assign(ui, { online: { seat: ev.seat }, mats: ev.mats, hotseat: false, sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set() });
    $("#setup").hidden = true;
    $("#win").hidden = true;
    $("#netLost").hidden = true;
    loadingTable("Joining the table…");
  } else if (ev.type === "left") {
    if (!ui.online) {                   // still on the setup screen
      netStatus(ONLINE === "host" ? "Opponent left. Waiting for someone to join…" : "Disconnected from the host.");
      if (ONLINE === "host") Object.assign($("#startBtn"), { disabled: true, textContent: "Waiting for opponent…" });
      else Object.assign($("#startBtn"), { disabled: false, textContent: "Join game" });
      return;
    }
    const host = ONLINE === "host";
    $("#netLostText").innerHTML = host
      ? `Your opponent disconnected.<br><span>They can rejoin with code <b>${esc(Net.code)}</b>. The game is kept.</span>`
      : `Lost connection to the host.<br><span>Room ${esc(Net.code)}</span>`;
    $("#netRetry").hidden = host;
    $("#netLost").hidden = false;
  } else if (ev.type === "back") {     // host: guest rejoined mid-game
    $("#netLost").hidden = true;
    toast("Your opponent is back");
  } else if (ev.type === "error") toast(ev.msg);
}
async function joinOnline() {
  const btn = $("#startBtn");
  btn.disabled = true;
  btn.textContent = "Connecting…";
  try {
    const deck = await DB.loadDeck($("#d1").value);
    const name = $("#n1").value.trim() || "Guest";
    await Net.join($("#joinCode").value, { name, deck, mat: Mats.resolve(1, Mats.choice(1)) }, onNet);
    btn.textContent = "Connected";
    netStatus("Connected! Waiting for the host to start…");
  } catch (e) {
    netStatus(e.message);
    Object.assign(btn, { disabled: false, textContent: "Join game" });
  }
}
async function startHosted() {
  if (!ui.guest) return;
  const deck = await DB.loadDeck($("#d1").value);
  const names = [$("#n1").value.trim() || "Host", ui.guest.name || "Guest"];
  const mats = [Mats.resolve(1, Mats.choice(1)), ui.guest.mat || { key: "classic", img: "" }];
  Object.assign(ui, { online: { seat: 0 }, mats, hotseat: false, sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set() });
  $("#setup").hidden = true;
  Net.startHosted(names, [deck, ui.guest.deck], mats);
  const loading = loadingTable("Shuffling decks…");
  render();
  await loading;
}
function renderMatPick(seat) {
  const box = document.querySelector(`.matpick[data-seat="${seat}"]`);
  const cur = Mats.choice(seat), custom = Mats.customImg(seat);
  box.innerHTML = `<span class="mp-label">Playmat</span><div class="mp-row">${Object.entries(MATS).filter(([, m]) => !m.missing).map(([k, m]) => {
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
  if (!$("#d1").value) return toast("Build a deck in the Card & deck editor first");
  if (ONLINE === "join") return joinOnline();
  if (ONLINE === "host") return startHosted().catch((e) => toast(e.message));
  if (typeof Auth !== "undefined" && Auth.get()) Auth.set({ ...Auth.get(), lastP2: $("#n2").value.trim() });
  try {
    const decks = [await DB.loadDeck($("#d1").value), await DB.loadDeck($("#d2").value)];
    ui.hotseat = $("#hotseat").checked;
    ui.mats = [Mats.resolve(1, Mats.choice(1)), Mats.resolve(2, Mats.choice(2))];
    const fp = $("#firstP").value;
    Game.newGame([$("#n1").value.trim() || "Player 1", $("#n2").value.trim() || "Player 2"], decks, { first: fp === "" ? null : +fp });
    toast(`${Game.state().players[Game.state().first].name} goes first`);
    Object.assign(ui, { sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set(), shown: -1 });
    $("#setup").hidden = true;
    const loading = loadingTable("Shuffling decks…");
    render();
    await loading;
  } catch (e) { toast(e.message); }
}
const view = () => (ui.online ? ui.online.seat : ui.hotseat ? ui.shown : Game.state().controller);

// ---------- card drawing ----------
// A card is drawn in three parts so an existing card element can be updated in place
// (no flicker, picture stays decoded): class, background picture, inner text.
const cardClass = (src, s = {}, extra = "") => `card${src ? " img" : ""}${s.rest ? " rest" : ""}${extra}`;
const cardBg = (src) => (src ? `linear-gradient(#0000 45%,#000c),url("${src.replace(/"/g, "%22")}")` : "");
function cardInner(c, pi = null, key = null) {
  const pw = pi !== null && key ? Game.power(pi, key) : c.power;
  const cr = pi !== null && key ? Game.crit(pi, key) : c.crit || 1;
  return `<div class="ctop"><span class="cg">${c.type === "order" ? "ORD" : "G" + c.grade}</span>
      ${c.trigger ? `<span class="ct t-${c.trigger}">${TRIG[c.trigger].icon}</span>` : ""}${c.sentinel ? `<span class="ct t-sent">◆</span>` : ""}${(c.abilities || []).length ? `<span class="ab">✦</span>` : ""}</div>
    <div class="cn">${esc(c.name)}</div>
    <div class="cs">${c.type === "order" ? "" : `<span class="cp${pw !== c.power ? " buffed" : ""}">${fmt(pw)}</span>`}${cr > 1 ? `<span class="cc">★${cr}</span>` : ""}${c.shield ? `<span class="csh">🛡${c.shield / 1000}k</span>` : ""}</div>`;
}
function cardHTML(c, s = {}, pi = null, key = null, extra = "") {
  seen.set(c.uid, c);
  const src = Pics.url(c);
  return `<div class="${cardClass(src, s, extra)}" data-uid="${c.uid}" data-src="${esc(src)}" style="--h:${hue(c.nation)}${src ? `;background-image:${esc(cardBg(src))}` : ""}">${cardInner(c, pi, key)}</div>`;
}
// Update a card element that already shows card c
function patchCard(el, c, s = {}, pi = null, key = null, extra = "") {
  seen.set(c.uid, c);
  const src = Pics.url(c);
  const cls = cardClass(src, s, extra);
  if (el.className !== cls) el.className = cls;
  if (el.dataset.src !== src) { el.style.backgroundImage = cardBg(src); el.dataset.src = src; }
  setHTML(el, cardInner(c, pi, key));
}
// Make `box` hold exactly one card element for c (reuses the existing one when it's the same card)
function placeCard(box, c, s, pi, key, extra = "") {
  const old = box.querySelector(":scope > .card");
  if (!c) { if (old) old.remove(); return; }
  if (old && old.dataset.uid === String(c.uid)) return patchCard(old, c, s, pi, key, extra);
  const tmp = document.createElement("div");
  tmp.innerHTML = cardHTML(c, s, pi, key, extra);
  if (old) old.replaceWith(tmp.firstElementChild); else box.appendChild(tmp.firstElementChild);
}
// innerHTML only when it really changed
function setHTML(el, html) {
  if (el._h === html) return;
  el.innerHTML = html;
  el._h = html;
}
function infoPanel(c) {
  if (!c) return `<p class="muted">Hover a card to see its details.</p>`;
  return `${Pics.url(c) ? `<img src="${esc(Pics.url(c))}" alt="" decoding="async">` : ""}
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
// Draws one player's half of the table into root (#me or #opp). The mat and its zones are built once;
// later calls only touch what changed, so the mat picture and card pictures are never re-created.
function renderSide(root, pi, side) {
  const S = Game.state(), p = S.players[pi], v = view(), opp = side === "opp";
  const mat = (ui.mats && ui.mats[pi]) || { key: "classic", img: "" };
  const L = MAT_LAYOUT;
  const skey = `${pi}|${mat.key}|${mat.img ? mat.img.length + mat.img.slice(-24) : ""}`;
  if (root._skey !== skey) {
    root._skey = skey;
    root.innerHTML = `<div class="mat ${mat.img ? "img" : "classic"} ${side}" style="${mat.img ? `--matimg:url('${esc(mat.img)}')` : ""}">
      <div class="mz info" style="${boxCSS(L.order, opp)}"></div>
      <div class="mz damage" style="${boxCSS(L.damage, opp)}"></div>
      <div class="mz deck" style="${boxCSS(L.deck, opp)}"></div>
      <button class="mz drop" style="${boxCSS(L.drop, opp)}" data-zone="${pi}:drop"></button>
      <div class="mz ride" style="${boxCSS(L.ride, opp)};display:none"></div>
      ${Object.keys(L.slots).map((key) => {
        const [x, y] = L.slots[key];
        const pos = opp ? `left:${100 - x}%;top:${100 - y}%` : `left:${x}%;top:${y}%`;
        return `<div class="slot" style="${pos}" data-side="${side}" data-key="${key}"><span class="sl">${SLOT_LABEL[key]}</span></div>`;
      }).join("")}
    </div>`;
    root._parts = {
      info: root.querySelector(".mz.info"), damage: root.querySelector(".mz.damage"), deck: root.querySelector(".mz.deck"),
      drop: root.querySelector(".mz.drop"), ride: root.querySelector(".mz.ride"),
      slots: Object.fromEntries([...root.querySelectorAll(".slot")].map((el) => [el.dataset.key, el])),
    };
  }
  const P = root._parts;
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
  for (const key of Object.keys(L.slots)) {
    const el = P.slots[key], cls = `slot${key === "vc" ? " vcs" : ""}${hl(key) ? " " + hl(key) : ""}`;
    if (el.className !== cls) el.className = cls;
    const s = p.slots[key];
    placeCard(el, s && s.card, s, pi, key);
  }
  p.damage.forEach((c) => seen.set(c.uid, c));
  setHTML(P.damage, Array.from({ length: 6 }, (_, i) => {
    const c = p.damage[i];
    return c ? `<div class="dmgc${c.down ? " down" : ""}" data-uid="${c.uid}"><b>${i + 1}</b><span>${c.down ? "Face down" : esc(c.name)}</span></div>`
      : `<div class="dmgc empty"><b>${i + 1}</b></div>`;
  }).join(""));
  P.damage.title = `Damage ${p.damage.length}/6`;
  const chip = (label, val, cls = "", zone = "") => zone
    ? `<button class="chip ${cls}" data-zone="${pi}:${zone}"><small>${label}</small><b>${val}</b></button>`
    : `<span class="chip ${cls}"><small>${label}</small><b>${val}</b></span>`;
  setHTML(P.info, `<div class="pname">${esc(p.name)}${pi === S.active ? '<span class="turnmark">TURN</span>' : ""}</div>
    <div class="chips">${chip("Soul", p.soul.length, "", "soul")}${chip("CB", Game.faceUp(p), "cb")}
      ${p.useEnergy ? chip("Energy", p.energy, "en") : ""}${p.bind.length ? chip("Bind", p.bind.length, "", "bind") : ""}${p.removed && p.removed.length ? chip("Removed", p.removed.length, "", "removed") : ""}${opp ? chip("Hand", p.hand.length) : ""}</div>`);
  setHTML(P.deck, `<small>Deck</small><b>${p.deck.length}</b>`);
  const topDrop = p.drop[p.drop.length - 1];
  if (topDrop) seen.set(topDrop.uid, topDrop);
  setHTML(P.drop, `${topDrop ? `<span class="top" data-uid="${topDrop.uid}">${esc(topDrop.name)}</span>` : ""}<small>Drop</small><b>${p.drop.length}</b>`);
  P.ride.style.display = p.ride.length ? "" : "none";
  setHTML(P.ride, `<b>${p.ride.length}</b>`);
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

// Hand: keeps one element per card (by uid) and only adds/removes/reorders what changed
function renderHand(hand, picked) {
  const box = $("#hand");
  if (!hand.length) { if (!box.querySelector(".hint")) box.innerHTML = `<span class="hint">No cards in hand</span>`; return; }
  const have = new Map();
  [...box.children].forEach((el) => (el.dataset.hand ? have.set(el.dataset.hand, el) : el.remove()));
  let prev = null;
  for (const c of hand) {
    let el = have.get(String(c.uid));
    if (el) { have.delete(String(c.uid)); patchCard(el.firstElementChild, c); }
    else { el = document.createElement("div"); el.dataset.hand = c.uid; el.innerHTML = cardHTML(c); }
    const cls = "hc" + picked(c);
    if (el.className !== cls) el.className = cls;
    const want = prev ? prev.nextSibling : box.firstChild;
    if (want !== el) box.insertBefore(el, want);
    prev = el;
  }
  have.forEach((el) => el.remove());
}
// Engine updates can come in bursts (abilities, triggers): draw at most once per frame.
// The timeout covers background tabs, where animation frames are paused.
let renderReq = 0, renderTO = 0;
function scheduleRender() {
  if (renderReq) return;
  const go = () => { cancelAnimationFrame(renderReq); clearTimeout(renderTO); renderReq = 0; render(); };
  renderReq = requestAnimationFrame(go);
  renderTO = setTimeout(go, 100);
}
Pics.onRedraw(scheduleRender);

// ---------- full render ----------
function render() {
  const S = Game.state();
  if (!S) return;
  if (ui.hotseat && ui.shown !== S.controller && S.winner === null) return showCurtain();
  $("#curtain").hidden = true;
  const v = view();
  preloadPictures(); // cheap after the first time: every picture is already in the cache
  renderSide($("#opp"), 1 - v, "opp");
  renderSide($("#me"), v, "me");

  renderRail(S);
  let mid = S.battle ? `<small>ATTACK</small><b>${fmt(Game.attackPower())}</b>` : "";
  const gsh = S.battle ? S.battle.guards.reduce((n, c) => n + (c.shield || 0), 0) : 0;
  setHTML($("#def"), S.battle ? `<small>DEFENSE</small><b>${fmt(Game.defensePower())}</b>${gsh ? `<span class="gsh">🛡 +${fmt(gsh)} guard</span>` : ""}${S.battle.perfect ? `<span class="perfect">🛡 Can't be hit</span>` : ""}` : "");
  if (S.reveal.length) mid += `<span class="reveal">${S.reveal.map((r) => `<span class="rv ${r.card.trigger ? "rt" : ""}">${r.type}: ${esc(r.card.name)} ${r.card.trigger ? TRIG[r.card.trigger].icon : ""}</span>`).join("")}</span>`;
  setHTML($("#mid"), mid);
  document.querySelector(".center").classList.toggle("fighting", !!S.battle);
  document.body.classList.toggle("mats-classic", ui.mats ? ui.mats.every((m) => !m.img) : true);
  const guards = S.battle ? S.battle.guards : [];
  const shield = guards.reduce((n, c) => n + (c.shield || 0), 0);
  setHTML($("#gc"), guards.length
    ? `<div class="gcards" title="+${fmt(shield)} shield">${guards.map((c) => cardHTML(c, {}, null, null, " mini")).join("")}</div>`
    : `<span class="gl">GC</span>`);

  const mine = S.players[v];
  const picked = (c) => (S.phase === "mulligan" ? ui.mull.has(c.uid) : ui.sel === c.uid) ? " picked" : "";
  renderHand(mine.hand, picked);
  setHTML($("#actions"), actionsHTML(S, v));
  if (!$("#logDrawer").hidden) setHTML($("#log"), S.log.map((l) => `<li>${esc(l)}</li>`).join(""));
  renderPending(S, v);
  $("#win").hidden = S.winner === null;
  if (S.winner !== null) $("#winText").textContent = `${S.players[S.winner].name} wins!`;
  if (ui.online) $("#winBtn").textContent = ONLINE === "host" ? "Rematch" : "Waiting for the host…";
}

function actionsHTML(S, v) {
  const b = (id, text, cls = "", data = "") => `<button data-act="${id}" class="${cls}" ${data}>${text}</button>`;
  const hint = (t) => `<p class="hint">${t}</p>`;
  if (S.winner !== null) return b("restart", "New game", "go");
  if (ui.online && S.controller !== v) return hint(S.pending ? `${esc(S.players[S.controller].name)} is choosing…` : S.battle ? `${esc(S.players[S.controller].name)} is guarding…` : `${esc(S.players[S.controller].name)}'s move…`);
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
    const me = S.players[S.active];
    if (me.useEnergy && me.energy >= 7 && me.egTurn !== S.turn) h += b("egdraw", "⚡ Energy-Blast 7: draw 1", "on");
    if (S.turn === 1) return h + hint("First turn: no attacks") + b("end", "End turn ▶", "go");
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
  setHTML($("#choiceOpts"), p.options.map((o) => `<button class="opt${ui.pick.has(String(o.id)) ? " picked" : ""}" data-opt="${esc(o.id)}">
    ${o.card ? cardHTML(o.card, {}, null, null, " mini") : ""}<span>${esc(o.label)}</span></button>`).join(""));
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
  if (S.winner !== null || S.pending || !myMove()) return;
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
  if (S.winner !== null || S.pending || !myMove()) return;
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
    case "egdraw": return act(Game.energyDraw());
    case "battle": Object.assign(ui, { sel: null, unitSel: null, mode: null }); return act(Game.toBattle());
    case "boost": ui.boost = !ui.boost; return render();
    case "confirm": ui.sel = null; return act(Game.confirmGuard());
    case "end": Object.assign(ui, { sel: null, attacker: null, unitSel: null, mode: null }); return act(Game.endTurn());
    case "restart":
      if (ui.online) {
        if (ONLINE !== "host") return toast("The host starts the next game");
        Object.assign(ui, { sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set() });
        $("#win").hidden = true;
        Net.rematch();
        loadingTable("Shuffling decks…");
        return render();
      }
      $("#setup").hidden = false; $("#win").hidden = true; return loadSetup();
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
let infoUid = null;
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-uid]");
  clearTimeout(infoT);
  if (el && seen.has(+el.dataset.uid)) {
    if (infoUid !== el.dataset.uid || $("#info").hidden) { infoUid = el.dataset.uid; $("#info").innerHTML = infoPanel(seen.get(+el.dataset.uid)); }
    $("#info").hidden = false;
  } else infoT = setTimeout(() => ($("#info").hidden = true), 250);
});
$("#logBtn").addEventListener("click", () => { $("#logDrawer").hidden = !$("#logDrawer").hidden; render(); });
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
$("#netRetry").addEventListener("click", async () => {
  $("#netRetry").disabled = true;
  try { await Net.join(Net.code, { name: Game.state().players[ui.online.seat].name, deck: { ride: [], main: [] } }, onNet); $("#netLost").hidden = true; }
  catch (e) { toast(e.message); }
  $("#netRetry").disabled = false;
});
$("#joinCode").addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase()));
// Host: every engine change goes to the guest too.
Game.setOnChange(() => { scheduleRender(); if (ui.online && ONLINE === "host") Net.pushState(); });
Loader.wait(loadSetup());
