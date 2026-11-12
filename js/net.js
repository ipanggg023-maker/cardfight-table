// Online play between two PCs over WebRTC (PeerJS + its free public broker).
// The host runs the real engine (seat 0). The guest (seat 1) sends actions {fn, args}
// and receives a redacted Game.snapshot(1) after every change.
// Hot-seat never touches this file's network code; PeerJS is only loaded when you go online.

const Net = (() => {
  const LIB = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
  const PREFIX = "vgtable-";
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const ACTIONS = ["answer", "mulligan", "rideFromDeck", "rideFromHand", "skipRide", "call", "move", "activate",
    "playOrder", "toBattle", "attack", "guard", "intercept", "confirmGuard", "endTurn"];
  const GUEST = 1;

  let peer = null, conn = null, code = "", reqN = 0;
  const waiting = new Map();   // request id -> resolve (guest)
  const images = {};           // card id -> image (cards from the other PC arrive without pictures)
  let on = () => {};           // event callback (ui.js): ({type, ...})
  let game = null;             // host: {names, decks, mats} of the current match

  const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
  const cleanCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  function loadLib() {
    if (typeof Peer !== "undefined") return Promise.resolve();
    return new Promise((ok, bad) => {
      const s = document.createElement("script");
      s.src = LIB;
      s.onload = ok;
      s.onerror = () => bad(new Error("Couldn't load PeerJS. Check your internet connection."));
      document.head.appendChild(s);
    });
  }
  const send = (msg) => { if (conn && conn.open) conn.send(msg); };
  const collectImages = (deck) => [...deck.ride, ...deck.main].forEach((c) => c && c.image && (images[c.id] = c.image));
  const peerError = (e) => ({
    "unavailable-id": "That room code is taken. Try again.",
    "peer-unavailable": "No room with that code. Check the code and that the host is waiting.",
    network: "Lost connection to the matchmaking server.",
    "browser-incompatible": "This browser doesn't support online play.",
  }[e.type] || e.message || String(e));

  // ---------- host ----------
  async function host(cb) {
    on = cb;
    await loadLib();
    for (let tries = 0; tries < 3; tries++) {
      code = newCode();
      try {
        await new Promise((ok, bad) => {
          peer = new Peer(PREFIX + code);
          peer.on("open", ok);
          peer.on("error", (e) => { if (!peer.open) bad(e); else on({ type: "error", msg: peerError(e) }); });
        });
        break;
      } catch (e) {
        peer.destroy();
        if (e.type !== "unavailable-id" || tries === 2) throw new Error(peerError(e));
      }
    }
    peer.on("connection", (c) => {
      if (conn && conn.open) { c.on("open", () => { c.send({ t: "full" }); setTimeout(() => c.close(), 500); }); return; }
      conn = c;
      c.on("data", hostData);
      c.on("close", () => { if (conn === c) { conn = null; on({ type: "left" }); } });
    });
    peer.on("disconnected", () => peer.reconnect());
    return code;
  }
  async function hostData(m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "hello") {
      collectImages(m.deck);
      if (game && Game.state()) { pushStart(); on({ type: "back" }); return; }   // guest came back mid-game
      on({ type: "joined", name: m.name, deck: m.deck, mat: m.mat });
      return;
    }
    if (m.t === "act") {
      const S = Game.state();
      let r;
      if (!S || !ACTIONS.includes(m.fn)) r = { ok: false, msg: "No game" };
      else if (m.fn === "answer" ? !(S.pending && S.pending.player === GUEST) : S.controller !== GUEST || S.pending)
        r = { ok: false, msg: "Not your move" };
      else r = await Game[m.fn](...(m.args || []));
      send({ t: "res", id: m.id, r: r || { ok: true } });
    }
  }
  // Called by the host's UI once both players are known.
  function startHosted(names, decks, mats) {
    game = { names, decks, mats };
    decks.forEach(collectImages);
    Game.newGame(names, decks);
    pushStart();
  }
  function pushStart() {
    send({ t: "start", seat: GUEST, mats: game.mats, images });
    pushState();
  }
  const pushState = () => { if (Game.state()) send({ t: "state", s: Game.snapshot(GUEST) }); };
  const rematch = () => game && startHosted(game.names, game.decks, game.mats);

  // ---------- guest ----------
  async function join(roomCode, hello, cb) {
    on = cb;
    code = cleanCode(roomCode);
    if (code.length !== 5) throw new Error("Room codes have 5 letters");
    await loadLib();
    collectImages(hello.deck);
    if (!peer || peer.destroyed) {
      await new Promise((ok, bad) => {
        peer = new Peer();
        peer.on("open", ok);
        peer.on("error", (e) => { if (!peer.open) bad(new Error(peerError(e))); else on({ type: "error", msg: peerError(e) }); });
      });
    }
    await new Promise((ok, bad) => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      const fail = (e) => bad(new Error(peerError(e)));
      peer.once("error", fail);
      const timer = setTimeout(() => bad(new Error("The host didn't answer. Check the code.")), 15000);
      c.on("open", () => {
        clearTimeout(timer);
        peer.off("error", fail);
        conn = c;
        c.send({ t: "hello", ...hello });
        ok();
      });
      c.on("data", guestData);
      c.on("close", () => { if (conn === c) { conn = null; on({ type: "left" }); } });
    });
    // Guest actions go to the host instead of the local engine.
    for (const fn of ACTIONS) Game[fn] = (...args) => request(fn, args);
  }
  function request(fn, args) {
    if (!conn || !conn.open) return Promise.resolve({ ok: false, msg: "Not connected" });
    const id = ++reqN;
    return new Promise((res) => { waiting.set(id, res); send({ t: "act", id, fn, args }); });
  }
  function guestData(m) {
    if (!m || typeof m !== "object") return;
    if (m.t === "full") return on({ type: "error", msg: "That room already has two players." });
    if (m.t === "start") { Object.assign(images, m.images || {}); return on({ type: "start", seat: m.seat, mats: m.mats }); }
    if (m.t === "state") return Game.load(m.s);
    if (m.t === "res" && waiting.has(m.id)) { waiting.get(m.id)(m.r); waiting.delete(m.id); }
  }

  return {
    images,
    get code() { return code; },
    get connected() { return !!(conn && conn.open); },
    host, startHosted, pushState, rematch, join,
    img: (c) => (c && (c.image || images[c.id])) || "",
  };
})();
