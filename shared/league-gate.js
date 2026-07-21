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

function promptForLeagueCode() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "league-gate-overlay";
    overlay.innerHTML = `
      <div class="league-gate-card">
        <div class="league-gate-icon">🏈</div>
        <h2 class="league-gate-title">Enter League Code</h2>
        <p class="league-gate-hint">Ask your commissioner for the 6-character code, or try the demo.</p>
        <input type="text" class="league-gate-input" id="leagueGateInput" maxlength="6" placeholder="e.g. BLZ4K2" autocapitalize="characters" autocomplete="off" />
        <div class="league-gate-error" id="leagueGateError" hidden></div>
        <button class="league-gate-continue" id="leagueGateContinue">CONTINUE</button>
        <button class="league-gate-secondary" id="leagueGateDemo">Use Demo Instead</button>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector("#leagueGateInput");
    const errorEl = overlay.querySelector("#leagueGateError");
    const continueBtn = overlay.querySelector("#leagueGateContinue");
    const demoBtn = overlay.querySelector("#leagueGateDemo");

    input.focus();

    async function submit() {
      const code = input.value.trim().toUpperCase();
      if (!code) return;
      continueBtn.disabled = true;
      continueBtn.textContent = "CHECKING...";
      const config = await DraftStore.getConfig(code);
      if (!config) {
        errorEl.textContent = "No league found with that code.";
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
    demoBtn.addEventListener("click", () => {
      overlay.remove();
      resolve(null);
    });
  });
}

const configReady = (async function ensureLeagueAndConfig() {
  const params = new URLSearchParams(window.location.search);
  const urlLeague = params.get("league");
  if (urlLeague) LeagueSession.setLeagueCode(urlLeague.trim().toUpperCase());

  const savedCode = LeagueSession.getLeagueCode();
  if (savedCode) {
    const config = await DraftStore.getConfig(savedCode);
    if (config) {
      applyRealConfig(config, savedCode);
      return;
    }
    // Stale/invalid code (league deleted, typo saved earlier, etc.) — drop
    // it and fall through to prompting instead of silently demo-ing.
    LeagueSession.clearLeagueCode();
  }

  const result = await promptForLeagueCode();
  if (result) {
    LeagueSession.setLeagueCode(result.code);
    applyRealConfig(result.config, result.code);
    return;
  }

  applyDemoConfig();
})();
