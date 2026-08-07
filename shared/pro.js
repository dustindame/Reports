/* ===========================================================
   Pro entitlement gate -- shared by setup.js, player-entry.js,
   team-picks.js, draft-board.js.

   Real entitlement source, inside the Android phone app: Google Play
   Billing, via the native ProBilling Capacitor plugin (see
   android-phone-app/android/.../ProBillingPlugin.java). Since this is
   a remote WebView (not bundled local assets), the native side can't
   set `window.NATIVE_PRO_UNLOCKED` before this script runs -- instead,
   `initNativeBilling()` below fires an async restore() check on load
   and sets the flag once it resolves, dispatching a `pro-status-ready`
   event so anything that already rendered gating UI can re-check it.
   There is no native shell on the plain website/TV app, so those fall
   back to a localStorage flag -- flippable from the browser console
   (`ProGate.setTestUnlock(true)`) for testing the paywalled UI without
   a real purchase. Keep this test path until real purchases have been
   verified working end-to-end on a device.
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

  // True only inside the Android phone app (Capacitor), never in a
  // plain mobile/desktop browser or the Fire TV WebView -- Play
  // Billing only exists here, so purchase UI should only ever show
  // in this context.
  hasNativeBilling() {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.() && !!window.Capacitor?.Plugins?.ProBilling;
  },

  // True whenever running inside the native app's embedded WebView at
  // all, regardless of the billing plugin specifically. Needed because
  // Google actively refuses to complete its own sign-in flow inside an
  // embedded WebView (a security policy, not a bug) -- so anything
  // using Google Sign-In has to detect this and behave differently
  // here than in a real browser tab, until proper native OAuth
  // (external browser + deep link) is built.
  isInNativeApp() {
    return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  },

  // Fire-and-forget: checks Play's own purchase records (the real
  // source of truth, not anything stored locally) and sets
  // NATIVE_PRO_UNLOCKED once that resolves. Runs once per page load,
  // called at the bottom of this file. Consumers that render Pro-gated
  // UI before this resolves should listen for `pro-status-ready` and
  // re-check ProGate.isPro() when it fires.
  async initNativeBilling() {
    if (!this.hasNativeBilling()) return;
    try {
      const { purchased } = await window.Capacitor.Plugins.ProBilling.restore();
      if (purchased) window.NATIVE_PRO_UNLOCKED = true;
    } catch (e) {
      // Billing service not ready / no connection -- leave NATIVE_PRO_UNLOCKED
      // unset rather than guessing; a real Pro league still shows Pro features
      // via its own is_pro flag regardless of this device's purchase state.
    } finally {
      window.dispatchEvent(new Event("pro-status-ready"));
    }
  },

  // Launches the real Google Play purchase sheet for the one-time
  // "pro_upgrade" product. Resolves true on a completed purchase,
  // throws on cancel/failure -- callers should catch and show the
  // error message rather than assume success. Only ever call this
  // after checking hasNativeBilling().
  async purchase() {
    if (!this.hasNativeBilling()) throw new Error("Pro can only be purchased from the Android app.");
    const { purchased } = await window.Capacitor.Plugins.ProBilling.purchase();
    if (purchased) window.NATIVE_PRO_UNLOCKED = true;
    return purchased;
  },

  // Called after a real, confirmed web (Stripe) purchase -- persists
  // Pro on this browser/device going forward, the same way a native
  // purchase persists via window.NATIVE_PRO_UNLOCKED. Uses the same
  // underlying localStorage flag setTestUnlock() also writes (there's
  // only one "is this device Pro" bit to track), but named separately
  // so a real purchase in the code isn't confused with the dev/test
  // toggle that also happens to flip the same flag.
  markWebPurchase() {
    try {
      localStorage.setItem("auctionDraft.proUnlocked", "1");
    } catch (e) {
      /* ignore */
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

ProGate.initNativeBilling();
