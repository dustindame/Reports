(async function () {
  const leagueCodeLabel = document.getElementById("leagueCodeLabel");
  const leagueCodeDisplay = document.getElementById("leagueCodeDisplay");
  const leagueCodeHint = document.getElementById("leagueCodeHint");
  const haveCodeBtn = document.getElementById("haveCodeBtn");
  const pinSection = document.getElementById("pinSection");
  const pinInput = document.getElementById("pinInput");
  const pinConfirmInput = document.getElementById("pinConfirmInput");
  const teamCountValue = document.getElementById("teamCountValue");
  const teamCountMinus = document.getElementById("teamCountMinus");
  const teamCountPlus = document.getElementById("teamCountPlus");
  const budgetInput = document.getElementById("budgetInput");
  const slotRows = document.getElementById("slotRows");
  const totalSlotsValue = document.getElementById("totalSlotsValue");
  const teamNamesList = document.getElementById("teamNamesList");
  const warningBox = document.getElementById("warningBox");
  const statusMsg = document.getElementById("statusMsg");
  const saveBtn = document.getElementById("saveBtn");
  const switchToCreateBtn = document.getElementById("switchToCreateBtn");

  document.getElementById("headerGear").innerHTML = Icons.gear(22);
  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);

  const SLOT_TYPES = ["QB", "RB", "WR", "TE", "FLEX", "BENCH"];
  const SLOT_LABELS = { QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver", TE: "Tight End", FLEX: "Flex", BENCH: "Bench" };
  const SLOT_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te", FLEX: "--gold", BENCH: "--text-faint" };

  let mode = "create"; // or "edit"
  let leagueCode = generateLeagueCode();
  let numTeams = DEFAULT_NUM_TEAMS;
  let budget = DEFAULT_BUDGET;
  let slotCounts = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 5 };
  let teamNames = DEFAULT_TEAM_NAMES.slice(0, numTeams);

  /* ---------------- small overlay prompts (reuses shared/league-gate.css) ---------------- */

  function promptForExistingCode() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "league-gate-overlay";
      overlay.innerHTML = `
        <div class="league-gate-card">
          <div class="league-gate-icon">🏈</div>
          <h2 class="league-gate-title">Enter League Code</h2>
          <p class="league-gate-hint">Editing an existing league? Enter its code.</p>
          <input type="text" class="league-gate-input" id="existingCodeInput" maxlength="6" placeholder="e.g. BLZ4K2" autocapitalize="characters" autocomplete="off" />
          <div class="league-gate-error" id="existingCodeError" hidden></div>
          <button class="league-gate-continue" id="existingCodeContinue">CONTINUE</button>
          <button class="league-gate-secondary" id="existingCodeCancel">Cancel</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector("#existingCodeInput");
      const errorEl = overlay.querySelector("#existingCodeError");
      const continueBtn = overlay.querySelector("#existingCodeContinue");
      const cancelBtn = overlay.querySelector("#existingCodeCancel");
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
      cancelBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(null);
      });
    });
  }

  function promptForPinVerify(code) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "league-gate-overlay";
      overlay.innerHTML = `
        <div class="league-gate-card">
          <div class="league-gate-icon">🔒</div>
          <h2 class="league-gate-title">Enter Commissioner PIN</h2>
          <p class="league-gate-hint">Verify the PIN for league ${code} to edit its settings.</p>
          <input type="password" inputmode="numeric" class="league-gate-input" id="verifyPinInput" maxlength="10" placeholder="PIN" autocomplete="off" />
          <div class="league-gate-error" id="verifyPinError" hidden></div>
          <button class="league-gate-continue" id="verifyPinContinue">UNLOCK</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector("#verifyPinInput");
      const errorEl = overlay.querySelector("#verifyPinError");
      const continueBtn = overlay.querySelector("#verifyPinContinue");
      input.focus();

      async function submit() {
        const pin = input.value.trim();
        if (!pin) return;
        continueBtn.disabled = true;
        continueBtn.textContent = "CHECKING...";
        const hash = await sha256Hex(pin);
        const ok = await DraftStore.verifyPin(code, hash);
        if (!ok) {
          errorEl.textContent = "Incorrect PIN.";
          errorEl.hidden = false;
          continueBtn.disabled = false;
          continueBtn.textContent = "UNLOCK";
          input.value = "";
          input.focus();
          return;
        }
        LeagueSession.setPinHash(code, hash);
        overlay.remove();
        resolve();
      }

      continueBtn.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
    });
  }

  /* ---------------- create vs. edit mode ---------------- */

  async function loadForEdit(code, config) {
    if (!LeagueSession.getPinHash(code)) {
      await promptForPinVerify(code);
    }
    mode = "edit";
    leagueCode = code;
    numTeams = config.num_teams;
    budget = config.budget;
    teamNames = config.team_names.slice();
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BENCH: 0 };
    config.roster_slots.forEach((s) => {
      if (counts[s] !== undefined) counts[s] += 1;
    });
    slotCounts = counts;
  }

  function switchToCreate() {
    mode = "create";
    leagueCode = generateLeagueCode();
    numTeams = DEFAULT_NUM_TEAMS;
    budget = DEFAULT_BUDGET;
    slotCounts = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 5 };
    teamNames = DEFAULT_TEAM_NAMES.slice(0, numTeams);
    renderAll();
  }

  const savedCode = LeagueSession.getLeagueCode();
  if (savedCode) {
    const config = await DraftStore.getConfig(savedCode);
    if (config) {
      await loadForEdit(savedCode, config);
    } else {
      LeagueSession.clearLeagueCode();
    }
  }

  /* ---------------- rendering ---------------- */

  function renderModeChrome() {
    leagueCodeDisplay.textContent = leagueCode;
    if (mode === "edit") {
      leagueCodeLabel.textContent = "League Code";
      leagueCodeHint.textContent = "Share this so others can view this league on the Draft Board and Team Picks.";
      haveCodeBtn.hidden = true;
      pinSection.hidden = true;
      saveBtn.textContent = "SAVE CHANGES";
      warningBox.textContent = "⚠️ Saving clears any picks already made in this league.";
      switchToCreateBtn.hidden = false;
    } else {
      leagueCodeLabel.textContent = "Your New League Code";
      leagueCodeHint.textContent = "Share this so others can view your league on the Draft Board and Team Picks.";
      haveCodeBtn.hidden = false;
      pinSection.hidden = false;
      saveBtn.textContent = "CREATE LEAGUE";
      warningBox.textContent = "⚠️ Write down your league code and PIN — the PIN can't be recovered if lost.";
      switchToCreateBtn.hidden = true;
    }
  }

  function totalSlots() {
    return SLOT_TYPES.reduce((sum, t) => sum + slotCounts[t], 0);
  }

  function renderTeamCount() {
    teamCountValue.textContent = numTeams;
    teamCountMinus.disabled = numTeams <= MIN_TEAMS;
    teamCountPlus.disabled = numTeams >= MAX_TEAMS;
  }

  function renderSlotRows() {
    slotRows.innerHTML = SLOT_TYPES.map(
      (type) => `<div class="slot-row">
        <div class="slot-row-label">
          <span class="slot-row-pos-dot" style="background:var(${SLOT_COLOR_VAR[type]}); color:var(${SLOT_COLOR_VAR[type]})"></span>
          ${SLOT_LABELS[type]}
        </div>
        <div class="slot-row-stepper">
          <button class="stepper-btn" data-slot="${type}" data-dir="-1" aria-label="Fewer ${SLOT_LABELS[type]}">−</button>
          <div class="stepper-value" id="slot${type}Value">${slotCounts[type]}</div>
          <button class="stepper-btn" data-slot="${type}" data-dir="1" aria-label="More ${SLOT_LABELS[type]}">+</button>
        </div>
      </div>`
    ).join("");

    slotRows.querySelectorAll(".stepper-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.slot;
        const dir = Number(btn.dataset.dir);
        const next = slotCounts[type] + dir;
        if (next < 0 || next > 10) return;
        slotCounts[type] = next;
        document.getElementById(`slot${type}Value`).textContent = next;
        renderTotalSlots();
      });
    });
  }

  function renderTotalSlots() {
    totalSlotsValue.textContent = totalSlots();
  }

  function renderTeamNames() {
    while (teamNames.length < numTeams) {
      teamNames.push(DEFAULT_TEAM_NAMES[teamNames.length] || `Team ${teamNames.length + 1}`);
    }
    teamNames.length = numTeams;

    teamNamesList.innerHTML = teamNames
      .map(
        (name, i) => `<div class="team-name-row">
          <span class="tn-dot" style="background:${teamColorVar(i)}"></span>
          <input type="text" class="tn-input" data-idx="${i}" value="${escapeHtml(name)}" maxlength="40" />
        </div>`
      )
      .join("");

    teamNamesList.querySelectorAll(".tn-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        teamNames[Number(e.target.dataset.idx)] = e.target.value;
      });
    });
  }

  function renderAll() {
    renderModeChrome();
    budgetInput.value = budget;
    renderTeamCount();
    renderSlotRows();
    renderTotalSlots();
    renderTeamNames();
  }

  function showStatus(message, isError) {
    statusMsg.textContent = message;
    statusMsg.hidden = false;
    statusMsg.style.color = isError ? "#f28b82" : "#2dd4bf";
  }

  function buildRosterSlotsArray() {
    const arr = [];
    SLOT_TYPES.forEach((t) => {
      for (let i = 0; i < slotCounts[t]; i++) arr.push(t);
    });
    return arr;
  }

  /* ---------------- events ---------------- */

  teamCountMinus.addEventListener("click", () => {
    if (numTeams <= MIN_TEAMS) return;
    numTeams -= 1;
    renderTeamCount();
    renderTeamNames();
  });
  teamCountPlus.addEventListener("click", () => {
    if (numTeams >= MAX_TEAMS) return;
    numTeams += 1;
    renderTeamCount();
    renderTeamNames();
  });
  budgetInput.addEventListener("input", () => {
    budget = Math.max(1, Number(budgetInput.value) || 0);
  });

  haveCodeBtn.addEventListener("click", async () => {
    const result = await promptForExistingCode();
    if (!result) return;
    await loadForEdit(result.code, result.config);
    renderAll();
  });

  switchToCreateBtn.addEventListener("click", switchToCreate);

  saveBtn.addEventListener("click", async () => {
    statusMsg.hidden = true;
    const slots = totalSlots();
    if (slots < 1) {
      showStatus("Add at least one roster slot.", true);
      return;
    }
    if (budget < slots) {
      showStatus(`Budget must be at least $${slots} — every roster slot needs at least $1.`, true);
      return;
    }

    let pinHash;
    if (mode === "create") {
      const pin = pinInput.value.trim();
      const pinConfirm = pinConfirmInput.value.trim();
      if (pin.length < 4) {
        showStatus("PIN must be at least 4 characters.", true);
        return;
      }
      if (pin !== pinConfirm) {
        showStatus("PINs don't match.", true);
        return;
      }
      pinHash = await sha256Hex(pin);
    } else {
      pinHash = LeagueSession.getPinHash(leagueCode);
    }

    const confirmMessage =
      mode === "create"
        ? `Create a new league: ${numTeams} teams, $${budget} budget, ${slots} roster slots per team. Your league code is ${leagueCode} — make sure you've saved it and your PIN. Continue?`
        : `Save changes to league ${leagueCode}: ${numTeams} teams, $${budget} budget, ${slots} roster slots per team — this clears any picks already made. Continue?`;
    if (!window.confirm(confirmMessage)) return;

    saveBtn.disabled = true;
    saveBtn.textContent = mode === "create" ? "CREATING..." : "SAVING...";

    const namesToSave = teamNames.slice(0, numTeams);
    const rosterSlots = buildRosterSlotsArray();

    const { error } =
      mode === "create"
        ? await DraftStore.createLeague({ leagueCode, pinHash, teamNames: namesToSave, budget, rosterSlots })
        : await DraftStore.updateLeague({ leagueCode, pinHash, teamNames: namesToSave, budget, rosterSlots, clearPicks: true });

    if (error) {
      showStatus(`Couldn't save: ${error}`, true);
      saveBtn.disabled = false;
      saveBtn.textContent = mode === "create" ? "CREATE LEAGUE" : "SAVE CHANGES";
      return;
    }

    LeagueSession.setLeagueCode(leagueCode);
    LeagueSession.setPinHash(leagueCode, pinHash);
    window.location.href = "player-entry.html";
  });

  renderAll();
})();
