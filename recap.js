(async function () {
  await configReady;

  document.getElementById("backIcon").innerHTML = Icons.chevronLeft(16);
  document.getElementById("fieldIcon").innerHTML = Icons.field(22, "var(--wr)");
  document.getElementById("footballIcon").innerHTML = Icons.football(22, "var(--qb)");
  document.getElementById("recapBoardName").textContent = BOARD_NAME || "Auction Draft Board";

  const POS_KEYS = ["QB", "RB", "WR", "TE", "DEF"];

  function playerRank(name) {
    const topIdx = TOP_VALUE_ORDER.indexOf(name);
    if (topIdx !== -1) return topIdx;
    const rookieIdx = ROOKIE_ORDER.indexOf(name);
    if (rookieIdx !== -1) return TOP_VALUE_ORDER.length + rookieIdx;
    return TOP_VALUE_ORDER.length + ROOKIE_ORDER.length + 500;
  }
  function isRookie(name) {
    return ROOKIE_ORDER.includes(name);
  }
  // Picks come back in draft order already (getPicks() orders by
  // created_at ascending; the demo's buildMockDraft() picks are already
  // sorted by pickNumber) -- that order doubles as the pick sequence used
  // for the trend chart.
  const picks = CURRENT_LEAGUE_CODE ? await DraftStore.getPicks() : MOCK_DRAFT.picks;

  /* ---------------- Per-team aggregation ---------------- */
  const teamStats = TEAMS.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    picks: [],
    spend: 0,
    rookieCount: 0,
    positionSpend: {},
  }));
  const teamStatById = new Map(teamStats.map((t) => [t.id, t]));

  picks.forEach((p, idx) => {
    const t = teamStatById.get(p.teamId);
    if (!t) return;
    t.picks.push({ ...p, seq: idx + 1 });
    t.spend += p.price;
    t.positionSpend[p.position] = (t.positionSpend[p.position] || 0) + p.price;
    if (isRookie(p.name)) t.rookieCount += 1;
  });

  /* ---------------- Stat tiles ---------------- */
  function renderStatTiles() {
    const container = document.getElementById("statTiles");
    if (picks.length === 0) {
      container.innerHTML = `<div class="stat-tile"><div class="stat-label">Picks Made</div><div class="stat-value">0</div><div class="stat-sub">No picks yet -- check back once the draft gets going.</div></div>`;
      return;
    }
    const totalSpend = picks.reduce((s, p) => s + p.price, 0);
    const avgPrice = totalSpend / picks.length;
    const highest = picks.reduce((max, p) => (p.price > max.price ? p : max), picks[0]);
    const highestTeam = teamById(highest.teamId);
    const mostRookiesTeam = teamStats.reduce((max, t) => (t.rookieCount > max.rookieCount ? t : max), teamStats[0]);

    const tiles = [
      { label: "Picks Made", value: picks.length, sub: `${TEAMS.length} teams` },
      { label: "Total Spent", value: `$${totalSpend}`, sub: `across the whole draft` },
      { label: "Avg. Price", value: `$${avgPrice.toFixed(1)}`, sub: "per pick" },
      { label: "Top Bid", value: `$${highest.price}`, sub: `${highest.name}${highestTeam ? ` · ${highestTeam.name}` : ""}` },
      { label: "Most Rookies", value: mostRookiesTeam.rookieCount, sub: mostRookiesTeam.name },
    ];
    container.innerHTML = tiles
      .map((t) => `<div class="stat-tile"><div class="stat-label">${escapeHtml(t.label)}</div><div class="stat-value">${t.value}</div><div class="stat-sub">${escapeHtml(t.sub)}</div></div>`)
      .join("");
  }

  /* ---------------- Average price by position ---------------- */
  function renderAvgPrice() {
    const el = document.getElementById("chartAvgPrice");
    const present = POS_KEYS.filter((pos) => picks.some((p) => p.position === pos));
    if (present.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const rows = present
      .map((pos) => {
        const posPicks = picks.filter((p) => p.position === pos);
        const avg = posPicks.reduce((s, p) => s + p.price, 0) / posPicks.length;
        return { pos, avg };
      })
      .sort((a, b) => b.avg - a.avg);
    const maxAvg = Math.max(...rows.map((r) => r.avg), 1);
    el.innerHTML = rows
      .map(
        (r) => `<div class="bar-row">
          <span class="bar-label">${r.pos}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${((r.avg / maxAvg) * 100).toFixed(1)}%; background:var(${POSITION_COLOR_VAR[r.pos]})"></span></span>
          <span class="bar-value">$${r.avg.toFixed(0)}</span>
        </div>`
      )
      .join("");
  }

  /* ---------------- Position mix by team (stacked, by $ spent) ---------------- */
  function renderPositionMix() {
    const el = document.getElementById("chartPositionMix");
    if (picks.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    el.innerHTML = teamStats
      .map((t) => {
        const total = Object.values(t.positionSpend).reduce((s, v) => s + v, 0);
        if (total === 0) {
          return `<div class="mix-row"><span class="mix-label">${escapeHtml(t.name)}</span><span class="mix-track"></span></div>`;
        }
        const segs = POS_KEYS.filter((pos) => t.positionSpend[pos])
          .map((pos) => {
            const pct = (t.positionSpend[pos] / total) * 100;
            const label = pct >= 8 ? `<span class="mix-seg-label">${pos} ${pct.toFixed(0)}%</span>` : "";
            return `<span class="mix-seg" style="width:${pct.toFixed(1)}%; background:var(${POSITION_COLOR_VAR[pos]})" title="${pos}: $${t.positionSpend[pos]} (${pct.toFixed(0)}%)">${label}</span>`;
          })
          .join("");
        return `<div class="mix-row"><span class="mix-label">${escapeHtml(t.name)}</span><span class="mix-track">${segs}</span></div>`;
      })
      .join("");

    const legendPresent = POS_KEYS.filter((pos) => picks.some((p) => p.position === pos));
    document.getElementById("mixLegend").innerHTML = legendPresent
      .map((pos) => `<span class="legend-item"><span class="legend-dot" style="background:var(${POSITION_COLOR_VAR[pos]})"></span>${pos}</span>`)
      .join("");
  }

  /* ---------------- Price trend through the draft (SVG) ----------------
     One line per position (not one combined line across everyone) so you
     can see e.g. whether RB prices climbed while WR stayed flat, instead
     of a single zig-zag that mixes every position together. */
  function renderTrend() {
    const wrap = document.getElementById("chartTrend");
    if (picks.length === 0) {
      wrap.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const height = 220;
    const width = Math.max(320, wrap.clientWidth || 600);
    const padL = 42;
    const padR = 16;
    const padT = 16;
    const padB = 10;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const n = picks.length;
    const maxPrice = Math.max(...picks.map((p) => p.price), 10);
    const xFor = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yFor = (price) => padT + innerH - (price / maxPrice) * innerH;

    const byPosition = POS_KEYS.map((pos) => {
      const posPicks = picks.map((p, i) => ({ ...p, seq: i })).filter((p) => p.position === pos);
      return { pos, posPicks };
    }).filter((g) => g.posPicks.length > 0);

    const linesSvg = byPosition
      .map((g) => {
        const points = g.posPicks.map((p) => `${xFor(p.seq).toFixed(1)},${yFor(p.price).toFixed(1)}`).join(" ");
        return `<polyline class="trend-line" style="stroke:var(${POSITION_COLOR_VAR[g.pos]})" points="${points}"/>`;
      })
      .join("");
    const dotsSvg = byPosition
      .flatMap((g) =>
        g.posPicks.map(
          (p) => `<circle class="trend-dot" cx="${xFor(p.seq).toFixed(1)}" cy="${yFor(p.price).toFixed(1)}" r="4.5" fill="var(${POSITION_COLOR_VAR[g.pos]})" data-idx="${p.seq}"></circle>`
        )
      )
      .join("");

    const gridCount = 4;
    let gridlines = "";
    let yLabels = "";
    for (let g = 0; g <= gridCount; g++) {
      const val = Math.round((maxPrice * g) / gridCount);
      const y = yFor(val);
      gridlines += `<line class="trend-gridline" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"/>`;
      yLabels += `<text class="trend-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">$${val}</text>`;
    }

    wrap.innerHTML = `<div class="trend-wrap">
      <svg class="trend-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${gridlines}
        ${yLabels}
        ${linesSvg}
        ${dotsSvg}
      </svg>
      <div class="trend-tooltip" id="trendTooltip"></div>
    </div>`;

    const tooltip = document.getElementById("trendTooltip");
    wrap.querySelectorAll(".trend-dot").forEach((dot) => {
      dot.addEventListener("mouseenter", () => {
        const idx = Number(dot.dataset.idx);
        const p = picks[idx];
        const team = teamById(p.teamId);
        tooltip.textContent = `#${idx + 1} ${p.name} (${p.position}) — $${p.price}${team ? ` · ${team.name}` : ""}`;
        tooltip.style.left = `${dot.getAttribute("cx")}px`;
        tooltip.style.top = `${dot.getAttribute("cy")}px`;
        tooltip.style.opacity = "1";
      });
      dot.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
      });
    });

    document.getElementById("trendLegend").innerHTML = byPosition
      .map((g) => `<span class="legend-item"><span class="legend-dot" style="background:var(${POSITION_COLOR_VAR[g.pos]})"></span>${g.pos}</span>`)
      .join("");
  }

  /* ---------------- Advanced: avg spend by position, per team (matrix) ---------------- */
  function renderPositionMatrix() {
    const el = document.getElementById("positionMatrix");
    const presentPositions = POS_KEYS.filter((pos) => picks.some((p) => p.position === pos));
    if (picks.length === 0 || presentPositions.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const rows = teamStats
      .map((t) => {
        const cells = presentPositions
          .map((pos) => {
            const posPicks = t.picks.filter((p) => p.position === pos);
            if (posPicks.length === 0) return `<td class="matrix-cell empty">—</td>`;
            const avg = posPicks.reduce((s, p) => s + p.price, 0) / posPicks.length;
            return `<td class="matrix-cell">$${avg.toFixed(0)}</td>`;
          })
          .join("");
        return `<tr><td class="team-name-cell">${escapeHtml(t.name)}</td>${cells}</tr>`;
      })
      .join("");
    el.innerHTML = `<div class="matrix-wrap"><table class="matrix-table">
      <thead><tr><th></th>${presentPositions.map((pos) => `<th>${pos}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  /* ---------------- Advanced: box & whisker (price distribution by position) ---------------- */
  function renderBoxWhisker() {
    const el = document.getElementById("chartBoxWhisker");
    const groups = POS_KEYS.map((pos) => ({ pos, prices: picks.filter((p) => p.position === pos).map((p) => p.price).sort((a, b) => a - b) })).filter((g) => g.prices.length > 0);
    if (groups.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    function quantile(sorted, q) {
      const pos = (sorted.length - 1) * q;
      const base = Math.floor(pos);
      const rest = pos - base;
      return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
    }
    const stats = groups.map((g) => ({
      pos: g.pos,
      min: g.prices[0],
      q1: quantile(g.prices, 0.25),
      median: quantile(g.prices, 0.5),
      q3: quantile(g.prices, 0.75),
      max: g.prices[g.prices.length - 1],
    }));

    const height = 220;
    const width = Math.max(320, el.clientWidth || 600);
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const maxPrice = Math.max(...stats.map((s) => s.max), 10);
    const yFor = (price) => padT + innerH - (price / maxPrice) * innerH;
    const colWidth = innerW / stats.length;
    const boxWidth = Math.min(46, colWidth * 0.5);

    const gridCount = 4;
    let gridlines = "";
    let yLabels = "";
    for (let g = 0; g <= gridCount; g++) {
      const val = Math.round((maxPrice * g) / gridCount);
      const y = yFor(val);
      gridlines += `<line class="bw-gridline" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"/>`;
      yLabels += `<text class="bw-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">$${val}</text>`;
    }

    const boxes = stats
      .map((s, i) => {
        const cx = padL + colWidth * (i + 0.5);
        const colorVar = POSITION_COLOR_VAR[s.pos];
        return `
          <line class="bw-whisker" x1="${cx}" y1="${yFor(s.min).toFixed(1)}" x2="${cx}" y2="${yFor(s.q1).toFixed(1)}"/>
          <line class="bw-whisker" x1="${cx}" y1="${yFor(s.q3).toFixed(1)}" x2="${cx}" y2="${yFor(s.max).toFixed(1)}"/>
          <line class="bw-whisker" x1="${cx - boxWidth * 0.25}" y1="${yFor(s.min).toFixed(1)}" x2="${cx + boxWidth * 0.25}" y2="${yFor(s.min).toFixed(1)}"/>
          <line class="bw-whisker" x1="${cx - boxWidth * 0.25}" y1="${yFor(s.max).toFixed(1)}" x2="${cx + boxWidth * 0.25}" y2="${yFor(s.max).toFixed(1)}"/>
          <rect class="bw-box" x="${(cx - boxWidth / 2).toFixed(1)}" y="${yFor(s.q3).toFixed(1)}" width="${boxWidth.toFixed(1)}" height="${Math.max(1, yFor(s.q1) - yFor(s.q3)).toFixed(1)}" fill="var(${colorVar})" stroke="var(${colorVar})"/>
          <line class="bw-median" x1="${(cx - boxWidth / 2).toFixed(1)}" y1="${yFor(s.median).toFixed(1)}" x2="${(cx + boxWidth / 2).toFixed(1)}" y2="${yFor(s.median).toFixed(1)}" stroke="var(${colorVar})"/>
          <text class="bw-pos-label" x="${cx}" y="${height - 8}">${s.pos}</text>
        `;
      })
      .join("");

    el.innerHTML = `<svg class="bw-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${gridlines}${yLabels}${boxes}
    </svg>`;
  }

  /* ---------------- Spending Race ----------------
     Cumulative $ spent per team, plotted over the course of the draft --
     a "race" of everyone's running total. Flat stretches mean a team was
     sitting out; steep climbs mean a spending spree. Whoever's line is
     highest at the far right spent the most money the fastest. */
  function renderSpendRace() {
    const el = document.getElementById("chartWaffle");
    if (picks.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const height = 260;
    const width = Math.max(320, el.clientWidth || 600);
    const padL = 42;
    const padR = 16;
    const padT = 16;
    const padB = 10;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const n = picks.length;
    const maxSpend = Math.max(...teamStats.map((t) => t.spend), 10);
    const xFor = (seq) => padL + (n <= 1 ? innerW / 2 : (seq / n) * innerW);
    const yFor = (spend) => padT + innerH - (spend / maxSpend) * innerH;

    const lines = teamStats
      .filter((t) => t.picks.length > 0)
      .map((t) => {
        let running = 0;
        const points = [`${xFor(0).toFixed(1)},${yFor(0).toFixed(1)}`];
        t.picks
          .slice()
          .sort((a, b) => a.seq - b.seq)
          .forEach((p) => {
            running += p.price;
            points.push(`${xFor(p.seq).toFixed(1)},${yFor(running).toFixed(1)}`);
          });
        points.push(`${xFor(n).toFixed(1)},${yFor(running).toFixed(1)}`);
        return `<polyline class="race-line" style="stroke:${t.color}" points="${points.join(" ")}"/>`;
      })
      .join("");

    const gridCount = 4;
    let gridlines = "";
    let yLabels = "";
    for (let g = 0; g <= gridCount; g++) {
      const val = Math.round((maxSpend * g) / gridCount);
      const y = yFor(val);
      gridlines += `<line class="race-gridline" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"/>`;
      yLabels += `<text class="race-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">$${val}</text>`;
    }

    el.innerHTML = `<svg class="race-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${gridlines}${yLabels}${lines}
      <text class="race-axis-label" x="${width / 2}" y="${height - 2}" text-anchor="middle">Draft order →</text>
    </svg>`;

    document.getElementById("waffleLegend").innerHTML = teamStats
      .filter((t) => t.picks.length > 0)
      .sort((a, b) => b.spend - a.spend)
      .map((t) => `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${escapeHtml(t.name)} — $${t.spend}</span>`)
      .join("");
  }

  /* ---------------- Shared: gaps between consecutive picks by timestamp ---------------- */
  function computeTimedGaps() {
    const timed = picks.filter((p) => typeof p.loggedAt === "number").slice().sort((a, b) => a.loggedAt - b.loggedAt);
    const gaps = [];
    for (let i = 1; i < timed.length; i++) {
      gaps.push({ before: timed[i - 1], after: timed[i], seconds: (timed[i].loggedAt - timed[i - 1].loggedAt) / 1000 });
    }
    return { timed, gaps };
  }

  /* ---------------- Draft Pace ----------------
     A bar per gap between consecutive picks (by timestamp), height = how
     long that gap was. Long breaks (2.5min+) are called out in red and
     listed below by name, so it's obvious who made everyone wait. */
  function renderPace() {
    const el = document.getElementById("chartPace");
    const longestBreaksEl = document.getElementById("longestBreaks");
    const { timed, gaps } = computeTimedGaps();
    if (timed.length < 2) {
      el.innerHTML = `<div class="chart-empty">Not enough timing data yet.</div>`;
      longestBreaksEl.innerHTML = "";
      return;
    }
    const longBreakThreshold = 150; // 2.5 min+ counts as a "long break"

    const height = 200;
    const width = Math.max(320, el.clientWidth || 600);
    const padL = 40;
    const padR = 16;
    const padT = 14;
    const padB = 22;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;
    const maxSeconds = Math.max(...gaps.map((g) => g.seconds), 30);
    const barGap = 2;
    const barWidth = Math.max(1, innerW / gaps.length - barGap);
    const yFor = (seconds) => (seconds / maxSeconds) * innerH;

    const gridCount = 3;
    let gridlines = "";
    let yLabels = "";
    for (let g = 0; g <= gridCount; g++) {
      const val = (maxSeconds * g) / gridCount;
      const y = padT + innerH - yFor(val);
      gridlines += `<line class="pace-gridline" x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}"/>`;
      yLabels += `<text class="pace-axis-label" x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${val >= 60 ? `${(val / 60).toFixed(0)}m` : `${val.toFixed(0)}s`}</text>`;
    }

    const bars = gaps
      .map((g, i) => {
        const x = padL + i * (barWidth + barGap);
        const h = Math.max(1, yFor(g.seconds));
        const y = padT + innerH - h;
        const label = g.seconds >= 60 ? `${(g.seconds / 60).toFixed(1)}m` : `${g.seconds.toFixed(0)}s`;
        return `<rect class="pace-bar${g.seconds >= longBreakThreshold ? " long-break" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}"><title>${escapeHtml(g.before.name)} → ${escapeHtml(g.after.name)}: ${label}</title></rect>`;
      })
      .join("");

    el.innerHTML = `<svg class="pace-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${gridlines}${yLabels}
      <text class="pace-axis-label" x="${width / 2}" y="${height - 4}" text-anchor="middle">Time between each pick, in draft order →</text>
      ${bars}
    </svg>`;

    const topBreaks = gaps.slice().sort((a, b) => b.seconds - a.seconds).slice(0, 5).filter((g) => g.seconds >= 60);
    if (topBreaks.length === 0) {
      longestBreaksEl.innerHTML = `<div class="lb-heading">Longest Breaks Between Picks</div><div class="chart-empty">Nobody stalled — steady pace all draft.</div>`;
    } else {
      longestBreaksEl.innerHTML = `<div class="lb-heading">Longest Breaks Between Picks</div>${topBreaks
        .map((g) => {
          const mins = g.seconds / 60;
          const label = mins >= 1 ? `${mins.toFixed(1)} min` : `${Math.round(g.seconds)} sec`;
          return `<div class="lb-row"><span>${escapeHtml(g.before.name)} → ${escapeHtml(g.after.name)}</span><span class="lb-gap">${label}</span></div>`;
        })
        .join("")}`;
    }
  }

  /* ---------------- Oddities & Fun Facts ----------------
     League-wide trivia that doesn't matter for any real strategy --
     just weird patterns pulled out of data nobody normally looks at. */
  function renderOddities() {
    const container = document.getElementById("oddityTiles");
    if (picks.length === 0) {
      container.innerHTML = `<div class="stat-tile"><div class="stat-label">Oddities</div><div class="stat-value">—</div><div class="stat-sub">No picks yet.</div></div>`;
      return;
    }

    const opening = picks[0];
    const openingTeam = teamById(opening.teamId);
    const closing = picks[picks.length - 1];
    const closingTeam = teamById(closing.teamId);

    // Most common first letter across every drafted name.
    const letterCounts = {};
    picks.forEach((p) => {
      const letter = p.name.trim()[0].toUpperCase();
      letterCounts[letter] = (letterCounts[letter] || 0) + 1;
    });
    const favoriteLetter = Object.entries(letterCounts).sort((a, b) => b[1] - a[1])[0];

    // Most common price paid, league-wide (the "mode").
    const priceCounts = {};
    picks.forEach((p) => { priceCounts[p.price] = (priceCounts[p.price] || 0) + 1; });
    const favoritePrice = Object.entries(priceCounts).sort((a, b) => b[1] - a[1])[0];

    // Position with the wildest price swings (highest std dev, min 2 picks).
    const posStats = POS_KEYS
      .map((pos) => picks.filter((p) => p.position === pos).map((p) => p.price))
      .map((prices, i) => {
        if (prices.length < 2) return null;
        const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
        const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
        return { pos: POS_KEYS[i], stdDev: Math.sqrt(variance) };
      })
      .filter(Boolean)
      .sort((a, b) => b.stdDev - a.stdDev);
    const wildestPos = posStats[0];

    // "Twinsies" -- two different teams paying the exact same price for
    // the same position, purely a coincidence-spotter.
    const byPosPrice = {};
    picks.forEach((p) => {
      const key = `${p.position}:${p.price}`;
      (byPosPrice[key] = byPosPrice[key] || []).push(p);
    });
    const twinsGroups = Object.values(byPosPrice).filter((group) => new Set(group.map((p) => p.teamId)).size >= 2);
    const twins = twinsGroups.sort((a, b) => b.length - a.length)[0];

    const tiles = [
      { label: "🎬 Opening Act", value: opening.name, sub: `$${opening.price} · the very first pick, by ${openingTeam ? openingTeam.name : "someone"}` },
      { label: "🎬 Closing Act", value: closing.name, sub: `$${closing.price} · the last pick standing, by ${closingTeam ? closingTeam.name : "someone"}` },
      favoriteLetter
        ? { label: "🔤 The League's Favorite Letter", value: `"${favoriteLetter[0]}"`, sub: `${favoriteLetter[1]} drafted names start with it` }
        : { label: "🔤 The League's Favorite Letter", value: "—", sub: "" },
      favoritePrice
        ? { label: "💵 Most Popular Price Tag", value: `$${favoritePrice[0]}`, sub: `paid ${favoritePrice[1]} separate times` }
        : { label: "💵 Most Popular Price Tag", value: "—", sub: "" },
      wildestPos
        ? { label: "🎢 Wildest Position", value: wildestPos.pos, sub: `±$${wildestPos.stdDev.toFixed(0)} swing — total chaos on every bid` }
        : { label: "🎢 Wildest Position", value: "—", sub: "not enough picks yet" },
      twins
        ? { label: "🪞 Twinsies", value: `${twins.length} teams`, sub: `all paid $${twins[0].price} for a ${twins[0].position} — pure coincidence, right?` }
        : { label: "🪞 Twinsies", value: "None yet", sub: "no two teams have matched a price" },
    ];
    container.innerHTML = tiles
      .map((t) => `<div class="stat-tile"><div class="stat-label">${escapeHtml(t.label)}</div><div class="stat-value">${escapeHtml(String(t.value))}</div><div class="stat-sub">${escapeHtml(t.sub)}</div></div>`)
      .join("");
  }

  /* ---------------- Draft Superlatives ---------------- */
  function renderSuperlatives() {
    const container = document.getElementById("superlatives");
    const withPicks = teamStats.filter((t) => t.picks.length > 0);
    if (withPicks.length === 0) {
      container.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }

    const benchPicks = picks.filter((p) => {
      const roster = getTeamRoster(p.teamId);
      return roster && ROSTER_SLOTS[roster.slots.findIndex((s) => s && s.id === p.id)] === "BENCH";
    });
    const priciestBench = benchPicks.length > 0 ? benchPicks.reduce((max, p) => (p.price > max.price ? p : max), benchPicks[0]) : null;

    const starterPicks = picks.filter((p) => {
      const roster = getTeamRoster(p.teamId);
      const idx = roster ? roster.slots.findIndex((s) => s && s.id === p.id) : -1;
      return idx !== -1 && ROSTER_SLOTS[idx] !== "BENCH";
    });
    const bargainStarter = starterPicks.length > 0 ? starterPicks.reduce((min, p) => (p.price < min.price ? p : min), starterPicks[0]) : null;

    const { gaps } = computeTimedGaps();
    const slowest = gaps.length > 0 ? gaps.slice().sort((a, b) => b.seconds - a.seconds)[0] : null;

    const withVariance = withPicks
      .filter((t) => t.picks.length >= 3)
      .map((t) => {
        const prices = t.picks.map((p) => p.price);
        const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
        const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
        return { team: t, stdDev: Math.sqrt(variance) };
      })
      .sort((a, b) => a.stdDev - b.stdDev);
    const consistency = withVariance[0];
    const chaos = withVariance[withVariance.length - 1];

    const leagueAvgPrice = picks.reduce((s, p) => s + p.price, 0) / picks.length;
    const mrAverage = withPicks
      .map((t) => ({ team: t, avgPrice: t.spend / t.picks.length }))
      .sort((a, b) => Math.abs(a.avgPrice - leagueAvgPrice) - Math.abs(b.avgPrice - leagueAvgPrice))[0];

    const cards = [];
    if (priciestBench) {
      const team = teamById(priciestBench.teamId);
      cards.push({ emoji: "💰", title: "Priciest Bench Warmer", name: priciestBench.name, sub: `$${priciestBench.price} · ${team ? team.name : ""} — riding the pine at a premium` });
    }
    if (bargainStarter) {
      const team = teamById(bargainStarter.teamId);
      cards.push({ emoji: "🪙", title: "Best Bargain Starter", name: bargainStarter.name, sub: `$${bargainStarter.price} · ${team ? team.name : ""} — starting lineup on a clearance budget` });
    }
    if (slowest) {
      const team = teamById(slowest.after.teamId);
      const mins = slowest.seconds / 60;
      const label = mins >= 1 ? `${mins.toFixed(1)} min` : `${Math.round(slowest.seconds)} sec`;
      cards.push({ emoji: "🐌", title: "Slowest On The Clock", name: slowest.after.name, sub: `${team ? team.name : ""} took ${label} to pull the trigger` });
    }
    if (consistency) {
      cards.push({ emoji: "🧊", title: "Ice In The Veins", name: consistency.team.name, sub: `±$${consistency.stdDev.toFixed(0)} price swing — the same steady number every single pick` });
    }
    if (chaos && chaos !== consistency) {
      cards.push({ emoji: "🌪️", title: "Chaos Agent", name: chaos.team.name, sub: `±$${chaos.stdDev.toFixed(0)} price swing — no two picks cost anywhere near the same` });
    }
    if (mrAverage) {
      cards.push({ emoji: "🎯", title: "Mr. Average", name: mrAverage.team.name, sub: `$${mrAverage.avgPrice.toFixed(0)} avg. pick — almost exactly the league average of $${leagueAvgPrice.toFixed(0)}` });
    }

    container.innerHTML = cards
      .map(
        (c) => `<div class="superlative-card">
          <div class="sl-emoji">${c.emoji}</div>
          <div class="sl-body">
            <div class="sl-title">${escapeHtml(c.title)}</div>
            <div class="sl-name">${escapeHtml(c.name)}</div>
            <div class="sl-sub">${escapeHtml(c.sub)}</div>
          </div>
        </div>`
      )
      .join("");
  }

  /* ---------------- Steals & Reaches ----------------
     "Value" here is a proxy, not real market data: how well-regarded the
     player is (their spot in the same TOP_VALUE_ORDER/ROOKIE_ORDER
     ranking the search box uses) weighed against how much of the budget
     they cost. It's a fun signal, not a verdict. */
  function renderStealsReaches() {
    const container = document.getElementById("stealsReaches");
    if (picks.length === 0) {
      container.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const maxRank = TOP_VALUE_ORDER.length + ROOKIE_ORDER.length + 500;
    const scored = picks.map((p) => {
      const quality = 1 - Math.min(playerRank(p.name), maxRank) / maxRank;
      const costRatio = p.price / BUDGET;
      return { ...p, value: quality - costRatio };
    });
    const steals = scored.slice().sort((a, b) => b.value - a.value).slice(0, 3);
    const reaches = scored.slice().sort((a, b) => a.value - b.value).slice(0, 3);

    function row(p, cls) {
      const team = teamById(p.teamId);
      return `<div class="value-row ${cls}">
        <span class="vr-pos-dot" style="background:var(${POSITION_COLOR_VAR[p.position]})"></span>
        <span class="vr-name">${escapeHtml(p.name)}<span class="vr-team">${team ? escapeHtml(team.name) : ""}</span></span>
        <span class="vr-price">$${p.price}</span>
      </div>`;
    }

    container.innerHTML = `
      <div class="value-list-heading">💰 Best Value</div>
      <div class="value-list">${steals.map((p) => row(p, "steal")).join("")}</div>
      <div class="value-list-heading">😬 Overpays</div>
      <div class="value-list">${reaches.map((p) => row(p, "reach")).join("")}</div>
    `;
  }

  /* ---------------- Roast ----------------
     Explicitly "R rated" / vulgar per request. The one hard line that
     doesn't move: no slurs, no racial/ethnic/identity references of any
     kind. Every line is aimed strictly at the draft decisions, never at
     who someone is. Commissioner can turn this whole section off in
     league settings (ROAST_ENABLED, see setup.html).

     Every condition has 5-6 phrasing variants (not 2-3) specifically
     because with enough teams tripping the same condition, a small
     variant pool ran out and started repeating verbatim. pickVariant()
     also mixes in a per-category seed (not just team index) so two
     different conditions for the same team don't land on the same
     rotation offset, and it tracks every line already used on the page
     so a repeat only happens if literally every variant everywhere is
     exhausted. */
  const usedRoastLines = new Set();
  function pickVariant(variants, seed) {
    for (let i = 0; i < variants.length; i++) {
      const candidate = variants[(seed + i) % variants.length];
      if (!usedRoastLines.has(candidate)) {
        usedRoastLines.add(candidate);
        return candidate;
      }
    }
    return variants[seed % variants.length];
  }

  function generateRoastLines(t, teamIndex) {
    if (t.picks.length === 0) {
      const variants = [
        "Drafted jack shit. Sat in the room, took up a chair, contributed absolutely nothing — a bye week with a pulse.",
        "Zero picks. Zero effort. Showed up just to eat the snacks other people paid for and vanish.",
        "Didn't draft a single player. This isn't a roster, it's an empty chair with a name tag taped to it.",
        "Ghosted the entire draft. Somewhere out there, 13 empty roster slots are still waiting by the phone.",
      ];
      return [pickVariant(variants, teamIndex)];
    }
    const maxPick = t.picks.reduce((max, p) => (p.price > max.price ? p : max), t.picks[0]);
    const maxShare = maxPick.price / BUDGET;
    const avgPrice = t.spend / t.picks.length;
    const dollarPicks = t.picks.filter((p) => p.price === 1).length;
    const topPosEntry = Object.entries(t.positionSpend).sort((a, b) => b[1] - a[1])[0];
    const topPosShare = topPosEntry && t.spend > 0 ? topPosEntry[1] / t.spend : 0;
    const missingStarterPos = ["RB", "WR", "TE"].find((pos) => !t.positionSpend[pos] && t.picks.length >= 6);
    const shareValues = Object.values(t.positionSpend);
    const shareMean = shareValues.length ? shareValues.reduce((s, v) => s + v, 0) / shareValues.length : 0;
    const shareVariance = shareValues.length ? shareValues.reduce((s, v) => s + (v - shareMean) ** 2, 0) / shareValues.length : 0;
    const isWishyWashy = shareValues.length >= 4 && shareMean > 0 && Math.sqrt(shareVariance) / shareMean < 0.35;
    const defPick = t.picks.find((p) => p.position === "DEF");

    const candidates = [];
    if (maxShare >= 0.3) {
      const pct = Math.round(maxShare * 100);
      candidates.push({
        id: 1,
        severity: maxShare,
        variants: [
          `Pissed away ${pct}% of the whole budget on ${maxPick.name} in one swing, like a guy at the blackjack table who just knows the next card is a face card.`,
          `${pct}% of the budget on ${maxPick.name} alone. That's not an auction strategy, that's a mid-life crisis with a bid paddle.`,
          `Dropped ${pct}% of the budget on one guy, ${maxPick.name}, and is now $1-bidding on everyone else like a man buying groceries with couch change.`,
          `Married the budget to ${maxPick.name} for ${pct}% of it. No prenup, no backup plan, just vibes and a credit limit.`,
          `${pct}% of the team's entire budget went to ${maxPick.name}. Bold move putting all your eggs in a basket that can pull a hamstring.`,
        ],
      });
    }
    if (topPosEntry && topPosShare >= 0.45) {
      const pct = Math.round(topPosShare * 100);
      candidates.push({
        id: 2,
        severity: topPosShare,
        variants: [
          `${pct}% of the budget torched on ${topPosEntry[0]}s alone. Every other position got held at gunpoint and this genius still lost the ransom money.`,
          `${pct}% dumped into ${topPosEntry[0]}s. Somebody's got a type, and the therapy bills are gonna cost more than the roster did.`,
          `Bet the whole farm on ${topPosEntry[0]}s (${pct}% of the budget). Real "eggs, one basket, then dropped the basket down the stairs" energy.`,
          `Drafted like ${topPosEntry[0]} was the only position in football. ${pct}% of the money says this guy forgot the sport has more than one job.`,
          `${pct}% on ${topPosEntry[0]}s. Somewhere a bye week is circled in red and this whole team is about to feel it at once.`,
        ],
      });
    }
    if (missingStarterPos) {
      candidates.push({
        id: 3,
        severity: 0.42,
        variants: [
          `Zero dollars spent on a single ${missingStarterPos}. Either forgot the position exists or is quietly planning to play with 10 men, which — respect the ambition, hate the roster.`,
          `Didn't draft one ${missingStarterPos} all night. Bold way to find out the hard way that the position matters.`,
          `Somehow built an entire roster with no ${missingStarterPos} on it. That's not a strategy, that's a blind spot the size of a stadium.`,
          `No ${missingStarterPos}s anywhere on this roster. Someone's Week 1 lineup is going to look like a cry for help.`,
        ],
      });
    }
    if (isWishyWashy) {
      candidates.push({
        id: 4,
        severity: 0.35,
        variants: [
          `Spread the budget so evenly across every position it looks like it was divided by a court-appointed mediator. Commit to something.`,
          `Perfectly balanced spending across the board — the roster equivalent of ordering a plain side salad because you couldn't decide on dinner.`,
          `Split the budget so cautiously evenly across positions that this roster has the personality of a Terms & Conditions page.`,
          `Nobody spends this evenly by accident. This is what happens when you're too scared to have a favorite.`,
        ],
      });
    }
    if (defPick && defPick.price >= 8) {
      candidates.push({
        id: 5,
        severity: 0.38,
        variants: [
          `Paid $${defPick.price} for a DEFENSE. A unit that changes every week based on who's hurt. Incredible use of money.`,
          `$${defPick.price} on a team defense. That's not fantasy football, that's a charitable donation to the concept of bad decisions.`,
          `Spent $${defPick.price} on ${defPick.name}. There are starting wide receivers that cost less than this defense did.`,
        ],
      });
    }
    if (t.rookieCount >= 3) {
      candidates.push({
        id: 6,
        severity: 0.5 + t.rookieCount * 0.05,
        variants: [
          `${t.rookieCount} rookies drafted on nothing but vibes and a highlight reel. This roster is a science project due in September and it's already getting graded on a curve.`,
          `${t.rookieCount} unproven rookies on one roster. Betting the whole season on guys who haven't taken a real hit yet — bold, dumb, or both.`,
          `${t.rookieCount} rookies. Somebody watched one YouTube mixtape and called it "film study."`,
          `Drafted ${t.rookieCount} rookies like this was a fantasy draft for a team that doesn't exist yet.`,
        ],
      });
    }
    if (t.rookieCount === 0 && t.picks.length >= 5) {
      candidates.push({
        id: 7,
        severity: 0.4,
        variants: [
          `Zero rookies. Wouldn't touch a player unless some talking head on TV already vouched for him first — pure follow-the-herd energy dressed up as "discipline."`,
          `Not one rookie. The most cowardly, play-it-safe roster in the league, and somehow still not even good.`,
          `Zero rookies drafted — too scared to gamble on anyone who wasn't already famous before the season started.`,
          `Refused every rookie in the pool. This roster runs on the emotional range of a Werther's Original commercial.`,
        ],
      });
    }
    if (dollarPicks >= Math.ceil(t.picks.length / 2)) {
      candidates.push({
        id: 8,
        severity: 0.4 + dollarPicks * 0.02,
        variants: [
          `${dollarPicks} picks bought for a single dollar apiece. Half this roster got drafted with the enthusiasm of someone finishing a chore they hate.`,
          `${dollarPicks} dollar-store picks on this roster. Assembled like a clearance bin nobody else wanted to dig through.`,
          `${dollarPicks} picks at rock-bottom dollar prices. This roster is being held together with pocket lint.`,
          `${dollarPicks} single-dollar picks. At some point that's not "value hunting," that's just not trying.`,
        ],
      });
    }
    if (avgPrice >= BUDGET * 0.12) {
      candidates.push({
        id: 9,
        severity: avgPrice / BUDGET,
        variants: [
          `Average pick price of $${avgPrice.toFixed(0)} — paid full retail on every single player all night, like the idea of a discount personally offended this guy's whole family.`,
          `$${avgPrice.toFixed(0)} average price. Never once heard the word "bargain" in his entire life.`,
          `Averaged $${avgPrice.toFixed(0)} a player. This roster was drafted with a checkbook and zero self-control.`,
          `$${avgPrice.toFixed(0)} average. This guy tips 40% and still overpays for the DoorDash fee.`,
        ],
      });
    } else if (avgPrice <= BUDGET * 0.04) {
      candidates.push({
        id: 10,
        severity: 0.3,
        variants: [
          `Average pick price of just $${avgPrice.toFixed(0)}. Built this whole roster out of the clearance bin and is somehow proud of it.`,
          `$${avgPrice.toFixed(0)} average. Cheaper than a gas station hot dog and about as trustworthy.`,
          `Averaged a measly $${avgPrice.toFixed(0)} a pick. Either a genius bargain hunter or flat broke by round three — no in between.`,
          `$${avgPrice.toFixed(0)} average price. This roster was clearly drafted with one eye on the group chat asking for gas money.`,
        ],
      });
    }

    candidates.sort((a, b) => b.severity - a.severity);
    const picked = candidates.slice(0, 2).map((c) => pickVariant(c.variants, teamIndex * 7 + c.id * 13));
    if (picked.length === 0) {
      const boringVariants = [
        "Suspiciously balanced, aggressively boring — this roster has the personality of wet cardboard. Nobody's going to remember a single pick, including the guy who made them.",
        "Perfectly average in every category. The fantasy football equivalent of beige — technically a color, forgettable as hell.",
        "Textbook, spreadsheet, zero personality. Drafted by someone who's never taken a real risk in his life.",
        "No overpays, no steals, no rookies gone wild, nothing. Just a well-behaved, thoroughly unremarkable pile of players.",
        "Middle of the pack on every metric. Impressive, in a deeply pathetic, play-it-safe kind of way.",
        "This roster is the human equivalent of a Tuesday. Nothing happened. Nothing will happen. Move along.",
        "So balanced, so sane, so boring — the anti-roast. Congrats on being too responsible to make fun of.",
      ];
      picked.push(pickVariant(boringVariants, teamIndex));
    }
    return picked;
  }

  function renderRoasts() {
    const section = document.getElementById("roastSection");
    if (!ROAST_ENABLED) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    document.getElementById("roastGrid").innerHTML = teamStats
      .map((t, i) => {
        const lines = generateRoastLines(t, i);
        return `<div class="roast-card">
          <div class="roast-team-name"><span class="roast-team-dot" style="background:${t.color}"></span>${escapeHtml(t.name)}</div>
          ${lines.map((l) => `<div class="roast-line">${escapeHtml(l)}</div>`).join("")}
        </div>`;
      })
      .join("");
  }

  renderStatTiles();
  renderAvgPrice();
  renderPositionMix();
  renderTrend();
  renderPositionMatrix();
  renderBoxWhisker();
  renderSpendRace();
  renderPace();
  renderStealsReaches();
  renderOddities();
  renderSuperlatives();
  renderRoasts();

  window.addEventListener("resize", () => {
    renderTrend();
    renderBoxWhisker();
    renderSpendRace();
    renderPace();
  });
})();
