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
  const pollVoteSection = document.getElementById("pollVoteSection");
  const pollVoteQuestion = document.getElementById("pollVoteQuestion");
  const pollVoteOptions = document.getElementById("pollVoteOptions");
  const pollVoteResults = document.getElementById("pollVoteResults");

  document.getElementById("headerFootball").innerHTML = Icons.helmet(24);
  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);
  document.getElementById("pylonLeft").innerHTML = Icons.pylon(18);
  document.getElementById("pylonRight").innerHTML = Icons.pylon(18);
  document.getElementById("recapBannerIcon").innerHTML = Icons.barChart(16, "#1a1305");
  document.getElementById("exportDraftIcon").innerHTML = Icons.download(20);
  document.getElementById("viewBoardIcon").innerHTML = Icons.field(20, "#1a1305");

  function updateRecapBanner() {
    recapBanner.hidden = draftedCount() < TOTAL_SLOTS;
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

  exportDraftBtn.addEventListener("click", exportDraft);

  /* ---------------- Poll voting (break mode) ----------------
     Shown at the very top of the page, above even the team picker, so
     it takes priority whenever the league's on break. Voting is
     anonymous (one vote per device, via LeagueSession.getVoterToken())
     and changeable -- tapping a different option just resubmits. */
  function renderPollResults(poll, votes) {
    const myToken = LeagueSession.getVoterToken();
    const myVote = votes.find((v) => v.voterToken === myToken);
    const counts = poll.options.map((_, i) => votes.filter((v) => v.optionIndex === i).length);
    const total = votes.length;
    const maxCount = Math.max(...counts, 1);
    pollVoteResults.innerHTML = poll.options
      .map((opt, i) => {
        const mine = myVote && myVote.optionIndex === i;
        return `<div class="poll-vote-result-row${mine ? " mine" : ""}">
          <span class="pvr-label">${escapeHtml(opt)}${mine ? " (you)" : ""}</span>
          <span class="pvr-track"><span class="pvr-fill" style="width:${((counts[i] / maxCount) * 100).toFixed(1)}%"></span></span>
          <span class="pvr-count">${counts[i]}${total ? ` · ${Math.round((counts[i] / total) * 100)}%` : ""}</span>
        </div>`;
      })
      .join("");
    pollVoteOptions.hidden = true;
    pollVoteResults.hidden = false;
  }

  function renderPollOptions(poll) {
    pollVoteOptions.innerHTML = poll.options
      .map((opt, i) => `<button class="poll-vote-option-btn" data-idx="${i}">${escapeHtml(opt)}</button>`)
      .join("");
    pollVoteOptions.querySelectorAll(".poll-vote-option-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const { error } = await DraftStore.submitPollVote(poll.id, Number(btn.dataset.idx));
        if (error) {
          btn.disabled = false;
          return;
        }
        await refreshPoll();
      });
    });
    pollVoteResults.hidden = true;
    pollVoteOptions.hidden = false;
  }

  async function refreshPoll() {
    if (!ON_BREAK) {
      pollVoteSection.hidden = true;
      return;
    }
    const poll = await DraftStore.getActivePoll();
    if (!poll) {
      pollVoteSection.hidden = true;
      return;
    }
    pollVoteSection.hidden = false;
    pollVoteQuestion.textContent = poll.question;
    const votes = await DraftStore.getPollVotes(poll.id);
    const myToken = LeagueSession.getVoterToken();
    if (votes.some((v) => v.voterToken === myToken)) {
      renderPollResults(poll, votes);
    } else {
      renderPollOptions(poll);
    }
  }

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
  viewBoardBtn.href = `draft-board.html${CURRENT_LEAGUE_CODE ? `?league=${encodeURIComponent(CURRENT_LEAGUE_CODE)}` : ""}`;
  await applyLivePicks();
  updateRecapBanner();
  DraftStore.onChange(async () => {
    await applyLivePicks();
    updateRecapBanner();
    if (!rosterView.hidden && currentTeamId) showRoster(currentTeamId);
  });

  if (CURRENT_LEAGUE_CODE) {
    await refreshPoll();
    DraftStore.onConfigChange((newConfig) => {
      const nowOnBreak = Boolean(newConfig.on_break);
      if (nowOnBreak === ON_BREAK) return;
      ON_BREAK = nowOnBreak;
      refreshPoll();
    });
    DraftStore.onPollChange(refreshPoll);
  }

  renderTeamGrid();

  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("team");
  if (preselect && teamById(preselect)) showRoster(preselect);
})();
