// Playmats. Each player picks one on the setup screen; their half of the table draws it.
// Image mats must use the standard landscape layout (about 2:1): order zone top-left, damage zone bottom-left,
// 5 rear-guard circles + vanguard in the middle, deck right, drop bottom-right, ride deck at the right edge.
// Positions below are percentages of that image, so any mat with the same layout lines up.

const MATS = {
  classic: { name: "Classic (navy)", img: "", thumb: "" },
  red: { name: "overDress Red", img: "assets/mats/overdress-red.jpg", thumb: "assets/mats/overdress-red-thumb.jpg" },
  blue: { name: "overDress Blue", img: "assets/mats/overdress-blue.jpg", thumb: "assets/mats/overdress-blue-thumb.jpg" },
  custom: { name: "My own image…", img: "", thumb: "" },
};

// Layout of the mat (own side, unrotated). x/y = centre, in % of width/height.
// Boxes are [left, top, right, bottom], measured on the printed Standard mat (overDress, 1600×817).
const MAT_LAYOUT = {
  slots: { fl: [30.4, 39.3], vc: [50, 39.3], fr: [69.6, 39.3], bl: [30.4, 80.1], bc: [50, 80.1], br: [69.6, 80.1] },
  order: [5.75, 4.3, 20.6, 33.7],    // ORDER ZONE (set orders, Songs face down)
  plate: [5.75, 35, 20.6, 46.4],     // player plate when there is no room beside the mat (the gap between order and damage)
  damage: [5.75, 47.1, 20.6, 96.7],  // DAMAGE ZONE 1–6
  dmgSlots: [[47.1, 66.7], [67.3, 72.5], [73.2, 78.3], [79.1, 84.2], [84.9, 90.1], [90.8, 96.7]], // the six printed boxes (top, bottom)
  trigger: [79.7, 8, 94.4, 19.5],    // TRIGGER CHECK ZONE (the card being checked)
  deck: [81.6, 25.9, 92.4, 57],      // DECK
  drop: [81.9, 62.4, 92.2, 92.4],    // DROP ZONE
  ride: [95.1, 25.9, 100, 56.9],     // RIDE DECK (right edge)
  crest: [94.9, 3.5, 100, 23.5],     // crest zone: Energy Generator + energy (beside the trigger check zone, above the ride deck)
};

const Mats = (() => {
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
  // The overDress pictures stay on the user's PC (not in git), so the hosted site doesn't have them.
  // probe() marks mats whose picture can't load; they are hidden and fall back to Classic.
  let probed = null;
  const probe = () => (probed ??= Promise.all(Object.values(MATS).filter((m) => m.img).map((m) => new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok();
    i.onerror = () => { m.missing = true; ok(); };
    i.src = m.thumb || m.img;
  }))));
  return {
    probe,
    choice: (seat) => { const k = get(`vt-mat-${seat}`, seat === 1 ? "red" : "blue"); return MATS[k] && !MATS[k].missing ? k : "classic"; },
    remember: (seat, key) => set(`vt-mat-${seat}`, key),
    customImg: (seat) => get(`vt-mat-custom-${seat}`, ""),
    // Shrinks an uploaded picture to 1600px wide JPEG so it fits in browser storage.
    async saveCustom(seat, file) {
      const url = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(file); });
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That file isn't a picture")); i.src = url; });
      const w = Math.min(1600, img.width), h = Math.round(img.height * w / img.width);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      const out = c.toDataURL("image/jpeg", 0.85);
      if (!set(`vt-mat-custom-${seat}`, out)) throw new Error("Browser storage is full. Try a smaller picture.");
      return out;
    },
    // Resolves a choice to {key, img}
    resolve(seat, key) {
      if (key === "custom") { const img = Mats.customImg(seat); return img ? { key, img } : { key: "classic", img: "" }; }
      return { key: MATS[key] ? key : "classic", img: (MATS[key] || {}).img || "" };
    },
  };
})();
