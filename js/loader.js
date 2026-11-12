// Loading screen shared by every page.
// - Shows from the very first frame of a page until it is ready: fonts, pictures (window load) and
//   whatever the page registers with Loader.wait(promise). Stays at least 1 s, never more than 5 s.
// - Clicking a link to another page of the app fades the screen in first, then navigates.
// - Loader.show(text) / the returned hide() covers longer work inside a page (e.g. game start).
// Load it in <head> right after auth.js. It only animates transform/opacity (GPU), so it stays at 60 fps.

const Loader = (() => {
  const MIN = 1000, MAX = 5000;
  const TIPS = [
    "Tip: a grade 3 vanguard drive checks twice.",
    "Tip: sentinels discard 1 card to make the attacked unit impossible to hit.",
    "Tip: face-up damage pays for Counter-Blast.",
    "Tip: grade 0 and 1 units in the back row can boost the unit in front of them.",
    "Tip: heal triggers only heal when your damage is at least your opponent's.",
    "Tip: Quick deck in the editor builds a legal deck from your own cards.",
    "Tip: online play needs only a 5-letter room code.",
  ];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = `
  html.vt-loading body { overflow: hidden; }
  #vtLoader { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 40%, #13294a 0%, #08111f 70%);
    color: #e8eefc; font-family: "Chakra Petch", system-ui, sans-serif; opacity: 1; transition: opacity .28s ease; will-change: opacity; contain: strict; }
  #vtLoader.out { opacity: 0; pointer-events: none; }
  #vtLoader.in { opacity: 0; }
  #vtLoader .box { display: grid; justify-items: center; gap: 16px; padding: 24px; text-align: center; transform: translateZ(0); }
  #vtLoader svg { width: 72px; height: 72px; animation: vtSpin 2.4s cubic-bezier(.6,0,.4,1) infinite; will-change: transform; }
  #vtLoader .t { font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #f2b94b; font-size: 15px; }
  #vtLoader .m { font-size: 14px; color: #c9d6ee; min-height: 1.3em; }
  #vtLoader .bar { width: min(280px, 70vw); height: 4px; border-radius: 4px; background: #ffffff1a; overflow: hidden; }
  #vtLoader .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #5fd0ff, #f2b94b); transform-origin: left center;
    transform: scaleX(0); transition: transform .3s ease; will-change: transform; }
  #vtLoader .bar.indet i { width: 40%; transition: none; animation: vtSlide 1.1s ease-in-out infinite; }
  #vtLoader .tip { font: 13px system-ui, sans-serif; color: #8aa0c2; max-width: 36ch; }
  @keyframes vtSpin { 0% { transform: rotate(0); } 50% { transform: rotate(180deg) scale(.86); } 100% { transform: rotate(360deg); } }
  @keyframes vtSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
  @media (prefers-reduced-motion: reduce) { #vtLoader svg, #vtLoader .bar.indet i { animation: none; } #vtLoader { transition: none; } }`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
  document.documentElement.classList.add("vt-loading");

  let el = null, shownAt = performance.now(), hideT = 0, token = 0;
  const waits = [];
  function build(msg) {
    const d = document.createElement("div");
    d.id = "vtLoader";
    d.setAttribute("role", "status");
    d.setAttribute("aria-live", "polite");
    d.innerHTML = `<div class="box">
      <svg viewBox="0 0 56 56" aria-hidden="true"><path d="M28 3L53 28L28 53L3 28Z" fill="none" stroke="#f2b94b" stroke-width="4"/><path d="M28 15L41 28L28 41L15 28Z" fill="#f2b94b"/></svg>
      <div class="t">Vanguard Table</div>
      <div class="m"></div>
      <div class="bar indet"><i></i></div>
      <div class="tip"></div></div>`;
    d.querySelector(".m").textContent = msg || "Loading…";
    d.querySelector(".tip").textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    return d;
  }
  // Put the screen in front as soon as <body> exists (before the page's first paint)
  function mount(msg) {
    if (el && el.isConnected) { el.classList.remove("out"); el.querySelector(".m").textContent = msg || "Loading…"; return; }
    el = build(msg);
    document.body.prepend(el);
  }
  if (document.body) mount();
  else new MutationObserver((_, mo) => { if (document.body) { mo.disconnect(); mount(); } }).observe(document.documentElement, { childList: true });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function hideNow(t) {
    if (t !== token || !el) return;
    el.classList.add("out");
    document.documentElement.classList.remove("vt-loading");
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (t === token && el) { el.remove(); el = null; } }, reduce ? 0 : 320);
  }
  // Wait for the work (at most MAX), keep the screen at least MIN, then fade out
  async function finish(t, work) {
    await Promise.race([Promise.allSettled(work), sleep(Math.max(0, MAX - (performance.now() - shownAt)))]);
    const left = MIN - (performance.now() - shownAt);
    if (left > 0) await sleep(left);
    hideNow(t);
  }

  // First load of the page
  const pageReady = new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true })));
  const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  // (the page's Loader.wait() calls are read after window load, when all its scripts have run)
  const first = ++token;
  finish(first, [(async () => { await pageReady; await fontsReady; await Promise.allSettled(waits); })()]);

  // Coming back with the browser's Back button (page restored from memory): no screen needed
  addEventListener("pageshow", (e) => { if (e.persisted) { token++; if (el) { el.remove(); el = null; } document.documentElement.classList.remove("vt-loading"); } });

  // Links to other pages of the app: fade the screen in, then go
  function go(url) {
    if (api.canLeave && !api.canLeave()) return;
    show("Loading…", false); // stays until the next page replaces this one
    const t = token;
    // plain timer (animation frames pause in background tabs): let the fade-in show, then go
    setTimeout(() => { if (t === token) location.href = url; }, reduce ? 0 : 180);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || !/\.html$/.test(u.pathname)) return;
    if (u.pathname === location.pathname && u.search === location.search) return; // same page (hash links etc.)
    e.preventDefault();
    go(u.href);
  });

  // Show the screen for work inside a page. Returns hide(): call it when done (MIN/MAX still apply).
  function show(msg, autoHide = true) {
    clearTimeout(hideT);
    const fresh = !el;
    mount(msg);
    if (fresh && !reduce) { el.classList.add("in"); void el.offsetWidth; el.classList.remove("in"); }
    document.documentElement.classList.add("vt-loading");
    shownAt = performance.now();
    const t = ++token;
    progress(null);
    let done;
    const p = new Promise((r) => (done = r));
    if (autoHide) finish(t, [p]);
    return done;
  }
  // 0..1 shows a real progress bar, null shows the moving bar
  function progress(f) {
    if (!el) return;
    const bar = el.querySelector(".bar"), i = bar.querySelector("i");
    if (f === null || f === undefined) { bar.classList.add("indet"); i.style.transform = ""; return; }
    bar.classList.remove("indet");
    i.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
  }
  const message = (m) => { if (el) el.querySelector(".m").textContent = m; };
  // canLeave: a page can set Loader.canLeave = () => boolean (e.g. ask about unsaved changes)
  const api = { wait: (p) => { waits.push(p); return p; }, show, progress, message, go, canLeave: null };
  return api;
})();
