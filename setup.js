(async function () {
  const teamCountValue = document.getElementById("teamCountValue");
  const teamCountMinus = document.getElementById("teamCountMinus");
  const teamCountPlus = document.getElementById("teamCountPlus");
  const budgetInput = document.getElementById("budgetInput");
  const slotRows = document.getElementById("slotRows");
  const totalSlotsValue = document.getElementById("totalSlotsValue");
  const teamNamesList = document.getElementById("teamNamesList");
  const statusMsg = document.getElementById("statusMsg");
  const saveBtn = document.getElementById("saveBtn");

  document.getElementById("headerGear").innerHTML = Icons.gear(22);
  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);

  const SLOT_TYPES = ["QB", "RB", "WR", "TE", "FLEX", "BENCH"];
  const SLOT_LABELS = { QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver", TE: "Tight End", FLEX: "Flex", BENCH: "Bench" };
  const SLOT_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te", FLEX: "--gold", BENCH: "--text-faint" };

  let numTeams = DEFAULT_NUM_TEAMS;
  let budget = DEFAULT_BUDGET;
  let slotCounts = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 5 };
  let teamNames = DEFAULT_TEAM_NAMES.slice(0, numTeams);

  const existing = await DraftStore.getConfig();
  if (existing) {
    numTeams = existing.num_teams;
    budget = existing.budget;
    teamNames = existing.team_names.slice();
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BENCH: 0 };
    existing.roster_slots.forEach((s) => {
      if (counts[s] !== undefined) counts[s] += 1;
    });
    slotCounts = counts;
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

  function showStatus(message, isError) {
    statusMsg.textContent = message;
    statusMsg.hidden = false;
    statusMsg.style.color = isError ? "#f28b82" : "#2dd4bf";
  }

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

  function buildRosterSlotsArray() {
    const arr = [];
    SLOT_TYPES.forEach((t) => {
      for (let i = 0; i < slotCounts[t]; i++) arr.push(t);
    });
    return arr;
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

    const confirmed = window.confirm(
      `This starts a brand-new draft: ${numTeams} teams, $${budget} budget, ${slots} roster slots per team — and clears any picks already made. Continue?`
    );
    if (!confirmed) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "SAVING...";

    const { error } = await DraftStore.saveConfig({
      teamNames: teamNames.slice(0, numTeams),
      budget,
      rosterSlots: buildRosterSlotsArray(),
    });

    if (error) {
      showStatus(`Couldn't save: ${error}`, true);
      saveBtn.disabled = false;
      saveBtn.textContent = "SAVE & START NEW DRAFT";
      return;
    }

    window.location.href = "player-entry.html";
  });

  budgetInput.value = budget;
  renderTeamCount();
  renderSlotRows();
  renderTotalSlots();
  renderTeamNames();
})();
