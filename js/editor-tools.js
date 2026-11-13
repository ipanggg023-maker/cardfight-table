// Admin card tools, part 2 (loaded after editor.js; uses its globals cur, cards, allCards, dirty, renderCard, renderList, reload, toast).
// Reprints (one edit → every copy), ability templates, bulk edit, card history + restore, review queue + shortcuts,
// set filter + progress board. Server parts: supabase/006_card_tools.sql (card_history, ability_templates).
const Tools = (() => {
  const isAccount = () => { const u = Auth.get(); return !!u && !u.guest; };
  const norm = (s) => String(s || "").toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  const setOf = (c) => (c.source && (c.source.setCode || c.source.set)) || (c.number ? String(c.number).split("/")[0] : "") || "";

  // ---------- reprints: same name + same official text = the same game card ----------
  const reprintKey = (c) => norm(c.name) + "|" + norm(c.text);
  function reprintsOf(c) {
    if (!c) return [];
    const k = reprintKey(c);
    return allCards.filter((x) => x.id !== c.id && reprintKey(x) === k);
  }
  // fields that belong to the card's game rules (pictures, set data and format icon stay per printing)
  const KEEP = new Set(["id", "image", "source", "icon", "number"]);
  function gameFields(c) { const o = {}; for (const [k, v] of Object.entries(c)) if (!KEEP.has(k)) o[k] = v; return JSON.parse(JSON.stringify(o)); }
  async function syncReprints(c) {
    const list = reprintsOf(c);
    const data = gameFields(c);
    for (const x of list) await DB.put("cards", { ...x, ...data });
    return list.length;
  }

  // ---------- ability templates ----------
  const BUILTIN = [
    ["On attack: +5000 power (CB 1)", { kind: "AUTO", zone: "VC/RC", when: "attack", once: "", conds: [], costs: [{ type: "CB", n: 1 }], effects: [{ type: "power", target: "self", amount: 5000, dur: "battle" }] }],
    ["On boost: +5000 to the boosted unit", { kind: "AUTO", zone: "RC", when: "boost", once: "", mandatory: true, conds: [], costs: [], effects: [{ type: "power", target: "attacker", amount: 5000, dur: "battle" }] }],
    ["On hit (vanguard): draw 1", { kind: "AUTO", zone: "VC", when: "attackHit", once: "", conds: [{ type: "targetVC" }], costs: [], effects: [{ type: "draw", n: 1 }] }],
    ["Placed on RC: Soul-Charge 1", { kind: "AUTO", zone: "RC", when: "placedRC", once: "", conds: [], costs: [], effects: [{ type: "SC", n: 1 }] }],
    ["Placed on VC: draw 1 (CB 1)", { kind: "AUTO", zone: "VC", when: "placedVC", once: "", conds: [], costs: [{ type: "CB", n: 1 }], effects: [{ type: "draw", n: 1 }] }],
    ["Your turn: +5000 if you have 3+ damage (CONT)", { kind: "CONT", zone: "VC/RC", once: "", conds: [{ type: "myTurn" }, { type: "myDamage", n: 3 }], costs: [], effects: [{ type: "power", target: "self", amount: 5000 }] }],
    ["[ACT] 1/Turn: SB 1, draw 1", { kind: "ACT", zone: "VC", once: "turn", conds: [], costs: [{ type: "SB", n: 1 }], effects: [{ type: "draw", n: 1 }] }],
    ["Quick Shield: when ridden upon, draw 1 and get a Quick Shield ticket", { kind: "AUTO", zone: "VC", when: "riddenUpon", once: "", mandatory: true, conds: [], costs: [], effects: [{ type: "draw", n: 1 }, { type: "ticket", name: "Quick Shield", n: 1, who: "me" }] }],
    ["Plant token: call a Plant token", { kind: "AUTO", zone: "RC", when: "placedRC", once: "", conds: [], costs: [{ type: "CB", n: 1 }], effects: [{ type: "token", name: "Plant", n: 1, where: "any" }] }],
    ["Harmony: +5000 while in harmony (CONT)", { kind: "CONT", zone: "RC", once: "", conds: [{ type: "unit", who: "self", filter: { state: "harmony" } }], costs: [], effects: [{ type: "power", target: "self", amount: 5000 }] }],
    ["Success N: +5000 if a rear-guard has 20000+ power (CONT)", { kind: "CONT", zone: "RC", once: "", conds: [{ type: "myTurn" }, { type: "power", who: "anyRC", op: "ge", n: 20000 }], costs: [], effects: [{ type: "power", target: "self", amount: 5000 }] }],
    ["Engorge: when it attacks, retire your other rear-guards → engorged", { kind: "AUTO", zone: "VC/RC", when: "attack", once: "", conds: [], costs: [], effects: [{ type: "move", from: "myRC", to: "drop", n: 2, upTo: true, chooser: "me", filter: { other: true } }, { type: "setState", name: "engorged", target: "self", dur: "turn", onlyIf: "did" }] }],
    ["Shadowstitch: when its attack on a vanguard does not hit", { kind: "AUTO", zone: "VC/RC", when: "attackNoHit", once: "", conds: [{ type: "targetVC" }], costs: [], effects: [{ type: "SC", n: 1 }] }],
    ["Restraint: this unit cannot attack (CONT)", { kind: "CONT", zone: "RC", once: "", conds: [], costs: [], effects: [{ type: "restrict", what: "cantAttack", target: "self" }] }],
    ["Column: +5000 if another unit is in this unit's column (Friend)", { kind: "CONT", zone: "RC", once: "", conds: [{ type: "count", what: "myColumn", op: "ge", n: 1 }], costs: [], effects: [{ type: "power", target: "self", amount: 5000 }] }],
    ["RevolDress: at the end of its battle, ride it as [Stand] (CB 1)", { kind: "AUTO", zone: "RC", when: "battleEnd", once: "turn", conds: [], costs: [{ type: "CB", n: 1 }], effects: [{ type: "rideBy", from: "self", stand: true }] }],
    ["Prison: imprison 1 of your opponent's rear-guards", { kind: "ORDER", once: "", conds: [], costs: [], effects: [{ type: "move", from: "oppRC", to: "prison", n: 1, chooser: "me" }] }],
    ["✋ Manual effect (type what the card does)", { kind: "AUTO", zone: "VC/RC", when: "attack", once: "", conds: [], costs: [], effects: [{ type: "manual", text: "Describe what the card does" }] }],
  ];
  let mine = null; // [{id, name, data}] from the server (admins) or localStorage (guests)
  const LS = "vt-ab-templates";
  async function loadTemplates() {
    if (mine) return mine;
    if (isAccount()) {
      try {
        const cl = await Cloud.client();
        const { data, error } = await cl.from("ability_templates").select("id, name, data").order("name");
        if (error) throw error;
        return (mine = data);
      } catch (e) { console.warn("Templates:", e.message || e); }
    }
    try { mine = JSON.parse(localStorage.getItem(LS) || "[]"); } catch { mine = []; }
    return mine;
  }
  async function saveTemplate(name, ab) {
    const data = JSON.parse(JSON.stringify(ab));
    if (isAccount()) {
      const cl = await Cloud.client();
      const { data: row, error } = await cl.from("ability_templates").insert({ name, data }).select("id, name, data").single();
      if (error) throw error;
      (mine = mine || []).push(row);
    } else {
      mine = mine || [];
      mine.push({ id: Date.now(), name, data });
      try { localStorage.setItem(LS, JSON.stringify(mine)); } catch { throw new Error("Browser storage is full or blocked"); }
    }
  }
  async function deleteTemplate(id) {
    if (isAccount()) { const cl = await Cloud.client(); const { error } = await cl.from("ability_templates").delete().eq("id", id); if (error) throw error; }
    mine = (mine || []).filter((t) => t.id !== id);
    if (!isAccount()) try { localStorage.setItem(LS, JSON.stringify(mine)); } catch {}
  }
  const allTemplates = () => [...(mine || []).map((t) => ({ id: t.id, name: t.name, data: t.data, own: true })), ...BUILTIN.map(([name, data], i) => ({ id: "b" + i, name: "★ " + name, data }))];

  // ---------- history (accounts: server versions) ----------
  async function history(cardId) {
    const cl = await Cloud.client();
    const { data, error } = await cl.from("card_history").select("id, data, deleted, saved_by, saved_at").eq("card_id", cardId).order("saved_at", { ascending: false }).limit(30);
    if (error) throw error;
    return data;
  }
  // short list of what changed between two versions of a card
  function diff(a, b) {
    if (!a) return ["(card created)"];
    if (!b) return ["(card deleted)"];
    const out = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (k === "abilities") {
        const x = a.abilities || [], y = b.abilities || [];
        if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`abilities: ${x.length} → ${y.length}${x.length === y.length ? " (edited)" : ""}`);
      } else if (k === "image") { if (a.image !== b.image) out.push("picture changed"); }
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}: ${short(a[k])} → ${short(b[k])}`);
    }
    return out.length ? out : ["no change"];
  }
  const short = (v) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s === undefined ? "—" : s.length > 40 ? s.slice(0, 37) + "…" : s; };

  // ---------- review order: cards in Store boxes first ----------
  let boxIds = null;
  async function loadBoxCards() {
    if (boxIds || !isAccount() || !Auth.isAdmin()) return boxIds || new Set();
    try {
      const cl = await Cloud.client();
      const { data, error } = await cl.from("box_cards").select("card_id").limit(10000);
      if (error) throw error;
      boxIds = new Set(data.map((r) => r.card_id));
    } catch { boxIds = new Set(); }
    return boxIds;
  }
  const inBox = (id) => !!(boxIds && boxIds.has(id));

  return { reprintsOf, syncReprints, gameFields, loadTemplates, saveTemplate, deleteTemplate, allTemplates, history, diff, setOf, loadBoxCards, inBox, isAccount };
})();

// ================= editor wiring =================
// ---------- set filter, sort, progress board ----------
function fillSets() {
  const el = $("#qset"), v = el.value;
  const sets = [...new Set(cards.map(Tools.setOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  el.hidden = !sets.length;
  const html = `<option value="">All sets</option>` + sets.map((s) => `<option ${s === v ? "selected" : ""}>${esc(s)}</option>`).join("");
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
function renderBoard() {
  const box = $("#board");
  if (box.hidden) return;
  const rows = {};
  for (const c of cards) {
    const s = Tools.setOf(c) || "(no set)", st = CardCheck.analyze(c).status;
    (rows[s] = rows[s] || { n: 0 })[st] = (rows[s][st] || 0) + 1;
    rows[s].n++;
  }
  const keys = Object.keys(rows).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const pct = (r) => Math.round((((r.auto || 0) + (r.manual || 0) + (r.vanilla || 0)) / r.n) * 100);
  box.innerHTML = `<div class="bd-head"><b>Progress by set</b><span class="muted">done = ✅ automatic + ✋ manual + · no abilities</span><button data-board="close">✕</button></div>
    <table class="bd"><thead><tr><th>Set</th><th>Cards</th><th>Done</th><th>✅</th><th>✋</th><th>⚠</th><th>◻</th><th>·</th></tr></thead><tbody>
    ${keys.map((k) => { const r = rows[k], p = pct(r); return `<tr data-set="${esc(k === "(no set)" ? "" : k)}"><td>${esc(k)}</td><td>${r.n}</td><td><span class="bar"><i style="transform:scaleX(${p / 100})"></i></span> ${p}%</td><td>${r.auto || ""}</td><td>${r.manual || ""}</td><td>${r.gaps || ""}</td><td>${r.none || ""}</td><td>${r.vanilla || ""}</td></tr>`; }).join("")}</tbody></table>`;
}
$("#qset").addEventListener("change", renderList);
$("#qsort").addEventListener("change", renderList);
$("#boardBtn").addEventListener("click", () => { $("#board").hidden = !$("#board").hidden; renderBoard(); });
$("#board").addEventListener("click", (e) => {
  if (e.target.closest("[data-board=close]")) { $("#board").hidden = true; return; }
  const tr = e.target.closest("tr[data-set]");
  if (tr && tr.dataset.set) { $("#qset").value = tr.dataset.set; $("#board").hidden = true; renderList(); }
});

// ---------- review queue: next / previous card in the current list + shortcuts ----------
function goCard(step) {
  const ids = [...document.querySelectorAll("#cardList li[data-id]")].map((li) => li.dataset.id);
  if (!ids.length) return;
  let i = cur ? ids.indexOf(cur.id) : -1;
  i = i < 0 ? (step > 0 ? 0 : ids.length - 1) : (i + step + ids.length) % ids.length;
  if (dirty && !window.confirm("Discard unsaved changes?")) return;
  cur = JSON.parse(JSON.stringify(cards.find((c) => c.id === ids[i])));
  dirty = false;
  renderList();
  renderCard();
  const li = document.querySelector(`#cardList li[data-id="${CSS.escape(ids[i])}"]`);
  if (li) li.scrollIntoView({ block: "nearest" });
}
$("#prevCard").addEventListener("click", () => goCard(-1));
$("#nextCard").addEventListener("click", () => goCard(1));
document.addEventListener("keydown", (e) => {
  if ($("#tab-cards").hidden) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "s") { e.preventDefault(); const b = document.querySelector('#cardForm [data-do="save"]'); if (b) b.click(); }
  else if ((e.ctrlKey || e.metaKey) && k === "enter") { e.preventDefault(); const b = document.querySelector('#cardForm [data-do="test"]'); if (b) b.click(); }
  else if (e.altKey && (k === "arrowdown" || k === "n")) { e.preventDefault(); goCard(1); }
  else if (e.altKey && (k === "arrowup" || k === "p")) { e.preventDefault(); goCard(-1); }
});

// ---------- bulk edit ----------
const picked = new Set();
function renderBulk() {
  const on = $("#bulkMode").checked;
  document.body.classList.toggle("bulk-on", on);
  const box = $("#bulkBox");
  box.hidden = !on;
  if (!on) return;
  box.innerHTML = `<b>${picked.size} selected</b>
    <button data-bulk="all">Select all in list</button><button data-bulk="none">Clear</button>
    <div class="bulk-row">
      <select id="bkField"><option value="nation">Nation</option><option value="clan">Clan</option><option value="race">Race</option><option value="icon">Format icon (D / V / -)</option><option value="trigger">Trigger (crit/front/draw/heal/over/stand/none)</option><option value="grade">Grade</option><option value="sentinel">Sentinel (yes/no)</option><option value="persona">Persona Ride (yes/no)</option></select>
      <input id="bkValue" placeholder="value"><button data-bulk="set">Set</button>
    </div>
    <div class="bulk-row"><button data-bulk="copyAb" ${cur ? "" : "disabled"}>Copy the open card's abilities to them</button><button data-bulk="addAb" ${cur && cur.abilities.length ? "" : "disabled"}>Add the open card's abilities</button></div>
    <div class="bulk-row"><button data-bulk="del" class="del">Delete selected</button></div>`;
}
$("#bulkMode").addEventListener("change", () => { picked.clear(); renderBulk(); renderList(); });
$("#cardList").addEventListener("click", (e) => {
  if (!$("#bulkMode").checked) return;
  const li = e.target.closest("[data-id]");
  if (!li) return;
  e.stopImmediatePropagation();
  picked.has(li.dataset.id) ? picked.delete(li.dataset.id) : picked.add(li.dataset.id);
  li.classList.toggle("picked", picked.has(li.dataset.id));
  renderBulk();
}, true);
$("#bulkBox").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-bulk]");
  if (!b) return;
  const act = b.dataset.bulk;
  if (act === "all") { document.querySelectorAll("#cardList li[data-id]").forEach((li) => picked.add(li.dataset.id)); renderList(); return renderBulk(); }
  if (act === "none") { picked.clear(); renderList(); return renderBulk(); }
  const list = cards.filter((c) => picked.has(c.id));
  if (!list.length) return toast("Select cards first (click them in the list)", true);
  const field = $("#bkField").value, raw = $("#bkValue").value.trim();
  let change;
  if (act === "set") {
    const yes = /^(y|yes|true|1)$/i.test(raw);
    const val = field === "grade" ? +raw : field === "trigger" ? (raw && raw !== "none" ? raw : null) : ["sentinel", "persona"].includes(field) ? yes : raw;
    if (field === "trigger" && val && !TRIG[val]) return toast("Trigger must be crit, front, draw, heal, over, stand or none", true);
    if (field === "grade" && !(val >= 0 && val <= 5)) return toast("Grade must be a number 0–5", true);
    change = (c) => ({ ...c, [field]: val });
    if (!window.confirm(`Set ${field} = ${JSON.stringify(val)} on ${list.length} cards?`)) return;
  } else if (act === "copyAb") {
    if (!window.confirm(`Replace the abilities of ${list.length} cards with the ${cur.abilities.length} abilities of ${cur.name}?`)) return;
    change = (c) => ({ ...c, abilities: JSON.parse(JSON.stringify(cur.abilities)) });
  } else if (act === "addAb") {
    if (!window.confirm(`Add ${cur.abilities.length} abilities of ${cur.name} to ${list.length} cards?`)) return;
    change = (c) => ({ ...c, abilities: [...(c.abilities || []), ...JSON.parse(JSON.stringify(cur.abilities))] });
  } else if (act === "del") {
    if (!window.confirm(`Delete ${list.length} cards? Decks that use them will show them as missing.`)) return;
    for (const c of list) await DB.del("cards", c.id);
    picked.clear(); await reload(); renderList(); renderBulk();
    return toast(`Deleted ${list.length} cards`);
  }
  for (const c of list) await DB.put("cards", change(c));
  await reload(); renderList(); renderBulk();
  toast(`Updated ${list.length} cards`);
});

// ---------- card form extras: reprints, templates, history ----------
function cardExtrasHTML(c) {
  const re = Tools.reprintsOf(c);
  return `<div class="cx">
    ${re.length ? `<label class="chk" title="Same name and same text = the same card in another set"><input type="checkbox" id="syncReprints" checked> Also update ${re.length} reprint${re.length === 1 ? "" : "s"} when saving <small class="muted">(${esc(re.slice(0, 6).map((x) => Tools.setOf(x) || x.number || "no set").join(", "))}${re.length > 6 ? "…" : ""})</small></label>` : `<span class="muted">No reprints found (same name + same text).</span>`}
    <span class="cx-btns"><button data-x="history">🕘 History</button></span>
  </div>`;
}
function abilityExtrasHTML(ai) { return `<button data-x="saveTpl" data-i="${ai}" title="Save this ability as a template">★ Template</button>`; }
async function templatePicker() {
  const list = (await Tools.loadTemplates(), Tools.allTemplates());
  const sel = $("#tplPick");
  if (sel) sel.innerHTML = `<option value="">+ Add from template…</option>` + list.map((t) => `<option value="${esc(String(t.id))}">${esc(t.name)}</option>`).join("");
}
$("#cardForm").addEventListener("change", (e) => {
  if (e.target.id !== "tplPick" || !e.target.value || !cur) return;
  const t = Tools.allTemplates().find((x) => String(x.id) === e.target.value);
  if (t) { cur.abilities.push(JSON.parse(JSON.stringify(t.data))); dirty = true; renderCard(); toast(`Added “${t.name.replace(/^★ /, "")}”`); }
});
$("#cardForm").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-x]");
  if (!b || !cur) return;
  if (b.dataset.x === "saveTpl") {
    const ab = cur.abilities[+b.dataset.i];
    const name = window.prompt("Template name:", describeAbility(ab).slice(0, 60));
    if (!name) return;
    try { await Tools.saveTemplate(name.trim().slice(0, 80), ab); await templatePicker(); toast("Template saved"); } catch (err) { toast(err.message || String(err), true); }
  }
  if (b.dataset.x === "delTpl") {
    const id = $("#tplPick").value;
    const t = Tools.allTemplates().find((x) => String(x.id) === id);
    if (!t || !t.own) return toast("Pick one of your own templates in the list first", true);
    if (!window.confirm(`Delete the template “${t.name}”?`)) return;
    await Tools.deleteTemplate(t.id); await templatePicker(); toast("Template deleted");
  }
  if (b.dataset.x === "history") openHistory();
});
async function openHistory() {
  const box = $("#histBox");
  box.hidden = false;
  if (!Tools.isAccount()) { box.innerHTML = `<div class="hb-head"><b>History</b><button data-h="close">✕</button></div><p class="muted">History is kept on the server for admin accounts. Sign in with your admin account to use it.</p>`; return; }
  box.innerHTML = `<div class="hb-head"><b>History · ${esc(cur.name)}</b><button data-h="close">✕</button></div><p class="muted">Loading…</p>`;
  try {
    const rows = await Tools.history(cur.id);
    const now = allCards.find((c) => c.id === cur.id);
    box.innerHTML = `<div class="hb-head"><b>History · ${esc(cur.name)}</b><button data-h="close">✕</button></div>
      ${rows.length ? "" : '<p class="muted">No earlier versions yet. Every save from now on keeps the version before it (up to 30).</p>'}
      ${rows.map((r, i) => `<div class="hb-row"><div><b>${new Date(r.saved_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</b>
        <small class="muted">replaced by a save${r.deleted ? " (was deleted)" : ""}</small>
        <ul>${Tools.diff(r.data, i === 0 ? now : rows[i - 1].data).map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
        ${r.data ? `<button data-h="restore" data-i="${i}">Restore this version</button>` : ""}</div>`).join("")}`;
    box._rows = rows;
  } catch (err) { box.innerHTML = `<div class="hb-head"><b>History</b><button data-h="close">✕</button></div><p class="errs">${esc(err.message || err)} (run supabase/006_card_tools.sql)</p>`; }
}
$("#histBox").addEventListener("click", (e) => {
  const b = e.target.closest("[data-h]");
  if (!b) return;
  if (b.dataset.h === "close") { $("#histBox").hidden = true; return; }
  const r = $("#histBox")._rows[+b.dataset.i];
  if (!r || !r.data || !window.confirm("Load this version into the form? Press Save to keep it.")) return;
  cur = { ...JSON.parse(JSON.stringify(r.data)), id: cur.id };
  dirty = true;
  $("#histBox").hidden = true;
  renderCard();
  toast("Old version loaded: check it, then Save");
});
