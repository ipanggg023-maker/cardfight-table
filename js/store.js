// Store: open packs (gacha) with coins, see your collection; admins manage boxes and game settings.
// Everything about coins and rolls happens on the server (supabase/003_store.sql: open_pack, RLS).
const RAR = ["C", "R", "RR", "RRR", "SP", "SEC"];
const st = { cards: {}, boxes: [], boxCards: {}, owned: {}, settings: null, edit: null, last: null, busy: false };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const me = Auth.get();
const account = !!me && !me.guest;
const isAdmin = () => Auth.isAdmin();
let toastT;
function toast(m, bad) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.toggle("bad", !!bad);
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}
const fail = (e) => toast((e && e.message) || String(e), true);

// pictures: card.image, then the web copy, then the name
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.closest(".pic")) return;
  if (img.dataset.alt) { img.src = img.dataset.alt; img.dataset.alt = ""; return; }
  img.replaceWith(Object.assign(document.createElement("span"), { className: "noimg", textContent: img.alt || "No image" }));
}, true);
function pic(id) {
  const c = st.cards[id];
  if (!c) return `<span class="pic"><span class="noimg">Deleted card</span></span>`;
  const alt = c.source && c.source.imageWeb && c.source.imageWeb !== c.image ? c.source.imageWeb : "";
  const src = c.image || alt;
  return `<span class="pic">${src ? `<img src="${esc(src)}" data-alt="${esc(src === alt ? "" : alt)}" alt="${esc(c.name)}" decoding="async">` : `<span class="noimg">${esc(c.name)}</span>`}</span>`;
}
const cardName = (id) => (st.cards[id] ? st.cards[id].name : "Deleted card");

// ---------- loading ----------
async function every(make) { // all rows of a query, 1000 at a time
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
async function load() {
  const cl = await Cloud.client();
  await Cloud.refresh().catch(() => {});
  st.cards = Object.fromEntries((await DB.all("cards")).map((c) => [c.id, c]));
  st.boxes = await every(() => cl.from("boxes").select("*").order("sort").order("id"));
  st.boxCards = {};
  let bcRows;
  try { bcRows = await every(() => cl.from("box_cards").select("box_id, card_id, rarity, qty")); }
  catch { bcRows = await every(() => cl.from("box_cards").select("box_id, card_id, rarity")); st.noDecks = true; } // 007_store_decks.sql not run yet
  for (const r of bcRows) (st.boxCards[r.box_id] = st.boxCards[r.box_id] || []).push(r);
  st.myDecks = await DB.all("decks").catch(() => []);
  st.owned = Object.fromEntries((await every(() => cl.from("collection").select("card_id, count").eq("owner", me.id))).map((r) => [r.card_id, r.count]));
  const { data: set } = await cl.from("app_settings").select("*").eq("id", 1).maybeSingle();
  st.settings = set;
}
function coins() { return (Auth.get() || {}).coins || 0; }
function paintCoins() { $("#coins").textContent = `◈ ${coins().toLocaleString()}`; mountUserChip(); }

// ---------- tabs ----------
document.querySelectorAll("[data-stab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.stab)));
function showTab(t) {
  document.querySelectorAll("[data-stab]").forEach((x) => x.classList.toggle("on", x.dataset.stab === t));
  document.querySelectorAll(".stab").forEach((s) => (s.hidden = s.id !== "s-" + t));
  ({ shop: renderShop, mine: renderMine, boxes: renderBoxList, settings: renderSettings })[t]();
}

// ---------- Store ----------
// chance of each rarity per normal slot, counting only rarities this box has cards for
function odds(box) {
  const have = new Set((st.boxCards[box.id] || []).map((r) => r.rarity));
  const rs = RAR.filter((r) => have.has(r));
  const total = rs.reduce((a, r) => a + Math.max(0, +box.rates[r] || 0), 0);
  return rs.map((r) => [r, total ? (Math.max(0, +box.rates[r] || 0) / total) * 100 : 100 / rs.length]);
}
const kindOf = (b) => (b.kind === "deck" ? "deck" : "booster");
function renderShop() {
  paintCoins();
  const list = st.boxes.filter((b) => b.active || isAdmin());
  if (!list.length) { $("#boxGrid").innerHTML = `<p class="muted">Nothing in the Store yet.${isAdmin() ? " Make a product in Manage boxes." : ""}</p>`; return; }
  const boosters = list.filter((b) => kindOf(b) === "booster"), decks = list.filter((b) => kindOf(b) === "deck");
  $("#boxGrid").innerHTML = `<section class="shop-sec"><h2>Booster packs <small class="muted">${boosters.length}</small></h2>
      <div class="box-row">${boosters.map(boosterHTML).join("") || `<p class="muted">No booster packs yet.</p>`}</div></section>
    <section class="shop-sec"><h2>Decks <small class="muted">${decks.length}</small></h2>
      <div class="box-row">${decks.map(deckHTML).join("") || `<p class="muted">No decks for sale yet.</p>`}</div></section>`;
}
// a deck product: the whole deck at once (every card added to your collection, and the deck copied into your decks)
function deckHTML(b) {
  const cs = st.boxCards[b.id] || [];
  const total = cs.reduce((n, r) => n + (+r.qty || 1), 0);
  const d = b.deck || {};
  const cover = b.cover && st.cards[b.cover] ? b.cover : (d.ride && d.ride[3]) || (cs[0] && cs[0].card_id);
  const fmtName = (typeof FORMATS !== "undefined" && FORMATS[d.format] && FORMATS[d.format].label) || d.format || "";
  const list = cs.slice().sort((a, c) => (st.cards[c.card_id] ? st.cards[c.card_id].grade : 0) - (st.cards[a.card_id] ? st.cards[a.card_id].grade : 0))
    .map((r) => `<li><span>${+r.qty || 1}×</span> ${esc(cardName(r.card_id))}</li>`).join("");
  return `<article class="box deckbox${b.active ? "" : " off"}">
      <div class="box-cover">${cover ? pic(cover) : `<span class="pic"><span class="noimg">${esc(b.name)}</span></span>`}<span class="tag deck">DECK</span>${b.active ? "" : `<span class="tag">Hidden from players</span>`}</div>
      <div class="box-info">
        <h3>${esc(b.name)}</h3>
        ${b.description ? `<p class="muted">${esc(b.description)}</p>` : ""}
        <p class="box-meta">${total} cards${d.ride && d.ride.filter(Boolean).length ? " · ride deck included" : ""}${fmtName ? " · " + esc(fmtName) : ""}</p>
        <details class="rates"><summary>Deck list</summary><ul class="decklist">${list}</ul></details>
        <div class="box-buy"><button class="go" data-buydeck="${b.id}" ${coins() < b.price || !cs.length ? "disabled" : ""}>Buy deck · ◈ ${b.price.toLocaleString()}</button></div>
      </div></article>`;
}
function boosterHTML(b) {
    const cs = st.boxCards[b.id] || [];
    const have = cs.filter((r) => st.owned[r.card_id]).length;
    const cover = b.cover && st.cards[b.cover] ? b.cover : cs[0] && cs[0].card_id;
    return `<article class="box${b.active ? "" : " off"}">
      <div class="box-cover">${cover ? pic(cover) : `<span class="pic"><span class="noimg">${esc(b.name)}</span></span>`}${b.active ? "" : `<span class="tag">Hidden from players</span>`}</div>
      <div class="box-info">
        <h3>${esc(b.name)}</h3>
        ${b.description ? `<p class="muted">${esc(b.description)}</p>` : ""}
        <p class="box-meta">${b.cards_per_pack} cards per pack · ${cs.length} cards in the box · you have ${have}</p>
        <details class="rates"><summary>Rates</summary>
          <table>${odds(b).map(([r, p]) => `<tr><td><span class="rar r-${r}">${r}</span></td><td>${p.toFixed(p < 1 ? 2 : 1)}% per card</td><td class="muted">${cs.filter((x) => x.rarity === r).length} cards</td></tr>`).join("")}</table>
          ${b.guarantee ? `<p class="muted">The last card of every pack is ${esc(b.guarantee)} or better.</p>` : ""}
        </details>
        <div class="box-buy">
          <button class="go" data-open="${b.id}" data-n="1" ${coins() < b.price || !cs.length ? "disabled" : ""}>Open 1 · ◈ ${b.price.toLocaleString()}</button>
          <button data-open="${b.id}" data-n="10" ${coins() < b.price * 10 || !cs.length ? "disabled" : ""}>Open 10 · ◈ ${(b.price * 10).toLocaleString()}</button>
        </div>
      </div></article>`;
}
$("#boxGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-open]");
  if (b) openPacks(+b.dataset.open, +b.dataset.n);
  const d = e.target.closest("[data-buydeck]");
  if (d) buyDeck(+d.dataset.buydeck);
});
async function buyDeck(boxId) {
  if (st.busy) return;
  const box = st.boxes.find((b) => b.id === boxId);
  if (!box || !window.confirm(`Buy "${box.name}" for ◈ ${box.price.toLocaleString()}? Every card is added to your collection and the deck is copied into your decks.`)) return;
  st.busy = true;
  try {
    const res = await Cloud.rpc("buy_deck", { box: boxId });
    Auth.set({ ...Auth.get(), coins: res.coins });
    for (const r of res.cards || []) st.owned[r.card] = (st.owned[r.card] || 0) + (+r.qty || 1);
    let saved = false;
    if (res.deck && Array.isArray(res.deck.main)) {
      await DB.put("decks", { ...res.deck, id: DB.newId(), name: res.deck.name || box.name, note: `Bought in the Store: ${box.name}` });
      saved = true;
    }
    renderShop();
    toast(`${box.name}: ${(res.cards || []).reduce((n, r) => n + (+r.qty || 1), 0)} cards added${saved ? " · the deck is in your decks (Deck builder)" : ""}`);
  } catch (e) { fail(e); } finally { st.busy = false; }
}
async function openPacks(boxId, n) {
  if (st.busy) return;
  st.busy = true;
  const box = st.boxes.find((b) => b.id === boxId);
  try {
    const res = await Cloud.rpc("open_pack", { box: boxId, packs: n });
    Auth.set({ ...Auth.get(), coins: res.coins });
    st.last = { boxId, n };
    const flat = [];
    for (const pack of res.packs) for (const c of pack) {
      flat.push({ ...c, isNew: !st.owned[c.card] });
      st.owned[c.card] = (st.owned[c.card] || 0) + 1;
    }
    showOpening(box, flat);
    renderShop();
  } catch (e) { fail(e); } finally { st.busy = false; }
}

// ---------- pack opening ----------
function showOpening(box, flat) {
  $("#openTitle").textContent = `${box.name} · ${flat.length} cards`;
  $("#openCards").innerHTML = flat.map((c, i) => `<button class="pk r-${c.rarity}" data-i="${i}" style="--d:${i % 10}">
      <span class="pk-in"><span class="pk-back"></span><span class="pk-front">${pic(c.card)}<span class="rar r-${c.rarity}">${c.rarity}</span>${c.isNew ? '<span class="new">NEW</span>' : ""}<small>${esc(cardName(c.card))}</small></span></span></button>`).join("");
  $("#openAgain").disabled = coins() < box.price * st.last.n;
  $("#openAgain").textContent = `Open ${st.last.n} more · ◈ ${(box.price * st.last.n).toLocaleString()}`;
  $("#opening").hidden = false;
}
$("#openCards").addEventListener("click", (e) => { const c = e.target.closest(".pk"); if (c) c.classList.add("up"); });
$("#openAll").addEventListener("click", () => {
  [...document.querySelectorAll(".pk:not(.up)")].forEach((c, i) => setTimeout(() => c.classList.add("up"), i * 90));
});
$("#openAgain").addEventListener("click", () => { $("#opening").hidden = true; if (st.last) openPacks(st.last.boxId, st.last.n); });
$("#openDone").addEventListener("click", () => { $("#opening").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#opening").hidden) $("#opening").hidden = true; });

// ---------- My collection ----------
let mineT;
function renderMine() {
  const sel = $("#mineBox");
  if (sel.options.length <= 1) sel.innerHTML += st.boxes.filter((b) => b.active || isAdmin()).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  const q = $("#mineQ").value.trim().toLowerCase(), missing = $("#mineMissing").checked;
  const rarOf = {};
  let ids;
  if (sel.value) { (st.boxCards[sel.value] || []).forEach((r) => (rarOf[r.card_id] = r.rarity)); ids = Object.keys(rarOf); }
  else ids = missing ? Object.keys(st.cards) : Object.keys(st.owned);
  if (!missing) ids = ids.filter((id) => st.owned[id]);
  if (q) ids = ids.filter((id) => cardName(id).toLowerCase().includes(q));
  ids.sort((a, b) => cardName(a).localeCompare(cardName(b)));
  const total = Object.values(st.owned).reduce((a, n) => a + n, 0);
  $("#mineCount").textContent = `${Object.keys(st.owned).filter((k) => st.owned[k]).length} different cards · ${total} copies`;
  const grid = $("#mineGrid");
  grid.innerHTML = ids.length ? "" : `<p class="muted">${Object.keys(st.owned).length ? "No cards match." : "No cards yet. Open a pack in the Store."}</p>`;
  let i = 0;
  clearTimeout(mineT);
  (function chunk() { // draw in chunks so long lists stay smooth
    const html = ids.slice(i, i + 48).map((id) => `<div class="mc${st.owned[id] ? "" : " missing"}">${pic(id)}<b>${esc(cardName(id))}</b><span class="cnt">×${st.owned[id] || 0}</span>${rarOf[id] ? `<span class="rar r-${rarOf[id]}">${rarOf[id]}</span>` : ""}</div>`).join("");
    grid.insertAdjacentHTML("beforeend", html);
    i += 48;
    if (i < ids.length) mineT = setTimeout(chunk, 0);
  })();
}
let mineQT;
$("#mineQ").addEventListener("input", () => { clearTimeout(mineQT); mineQT = setTimeout(renderMine, 200); });
$("#mineBox").addEventListener("change", renderMine);
$("#mineMissing").addEventListener("change", renderMine);

// ---------- admin: boxes ----------
function renderBoxList() {
  if ($("#boxSet") && $("#boxSet").options.length <= 1) fillBoxSets();
  $("#boxList").innerHTML = st.boxes.map((b) => `<button class="${st.edit && st.edit.box.id === b.id ? "on" : ""}" data-box="${b.id}"><b>${b.kind === "deck" ? "🃏" : "📦"} ${esc(b.name)}</b><small>${b.active ? "In the Store" : "Hidden"} · ◈ ${b.price} · ${(st.boxCards[b.id] || []).length} cards</small></button>`).join("") || `<p class="muted">No boxes yet.</p>`;
  renderBoxEdit();
}
$("#boxList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-box]");
  if (!b) return;
  const box = st.boxes.find((x) => x.id === +b.dataset.box);
  st.edit = { box: { ...box, rates: { ...box.rates } }, cards: (st.boxCards[box.id] || []).map((r) => ({ ...r })), q: "" };
  renderBoxList();
});
// ---------- box from a set: every card printed in it (rarity C until you set it) ----------
const setLabel = (name, code) => { const m = String(name || "").match(/^\[(?:VGE-)?([^\]]+)\]/); return m ? m[1].trim() : String(name || code || "").slice(0, 40); };
const setsOfCard = (c) => (c.prints && c.prints.length ? [...new Set(c.prints.map((p) => setLabel(p.set, p.setCode)))] : c.source && (c.source.set || c.source.setCode) ? [setLabel(c.source.set, c.source.setCode)] : []);
function fillBoxSets() {
  const el = $("#boxSet");
  const sets = [...new Set(Object.values(st.cards).flatMap(setsOfCard))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  el.innerHTML = `<option value="">📦 Box from a set…</option>` + sets.map((s) => `<option>${esc(s)}</option>`).join("");
}
$("#boxFromSet").addEventListener("click", () => {
  const lab = $("#boxSet").value;
  if (!lab) return toast("Pick a set first", true);
  const list = Object.values(st.cards).filter((c) => setsOfCard(c).includes(lab) && !c.token && !c.ticket && c.type !== "crest");
  if (!list.length) return toast("No cards from that set", true);
  const full = (list[0].prints || []).find((p) => setLabel(p.set, p.setCode) === lab);
  st.edit = { box: { id: null, name: (full && full.set ? full.set.replace(/^\[[^\]]*\]\s*/, "") : lab).slice(0, 60), description: "", cover: "", price: 100, cards_per_pack: 5,
    rates: { C: 70, R: 20, RR: 7, RRR: 2.5, SP: 0.5, SEC: 0 }, guarantee: "R", active: false, sort: st.boxes.length }, cards: list.map((c) => ({ card_id: c.id, rarity: "C" })), q: "" };
  renderBoxList();
  toast(`${list.length} cards added as C. Set each card's rarity, then Save box.`);
});
$("#newBox").addEventListener("click", () => {
  st.edit = { box: { id: null, name: "New box", description: "", cover: "", price: 100, cards_per_pack: 5, rates: { C: 70, R: 20, RR: 7, RRR: 2.5, SP: 0.5, SEC: 0 }, guarantee: "R", active: false, sort: st.boxes.length }, cards: [], q: "" };
  renderBoxList();
});
function renderBoxEdit() {
  const E = st.edit;
  if (!E) { $("#boxEdit").innerHTML = `<p class="muted">Pick a box or make a new one.</p>`; return; }
  const b = E.box;
  const count = (r) => E.cards.filter((x) => x.rarity === r).length;
  const isDeck = b.kind === "deck";
  if (isDeck) return renderDeckEdit(E, b);
  $("#boxEdit").innerHTML = `
    <div class="be-kind"><span class="muted">Product:</span><button class="on">📦 Booster pack</button><button data-kind="deck" ${st.noDecks ? "disabled title=\"Run supabase/007_store_decks.sql first\"" : ""}>🃏 Deck</button></div>
    <div class="be-grid">
      <label class="field">Name <input data-f="name" value="${esc(b.name)}" maxlength="60"></label>
      <label class="field">Price per pack (coins) <input data-f="price" type="number" min="0" value="${b.price}"></label>
      <label class="field">Cards per pack <input data-f="cards_per_pack" type="number" min="1" max="20" value="${b.cards_per_pack}"></label>
      <label class="field">Order in the Store <input data-f="sort" type="number" value="${b.sort}"></label>
      <label class="field wide">Description <input data-f="description" value="${esc(b.description)}" maxlength="200"></label>
      <label class="field">Last card is at least <select data-f="guarantee"><option value="">no guarantee</option>${RAR.map((r) => `<option ${b.guarantee === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label class="field">Cover card <select data-f="cover"><option value="">first card</option>${E.cards.map((x) => `<option value="${esc(x.card_id)}" ${b.cover === x.card_id ? "selected" : ""}>${esc(cardName(x.card_id))}</option>`).join("")}</select></label>
      <label class="chk wide"><input type="checkbox" data-f="active" ${b.active ? "checked" : ""}> In the Store (players can see and open it)</label>
    </div>
    <h3>Rates (weight per card slot)</h3>
    <div class="be-rates">${RAR.map((r) => `<label><span class="rar r-${r}">${r}</span><input type="number" min="0" step="0.1" data-rate="${r}" value="${+b.rates[r] || 0}"><small class="muted">${count(r)} cards</small></label>`).join("")}</div>
    <p class="muted">A rarity with no cards in the box is skipped; the rest share the chance by weight.</p>
    <h3>Cards in this box (${E.cards.length})</h3>
    <div class="be-cards">${E.cards.map((x, i) => `<div class="be-card">${pic(x.card_id)}<span>${esc(cardName(x.card_id))}</span><select data-rar="${i}">${RAR.map((r) => `<option ${x.rarity === r ? "selected" : ""}>${r}</option>`).join("")}</select><button data-rm="${i}" aria-label="Remove">✕</button></div>`).join("") || `<p class="muted">No cards yet. Search the library below.</p>`}</div>
    <h3>Add cards from the library</h3>
    <div class="be-add"><input id="beQ" placeholder="Search name, set code or number" value="${esc(E.q)}" autocomplete="off">
      <label>as <select id="beRar">${RAR.map((r) => `<option ${E.addRar === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <button id="beAddAll">Add all results</button></div>
    <div id="beResults" class="be-results"></div>
    <div class="be-save"><button class="go" id="beSave">Save box</button>${b.id ? `<button id="beDel" class="danger">Delete box</button>` : ""}</div>`;
  renderResults();
}
function searchLib() {
  const E = st.edit, q = (E.q || "").trim().toLowerCase();
  if (!q) return [];
  const inBox = new Set(E.cards.map((x) => x.card_id));
  return Object.values(st.cards).filter((c) => !inBox.has(c.id) && [c.name, c.source && c.source.setCode, c.source && c.source.number, c.id].some((v) => v && String(v).toLowerCase().includes(q)));
}
function renderResults() {
  const r = searchLib();
  $("#beResults").innerHTML = r.slice(0, 60).map((c) => `<button class="be-card" data-add="${esc(c.id)}">${pic(c.id)}<span>${esc(c.name)}</span><small class="muted">${esc((c.source && [c.source.setCode, c.source.number].filter(Boolean).join(" ")) || "")}</small></button>`).join("")
    + (r.length > 60 ? `<p class="muted">${r.length - 60} more… narrow the search or use “Add all results”.</p>` : "")
    || `<p class="muted">${st.edit.q ? "No cards found (or all already in the box)." : "Type to search."}</p>`;
  $("#beAddAll").textContent = `Add all results (${r.length})`;
  $("#beAddAll").disabled = !r.length;
}
let beQT;
$("#boxEdit").addEventListener("input", (e) => {
  const E = st.edit, t = e.target;
  if (t.id === "beQ") { E.q = t.value; clearTimeout(beQT); beQT = setTimeout(renderResults, 200); return; }
  if (t.dataset.f) E.box[t.dataset.f] = t.type === "checkbox" ? t.checked : t.type === "number" ? +t.value : t.value;
  if (t.dataset.rate) E.box.rates[t.dataset.rate] = +t.value;
  if (t.dataset.rar !== undefined) E.cards[+t.dataset.rar].rarity = t.value;
  if (t.id === "beRar") E.addRar = t.value;
});
$("#boxEdit").addEventListener("change", (e) => { if (e.target.dataset.rar !== undefined) renderBoxEdit(); });
$("#boxEdit").addEventListener("click", async (e) => {
  const E = st.edit, t = e.target.closest("button");
  if (!t) return;
  const rar = $("#beRar") ? $("#beRar").value : "C";
  if (t.dataset.add) { E.cards.push({ card_id: t.dataset.add, rarity: rar }); return renderBoxEdit(); }
  if (t.dataset.rm !== undefined) { E.cards.splice(+t.dataset.rm, 1); return renderBoxEdit(); }
  if (t.id === "beAddAll") { searchLib().forEach((c) => E.cards.push({ card_id: c.id, rarity: rar })); E.q = ""; return renderBoxEdit(); }
  if (t.dataset.kind) { E.box.kind = t.dataset.kind; if (t.dataset.kind === "booster") E.cards.forEach((x) => delete x.qty); return renderBoxEdit(); }
  if (t.id === "beSave") return saveBox();
  if (t.id === "beDel") {
    if (!window.confirm(`Delete the box "${E.box.name}"? Cards players already own stay theirs.`)) return;
    try {
      const cl = await Cloud.client();
      const { error } = await cl.from("boxes").delete().eq("id", E.box.id);
      if (error) throw error;
      st.boxes = st.boxes.filter((b) => b.id !== E.box.id);
      delete st.boxCards[E.box.id];
      st.edit = null;
      renderBoxList();
      toast("Box deleted");
    } catch (err) { fail(err); }
  }
});
// a deck product: pick one of your decks; its cards (with copies) and layout are what the buyer gets
function renderDeckEdit(E, b) {
  const total = E.cards.reduce((n, x) => n + (+x.qty || 1), 0);
  const decks = st.myDecks || [];
  $("#boxEdit").innerHTML = `
    <div class="be-kind"><span class="muted">Product:</span><button data-kind="booster">📦 Booster pack</button><button class="on">🃏 Deck</button></div>
    <div class="be-grid">
      <label class="field">Name <input data-f="name" value="${esc(b.name)}" maxlength="60"></label>
      <label class="field">Price (coins) <input data-f="price" type="number" min="0" value="${b.price}"></label>
      <label class="field">Order in the Store <input data-f="sort" type="number" value="${b.sort}"></label>
      <label class="field wide">Description <input data-f="description" value="${esc(b.description)}" maxlength="200"></label>
      <label class="field wide">Deck to sell <select id="beDeck"><option value="">Pick one of your decks…</option>${decks.map((d) => `<option value="${esc(d.id)}" ${E.deckId === d.id ? "selected" : ""}>${esc(d.name)} · ${(d.main || []).length} + ${(d.ride || []).filter(Boolean).length} ride${(d.g || []).length ? " + " + d.g.length + " G" : ""}</option>`).join("")}</select></label>
      <label class="field">Cover card <select data-f="cover"><option value="">its grade 3</option>${E.cards.map((x) => `<option value="${esc(x.card_id)}" ${b.cover === x.card_id ? "selected" : ""}>${esc(cardName(x.card_id))}</option>`).join("")}</select></label>
      <label class="chk wide"><input type="checkbox" data-f="active" ${b.active ? "checked" : ""}> In the Store (players can see and buy it)</label>
    </div>
    <h3>Deck list (${total} cards)</h3>
    <div class="be-cards">${E.cards.map((x) => `<div class="be-card">${pic(x.card_id)}<span>${+x.qty || 1}× ${esc(cardName(x.card_id))}</span></div>`).join("") || `<p class="muted">Pick a deck above.</p>`}</div>
    <div class="be-save"><button class="go" id="beSave">Save deck product</button>${b.id ? `<button id="beDel" class="danger">Delete</button>` : ""}</div>`;
}
$("#boxEdit").addEventListener("change", (e) => {
  if (e.target.id !== "beDeck" || !st.edit) return;
  const d = (st.myDecks || []).find((x) => x.id === e.target.value);
  if (!d) return;
  st.edit.deckId = d.id;
  const all = [...(d.ride || []).filter(Boolean), ...(d.main || []), ...(d.g || [])];
  const qty = {};
  all.forEach((id) => (qty[id] = (qty[id] || 0) + 1));
  st.edit.cards = Object.entries(qty).map(([card_id, q]) => ({ card_id, rarity: "C", qty: q }));
  st.edit.box.deck = { name: d.name, format: d.format, energy: !!d.energy, ride: d.ride || [], starter: d.starter || "", main: d.main || [], g: d.g || [], gUnlock: !!d.gUnlock };
  if (!st.edit.box.name || st.edit.box.name === "New box") st.edit.box.name = d.name.slice(0, 60);
  renderBoxEdit();
});
async function saveBox() {
  const E = st.edit, b = E.box;
  if (!b.name.trim()) return toast("Give the box a name", true);
  const isDeck = b.kind === "deck";
  if (isDeck && !b.deck) return toast("Pick the deck to sell", true);
  if (!isDeck && (b.cards_per_pack < 1 || b.cards_per_pack > 20)) return toast("Cards per pack: 1 to 20", true);
  const row = { name: b.name.trim(), description: b.description || "", cover: b.cover || "", price: Math.max(0, b.price | 0), cards_per_pack: Math.min(20, Math.max(1, b.cards_per_pack | 0)), rates: b.rates, guarantee: isDeck ? null : b.guarantee || null, active: !!b.active, sort: b.sort | 0 };
  if (!st.noDecks) Object.assign(row, { kind: isDeck ? "deck" : "booster", deck: isDeck ? b.deck : null });
  try {
    const cl = await Cloud.client();
    let id = b.id;
    if (id) { const { error } = await cl.from("boxes").update(row).eq("id", id); if (error) throw error; }
    else { const { data, error } = await cl.from("boxes").insert(row).select("id").single(); if (error) throw error; id = data.id; }
    const { error: delErr } = await cl.from("box_cards").delete().eq("box_id", id);
    if (delErr) throw delErr;
    const rows = [...new Map(E.cards.map((x) => [x.card_id, { box_id: id, card_id: x.card_id, rarity: x.rarity || "C", ...(st.noDecks ? {} : { qty: Math.max(1, +x.qty || 1) }) }])).values()];
    for (let i = 0; i < rows.length; i += 500) { const { error } = await cl.from("box_cards").insert(rows.slice(i, i + 500)); if (error) throw error; }
    const saved = { ...b, ...row, id };
    st.boxes = st.boxes.filter((x) => x.id !== id).concat(saved).sort((a, c) => a.sort - c.sort || a.id - c.id);
    st.boxCards[id] = rows;
    st.edit = { ...E, box: { ...saved, rates: { ...saved.rates } } };
    renderBoxList();
    toast("Box saved");
  } catch (err) { fail(err); }
}

// ---------- admin: settings ----------
function renderSettings() {
  const s = st.settings || {};
  $("#setStart").value = s.start_coins ?? 1000;
  $("#setWin").value = s.win_coins ?? 100;
  $("#setLoss").value = s.loss_coins ?? 30;
  $("#setCap").value = s.daily_match_cap ?? 10;
  $("#setReq").checked = s.require_collection ?? true;
}
$("#setForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = { start_coins: +$("#setStart").value | 0, win_coins: +$("#setWin").value | 0, loss_coins: +$("#setLoss").value | 0, daily_match_cap: +$("#setCap").value | 0, require_collection: $("#setReq").checked };
  try {
    const cl = await Cloud.client();
    const { error } = await cl.from("app_settings").update(row).eq("id", 1);
    if (error) throw error;
    st.settings = { ...st.settings, ...row };
    try { localStorage.setItem("vt-settings", JSON.stringify(st.settings)); } catch {}
    toast("Settings saved");
  } catch (err) { fail(err); }
});
$("#giveMe").addEventListener("click", async () => {
  try {
    const n = await Cloud.rpc("admin_add_coins", { target: me.id, amount: +$("#giveAmt").value | 0 });
    Auth.set({ ...Auth.get(), coins: n });
    paintCoins();
    toast(`You have ◈ ${n.toLocaleString()}`);
  } catch (err) { fail(err); }
});

// ---------- start ----------
if (!account) {
  $("#guestNote").hidden = false;
  document.querySelectorAll(".stab, .stabs [data-stab]").forEach((x) => (x.hidden = true));
} else {
  document.querySelectorAll("[data-admin]").forEach((x) => (x.hidden = !isAdmin()));
  Loader.wait(load().then(() => {
    try { localStorage.setItem("vt-settings", JSON.stringify(st.settings)); } catch {}
    showTab(location.hash === "#mine" ? "mine" : "shop");
  }).catch((e) => { $("#boxGrid").innerHTML = `<p class="muted">Couldn't load the Store: ${esc(e.message || e)}</p>`; }));
}
