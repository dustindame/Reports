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
  const shotFlash = document.getElementById("shotFlash");
  const niceFlash = document.getElementById("niceFlash");
  const exportBtn = document.getElementById("exportBtn");
  const snapshotBtn = document.getElementById("snapshotBtn");
  const recapLink = document.getElementById("recapLink");

  document.getElementById("fieldIcon").innerHTML = Icons.field(22, "var(--wr)");
  document.getElementById("titleFootballIcon").innerHTML = Icons.football(22, "var(--qb)");
  document.getElementById("goalPostLeft").innerHTML = Icons.goalPost(13, "#f2c14e");
  document.getElementById("goalPostRight").innerHTML = Icons.goalPost(13, "#f2c14e");
  document.getElementById("exportIcon").innerHTML = Icons.download(16);
  document.getElementById("snapshotIcon").innerHTML = Icons.camera(16);
  document.getElementById("recapIcon").innerHTML = Icons.barChart(16);

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

  // Data safety: a one-click JSON export of every pick (works in demo mode
  // too, straight from MOCK_DRAFT) so a commissioner always has a way to
  // get their draft out of the browser, independent of Supabase.
  function csvField(value) {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function exportBackup() {
    exportBtn.disabled = true;
    try {
      const picks = CURRENT_LEAGUE_CODE ? await DraftStore.getPicks() : MOCK_DRAFT.picks;
      const rows = [["Pick #", "Team", "Player", "Position", "Price", "Logged At"]];
      picks.forEach((p, i) => {
        rows.push([
          i + 1,
          (teamById(p.teamId) || {}).name || p.teamId,
          p.name,
          p.position,
          p.price,
          p.loggedAt ? new Date(p.loggedAt).toISOString() : "",
        ]);
      });
      const csv = rows.map((row) => row.map(csvField).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `draft-backup-${CURRENT_LEAGUE_CODE || "demo"}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      exportBtn.disabled = false;
    }
  }

  // A visual snapshot as a second, independent form of backup alongside
  // the JSON export -- captures exactly what's on screen right now.
  async function saveSnapshot() {
    snapshotBtn.disabled = true;
    try {
      const canvas = await html2canvas(boardContent, { backgroundColor: "#08080b" });
      const link = document.createElement("a");
      link.download = `draft-board-${CURRENT_LEAGUE_CODE || "demo"}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      snapshotBtn.disabled = false;
    }
  }

  exportBtn.addEventListener("click", exportBackup);
  snapshotBtn.addEventListener("click", saveSnapshot);

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

  // "Davante Adams" -> "D. Adams" -- full names just ellipsis-truncated
  // to 3-4 characters in a chip this narrow (e.g. "Dav..."), which wasn't
  // readable at all. Initial + last name fits and is still identifiable.
  function shortPlayerName(name) {
    const idx = name.indexOf(" ");
    return idx === -1 ? name : `${name[0]}. ${name.slice(idx + 1)}`;
  }

  function renderRecent() {
    recentStrip.innerHTML = recentPicks(6)
      .map(
        (p) => `<div class="recent-chip">
          <span class="rc-pos-dot" style="background: var(${POSITION_COLOR_VAR[p.position]})"></span>
          <span class="rc-name">${escapeHtml(shortPlayerName(p.name))}</span>
          <span class="rc-price">$${p.price}</span>
        </div>`
      )
      .join("");
  }

  /* ---------------- Ticker (news) + separate message row ----------------
     Two independent tracks/animations so a fan message arriving doesn't
     touch the news ticker's scroll at all. Both rows use the same
     continuous doubled-loop technique -- messages can coexist (spaced
     apart in one rotating line) rather than taking turns one at a time;
     each message has its own loop count (Nice = 1, regular messages = 5
     by default) and drops out of the rotation once it's been shown that
     many times. */
  let tickerHeadlines = FALLBACK_NEWS_TICKER;
  let boardMessages = []; // { id, text, loopsRemaining }
  const MESSAGE_LOOPS = 5;
  const TICKER_PX_PER_SEC = 55;

  function renderNewsTicker() {
    const items = tickerHeadlines.map((t) => `<span class="ticker-item">${t}</span>`);
    tickerTrack.innerHTML = items.concat(items).join("");
    const distance = tickerTrack.scrollWidth / 2;
    tickerTrack.style.animationDuration = `${Math.max(20, distance / TICKER_PX_PER_SEC)}s`;
  }

  // Space for this row stays reserved at all times (see .message-row.empty
  // in the CSS) -- toggling "empty" only changes visibility, never
  // display, so a message appearing/disappearing never changes the
  // board's total height and never has to re-trigger the zoom-to-fit.
  //
  // Uses a true marquee (message-scroll keyframe: enters fully off-screen
  // right, exits fully off-screen left) rather than the news ticker's
  // doubled-content loop, which only looks like it's "entering from the
  // right" when content is much wider than the viewport -- short message
  // content just sat visible at the left edge and repeated in place.
  function renderMessageTicker() {
    const hasActive = boardMessages.length > 0;
    messageRow.classList.toggle("empty", !hasActive);
    if (!hasActive) return;
    const items = boardMessages.map((m) => `<span class="ticker-item fan-message">📣 ${escapeHtml(m.text)}</span>`);
    messageTrack.innerHTML = items.join("");
    const containerWidth = messageRow.clientWidth;
    const trackWidth = messageTrack.scrollWidth;
    const distance = containerWidth + trackWidth;
    messageTrack.style.setProperty("--message-start", `${containerWidth}px`);
    messageTrack.style.setProperty("--message-end", `-${trackWidth}px`);
    const duration = Math.max(4, distance / TICKER_PX_PER_SEC);
    messageTrack.style.animation = "none";
    void messageTrack.offsetWidth; // force reflow so it restarts from the right edge
    messageTrack.style.animation = `message-scroll ${duration}s linear infinite`;
  }

  // A full pass of the (single, non-doubled) track is one "showing" of
  // every active message once -- decrement each message's remaining loop
  // count here and drop any that have been shown enough times, deleting
  // them server-side too so a later page refresh doesn't refetch and
  // replay something that already finished its loops.
  messageTrack.addEventListener("animationiteration", () => {
    if (boardMessages.length === 0) return;
    const before = boardMessages.length;
    const decremented = boardMessages.map((m) => ({ ...m, loopsRemaining: m.loopsRemaining - 1 }));
    decremented.filter((m) => m.loopsRemaining <= 0).forEach((m) => DraftStore.deleteMessage(m.id));
    boardMessages = decremented.filter((m) => m.loopsRemaining > 0);
    if (boardMessages.length !== before) renderMessageTicker();
  });

  function enqueueMessage(message) {
    if (isNiceMessage(message.text)) {
      showNiceFlash();
      return;
    }
    if (boardMessages.some((m) => m.id === message.id)) return; // already active
    boardMessages.push({ ...message, loopsRemaining: message.loops || MESSAGE_LOOPS });
    if (boardMessages.length > 10) boardMessages.shift();
    renderMessageTicker();
  }

  async function refreshTicker() {
    // Odds are interleaved with headlines (not appended as a separate
    // block) so they don't just sit bunched up at one end of the loop.
    const [news, odds] = await Promise.all([fetchNewsHeadlines(), fetchBettingOdds()]);
    const merged = [];
    const maxLen = Math.max(news.length, odds.length);
    for (let i = 0; i < maxLen; i++) {
      if (news[i]) merged.push(news[i]);
      if (odds[i]) merged.push(odds[i]);
    }
    if (merged.length) {
      tickerHeadlines = merged;
      renderNewsTicker();
    }
  }

  async function loadMessages() {
    const loaded = await DraftStore.getMessages(10);
    boardMessages = loaded.filter((m) => !isNiceMessage(m.text)).map((m) => ({ ...m, loopsRemaining: m.loops || MESSAGE_LOOPS }));
    renderMessageTicker();
  }

  /* ---------------- Nice: full-board flash ----------------
     A $69 pick posts this exact text via the ordinary message pipeline,
     but instead of joining the ticker rotation (which, being a single
     brand-new item, awkwardly appeared to start mid-screen instead of
     entering like the continuous news ticker does) it triggers a big
     flash over the whole board for a few seconds. */
  const NICE_TEXT = "Nice! Nice! Nice! Nice! Nice!";
  function isNiceMessage(text) {
    return text === NICE_TEXT;
  }
  let niceFlashTimer = null;
  function showNiceFlash() {
    niceFlash.hidden = false;
    clearTimeout(niceFlashTimer);
    niceFlashTimer = setTimeout(() => { niceFlash.hidden = true; }, 10000);
  }

  /* ---------------- Pick sound ----------------
     A short synthesized chime (Web Audio API -- no audio file to host,
     works offline) that plays whenever a new pick streams in, similar to
     the alert sound ESPN's draft room plays on a selection. Browsers
     block audio from playing before any user interaction with the page,
     so the AudioContext is created lazily and resumed on the first
     tap/click anywhere on the board. */
  let pickAudioCtx = null;
  function getPickAudioCtx() {
    if (!pickAudioCtx) pickAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return pickAudioCtx;
  }
  window.addEventListener(
    "pointerdown",
    () => {
      try {
        getPickAudioCtx().resume();
      } catch (e) {
        /* AudioContext unsupported -- pick sound just won't play */
      }
    },
    { once: true }
  );
  // A short percussive "thock" (a burst of filtered noise, like a mallet
  // hit) followed by a bright three-note ascending chime -- closer to the
  // hit-then-chime shape of ESPN's draft-room selection alert than a
  // plain two-tone beep. Built from an in-memory noise buffer + a few
  // oscillators, so there's still no audio file to host.
  let pickNoiseBuffer = null;
  function getPickNoiseBuffer(ctx) {
    if (pickNoiseBuffer) return pickNoiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    pickNoiseBuffer = buffer;
    return buffer;
  }
  function playPickSound() {
    try {
      const ctx = getPickAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      // The "thock": filtered noise burst + a short low thump underneath.
      const noise = ctx.createBufferSource();
      noise.buffer = getPickNoiseBuffer(ctx);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 1800;
      noiseFilter.Q.value = 0.8;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
      noise.start(now);

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(160, now);
      thump.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      thumpGain.gain.setValueAtTime(0.35, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      thump.connect(thumpGain).connect(ctx.destination);
      thump.start(now);
      thump.stop(now + 0.15);

      // The bright ascending chime, starting just after the hit.
      const chimeStart = now + 0.08;
      [784, 988, 1319].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const start = chimeStart + i * 0.09;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch (e) {
      console.warn("Couldn't play pick sound:", e);
    }
  }

  // Same pre-seed-then-diff pattern as the shot banner below -- picks
  // that already existed when the board loaded shouldn't retroactively
  // play the sound or flash the border, only ones that arrive from here
  // on. Returns the list of newly-seen pick ids so the caller can also
  // trigger the border-trace animation on the right grid cells once
  // they've been re-rendered.
  const announcedPickIds = new Set();
  function collectNewPickIds() {
    const newIds = [];
    MOCK_DRAFT.picks.forEach((p) => {
      if (!announcedPickIds.has(p.id)) {
        announcedPickIds.add(p.id);
        newIds.push(p.id);
      }
    });
    return newIds;
  }

  // Briefly traces a bright border around each newly-filled slot cell so
  // it's obvious at a glance where a pick just landed, not just that the
  // grid changed somewhere. Requires renderGrid() to have already run
  // (so the cells exist) and each filled cell to carry data-pick-id.
  function flashNewPickCells(ids) {
    ids.forEach((id) => {
      const el = grid.querySelector(`[data-pick-id="${id}"]`);
      if (!el) return;
      el.classList.remove("pick-flash");
      void el.offsetWidth; // restart the animation if it's somehow still mid-flash
      el.classList.add("pick-flash");
      setTimeout(() => el.classList.remove("pick-flash"), 1600);
    });
  }

  /* ---------------- Shots: "SHOT! SHOT! SHOT!" flash ----------------
     Same full-board flash treatment as Nice, just red, whenever a pick
     lands on one of the league's randomly-designated shot pick numbers.
     Not part of the message ticker at all -- doesn't touch header layout. */
  const announcedShotPicks = new Set();
  let shotFlashTimer = null;

  function showShotBanner() {
    shotFlash.hidden = false;
    clearTimeout(shotFlashTimer);
    shotFlashTimer = setTimeout(() => {
      shotFlash.hidden = true;
    }, 10000);
  }

  function checkForShotPicks() {
    MOCK_DRAFT.picks.forEach((p) => {
      if (SHOT_PICK_NUMBERS.includes(p.pickNumber) && !announcedShotPicks.has(p.pickNumber)) {
        announcedShotPicks.add(p.pickNumber);
        showShotBanner();
      }
    });
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
          const spaceIdx = pick.name.indexOf(" ");
          const firstName = spaceIdx === -1 ? pick.name : pick.name.slice(0, spaceIdx);
          const lastName = spaceIdx === -1 ? "" : pick.name.slice(spaceIdx + 1);
          cells.push(`<div class="slot-cell filled pos-${pick.position}" data-pick-id="${pick.id}">
            <div class="slot-player-first">${escapeHtml(firstName)}</div>
            <div class="slot-player-last">${escapeHtml(lastName)}</div>
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

    // Board width is header/grid only -- never the ticker, whose
    // concatenated-headline content is deliberately huge so it has
    // something to scroll through. The ticker just fills this width.
    boardContent.style.width = `${Math.max(gridBaseWidth, headerWidth)}px`;
  }

  // Measures the board's natural size and stretches it to exactly fill
  // the screen in both dimensions -- no scrolling, and (per feedback) no
  // letterboxing bars either. A single uniform zoom factor (the min of
  // the two ratios) preserved aspect ratio but left blank bars on
  // whichever axis wasn't the limiting one; scaling width and height
  // independently via transform fills the screen completely instead.
  function fitBoardToScreen() {
    boardContent.style.transform = "none";
    const naturalWidth = boardContent.scrollWidth;
    const naturalHeight = boardContent.scrollHeight;
    const availableWidth = boardScroll.clientWidth;
    const availableHeight = boardScroll.clientHeight;
    // Independent X/Y scale eliminated blank bars entirely, but visibly
    // stretched/squished the font since it distorts the aspect ratio of
    // everything on the board. A single uniform factor keeps text and
    // shapes proportioned correctly -- may leave a thin bar on whichever
    // axis isn't the limiting one, but that's the right tradeoff over
    // distorted text.
    const scale = naturalWidth > 0 && naturalHeight > 0 ? Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight) : 1;
    // Center whatever's left over on the non-limiting axis instead of
    // leaving it pinned to the top-left corner.
    const offsetX = (availableWidth - naturalWidth * scale) / 2;
    const offsetY = (availableHeight - naturalHeight * scale) / 2;
    boardContent.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  await configReady;

  boardNameText.textContent = (BOARD_NAME || "Auction Draft Board").toUpperCase();
  trackerBlock.hidden = !SHOW_DRAFTED_TOTAL;
  recentBlock.hidden = !SHOW_RECENT;
  positionTotalsBlock.hidden = !SHOW_POSITION_TOTALS;
  elapsedBlock.hidden = !SHOW_ELAPSED_TIME;
  newsRow.hidden = !SHOW_NEWS;
  messageRow.hidden = !SHOW_MESSAGES; // fully collapsed when the feature is off; when on, space stays reserved via .empty

  renderQr();
  recapLink.href = `recap.html${CURRENT_LEAGUE_CODE ? `?league=${encodeURIComponent(CURRENT_LEAGUE_CODE)}` : ""}`;
  await applyLivePicks();
  renderTracker();
  renderPositionTotals();
  renderElapsed();
  renderRecent();
  renderNewsTicker();
  renderGrid();
  layoutGrid();
  fitBoardToScreen();

  // Picks that already existed when the board loaded shouldn't retroactively
  // trigger the shot banner or pick sound -- only ones that arrive from here on.
  MOCK_DRAFT.picks.forEach((p) => announcedShotPicks.add(p.pickNumber));
  MOCK_DRAFT.picks.forEach((p) => announcedPickIds.add(p.id));

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
    const newPickIds = collectNewPickIds();
    renderTracker();
    renderPositionTotals();
    renderRecent();
    renderGrid();
    layoutGrid(); // re-measure in case header content width changed (defense in depth)
    fitBoardToScreen();
    if (newPickIds.length) {
      playPickSound();
      flashNewPickCells(newPickIds);
    }
    checkForShotPicks();
  });
})();
