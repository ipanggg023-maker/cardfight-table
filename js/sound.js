// Short game sounds made in the browser (Web Audio oscillators, no sound files, all original).
// Nothing plays before the player has interacted with the page (browser rule); without Web Audio it stays silent.
// Mute is remembered in localStorage "vt-sound" ("off" / "on").
const Sound = (() => {
  let ctx = null, unlocked = false;
  const get = () => { try { return localStorage.getItem("vt-sound") !== "off"; } catch { return true; } };
  let on = get();
  const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  function audio() {
    if (!AC || !unlocked) return null;
    if (!ctx) { try { ctx = new AC(); } catch { return null; } }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  if (typeof document !== "undefined") {
    const unlock = () => { unlocked = true; audio(); };
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });
  }
  // one tone: type, start / end frequency, length, volume, delay
  function tone(a, type, f0, f1, dur, vol, at = 0) {
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // a short noise burst (whoosh / thud)
  function noise(a, dur, vol, from, to, at = 0) {
    const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
  const TRIG_PITCH = { crit: 880, draw: 660, front: 587, heal: 523, stand: 740, over: 988 };
  const SOUNDS = {
    call: (a) => tone(a, "triangle", 520, 780, 0.09, 0.12),
    attack: (a) => { noise(a, 0.28, 0.25, 600, 2400); tone(a, "sawtooth", 180, 90, 0.2, 0.05); },
    hit: (a) => { noise(a, 0.22, 0.35, 900, 120); tone(a, "sine", 110, 55, 0.25, 0.25); },
    guard: (a) => { tone(a, "triangle", 330, 330, 0.18, 0.12); tone(a, "triangle", 495, 495, 0.22, 0.08, 0.05); },
    trigger: (a, o) => { const f = TRIG_PITCH[o && o.trig] || 700; tone(a, "sine", f, f, 0.16, 0.14); tone(a, "sine", f * 1.5, f * 1.5, 0.24, 0.1, 0.08); },
    keyRide: (a) => [262, 330, 392, 523].forEach((f, i) => tone(a, "triangle", f, f, 0.5, 0.08, i * 0.05)),
    win: (a) => [523, 659, 784, 1047].forEach((f, i) => tone(a, "triangle", f, f, 0.4, 0.1, i * 0.12)),
  };
  function play(name, opt) {
    if (!on || !SOUNDS[name]) return;
    const a = audio();
    if (!a) return;
    try { SOUNDS[name](a, opt); } catch { /* never break the game for a sound */ }
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem("vt-sound", on ? "on" : "off"); } catch { /* storage blocked: only this page */ }
    return on;
  }
  return { play, toggle, muted: () => !on };
})();
