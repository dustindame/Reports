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
  FREE_MAX_TEAMS: 10,
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
};
