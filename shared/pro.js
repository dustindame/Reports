/* ===========================================================
   Pro entitlement gate -- shared by setup.js, player-entry.js,
   team-picks.js, draft-board.js.

   Real entitlement source (once the Android wrapper apps exist):
   the native shell checks Google Play Billing / Amazon IAP and sets
   `window.NATIVE_PRO_UNLOCKED = true` before this script's consumers
   run. There is no such native shell on the plain website, so it
   falls back to a localStorage flag -- flippable from the browser
   console (`ProGate.setTestUnlock(true)`) for testing the paywalled
   UI without a real purchase.
   =========================================================== */

const ProGate = {
  FREE_MAX_TEAMS: 14, // matches MAX_TEAMS (shared/data.js) -- no team-count cap on free anymore
  FREE_MAX_SAVED_LEAGUES: 2,

  isPro() {
    if (typeof window !== "undefined" && window.NATIVE_PRO_UNLOCKED === true) return true;
    try {
      return localStorage.getItem("auctionDraft.proUnlocked") === "1";
    } catch (e) {
      return false;
    }
  },

  // Dev/test-only toggle -- the real apps never call this themselves;
  // it exists so the paywalled UI can be tried out before Play
  // Billing is wired up. `ProGate.setTestUnlock(true)` from a
  // console, then reload.
  setTestUnlock(on) {
    try {
      if (on) localStorage.setItem("auctionDraft.proUnlocked", "1");
      else localStorage.removeItem("auctionDraft.proUnlocked");
    } catch (e) {
      /* ignore */
    }
  },

  // A random ID generated once per device/browser and persisted, so
  // the server can count how many leagues THIS device has created and
  // enforce the free-tier league cap for real (not just "remembered
  // locally" the way LeagueSession's saved-leagues list is) -- without
  // requiring any real login. Same honesty caveat as everything else
  // client-controlled here: clearing site data, reinstalling the app,
  // or a determined direct API call resets/bypasses it. Good enough
  // for a niche app; a real account system would be the bulletproof
  // version of this, at real added cost.
  DEVICE_ID_KEY: "auctionDraft.deviceId",
  getDeviceId() {
    try {
      let id = localStorage.getItem(this.DEVICE_ID_KEY);
      if (!id) {
        id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(this.DEVICE_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  },
};

// Mobile browsers have no console to run ProGate.setTestUnlock(true) from
// -- a ?pro=1 / ?pro=0 URL param does the same thing with just a link/typed
// URL. Strips the param from the address bar afterward via replaceState so
// it doesn't linger in a bookmarked or shared URL.
(function applyProUrlParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("pro")) return;
    ProGate.setTestUnlock(params.get("pro") === "1");
    params.delete("pro");
    const rest = params.toString();
    const cleanUrl = window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash;
    window.history.replaceState(null, "", cleanUrl);
  } catch (e) {
    /* ignore */
  }
})();
