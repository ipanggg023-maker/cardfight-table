// How long the game waits on screen at each battle moment (engine beat kinds), so both players can follow it.
// Reduced motion: half. A hidden tab or the editor's test table: 60 ms, so nothing stalls.
const Pace = (() => {
  const MS = { draw: 300, ride: 450, keyRide: 1000, call: 300, attack: 600, guardTotal: 900, result: 500, checkShow: 1200, checkTrigger: 700, checkMove: 400, finish: 600 };
  function ms(kind, opts = {}) {
    if (opts.hidden || opts.test) return 60;
    const v = MS[kind] ?? 400;
    return opts.reduced ? Math.round(v / 2) : v;
  }
  return { ms, MS };
})();
if (typeof module !== "undefined" && module.exports) module.exports = Pace;
