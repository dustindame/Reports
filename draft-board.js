(async function () {
  const grid = document.getElementById("boardGrid");
  const draftedValue = document.getElementById("draftedValue");
  const remainingValue = document.getElementById("remainingValue");
  const progressFill = document.getElementById("progressFill");
  const recentStrip = document.getElementById("recentStrip");
  const qrCode = document.getElementById("qrCode");
  const clockIcon = document.getElementById("clockIcon");
  const clockValue = document.getElementById("clockValue");
  const tickerTrack = document.getElementById("tickerTrack");

  qrCode.innerHTML = Icons.qrCode(96, 42);
  clockIcon.innerHTML = Icons.clock(18, "#d4af37");

  function renderClock() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    clockValue.textContent = `${h}:${m} ${ampm}`;
  }
  renderClock();
  setInterval(renderClock, 1000);

  function renderTracker() {
    const drafted = draftedCount();
    draftedValue.textContent = `${drafted} / ${TOTAL_SLOTS}`;
    remainingValue.textContent = TOTAL_SLOTS - drafted;
    progressFill.style.width = `${(drafted / TOTAL_SLOTS) * 100}%`;
  }

  function renderRecent() {
    recentStrip.innerHTML = recentPicks(5)
      .map((p) => {
        const team = teamById(p.teamId);
        return `<div class="recent-chip">
          <span class="rc-pos-dot" style="background: var(${POSITION_COLOR_VAR[p.position]})"></span>
          <span class="rc-name">${p.name}</span>
          <span class="rc-team">${team.name}</span>
          <span class="rc-price">$${p.price}</span>
        </div>`;
      })
      .join("");
  }

  function renderTicker() {
    const items = NEWS_TICKER.concat(NEWS_TICKER)
      .map((t) => `<span class="ticker-item">${t}</span>`)
      .join("");
    tickerTrack.innerHTML = items;
  }

  function renderGrid() {
    const cells = [];
    cells.push(`<div class="grid-header-cell corner">Team</div>`);
    ROSTER_SLOTS.forEach((slot) => {
      const posClass = POSITION_COLOR_VAR[slot] ? `pos-${slot}` : "";
      cells.push(`<div class="grid-header-cell ${posClass}">${slot}</div>`);
    });

    TEAMS.forEach((team) => {
      const budget = computeTeamBudget(team.id);
      const roster = getTeamRoster(team.id);
      cells.push(`<div class="team-cell">
        <div class="team-name-row"><span class="dot" style="background:${team.color}; color:${team.color}"></span>${team.name}</div>
        <div class="team-budget-row">Max Bid <span class="b-max">$${budget.maxBid}</span> &nbsp;·&nbsp; <span class="b-rem">Remaining $${budget.remaining}</span></div>
      </div>`);

      roster.slots.forEach((pick) => {
        if (!pick) {
          cells.push(`<div class="slot-cell empty"><span class="slot-open">Open</span></div>`);
        } else {
          cells.push(`<div class="slot-cell filled pos-${pick.position}">
            <div class="slot-player">${pick.name}</div>
            <div class="slot-price">$${pick.price}</div>
          </div>`);
        }
      });
    });

    grid.innerHTML = cells.join("");
  }

  await applyLivePicks();
  renderTracker();
  renderRecent();
  renderTicker();
  renderGrid();

  // A pick confirmed on the Player Entry screen streams in here via
  // Supabase Realtime — fold it in and refresh the affected panels.
  DraftStore.onChange(async () => {
    await applyLivePicks();
    renderTracker();
    renderRecent();
    renderGrid();
  });
})();
