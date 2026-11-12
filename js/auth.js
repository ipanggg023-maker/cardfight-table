// Guest sign-in. Stored only in this browser (localStorage). No server yet.
// Later an account system can replace get/set without touching the pages.
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
    return u;
  },
  initial(u) { return ((u && u.name) || "G").trim().charAt(0).toUpperCase() || "G"; },
};

// Small user chip: <div data-userchip></div>
function mountUserChip() {
  const u = Auth.get();
  document.querySelectorAll("[data-userchip]").forEach((el) => {
    if (!u) return;
    el.innerHTML = `<span class="uc-text"><b></b><small>Guest · this computer only</small></span>
      <span class="uc-av" style="background:${u.color}"></span>
      <button type="button" class="uc-out">Sign out</button>`;
    el.querySelector("b").textContent = u.name;
    el.querySelector(".uc-av").textContent = Auth.initial(u);
    el.querySelector(".uc-out").addEventListener("click", () => { Auth.clear(); if (typeof Loader !== "undefined") Loader.go("login.html"); else location.href = "login.html"; });
  });
}

// Table skin: "mat" uses the community playmat circles + banner (assets/, private play only), "classic" is the original look.
const Skin = {
  get() { try { return localStorage.getItem("vt-skin") || "mat"; } catch { return "mat"; } },
  set(v) { try { localStorage.setItem("vt-skin", v); } catch { /* storage blocked */ } Skin.apply(); },
  apply() { document.documentElement.classList.toggle("skin-mat", Skin.get() === "mat"); },
};
Skin.apply();
