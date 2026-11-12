// Sign-in. Two kinds of user, both cached in localStorage "vt-user" so pages can read it at once:
//  - guest  {name, color, guest: true}: this computer only, no coins, hot-seat and local cards
//  - account {id, name, color, role: "player"|"admin", coins, guest: false}: a Supabase account (see Cloud below).
//    Role and coins live on the server; the cache is only for drawing the page and is refreshed in the background.
const Auth = {
  get() {
    try { return JSON.parse(localStorage.getItem("vt-user")); } catch { return null; }
  },
  set(user) {
    try { localStorage.setItem("vt-user", JSON.stringify(user)); } catch { /* storage blocked */ }
  },
  clear() {
    try { localStorage.removeItem("vt-user"); } catch { /* ignore */ }
  },
  // Call at the top of pages that need a signed-in player
  require() {
    const u = this.get();
    if (!u) location.replace("login.html");
    else if (!u.guest) Cloud.check(); // re-read role/coins from the server after the page is up
    return u;
  },
  isAdmin() { const u = this.get(); return !!u && !u.guest && u.role === "admin"; },
  initial(u) { return ((u && u.name) || "G").trim().charAt(0).toUpperCase() || "G"; },
};

// Small user chip: <div data-userchip></div>
function mountUserChip() {
  const u = Auth.get();
  document.querySelectorAll("[data-userchip]").forEach((el) => {
    if (!u) return;
    const sub = u.guest ? "Guest · this computer only" : `${u.role === "admin" ? "Admin" : "Player"} · ◈ ${(u.coins || 0).toLocaleString()} coins`;
    el.innerHTML = `<span class="uc-text"><b></b><small>${sub}</small></span>
      <span class="uc-av" style="background:${u.color}"></span>
      <button type="button" class="uc-out">Sign out</button>`;
    el.querySelector("b").textContent = u.name;
    el.querySelector(".uc-av").textContent = Auth.initial(u);
    el.querySelector(".uc-out").addEventListener("click", async () => {
      if (!u.guest) { try { await Cloud.signOut(); } catch { /* offline: still sign out here */ } }
      Auth.clear();
      if (typeof Loader !== "undefined") Loader.go("login.html"); else location.href = "login.html";
    });
  });
}

// Table skin: "mat" uses the community playmat circles + banner (assets/, private play only), "classic" is the original look.
const Skin = {
  get() { try { return localStorage.getItem("vt-skin") || "mat"; } catch { return "mat"; } },
  set(v) { try { localStorage.setItem("vt-skin", v); } catch { /* storage blocked */ } Skin.apply(); },
  apply() { document.documentElement.classList.toggle("skin-mat", Skin.get() === "mat"); },
};
Skin.apply();

// ---------- Cloud: Supabase accounts ----------
// Public project values (the publishable key is meant to be in website code). Never put the secret / service_role key here.
const SUPA = { url: "https://simdnmlfgcxvwmpogbdp.supabase.co", key: "sb_publishable_vTIFmj98TdyZ7vMpeAeJJg_H4ZPFEzz",
  sdk: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js" };
const Cloud = {
  _p: null,
  // The SDK is loaded only when needed, so guest / hot-seat play works offline.
  client() {
    if (!this._p) {
      this._p = new Promise((res, rej) => {
        if (window.supabase) return res();
        const sc = document.createElement("script");
        sc.src = SUPA.sdk; sc.onload = res;
        sc.onerror = () => rej(new Error("Can't reach the account server. Check your internet."));
        document.head.appendChild(sc);
      }).then(() => window.supabase.createClient(SUPA.url, SUPA.key));
      this._p.catch(() => { this._p = null; });
    }
    return this._p;
  },
  async signUp({ email, password, name, color }) {
    const c = await this.client();
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { name, color } } });
    if (error) throw error;
    if (!data.session) return { confirm: true }; // email confirmation is on: the user must click the link first
    return { user: await this.refresh() };
  },
  async signIn(email, password) {
    const c = await this.client();
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return this.refresh();
  },
  async signOut() { const c = await this.client(); await c.auth.signOut(); },
  // Reads this account's profile from the server into the vt-user cache. Returns null when not signed in.
  async refresh() {
    const c = await this.client();
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    const { data: p, error } = await c.from("profiles").select("id, name, color, role, coins, banned, created_at").eq("id", session.user.id).single();
    if (error) throw error;
    if (p.banned) { await c.auth.signOut(); throw new Error("This account is banned."); }
    const u = { id: p.id, name: p.name, color: p.color, role: p.role, coins: p.coins, guest: false, since: p.created_at };
    Auth.set(u);
    return u;
  },
  async saveProfile({ name, color }) {
    const c = await this.client();
    const u = Auth.get();
    const { error } = await c.from("profiles").update({ name, color }).eq("id", u.id);
    if (error) throw error;
    return this.refresh();
  },
  async rpc(fn, args) {
    const c = await this.client();
    const { data, error } = await c.rpc(fn, args);
    if (error) throw error;
    return data;
  },
  // Background check on every page: signed out / banned elsewhere → back to login; otherwise update the chip.
  check() {
    const run = () => this.refresh().then((u) => {
      if (!u) { Auth.clear(); location.replace("login.html"); return; }
      if (typeof mountUserChip === "function") mountUserChip();
      document.dispatchEvent(new CustomEvent("vt-user", { detail: u }));
    }).catch((e) => {
      if (/banned/.test(e.message)) { Auth.clear(); location.replace("login.html"); }
      else console.warn("Account check failed (offline?):", e.message);
    });
    if (document.readyState === "complete") setTimeout(run, 0); else addEventListener("load", () => setTimeout(run, 0), { once: true });
  },
};
