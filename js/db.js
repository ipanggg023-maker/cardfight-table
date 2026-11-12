// Card + deck database in the browser (IndexedDB). index.html and editor.html share it
// as long as both are opened from the same folder in the same browser.
// Clearing browser data deletes it, so use Export in the editor to keep a backup file.

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
  const all = (s) => tx(s, "readonly", (o) => o.getAll());
  const put = (s, v) => tx(s, "readwrite", (o) => o.put(v));
  const del = (s, id) => tx(s, "readwrite", (o) => o.delete(id));
  const clear = (s) => tx(s, "readwrite", (o) => o.clear());
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Older versions added two sample decks (card ids "flame-N"/"star-N", decks "deck-flame"/"deck-star").
  // Remove them once per browser; after that the database only holds the user's own cards.
  async function removeSamples() {
    try { if (localStorage.getItem("vt-samples-removed")) return; } catch { return; }
    const sample = /^(flame|star)-\d+$/;
    for (const c of await all("cards")) if (sample.test(c.id)) await del("cards", c.id);
    for (const d of await all("decks")) if (d.id === "deck-flame" || d.id === "deck-star") await del("decks", d.id);
    try { localStorage.setItem("vt-samples-removed", "1"); } catch {}
  }
  async function exportAll() {
    return { app: "vanguard-table", version: 1, cards: await all("cards"), decks: await all("decks") };
  }
  async function importAll(data, replace) {
    if (!data || !Array.isArray(data.cards)) throw new Error("Not a Vanguard Table export file");
    if (replace) { await clear("cards"); await clear("decks"); }
    for (const c of data.cards) await put("cards", c);
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
    return { name: deck.name, format, energy: rideDeck && !!deck.energy, ride: rideDeck ? (deck.ride || []).map(get) : [], starter: rideDeck ? null : get(deck.starter) || null, main: deck.main.map(get) };
  }
  return { all, put, del, newId, removeSamples, exportAll, importAll, loadDeck };
})();

// Deck rule checks live in js/formats.js (validateDeck), one profile per play format.
