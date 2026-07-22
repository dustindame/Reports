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
  const recentPicksList = document.getElementById("recentPicksList");
  const pickSearchInput = document.getElementById("pickSearchInput");

  document.getElementById("footballIcon").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("footballIcon2").innerHTML = Icons.football(26, "var(--qb)");
  document.getElementById("pylonLeft").innerHTML = Icons.pylon(20);
  document.getElementById("pylonRight").innerHTML = Icons.pylon(20);
  document.getElementById("setupGear").innerHTML = Icons.whistle(18);
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

    renderRecentPicks();
  }

  /* ---------------- All picks / undo ----------------
     Shows every pick made so far, not just the last few, so a
     mis-entered pick from earlier in the draft can still be found and
     corrected — filterable by player/team since a full draft can run to
     100+ picks. */
  let pickSearchQuery = "";

  function renderRecentPicks() {
    const q = pickSearchQuery.trim().toLowerCase();
    const all = MOCK_DRAFT.picks.slice().reverse();
    const recent = q
      ? all.filter((pick) => {
          const team = teamById(pick.teamId);
          return pick.name.toLowerCase().includes(q) || (team && team.name.toLowerCase().includes(q));
        })
      : all;
    if (recent.length === 0) {
      recentPicksList.innerHTML = `<div class="recent-picks-empty">${q ? "No picks match your search." : "No picks yet."}</div>`;
      return;
    }
    recentPicksList.innerHTML = recent
      .map((pick) => {
        const team = teamById(pick.teamId);
        return `<div class="recent-pick-row">
          <span class="rp-team-dot" style="background:${team.color}; color:${team.color}"></span>
          <div class="rp-info">
            <div class="rp-name">${pick.name}<span class="rp-pos">${pick.position}</span></div>
            <div class="rp-team">${team.name} · $${pick.price}</div>
          </div>
          <button class="rp-undo" data-pick-id="${pick.id}" aria-label="Undo this pick">✕</button>
        </div>`;
      })
      .join("");

    recentPicksList.querySelectorAll(".rp-undo").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pickId = btn.dataset.pickId;
        const pick = MOCK_DRAFT.picks.find((p) => p.id === pickId);
        if (!pick) return;
        const team = teamById(pick.teamId);
        if (!window.confirm(`Remove ${pick.name} ($${pick.price}) from ${team.name}?`)) return;
        await undoPick(pickId);
      });
    });
  }

  async function undoPick(pickId) {
    if (!CURRENT_LEAGUE_CODE) {
      removePickLocally(pickId);
      showToast("Pick undone (demo)");
    } else {
      const pinHash = LeagueSession.getPinHash(CURRENT_LEAGUE_CODE);
      const { error } = await DraftStore.deletePick(pickId, pinHash);
      if (error) {
        if (error === "Incorrect commissioner PIN.") {
          LeagueSession.clearPinHash(CURRENT_LEAGUE_CODE);
          showToast("Wrong PIN — try again");
          await ensurePinUnlocked();
        } else {
          showToast(`Couldn't undo: ${error}`);
        }
        return;
      }
      removePickLocally(pickId);
      showToast("Pick undone");
    }
    await renderTeamGrid();
    updateBidCap();
  }

  function updateBidCap() {
    if (!selectedTeamId) {
      bidSlider.max = BUDGET;
      bsrCenterLabel.textContent = "Select a team";
      bsrCenterValue.textContent = "—";
      bsrMaxValue.textContent = `$${BUDGET}`;
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

  function isAlreadyDrafted(name, position) {
    return MOCK_DRAFT.picks.some((p) => p.name === name && p.position === position);
  }

  function renderResults(query) {
    if (!query) {
      searchResults.innerHTML = "";
      return;
    }
    const q = query.toLowerCase();
    const matches = ALL_PLAYERS.filter((p) => p.name.toLowerCase().includes(q) && !isAlreadyDrafted(p.name, p.position)).slice(0, 8);
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
    const thumbSize = 34;
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

  /* ---------------- Commissioner PIN gate ----------------
     Only shown for a real league (demo mode has no PIN, nothing to
     protect). Verified server-side via the verify_pin RPC — see
     shared/data.js and supabase/migrations. */
  function showPinPrompt() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "league-gate-overlay";
      overlay.innerHTML = `
        <div class="league-gate-card">
          <div class="league-gate-icon">🔒</div>
          <h2 class="league-gate-title">Enter Commissioner PIN</h2>
          <p class="league-gate-hint">Only the commissioner's PIN can log picks for this league.</p>
          <input type="text" inputmode="numeric" class="league-gate-input" id="pinGateInput" maxlength="10" placeholder="PIN" autocomplete="off" />
          <div class="league-gate-error" id="pinGateError" hidden></div>
          <button class="league-gate-continue" id="pinGateContinue">UNLOCK</button>
          <button class="league-gate-secondary" id="pinGateNotMine">This Isn't My League</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector("#pinGateInput");
      const errorEl = overlay.querySelector("#pinGateError");
      const continueBtn = overlay.querySelector("#pinGateContinue");
      const notMineBtn = overlay.querySelector("#pinGateNotMine");
      input.focus();

      async function submit() {
        const pin = input.value.trim();
        if (!pin) return;
        continueBtn.disabled = true;
        continueBtn.textContent = "CHECKING...";
        const hash = await sha256Hex(pin);
        const ok = await DraftStore.verifyPin(CURRENT_LEAGUE_CODE, hash);
        if (!ok) {
          errorEl.textContent = "Incorrect PIN.";
          errorEl.hidden = false;
          continueBtn.disabled = false;
          continueBtn.textContent = "UNLOCK";
          input.value = "";
          input.focus();
          return;
        }
        LeagueSession.setPinHash(CURRENT_LEAGUE_CODE, hash);
        overlay.remove();
        resolve();
      }

      continueBtn.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      notMineBtn.addEventListener("click", () => {
        LeagueSession.clearLeagueCode();
        window.location.reload();
      });
    });
  }

  async function ensurePinUnlocked() {
    if (!CURRENT_LEAGUE_CODE) return; // demo mode — nothing to protect
    if (LeagueSession.getPinHash(CURRENT_LEAGUE_CODE)) return; // already unlocked this tab session
    await showPinPrompt();
  }

  async function confirmPick() {
    if (!isReady()) return;
    const team = teamById(selectedTeamId);
    const price = Number(bidSlider.value);
    const pickNumber = draftedCount() + 1; // this pick's overall sequence number, for the Shots feature

    // Belt-and-suspenders re-check: the search list already hides drafted
    // players, but this closes the race where a pick came in (e.g. from
    // another device) between opening the search and sliding to confirm.
    if (isAlreadyDrafted(selectedPlayer.name, selectedPlayer.position)) {
      showToast(`${selectedPlayer.name} was already drafted`);
      clearPlayer();
      return;
    }

    if (!CURRENT_LEAGUE_CODE) {
      // Demo mode: no real league to write to (picks always belong to a
      // league in the database) — simulate locally so the UI still feels
      // functional for trying things out.
      const roster = getTeamRoster(selectedTeamId);
      const slotIndex = findOpenSlotIndex(roster, selectedPlayer.position);
      if (slotIndex !== -1) {
        const pick = { id: crypto.randomUUID(), pickNumber: MOCK_DRAFT.picks.length + 1, teamId: selectedTeamId, slotIndex, name: selectedPlayer.name, position: selectedPlayer.position, price };
        roster.slots[slotIndex] = pick;
        MOCK_DRAFT.picks.push(pick);
      }
      showToast(`${selectedPlayer.name} → ${team.name} for $${price} (demo — not saved)`);
    } else {
      const pinHash = LeagueSession.getPinHash(CURRENT_LEAGUE_CODE);
      const { error } = await DraftStore.addPick({ name: selectedPlayer.name, position: selectedPlayer.position, teamId: selectedTeamId, price }, pinHash);
      if (error) {
        if (error === "Incorrect commissioner PIN.") {
          LeagueSession.clearPinHash(CURRENT_LEAGUE_CODE);
          showToast("Wrong PIN — try again");
          await ensurePinUnlocked();
        } else {
          showToast(`Couldn't save pick: ${error}`);
        }
        return;
      }
      showToast(`${selectedPlayer.name} → ${team.name} for $${price}`);

      // Fun extras, both opt-in per league and posted via the same
      // message-ticker pipeline as fan shout-outs. Fire-and-forget --
      // nothing about the pick itself depends on these succeeding.
      if (NICE_ENABLED && price === 69) {
        DraftStore.sendMessage("Nice! Nice! Nice! Nice! Nice!");
      }
      if (SHOT_PICK_NUMBERS.includes(pickNumber)) {
        DraftStore.sendMessage(`🍺 ${team.name} — take a shot!`);
      }
    }

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
  pickSearchInput.addEventListener("input", (e) => {
    pickSearchQuery = e.target.value;
    renderRecentPicks();
  });
  bidSlider.addEventListener("input", updateAmount);

  // Someone else's pick (another Player Entry session) also affects this
  // team's live budget, so keep the cards in sync via Supabase Realtime.
  DraftStore.onChange(async () => {
    await renderTeamGrid();
    updateBidCap();
  });

  await configReady;
  await ensurePinUnlocked();
  await renderTeamGrid();
  updateBidCap();
  updateAmount();
  updateConfirmState();
  setHandle(0);
})();
