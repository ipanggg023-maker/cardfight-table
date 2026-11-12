// Card + deck editor. Forms are generated from SCHEMA in schema.js.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
let cards = [], decks = [], cur = null, curDeck = null, dirty = false;
const byId = () => Object.fromEntries(cards.map((c) => [c.id, c]));

let toastT;
function toast(m, bad) {
  const t = $("#toast");
  t.textContent = m;
  t.style.background = bad ? "var(--red)" : "var(--green)";
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2200);
}
async function reload() {
  cards = (await DB.all("cards")).sort((a, b) => (a.type === "order") - (b.type === "order") || a.grade - b.grade || a.name.localeCompare(b.name));
  decks = await DB.all("decks");
}

// ---------- tabs ----------
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + b.dataset.tab));
  if (b.dataset.tab === "decks") renderDecks();
}));

// ---------- filters (shared by the Cards list and the deck builder) ----------
const uniq = (key) => [...new Set(cards.map((c) => String(c[key] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
// Fills a <select> with "All …" + the values found on cards; hides it when there's nothing to pick.
function fillPick(el, all, key, value) {
  const vals = uniq(key);
  el.innerHTML = `<option value="">${esc(all)}</option>` + vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  el.value = vals.includes(value) ? value : "";
  el.hidden = !vals.length;
  return el.value;
}
// f = {q: name text, g: "" | "0".."3" | "o", n: clan/nation, r: race}
const cardMatches = (c, f) => c.name.toLowerCase().includes((f.q || "").toLowerCase())
  && (!f.g || (f.g === "o" ? c.type === "order" : c.type !== "order" && c.grade === +f.g))
  && (!f.n || String(c.nation || "").trim() === f.n)
  && (!f.r || String(c.race || "").trim() === f.r);

// ---------- card list ----------
function renderList() {
  const f = { q: $("#q").value, g: $("#qg").value, n: fillPick($("#qn"), "All clans", "nation", $("#qn").value), r: fillPick($("#qr"), "All races", "race", $("#qr").value) };
  $("#cardList").innerHTML = cards.filter((c) => cardMatches(c, f))
    .map((c) => `<li data-id="${esc(c.id)}" class="${cur && cur.id === c.id ? "on" : ""}"><span class="g">${c.type === "order" ? "ORD" : "G" + c.grade}</span>${esc(c.name)}
      <span class="x">${c.type === "trigger" && !c.trigger ? "⚠" : ""}${c.trigger ? TRIG[c.trigger].icon : ""}${c.sentinel ? "◆" : ""}${(c.abilities || []).length ? "✦" + c.abilities.length : ""}</span></li>`).join("")
    || `<li class="muted">No cards</li>`;
}
$("#q").addEventListener("input", renderList);
$("#qg").addEventListener("change", renderList);
$("#qn").addEventListener("change", renderList);
$("#qr").addEventListener("change", renderList);
$("#cardList").addEventListener("click", (e) => {
  const li = e.target.closest("[data-id]");
  if (!li) return;
  if (dirty && !window.confirm("Discard unsaved changes?")) return;
  cur = JSON.parse(JSON.stringify(cards.find((c) => c.id === li.dataset.id)));
  dirty = false;
  renderList();
  renderCard();
});
const blankCard = () => ({ id: DB.newId(), name: "New card", grade: 0, type: "unit", power: 5000, shield: 10000, crit: 1, trigger: null,
  sentinel: false, persona: false, nation: "", race: "", image: "", text: "", abilities: [] });
$("#newCard").addEventListener("click", () => { cur = blankCard(); dirty = true; renderList(); renderCard(); });

// ---------- card form ----------
const sel = (path, options, value) => `<select data-path="${path}">${Object.entries(options).map(([k, v]) => `<option value="${esc(k)}" ${String(value ?? "") === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>`;
const num = (path, v, ph = "") => `<input type="number" data-path="${path}" value="${esc(v ?? "")}" placeholder="${ph}">`;
const txt = (path, v, ph = "") => `<input type="text" data-path="${path}" value="${esc(v ?? "")}" placeholder="${esc(ph)}">`;

function renderCard() {
  const c = cur;
  if (!c) { $("#cardForm").innerHTML = `<p class="muted">Pick a card on the left or create a new one.</p>`; return; }
  $("#cardForm").innerHTML = `
    <h2>${esc(c.name)}</h2>
    <details class="paste" ${c.abilities.length || c.text ? "" : "open"}>
      <summary>Fill from card text</summary>
      <p class="muted">Paste the card's text (stats and [AUTO]/[ACT]/[CONT] lines). Stats and abilities are filled in as a best guess. Check every purple line below, then save.</p>
      <textarea id="pasteText" placeholder="Grade 3 / Power 13000 / Shield 0 / Critical 1&#10;[AUTO](VC):When this unit attacks, [COST][Counter-Blast 1], …"></textarea>
      <button data-do="fill" class="go">Fill from text</button>
    </details>
    <div class="fgrid">
      <label>Name ${txt("name", c.name)}</label>
      <label>Card type ${sel("type", { unit: "Normal unit", trigger: "Trigger unit", order: "Order" }, c.type)}</label>
      <label>Grade ${num("grade", c.grade)}</label>
      <label>Power ${num("power", c.power)}</label>
      <label>Shield ${num("shield", c.shield)}</label>
      <label>Critical ${num("crit", c.crit)}</label>
      <label>Trigger ${sel("trigger", { "": "None", crit: "Critical", front: "Front", draw: "Draw", heal: "Heal", over: "Over" }, c.trigger || "")}</label>
      <label>Nation ${txt("nation", c.nation, "Dragon Empire")}</label>
      <label>Race ${txt("race", c.race)}</label>
    </div>
    <div class="btnrow">
      <label class="chk"><input type="checkbox" data-path="sentinel" ${c.sentinel ? "checked" : ""}> Sentinel (perfect guard: discard 1)</label>
      <label class="chk"><input type="checkbox" data-path="persona" ${c.persona ? "checked" : ""}> Persona Ride</label>
    </div>
    <div class="imgrow">
      ${c.image ? `<img src="${esc(c.image)}" alt="">` : ""}
      <div class="full">
        <label class="filebtn">Upload image… <input type="file" id="imgFile" accept="image/*"></label>
        <label>…or image path / URL (e.g. images/vyrgilla.png) ${txt("image", c.image && c.image.startsWith("data:") ? "" : c.image, "images/card.png")}</label>
        ${c.image ? `<button data-do="clearImg">Remove image</button>` : ""}
      </div>
    </div>
    <div class="full"><label>Card text (for reference, shown on hover) <textarea data-path="text">${esc(c.text)}</textarea></label></div>
    <h2>Abilities</h2>
    ${(c.abilities || []).map(abilityHTML).join("") || `<p class="muted">No abilities. Vanilla units, triggers and sentinels need none.</p>`}
    <div class="btnrow">
      <button data-do="addAb">+ Add ability</button>
    </div>
    <div class="btnrow">
      <button data-do="save" class="go">Save card</button>
      <button data-do="dup">Duplicate</button>
      <button data-do="del" class="del">Delete</button>
    </div>`;
  $("#imgFile").addEventListener("change", onImage);
}

function abilityHTML(ab, ai) {
  const base = `abilities.${ai}`;
  const order = ab.kind === "ORDER" || ab.kind === "BLITZ";
  const part = (key, title, lib) => `<div class="part"><h4>${title}</h4>
    ${(ab[key] || []).map((row, ri) => rowHTML(`${base}.${key}.${ri}`, row, lib, ab.kind === "CONT" && key === "effects")).join("")}
    <div class="addrow">${sel(`@add:${base}.${key}`, { "": "+ add " + title.toLowerCase().replace(/s$/, "") + "…", ...Object.fromEntries(Object.entries(lib).filter(([k]) => ab.kind !== "CONT" || key !== "effects" || ["power", "crit"].includes(k)).map(([k, v]) => [k, v.label])) }, "")}</div></div>`;
  return `<div class="abil">
    <div class="head">
      <label>Kind ${sel(`${base}.kind`, SCHEMA.kinds, ab.kind)}</label>
      ${order ? "" : `<label>Zone ${sel(`${base}.zone`, SCHEMA.zones, ab.zone || "VC")}</label>`}
      ${ab.kind === "AUTO" ? `<label>When ${sel(`${base}.when`, SCHEMA.events, ab.when)}</label>` : ""}
      <label>Limit ${sel(`${base}.once`, { "": "No limit", turn: "1/Turn", game: "1/Game" }, ab.once || "")}</label>
      <button class="del" data-do="delAb" data-i="${ai}">Remove ability</button>
    </div>
    <div class="preview">${esc(describeAbility(ab))}</div>
    ${part("conds", "Conditions", SCHEMA.conds)}
    ${ab.kind === "CONT" ? "" : part("costs", "Costs", SCHEMA.costs)}
    ${part("effects", "Effects", SCHEMA.effects)}
  </div>`;
}

function rowHTML(path, row, lib, contOnly) {
  const def = lib[row.type];
  if (!def) return "";
  const field = ([k, kind, label]) => {
    const p = `${path}.${k}`, v = row[k];
    const lab = (inner) => `<label>${esc(label || k)} ${inner}</label>`;
    switch (kind) {
      case "num": return lab(num(p, v));
      case "text": return lab(txt(p, v));
      case "target": {
        const opts = contOnly ? Object.fromEntries(CONT_TARGETS.map((t) => [t, TARGETS[t]])) : TARGETS;
        return lab(sel(p, opts, v || "self"));
      }
      case "dur": return lab(sel(p, SCHEMA.paramOptions.dur, v || "turn"));
      case "from": return lab(sel(p, SCHEMA.paramOptions.from, v || "deck"));
      case "dest": return lab(sel(p, SCHEMA.paramOptions.dest, v || "hand"));
      case "restDest": return lab(sel(p, SCHEMA.paramOptions.restDest, v || "shuffle"));
      case "filter": {
        const f = v || {};
        return `<div class="flt"><label>min grade ${num(p + ".gmin", f.gmin)}</label><label>max grade ${num(p + ".gmax", f.gmax)}</label>
          <label>name has ${txt(p + ".name", f.name)}</label><label>type ${sel(p + ".ctype", SCHEMA.paramOptions.ctype, f.ctype || "any")}</label></div>`;
      }
    }
    return "";
  };
  return `<div class="prow"><b>${esc(def.label)}</b>${def.params.map(field).join("")}<button class="del" data-do="delRow" data-path="${path}">✕</button></div>`;
}

// path helpers
function getParent(obj, path) {
  const parts = path.split(".");
  const last = parts.pop();
  let o = obj;
  for (const k of parts) { if (o[k] === undefined) o[k] = {}; o = o[k]; }
  return [o, last];
}
const NUM_FIELDS = new Set(["grade", "power", "shield", "crit", "n", "amount", "pick"]);
function setPath(path, value) {
  const [o, k] = getParent(cur, path);
  o[k] = NUM_FIELDS.has(k) && value !== "" ? Number(value) : value;
}

$("#cardForm").addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.path || el.dataset.path.startsWith("@")) return;
  dirty = true;
  let v = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.path === "trigger") v = v || null;
  setPath(el.dataset.path, v);
  if (el.tagName === "SELECT" || el.type === "checkbox") renderCard();
  else updatePreviews();
});
$("#cardForm").addEventListener("change", (e) => {
  const el = e.target;
  if (!el.dataset.path || !el.dataset.path.startsWith("@add:") || !el.value) return;
  const listPath = el.dataset.path.slice(5);
  const [o, k] = getParent(cur, listPath);
  (o[k] = o[k] || []).push(defaultRow(el.value));
  dirty = true;
  renderCard();
});
function defaultRow(type) {
  const r = { type };
  const def = SCHEMA.conds[type] || SCHEMA.costs[type] || SCHEMA.effects[type];
  def.params.forEach(([k, kind]) => {
    if (kind === "num") r[k] = k === "amount" ? (type === "crit" || type === "drive" ? 1 : 5000) : 1;
    if (kind === "target") r[k] = "self";
  });
  if (type === "lookTop") { r.n = 5; r.pick = 1; }
  return r;
}
function updatePreviews() {
  document.querySelectorAll(".abil .preview").forEach((el, i) => (el.textContent = describeAbility(cur.abilities[i])));
  const h = document.querySelector("#cardForm h2");
  if (h) h.textContent = cur.name;
}

$("#cardForm").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-do]");
  if (!b) return;
  switch (b.dataset.do) {
    case "addAb": cur.abilities.push({ kind: "AUTO", zone: "VC", when: "attack", once: "", conds: [], costs: [], effects: [] }); dirty = true; return renderCard();
    case "delAb": cur.abilities.splice(+b.dataset.i, 1); dirty = true; return renderCard();
    case "delRow": { const [o, k] = getParent(cur, b.dataset.path); o.splice(+k, 1); dirty = true; return renderCard(); }
    case "fill": {
      const t = $("#pasteText").value.trim();
      if (!t) return toast("Paste the card text first", true);
      if (cur.abilities.length && !window.confirm("Replace the current abilities with the ones read from the text?")) return;
      const r = TextParse.parse(t);
      const { abilities, ...statsFound } = r;
      Object.assign(cur, statsFound, { text: t, abilities });
      if (cur.type !== "trigger") cur.trigger = cur.trigger || null;
      dirty = true;
      renderCard();
      return toast(`Read ${Object.keys(statsFound).length} stat(s) and ${abilities.length} abilit${abilities.length === 1 ? "y" : "ies"}. Check them, then save.`);
    }
    case "clearImg": cur.image = ""; dirty = true; return renderCard();
    case "save": {
      if (!cur.name.trim()) return toast("Name is required", true);
      if (cur.type === "order") { cur.power = 0; cur.shield = 0; }
      if (cur.type !== "trigger") cur.trigger = null;
      await DB.put("cards", cur);
      dirty = false;
      await reload();
      renderList();
      return toast("Saved");
    }
    case "dup": cur = { ...JSON.parse(JSON.stringify(cur)), id: DB.newId(), name: cur.name + " (copy)" }; dirty = true; renderList(); return renderCard();
    case "del": {
      const used = decks.filter((d) => [...d.ride, ...d.main].includes(cur.id)).map((d) => d.name);
      if (!window.confirm(used.length ? `Used in: ${used.join(", ")}. Delete anyway?` : `Delete ${cur.name}?`)) return;
      await DB.del("cards", cur.id);
      cur = null; dirty = false;
      await reload(); renderList(); return renderCard();
    }
  }
});

// Shrink uploaded images so the database stays small
function onImage(e) {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 480 / img.width);
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * scale);
    cv.height = Math.round(img.height * scale);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    cur.image = cv.toDataURL("image/jpeg", 0.85);
    dirty = true;
    URL.revokeObjectURL(img.src);
    renderCard();
  };
  img.src = URL.createObjectURL(f);
}

// ---------- decks ----------
function renderDecks() {
  $("#deckList").innerHTML = decks.map((d) => {
    const bad = validateDeck(d, byId());
    return `<li data-id="${esc(d.id)}" class="${curDeck && curDeck.id === d.id ? "on" : ""}">${esc(d.name)}<span class="x">${bad.length ? "⚠" : "✓"} ${d.main.length}</span></li>`;
  }).join("") || `<li class="muted">No decks</li>`;
  renderDeckForm();
}
$("#deckList").addEventListener("click", (e) => {
  const li = e.target.closest("[data-id]");
  if (!li) return;
  curDeck = JSON.parse(JSON.stringify(decks.find((d) => d.id === li.dataset.id)));
  renderDecks();
});
$("#newDeck").addEventListener("click", () => {
  curDeck = { id: DB.newId(), name: "New deck", energy: true, ride: ["", "", "", ""], main: [] };
  renderDecks();
});
function renderDeckForm() {
  const d = curDeck;
  if (!d) { $("#deckForm").innerHTML = `<p class="muted">Pick a deck or create one.</p>`; return; }
  const ids = byId();
  const errs = validateDeck(d, ids);
  const cnt = {};
  d.main.forEach((id) => (cnt[id] = (cnt[id] || 0) + 1));
  const mainCards = d.main.map((id) => ids[id]).filter(Boolean);
  const rideSel = (g) => `<label>Grade ${g} <select data-ride="${g}"><option value="">—</option>${cards.filter((c) => c.grade === g && c.type !== "order" && (!poolF.n || String(c.nation || "").trim() === poolF.n || d.ride[g] === c.id))
    .map((c) => `<option value="${esc(c.id)}" ${d.ride[g] === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <div class="rideface">${ids[d.ride[g]] ? face(ids[d.ride[g]]) : `<div class="ph empty">G${g}</div>`}</div>`;
  const inDeck = [...new Set(d.main)].map((id) => ids[id]).filter(Boolean)
    .sort((a, b) => (a.type === "order") - (b.type === "order") || a.grade - b.grade || a.name.localeCompare(b.name));
  const pool = cards.filter((c) => cardMatches(c, poolF));
  const scroll = $(".pool.cards") ? $(".pool.cards").scrollTop : 0;
  $("#deckForm").innerHTML = `
    <h2>${esc(d.name)}</h2>
    <div class="fgrid">
      <label>Deck name <input type="text" id="deckName" value="${esc(d.name)}"></label>
      <label class="chk"><input type="checkbox" id="deckEnergy" ${d.energy ? "checked" : ""}> Energy Generator crest (+3 energy each turn, max 10)</label>
    </div>
    <h4>Ride deck</h4>
    <div class="ridegrid">${[0, 1, 2, 3].map((g) => `<div class="ridecol">${rideSel(g)}</div>`).join("")}</div>
    <div class="stats">
      <span class="pile">Main ${mainCards.length}/50</span>
      <span class="pile">Triggers ${mainCards.filter((c) => c.trigger).length}/16</span>
      <span class="pile">Heal ${mainCards.filter((c) => c.trigger === "heal").length}/4</span>
      <span class="pile">Sentinel ${mainCards.filter((c) => c.sentinel).length}/4</span>
      ${[0, 1, 2, 3].map((g) => `<span class="pile">G${g}: ${mainCards.filter((c) => c.type !== "order" && c.grade === g).length}</span>`).join("")}
      <span class="pile">Orders ${mainCards.filter((c) => c.type === "order").length}</span>
    </div>
    ${errs.length ? `<ul class="errs">${errs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="okmsg">✓ Deck is legal</p>`}
    <div class="btnrow"><button id="saveDeck" class="go">Save deck</button><button id="delDeck" class="del">Delete deck</button></div>
    <h4>In this deck (${d.main.length})</h4>
    <div class="pool deck">${inDeck.map((c) => tile(c, cnt[c.id])).join("") || `<p class="muted">Empty. Add cards from the list below with +.</p>`}</div>
    <h4>Your cards (${pool.length})</h4>
    <div class="tools">
      <input id="poolQ" placeholder="Search name…" value="${esc(poolF.q)}">
      <select id="poolG"><option value="">All grades</option>${["0", "1", "2", "3"].map((g) => `<option ${poolF.g === g ? "selected" : ""}>${g}</option>`).join("")}<option value="o" ${poolF.g === "o" ? "selected" : ""}>Orders</option></select>
      <select id="poolN" title="Clan / nation"></select>
      <select id="poolR" title="Race"></select>
    </div>
    <div class="pool cards">${pool.map((c) => tile(c, cnt[c.id] || 0)).join("") || `<p class="muted">No cards match. Create cards in the Cards tab.</p>`}</div>`;
  poolF.n = fillPick($("#poolN"), "All clans", "nation", poolF.n);
  poolF.r = fillPick($("#poolR"), "All races", "race", poolF.r);
  $(".pool.cards").scrollTop = scroll;
}
// Deck builder filters, kept while switching decks
const poolF = { q: "", g: "", n: "", r: "" };
const hueOf = (s) => [...String(s || "x")].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
// Card face: the picture, or a coloured placeholder with grade, name and power
const face = (c) => c.image
  ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">`
  : `<div class="ph" style="--h:${hueOf(c.nation)}"><b>${c.type === "order" ? "ORDER" : "G" + c.grade}</b><span>${esc(c.name)}</span>${c.type !== "order" ? `<small>${(c.power || 0).toLocaleString("en-US")}</small>` : ""}</div>`;
const tile = (c, n) => `<div class="tc${n ? " in" : ""}" title="${esc(c.name)}${c.nation ? " · " + esc(c.nation) : ""}">
    <div class="face">${face(c)}${c.trigger ? `<span class="tg">${TRIG[c.trigger].icon}</span>` : ""}${c.sentinel ? `<span class="tg">◆</span>` : ""}</div>
    <div class="tn">${esc(c.name)}</div>
    <div class="tb"><button data-dk="-" data-id="${esc(c.id)}" aria-label="Remove one">−</button><b>${n || 0}</b><button data-dk="+" data-id="${esc(c.id)}" aria-label="Add one">+</button></div>
  </div>`;
$("#deckForm").addEventListener("input", (e) => {
  if (!curDeck) return;
  if (e.target.id === "deckName") curDeck.name = e.target.value;
  if (e.target.id === "poolQ") { poolF.q = e.target.value; renderDeckForm(); const el = $("#poolQ"); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
});
$("#deckForm").addEventListener("change", (e) => {
  if (!curDeck) return;
  if (e.target.id === "deckEnergy") curDeck.energy = e.target.checked;
  const pf = { poolG: "g", poolN: "n", poolR: "r" }[e.target.id];
  if (pf) { poolF[pf] = e.target.value; renderDeckForm(); }
  if (e.target.dataset.ride !== undefined) { curDeck.ride[+e.target.dataset.ride] = e.target.value; renderDeckForm(); }
});
$("#deckForm").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || !curDeck) return;
  if (b.dataset.dk === "+") { curDeck.main.push(b.dataset.id); return renderDeckForm(); }
  if (b.dataset.dk === "-") { const i = curDeck.main.lastIndexOf(b.dataset.id); if (i >= 0) curDeck.main.splice(i, 1); return renderDeckForm(); }
  if (b.id === "saveDeck") {
    const { _q, ...clean } = curDeck;
    await DB.put("decks", clean);
    await reload();
    renderDecks();
    toast(validateDeck(clean, byId()).length ? "Saved (deck is not legal yet)" : "Saved");
  }
  if (b.id === "delDeck" && window.confirm(`Delete deck ${curDeck.name}?`)) {
    await DB.del("decks", curDeck.id);
    curDeck = null;
    await reload();
    renderDecks();
  }
});

// ---------- backup ----------
$("#exportBtn").addEventListener("click", async () => {
  const data = await DB.exportAll();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = `vanguard-cards-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("#importFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const replace = $("#importReplace").checked;
    if (replace && !window.confirm("Replace ALL current cards and decks?")) return;
    await DB.importAll(data, replace);
    await reload();
    renderList();
    toast(`Imported ${data.cards.length} cards, ${(data.decks || []).length} decks`);
  } catch (err) { toast(err.message, true); }
  e.target.value = "";
});

// ---------- CSV ----------
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("#csvTemplate").addEventListener("click", () => {
  const ex = [CSV_COLUMNS.join(","),
    'Example Dragon,unit,3,13000,0,1,,,yes,Dragon Empire,Flame Dragon,example.png,"[AUTO](VC):When this unit attacks, [COST][Counter-Blast 1], this unit gets [Power]+10000 until end of that battle."',
    'Example Imp,trigger,0,5000,15000,1,critical,,,Dragon Empire,Elemental,,',
    'Example Wall,unit,1,6000,0,1,,yes,,Dragon Empire,,,"[AUTO]:When this unit is placed on (GC), [COST][discard a card from hand], choose one of your units, and that unit cannot be hit until end of that battle."'];
  download("vanguard-cards-template.csv", "\ufeff" + ex.join("\n"), "text/csv");
});
$("#csvFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const rows = parseCSV((await f.text()).replace(/^\ufeff/, "")).filter((r) => r.name);
    if (!rows.length) throw new Error("No rows with a name column found");
    const byName = Object.fromEntries(cards.map((c) => [c.name.toLowerCase(), c]));
    let added = 0, updated = 0, abil = 0;
    for (const r of rows) {
      const card = cardFromRow(r, $("#csvGuess").checked);
      if (card.image && !/[\/:]/.test(card.image)) card.image = "images/" + card.image;
      const old = byName[card.name.toLowerCase()];
      if (old) {
        if (!card.abilities.length) card.abilities = old.abilities || [];
        if (!card.image) card.image = old.image;
        await DB.put("cards", { ...old, ...card, id: old.id });
        updated++;
      } else { await DB.put("cards", { ...card, id: DB.newId() }); added++; }
      abil += card.abilities.length;
    }
    await reload();
    renderList();
    $("#csvResult").innerHTML = `<p class="okmsg">✓ ${added} added, ${updated} updated, ${abil} abilities built from text. Open the cards to check the abilities.</p>`;
  } catch (err) { toast(err.message, true); }
  e.target.value = "";
});

// ---------- online cards (tcgapi.dev) ----------
const api = { mode: null, q: "", setId: "", page: 1, items: [], setsLoaded: false };
function showQuota() {
  const l = TcgApi.limit();
  $("#apiQuota").hidden = !l;
  if (l) $("#apiQuota").textContent = `Requests left today: ${l.daily_remaining ?? "?"} / ${l.daily_limit ?? "?"}`;
}
function apiError(e) { $("#apiResults").innerHTML = `<p class="errs">${esc(e.message)}</p>`; showQuota(); }
(() => { const st = TcgApi.settings(); $("#apiKey").value = st.key; $("#apiRelay").value = st.relay; })();

$("#apiSave").addEventListener("click", async () => {
  TcgApi.save($("#apiKey").value, $("#apiRelay").value);
  $("#apiStatus").textContent = "Testing the connection…";
  try {
    const g = await TcgApi.games();
    const vg = (g.data || []).find((x) => /vanguard/i.test(x.slug || x.name));
    $("#apiStatus").innerHTML = `<span class="okmsg">✓ Relay works.</span> ${vg ? `${vg.card_count} Vanguard cards available.` : ""} The key is checked on your first search.`;
  } catch (e) { $("#apiStatus").innerHTML = `<span class="errs">${esc(e.message)}</span>`; }
  showQuota();
});

$("#apiSets").addEventListener("focus", async () => {
  if (api.setsLoaded) return;
  api.setsLoaded = true;
  const sel = $("#apiSets");
  sel.innerHTML = `<option value="">Loading sets…</option>`;
  try {
    const r = await TcgApi.sets();
    const sets = (r.data || []).slice().sort((a, b) => String(b.published_on || b.release_date || "").localeCompare(String(a.published_on || a.release_date || "")));
    sel.innerHTML = `<option value="">Pick a set…</option>` + sets.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}${x.card_count ? ` (${x.card_count})` : ""}</option>`).join("");
  } catch (e) { api.setsLoaded = false; sel.innerHTML = `<option value="">Load sets (1 request)</option>`; apiError(e); }
  showQuota();
});
$("#apiSets").addEventListener("change", () => {
  const id = $("#apiSets").value;
  if (!id) return;
  Object.assign(api, { mode: "set", setId: id, page: 1, items: [] });
  $("#apiTitle").textContent = $("#apiSets").selectedOptions[0].textContent;
  apiLoad();
});
$("#apiSearch").addEventListener("click", () => {
  const q = $("#apiQ").value.trim();
  if (!q) return toast("Type a card name", true);
  Object.assign(api, { mode: "search", q, page: 1, items: [] });
  $("#apiTitle").textContent = `Results for "${q}"`;
  apiLoad();
});
$("#apiQ").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#apiSearch").click(); });
$("#apiMore").addEventListener("click", () => { api.page++; apiLoad(); });

async function apiLoad() {
  if (api.page === 1) $("#apiResults").innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const r = api.mode === "set" ? await TcgApi.setCards(api.setId, api.page) : await TcgApi.search(api.q, api.page);
    const got = (r.data || []).filter(isSingleCard);
    api.items.push(...got);
    const m = r.meta || {};
    const more = m.has_more ?? m.hasMore ?? (m.total ? api.items.length < m.total && (r.data || []).length > 0 : false);
    $("#apiMore").hidden = !more;
    renderApi();
  } catch (e) { apiError(e); }
  showQuota();
}
const hasAttrs = (d) => Object.keys(apiAttrs(d)).length > 0;
function renderApi() {
  const names = new Set(cards.map((c) => c.name.toLowerCase()));
  const useImg = $("#apiImages").checked;
  $("#apiImportAll").hidden = !api.items.length;
  if (!api.items.length) { $("#apiResults").innerHTML = `<p class="muted">No single cards found.</p>`; return; }
  $("#apiResults").innerHTML = api.items.map((d, i) => {
    const c = apiToCard(d);
    const have = names.has(c.name.toLowerCase());
    const stats = hasAttrs(d) ? `${c.type === "order" ? "Order" : "G" + c.grade} · ${c.power} · SH ${c.shield}${c.trigger ? " · " + TRIG[c.trigger].name : ""}` : "Stats load on import";
    return `<div class="oc${have ? " done" : ""}">
      ${useImg && d.image_url ? `<img src="${esc($("#cgsLocal").checked ? cgsLocalImage(d._set, d.number) : d.image_url)}" alt="" loading="lazy">` : `<div class="noimg">No image</div>`}
      <b>${esc(c.name)}</b>
      <small>${esc([d.number, d.rarity, d.set_name].filter(Boolean).join(" · "))}</small>
      <small>${esc(stats)}</small>
      <button data-imp="${i}" class="${have ? "" : "go"}">${have ? "Update card" : "Import"}</button>
      <details><summary>Raw data</summary><pre>${esc(JSON.stringify(d.custom_attributes || d, null, 1))}</pre></details>
    </div>`;
  }).join("");
}
$("#apiImages").addEventListener("change", renderApi);

async function importApiItem(d) {
  if (!hasAttrs(d)) {
    const full = await TcgApi.card(d.id);
    d = { ...d, ...(full.data || {}) };
  }
  const c = apiToCard(d);
  if (!$("#apiImages").checked) c.image = "";
  const old = cards.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
  if (old) {
    // keep abilities you already fixed by hand; refresh everything else
    await DB.put("cards", { ...old, ...c, id: old.id, abilities: (old.abilities || []).length ? old.abilities : c.abilities });
  } else {
    await DB.put("cards", { ...c, id: DB.newId() });
  }
  return c;
}
$("#apiResults").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-imp]");
  if (!b) return;
  b.disabled = true; b.textContent = "Importing…";
  try {
    const c = await importApiItem(api.items[+b.dataset.imp]);
    await reload(); renderList(); renderApi();
    toast(`${c.name}: imported with ${c.abilities.length} abilit${c.abilities.length === 1 ? "y" : "ies"}. Check it in the Cards tab.`);
  } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Import"; }
  showQuota();
});
$("#apiImportAll").addEventListener("click", async () => {
  const todo = api.items;
  const cost = todo.filter((d) => !hasAttrs(d)).length;
  if (!window.confirm(`Import ${todo.length} cards?${cost ? ` This uses about ${cost} API requests.` : ""}`)) return;
  let ok = 0;
  for (const d of todo) {
    try { await importApiItem(d); ok++; } catch (err) { toast(`Stopped after ${ok}: ${err.message}`, true); break; }
  }
  await reload(); renderList(); renderApi(); showQuota();
  toast(`Imported ${ok} cards. Check their abilities in the Cards tab.`);
});

// ---------- card library (CGS community files on GitHub) ----------
const cgs = { items: [], shown: 60, all: false, pick: {} };
const cgsKey = (d) => d.number || d.name;
function cgsStatus(m, bad) { $("#cgsStatus").innerHTML = bad ? `<span class="errs">${esc(m)}</span>` : esc(m); }
(async () => {
  try {
    const sets = await Cgs.allSets();
    $("#cgsSets").innerHTML = `<option value="">Pick a set…</option>` +
      sets.slice().reverse().map((x) => `<option value="${esc(x.code)}">${esc(x.name.replace(/^\[[^\]]*\]\s*/, "").replace(/^Cardfight!! Vanguard\s*/i, ""))}</option>`).join("");
  } catch (e) { $("#cgsSets").innerHTML = `<option value="">Couldn't load sets</option>`; cgsStatus(e.message, true); }
})();
$("#cgsSets").addEventListener("change", async () => {
  const code = $("#cgsSets").value;
  if (!code) return;
  cgs.all = false;
  $("#cgsTitle").textContent = $("#cgsSets").selectedOptions[0].textContent;
  $("#cgsResults").innerHTML = `<p class="muted">Loading…</p>`;
  try { cgs.items = await Cgs.setCards(code); cgs.shown = 60; renderCgs(); }
  catch (e) { $("#cgsResults").innerHTML = ""; cgsStatus(e.message, true); }
});
$("#cgsAll").addEventListener("click", async () => {
  $("#cgsAll").disabled = true;
  try {
    cgs.items = await Cgs.everything((n, t) => cgsStatus(`Loading sets ${n}/${t}…`));
    cgs.all = true; cgs.shown = 60;
    cgsStatus(`${cgs.items.length.toLocaleString()} cards loaded. Type a name to search.`);
    $("#cgsTitle").textContent = "All sets";
    $("#cgsSets").value = "";
    renderCgs();
  } catch (e) { cgsStatus(e.message, true); }
  $("#cgsAll").disabled = false;
});
let cgsTimer;
$("#cgsQ").addEventListener("input", () => { clearTimeout(cgsTimer); cgsTimer = setTimeout(() => { cgs.shown = 60; renderCgs(); }, 200); });
$("#cgsType").addEventListener("change", () => { cgs.shown = 60; renderCgs(); });
$("#cgsImages").addEventListener("change", renderCgs);
(() => { try { $("#cgsLocal").checked = localStorage.getItem("vt-cgs-local") === "1"; } catch { /* storage blocked */ } })();
$("#cgsLocal").addEventListener("change", () => { try { localStorage.setItem("vt-cgs-local", $("#cgsLocal").checked ? "1" : "0"); } catch { /* storage blocked */ } renderCgs(); });
$("#cgsRelink").addEventListener("click", async () => {
  const todo = cards.filter((c) => c.source && c.source.from === "cgs" && c.source.setCode && c.source.number);
  const old = cards.filter((c) => c.source && c.source.from === "cgs" && !c.source.setCode).length;
  if (!todo.length) return toast(old ? "Re-import these cards once from the Card library so they know their set, then try again." : "No cards imported from the Card library yet.", true);
  if (!window.confirm(`Point ${todo.length} cards at pictures in vanguard_images?`)) return;
  for (const c of todo) await DB.put("cards", { ...c, image: cgsLocalImage(c.source.setCode, c.source.number) });
  await reload(); renderList();
  toast(`${todo.length} cards now use local pictures.${old ? ` ${old} older imports need a re-import first.` : ""}`);
});
$("#cgsMore").addEventListener("click", () => { cgs.shown += 60; renderCgs(); });

function cgsFiltered() {
  const q = $("#cgsQ").value.trim().toLowerCase(), t = $("#cgsType").value;
  const seen = new Set();
  return cgs.items.filter((d) => {
    if (!CGS_PLAYABLE.test(d.type)) return false;
    if (t && (t === "Order" ? !/Order/.test(d.type) : d.type !== t)) return false;
    if (q && !(`${d.name} ${d.clan}`.toLowerCase().includes(q))) return false;
    if (cgs.all) { const k = d.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); } // reprints: show once
    return true;
  });
}
function renderCgs() {
  const list = cgsFiltered();
  const names = new Set(cards.map((c) => c.name.toLowerCase()));
  const useImg = $("#cgsImages").checked;
  $("#cgsCount").hidden = !cgs.items.length;
  $("#cgsCount").textContent = `${list.length.toLocaleString()} cards`;
  $("#cgsImportAll").hidden = !list.length;
  if (!cgs.busy) $("#cgsImportAll").textContent = `Import all ${list.length.toLocaleString()}`;
  $("#cgsMore").hidden = list.length <= cgs.shown;
  if (!list.length) { $("#cgsResults").innerHTML = `<p class="muted">${cgs.items.length ? "No matching cards." : "Pick a set."}</p>`; return; }
  const trigOpts = (d) => {
    const v = cgs.pick[cgsKey(d)] ?? cgsTriggerGuess(d) ?? "";
    return `<select data-trig="${esc(cgsKey(d))}" class="${v ? "" : "warn"}"><option value="">? trigger</option>${Object.entries(TRIG).map(([k, x]) => `<option value="${k}" ${v === k ? "selected" : ""}>${esc(x.icon + " " + x.name)}</option>`).join("")}</select>`;
  };
  $("#cgsResults").innerHTML = list.slice(0, cgs.shown).map((d) => {
    const have = names.has(d.name.trim().toLowerCase());
    const stats = /Order/.test(d.type) ? d.type : `G${d.grade ?? "?"} · ${d.power ?? "-"} · SH ${d.shield ?? "-"}`;
    return `<div class="oc${have ? " done" : ""}">
      ${useImg && d.image_url ? `<img src="${esc(d.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="noimg">No image</div>`}
      <b>${esc(d.name)}</b>
      <small>${esc([d.number, d.clan].filter(Boolean).join(" · "))}</small>
      <small>${esc(stats)}</small>
      ${d.type === "Trigger Unit" ? trigOpts(d) : ""}
      <button data-cgs="${esc(cgsKey(d))}" class="${have ? "" : "go"}">${have ? "Update card" : "Import"}</button>
      <details><summary>Card text</summary><pre>${esc(d.effect || "(no text)")}</pre></details>
    </div>`;
  }).join("");
}
$("#cgsResults").addEventListener("change", (e) => {
  const s = e.target.closest("[data-trig]");
  if (!s) return;
  cgs.pick[s.dataset.trig] = s.value;
  s.classList.toggle("warn", !s.value);
});
// byName: optional Map(lower-case name -> saved card), kept up to date during a bulk import
async function importCgsItem(d, byName) {
  const picked = cgs.pick[cgsKey(d)];
  const c = cgsToCard(d, picked === undefined ? undefined : (picked || null));
  if (!$("#cgsImages").checked) c.image = "";
  else if ($("#cgsLocal").checked) c.image = cgsLocalImage(d._set, d.number);
  const key = c.name.toLowerCase();
  const old = byName ? byName.get(key) : cards.find((x) => x.name.toLowerCase() === key);
  let saved;
  if (old) {
    const keep = { abilities: (old.abilities || []).length ? old.abilities : c.abilities };
    if (old.trigger && !c.trigger) { keep.trigger = old.trigger; keep.needsTrigger = false; } // don't wipe a type you set by hand
    saved = { ...old, ...c, ...keep, id: old.id };
  } else {
    saved = { ...c, id: DB.newId() };
  }
  await DB.put("cards", saved);
  if (byName) byName.set(key, saved);
  return c;
}
$("#cgsResults").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-cgs]");
  if (!b) return;
  const d = cgsFiltered().find((x) => cgsKey(x) === b.dataset.cgs);
  if (!d) return;
  b.disabled = true; b.textContent = "Importing…";
  try {
    const c = await importCgsItem(d);
    await reload(); renderList(); renderCgs();
    toast(`${c.name}: imported with ${c.abilities.length} abilit${c.abilities.length === 1 ? "y" : "ies"}${c.needsTrigger ? ". ⚠ Set its trigger type" : ""}. Check it in the Cards tab.`, c.needsTrigger);
  } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = "Import"; }
});
// Imports every card in the current list (set / search / type filter). Click again while running to stop.
$("#cgsImportAll").addEventListener("click", async () => {
  const btn = $("#cgsImportAll");
  if (cgs.busy) { cgs.stop = true; btn.textContent = "Stopping…"; return; }
  // Same name twice in the list (reprints, alt arts): import it once
  const seenNames = new Set();
  const todo = cgsFiltered().filter((d) => { const k = d.name.trim().toLowerCase(); if (seenNames.has(k)) return false; seenNames.add(k); return true; });
  const unset = todo.filter((d) => d.type === "Trigger Unit" && !(cgs.pick[cgsKey(d)] ?? cgsTriggerGuess(d))).length;
  const big = todo.length > 1000 ? `\n\nThat's a lot of cards: it can take a few minutes and makes the Cards list long. You can stop it with the same button.` : "";
  if (!window.confirm(`Import ${todo.length.toLocaleString()} cards?${unset ? `\n${unset} trigger(s) have no type yet and will be marked ⚠.` : ""}${big}`)) return;
  const byName = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
  Object.assign(cgs, { busy: true, stop: false });
  let ok = 0, failed = 0;
  for (const d of todo) {
    if (cgs.stop) break;
    try { await importCgsItem(d, byName); ok++; } catch { failed++; }
    if (ok % 20 === 0) btn.textContent = `Importing ${ok.toLocaleString()}/${todo.length.toLocaleString()}… (click to stop)`;
  }
  const stopped = cgs.stop;
  Object.assign(cgs, { busy: false, stop: false });
  await reload(); renderList(); renderCgs();
  toast(`${stopped ? "Stopped. " : ""}Imported ${ok.toLocaleString()} cards${failed ? `, ${failed} failed` : ""}. Check their abilities in the Cards tab.`, failed > 0);
});

// ---------- link pictures from a folder by file name ----------
const picKey = (s) => String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9ก-๙]+/g, "");
$("#picFolder").addEventListener("change", async (e) => {
  const files = [...e.target.files].filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.name));
  e.target.value = "";
  if (!files.length) return toast("No pictures found in that folder", true);
  const byKey = new Map();
  cards.forEach((c) => {
    byKey.set(picKey(c.name), c);
    if (c.source && c.source.number) byKey.set(picKey(c.source.number), c);
  });
  const overwrite = $("#picOverwrite").checked, linked = [], skipped = [], unknown = [];
  for (const f of files) {
    const c = byKey.get(picKey(f.name));
    if (!c) { unknown.push(f.name); continue; }
    if (c.image && !overwrite && !/^https?:/i.test(c.image)) { skipped.push(f.name); continue; }
    const path = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    await DB.put("cards", { ...c, image: path });
    linked.push(`${c.name} ← ${path}`);
  }
  await reload(); renderList();
  $("#picResult").innerHTML = `<p class="okmsg">Linked ${linked.length} card${linked.length === 1 ? "" : "s"}.</p>
    ${skipped.length ? `<p class="muted">${skipped.length} skipped (card already has a picture; tick "Also replace" to change them).</p>` : ""}
    ${unknown.length ? `<details><summary>${unknown.length} files didn't match a card</summary><pre>${esc(unknown.join("\n"))}</pre></details>` : ""}
    ${linked.length ? `<details><summary>Show linked</summary><pre>${esc(linked.join("\n"))}</pre></details>` : ""}`;
  toast(`Linked ${linked.length} pictures${unknown.length ? ` · ${unknown.length} unmatched` : ""}`);
});

window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

(async () => {
  await DB.removeSamples();
  await reload();
  renderList();
  renderCard();
})();
