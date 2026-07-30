(async function () {
  const teamGrid = document.getElementById("teamGrid");
  const teamPicker = document.getElementById("teamPicker");
  const rosterView = document.getElementById("rosterView");
  const teamBanner = document.getElementById("teamBanner");
  const budgetRow = document.getElementById("budgetRow");
  const rosterList = document.getElementById("rosterList");
  const backBtn = document.getElementById("backBtn");
  const messageFab = document.getElementById("messageFab");
  const recapBanner = document.getElementById("recapBanner");
  const exportDraftBtn = document.getElementById("exportDraftBtn");
  const viewBoardBtn = document.getElementById("viewBoardBtn");

  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);
  document.getElementById("recapBannerIcon").innerHTML = Icons.barChart(16, "#1a1305");
  document.getElementById("exportDraftIcon").innerHTML = Icons.download(20, "#fff");
  document.getElementById("viewBoardIcon").innerHTML = Icons.field(20, "#fff");
  document.getElementById("messageIcon").innerHTML = Icons.megaphone(16, "#fff");

  function updateRecapBanner() {
    recapBanner.hidden = !SHOW_RECAP || draftedCount() < TOTAL_SLOTS;
  }

  /* ---------------- Draft-wide stats (shown on the team-picker screen) ----------------
     Same widgets as the Draft Board header -- total drafted/progress,
     drafted-by-position counts, and the most recent picks -- so anyone
     on Team Picks can see where the draft stands without needing the
     board itself. */
  const picksDraftedValue = document.getElementById("picksDraftedValue");
  const picksRemainingValue = document.getElementById("picksRemainingValue");
  const picksProgressFill = document.getElementById("picksProgressFill");
  const picksPositionTotalsRow = document.getElementById("picksPositionTotalsRow");
  const picksRecentStrip = document.getElementById("picksRecentStrip");

  function renderPicksTracker() {
    const drafted = draftedCount();
    picksDraftedValue.textContent = `${drafted} / ${TOTAL_SLOTS}`;
    picksRemainingValue.textContent = TOTAL_SLOTS - drafted;
    picksProgressFill.style.width = `${(drafted / TOTAL_SLOTS) * 100}%`;
  }

  function renderPicksPositionTotals() {
    const positions = ["QB", "RB", "WR", "TE"];
    if (ROSTER_SLOTS.includes("DEF")) positions.push("DEF");
    if (ROSTER_SLOTS.includes("K")) positions.push("K");
    const counts = {};
    positions.forEach((p) => { counts[p] = 0; });
    MOCK_DRAFT.picks.forEach((p) => {
      if (counts[p.position] !== undefined) counts[p.position] += 1;
    });
    picksPositionTotalsRow.innerHTML = positions
      .map(
        (pos) => `<div class="pt-chip">
          <span class="pt-pos" style="color:var(${POSITION_COLOR_VAR[pos]})">${pos}</span>
          <span class="pt-count">${counts[pos]}</span>
        </div>`
      )
      .join("");
  }

  function shortPlayerName(name) {
    const idx = name.indexOf(" ");
    return idx === -1 ? name : `${name[0]}. ${name.slice(idx + 1)}`;
  }

  function renderPicksRecent() {
    const recent = recentPicks(4);
    picksRecentStrip.innerHTML = recent.length
      ? recent
          .map(
            (p) => `<div class="recent-chip">
              <span class="rc-pos-dot" style="background: var(${POSITION_COLOR_VAR[p.position]})"></span>
              <span class="rc-name">${escapeHtml(shortPlayerName(p.name))}</span>
              <span class="rc-price" style="color: var(${POSITION_COLOR_VAR[p.position]})">$${p.price}</span>
            </div>`
          )
          .join("")
      : `<div class="recent-chip"><span class="rc-name">No picks yet</span></div>`;
  }

  function renderDraftStats() {
    renderPicksTracker();
    renderPicksPositionTotals();
    renderPicksRecent();
  }

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
      <div class="budget-chip max"><div class="bc-label">Max Bid</div><div class="bc-value">$${budget.maxBid}</div></div>
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

  /* ---------------- Export the full draft / view the real board ----------------
     Live on the team-selection screen (next to the message button)
     instead of being buried inside a specific team's roster view, so
     they're reachable the moment someone scans the QR code -- no need
     to pick a team first just to get to them.

     There used to be a "snapshot" button here too, screenshotting
     whatever was on the phone -- but the phone never rendered the
     actual Draft Board, only this Team Picks page, so the screenshot
     was never a picture of "the board" at all, just the team-picker
     grid or a roster list. Draft Board itself already scales to fit any
     screen size (fitBoardToScreen() in draft-board.js), including a
     phone's, and already has its own working Snapshot button that
     captures the real board -- so instead of faking it here, this just
     links straight there. */
  function csvField(value) {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportDraft() {
    const rows = [["Pick #", "Team", "Player", "Position", "Price"]];
    MOCK_DRAFT.picks
      .slice()
      .sort((a, b) => a.pickNumber - b.pickNumber)
      .forEach((p) => {
        const team = teamById(p.teamId);
        rows.push([p.pickNumber, team ? team.name : p.teamId, p.name, p.position, p.price]);
      });
    const csv = rows.map((row) => row.map(csvField).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `draft-picks-${CURRENT_LEAGUE_CODE || "demo"}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- Pro upsell (CSV export, Recap) ---------------- */
  const proUpsellOverlay = document.getElementById("proUpsellOverlay");
  const proUpsellTitle = document.getElementById("proUpsellTitle");
  const proUpsellHint = document.getElementById("proUpsellHint");
  const proUpsellClose = document.getElementById("proUpsellClose");
  proUpsellClose.addEventListener("click", () => { proUpsellOverlay.hidden = true; });
  function showProUpsell(title, hint) {
    proUpsellTitle.textContent = title;
    proUpsellHint.textContent = hint;
    proUpsellOverlay.hidden = false;
  }

  exportDraftBtn.addEventListener("click", () => {
    if (!ProGate.isPro()) {
      showProUpsell("CSV Export is Pro", "Upgrade to Pro to export the full draft as a CSV file.");
      return;
    }
    exportDraft();
  });

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
          <input type="text" class="league-gate-input free-text" id="boardMessageInput" maxlength="100" placeholder="Say something..." autocomplete="off" />
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
  recapBanner.href = `recap.html${CURRENT_LEAGUE_CODE ? `?league=${encodeURIComponent(CURRENT_LEAGUE_CODE)}` : ""}`;
  recapBanner.addEventListener("click", (e) => {
    if (ProGate.isPro()) return;
    e.preventDefault();
    showProUpsell("Recap is Pro", "Upgrade to Pro to unlock the full post-draft Recap page.");
  });
  viewBoardBtn.href = `draft-board.html${CURRENT_LEAGUE_CODE ? `?league=${encodeURIComponent(CURRENT_LEAGUE_CODE)}` : ""}`;
  await applyLivePicks();
  updateRecapBanner();
  renderDraftStats();
  DraftStore.onChange(async () => {
    await applyLivePicks();
    updateRecapBanner();
    renderDraftStats();
    if (!rosterView.hidden && currentTeamId) showRoster(currentTeamId);
  });

  renderTeamGrid();

  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("team");
  if (preselect && teamById(preselect)) showRoster(preselect);
})();
