(async function () {
  const teamGrid = document.getElementById("teamGrid");
  const teamPicker = document.getElementById("teamPicker");
  const rosterView = document.getElementById("rosterView");
  const teamBanner = document.getElementById("teamBanner");
  const budgetRow = document.getElementById("budgetRow");
  const rosterList = document.getElementById("rosterList");
  const backBtn = document.getElementById("backBtn");
  const messageFab = document.getElementById("messageFab");

  document.getElementById("headerFootball").innerHTML = Icons.helmet(24);
  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);
  document.getElementById("pylonLeft").innerHTML = Icons.pylon(18);
  document.getElementById("pylonRight").innerHTML = Icons.pylon(18);

  let currentTeamId = null;

  function renderTeamGrid() {
    teamGrid.innerHTML = TEAMS.map(
      (team) => `<div class="team-box" data-team-id="${team.id}" style="background:${team.color}">
        <div class="team-box-name">${team.name}</div>
      </div>`
    ).join("");

    teamGrid.querySelectorAll(".team-box").forEach((box) => {
      box.addEventListener("click", () => showRoster(box.dataset.teamId));
    });
  }

  function showRoster(teamId) {
    currentTeamId = teamId;
    const team = teamById(teamId);
    const roster = getTeamRoster(teamId);
    const budget = computeTeamBudget(teamId);

    teamBanner.style.background = team.color;
    teamBanner.textContent = team.name;

    budgetRow.innerHTML = `
      <div class="budget-chip"><div class="bc-label">Spent</div><div class="bc-value">$${budget.spent}</div></div>
      <div class="budget-chip"><div class="bc-label">Remaining</div><div class="bc-value">$${budget.remaining}</div></div>
      <div class="budget-chip"><div class="bc-label">Max Bid</div><div class="bc-value">$${budget.maxBid}</div></div>
    `;

    rosterList.innerHTML = roster.slots
      .map((pick, i) => {
        const slotType = ROSTER_SLOTS[i];
        if (!pick) {
          return `<div class="roster-row empty">
            <div class="roster-slot-tag">${slotType}</div>
            <div class="roster-player"><div class="rp-name">Open Slot</div></div>
            <div class="roster-price">—</div>
          </div>`;
        }
        return `<div class="roster-row filled pos-${pick.position}">
          <div class="roster-slot-tag">${slotType}</div>
          <div class="roster-player"><div class="rp-name">${pick.name}</div><div class="rp-pos">${pick.position}</div></div>
          <div class="roster-price">$${pick.price}</div>
        </div>`;
      })
      .join("");

    teamPicker.hidden = true;
    rosterView.hidden = false;
    backBtn.hidden = false;
  }

  function showPicker() {
    rosterView.hidden = true;
    teamPicker.hidden = false;
    backBtn.hidden = true;
  }

  backBtn.addEventListener("click", showPicker);

  /* ---------------- Fan message to the Draft Board ---------------- */

  function showMessageComposer() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "league-gate-overlay";
      overlay.innerHTML = `
        <div class="league-gate-card">
          <div class="league-gate-icon">📣</div>
          <h2 class="league-gate-title">Send a Message</h2>
          <p class="league-gate-hint">Shows up highlighted in the Draft Board's news scroll for everyone to see.</p>
          <input type="text" class="league-gate-input" id="boardMessageInput" maxlength="80" placeholder="Say something..." autocomplete="off" />
          <div class="league-gate-error" id="boardMessageError" hidden></div>
          <button class="league-gate-continue" id="boardMessageSend">SEND</button>
          <button class="league-gate-secondary" id="boardMessageCancel">Cancel</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector("#boardMessageInput");
      const errorEl = overlay.querySelector("#boardMessageError");
      const sendBtn = overlay.querySelector("#boardMessageSend");
      const cancelBtn = overlay.querySelector("#boardMessageCancel");
      input.focus();

      async function submit() {
        const text = input.value.trim();
        if (!text) return;
        sendBtn.disabled = true;
        sendBtn.textContent = "SENDING...";
        const { error } = await DraftStore.sendMessage(text);
        if (error) {
          errorEl.textContent = error;
          errorEl.hidden = false;
          sendBtn.disabled = false;
          sendBtn.textContent = "SEND";
          return;
        }
        overlay.remove();
        resolve();
      }

      sendBtn.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      cancelBtn.addEventListener("click", () => {
        overlay.remove();
        resolve(null);
      });
    });
  }

  messageFab.addEventListener("click", () => showMessageComposer());

  await configReady;
  messageFab.hidden = !CURRENT_LEAGUE_CODE; // demo mode has no league to post to
  await applyLivePicks();
  DraftStore.onChange(async () => {
    await applyLivePicks();
    if (!rosterView.hidden && currentTeamId) showRoster(currentTeamId);
  });

  renderTeamGrid();

  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("team");
  if (preselect && teamById(preselect)) showRoster(preselect);
})();
