(async function () {
  const boardScroll = document.getElementById("boardScroll");
  const boardContent = document.getElementById("boardContent");
  const boardHeader = document.getElementById("boardHeader");
  const grid = document.getElementById("boardGrid");
  const draftedValue = document.getElementById("draftedValue");
  const remainingValue = document.getElementById("remainingValue");
  const progressFill = document.getElementById("progressFill");
  const recentStrip = document.getElementById("recentStrip");
  const qrCode = document.getElementById("qrCode");
  const clockValue = document.getElementById("clockValue");
  const tickerTrack = document.getElementById("tickerTrack");

  document.getElementById("setupGear").innerHTML = Icons.whistle(18);
  document.getElementById("fieldIcon").innerHTML = Icons.field(22, "var(--wr)");
  document.getElementById("titleFootballIcon").innerHTML = Icons.football(22, "var(--qb)");
  document.getElementById("goalPostLeft").innerHTML = Icons.goalPost(20, "#f2c14e");
  document.getElementById("goalPostRight").innerHTML = Icons.goalPost(20, "#f2c14e");

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
    recentStrip.innerHTML = recentPicks(9)
      .map(
        (p) => `<div class="recent-chip">
          <span class="rc-pos-dot" style="background: var(${POSITION_COLOR_VAR[p.position]})"></span>
          <span class="rc-name">${p.name}</span>
          <span class="rc-price">$${p.price}</span>
        </div>`
      )
      .join("");
  }

  let tickerHeadlines = FALLBACK_NEWS_TICKER;
  let boardMessages = []; // { id, text, loopsRemaining }
  const MESSAGE_LOOPS = 5;

  // Fixed-duration scroll made the crawl speed up as more real headlines
  // loaded in (same 60s to cover a longer track = faster). Pin the actual
  // px/sec instead so it reads at a steady, comfortable pace regardless of
  // how many headlines are in rotation.
  const TICKER_PX_PER_SEC = 55;

  function renderTicker() {
    // Fan messages are untrusted user input (posted from Team Picks), so
    // they must be escaped -- headlines are already escaped where they're
    // fetched, and the fallback list is static/trusted. Messages go first
    // so they take priority over headlines instead of getting buried.
    const messageItems = boardMessages.map((m) => `<span class="ticker-item fan-message">📣 ${escapeHtml(m.text)}</span>`);
    const headlineItems = tickerHeadlines.map((t) => `<span class="ticker-item">${t}</span>`);
    const single = messageItems.concat(headlineItems);
    tickerTrack.innerHTML = single.concat(single).join("");
    const distance = tickerTrack.scrollWidth / 2;
    const duration = Math.max(20, distance / TICKER_PX_PER_SEC);
    tickerTrack.style.animationDuration = `${duration}s`;
  }

  // Forces the scroll back to the very start so a newly-arrived message
  // (now at the front of the track) is visible right away, instead of
  // waiting up to a full loop for the current scroll position to catch up.
  function restartTicker() {
    renderTicker();
    tickerTrack.style.animation = "none";
    void tickerTrack.offsetWidth; // force reflow so the restart takes effect
    tickerTrack.style.animation = "";
  }

  // A full pass of the (single, non-doubled) track is one "showing" of
  // every message once -- decrement each message's remaining loop count
  // here and drop any that have been shown enough times.
  tickerTrack.addEventListener("animationiteration", () => {
    if (boardMessages.length === 0) return;
    const before = boardMessages.length;
    boardMessages = boardMessages
      .map((m) => ({ ...m, loopsRemaining: m.loopsRemaining - 1 }))
      .filter((m) => m.loopsRemaining > 0);
    if (boardMessages.length !== before) renderTicker();
  });

  async function refreshTicker() {
    const live = await fetchNewsHeadlines();
    if (live.length) {
      tickerHeadlines = live;
      renderTicker();
    }
  }

  async function loadMessages() {
    const loaded = await DraftStore.getMessages(10);
    boardMessages = loaded.map((m) => ({ ...m, loopsRemaining: MESSAGE_LOOPS }));
    renderTicker();
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
      cells.push(`<div class="budget-cell max-bid"><span class="bc-value">$${budget.maxBid}</span></div>`);
      cells.push(`<div class="budget-cell remaining${tightClass}"><span class="bc-value">$${budget.remaining}</span></div>`);

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

  // Scales the team/budget/slot columns up together to exactly fill the
  // available screen width, so the whole board (every position column)
  // is visible at once without zooming out or scrolling sideways. Only
  // falls back to the CSS minimums -- with horizontal scroll -- if the
  // roster is too wide to fit even at minimum readable size.
  function fitGridToRosterSize() {
    const rootStyle = getComputedStyle(document.documentElement);
    const teamColMin = parseFloat(rootStyle.getPropertyValue("--team-col-min")) || 210;
    const budgetColMin = parseFloat(rootStyle.getPropertyValue("--budget-col-min")) || 130;
    const slotColMin = parseFloat(rootStyle.getPropertyValue("--slot-col-min")) || 100;
    const numSlots = ROSTER_SLOTS.length;

    const minTotal = teamColMin + budgetColMin * 2 + numSlots * slotColMin;
    const availableWidth = boardScroll.clientWidth;
    const scale = Math.max(1, availableWidth / minTotal);

    const teamColPx = Math.round(teamColMin * scale);
    const budgetColPx = Math.round(budgetColMin * scale);
    const slotColPx = Math.round(slotColMin * scale);
    const gridWidth = teamColPx + budgetColPx * 2 + numSlots * slotColPx;

    // The header (title, tracker, recent picks, clock, QR, setup) has its
    // own independent minimum width -- make sure the board is at least
    // that wide too, or the header would need its own horizontal scroll
    // to see fully even when the grid itself fits fine (this was
    // happening with a small roster on a normal-size window).
    const boardWidth = Math.max(gridWidth, boardHeader.scrollWidth, availableWidth);

    grid.style.gridTemplateColumns = `${teamColPx}px ${budgetColPx}px ${budgetColPx}px repeat(${numSlots}, ${slotColPx}px)`;
    boardContent.style.setProperty("--board-width", `${boardWidth}px`);
  }

  await configReady;
  renderQr();
  await applyLivePicks();
  renderTracker();
  renderRecent();
  renderTicker();
  renderGrid();
  fitGridToRosterSize();

  window.addEventListener("resize", fitGridToRosterSize);

  // Fetch real NFL headlines in the background (don't block first paint —
  // the fallback list above renders immediately) and keep them fresh.
  refreshTicker();
  setInterval(refreshTicker, 10 * 60 * 1000);

  // Fan messages posted from Team Picks (e.g. after scanning the QR code)
  // stream in here too, highlighted differently in the ticker.
  await loadMessages();
  DraftStore.onMessage((message) => {
    boardMessages = [{ ...message, loopsRemaining: MESSAGE_LOOPS }, ...boardMessages].slice(0, 10);
    restartTicker();
  });

  // A pick confirmed on the Player Entry screen streams in here via
  // Supabase Realtime — fold it in and refresh the affected panels.
  DraftStore.onChange(async () => {
    await applyLivePicks();
    renderTracker();
    renderRecent();
    renderGrid();
  });
})();
