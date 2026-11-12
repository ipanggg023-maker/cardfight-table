// Admin page: players (roles, coins, cards, bans, names), match history, packs opened, admin log.
// Every change goes through admin_* functions on the server, which check the admin role again
// (supabase/001_accounts.sql, 003_store.sql, 005_admin.sql) and write to admin_log.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const A = { users: [], byId: {}, cards: {}, boxes: {}, sel: null, owned: null, cardQ: "", loaded: {} };
const me = Auth.get();
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
const when = (t) => (t ? new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const nameOf = (id) => (A.byId[id] ? A.byId[id].name : id ? "(deleted account)" : "—");
const cardName = (id) => (A.cards[id] ? A.cards[id].name : id);
const who = (id) => { const u = A.byId[id]; return `<span class="who-mini"><i style="background:${esc(u ? u.color : "#5d7598")}"></i>${esc(nameOf(id))}</span>`; };

// ---------- loading ----------
async function loadUsers() {
  A.users = await Cloud.rpc("admin_users");
  A.byId = Object.fromEntries(A.users.map((u) => [u.id, u]));
}
async function rows(table, order, limit = 200) {
  const cl = await Cloud.client();
  const { data, error } = await cl.from(table).select("*").order(order, { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

// ---------- tabs ----------
document.querySelectorAll("[data-atab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.atab)));
function showTab(t) {
  document.querySelectorAll("[data-atab]").forEach((x) => x.classList.toggle("on", x.dataset.atab === t));
  document.querySelectorAll(".atab").forEach((s) => (s.hidden = s.id !== "a-" + t));
  ({ players: renderPlayers, matches: renderMatches, packs: renderPacks, log: renderLog })[t]();
}

// ---------- players ----------
function renderPlayers() {
  const q = $("#pQ").value.trim().toLowerCase(), role = $("#pRole").value;
  const list = A.users.filter((u) => (!q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
    && (!role || (role === "banned" ? u.banned : u.role === role && !u.banned)));
  $("#pCount").textContent = `${A.users.length} accounts · ${A.users.filter((u) => u.role === "admin").length} admins · ${A.users.filter((u) => u.banned).length} banned`;
  $("#pTable").innerHTML = `<thead><tr><th>Player</th><th>Email</th><th>Role</th><th class="num">Coins</th><th class="num">Cards</th><th class="num">Matches</th><th class="num">Packs</th><th>Joined</th><th>Last sign-in</th></tr></thead>
    <tbody>${list.map((u) => `<tr data-uid="${u.id}" class="${A.sel === u.id ? "on" : ""}${u.banned ? " banned" : ""}">
      <td>${who(u.id)}${u.id === me.id ? ' <small class="muted">(you)</small>' : ""}</td>
      <td class="muted">${esc(u.email)}</td>
      <td><span class="role r-${u.banned ? "banned" : u.role}">${u.banned ? "Banned" : u.role === "admin" ? "Admin" : "Player"}</span></td>
      <td class="num">◈ ${u.coins.toLocaleString()}</td>
      <td class="num">${u.cards} <small class="muted">(${u.copies})</small></td>
      <td class="num">${u.matches}</td><td class="num">${u.packs}</td>
      <td class="muted">${when(u.created_at)}</td><td class="muted">${when(u.last_sign_in_at)}</td></tr>`).join("")
    || `<tr><td colspan="9" class="muted">No players match.</td></tr>`}</tbody>`;
  renderDetail();
}
$("#pTable").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-uid]");
  if (!tr) return;
  A.sel = tr.dataset.uid;
  A.owned = null;
  renderPlayers();
  loadOwned(A.sel);
});
let pQT;
$("#pQ").addEventListener("input", () => { clearTimeout(pQT); pQT = setTimeout(renderPlayers, 150); });
$("#pRole").addEventListener("change", renderPlayers);
$("#pReload").addEventListener("click", async () => { try { await loadUsers(); renderPlayers(); toast("Reloaded"); } catch (e) { fail(e); } });

async function loadOwned(uid) {
  try {
    const cl = await Cloud.client();
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await cl.from("collection").select("card_id, count").eq("owner", uid).gt("count", 0).range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    if (A.sel !== uid) return;
    A.owned = out.sort((a, b) => cardName(a.card_id).localeCompare(cardName(b.card_id)));
    renderDetail();
  } catch (e) { fail(e); }
}
function renderDetail() {
  const u = A.byId[A.sel], box = $("#pDetail");
  if (!u) { box.innerHTML = `<p class="muted">Click a player to manage them.</p>`; return; }
  const self = u.id === me.id;
  const found = A.cardQ.trim() ? Object.values(A.cards).filter((c) => c.name.toLowerCase().includes(A.cardQ.trim().toLowerCase())).slice(0, 30) : [];
  box.innerHTML = `
    <div class="ad-head">${who(u.id)}<span class="role r-${u.banned ? "banned" : u.role}">${u.banned ? "Banned" : u.role === "admin" ? "Admin" : "Player"}</span></div>
    <p class="muted ad-sub">${esc(u.email)} · joined ${when(u.created_at)}</p>
    <h3>Name</h3>
    <div class="give-row"><input id="adName" value="${esc(u.name)}" maxlength="20"><button data-do="rename">Rename</button></div>
    <h3>Coins: ◈ ${u.coins.toLocaleString()}</h3>
    <div class="give-row"><input type="number" id="adCoins" value="500" step="100"><button data-do="coins" data-sign="1">Give</button><button data-do="coins" data-sign="-1">Take</button></div>
    <h3>Role</h3>
    <div class="give-row">${u.role === "admin"
      ? `<button data-do="role" data-role="player" ${self ? "disabled title=\"You can't remove your own admin role\"" : ""}>Make player</button>`
      : `<button data-do="role" data-role="admin">Make admin</button><span class="muted">Admins can change every card, box and player.</span>`}</div>
    <h3>Ban</h3>
    <div class="give-row">${self ? `<span class="muted">You can't ban yourself.</span>` : u.banned
      ? `<button data-do="ban" data-v="0">Unban</button>`
      : `<button data-do="ban" data-v="1" class="danger">Ban</button><span class="muted">Banned players are signed out and can't sign in, open packs or earn coins.</span>`}</div>
    <h3>Give a card</h3>
    <div class="give-row"><input id="adCardQ" placeholder="Search the library" value="${esc(A.cardQ)}" autocomplete="off"><input type="number" id="adCardN" value="1" min="1" max="99"></div>
    <div class="ad-found">${found.map((c) => `<button data-give="${esc(c.id)}">+ ${esc(c.name)}</button>`).join("") || (A.cardQ ? `<span class="muted">No cards found.</span>` : "")}</div>
    <h3>Collection ${A.owned ? `(${A.owned.length} cards, ${A.owned.reduce((a, r) => a + r.count, 0)} copies)` : ""}</h3>
    <div class="ad-owned">${A.owned === null ? `<span class="muted">Loading…</span>` : A.owned.map((r) => `<div><span>${esc(cardName(r.card_id))}</span><b>×${r.count}</b><button data-take="${esc(r.card_id)}" title="Take one copy">−1</button></div>`).join("") || `<span class="muted">No cards.</span>`}</div>`;
}
let adQT;
$("#pDetail").addEventListener("input", (e) => {
  if (e.target.id !== "adCardQ") return;
  A.cardQ = e.target.value;
  clearTimeout(adQT);
  adQT = setTimeout(() => { renderDetail(); const i = $("#adCardQ"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200);
});
$("#pDetail").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  const u = A.byId[A.sel];
  if (!b || !u || b.disabled) return;
  try {
    if (b.dataset.do === "rename") {
      await Cloud.rpc("admin_rename", { target: u.id, new_name: $("#adName").value });
      toast("Renamed");
    } else if (b.dataset.do === "coins") {
      const n = Math.abs(+$("#adCoins").value | 0) * +b.dataset.sign;
      if (!n) return;
      await Cloud.rpc("admin_add_coins", { target: u.id, amount: n });
      toast(`${n > 0 ? "Gave" : "Took"} ◈ ${Math.abs(n).toLocaleString()}`);
    } else if (b.dataset.do === "role") {
      if (b.dataset.role === "admin" && !window.confirm(`Make ${u.name} an admin? They will be able to change every card, box and player.`)) return;
      await Cloud.rpc("admin_set_role", { target: u.id, new_role: b.dataset.role });
      toast(b.dataset.role === "admin" ? `${u.name} is now an admin` : `${u.name} is now a player`);
    } else if (b.dataset.do === "ban") {
      if (b.dataset.v === "1" && !window.confirm(`Ban ${u.name}?`)) return;
      await Cloud.rpc("admin_set_banned", { target: u.id, value: b.dataset.v === "1" });
      toast(b.dataset.v === "1" ? `${u.name} is banned` : `${u.name} is unbanned`);
    } else if (b.dataset.give || b.dataset.take) {
      const n = b.dataset.give ? Math.max(1, +$("#adCardN").value | 0) : -1;
      const id = b.dataset.give || b.dataset.take;
      await Cloud.rpc("admin_give_card", { target: u.id, card: id, amount: n });
      toast(n > 0 ? `Gave ${n} × ${cardName(id)}` : `Took 1 × ${cardName(id)}`);
      await loadOwned(u.id);
    } else return;
    await loadUsers();
    A.loaded.log = false;
    renderPlayers();
  } catch (err) { fail(err); }
});

// ---------- matches ----------
const STATUS = { waiting: "Waiting for a report", paid: "Paid", mismatch: "Results didn't match", short: "Too short" };
async function renderMatches() {
  if (!A.loaded.matches) {
    $("#mTable").innerHTML = `<tbody><tr><td class="muted">Loading…</td></tr></tbody>`;
    try { A.matches = await rows("matches", "created_at"); A.loaded.matches = true; } catch (e) { return fail(e); }
  }
  const rep = (r) => (r ? `${r.winner ? esc(nameOf(r.winner)) : "draw"} · ${r.turns} turns` : `<span class="muted">no report</span>`);
  $("#mTable").innerHTML = `<thead><tr><th>Started</th><th>Players</th><th>Winner</th><th>Status</th><th class="num">Coins</th><th>Reports</th></tr></thead>
    <tbody>${A.matches.map((m) => `<tr>
      <td class="muted">${when(m.created_at)}</td>
      <td>${who(m.p1)} vs ${who(m.p2)}</td>
      <td>${m.status === "paid" || m.status === "short" ? (m.winner ? who(m.winner) : "Draw") : "—"}</td>
      <td><span class="st st-${m.status}">${STATUS[m.status] || m.status}</span></td>
      <td class="num">${m.status === "paid" ? `${esc(nameOf(m.p1))} +${m.coins1}<br>${esc(nameOf(m.p2))} +${m.coins2}` : "—"}</td>
      <td class="muted small">${esc(nameOf(m.p1))}: ${rep(m.report1)}<br>${esc(nameOf(m.p2))}: ${rep(m.report2)}</td></tr>`).join("")
    || `<tr><td colspan="6" class="muted">No online matches yet.</td></tr>`}</tbody>`;
}

// ---------- packs ----------
async function renderPacks() {
  if (!A.loaded.packs) {
    $("#kTable").innerHTML = `<tbody><tr><td class="muted">Loading…</td></tr></tbody>`;
    try {
      A.packs = await rows("pack_log", "at");
      const cl = await Cloud.client();
      const { data } = await cl.from("boxes").select("id, name");
      A.boxes = Object.fromEntries((data || []).map((b) => [b.id, b.name]));
      A.loaded.packs = true;
    } catch (e) { return fail(e); }
  }
  $("#kTable").innerHTML = `<thead><tr><th>Opened</th><th>Player</th><th>Box</th><th class="num">Cost</th><th>Cards</th></tr></thead>
    <tbody>${A.packs.map((p) => `<tr>
      <td class="muted">${when(p.at)}</td><td>${who(p.owner)}</td>
      <td>${esc(A.boxes[p.box_id] || "(deleted box)")}</td><td class="num">◈ ${p.cost}</td>
      <td class="small">${(p.cards || []).map((c) => `<span class="rar r-${esc(c.rarity)}">${esc(c.rarity)}</span> ${esc(cardName(c.card))}`).join(" · ")}</td></tr>`).join("")
    || `<tr><td colspan="5" class="muted">No packs opened yet.</td></tr>`}</tbody>`;
}

// ---------- admin log ----------
function logText(l) {
  const d = l.detail || {};
  switch (l.action) {
    case "set_role": return `made ${who(l.target)} ${d.role === "admin" ? "an admin" : "a player"}`;
    case "add_coins": return `${d.amount >= 0 ? "gave" : "took"} ◈ ${Math.abs(d.amount).toLocaleString()} ${d.amount >= 0 ? "to" : "from"} ${who(l.target)} <span class="muted">(now ${d.now})</span>`;
    case "set_banned": return `${d.banned ? "banned" : "unbanned"} ${who(l.target)}`;
    case "give_card": return `${d.amount >= 0 ? "gave" : "took"} ${Math.abs(d.amount)} × ${esc(cardName(d.card))} ${d.amount >= 0 ? "to" : "from"} ${who(l.target)} <span class="muted">(now ${d.now})</span>`;
    case "rename": return `renamed a player to “${esc(d.name)}”`;
    default: return `${esc(l.action)} ${who(l.target)} <span class="muted">${esc(JSON.stringify(d))}</span>`;
  }
}
async function renderLog() {
  if (!A.loaded.log) {
    $("#lTable").innerHTML = `<tbody><tr><td class="muted">Loading…</td></tr></tbody>`;
    try { A.log = await rows("admin_log", "at"); A.loaded.log = true; } catch (e) { return fail(e); }
  }
  $("#lTable").innerHTML = `<thead><tr><th>When</th><th>Admin</th><th>What</th></tr></thead>
    <tbody>${A.log.map((l) => `<tr><td class="muted">${when(l.at)}</td><td>${who(l.admin)}</td><td>${logText(l)}</td></tr>`).join("")
    || `<tr><td colspan="3" class="muted">Nothing yet.</td></tr>`}</tbody>`;
}

// ---------- start ----------
Loader.wait((async () => {
  try {
    await Cloud.refresh();
    if (!Auth.isAdmin()) { location.replace("lobby.html"); return; }
    const [, cards] = await Promise.all([loadUsers(), DB.all("cards")]);
    A.cards = Object.fromEntries(cards.map((c) => [c.id, c]));
    showTab("players");
  } catch (e) {
    $("#pTable").innerHTML = `<tbody><tr><td class="muted">Couldn't load: ${esc(e.message || e)}</td></tr></tbody>`;
  }
})());
