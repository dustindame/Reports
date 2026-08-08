/* ===========================================================
   Shared "which league am I looking at" resolution
   Used by draft-board.html, player-entry.html, team-picks.html

   Produces `configReady` — the same promise pattern every page script
   already awaits before touching TEAMS/ROSTER_SLOTS/BUDGET. Resolution
   order: ?league= URL param, then a remembered code in localStorage,
   then (if neither works) a prompt, with a "use the demo instead" way
   out. Only needs the league code — no PIN — since this is the "view"
   side (Draft Board, Team Picks, and just navigating to Enter Pick).
   =========================================================== */

// A themed replacement for window.confirm() -- the native browser/OS
// confirm dialog doesn't match the app's look at all (plain system
// font, no theming) and reads as broken/unfinished next to everything
// else. Reuses the same .league-gate-overlay/.league-gate-card styling
// as every other prompt in the app. Caller is responsible for
// escaping any interpolated values in `hint` (see escapeHtml in
// shared/data.js) since this sets innerHTML.
function showThemedConfirm({ icon = "⚠️", title, hint, confirmText = "Confirm", cancelText = "Cancel" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "league-gate-overlay";
    overlay.innerHTML = `
      <div class="league-gate-card">
        <div class="league-gate-icon">${icon}</div>
        <div class="league-gate-title">${title}</div>
        <p class="league-gate-hint">${hint}</p>
        <button class="league-gate-continue" id="themedConfirmYes">${confirmText}</button>
        <button class="league-gate-secondary" id="themedConfirmNo">${cancelText}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#themedConfirmYes").addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });
    overlay.querySelector("#themedConfirmNo").addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });
  });
}

function promptForLeagueCode() {
  return new Promise((resolve) => {
    // "Create a New League" only makes sense on Bid Board (the
    // commissioner's entry app) -- Draft Board and Team Picks are
    // view-only surfaces (no PIN entry, and on Draft Board specifically
    // often a TV with no comfortable keyboard for filling out Setup at
    // all), so offering league creation there is confusing/out of place
    // rather than helpful. The page itself opts in via
    // window.LEAGUE_GATE_ALLOW_CREATE, set before this script loads.
    const allowCreate = window.LEAGUE_GATE_ALLOW_CREATE === true;
    const overlay = document.createElement("div");
    overlay.className = "league-gate-overlay";
    overlay.innerHTML = `
      <div class="league-gate-card">
        <div class="league-gate-icon">🏈</div>
        <h2 class="league-gate-title">Enter League Code</h2>
        <p class="league-gate-hint">Ask your commissioner for the 6-character code${allowCreate ? ", start a new league, or try the demo." : " or try the demo."}</p>
        <input type="text" class="league-gate-input" id="leagueGateInput" maxlength="6" placeholder="e.g. BLZ4K2" autocapitalize="characters" autocomplete="off" />
        <div class="league-gate-error" id="leagueGateError" hidden></div>
        <button class="league-gate-continue" id="leagueGateContinue">CONTINUE</button>
        ${allowCreate ? '<button class="league-gate-secondary" id="leagueGateCreate">Create a New League</button>' : ""}
        <button class="league-gate-secondary" id="leagueGateDemo">Use Demo Instead</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Draft Board has a themed loading screen covering first paint (see
    // draft-board.html) -- if it turns out a league code prompt is
    // needed, that screen has to get out of the way immediately so the
    // prompt is actually visible. A plain DOM query works regardless of
    // script load order (unlike an event/callback registered by
    // draft-board.js, which might not have run yet). No-op on pages
    // that don't have this element.
    const loadingScreen = document.getElementById("boardLoadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;

    const input = overlay.querySelector("#leagueGateInput");
    const errorEl = overlay.querySelector("#leagueGateError");
    const continueBtn = overlay.querySelector("#leagueGateContinue");
    const createBtn = overlay.querySelector("#leagueGateCreate"); // null when allowCreate is false
    const demoBtn = overlay.querySelector("#leagueGateDemo");

    input.focus();

    async function submit() {
      const code = input.value.trim().toUpperCase();
      if (!code) return;
      continueBtn.disabled = true;
      continueBtn.textContent = "CHECKING...";
      const config = await DraftStore.getConfig(code);
      if (!config) {
        errorEl.textContent = config === undefined
          ? "Couldn't check that code — check your connection and try again."
          : "No league found with that code.";
        errorEl.hidden = false;
        continueBtn.disabled = false;
        continueBtn.textContent = "CONTINUE";
        return;
      }
      overlay.remove();
      resolve({ code, config });
    }

    continueBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        window.location.href = "setup.html";
      });
    }
    demoBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });
  });
}

// Shown only when a SAVED code fails to load because the request itself
// failed (no network, Supabase unreachable) -- distinct from the code
// being genuinely bad. Keeps the saved code intact and just waits for a
// working connection, rather than dropping into "enter your code again"
// (a real problem on a Fire TV, where that means typing 6 characters
// with a remote's on-screen keyboard for what's usually just a few
// seconds of bad timing at boot).
function showConnectionErrorAndRetry(savedCode) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "league-gate-overlay";
    overlay.innerHTML = `
      <div class="league-gate-card">
        <div class="league-gate-icon">📡</div>
        <h2 class="league-gate-title">Can't Connect</h2>
        <p class="league-gate-hint">Your league is still remembered on this device — this just couldn't reach it. Check the connection and try again.</p>
        <button class="league-gate-continue" id="connErrorRetry">RETRY</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const loadingScreen = document.getElementById("boardLoadingScreen");
    if (loadingScreen) loadingScreen.hidden = true;

    const retryBtn = overlay.querySelector("#connErrorRetry");
    let retrying = false;

    async function attempt() {
      if (retrying) return;
      retrying = true;
      retryBtn.disabled = true;
      retryBtn.textContent = "CHECKING...";
      const config = await DraftStore.getConfig(savedCode);
      if (config) {
        window.removeEventListener("online", attempt);
        overlay.remove();
        resolve(config);
        return;
      }
      retrying = false;
      retryBtn.disabled = false;
      retryBtn.textContent = "RETRY";
      if (config === null) {
        // Connection's fine now, but the league is genuinely gone (rare
        // mid-retry, but possible) -- only NOW is it safe to drop it.
        window.removeEventListener("online", attempt);
        overlay.remove();
        resolve(null);
      }
    }

    retryBtn.addEventListener("click", attempt);
    // Auto-retry the moment the device/app reports it's back online,
    // instead of making someone actually tap the button once the wifi
    // reconnects on its own (common right after this actually happens).
    window.addEventListener("online", attempt);
  });
}

const configReady = (async function ensureLeagueAndConfig() {
  const params = new URLSearchParams(window.location.search);
  const urlLeague = params.get("league");
  if (urlLeague) LeagueSession.setLeagueCode(urlLeague.trim().toUpperCase());

  const savedCode = LeagueSession.getLeagueCode();
  if (savedCode) {
    let config = await DraftStore.getConfig(savedCode);
    if (config === undefined) {
      // Request failed -- NOT confirmation the code is bad. Wait for a
      // working connection rather than wiping a perfectly good saved
      // league.
      config = await showConnectionErrorAndRetry(savedCode);
    }
    if (config) {
      applyRealConfig(config, savedCode);
      // Not gated on the free-tier cap -- landing here (via a saved
      // code or a shared link) always works; the cap only limits how
      // many leagues get remembered for quick switching later.
      LeagueSession.rememberLeague(savedCode, config.board_name);
      return;
    }
    // Confirmed not found (league deleted, typo saved earlier, etc.) --
    // drop it and fall through to prompting instead of silently demo-ing.
    LeagueSession.clearLeagueCode();
  }

  const result = await promptForLeagueCode();
  if (result) {
    LeagueSession.setLeagueCode(result.code);
    applyRealConfig(result.config, result.code);
    LeagueSession.rememberLeague(result.code, result.config.board_name);
    return;
  }

  applyDemoConfig();
})();
