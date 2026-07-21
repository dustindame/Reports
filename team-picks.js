(async function () {
  const teamGrid = document.getElementById("teamGrid");
  const teamPicker = document.getElementById("teamPicker");
  const rosterView = document.getElementById("rosterView");
  const teamBanner = document.getElementById("teamBanner");
  const budgetRow = document.getElementById("budgetRow");
  const rosterList = document.getElementById("rosterList");
  const backBtn = document.getElementById("backBtn");

  document.getElementById("headerFootball").innerHTML = Icons.football(24, "var(--qb)");
  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);

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
