(async function () {
  const boardScroll = document.getElementById("boardScroll");
  const boardContent = document.getElementById("boardContent");
  const boardHeader = document.getElementById("boardHeader");
  const grid = document.getElementById("boardGrid");
  const boardNameText = document.getElementById("boardNameText");
  const trackerBlock = document.getElementById("trackerBlock");
  const draftedValue = document.getElementById("draftedValue");
  const remainingValue = document.getElementById("remainingValue");
  const progressFill = document.getElementById("progressFill");
  const positionTotalsBlock = document.getElementById("positionTotalsBlock");
  const positionTotalsRow = document.getElementById("positionTotalsRow");
  const elapsedBlock = document.getElementById("elapsedBlock");
  const elapsedValue = document.getElementById("elapsedValue");
  const recentBlock = document.getElementById("recentBlock");
  const recentStrip = document.getElementById("recentStrip");
  const qrCode = document.getElementById("qrCode");
  const clockValue = document.getElementById("clockValue");
  const newsRow = document.getElementById("newsRow");
  const messageRow = document.getElementById("messageRow");
  const tickerTrack = document.getElementById("tickerTrack");
  const messageTrack = document.getElementById("messageTrack");

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

  function renderPositionTotals() {
    const hasDef = ROSTER_SLOTS.includes("DEF");
    const positions = hasDef ? ["QB", "RB", "WR", "TE", "DEF"] : ["QB", "RB", "WR", "TE"];
    const counts = {};
    positions.forEach((p) => { counts[p] = 0; });
    MOCK_DRAFT.picks.forEach((p) => {
      if (counts[p.position] !== undefined) counts[p.position] += 1;
    });
    positionTotalsRow.innerHTML = positions
      .map(
        (pos) => `<div class="pt-chip">
          <span class="pt-pos" style="color:var(${POSITION_COLOR_VAR[pos]})">${pos}</span>
          <span class="pt-count">${counts[pos]}</span>
        </div>`
      )
      .join("");
  }

  // Elapsed time since the first pick -- in demo mode (no real timestamps)
  // falls back to when this page was opened, just so the widget has
  // something sensible to show.
  const pageLoadTime = Date.now();
  function draftStartTime() {
    const timestamps = MOCK_DRAFT.picks.map((p) => p.loggedAt).filter(Boolean);
    return timestamps.length ? Math.min(...timestamps) : pageLoadTime;
  }
  function renderElapsed() {
    const elapsedMs = Date.now() - draftStartTime();
    const totalMin = Math.max(0, Math.floor(elapsedMs / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    elapsedValue.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function renderRecent() {
    recentStrip.innerHTML = recentPicks(9)
      .map(
        (p) => `<div class="recent-chip">
          <span class="rc-pos-dot" style="background: var(${POSITION_COLOR_VAR[p.position]})"></span>
          <span class="rc-name">${escapeHtml(p.name)}</span>
          <span class="rc-price">$${p.price}</span>
        </div>`
      )
      .join("");
  }

  /* ---------------- Ticker (news) + separate message row ----------------
     Two independent tracks/animations so a fan message arriving doesn't
     touch the news ticker's scroll at all (previously merging them into
     one track made the news scroll visibly jump/speed up whenever a
     message came in). Messages show above the news, at the same speed,
     for a fixed number of loops, then disappear entirely. */
  let tickerHeadlines = FALLBACK_NEWS_TICKER;
  let boardMessages = []; // queue: { id, text, loopsRemaining }
  const MESSAGE_LOOPS = 5;
  const TICKER_PX_PER_SEC = 55;

  function renderNewsTicker() {
    const items = tickerHeadlines.map((t) => `<span class="ticker-item">${t}</span>`);
    tickerTrack.innerHTML = items.concat(items).join("");
    const distance = tickerTrack.scrollWidth / 2;
    tickerTrack.style.animationDuration = `${Math.max(20, distance / TICKER_PX_PER_SEC)}s`;
  }

  // Messages play one at a time as a single clean pass -- entering fully
  // off-screen right, crossing at the same px/sec as the news ticker, and
  // exiting fully off-screen left -- instead of the news ticker's doubled-
  // track technique (which is only right for a continuous, never-ending
  // rotation; for one finite, short message it visibly showed the same
  // text twice back-to-back, and the fixed 20s floor made short text
  // crawl far slower than its actual length warranted).
  function playMessagePass() {
    if (boardMessages.length === 0 || !SHOW_MESSAGES) {
      messageRow.hidden = true;
      return;
    }
    messageRow.hidden = false;
    const current = boardMessages[0];
    messageTrack.innerHTML = `<span class="ticker-item fan-message">📣 ${escapeHtml(current.text)}</span>`;
    const containerWidth = messageRow.clientWidth;
    const trackWidth = messageTrack.scrollWidth;
    const distance = containerWidth + trackWidth; // fully off-right to fully off-left
    messageTrack.style.setProperty("--message-start", `${containerWidth}px`);
    messageTrack.style.setProperty("--message-end", `-${trackWidth}px`);
    messageTrack.style.animation = "none";
    void messageTrack.offsetWidth; // force reflow so the restart takes effect
    messageTrack.style.animation = `message-scroll ${Math.max(3, distance / TICKER_PX_PER_SEC)}s linear 1`;
  }

  messageTrack.addEventListener("animationend", () => {
    if (boardMessages.length === 0) return;
    boardMessages[0].loopsRemaining -= 1;
    if (boardMessages[0].loopsRemaining <= 0) boardMessages.shift();
    if (boardMessages.length > 0) {
      playMessagePass();
    } else {
      messageRow.hidden = true;
      fitBoardToScreen();
    }
  });

  function enqueueMessage(message) {
    if (boardMessages.some((m) => m.id === message.id)) return; // already queued/playing
    const wasIdle = boardMessages.length === 0;
    boardMessages.push({ ...message, loopsRemaining: MESSAGE_LOOPS });
    if (boardMessages.length > 10) boardMessages.length = 10;
    if (wasIdle) {
      playMessagePass(); // unhides the message row
      fitBoardToScreen(); // ...so re-measure now that it's taking up space
    }
  }

  async function refreshTicker() {
    const live = await fetchNewsHeadlines();
    if (live.length) {
      tickerHeadlines = live;
      renderNewsTicker();
    }
  }

  async function loadMessages() {
    const loaded = await DraftStore.getMessages(10);
    boardMessages = loaded.map((m) => ({ ...m, loopsRemaining: MESSAGE_LOOPS }));
    if (boardMessages.length > 0) playMessagePass();
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
        <div class="team-name-row">
          <span class="dot" style="background:${team.color}; color:${team.color}"></span>
          <span class="team-name-text">${escapeHtml(team.name)}</span>
        </div>
      </div>`);
      cells.push(`<div class="budget-cell max-bid"><span class="bc-value">$${budget.maxBid}</span></div>`);
      cells.push(`<div class="budget-cell remaining${tightClass}"><span class="bc-value">$${budget.remaining}</span></div>`);

      roster.slots.forEach((pick) => {
        if (!pick) {
          cells.push(`<div class="slot-cell empty"><span class="slot-open">Open</span></div>`);
        } else {
          cells.push(`<div class="slot-cell filled pos-${pick.position}">
            <div class="slot-player">${escapeHtml(pick.name)}</div>
            <div class="slot-price">$${pick.price}</div>
          </div>`);
        }
      });
    });

    grid.innerHTML = cells.join("");
  }

  // Sizes the grid's columns so the grid's total width always matches
  // whichever of the grid or the header actually needs more room. Without
  // this, when several optional header widgets are on, the header could
  // come out wider than the grid's base column sizes -- board-content
  // then sized itself to that wider header, but the grid (fixed px
  // columns) didn't stretch to fill it, leaving a big empty gap and
  // making the grid look tiny next to a much wider header/footer.
  function layoutGrid() {
    const rootStyle = getComputedStyle(document.documentElement);
    const teamColBase = parseFloat(rootStyle.getPropertyValue("--team-col")) || 230;
    const budgetColBase = parseFloat(rootStyle.getPropertyValue("--budget-col")) || 140;
    const slotColBase = parseFloat(rootStyle.getPropertyValue("--slot-col")) || 110;
    const numSlots = ROSTER_SLOTS.length;

    grid.style.gridTemplateColumns = `${teamColBase}px ${budgetColBase}px ${budgetColBase}px repeat(${numSlots}, ${slotColBase}px)`;
    const gridBaseWidth = teamColBase + budgetColBase * 2 + numSlots * slotColBase;

    const headerWidth = boardHeader.scrollWidth;
    const scale = Math.max(1, headerWidth / gridBaseWidth);

    const teamColPx = teamColBase * scale;
    const budgetColPx = budgetColBase * scale;
    const slotColPx = slotColBase * scale;
    grid.style.gridTemplateColumns = `${teamColPx}px ${budgetColPx}px ${budgetColPx}px repeat(${numSlots}, ${slotColPx}px)`;
  }

  // Measures the board's natural (unzoomed) size and scales the whole
  // thing down (or up) with a single zoom factor so it always fits the
  // screen exactly -- no horizontal or vertical scrolling, ever.
  function fitBoardToScreen() {
    boardContent.style.zoom = 1;
    const naturalWidth = boardContent.scrollWidth;
    const naturalHeight = boardContent.scrollHeight;
    const availableWidth = boardScroll.clientWidth;
    const availableHeight = boardScroll.clientHeight;
    const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
    boardContent.style.zoom = scale > 0 ? scale : 1;
  }

  await configReady;

  boardNameText.textContent = (BOARD_NAME || "Auction Draft Board").toUpperCase();
  trackerBlock.hidden = !SHOW_DRAFTED_TOTAL;
  recentBlock.hidden = !SHOW_RECENT;
  positionTotalsBlock.hidden = !SHOW_POSITION_TOTALS;
  elapsedBlock.hidden = !SHOW_ELAPSED_TIME;
  newsRow.hidden = !SHOW_NEWS;

  renderQr();
  await applyLivePicks();
  renderTracker();
  renderPositionTotals();
  renderElapsed();
  renderRecent();
  renderNewsTicker();
  renderGrid();
  layoutGrid();
  fitBoardToScreen();

  window.addEventListener("resize", fitBoardToScreen);
  setInterval(renderElapsed, 30000);

  if (SHOW_NEWS) {
    // Fetch real NFL headlines in the background (don't block first paint
    // -- the fallback list above renders immediately) and keep them fresh.
    refreshTicker();
    setInterval(refreshTicker, 10 * 60 * 1000);
  }

  if (SHOW_MESSAGES) {
    // Fan messages posted from Team Picks (e.g. after scanning the QR
    // code) stream in here, shown above the news ticker.
    await loadMessages();
    fitBoardToScreen();
    DraftStore.onMessage(enqueueMessage);
  }

  // A pick confirmed on the Player Entry screen streams in here via
  // Supabase Realtime — fold it in and refresh the affected panels.
  DraftStore.onChange(async () => {
    await applyLivePicks();
    renderTracker();
    renderPositionTotals();
    renderRecent();
    renderGrid();
    fitBoardToScreen();
  });
})();
