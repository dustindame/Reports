(async function () {
  const boardContent = document.getElementById("boardContent");
  const grid = document.getElementById("boardGrid");
  const draftedValue = document.getElementById("draftedValue");
  const remainingValue = document.getElementById("remainingValue");
  const progressFill = document.getElementById("progressFill");
  const recentStrip = document.getElementById("recentStrip");
  const qrCode = document.getElementById("qrCode");
  const clockIcon = document.getElementById("clockIcon");
  const clockValue = document.getElementById("clockValue");
  const tickerTrack = document.getElementById("tickerTrack");

  document.getElementById("setupGear").innerHTML = Icons.whistle(18);
  clockIcon.innerHTML = Icons.clock(18, "#d4af37");

  // Real scannable QR (not the earlier decorative placeholder) now that the
  // app has a stable hosted URL — points at Team Picks, with the current
  // league code baked in (once configReady has resolved) so scanning it
  // lands straight in the right league with zero typing.
  function renderQr() {
    const suffix = CURRENT_LEAGUE_CODE ? `?league=${encodeURIComponent(CURRENT_LEAGUE_CODE)}` : "";
    const teamPicksUrl = new URL(`team-picks.html${suffix}`, window.location.href).href;
    const qr = qrcode(0, "M");
    qr.addData(teamPicksUrl);
    qr.make();
    qrCode.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
  }

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

  let tickerHeadlines = FALLBACK_NEWS_TICKER;

  function renderTicker() {
    const items = tickerHeadlines
      .concat(tickerHeadlines)
      .map((t) => `<span class="ticker-item">${t}</span>`)
      .join("");
    tickerTrack.innerHTML = items;
  }

  async function refreshTicker() {
    const live = await fetchNewsHeadlines();
    if (live.length) {
      tickerHeadlines = live;
      renderTicker();
    }
  }

  function renderGrid() {
    const cells = [];
    cells.push(`<div class="grid-header-cell corner">Team</div>`);
    cells.push(`<div class="grid-header-cell">Max Bid</div>`);
    cells.push(`<div class="grid-header-cell">Remaining</div>`);
    ROSTER_SLOTS.forEach((slot) => {
      const posClass = POSITION_COLOR_VAR[slot] ? `pos-${slot}` : "";
      cells.push(`<div class="grid-header-cell ${posClass}">${slot}</div>`);
    });

    TEAMS.forEach((team) => {
      const budget = computeTeamBudget(team.id);
      const roster = getTeamRoster(team.id);
      const tightClass = budget.open > 0 && budget.maxBid <= 1 ? " tight" : "";
      cells.push(`<div class="team-cell">
        <div class="team-name-row"><span class="dot" style="background:${team.color}; color:${team.color}"></span>${team.name}</div>
      </div>`);
      cells.push(`<div class="budget-cell max-bid"><span class="bc-label">Max Bid</span><span class="bc-value">$${budget.maxBid}</span></div>`);
      cells.push(`<div class="budget-cell remaining${tightClass}"><span class="bc-label">Remaining</span><span class="bc-value">$${budget.remaining}</span></div>`);

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

  function fitGridToRosterSize() {
    const rootStyle = getComputedStyle(document.documentElement);
    const teamColPx = parseFloat(rootStyle.getPropertyValue("--team-col")) || 260;
    const budgetColPx = parseFloat(rootStyle.getPropertyValue("--budget-col")) || 160;
    const slotColPx = parseFloat(rootStyle.getPropertyValue("--slot-col")) || 146;
    grid.style.gridTemplateColumns = `var(--team-col) var(--budget-col) var(--budget-col) repeat(${ROSTER_SLOTS.length}, var(--slot-col))`;
    boardContent.style.setProperty("--board-width", `${teamColPx + budgetColPx * 2 + ROSTER_SLOTS.length * slotColPx}px`);
  }

  await configReady;
  renderQr();
  fitGridToRosterSize();
  await applyLivePicks();
  renderTracker();
  renderRecent();
  renderTicker();
  renderGrid();

  // Fetch real NFL headlines in the background (don't block first paint —
  // the fallback list above renders immediately) and keep them fresh.
  refreshTicker();
  setInterval(refreshTicker, 10 * 60 * 1000);

  // A pick confirmed on the Player Entry screen streams in here via
  // Supabase Realtime — fold it in and refresh the affected panels.
  DraftStore.onChange(async () => {
    await applyLivePicks();
    renderTracker();
    renderRecent();
    renderGrid();
  });
})();
