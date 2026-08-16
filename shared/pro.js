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
   There is no native shell on the plain website/TV app, so those rely
   on a localStorage flag instead, set by `markWebPurchase()` after a
   real, verified Stripe purchase. The dev-only bypass that used to
   flip this flag for free (a Setup button, plus a `?pro=1` URL param)
   was removed 2026-08-12 once both the native Play purchase and the
   web Stripe purchase were confirmed working end-to-end -- keeping a
   free-Pro bypass live past that point was a real, exploitable path to
   permanently unlocking any league for free (the save flow writes
   `is_pro` to the database using this same flag), not just a harmless
   dev convenience.
   =========================================================== */

const ProGate = {
  FREE_MAX_TEAMS: 14, // matches MAX_TEAMS (shared/data.js) -- no team-count cap on free anymore
  FREE_MAX_SAVED_LEAGUES: 15, // same for everyone now -- no Pro-specific cap

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
  // "pro_upgrade" product. Resolves { purchased, purchaseToken } on a
  // completed purchase, throws on cancel/failure -- callers should
  // catch and show the error message rather than assume success. Only
  // ever call this after checking hasNativeBilling(). purchaseToken is
  // the real Play purchase token -- needed so the backend can verify
  // this purchase actually happened (via the Play Developer API)
  // before registering it for cross-platform restore, rather than
  // just trusting a self-reported "I bought it."
  async purchase() {
    if (!this.hasNativeBilling()) throw new Error("Pro can only be purchased from the Android app.");
    const { purchased, purchaseToken } = await window.Capacitor.Plugins.ProBilling.purchase();
    if (purchased) window.NATIVE_PRO_UNLOCKED = true;
    return { purchased, purchaseToken };
  },

  // Called after a real, confirmed web (Stripe) purchase -- persists
  // Pro on this browser/device going forward, the same way a native
  // purchase persists via window.NATIVE_PRO_UNLOCKED.
  markWebPurchase() {
    try {
      localStorage.setItem("auctionDraft.proUnlocked", "1");
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

ProGate.initNativeBilling();
