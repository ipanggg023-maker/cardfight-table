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
  if (!c) return `<p class="muted">Hover a card to see its details.</p>`;
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
      if (pi !== S.active && key === S.battle.tgt) c.push("targeted");
    }
    if (side === "me" && (ui.attacker === key || ui.unitSel === key)) c.push("picked");
    if (opp && ui.attacker && Game.frontOf(pi).includes(key) && p.slots[key]) c.push("can-target");
    if (side === "me" && ui.sel && S.phase === "main" && v === S.active && key !== "vc") c.push("can-drop");
    if (side === "me" && ui.sel && S.phase === "ride" && key === "vc") c.push("can-drop");
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
      ${p.useEnergy ? chip("Energy", p.energy, "en") : ""}${p.bind.length ? chip("Bind", p.bind.length, "", "bind") : ""}${p.removed && p.removed.length ? chip("Removed", p.removed.length, "", "removed") : ""}${(p.orderZone || []).length ? chip("Orders", p.orderZone.length + (p.orderZone.some((c) => c.faceDown) ? ` (${p.orderZone.filter((c) => c.faceDown).length}↓)` : ""), "oz", "orderZone") : ""}${(p.automod || []).length ? chip("AutoMOD", p.automod.length, "am", "automod") : ""}${p.world ? chip("World", esc(p.world), "world") : ""}${(p.crest || []).length ? chip("Crest", p.crest.length, "crest", "crest") : ""}${p.giftType ? chip("Gift", `${p.giftType[0].toUpperCase() + p.giftType.slice(1)} ${(p.giftVariant || {})[p.giftType] || ""}`, "gift") : ""}${(p.gDeck && p.gDeck.length) || (p.gUp && p.gUp.length) ? chip("G zone", `${(p.gDeck || []).length}·${(p.gUp || []).length}↑`, "gz", "gzone") : ""}${opp ? chip("Hand", p.hand.length) : ""}</div>`);
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
    const ph = S.phase === "stride" ? "ride" : S.phase;
    const i = PHASES.findIndex(([x]) => x === ph), j = PHASES.findIndex(([x]) => x === k);
    return `<span class="${k === (S.phase === "stride" ? "ride" : S.phase) ? "on" : j < i ? "done" : ""}">${l}</span>`;
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
  if (!$("#logDrawer").hidden) setHTML($("#log"), S.log.map((l) => `<li>${esc(l)}</li>`).join(""));
  renderPending(S, v);
  renderJudge(S, v);
  if (ui.test) renderTest(S);
  $("#win").hidden = S.winner === null;
  if (S.winner !== null) $("#winText").textContent = S.winner < 0 ? "Draw game!" : `${S.players[S.winner].name} wins!`;
  if (S.winner !== null) reportMatch(S); else if (!$("#winCoins").hidden) $("#winCoins").hidden = true;
  if (ui.online) $("#winBtn").textContent = ONLINE === "host" ? "Rematch" : "Waiting for the host…";
}

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

function renderPending(S, v) {
  const p = S.pending;
  if (!p || p.player !== v || S.judge) { $("#choice").hidden = true; ui.pick.clear(); return; } // a manual effect is answered in the Judge panel
  // a new prompt starts with nothing picked (picks never carry over from an earlier prompt)
  const key = p.prompt + "|" + p.options.map((o) => o.id).join(",");
  if (ui.pendingKey !== key) { ui.pendingKey = key; ui.pick.clear(); }
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
window.addEventListener("resize", () => { if (infoDock() && infoEl().hidden && infoUid) showInfo(infoUid); });
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
