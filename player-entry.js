(async function () {
  const searchInput = document.getElementById("playerSearch");
  const searchResults = document.getElementById("searchResults");
  const previewSection = document.getElementById("previewSection");
  const previewName = document.getElementById("previewName");
  const previewPosition = document.getElementById("previewPosition");
  const clearBtn = document.getElementById("clearBtn");
  const teamGrid = document.getElementById("teamGrid");
  const bidSlider = document.getElementById("bidSlider");
  const bidAmountTrack = document.getElementById("bidAmountTrack");
  const amountBubble = document.getElementById("amountBubble");
  const toast = document.getElementById("toast");
  const bsrCenterLabel = document.getElementById("bsrCenterLabel");
  const bsrCenterValue = document.getElementById("bsrCenterValue");
  const bsrMaxValue = document.getElementById("bsrMaxValue");
  const slideConfirm = document.getElementById("slideConfirm");
  const slideHandle = document.getElementById("slideHandle");
  const slideProgress = document.getElementById("slideProgress");
  const sclMain = document.getElementById("sclMain");

  document.getElementById("footballIcon").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("footballIcon2").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("pylonLeft").innerHTML = Icons.pylon(20);
  document.getElementById("pylonRight").innerHTML = Icons.pylon(20);
  document.getElementById("searchIcon").innerHTML = Icons.search(18);
  document.getElementById("flagIcon").innerHTML = Icons.flag(20);
  document.getElementById("slideChevron").innerHTML = Icons.chevronRight(22, "#eaf1ff");

  let selectedPlayer = null;
  let selectedTeamId = null;

  async function renderTeamGrid() {
    await applyLivePicks();
    teamGrid.innerHTML = TEAMS.map((team) => {
      const budget = computeTeamBudget(team.id);
      return `<div class="team-box" data-team-id="${team.id}" style="background:${team.color}">
        <span class="team-box-check" id="check-${team.id}"></span>
        <div class="team-box-name">${team.name}</div>
        <div class="team-box-divider"></div>
        <div class="team-box-stat"><span class="tbs-icon">🔨</span><span class="tbs-val">$${budget.maxBid}</span><span class="tbs-icon">💰</span><span class="tbs-val">$${budget.remaining}</span></div>
      </div>`;
    }).join("");

    TEAMS.forEach((team) => {
      document.getElementById(`check-${team.id}`).innerHTML = Icons.check(18);
    });

    teamGrid.querySelectorAll(".team-box").forEach((box) => {
      box.classList.toggle("selected", box.dataset.teamId === selectedTeamId);
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
      bsrCenterLabel.textContent = "Select a team";
      bsrCenterValue.textContent = "—";
      bsrMaxValue.textContent = "$200";
      positionBubble();
      return;
    }
    const team = teamById(selectedTeamId);
    const budget = computeTeamBudget(selectedTeamId);
    bidSlider.max = Math.max(1, budget.maxBid);
    if (Number(bidSlider.value) > budget.maxBid) bidSlider.value = Math.max(1, budget.maxBid);
    bsrCenterLabel.textContent = `Budget Remaining (${team.name})`;
    bsrCenterValue.textContent = `$${budget.remaining}`;
    bsrMaxValue.textContent = `$${Math.max(1, budget.maxBid)}`;
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

  function positionBubble() {
    const min = Number(bidSlider.min);
    const max = Number(bidSlider.max);
    const percent = max > min ? (Number(bidSlider.value) - min) / (max - min) : 0;
    const trackRect = bidAmountTrack.getBoundingClientRect();
    const sliderRect = bidSlider.getBoundingClientRect();
    const thumbSize = 28;
    const left = sliderRect.left - trackRect.left + thumbSize / 2 + percent * (sliderRect.width - thumbSize);
    amountBubble.style.left = `${left}px`;
  }

  function updateAmount() {
    amountBubble.textContent = `$${bidSlider.value}`;
    positionBubble();
  }

  function isReady() {
    return Boolean(selectedPlayer && selectedTeamId);
  }

  function updateConfirmState() {
    slideConfirm.classList.toggle("disabled", !isReady());
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function confirmPick() {
    if (!isReady()) return;
    const team = teamById(selectedTeamId);
    await DraftStore.addPick({
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
    bidSlider.value = 1;
    await renderTeamGrid();
    updateBidCap();
    updateAmount();
    updateConfirmState();
  }

  /* ---------------- Slide to confirm ---------------- */

  let dragging = false;
  let handleX = 0;

  function trackWidth() {
    return slideConfirm.clientWidth - slideHandle.offsetWidth - 6;
  }

  function setHandle(x) {
    handleX = Math.max(0, Math.min(x, trackWidth()));
    slideHandle.style.left = `${3 + handleX}px`;
    slideProgress.style.width = `${3 + handleX + slideHandle.offsetWidth / 2}px`;
    sclMain.style.opacity = String(1 - handleX / (trackWidth() || 1));
  }

  function snapTo(x, done) {
    slideHandle.style.transition = "left 0.2s ease";
    slideProgress.style.transition = "width 0.2s ease";
    setHandle(x);
    setTimeout(() => {
      slideHandle.style.transition = "";
      slideProgress.style.transition = "";
      if (done) done();
    }, 200);
  }

  function onPointerDown(e) {
    if (!isReady()) return;
    dragging = true;
    slideHandle.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const rect = slideConfirm.getBoundingClientRect();
    setHandle(e.clientX - rect.left - slideHandle.offsetWidth / 2 - 3);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const max = trackWidth();
    if (max > 0 && handleX >= max * 0.82) {
      snapTo(max, async () => {
        await confirmPick();
        snapTo(0);
      });
    } else {
      snapTo(0);
    }
  }

  slideHandle.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  slideHandle.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && isReady()) {
      e.preventDefault();
      snapTo(trackWidth(), async () => {
        await confirmPick();
        snapTo(0);
      });
    }
  });

  window.addEventListener("resize", () => {
    positionBubble();
    setHandle(0);
  });

  searchInput.addEventListener("input", (e) => renderResults(e.target.value));
  clearBtn.addEventListener("click", clearPlayer);
  bidSlider.addEventListener("input", updateAmount);

  // Someone else's pick (another Player Entry session) also affects this
  // team's live budget, so keep the cards in sync via Supabase Realtime.
  DraftStore.onChange(async () => {
    await renderTeamGrid();
    updateBidCap();
  });

  await renderTeamGrid();
  updateBidCap();
  updateAmount();
  updateConfirmState();
  setHandle(0);
})();
