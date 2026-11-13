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
    [...p.deck, ...p.hand, ...p.ride, ...p.soul, ...p.damage, ...p.drop, ...p.bind, ...(p.gDeck || []), ...(p.gUp || []), ...Object.values(p.slots).filter(Boolean).flatMap((s) => [s.card, s.heart, s.mate, s.heartMate, ...(s.under || []), ...(s.arms || [])].filter(Boolean)), ...(p.orderZone || [])].forEach((c) => Pics.url(c));
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
    return `<option value="${esc(d.id)}">${esc(d.name)} · ${esc(FORMATS[formatOf(d)].label)}${bad.length ? " ⚠ " + esc(bad[0]) : ""}</option>`;
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
    await Net.join($("#joinCode").value, { name, deck, mat: Mats.resolve(1, Mats.choice(1)), uid: (() => { const u = Auth.get(); return u && !u.guest ? u.id : null; })() }, onNet);
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
  Net.startHosted(names, [deck, ui.guest.deck], mats, [(() => { const u = Auth.get(); return u && !u.guest ? u.id : null; })(), ui.guest.uid || null], await DB.extras());
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
    if (decks[0].format !== decks[1].format) toast(`Different formats: ${FORMATS[decks[0].format].label} vs ${FORMATS[decks[1].format].label}. Each deck plays by its own setup.`);
    ui.hotseat = $("#hotseat").checked;
    ui.mats = [Mats.resolve(1, Mats.choice(1)), Mats.resolve(2, Mats.choice(2))];
    const fp = $("#firstP").value;
    Game.newGame([$("#n1").value.trim() || "Player 1", $("#n2").value.trim() || "Player 2"], decks, { first: fp === "" ? null : +fp, extras: await DB.extras() });
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
const cardBg = (src) => (src ? `linear-gradient(#0000 78%,#0007),url("${src.replace(/"/g, "%22")}")` : "");
function cardInner(c, pi = null, key = null) {
  if (c.type === "locked") return `<div class="cn facedown">🔒 Locked</div>`;
  if (c.type === "deleted") return `<div class="cn facedown">⛔ Deleted</div><div class="cs"><span class="cp">${fmt(pi !== null && key ? Game.power(pi, key) : 0)}</span></div>`;
  const pw = pi !== null && key ? Game.power(pi, key) : c.power;
  const cr = pi !== null && key ? Game.crit(pi, key) : c.crit || 1;
  return `<div class="ctop"><span class="cg">${c.type === "order" ? "ORD" : "G" + c.grade}</span>
      ${c.trigger ? `<span class="ct t-${c.trigger}">${TRIG[c.trigger].icon}</span>` : ""}${c.sentinel ? `<span class="ct t-sent">◆</span>` : ""}${(c.abilities || []).length ? `<span class="ab">✦</span>` : ""}</div>
    <div class="cn">${esc(c.name)}</div>
    ${pi !== null && key === "vc" && Game.state().players[pi].slots.vc && Game.state().players[pi].slots.vc.heart ? `<div class="heart">♥ ${esc(Game.state().players[pi].slots.vc.heart.name)}</div>` : ""}
    ${pi !== null && key === "vc" && Game.state().players[pi].slots.vc && Game.state().players[pi].slots.vc.mate ? `<div class="heart mate">⚭ ${esc(Game.state().players[pi].slots.vc.mate.name)}</div>` : ""}
    <div class="cs">${c.type === "order" ? "" : `<span class="cp${pw !== c.power ? " buffed" : ""}">${fmt(pw)}</span>`}${cr > 1 ? `<span class="cc">★${cr}</span>` : ""}${c.shield && key === null ? `<span class="csh">🛡${c.shield / 1000}k</span>` : ""}</div>`; // shield only off the field (hand, guardians)
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
  if (!c) return `<div class="info-guide"><h3>Card detail</h3><p>Point at any card (field, hand, drop, damage, guardians) to read it here: picture, stats and its full text.</p><p><b>Right-click</b> (long press on touch) pins a card so it stays while you play. <b>Esc</b> unpins.</p><p class="muted">Click Drop, Soul, Bind or the ride deck to see every card in it.</p></div>`;
  return `${Pics.url(c) ? `<img src="${esc(Pics.url(c))}" alt="" decoding="async">` : ""}
    <h3>${esc(c.name)}</h3>
    <p class="statline">${esc(cardStatLine(c))}</p>
    ${cardNoLine(c) ? `<p class="muted">${esc(cardNoLine(c))}</p>` : ""}
    ${c.trigger && TRIG[c.trigger] ? `<p>${TRIG[c.trigger].icon} ${TRIG[c.trigger].name}: ${TRIG[c.trigger].desc}</p>` : ""}
    ${c.sentinel ? "<p>◆ Sentinel: discard 1 to make the attacked unit unhittable</p>" : ""}
    ${c.text ? `<p class="pre">${esc(c.text)}</p>` : (c.abilities || []).length ? "" : `<p class="muted">No abilities.</p>`}
    ${c.notes ? `<p class="pre rnotes"><b>Rulings:</b> ${esc(c.notes)}</p>` : ""}
    ${(c.abilities || []).length ? `<details class="howplay" ${c.text ? "" : "open"}><summary>How the game plays it (${c.abilities.length})</summary>${c.abilities.map((a) => `<p class="abl">${esc(describeAbility(a))}</p>`).join("")}</details>` : ""}`;
}

const SLOT_LABEL = { vc: "VC", fl: "RC", fr: "RC", bl: "RC", bc: "RC", br: "RC" };
// Box [left, top, right, bottom] in % → CSS. The opponent's mat is turned 180°, so mirror it.
const boxCSS = (r, opp) => {
  const [l, t, rr, b] = opp ? [100 - r[2], 100 - r[3], 100 - r[0], 100 - r[1]] : r;
  return `left:${l}%;top:${t}%;width:${rr - l}%;height:${b - t}%`;
};
// Damage box i (0–5) inside the damage zone, as top/height % of the zone (mirrored on the opponent's mat)
function dmgBox(i, opp) {
  const D = MAT_LAYOUT.damage, h = D[3] - D[1], [t, b] = MAT_LAYOUT.dmgSlots[i];
  const top = ((t - D[1]) / h) * 100, bot = ((b - D[1]) / h) * 100;
  return `top:${opp ? 100 - bot : top}%;height:${bot - top}%`;
}
const backHTML = (cls = "") => `<span class="cback${cls}"></span>`;
// a small picture of a card for the zones (order zone, drop top, trigger zone): hover / right-click works like any card
const zoneCard = (c, extra = "") => cardHTML(c, {}, null, null, " zc" + extra);
// Draws one player's half of the table into root (#me or #opp): the Standard mat with every zone on its printed spot.
// The mat and its zone boxes are built once; later calls only patch what changed (pictures are never re-created).
function renderSide(root, pi, side) {
  const S = Game.state(), p = S.players[pi], v = view(), opp = side === "opp";
  const mat = (ui.mats && ui.mats[pi]) || { key: "classic", img: "" };
  const L = MAT_LAYOUT;
  const skey = `${pi}|${mat.key}|${mat.img ? mat.img.length + mat.img.slice(-24) : ""}`;
  if (root._skey !== skey) {
    root._skey = skey;
    root.innerHTML = `<div class="mat ${mat.img ? "img" : "classic"} ${side}" style="${mat.img ? `--matimg:url('${esc(mat.img)}')` : ""}">
      <div class="mz order" style="${boxCSS(L.order, opp)}" title="Order zone"><small class="zl">Order</small><div class="ozc"></div></div>
      <div class="mz damage" style="${boxCSS(L.damage, opp)}" title="Damage zone">${L.dmgSlots.map((_, i) => `<div class="dslot" style="${dmgBox(i, opp)}"><i>${i + 1}</i></div>`).join("")}</div>
      <div class="mz trig" style="${boxCSS(L.trigger, opp)}" title="Trigger check zone"><small class="zl">Trigger check</small><div class="tzc"></div></div>
      <div class="mz deck" style="${boxCSS(L.deck, opp)}" title="Deck"></div>
      <button class="mz drop" style="${boxCSS(L.drop, opp)}" data-zone="${pi}:drop" title="Drop zone (click to see every card)"></button>
      <button class="mz ride" style="${boxCSS(L.ride, opp)}" title="Ride deck"></button>
      <div class="mz crest" style="${boxCSS(L.crest, opp)}" title="Crest zone"></div>
      <div class="plate" style="${boxCSS(L.plate, opp)}"></div>
      ${Object.keys(L.slots).map((key) => {
        const [x, y] = L.slots[key];
        const pos = opp ? `left:${100 - x}%;top:${100 - y}%` : `left:${x}%;top:${y}%`;
        return `<div class="slot" style="${pos}" data-side="${side}" data-key="${key}"><span class="sl">${SLOT_LABEL[key]}</span></div>`;
      }).join("")}
    </div>`;
    const q = (s) => root.querySelector(s);
    root._parts = {
      plate: q(".plate"), order: q(".mz.order .ozc"), damage: [...root.querySelectorAll(".dslot")], trig: q(".mz.trig"), tzc: q(".mz.trig .tzc"),
      deck: q(".mz.deck"), drop: q(".mz.drop"), ride: q(".mz.ride"), crest: q(".mz.crest"),
      slots: Object.fromEntries([...root.querySelectorAll(".slot")].map((el) => [el.dataset.key, el])),
    };
  }
  const P = root._parts;
  for (const k of Object.keys(P.slots)) { // accel circles from an earlier game
    if (k[0] === "x" && !(p.accel || []).some((a) => a.key === k)) { P.slots[k].remove(); delete P.slots[k]; }
  }
  for (const a of p.accel || []) {
    if (P.slots[a.key]) continue;
    const x = a.side === "L" ? -9 - 19 * a.idx : 109 + 19 * a.idx, y = MAT_LAYOUT.slots.fl[1];
    const el = document.createElement("div");
    el.className = "slot accel";
    el.style.cssText = opp ? `left:${100 - x}%;top:${100 - y}%` : `left:${x}%;top:${y}%`;
    el.dataset.side = side; el.dataset.key = a.key;
    el.innerHTML = `<span class="sl">ACCEL</span>`;
    root.querySelector(".mat").appendChild(el);
    P.slots[a.key] = el;
  }
  const hl = (key) => {
    const c = [];
    if (S.battle) {
      if (pi === S.active && key === S.battle.att) c.push("attacking");
      if (pi === S.active && key === S.battle.boostKey) c.push("boosting");
      if (pi !== S.active && key === S.battle.tgt) c.push("targeted");
    }
    const fp = fieldPickIds(S, v);
    if (fp && fp.has(`${pi}:${key}`)) c.push(ui.pick.has(`${pi}:${key}`) ? "chosen" : "can-choose");
    if (side === "me" && (ui.attacker === key || ui.unitSel === key)) c.push("picked");
    if (opp && ui.attacker && Game.frontOf(pi).includes(key) && p.slots[key]) c.push("can-target");
    if (side === "me" && ui.sel && S.phase === "main" && v === S.active && key !== "vc") c.push("can-drop");
    if (side === "me" && ui.sel && S.phase === "ride" && key === "vc") c.push("can-drop");
    if (side === "me" && !ui.attacker && !ui.sel && S.phase === "battle" && !S.battle && v === S.active && !S.pending && Game.canAttack(key)) c.push("can-attack");
    return c.join(" ");
  };
  for (const key of [...Object.keys(L.slots), ...(p.accel || []).map((a) => a.key)]) {
    const el = P.slots[key];
    if (!el) continue;
    const cls = `slot${key === "vc" ? " vcs" : ""}${key[0] === "x" ? " accel" : ""}${hl(key) ? " " + hl(key) : ""}`;
    if (el.className !== cls) el.className = cls;
    const s = p.slots[key];
    const shown = s && (s.locked || s.deleted) ? { uid: -1000000 - s.card.uid, name: s.locked ? "Locked" : "Deleted", type: s.locked ? "locked" : "deleted", grade: s.card.grade, power: 0, abilities: [], image: "" } : s && s.card;
    placeCard(el, shown, s, pi, key);
    // gift markers on this circle (Force I/II, Protect II) and the accel bonus
    const m = (p.marks || {})[key] || {}, a = (p.accel || []).find((x) => x.key === key);
    // other named markers (Dragontree, Treasure, Cradle…): first letters ×count
    const named = Object.entries(m).filter(([k, n]) => !["forceI", "forceII", "protectII"].includes(k) && +n > 0).map(([k, n]) => `${k.replace(/\b\w/g, (x) => x.toUpperCase())}${+n > 1 ? "×" + n : ""}`);
    const badge = [m.forceI ? `F+${10 * m.forceI}k` : "", m.forceII ? "F★2" : "", m.protectII ? "P+10k" : "", ...named, a ? `A${a.variant}` : "",
      s && s.under && s.under.length ? `Dress${s.under.length > 1 ? "×" + s.under.length : ""}` : "", s && s.arms && s.arms.length ? `Arms×${s.arms.length}` : ""].filter(Boolean).join(" ");
    let mk = el.querySelector(":scope > .mk");
    if (badge && !mk) { mk = document.createElement("span"); mk.className = "mk"; el.appendChild(mk); }
    if (mk) { if (mk.textContent !== badge) mk.textContent = badge; mk.hidden = !badge; }
    // the soul sits under the vanguard: a small counter on the circle (click to see the cards)
    if (key === "vc") {
      let sb = el.querySelector(":scope > .soulb");
      if (!sb) { sb = document.createElement("button"); sb.className = "soulb"; sb.dataset.zone = `${pi}:soul`; sb.title = "Soul (click to see the cards)"; el.appendChild(sb); }
      const txt = `◎ ${p.soul.length}`;
      if (sb.textContent !== txt) sb.textContent = txt;
      sb.hidden = !p.soul.length;
    }
  }
  // ---- damage zone: one card per printed box, picture side up (face down = card back) ----
  P.damage.forEach((box, i) => {
    const c = p.damage[i];
    if (c) seen.set(c.uid, c);
    const src = c && !c.down ? Pics.url(c) : "";
    setHTML(box, `<i>${i + 1}</i>${c ? `<div class="dmgc${c.down ? " down" : ""}${i === 0 ? " big" : ""}" data-uid="${c.uid}" title="${esc(c.name)}${c.down ? " (face down)" : ""}"
      style="${src ? `background-image:url('${esc(src.replace(/'/g, "%27"))}')` : ""}">${c.down ? backHTML(" side") : ""}<span>${esc(c.name)}</span></div>` : ""}`);
    box.classList.toggle("on", !!c);
  });
  // extra damage beyond 6 (rare: a draw game check) still shows as a count
  P.damage[5].dataset.more = p.damage.length > 6 ? `+${p.damage.length - 6}` : "";
  // ---- order zone: set orders and Songs (face down) ----
  const oz = p.orderZone || [];
  setHTML(P.order, oz.map((c) => (c.faceDown && pi !== v ? `<div class="zc-back">${backHTML()}</div>` : zoneCard(c, c.faceDown ? " fdown" : ""))).join(""));
  P.order.parentElement.classList.toggle("has", !!oz.length);
  // ---- trigger check zone: the card being checked right now ----
  const chk = S.checking && S.checking.pi === pi ? S.checking : null;
  setHTML(P.tzc, chk ? `<span class="tzt">${chk.type} check</span>${zoneCard(chk.card, chk.card.trigger ? " trig" : "")}` : "");
  P.trig.classList.toggle("on", !!chk);
  // ---- deck, drop, ride deck, crest ----
  setHTML(P.deck, `${p.deck.length ? backHTML() : ""}<small>Deck</small><b>${p.deck.length}</b>`);
  P.deck.classList.toggle("low", p.deck.length > 0 && p.deck.length <= 5);
  const topDrop = p.drop[p.drop.length - 1];
  setHTML(P.drop, `${topDrop ? zoneCard(topDrop) : ""}<small>Drop</small><b>${p.drop.length}</b>`);
  const rideMine = pi === v;
  if (rideMine) P.ride.dataset.zone = `${pi}:ride`; else delete P.ride.dataset.zone;
  P.ride.hidden = !p.hasRideDeck && !p.ride.length;
  setHTML(P.ride, `${p.ride.length ? backHTML() : ""}<small>Ride</small><b>${p.ride.length}</b>`);
  const crest = p.crest || [];
  P.crest.hidden = !p.useEnergy && !crest.length;
  setHTML(P.crest, `${p.useEnergy ? `<div class="eg${p.egPlaced ? " on" : ""}" title="Energy Generator${p.egPlaced ? " (in the crest zone)" : " (goes to the crest zone at your first ride)"}"><small>Energy</small><b>${p.energy}</b><span class="enbar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < p.energy ? "f" : ""}"></i>`).join("")}</span></div>` : ""}${crest.length ? `<button class="crestb" data-zone="${pi}:crest">Crest ${crest.length}</button>` : ""}`);
  // ---- player plate (screen corner: opponent top-right, you bottom-left): badge, name, damage / deck / hand, then the counts ----
  const chip = (label, val, cls = "", zone = "", tip = "") => zone
    ? `<button class="chip ${cls}" data-zone="${pi}:${zone}" title="${tip || label}"><small>${label}</small><b>${val}</b></button>`
    : `<span class="chip ${cls}" title="${tip || label}"><small>${label}</small><b>${val}</b></span>`;
  const acts = S.controller === pi && S.winner === null;
  setHTML(P.plate, `<div class="cp-av" style="--h:${hue(p.name)}">${esc((p.name || "?").trim().charAt(0).toUpperCase())}</div>
    <div class="cp-main">
      <div class="pname">${esc(p.name)}${pi === S.active ? '<span class="turnmark">TURN</span>' : ""}${acts ? '<span class="actmark" title="This player acts now">● acting</span>' : ""}</div>
      <div class="cp-stats"><span class="st dmg${p.damage.length >= 5 ? " hot" : ""}" title="Damage"><small>Damage</small><b>${p.damage.length}/6</b></span><span class="st" title="Cards in deck"><small>Deck</small><b>${p.deck.length}</b></span><span class="st" title="Cards in hand"><small>Hand</small><b>${p.hand.length}</b></span></div>
      <div class="chips">${chip("Soul", p.soul.length, "", "soul")}${chip("CB", Game.faceUp(p), "cb", "", "Face-up damage you can Counter-Blast")}${p.useEnergy ? chip("Energy", p.energy, "en") : ""}${p.bind.length ? chip("Bind", p.bind.length, "", "bind") : ""}${p.removed && p.removed.length ? chip("Removed", p.removed.length, "", "removed") : ""}${(p.orderZone || []).length ? chip("Orders", p.orderZone.length, "oz", "orderZone") : ""}${(p.automod || []).length ? chip("AutoMOD", p.automod.length, "am", "automod") : ""}${p.world ? chip("World", esc(p.world), "world") : ""}${p.giftType ? chip("Gift", `${p.giftType[0].toUpperCase() + p.giftType.slice(1)} ${(p.giftVariant || {})[p.giftType] || ""}`, "gift") : ""}${(p.gDeck && p.gDeck.length) || (p.gUp && p.gUp.length) ? chip("G zone", `${(p.gDeck || []).length}·${(p.gUp || []).length}↑`, "gz", "gzone") : ""}</div>
    </div>`);
  P.plate.classList.toggle("acting", acts);
}
// ---------- phase list (top-left): whose turn, every phase of the turn, the current one big with what to do ----------
const PHASES = [["stand", "Stand"], ["draw", "Draw"], ["ride", "Ride"], ["main", "Main"], ["battle", "Battle"], ["end", "End"]];
let lastBeat = "";
function renderRail(S) {
  const v = view();
  $("#turnTag").textContent = "";
  const ph = S.phase === "stride" ? "ride" : S.phase;
  const i = PHASES.findIndex(([k]) => k === ph);
  const mine = S.active === v;
  const head = S.phase === "mulligan" ? "Mulligan" : ui.online || !ui.hotseat ? `${mine ? "Your" : "Opponent's"} turn <b>${S.turn}</b>` : `Turn <b>${S.turn}</b> · ${esc(S.players[S.active].name)}`;
  setHTML($("#rail"), `<div class="ph-head${mine ? " mine" : ""}">${head}</div>${S.phase === "mulligan" ? "" : PHASES.map(([k, l], j) =>
    `<div class="ph${j === i ? " on" : j < i ? " done" : ""}"><span>${S.phase === "stride" && k === "ride" ? "Stride" : l}</span>${j === i ? `<small class="ph-hint"></small>` : ""}</div>`).join("")}`);
  const beat = S.winner !== null ? "" : S.phase === "mulligan" ? "mulligan" : `${S.turn}`;
  if (beat && beat !== lastBeat) { // a new turn: a quick strip across the middle
    lastBeat = beat;
    showBanner(S.phase === "mulligan" ? "Mulligan" : ui.online || !ui.hotseat ? `${mine ? "Your" : "Opponent's"} turn ${S.turn}` : `Turn ${S.turn} · ${S.players[S.active].name}`, S.phase === "mulligan" ? "" : "Stand & Draw");
  }
}
let bannerT;
function showBanner(text, sub) {
  $("#bannerText").innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
  const b = $("#banner");
  b.hidden = false; b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
  clearTimeout(bannerT); bannerT = setTimeout(() => (b.hidden = true), 1150);
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

// ---------- animations (2026-11-13) ----------
// Every card on the table keeps its element (data-uid). Before a redraw we note where each card is; after it we slide
// cards that moved from the old spot to the new one, and fly cards that left the table into the zone they went to.
// Battle moments (attack, hit, guard, triggers, ride) are read from new log lines. Only transform / opacity animate.
// Players who prefer reduced motion get no animations.
const FX = (() => {
  const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  let layer = null, svg = null, prev = null, prevWhere = new Map(), lastN = 0, lastView = null, lastBattle = "", pow = new Map();
  function ensure() {
    if (layer) return;
    layer = document.createElement("div"); layer.id = "fx"; layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.id = "fxsvg"; svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = `<defs><marker id="fxah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs><path class="atkline" marker-end="url(#fxah)"/>`;
    document.body.appendChild(svg);
  }
  const tracked = () => document.querySelectorAll(".table [data-uid]");
  const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  // where every card is (by uid): "pi:zone" or "pi:slot:key"; used to find where an unseen card came from / went to
  function whereMap(S) {
    const m = new Map();
    S.players.forEach((p, pi) => {
      for (const z of ["deck", "hand", "soul", "drop", "damage", "bind", "removed", "ride", "orderZone", "gDeck", "gUp", "automod", "crest"])
        for (const c of p[z] || []) m.set(String(c.uid), `${pi}:${z}`);
      for (const [k, s] of Object.entries(p.slots)) if (s && s.card) {
        m.set(String(s.card.uid), `${pi}:slot:${k}`);
        if (s.heart) m.set(String(s.heart.uid), `${pi}:slot:${k}`);
      }
    });
    if (S.battle) for (const c of S.battle.guards) m.set(String(c.uid), `${1 - S.active}:gc`);
    if (S.checking) m.set(String(S.checking.card.uid), `${S.checking.pi}:trig`);
    return m;
  }
  // the element that stands for a zone on the screen
  function zoneEl(w) {
    if (!w) return null;
    const [pi, z, key] = w.split(":");
    const root = +pi === view() ? $("#me") : $("#opp"), P = root && root._parts;
    if (!P) return null;
    switch (z) {
      case "slot": return P.slots[key] || null;
      case "deck": return P.deck;
      case "ride": return P.ride.hidden ? P.deck : P.ride;
      case "drop": return P.drop;
      case "soul": return P.slots.vc;
      case "damage": return P.damage[0].parentElement;
      case "orderZone": return P.order.parentElement;
      case "trig": return P.trig;
      case "gc": return $("#gc");
      case "hand": return +pi === view() ? $("#hand") : P.plate;
      default: return P.plate; // bind, removed, G zone, AutoMOD, crest
    }
  }
  // screen delta → the element's own (maybe rotated) coordinates, so a rested card slides straight
  function local(el, dx, dy) {
    const t = getComputedStyle(el).transform;
    if (!t || t === "none") return [dx, dy];
    const m = t.match(/matrix\(([^)]+)\)/);
    if (!m) return [dx, dy];
    const [a, b, c, d] = m[1].split(",").map(Number), det = a * d - b * c || 1;
    return [(d * dx - c * dy) / det, (-b * dx + a * dy) / det];
  }
  function fly(el, from, to, ms = 420) {
    const [fx, fy] = center(from), [tx, ty] = center(to);
    const s = Math.max(0.25, Math.min(3, from.width / (to.width || 1)));
    const [lx, ly] = local(el, fx - tx, fy - ty);
    try { el.animate([{ transform: `translate(${lx}px,${ly}px) scale(${s})` }, { transform: "translate(0,0) scale(1)" }], { duration: ms, easing: EASE, composite: "add" }); } catch { /* old browser */ }
  }
  function ghost(o, to) {
    const g = o.el;
    if (!g || g.isConnected) return;
    const r = o.r, [fx, fy] = center(r), [tx, ty] = center(to);
    g.style.position = "fixed"; g.style.left = r.left + "px"; g.style.top = r.top + "px"; g.style.width = r.width + "px"; g.style.height = r.height + "px";
    g.style.margin = "0"; g.classList.remove("rest"); g.classList.add("ghost");
    layer.appendChild(g);
    const s = Math.max(0.2, Math.min(1, (to.width || r.width) / r.width));
    const a = g.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${tx - fx}px,${ty - fy}px) scale(${s})`, opacity: 0.15 }], { duration: 520, easing: EASE });
    a.onfinish = a.oncancel = () => g.remove();
  }
  // a word that pops over a spot ("HIT!", "★ CRITICAL TRIGGER"…)
  function burst(text, el, color, big) {
    if (!el) return;
    const [x, y] = center(el.getBoundingClientRect());
    const b = document.createElement("div");
    b.className = "fxb" + (big ? " big" : "");
    b.textContent = text;
    b.style.left = x + "px"; b.style.top = y + "px"; b.style.setProperty("--c", color);
    layer.appendChild(b);
    setTimeout(() => b.remove(), 1100);
  }
  function ring(el, color) {
    if (!el) return;
    const r = el.getBoundingClientRect(), [x, y] = center(r);
    const d = document.createElement("div");
    d.className = "fxring"; d.style.left = x + "px"; d.style.top = y + "px";
    d.style.width = d.style.height = Math.max(r.width, r.height) * 1.2 + "px"; d.style.setProperty("--c", color);
    layer.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
  function shake(el) {
    if (!el) return;
    try { el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], { duration: 380, composite: "add" }); } catch { /* */ }
  }
  const slotEl = (pi, key) => { const r = +pi === view() ? $("#me") : $("#opp"); return r && r._parts ? r._parts.slots[key] : null; };
  const cardIn = (el) => (el && el.querySelector(":scope > .card")) || el;
  // the attack arrow: from the attacker to the unit it attacks, while the battle lasts
  function arrow(S) {
    const path = svg.querySelector(".atkline");
    const b = S.battle;
    const a = b && slotEl(S.active, b.att), t = b && slotEl(1 - S.active, b.tgt);
    if (!a || !t) { svg.classList.remove("on"); path.removeAttribute("d"); return; }
    const [ax, ay] = center(a.getBoundingClientRect()), [tx, ty] = center(t.getBoundingClientRect());
    const mx = (ax + tx) / 2 + (ty - ay) * 0.12, my = (ay + ty) / 2 - (tx - ax) * 0.12;
    path.setAttribute("d", `M${ax},${ay} Q${mx},${my} ${tx},${ty}`);
    svg.classList.add("on");
  }
  const TRIG_COLOR = { crit: "#f2b94b", draw: "#5fd0ff", front: "#ff8a5c", heal: "#6fd39a", stand: "#b896ff", over: "#ff5fa2" };
  return {
    // call before a redraw
    before() {
      if (reduced() || !layer) { prev = null; return; }
      prev = new Map();
      for (const el of tracked()) { const r = el.getBoundingClientRect(); if (r.width && !prev.has(el.dataset.uid)) prev.set(el.dataset.uid, { r, el }); }
    },
    // call after a redraw
    after(S) {
      ensure();
      const v = view(), where = whereMap(S);
      const newGame = (S.logN || 0) < lastN;
      const switched = lastView !== null && v !== lastView; // hot-seat: the table turned to the other player, nothing "moved"
      lastView = v;
      if (prev && !switched && !newGame) {
        const now = new Map();
        for (const el of tracked()) if (!now.has(el.dataset.uid)) now.set(el.dataset.uid, el);
        for (const [uid, el] of now) {
          const old = prev.get(uid);
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          let from = old && old.el !== el ? old.r : old ? old.r : null;
          if (!old) { const z = zoneEl(prevWhere.get(uid)); from = z ? z.getBoundingClientRect() : null; }
          if (from && (Math.abs(from.left - r.left) > 3 || Math.abs(from.top - r.top) > 3)) fly(el, from, r);
        }
        for (const [uid, o] of prev) if (!now.has(uid)) { const z = zoneEl(where.get(uid)); if (z) ghost(o, z.getBoundingClientRect()); }
      }
      prev = null;
      prevWhere = where;
      // battle moments from the log lines written since the last redraw
      const n = Math.min(S.log.length, Math.max(0, (S.logN || 0) - lastN));
      lastN = S.logN || 0;
      if (!reduced() && !switched && !newGame && n) {
        const fresh = S.log.slice(0, n).reverse();
        const ai = S.active;
        for (const line of fresh) {
          if (/→ HIT!/.test(line) && S.battle) { const t = slotEl(1 - ai, S.battle.tgt); burst("HIT!", t, "#ff5f6d", true); shake(cardIn(t)); }
          else if (/→ guarded/.test(line)) burst("GUARD", $("#gc"), "#5fd0ff", true);
          else if (/Persona Ride!/.test(line)) { burst("PERSONA RIDE", slotEl(ai, "vc"), "#f2b94b", true); ring(slotEl(ai, "vc"), "#f2b94b"); }
          else if (/ rides /.test(line)) ring(slotEl(ai, "vc"), "#5fd0ff");
          else if (/ strides /i.test(line)) { burst("STRIDE", slotEl(ai, "vc"), "#b896ff", true); ring(slotEl(ai, "vc"), "#b896ff"); }
          else {
            const m = line.match(/^(\S+) (Critical|Draw|Front|Heal|Stand|Over) trigger!/);
            if (m) {
              const t = Object.keys(TRIG_COLOR).find((k) => TRIG[k] && TRIG[k].name === m[2]) || m[2].toLowerCase();
              const who = S.checking ? S.checking.pi : ai;
              const root = who === v ? $("#me") : $("#opp");
              burst(`${m[1]} ${m[2].toUpperCase()}!`, root && root._parts ? root._parts.trig : null, TRIG_COLOR[t] || "#f2b94b", true);
            }
          }
        }
      }
      // the attacker lunges toward its target once per attack
      const bk = S.battle ? `${S.battleNo || 0}:${S.active}:${S.battle.att}:${S.battle.tgt}` : "";
      if (bk && bk !== lastBattle && !reduced() && !switched) {
        const a = cardIn(slotEl(S.active, S.battle.att)), t = slotEl(1 - S.active, S.battle.tgt);
        if (a && t) {
          const [ax, ay] = center(a.getBoundingClientRect()), [tx, ty] = center(t.getBoundingClientRect());
          const [lx, ly] = local(a, (tx - ax) * 0.22, (ty - ay) * 0.22);
          try { a.animate([{ transform: "translate(0,0)" }, { transform: `translate(${lx}px,${ly}px)`, offset: 0.4 }, { transform: "translate(0,0)" }], { duration: 480, easing: "ease-out", composite: "add" }); } catch { /* */ }
        }
      }
      lastBattle = bk;
      arrow(S);
      // power that changed on a circle pops for a moment
      S.players.forEach((p, pi) => Object.entries(p.slots).forEach(([k, s]) => {
        const id = `${pi}:${k}`;
        if (!s || !s.card) { pow.delete(id); return; }
        const val = `${s.card.uid}:${Game.power(pi, k)}:${Game.crit(pi, k)}`, was = pow.get(id);
        pow.set(id, val);
        if (!was || was.split(":")[0] !== String(s.card.uid) || was === val || reduced() || switched) return;
        const cp = slotEl(pi, k) && slotEl(pi, k).querySelector(".cs");
        if (cp) { cp.classList.remove("pop"); void cp.offsetWidth; cp.classList.add("pop"); }
      }));
    },
    reset() { prev = null; prevWhere = new Map(); lastN = 0; lastView = null; lastBattle = ""; pow = new Map(); if (layer) layer.innerHTML = ""; },
  };
})();
// Drive / damage checks and battle results wait a moment on screen so both players can follow them
Game.setPace((kind) => new Promise((ok) => setTimeout(ok, document.hidden || FX_FAST() ? 60 : kind === "check" ? 650 : 420)));
function FX_FAST() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || !!ui.test; }

// ---------- full render ----------
function render() {
  const S = Game.state();
  if (!S) return;
  if (ui.hotseat && ui.shown !== S.controller && S.winner === null) return showCurtain();
  $("#curtain").hidden = true;
  const v = view();
  preloadPictures(); // cheap after the first time: every picture is already in the cache
  FX.before();
  placePlates();
  if (infoDock() && infoEl().hidden && !infoUid) { infoEl().innerHTML = infoPanel(null); infoEl().hidden = false; }
  renderSide($("#opp"), 1 - v, "opp");
  renderSide($("#me"), v, "me");

  renderRail(S);
  let mid = S.battle ? `<small>ATTACK</small><b>${fmt(Game.attackPower())}</b>` : "";
  const gsh = S.battle ? S.battle.guards.reduce((n, c) => n + (c.shield || 0), 0) : 0;
  setHTML($("#def"), S.battle ? `<small>DEFENSE</small><b>${fmt(Game.defensePower())}</b>${gsh ? `<span class="gsh">🛡 +${fmt(gsh)} guard</span>` : ""}${S.battle.perfect ? `<span class="perfect">🛡 Can't be hit</span>` : ""}` : "");
  // revealed cards (drive / damage checks): beside the table, as small pictures you can point at; inline only when there's no side room
  const rb = $("#revealBox");
  const side = window.innerWidth - (document.querySelector(".mat") ? document.querySelector(".mat").getBoundingClientRect().right : window.innerWidth) >= 150;
  if (rb) {
    rb.hidden = !(S.reveal.length && side);
    setHTML(rb, S.reveal.length && side ? `<small>REVEALED</small>${S.reveal.slice(-6).map((r) => `<div class="rvc${r.card.trigger ? " rt" : ""}">${cardHTML(r.card, {}, null, null, " mini")}<span>${r.type}${r.card.trigger && TRIG[r.card.trigger] ? " " + TRIG[r.card.trigger].icon : ""}</span></div>`).join("")}` : "");
  }
  if (S.reveal.length && !side) mid += `<span class="reveal">${S.reveal.map((r) => `<span class="rv ${r.card.trigger ? "rt" : ""}">${r.type}: ${esc(r.card.name)} ${r.card.trigger ? TRIG[r.card.trigger].icon : ""}</span>`).join("")}</span>`;
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
  const hEl = $("#rail .ph-hint"), hTxt = ($("#actions .hint") || {}).textContent || "";
  if (hEl && hEl.textContent !== hTxt) hEl.textContent = hTxt;
  if (!$("#logDrawer").hidden) setHTML($("#log"), S.log.map((l) => `<li>${esc(l)}</li>`).join(""));
  renderPending(S, v);
  renderJudge(S, v);
  if (ui.test) renderTest(S);
  $("#win").hidden = S.winner === null;
  if (S.winner !== null) $("#winText").textContent = S.winner < 0 ? "Draw game!" : `${S.players[S.winner].name} wins!`;
  if (S.winner !== null) reportMatch(S); else if (!$("#winCoins").hidden) $("#winCoins").hidden = true;
  if (ui.online) $("#winBtn").textContent = ONLINE === "host" ? "Rematch" : "Waiting for the host…";
  FX.after(S);
}
// the player plates sit beside the mats when the screen has room on the right; otherwise inside the mat (between order and damage)
function placePlates() { document.body.classList.add("plate-out"); }

// ---------- coins from online matches (supabase/004_matches.sql) ----------
// Both players report; the server pays when both agree. Hot-seat games never pay (one person could play both sides).
const reported = new Set();
function reportMatch(S) {
  const box = $("#winCoins"), m = ui.online && typeof Net !== "undefined" ? Net.match : null;
  const me = Auth.get();
  if (!m || !me || me.guest) { box.hidden = !ui.hotseat || !me || me.guest; box.textContent = "Local games don't give coins. Play online to earn coins."; return; }
  if (reported.has(m.id)) return;
  reported.add(m.id);
  const seat = ui.online.seat, opp = m.uids[1 - seat];
  box.hidden = false;
  if (!opp) { box.textContent = "No coins: your opponent is playing as a guest."; return; }
  const winner = S.winner < 0 ? null : m.uids[S.winner];
  box.textContent = "◈ Checking the result with the server…";
  let tries = 0;
  const ask = async () => {
    try {
      const r = await Cloud.rpc("report_match", { match: m.id, opponent: opp, winner, turns: S.turn });
      if (r.status === "waiting" && ++tries < 6) { box.textContent = "◈ Waiting for your opponent to confirm the result…"; return setTimeout(ask, 2500 * tries); }
      Auth.set({ ...Auth.get(), coins: r.balance });
      box.textContent = r.status === "paid" ? (r.coins ? `◈ +${r.coins} coins (you have ${r.balance.toLocaleString()})` : r.capped ? "No coins: you reached today's limit of rewarded matches." : "◈ +0 coins")
        : r.status === "short" ? "No coins: the game was too short (under 3 turns)."
        : r.status === "mismatch" ? "No coins: the two players reported different results."
        : "Your opponent didn't confirm the result, so no coins this time.";
    } catch (e) { box.textContent = "Couldn't reach the server for coins: " + (e.message || e); }
  };
  ask();
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
    if (Game.canGGuard(v)) h += b("gguard", "G guard", "on");
    return h + b("confirm", "Done guarding ▶", "go");
  }
  if (!isActive) return "";
  let h = "";
  if (S.phase === "stride") {
    return hint("Stride step: put a G unit on your vanguard (discard grade 3+)") + b("stride", "Stride ⇧", "go") + b("skipStride", "Skip stride", "ghost");
  }
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
    if (selCard && selCard.dress && Game.dressTargets(S.active, selCard).length) h += b("dress", ui.mode === "dress" ? "Tap a rear-guard to overDress" : `overDress ${esc(selCard.name)}`, ui.mode === "dress" ? "on" : "go");
    if (selCard && selCard.xoverDress) h += b("xdress", `XoverDress ${esc(selCard.name)}`, "go");
    Game.zoneActs(S.active).forEach((a) => (h += b("zact", "ACT: " + esc(a.text.slice(0, 70)), a.ready ? "on" : "off", `data-uid="${a.uid}" data-i="${a.i}" title="${esc(a.text)}"`)));
    Game.orderZoneActs(S.active).forEach((a) => (h += b("ozact", "ACT: " + esc(a.text.slice(0, 70)), a.ready ? "on" : "off", `data-uid="${a.uid}" data-i="${a.i}" title="${esc(a.text)}"`)));
    if (ui.unitSel) {
      Game.actList(S.active, ui.unitSel).forEach((a) => (h += b("actv", "ACT: " + esc(a.text.slice(0, 70)), a.ready ? "on" : "off", `data-i="${a.i}" data-src="${a.src || 0}" title="${esc(a.text)}"`)));
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

// A choice whose options are all units on the field ("0:fl", "1:vc"…) is made by clicking the circles themselves;
// a slim bar shows the question (and Confirm when several are picked). "Show list" opens the usual window.
function fieldPickIds(S, v) {
  const p = S && S.pending;
  if (!p || p.player !== v || S.judge || ui.listOpen) return null;
  return p.options.length && p.options.every((o) => /^[01]:[a-z0-9]+$/.test(String(o.id))) ? new Set(p.options.map((o) => String(o.id))) : null;
}
function renderPickBar(S, v) {
  let bar = $("#pickbar");
  const ids = fieldPickIds(S, v), p = S.pending;
  document.body.classList.toggle("field-pick", !!ids);
  if (!ids) { if (bar) bar.hidden = true; return false; }
  if (!bar) { bar = document.createElement("div"); bar.id = "pickbar"; bar.className = "pickbar"; document.body.appendChild(bar); }
  bar.hidden = false;
  const multi = !(p.min === 1 && p.max === 1);
  setHTML(bar, `<span class="pb-q">${esc(p.prompt)}</span><small>Click a glowing circle${multi ? ` · ${ui.pick.size} picked (${p.min === p.max ? p.max : p.min + "–" + p.max})` : ""}</small>
    ${multi ? `<button class="go" data-pickok ${ui.pick.size < p.min ? "disabled" : ""}>Confirm</button>` : ""}<button class="ghost" data-picklist>Show list</button>`);
  return true;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-pickok]")) { $("#choiceOk").click(); return; }
  if (e.target.closest("[data-picklist]")) { ui.listOpen = true; render(); }
});
function renderPending(S, v) {
  const p = S.pending;
  if (!p || p.player !== v || S.judge) { $("#choice").hidden = true; ui.pick.clear(); ui.listOpen = false; renderPickBar(S, v); return; } // a manual effect is answered in the Judge panel
  // a new prompt starts with nothing picked (picks never carry over from an earlier prompt)
  const key = p.prompt + "|" + p.options.map((o) => o.id).join(",");
  if (ui.pendingKey !== key) { ui.pendingKey = key; ui.pick.clear(); ui.listOpen = false; }
  if (renderPickBar(S, v)) { $("#choice").hidden = true; return; }
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
  const pickIds = myMove() ? fieldPickIds(S, v) : null;
  if (pickIds) { const id = `${side === "me" ? v : 1 - v}:${key}`; if (pickIds.has(id)) onOpt(id); return; }
  if (S.winner !== null || S.pending || !myMove()) return;
  if (S.battle) { if (v !== S.active && side === "me") act(Game.intercept(key)); return; }
  if (v !== S.active || side !== "me" && S.phase !== "battle") return;
  if (S.phase === "ride") {
    if (side === "me" && key === "vc" && ui.sel) { const id = ui.sel; ui.sel = null; act(Game.rideFromHand(id)); }
    return;
  }
  if (S.phase === "main") {
    if (ui.sel && ui.mode === "dress") { const id = ui.sel; ui.sel = null; ui.mode = null; return act(Game.overDress(id, key)); }
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
  if (ui.mode === "dress") ui.mode = null; // a new selection cancels a pending overDress
  render();
}
function onAction(a, el) {
  switch (a) {
    case "mull": { const ids = [...ui.mull]; ui.mull = new Set(); return act(Game.mulligan(ids)); }
    case "ride": ui.mode = "rideDiscard"; ui.sel = null; return render();
    case "skipRide": return act(Game.skipRide());
    case "cancel": ui.mode = null; ui.attacker = null; return render();
    case "play": { const id = ui.sel; ui.sel = null; return act(Game.playOrder(id)); }
    case "actv": return act(Game.activate(ui.unitSel, /^\d+$/.test(el.dataset.i) ? +el.dataset.i : el.dataset.i, +(el.dataset.src || 0)));
    case "zact": return act(Game.activateZone(+el.dataset.uid, +el.dataset.i));
    case "ozact": return act(Game.activateOrderZone(+el.dataset.uid, +el.dataset.i));
    case "dress": ui.mode = ui.mode === "dress" ? null : "dress"; return render();
    case "xdress": { const id = ui.sel; ui.sel = null; ui.mode = null; return act(Game.xoverDress(id)); }
    case "egdraw": return act(Game.energyDraw());
    case "stride": return act(Game.stride());
    case "skipStride": return act(Game.skipStride());
    case "gguard": return act(Game.gGuard());
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
  if (!p || !p.options.some((o) => String(o.id) === String(id))) return; // only this prompt's options
  if (p.min === 1 && p.max === 1) { ui.pick.clear(); return act(Promise.resolve(Game.answer([parseId(id)]))); }
  ui.pick.has(id) ? ui.pick.delete(id) : ui.pick.size < p.max && ui.pick.add(id);
  render();
}
const parseId = (id) => (/^\d+$/.test(id) ? +id : id);
function showZone(z) {
  const [pi, zone] = z.split(":");
  const S = Game.state(), pl = S.players[+pi];
  const cards = zone === "gzone" ? [...(pl.gUp || []), ...(+pi === view() ? (pl.gDeck || []) : [])] : pl[zone];
  const label = zone === "orderZone" ? "order zone" : zone === "gzone" ? `G zone: ${(pl.gUp || []).length} face up${+pi === view() ? `, ${(pl.gDeck || []).length} face down` : ""}` : zone;
  $("#zoneTitle").textContent = `${pl.name}: ${label} (${cards.length})`;
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
// ---------- card detail panel: read any card's abilities at any time ----------
// Wide screens: docked on the left (the empty strip beside the table), always visible, shows the last card you pointed at.
// Right-click (long press on touch) pins a card so it stays while you act; ✕ / Esc unpins. Narrow screens: an overlay while hovering or pinned.
let infoT;
let infoUid = null, infoPinned = null;
const infoEl = () => $("#info");
function infoDock() {
  const board = document.querySelector(".table .mat, .mat");
  const free = board ? board.getBoundingClientRect().left - 24 : 0;
  const dock = document.body.classList.contains("game") && free >= 200;
  document.body.classList.toggle("info-dock", dock);
  if (dock) document.body.style.setProperty("--infoW", Math.min(340, Math.floor(free)) + "px");
  return dock;
}
function showInfo(uid, pinned = false) {
  const c = seen.get(+uid);
  if (!c) return;
  infoDock();
  if (pinned) infoPinned = String(uid);
  infoUid = String(uid);
  const head = infoPinned ? `<div class="info-pin">📌 Pinned <button type="button" data-unpin title="Unpin (Esc)">✕</button></div>` : "";
  infoEl().innerHTML = head + infoPanel(c);
  infoEl().hidden = false;
  infoEl().classList.toggle("pinned", !!infoPinned);
}
function unpinInfo() {
  infoPinned = null;
  infoEl().classList.remove("pinned");
  if (infoDock() && infoUid) showInfo(infoUid); else infoEl().hidden = true;
}
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-uid]");
  clearTimeout(infoT);
  if (infoPinned) return; // a pinned card stays until you unpin it
  if (el && seen.has(+el.dataset.uid)) { if (infoUid !== el.dataset.uid || infoEl().hidden) showInfo(el.dataset.uid); }
  else if (!infoDock()) infoT = setTimeout(() => (infoEl().hidden = true), 250); // docked: keep the last card
});
document.addEventListener("contextmenu", (e) => {
  const el = e.target.closest("[data-uid]");
  if (!el || !seen.has(+el.dataset.uid)) return;
  e.preventDefault();
  if (infoPinned === el.dataset.uid) unpinInfo(); else showInfo(el.dataset.uid, true);
});
let pressT = null;
document.addEventListener("touchstart", (e) => {
  const el = e.target.closest("[data-uid]");
  if (!el || !seen.has(+el.dataset.uid)) return;
  pressT = setTimeout(() => { showInfo(el.dataset.uid, true); pressT = null; }, 500); // long press = pin
}, { passive: true });
["touchend", "touchmove", "touchcancel"].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(pressT); pressT = null; }, { passive: true }));
document.addEventListener("click", (e) => { if (e.target.closest("[data-unpin]")) { e.stopPropagation(); unpinInfo(); } }, true);
window.addEventListener("resize", () => { if (infoDock() && infoEl().hidden && infoUid) showInfo(infoUid); if (Game.state()) scheduleRender(); });
// ---------- Judge panel: do card text by hand (Manual blocks), or fix a mistake in hot-seat ----------
// Online it only works while a Manual effect is open (both players see what was done in the log).
const J = { pi: null, uid: null };
const judgeAllowed = (S) => !!S && S.winner === null && (!ui.online || !!S.judge);
function renderJudge(S, v) {
  const box = $("#judge");
  $("#judgeBtn").hidden = !judgeAllowed(S);
  if (S.judge && judgeAllowed(S) && box.hidden && !J.auto) { box.hidden = false; J.auto = true; J.pi = S.judge.by; }
  if (!S.judge && J.auto) { J.auto = false; box.hidden = true; } // opened for a manual effect → closes after Done
  if (box.hidden || !judgeAllowed(S)) { if (!judgeAllowed(S)) box.hidden = true; return; }
  if (J.pi === null) J.pi = v;
  const p = S.players[J.pi];
  const cardBtn = (c, where) => `<button class="jc${J.uid === c.uid ? " on" : ""}" data-juid="${c.uid}" title="${esc(where)}">${c.hidden ? "?" : esc(c.name)}${c.down ? " (face down)" : ""}</button>`;
  const zone = (label, cards, open = true) => `<details ${open ? "open" : ""}><summary>${label} (${cards.length})</summary><div class="jrow">${cards.map((c) => cardBtn(c, label)).join("") || '<span class="muted">empty</span>'}</div></details>`;
  const field = Game.unitsOf(J.pi).filter((k) => p.slots[k]).map((k) => {
    const sl = p.slots[k];
    return `<div class="junit"><b>${esc(k.toUpperCase())}</b> ${cardBtn(sl.card, "field")} <small>${fmt(Game.power(J.pi, k))}${sl.rest ? " · rest" : ""}${sl.locked ? " · locked" : ""}</small>
      <button data-jop="power" data-k="${k}" data-a="5000">+5k</button><button data-jop="power" data-k="${k}" data-a="-5000">−5k</button>
      <button data-jop="crit" data-k="${k}" data-a="1">★+1</button><button data-jop="crit" data-k="${k}" data-a="-1">★−1</button>
      <button data-jop="rest" data-k="${k}" data-a="${sl.rest ? 0 : 1}">${sl.rest ? "Stand" : "Rest"}</button>${k !== "vc" ? `<button data-jop="lock" data-k="${k}">${sl.locked ? "Unlock" : "Lock"}</button>` : ""}</div>`;
  }).join("");
  const sel = J.uid !== null && [...p.hand, ...p.deck, ...p.drop, ...p.soul, ...p.damage, ...p.bind, ...(p.removed || []), ...(p.orderZone || []), ...(p.gUp || []), ...(p.gDeck || []), ...Game.unitsOf(J.pi).map((k) => p.slots[k] && p.slots[k].card).filter(Boolean)].find((c) => c.uid === J.uid);
  const dests = [["hand", "Hand"], ["deckTop", "Deck top"], ["deckBottom", "Deck bottom"], ["drop", "Drop"], ["soul", "Soul"], ["damage", "Damage ↑"], ["damageDown", "Damage ↓"], ["bind", "Bind"], ["removed", "Removed"], ["orderZone", "Order zone"], ["automod", "AutoMOD"], ...Game.rcOf(J.pi).map((k) => [k, "RC " + k.toUpperCase()])];
  setHTML($("#judgeBody"), `
    ${S.judge ? `<p class="jtask">✋ ${esc(S.judge.text)}</p>${S.pending && S.pending.player === v ? `<div class="jrow"><button class="go" data-opt="done">Done ✓</button><button data-opt="skip">Skip (do nothing)</button></div>` : `<p class="muted">Waiting for ${esc(S.players[S.judge.by].name)} to press Done.</p>`}` : '<p class="muted">Move cards by hand when a card does something the game can\'t. Everything you do is written in the log.</p>'}
    <div class="jtabs">${S.players.map((pl, i) => `<button data-jpi="${i}" class="${J.pi === i ? "on" : ""}">${esc(pl.name)}</button>`).join("")}</div>
    ${sel ? `<div class="jmove"><b>${esc(sel.name)}</b> → ${dests.map(([d, l]) => `<button data-jto="${d}">${l}</button>`).join("")}${p.damage.includes(sel) ? '<button data-jop="flip">Flip</button>' : ""}<button data-jop="cancel">✕</button></div>` : '<p class="muted">Pick a card, then where it goes.</p>'}
    <h4>Field</h4>${field || '<span class="muted">no units</span>'}
    ${zone("Hand", p.hand)}${zone("Drop", p.drop)}${zone("Soul", p.soul, false)}${zone("Damage", p.damage)}${zone("Bind", p.bind, false)}${zone("Removed", p.removed || [], false)}${zone("Order zone", p.orderZone || [], false)}${(p.automod || []).length ? zone("AutoMOD", p.automod, false) : ""}
    ${zone("Deck (top last)", p.deck, false)}
    <div class="jrow"><button data-jop="draw">Draw 1</button><button data-jop="shuffle">Shuffle deck</button>${p.useEnergy ? '<button data-jop="energy" data-a="1">Energy +1</button><button data-jop="energy" data-a="-1">Energy −1</button>' : ""}</div>`);
}
async function judge(op) { const r = await Game.judgeOp({ pi: J.pi, ...op }); if (r && !r.ok) toast(r.msg); render(); }
$("#judge").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.jpi !== undefined) { J.pi = +b.dataset.jpi; J.uid = null; return render(); }
  if (b.dataset.juid !== undefined) { J.uid = J.uid === +b.dataset.juid ? null : +b.dataset.juid; return render(); }
  if (b.dataset.jto) { const uid = J.uid; J.uid = null; return judge({ op: "move", uid, to: b.dataset.jto }); }
  const op = b.dataset.jop;
  if (op === "cancel") { J.uid = null; return render(); }
  if (op === "flip") { const uid = J.uid; J.uid = null; return judge({ op: "flip", uid }); }
  if (op === "power" || op === "crit") return judge({ op, key: b.dataset.k, amount: +b.dataset.a });
  if (op === "rest") return judge({ op, key: b.dataset.k, value: b.dataset.a === "1" });
  if (op === "lock") return judge({ op, key: b.dataset.k });
  if (op === "energy") return judge({ op, amount: +b.dataset.a });
  if (op === "draw" || op === "shuffle") return judge({ op });
});
$("#judgeBtn").addEventListener("click", () => { $("#judge").hidden = !$("#judge").hidden; render(); });
$("#judgeClose").addEventListener("click", () => { $("#judge").hidden = true; });
$("#logBtn").addEventListener("click", () => { $("#logDrawer").hidden = !$("#logDrawer").hidden; render(); });
$("#logClose").addEventListener("click", () => ($("#logDrawer").hidden = true));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { $("#logDrawer").hidden = true; if (infoPinned) unpinInfo(); else if (!document.body.classList.contains("info-dock")) $("#info").hidden = true; } });
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
const TEST = new URLSearchParams(location.search).get("test"); // card id: open the test table for that card
Loader.wait(TEST && !ONLINE ? startTest(TEST) : loadSetup());

// ---------- test table (editor → 🧪 Test this card) ----------
// A solo table: you (seat 0) with the test card ×4 in the deck (or in the G deck), plain filler cards, and a dummy opponent.
// The 🧪 panel puts the card in hand / on VC / on RC, fires any event on any circle, and fills zones. The ⚖ Judge panel does the rest.
const testFiller = () => {
  const u = (g, extra = {}) => ({ id: "test-g" + g + (extra.trigger || ""), name: extra.trigger ? `Test ${TRIG[extra.trigger].name}` : `Test Unit G${g}`,
    grade: g, type: extra.trigger ? "trigger" : "unit", power: [5000, 8000, 10000, 13000][g], shield: g === 3 ? 0 : g === 0 ? 5000 : 5000 + (g === 1 ? 0 : 5000),
    crit: 1, trigger: null, nation: "Test", race: "", image: "", text: "", abilities: [], ...extra });
  return { u, trig: (t) => u(0, { trigger: t, shield: t === "heal" ? 15000 : 10000, power: 5000 }) };
};
function testDeck(card) {
  const { u, trig } = testFiller();
  const isG = card && card.type === "g";
  const main = [];
  if (card && !isG) for (let i = 0; i < 4; i++) main.push(card);
  const add = (c, n) => { for (let i = 0; i < n; i++) main.push(c); };
  add(trig("crit"), 8); add(trig("draw"), 4); add(trig("heal"), 4);
  add(u(1), 12); add(u(2), 11); add(u(3), 50);
  return { name: "Test deck", format: "standard", energy: true, ride: [u(0), u(1), u(2), u(3)], starter: null, main: main.slice(0, 50), g: isG ? [card, card, card] : [] };
}
async function startTest(id) {
  const card = (await DB.all("cards")).find((c) => c.id === id);
  if (!card) { toast("Test card not found. Save it in the editor first."); return loadSetup(); }
  ui.test = { card };
  ui.hotseat = false;
  ui.mats = [Mats.resolve(1, Mats.choice(1)), Mats.resolve(2, Mats.choice(2))];
  Game.newGame(["Tester", "Dummy"], [testDeck(card), testDeck(null)], { first: 0, extras: await DB.extras() });
  Object.assign(ui, { sel: null, mode: null, attacker: null, unitSel: null, mull: new Set(), pick: new Set(), shown: -1 });
  await Game.mulligan([]);
  await Game.mulligan([]);
  $("#setup").hidden = true;
  $("#testBtn").hidden = false;
  $("#testBox").hidden = false;
  document.title = "Test: " + card.name;
  render();
}
const T = { key: "vc", event: "attack", zone: "soul" };
function renderTest(S) {
  if (!ui.test || $("#testBox").hidden || !S) return;
  const p = S.players[0], c = ui.test.card;
  const copies = ["hand", "deck", "drop", "soul", "damage", "bind", "gDeck", "gUp"].flatMap((z) => (p[z] || []).filter((x) => x.id === c.id).map((x) => ({ z, x })));
  const onField = Game.unitsOf(0).filter((k) => p.slots[k] && p.slots[k].card.id === c.id);
  const first = copies[0];
  const where = (z) => ({ hand: "hand", deck: "deck", drop: "drop", soul: "soul", damage: "damage", bind: "bind", gDeck: "G deck", gUp: "G zone" }[z]);
  const circles = Game.unitsOf(0).map((k) => `<option value="${k}" ${T.key === k ? "selected" : ""}>${k.toUpperCase()}${p.slots[k] ? " · " + esc(p.slots[k].card.name) : " (empty)"}</option>`).join("");
  setHTML($("#testBody"), `
    <p class="tt-card"><b>${esc(c.name)}</b><br><span class="muted">${copies.length} cop${copies.length === 1 ? "y" : "ies"} off the field${copies.length ? " (" + [...new Set(copies.map((y) => where(y.z)))].join(", ") + ")" : ""}${onField.length ? " · on " + onField.map((k) => k.toUpperCase()).join(", ") : ""}</span></p>
    <h4>Put the test card</h4>
    <div class="jrow">${first ? `<button data-t="hand" ${first.z === "hand" ? "disabled" : ""}>To hand</button><button data-t="ride">Ride it (VC)</button>
      <select id="ttCallKey">${Game.rcOf(0).map((k) => `<option value="${k}">${k.toUpperCase()}</option>`).join("")}</select><button data-t="call">Call to RC</button>` : '<span class="muted">No copy left off the field. Use the Judge panel to move one back.</span>'}</div>
    <h4>Fire an event</h4>
    <div class="jrow"><select id="ttKey">${circles}</select><select id="ttEvent">${Object.entries(SCHEMA.events).map(([k, v]) => `<option value="${k}" ${T.event === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><button data-t="fire" class="go">Fire</button></div>
    <p class="muted small">Runs that circle's AUTO abilities for the event (as if it happened), then resolves them. Conditions and costs still apply.</p>
    <h4>Set up</h4>
    <div class="jrow">${[["damage", "+1 damage"], ["soul", "+1 soul"], ["drop", "+1 drop"], ["hand", "+1 hand"], ["bind", "+1 bind"]].map(([z, l]) => `<button data-t="fill" data-z="${z}">${l}</button>`).join("")}${p.gDeck.length ? '<button data-t="fill" data-z="gUp">+1 face-up G</button>' : ""}
      <button data-t="fill" data-z="damage" data-n="5">Damage to 5</button><button data-t="opp" data-z="damage">Opponent +1 damage</button><button data-t="energy">Energy +3</button></div>
    <h4>Phase</h4>
    <div class="jrow"><span class="muted">Now: turn ${S.turn}, ${esc(S.phase)}${S.active ? " (dummy's turn)" : ""}</span>${S.phase === "ride" ? '<button data-t="skipRide">Skip ride → main</button>' : ""}${S.phase === "main" && S.active === 0 ? '<button data-t="battle">To battle</button>' : ""}<button data-t="restart">Start over</button></div>
    <p class="muted small">The ⚖ Judge panel moves any card anywhere and changes power, critical, rest/stand. Turn 1 can't attack: end the turn twice to attack. Watch the log (☰) for ✦ ability lines.</p>`);
}
$("#testBody").addEventListener("change", (e) => { if (e.target.id === "ttKey") T.key = e.target.value; if (e.target.id === "ttEvent") T.event = e.target.value; });
$("#testBody").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-t]");
  if (!b || !ui.test) return;
  const S = Game.state(), p = S.players[0], c = ui.test.card;
  const copy = ["hand", "deck", "drop", "soul", "damage", "bind", "gDeck", "gUp"].flatMap((z) => (p[z] || []).filter((x) => x.id === c.id))[0];
  let r;
  switch (b.dataset.t) {
    case "hand": r = await Game.judgeOp({ op: "move", pi: 0, uid: copy.uid, to: "hand" }); break;
    case "ride": r = await Game.testOp({ op: "ride", uid: copy.uid }); break;
    case "call": r = await Game.testOp({ op: "call", uid: copy.uid, key: $("#ttCallKey").value }); break;
    case "fire": T.key = $("#ttKey").value; T.event = $("#ttEvent").value; r = await Game.testOp({ op: "fire", key: T.key, event: T.event }); break;
    case "fill": r = await Game.testOp({ op: "fill", zone: b.dataset.z, n: b.dataset.n ? Math.max(0, +b.dataset.n - p.damage.length) || 0 : 1 }); break;
    case "opp": r = await Game.testOp({ op: "fill", pi: 1, zone: "damage", n: 1 }); break;
    case "energy": for (let i = 0; i < 3; i++) Game.judgeOp({ op: "energy", pi: 0, amount: 1 }); break;
    case "skipRide": r = await Game.skipRide(); break;
    case "battle": r = await Game.toBattle(); break;
    case "restart": location.reload(); return;
  }
  if (r && !r.ok) toast(r.msg);
  render();
});
$("#testBtn").addEventListener("click", () => { $("#testBox").hidden = !$("#testBox").hidden; render(); });
$("#testClose").addEventListener("click", () => { $("#testBox").hidden = true; });
