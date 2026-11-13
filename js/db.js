// Card + deck database. IndexedDB in the browser is always the fast local copy.
// Guests: local only (clearing browser data deletes it, use Export to keep a backup).
// Accounts: synced with Supabase (supabase/002_cards_decks.sql):
//  - cards are one shared library: everyone signed in reads it, only admins write. Uploaded pictures (data: URLs)
//    go to the private Storage bucket "card-images"; cards keep "sb:<path>" locally and pages get signed URLs.
//  - decks belong to the account.
//  Writes land locally at once and wait in an outbox (localStorage vt-outbox-<uid>) until they reach the server,
//  so editing offline works. On each page the first DB call pulls changes (cards since vt-cards-at).

const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("vanguard-table", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("cards", { keyPath: "id" });
      r.result.createObjectStore("decks", { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function tx(store, mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  }
  const lall = (s) => tx(s, "readonly", (o) => o.getAll());
  const lput = (s, v) => tx(s, "readwrite", (o) => o.put(v));
  const ldel = (s, id) => tx(s, "readwrite", (o) => o.delete(id));
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- cloud sync ----------
  const me = () => { const u = typeof Auth !== "undefined" && Auth.get(); return u && !u.guest && u.id ? u : null; };
  const admin = () => !!me() && me().role === "admin";
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* full or blocked */ } },
  };
  const BUCKET = "card-images", SIGN = `/storage/v1/object/sign/${BUCKET}/`, WEEK = 7 * 86400;
  // a signed picture link back to the stored "sb:<path>"
  const unsign = (img) => {
    if (!img || !img.includes(SIGN)) return img;
    return "sb:" + decodeURIComponent(img.slice(img.indexOf(SIGN) + SIGN.length).split("?")[0]);
  };
  let urls; // storage path → [signed url, expires ms]
  async function signImages(list) {
    urls = urls || JSON.parse(ls.get("vt-img-urls") || "{}");
    const now = Date.now();
    const need = [...new Set(list.filter((c) => c.image && c.image.startsWith("sb:")).map((c) => c.image.slice(3)))]
      .filter((p) => !urls[p] || urls[p][1] < now + 86400000);
    if (need.length && me()) {
      try {
        const cl = await Cloud.client();
        for (let i = 0; i < need.length; i += 500) {
          const { data, error } = await cl.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 500), WEEK);
          if (error) throw error;
          for (const r of data) if (r.signedUrl && r.path) urls[r.path] = [r.signedUrl, now + WEEK * 1000];
        }
        ls.set("vt-img-urls", JSON.stringify(urls));
      } catch (e) { console.warn("Card pictures: couldn't get links", e.message || e); }
    }
    return list.map((c) => (c.image && c.image.startsWith("sb:") && urls[c.image.slice(3)] ? { ...c, image: urls[c.image.slice(3)][0] } : c));
  }

  const boxKey = () => "vt-outbox-" + me().id;
  const outbox = () => { try { return JSON.parse(ls.get(boxKey()) || "{}"); } catch { return {}; } }; // {"cards:id": "put"|"del"}
  const saveBox = (b) => ls.set(boxKey(), JSON.stringify(b));
  const queue = (store, id, op) => { if (!me()) return; const b = outbox(); b[store + ":" + id] = op; saveBox(b); scheduleFlush(); };
  let flushT, flushing = null;
  const scheduleFlush = () => { clearTimeout(flushT); flushT = setTimeout(() => flush().catch(() => {}), 400); };
  const status = (text) => {
    if (typeof document === "undefined" || !document.body) return;
    let el = document.getElementById("syncBadge");
    if (!text) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "syncBadge"; el.className = "sync-badge"; document.body.appendChild(el); }
    el.textContent = text;
  };
  async function uploadImage(card) {
    const blob = await (await fetch(card.image)).blob();
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${card.id}/${Date.now().toString(36)}.${ext}`;
    const cl = await Cloud.client();
    const { error } = await cl.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (error) throw error;
    return "sb:" + path;
  }
  // Send everything waiting in the outbox. Cards go in batches of 200 (uploaded pictures first).
  function flush() {
    if (flushing) return flushing.then(() => (me() && Object.keys(outbox()).length ? flush() : undefined));
    flushing = (async () => {
      const u = me();
      if (!u) return;
      const b = outbox(), keys = Object.keys(b);
      if (!keys.length) return;
      const cl = await Cloud.client();
      const done = (k) => { const x = outbox(); if (x[k] === b[k]) delete x[k]; saveBox(x); };
      const local = {
        cards: Object.fromEntries((await lall("cards")).map((c) => [c.id, c])),
        decks: Object.fromEntries((await lall("decks")).map((d) => [d.id, d])),
      };
      const cardKeys = keys.filter((k) => k.startsWith("cards:")), deckKeys = keys.filter((k) => k.startsWith("decks:"));
      if (cardKeys.length && !admin()) cardKeys.forEach(done); // only admins change the shared library
      else for (let i = 0; i < cardKeys.length; i += 200) {
        const part = cardKeys.slice(i, i + 200), rows = [];
        for (const k of part) {
          const id = k.slice(6), c = local.cards[id];
          if (b[k] === "del" || !c) { rows.push({ id, data: null, deleted: true }); continue; }
          const card = { ...c, image: unsign(c.image) };
          if (card.image && card.image.startsWith("data:")) {
            status(`Uploading card pictures… ${i + rows.length + 1}/${cardKeys.length}`);
            card.image = await uploadImage(card);
            const now = (await lall("cards")).find((x) => x.id === id); // keep the small link locally instead of the big picture
            if (now && now.image === c.image) await lput("cards", { ...now, image: card.image });
          }
          rows.push({ id, data: card, deleted: false });
        }
        status(`Saving cards to the server… ${Math.min(i + 200, cardKeys.length)}/${cardKeys.length}`);
        const { error } = await cl.from("cards").upsert(rows);
        if (error) throw error;
        part.forEach(done);
      }
      if (deckKeys.length) {
        const puts = deckKeys.filter((k) => b[k] === "put" && local.decks[k.slice(6)]);
        const dels = deckKeys.filter((k) => !puts.includes(k));
        if (puts.length) {
          const { error } = await cl.from("decks").upsert(puts.map((k) => ({ owner: u.id, id: k.slice(6), data: local.decks[k.slice(6)] })));
          if (error) throw error;
        }
        if (dels.length) {
          const { error } = await cl.from("decks").delete().eq("owner", u.id).in("id", dels.map((k) => k.slice(6)));
          if (error) throw error;
        }
        deckKeys.forEach(done);
      }
    })().catch((e) => {
      console.warn("Sync: will retry later", e.message || e);
      status("⚠ Not saved to the server yet (offline?). It will retry.");
      setTimeout(() => status(""), 4000);
      throw e;
    }).finally(() => { flushing = null; if (!me() || !Object.keys(outbox()).length) status(""); });
    return flushing;
  }
  // Pull server changes into the local copy. Local edits still waiting in the outbox win.
  async function pull() {
    const u = me();
    if (!u) return;
    const cl = await Cloud.client();
    const waiting = outbox();
    // First sign-in on this browser: local cards (admins only) and decks the server doesn't have yet get uploaded.
    const seed = async (store, flag) => {
      if (ls.get(flag)) return;
      const ids = new Set();
      for (let from = 0; ; from += 1000) {
        let q = cl.from(store).select("id").range(from, from + 999);
        if (store === "decks") q = q.eq("owner", u.id);
        const { data, error } = await q;
        if (error) throw error;
        data.forEach((r) => ids.add(r.id));
        if (data.length < 1000) break;
      }
      const b = outbox();
      for (const x of await lall(store)) if (!ids.has(x.id)) b[store + ":" + x.id] = "put";
      saveBox(b);
      Object.assign(waiting, b);
      ls.set(flag, "1");
    };
    if (admin()) await seed("cards", "vt-seeded-cards-" + u.id);
    await seed("decks", "vt-seeded-decks-" + u.id);
    // cards changed since the last pull
    let since = ls.get("vt-cards-at") || "1970-01-01T00:00:00Z";
    for (;;) {
      const { data, error } = await cl.from("cards").select("id, data, deleted, updated_at").gt("updated_at", since).order("updated_at").limit(1000);
      if (error) throw error;
      for (const r of data) {
        if (waiting["cards:" + r.id]) continue;
        if (r.deleted || !r.data) await ldel("cards", r.id); else await lput("cards", r.data);
      }
      if (data.length) { since = data[data.length - 1].updated_at; ls.set("vt-cards-at", since); }
      if (data.length < 1000) break;
    }
    // decks: the server list is the truth for this account
    const { data: ds, error } = await cl.from("decks").select("id, data").eq("owner", u.id);
    if (error) throw error;
    const onServer = new Set(ds.map((d) => d.id));
    for (const d of ds) if (!waiting["decks:" + d.id]) await lput("decks", d.data);
    for (const d of await lall("decks")) if (!onServer.has(d.id) && !waiting["decks:" + d.id]) await ldel("decks", d.id);
    if (Object.keys(outbox()).length) scheduleFlush();
  }
  let ready = null;
  function sync() {
    if (!me()) return Promise.resolve();
    if (!ready) {
      ready = pull().catch((e) => console.warn("Sync: using the copy on this computer", e.message || e));
      if (typeof Loader !== "undefined" && Loader.wait) Loader.wait(ready);
    }
    return ready;
  }

  async function all(s) {
    await sync();
    const list = await lall(s);
    return s === "cards" && me() ? signImages(list) : list;
  }
  const noEdit = (s) => { if (s === "cards" && me() && !admin()) throw new Error("Only admins can change cards"); };
  async function put(s, v) {
    noEdit(s);
    const val = s === "cards" && v && v.image ? { ...v, image: unsign(v.image) } : v;
    await lput(s, val);
    queue(s, val.id, "put");
  }
  // many records in one transaction (big imports); for accounts they all join the outbox at once
  async function putMany(s, list) {
    noEdit(s);
    if (!list.length) return;
    const vals = list.map((v) => (s === "cards" && v && v.image ? { ...v, image: unsign(v.image) } : v));
    const d = await open();
    await new Promise((res, rej) => {
      const t = d.transaction(s, "readwrite");
      const o = t.objectStore(s);
      vals.forEach((v) => o.put(v));
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    if (me()) { const b = outbox(); vals.forEach((v) => (b[s + ":" + v.id] = "put")); saveBox(b); scheduleFlush(); }
  }
  async function del(s, id) {
    noEdit(s);
    await ldel(s, id);
    queue(s, id, "del");
  }
  async function clear(s) { for (const x of await lall(s)) await del(s, x.id); }

  // Older versions added two sample decks (card ids "flame-N"/"star-N", decks "deck-flame"/"deck-star").
  // Remove them once per browser (local copy only).
  async function removeSamples() {
    try { if (localStorage.getItem("vt-samples-removed")) return; } catch { return; }
    const sample = /^(flame|star)-\d+$/;
    for (const c of await lall("cards")) if (sample.test(c.id)) await ldel("cards", c.id);
    for (const d of await lall("decks")) if (d.id === "deck-flame" || d.id === "deck-star") await ldel("decks", d.id);
    try { localStorage.setItem("vt-samples-removed", "1"); } catch {}
  }
  async function exportAll() {
    await sync();
    return { app: "vanguard-table", version: 1, cards: await lall("cards"), decks: await lall("decks") };
  }
  async function importAll(data, replace) {
    if (!data || !Array.isArray(data.cards)) throw new Error("Not a Vanguard Table export file");
    await sync();
    const cardsToo = !me() || admin(); // players: decks only (cards come from the shared library)
    if (replace) { if (cardsToo) await clear("cards"); await clear("decks"); }
    if (cardsToo) for (const c of data.cards) await put("cards", c);
    for (const d of data.decks || []) await put("decks", d);
  }
  // Resolve a deck's card ids into full card objects for the engine
  async function loadDeck(id) {
    const deck = (await all("decks")).find((d) => d.id === id);
    const byId = Object.fromEntries((await all("cards")).map((c) => [c.id, c]));
    if (!deck) throw new Error("Deck not found");
    const get = (cid) => byId[cid];
    const missing = [...(deck.ride || []), ...deck.main].filter((cid) => cid && !byId[cid]).length;
    if (missing) throw new Error(`${missing} card(s) in this deck were deleted`);
    const format = typeof formatOf === "function" ? formatOf(deck) : "standard";
    const rideDeck = typeof FORMATS === "undefined" || FORMATS[format].rideDeck;
    const gAllowed = typeof gDeckAllowed === "function" ? gDeckAllowed(deck) : false;
    return { name: deck.name, format, g: gAllowed ? (deck.g || []).map(get).filter(Boolean) : [], energy: rideDeck && !!deck.energy, ride: rideDeck ? (deck.ride || []).map(get) : [], starter: rideDeck ? null : get(deck.starter) || null, main: deck.main.map(get) };
  }
  // token / ticket / crest cards: effects create copies of them by name during a game
  async function extras() { return (await all("cards")).filter((c) => c.token || c.ticket || c.type === "crest"); }
  return { extras, all, put, putMany, del, newId, removeSamples, exportAll, importAll, loadDeck, sync, flush, canEditCards: () => !me() || admin() };
})();

// Deck rule checks live in js/formats.js (validateDeck), one profile per play format.
