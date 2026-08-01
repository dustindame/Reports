(async function () {
  const leagueCodeLabel = document.getElementById("leagueCodeLabel");
  const leagueCodeDisplay = document.getElementById("leagueCodeDisplay");
  const leagueCodeHint = document.getElementById("leagueCodeHint");
  const haveCodeBtn = document.getElementById("haveCodeBtn");
  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const pinSection = document.getElementById("pinSection");
  const pinInput = document.getElementById("pinInput");
  const pinConfirmInput = document.getElementById("pinConfirmInput");
  const teamCountValue = document.getElementById("teamCountValue");
  const teamCountMinus = document.getElementById("teamCountMinus");
  const teamCountPlus = document.getElementById("teamCountPlus");
  const budgetInput = document.getElementById("budgetInput");
  const budgetMinus = document.getElementById("budgetMinus");
  const budgetPlus = document.getElementById("budgetPlus");
  const slotRows = document.getElementById("slotRows");
  const totalSlotsValue = document.getElementById("totalSlotsValue");
  const teamNamesList = document.getElementById("teamNamesList");
  const boardNameInput = document.getElementById("boardNameInput");
  const toggleNews = document.getElementById("toggleNews");
  const toggleMessages = document.getElementById("toggleMessages");
  const toggleRecent = document.getElementById("toggleRecent");
  const toggleDraftedTotal = document.getElementById("toggleDraftedTotal");
  const togglePositionTotals = document.getElementById("togglePositionTotals");
  const toggleElapsedTime = document.getElementById("toggleElapsedTime");
  const toggleShowRecap = document.getElementById("toggleShowRecap");
  const toggleBreakEnabled = document.getElementById("toggleBreakEnabled");
  const toggleNice = document.getElementById("toggleNice");
  const toggleRoast = document.getElementById("toggleRoast");
  const shotsValue = document.getElementById("shotsValue");
  const shotsMinus = document.getElementById("shotsMinus");
  const shotsPlus = document.getElementById("shotsPlus");
  const warningBox = document.getElementById("warningBox");
  const statusMsg = document.getElementById("statusMsg");
  const saveBtn = document.getElementById("saveBtn");
  const switchToCreateBtn = document.getElementById("switchToCreateBtn");


  const SLOT_TYPES = ["QB", "RB", "WR", "TE", "DEF", "K", "FLEX", "SFLEX", "BENCH"];
  const SLOT_LABELS = { QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver", TE: "Tight End", DEF: "Defense/Special Teams", K: "Kicker", FLEX: "Flex", SFLEX: "Superflex", BENCH: "Bench" };
  const SLOT_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te", DEF: "--def", K: "--k", FLEX: "--gold", SFLEX: "--gold-bright", BENCH: "--text-faint" };
  const DEFAULT_SLOT_COUNTS = { QB: 1, RB: 2, WR: 2, TE: 1, DEF: 0, K: 0, FLEX: 2, SFLEX: 0, BENCH: 5 };
  // How high each real position's lineup count can go -- unlisted slot
  // types (FLEX/SFLEX/BENCH) keep the generic 10-slot ceiling below.
  const SLOT_MAX = { QB: 4, RB: 6, WR: 6, TE: 4, DEF: 3, K: 3 };

  let mode = "create"; // or "edit"
  // True once a loaded-for-edit league already has is_pro=true in Supabase.
  // Pro is a property of the LEAGUE, not the device editing it -- anyone
  // with the league code + PIN (e.g. a friend covering Draft Entry) must
  // get full Pro access to an already-Pro league even on a non-Pro device,
  // and must never be able to accidentally downgrade it back to free.
  let existingLeagueIsPro = false;
  // True once an edited league already has at least one pick logged.
  // Team count, budget, and roster positions get locked at that point --
  // changing any of them would shift/invalidate what existing picks
  // actually mean (team indices, budget math, position eligibility) --
  // while board name, display toggles, and Fun Extras stay freely
  // editable since they don't touch anything already drafted.
  let draftStarted = false;
  let leagueCode = generateLeagueCode();
  let numTeams = DEFAULT_NUM_TEAMS;
  let budget = DEFAULT_BUDGET;
  let slotCounts = { ...DEFAULT_SLOT_COUNTS };
  let teamNames = DEFAULT_TEAM_NAMES.slice(0, numTeams);
  let boardName = "";
  let showNews = true;
  let showMessages = false;
  let showRecent = false;
  let showDraftedTotal = true;
  let showPositionTotals = false;
  let showElapsedTime = false;
  let niceEnabled = false;
  let shotsCount = 0;
  let roastEnabled = false;
  let showRecap = false;
  let breakEnabled = false;

  /* ---------------- small overlay prompts (reuses shared/league-gate.css) ---------------- */

  // A themed replacement for window.confirm() -- setup.html doesn't
  // load shared/league-gate.js (it manages its own overlay flow
  // independently), so this is a local copy of the same helper rather
  // than a cross-page dependency. Caller must escape any interpolated
  // values in `hint` since this sets innerHTML.
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
          <input type="text" inputmode="numeric" class="league-gate-input" id="verifyPinInput" maxlength="10" placeholder="PIN" autocomplete="off" />
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
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DEF: 0, K: 0, FLEX: 0, SFLEX: 0, BENCH: 0 };
    config.roster_slots.forEach((s) => {
      if (counts[s] !== undefined) counts[s] += 1;
    });
    slotCounts = counts;
    boardName = config.board_name || "";
    showNews = config.show_news !== false;
    showMessages = config.show_messages !== false;
    showRecent = config.show_recent !== false;
    showDraftedTotal = config.show_drafted_total !== false;
    showPositionTotals = Boolean(config.show_position_totals);
    showElapsedTime = Boolean(config.show_elapsed_time);
    niceEnabled = Boolean(config.nice_enabled);
    shotsCount = Number(config.shots_count) || 0;
    roastEnabled = config.roast_enabled !== false;
    showRecap = config.show_recap !== false;
    breakEnabled = config.break_enabled !== false;
    existingLeagueIsPro = Boolean(config.is_pro);
    draftStarted = await DraftStore.hasAnyPicks(code);
  }

  function switchToCreate() {
    mode = "create";
    existingLeagueIsPro = false;
    draftStarted = false;
    leagueCode = generateLeagueCode();
    numTeams = DEFAULT_NUM_TEAMS;
    budget = DEFAULT_BUDGET;
    slotCounts = { ...DEFAULT_SLOT_COUNTS };
    teamNames = DEFAULT_TEAM_NAMES.slice(0, numTeams);
    boardName = "";
    showNews = true;
    showMessages = false;
    showRecent = false;
    showDraftedTotal = true;
    showPositionTotals = false;
    showElapsedTime = false;
    niceEnabled = false;
    shotsCount = 0;
    roastEnabled = false;
    showRecap = false;
    breakEnabled = false;
    renderAll();
  }

  const savedCode = LeagueSession.getLeagueCode();
  if (savedCode) {
    const config = await DraftStore.getConfig(savedCode);
    if (config) {
      await loadForEdit(savedCode, config);
    } else if (config === undefined) {
      // Request failed (no connection, Supabase unreachable, etc.) --
      // NOT confirmation the code is bad. Leave it saved and just tell
      // the user, rather than silently dropping into "create a new
      // league" mode as if their league had vanished.
      showStatus("Couldn't reach your league — check your connection and reopen Setup to try again.", true);
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
      warningBox.textContent = draftStarted
        ? "🔒 Picks have already been logged — team count, budget, and roster positions are locked and existing picks are kept. Everything else can still be changed freely."
        : "⚠️ Saving clears any picks already made in this league.";
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

  function effectiveMaxTeams() {
    return ProGate.isPro() || existingLeagueIsPro ? MAX_TEAMS : Math.min(MAX_TEAMS, ProGate.FREE_MAX_TEAMS);
  }

  function renderTeamCount() {
    teamCountValue.textContent = numTeams;
    teamCountMinus.disabled = numTeams <= MIN_TEAMS;
    teamCountPlus.disabled = numTeams >= effectiveMaxTeams();
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
        if (draftStarted) return;
        const type = btn.dataset.slot;
        const dir = Number(btn.dataset.dir);
        const next = slotCounts[type] + dir;
        const max = SLOT_MAX[type] ?? 10;
        if (next < 0 || next > max) return;
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
          <input type="text" class="tn-input" data-idx="${i}" value="${escapeHtml(name)}" maxlength="12" />
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
    boardNameInput.value = boardName;
    toggleNews.checked = showNews;
    toggleMessages.checked = showMessages;
    toggleRecent.checked = showRecent;
    toggleDraftedTotal.checked = showDraftedTotal;
    togglePositionTotals.checked = showPositionTotals;
    toggleElapsedTime.checked = showElapsedTime;
    toggleShowRecap.checked = showRecap;
    toggleBreakEnabled.checked = breakEnabled;
    toggleNice.checked = niceEnabled;
    toggleRoast.checked = roastEnabled;
    shotsValue.textContent = shotsCount;
    applyProGating();
    applyDraftLock();
  }

  // Locks team count, budget, and roster positions once the draft has any
  // picks logged -- changing any of them mid-draft would shift/invalidate
  // what's already been drafted (team indices, budget math, position
  // eligibility). Board name, display toggles, and Fun Extras are
  // unaffected -- those are safe to change at any time.
  const teamCountSection = document.getElementById("teamCountSection");
  const budgetSection = document.getElementById("budgetSection");
  const rosterSection = document.getElementById("rosterSection");
  const teamCountLockedHint = document.getElementById("teamCountLockedHint");
  const budgetLockedHint = document.getElementById("budgetLockedHint");
  const rosterLockedHint = document.getElementById("rosterLockedHint");
  function applyDraftLock() {
    [teamCountSection, budgetSection, rosterSection].forEach((el) => {
      el.classList.toggle("draft-locked", draftStarted);
    });
    teamCountLockedHint.hidden = !draftStarted;
    budgetLockedHint.hidden = !draftStarted;
    rosterLockedHint.hidden = !draftStarted;
  }

  // Dims + disables every Pro-gated control (marked with data-pro="1"
  // in setup.html) when not unlocked. A capture-phase click listener
  // (attached once, below) intercepts taps on locked controls to show
  // an upsell instead of silently doing nothing.
  function applyProGating() {
    const isPro = ProGate.isPro() || existingLeagueIsPro;
    document.querySelectorAll('[data-pro="1"]').forEach((el) => {
      el.classList.toggle("pro-locked", !isPro);
    });
  }

  // TEMPORARY dev/test control (see setup.html) -- lets Pro be flipped
  // on/off from a button instead of the console/URL-param tricks, for
  // easy testing on any device including a phone. Remove this whole
  // block (and the matching HTML/CSS) once real Pro billing ships or
  // it's no longer needed for testing.
  const devProToggle = document.getElementById("devProToggle");
  function updateDevProToggleUi() {
    const isPro = ProGate.isPro();
    devProToggle.textContent = isPro ? "TEST: Pro is ON — Tap to Turn Off" : "TEST: Pro is OFF — Tap to Turn On";
    devProToggle.classList.toggle("active", isPro);
  }
  devProToggle.addEventListener("click", () => {
    ProGate.setTestUnlock(!ProGate.isPro());
    window.location.reload();
  });
  updateDevProToggleUi();

  let proUpsellShownAt = 0;
  document.addEventListener(
    "click",
    (e) => {
      const locked = e.target.closest('[data-pro="1"].pro-locked');
      if (!locked) return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - proUpsellShownAt > 500) {
        showStatus("That's a Pro feature — upgrade to unlock it", false);
        proUpsellShownAt = now;
      }
    },
    true
  );

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

  // Picks `count` distinct overall pick numbers (1..totalPicks) to be
  // "take a shot" picks -- re-rolled fresh on every save, so editing a
  // league's Shots setting reshuffles which picks trigger one.
  function pickRandomShotNumbers(count, totalPicks) {
    const n = Math.min(count, totalPicks);
    if (n <= 0) return [];
    const pool = Array.from({ length: totalPicks }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n).sort((a, b) => a - b);
  }

  /* ---------------- events ---------------- */

  teamCountMinus.addEventListener("click", () => {
    if (draftStarted || numTeams <= MIN_TEAMS) return;
    numTeams -= 1;
    renderTeamCount();
    renderTeamNames();
  });
  teamCountPlus.addEventListener("click", () => {
    if (draftStarted) return;
    if (numTeams >= effectiveMaxTeams()) {
      if (!ProGate.isPro() && numTeams >= ProGate.FREE_MAX_TEAMS) {
        showStatus(`Upgrade to Pro for more than ${ProGate.FREE_MAX_TEAMS} teams`, false);
      }
      return;
    }
    numTeams += 1;
    renderTeamCount();
    renderTeamNames();
  });
  const BUDGET_STEP = 5;
  const BUDGET_MAX = 10000;
  budgetInput.addEventListener("input", () => {
    if (draftStarted) { budgetInput.value = budget; return; }
    const digitsOnly = budgetInput.value.replace(/[^0-9]/g, "");
    if (digitsOnly !== budgetInput.value) budgetInput.value = digitsOnly;
    budget = Math.min(BUDGET_MAX, Math.max(1, Number(digitsOnly) || 0));
    if (Number(digitsOnly) > BUDGET_MAX) budgetInput.value = budget;
  });
  budgetMinus.addEventListener("click", () => {
    if (draftStarted) return;
    budget = Math.max(1, budget - BUDGET_STEP);
    budgetInput.value = budget;
  });
  budgetPlus.addEventListener("click", () => {
    if (draftStarted) return;
    budget = Math.min(BUDGET_MAX, budget + BUDGET_STEP);
    budgetInput.value = budget;
  });

  document.getElementById("copyCodeIcon").innerHTML = Icons.copy(16);

  // Clipboard access can fail (no permission, insecure context, older
  // WebView) -- falls back to a hidden-textarea + execCommand, which
  // works in more places even though it's the deprecated API, so this
  // button doesn't just silently do nothing on a device where the
  // modern clipboard API isn't available.
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  copyCodeBtn.addEventListener("click", async () => {
    const ok = await copyText(leagueCode);
    showStatus(ok ? "League code copied!" : "Couldn't copy — copy it by hand instead.", !ok);
  });

  haveCodeBtn.addEventListener("click", async () => {
    const result = await promptForExistingCode();
    if (!result) return;
    await loadForEdit(result.code, result.config);
    renderAll();
  });

  switchToCreateBtn.addEventListener("click", switchToCreate);

  boardNameInput.addEventListener("input", () => {
    boardName = boardNameInput.value;
  });
  toggleNews.addEventListener("change", () => { showNews = toggleNews.checked; });
  toggleMessages.addEventListener("change", () => { showMessages = toggleMessages.checked; });
  toggleRecent.addEventListener("change", () => { showRecent = toggleRecent.checked; });
  toggleDraftedTotal.addEventListener("change", () => { showDraftedTotal = toggleDraftedTotal.checked; });
  togglePositionTotals.addEventListener("change", () => { showPositionTotals = togglePositionTotals.checked; });
  toggleElapsedTime.addEventListener("change", () => { showElapsedTime = toggleElapsedTime.checked; });
  toggleShowRecap.addEventListener("change", () => { showRecap = toggleShowRecap.checked; });
  toggleBreakEnabled.addEventListener("change", () => { breakEnabled = toggleBreakEnabled.checked; });
  toggleNice.addEventListener("change", () => { niceEnabled = toggleNice.checked; });
  toggleRoast.addEventListener("change", () => { roastEnabled = toggleRoast.checked; });
  shotsMinus.addEventListener("click", () => {
    if (shotsCount <= 0) return;
    shotsCount -= 1;
    shotsValue.textContent = shotsCount;
  });
  shotsPlus.addEventListener("click", () => {
    if (shotsCount >= 10) return;
    shotsCount += 1;
    shotsValue.textContent = shotsCount;
  });

  function showCreatedConfirmation(code, pin) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "league-gate-overlay";
      overlay.innerHTML = `
        <div class="league-gate-card">
          <div class="league-gate-icon">✅</div>
          <h2 class="league-gate-title">League Created!</h2>
          <p class="league-gate-hint">Write these down — the PIN can't be recovered if lost. Anyone you give both of these to can log picks too, from their own phone — handy if you want to split up Draft Entry duty or hand it off if you need to step away.</p>
          <div class="created-field">
            <span class="created-label">League Code</span>
            <span class="created-value">${escapeHtml(code)}</span>
          </div>
          <div class="created-field">
            <span class="created-label">Commissioner PIN</span>
            <span class="created-value">${escapeHtml(pin)}</span>
          </div>
          <button class="league-gate-secondary" id="createdCopyBtn">Copy Code &amp; PIN to Share</button>
          <button class="league-gate-continue" id="createdContinue">CONTINUE TO ENTER PICK</button>
        </div>
      `;
      document.body.appendChild(overlay);
      const copyBtn = overlay.querySelector("#createdCopyBtn");
      copyBtn.addEventListener("click", async () => {
        const shareText = `Join our draft!\nLeague Code: ${code}\nCommissioner PIN: ${pin}\n(Anyone with both can log picks in Draft Entry.)`;
        const ok = await copyText(shareText);
        copyBtn.textContent = ok ? "Copied!" : "Couldn't copy — write it down instead";
      });
      overlay.querySelector("#createdContinue").addEventListener("click", () => {
        overlay.remove();
        resolve();
      });
    });
  }

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
    let plainPin = null;
    if (mode === "create") {
      plainPin = pinInput.value.trim();
      const pinConfirm = pinConfirmInput.value.trim();
      if (plainPin.length < 4) {
        showStatus("PIN must be at least 4 characters.", true);
        return;
      }
      if (plainPin !== pinConfirm) {
        showStatus("PINs don't match.", true);
        return;
      }
      pinHash = await sha256Hex(plainPin);
    } else {
      pinHash = LeagueSession.getPinHash(leagueCode);
    }

    const confirmHint =
      mode === "create"
        ? `Create a new league: ${numTeams} teams, $${budget} budget, ${slots} roster slots per team.`
        : draftStarted
        ? `Save changes to league ${leagueCode}? Team count, budget, and roster positions are locked since picks are already logged — everything else will update, and existing picks are kept.`
        : `Save changes to league ${leagueCode}: ${numTeams} teams, $${budget} budget, ${slots} roster slots per team — this clears any picks already made.`;
    const confirmed = await showThemedConfirm({
      icon: mode === "create" ? "🏈" : "⚠️",
      title: mode === "create" ? "Create League?" : "Save Changes?",
      hint: confirmHint,
      confirmText: mode === "create" ? "CREATE" : "SAVE",
    });
    if (!confirmed) return;

    saveBtn.disabled = true;
    saveBtn.textContent = mode === "create" ? "CREATING..." : "SAVING...";

    const namesToSave = teamNames.slice(0, numTeams);
    const rosterSlots = buildRosterSlotsArray();
    const totalPicks = numTeams * slots;
    const boardOptions = {
      boardName: boardName.trim() || "Auction Draft Board",
      showNews,
      showMessages,
      showRecent,
      showDraftedTotal,
      showPositionTotals,
      showElapsedTime,
      niceEnabled,
      shotsCount,
      shotPickNumbers: pickRandomShotNumbers(shotsCount, totalPicks),
      roastEnabled,
      showRecap,
      breakEnabled,
      // Once a league is Pro, saving it must never flip is_pro back to
      // false just because the device doing the editing isn't Pro itself.
      isPro: ProGate.isPro() || existingLeagueIsPro,
    };

    const { error } =
      mode === "create"
        ? await DraftStore.createLeague({ leagueCode, pinHash, teamNames: namesToSave, budget, rosterSlots, boardOptions })
        : await DraftStore.updateLeague({ leagueCode, pinHash, teamNames: namesToSave, budget, rosterSlots, clearPicks: !draftStarted, boardOptions });

    if (error) {
      showStatus(`Couldn't save: ${error}`, true);
      saveBtn.disabled = false;
      saveBtn.textContent = mode === "create" ? "CREATE LEAGUE" : "SAVE CHANGES";
      return;
    }

    LeagueSession.setLeagueCode(leagueCode);
    LeagueSession.setPinHash(leagueCode, pinHash);
    LeagueSession.rememberLeague(leagueCode, boardName);

    if (mode === "create") {
      await showCreatedConfirmation(leagueCode, plainPin);
    }
    window.location.href = "player-entry.html";
  });

  renderAll();
})();
