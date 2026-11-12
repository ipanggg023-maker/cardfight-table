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
const MAT_LAYOUT = {
  slots: { fl: [30.4, 39.3], vc: [50, 39.3], fr: [69.6, 39.3], bl: [30.4, 80.1], bc: [50, 80.1], br: [69.6, 80.1] },
  order: [5.6, 3.6, 20.4, 34],      // left, top, right, bottom
  damage: [5.6, 61.4, 20.4, 96.6],
  deck: [81.6, 25.9, 92.2, 57],
  drop: [82, 63, 91.8, 92.4],
  ride: [95, 26.5, 100, 56.5],
};

const Mats = (() => {
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
  return {
    choice: (seat) => get(`vt-mat-${seat}`, seat === 1 ? "red" : "blue"),
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
