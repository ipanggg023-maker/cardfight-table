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

  async function seedIfEmpty() {
    if ((await all("cards")).length) return;
    const { cards, decks } = seedData();
    for (const c of cards) await put("cards", c);
    for (const d of decks) await put("decks", d);
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
    const missing = [...deck.ride, ...deck.main].filter((cid) => !byId[cid]).length;
    if (missing) throw new Error(`${missing} card(s) in this deck were deleted`);
    return { name: deck.name, energy: deck.energy, ride: deck.ride.map(get), main: deck.main.map(get) };
  }
  return { all, put, del, newId, seedIfEmpty, exportAll, importAll, loadDeck };
})();

// Deck rule check, shared by editor and game setup
function validateDeck(deck, byId) {
  const errs = [];
  const main = deck.main.map((id) => byId[id]).filter(Boolean);
  const ride = deck.ride.map((id) => byId[id]);
  if (ride.length !== 4 || ride.some((c) => !c)) errs.push("Ride deck needs 4 cards");
  else if (ride.map((c) => c.grade).join() !== "0,1,2,3") errs.push("Ride deck must be grade 0, 1, 2, 3 in order");
  if (main.length !== 50) errs.push(`Main deck has ${main.length}/50 cards`);
  const count = (fn) => main.filter(fn).length;
  if (count((c) => c.trigger) !== 16) errs.push(`Triggers: ${count((c) => c.trigger)}/16`);
  const noType = main.filter((c) => c.type === "trigger" && !c.trigger);
  if (noType.length) errs.push(`Set the trigger type: ${[...new Set(noType.map((c) => c.name))].join(", ")}`);
  if (count((c) => c.trigger === "heal") > 4) errs.push("Max 4 heal triggers");
  if (count((c) => c.trigger === "over") > 1) errs.push("Max 1 over trigger");
  if (count((c) => c.sentinel) > 4) errs.push("Max 4 sentinels");
  const names = {};
  [...main, ...ride.filter(Boolean)].forEach((c) => (names[c.name] = (names[c.name] || 0) + 1));
  Object.entries(names).forEach(([n, k]) => { if (k > 4) errs.push(`"${n}": ${k} copies (max 4 incl. ride deck)`); });
  return errs;
}
