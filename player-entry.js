(function () {
  const searchInput = document.getElementById("playerSearch");
  const searchResults = document.getElementById("searchResults");
  const previewSection = document.getElementById("previewSection");
  const previewName = document.getElementById("previewName");
  const previewPosition = document.getElementById("previewPosition");
  const clearBtn = document.getElementById("clearBtn");
  const teamGrid = document.getElementById("teamGrid");
  const bidSlider = document.getElementById("bidSlider");
  const amountValue = document.getElementById("amountValue");
  const confirmBtn = document.getElementById("confirmBtn");
  const toast = document.getElementById("toast");
  const maxLabel = document.getElementById("maxLabel");
  const budgetHint = document.getElementById("budgetHint");

  document.getElementById("footballIcon").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("footballIcon2").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("pylonLeft").innerHTML = Icons.pylon(20);
  document.getElementById("pylonRight").innerHTML = Icons.pylon(20);
  document.getElementById("searchIcon").innerHTML = Icons.search(18);
  document.getElementById("flagIcon").innerHTML = Icons.flag(20);
  document.getElementById("confirmFootball").innerHTML = Icons.football(18, "#201703");

  let selectedPlayer = null;
  let selectedTeamId = null;

  function renderTeamGrid() {
    teamGrid.innerHTML = TEAMS.map(
      (team) => `<div class="team-box" data-team-id="${team.id}" style="background:${team.color}">
        <span class="team-box-check" id="check-${team.id}"></span>
        <div class="team-box-name">${team.name}</div>
      </div>`
    ).join("");

    TEAMS.forEach((team) => {
      document.getElementById(`check-${team.id}`).innerHTML = Icons.check(18);
    });

    teamGrid.querySelectorAll(".team-box").forEach((box) => {
      box.addEventListener("click", () => {
        selectedTeamId = box.dataset.teamId;
        teamGrid.querySelectorAll(".team-box").forEach((b) => b.classList.toggle("selected", b === box));
        updateBidCap();
        updateConfirmState();
      });
    });
  }

  function updateBidCap() {
    if (!selectedTeamId) {
      bidSlider.max = 200;
      maxLabel.textContent = "Max bid $200";
      budgetHint.hidden = true;
      return;
    }
    applyLivePicks();
    const team = teamById(selectedTeamId);
    const budget = computeTeamBudget(selectedTeamId);
    bidSlider.max = Math.max(1, budget.maxBid);
    if (Number(bidSlider.value) > budget.maxBid) bidSlider.value = Math.max(1, budget.maxBid);
    maxLabel.textContent = `Max bid $${Math.max(1, budget.maxBid)}`;
    budgetHint.hidden = false;
    budgetHint.textContent = `${team.name}: $${budget.remaining} remaining, ${budget.open} open slot${budget.open === 1 ? "" : "s"}`;
    updateAmount();
  }

  function renderResults(query) {
    if (!query) {
      searchResults.innerHTML = "";
      return;
    }
    const q = query.toLowerCase();
    const matches = ALL_PLAYERS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
    searchResults.innerHTML = matches
      .map(
        (p) => `<div class="search-result-item" data-name="${p.name}" data-position="${p.position}">
          <span class="sr-name">${p.name}</span>
          <span class="sr-pos" style="background:var(${POSITION_COLOR_VAR[p.position]}); color:#fff">${p.position}</span>
        </div>`
      )
      .join("");

    searchResults.querySelectorAll(".search-result-item").forEach((item) => {
      item.addEventListener("click", () => {
        selectPlayer({ name: item.dataset.name, position: item.dataset.position });
      });
    });
  }

  function selectPlayer(player) {
    selectedPlayer = player;
    previewName.textContent = player.name;
    previewPosition.textContent = player.position;
    previewSection.hidden = false;
    searchInput.value = player.name;
    searchResults.innerHTML = "";
    updateConfirmState();
  }

  function clearPlayer() {
    selectedPlayer = null;
    previewSection.hidden = true;
    searchInput.value = "";
    searchResults.innerHTML = "";
    updateConfirmState();
    searchInput.focus();
  }

  function updateAmount() {
    amountValue.textContent = `$${bidSlider.value}`;
  }

  function updateConfirmState() {
    confirmBtn.disabled = !(selectedPlayer && selectedTeamId);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function confirmPick() {
    if (!selectedPlayer || !selectedTeamId) return;
    const team = teamById(selectedTeamId);
    DraftStore.addPick({
      name: selectedPlayer.name,
      position: selectedPlayer.position,
      teamId: selectedTeamId,
      teamName: team.name,
      price: Number(bidSlider.value),
      loggedAt: Date.now(),
    });

    showToast(`${selectedPlayer.name} → ${team.name} for $${bidSlider.value}`);

    clearPlayer();
    selectedTeamId = null;
    teamGrid.querySelectorAll(".team-box").forEach((b) => b.classList.remove("selected"));
    bidSlider.value = 1;
    updateBidCap();
    updateAmount();
    updateConfirmState();
  }

  searchInput.addEventListener("input", (e) => renderResults(e.target.value));
  clearBtn.addEventListener("click", clearPlayer);
  bidSlider.addEventListener("input", updateAmount);
  confirmBtn.addEventListener("click", confirmPick);

  applyLivePicks();
  renderTeamGrid();
  updateBidCap();
  updateAmount();
  updateConfirmState();
})();
