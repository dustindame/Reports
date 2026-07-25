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
  // Ranked only against other players at the same position
  // (using their order within PLAYER_POOL[position], which is roughly
  // best-to-worst) instead of the whole league. The global ranking above
  // only meaningfully separates ~120 "name brand" players -- everyone else
  // gets dumped at the same rock-bottom score, which is why the Value
  // Quadrant used to just show two clumps at the extreme top/bottom. This
  // spreads every drafted player out across the full 0..1 range.
  function positionQuality(name, position) {
    const pool = PLAYER_POOL[position] || [];
    const idx = pool.indexOf(name);
    if (idx === -1 || pool.length <= 1) return 0.5;
    return 1 - idx / (pool.length - 1);
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

  /* ---------------- Value quadrant scatter ----------------
     x = price paid, y = value relative to other players at the same
     position (see positionQuality above). Quadrant lines sit at the
     league averages of each, splitting the field into steal / reach /
     expected-good / expected-bad zones. */
  function renderQuadrant() {
    const el = document.getElementById("chartQuadrant");
    if (picks.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const scored = picks.map((p) => ({ ...p, quality: positionQuality(p.name, p.position) }));
    const height = 280;
    const width = Math.max(320, el.clientWidth || 600);
    const pad = 40;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const maxPrice = Math.max(...scored.map((p) => p.price), 10);
    const xFor = (price) => pad + (price / maxPrice) * innerW;
    const yFor = (quality) => pad + innerH - quality * innerH;
    const avgPrice = scored.reduce((s, p) => s + p.price, 0) / scored.length;
    const avgQuality = scored.reduce((s, p) => s + p.quality, 0) / scored.length;
    const midX = xFor(avgPrice);
    const midY = yFor(avgQuality);

    const dots = scored
      .map(
        (p, i) => `<circle class="quad-dot" cx="${xFor(p.price).toFixed(1)}" cy="${yFor(p.quality).toFixed(1)}" r="5.5" fill="var(${POSITION_COLOR_VAR[p.position]})" data-idx="${i}"></circle>`
      )
      .join("");

    el.innerHTML = `<div class="trend-wrap">
      <svg class="quad-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <line class="quad-gridline" x1="${pad}" y1="${midY.toFixed(1)}" x2="${width - pad}" y2="${midY.toFixed(1)}"/>
        <line class="quad-gridline" x1="${midX.toFixed(1)}" y1="${pad}" x2="${midX.toFixed(1)}" y2="${height - pad}"/>
        <text class="quad-quadrant-label" x="${pad + 4}" y="${pad + 12}">Steals</text>
        <text class="quad-quadrant-label" x="${width - pad - 4}" y="${pad + 12}" text-anchor="end">Studs (paid up)</text>
        <text class="quad-quadrant-label" x="${pad + 4}" y="${height - pad - 4}">Avoided</text>
        <text class="quad-quadrant-label" x="${width - pad - 4}" y="${height - pad - 4}" text-anchor="end">Reaches</text>
        <text class="quad-axis-label" x="${width / 2}" y="${height - 8}" text-anchor="middle">Price paid →</text>
        <text class="quad-axis-label" x="14" y="${height / 2}" text-anchor="middle" transform="rotate(-90 14 ${height / 2})">Value vs. position →</text>
        ${dots}
      </svg>
      <div class="quad-tooltip" id="quadTooltip"></div>
    </div>`;

    const tooltip = document.getElementById("quadTooltip");
    el.querySelectorAll(".quad-dot").forEach((dot) => {
      dot.addEventListener("mouseenter", () => {
        const p = scored[Number(dot.dataset.idx)];
        const team = teamById(p.teamId);
        tooltip.textContent = `${p.name} (${p.position}) — $${p.price}${team ? ` · ${team.name}` : ""}`;
        tooltip.style.left = `${dot.getAttribute("cx")}px`;
        tooltip.style.top = `${dot.getAttribute("cy")}px`;
        tooltip.style.opacity = "1";
      });
      dot.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
    });
  }

  /* ---------------- Advanced: league-wide position mix (waffle) ---------------- */
  function renderWaffle() {
    const el = document.getElementById("chartWaffle");
    const totalSpend = picks.reduce((s, p) => s + p.price, 0);
    if (totalSpend === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const present = POS_KEYS.filter((pos) => picks.some((p) => p.position === pos));
    const shares = present.map((pos) => ({
      pos,
      pct: picks.filter((p) => p.position === pos).reduce((s, p) => s + p.price, 0) / totalSpend,
    }));

    // Largest-remainder rounding so 100 squares are allocated exactly,
    // instead of just flooring each share and coming up short.
    const raw = shares.map((s) => s.pct * 100);
    const floors = raw.map(Math.floor);
    let remaining = 100 - floors.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remaining; k++) floors[order[k % order.length].i] += 1;

    const cellPos = [];
    shares.forEach((s, i) => { for (let k = 0; k < floors[i]; k++) cellPos.push(s.pos); });
    while (cellPos.length < 100) cellPos.push(shares[shares.length - 1].pos);

    el.innerHTML = `<div class="waffle-grid">${cellPos
      .map((pos) => `<div class="waffle-cell" style="background:var(${POSITION_COLOR_VAR[pos]})" title="${pos}"></div>`)
      .join("")}</div>`;

    document.getElementById("waffleLegend").innerHTML = shares
      .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:var(${POSITION_COLOR_VAR[s.pos]})"></span>${s.pos} — ${(s.pct * 100).toFixed(0)}%</span>`)
      .join("");
  }

  /* ---------------- Draft Pace ----------------
     A bar per gap between consecutive picks (by timestamp), height = how
     long that gap was. Long breaks (2.5min+) are called out in red and
     listed below by name, so it's obvious who made everyone wait. */
  function renderPace() {
    const el = document.getElementById("chartPace");
    const longestBreaksEl = document.getElementById("longestBreaks");
    const timed = picks.filter((p) => typeof p.loggedAt === "number").slice().sort((a, b) => a.loggedAt - b.loggedAt);
    if (timed.length < 2) {
      el.innerHTML = `<div class="chart-empty">Not enough timing data yet.</div>`;
      longestBreaksEl.innerHTML = "";
      return;
    }
    const gaps = [];
    for (let i = 1; i < timed.length; i++) {
      gaps.push({ before: timed[i - 1], after: timed[i], seconds: (timed[i].loggedAt - timed[i - 1].loggedAt) / 1000 });
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
     Explicitly "R rated" / vulgar per request -- real profanity is in
     play here on purpose. The one hard line that doesn't move: no slurs,
     no racial/ethnic/identity references of any kind. Every line is
     aimed strictly at the draft decisions (overpays, hoarding, cowardice,
     general incompetence), never at who someone is. Commissioner can turn
     this whole section off in league settings (ROAST_ENABLED, see
     setup.html) if the group doesn't want it. */
  function generateRoastLines(t) {
    if (t.picks.length === 0) {
      return ["Drafted jack shit. Sat in the room, took up a chair, contributed absolutely nothing — a bye week with a pulse."];
    }
    const maxPick = t.picks.reduce((max, p) => (p.price > max.price ? p : max), t.picks[0]);
    const maxShare = maxPick.price / BUDGET;
    const avgPrice = t.spend / t.picks.length;
    const dollarPicks = t.picks.filter((p) => p.price === 1).length;
    const topPosEntry = Object.entries(t.positionSpend).sort((a, b) => b[1] - a[1])[0];
    const topPosShare = topPosEntry && t.spend > 0 ? topPosEntry[1] / t.spend : 0;

    const candidates = [];
    if (maxShare >= 0.3) {
      candidates.push({ severity: maxShare, text: `Blew ${Math.round(maxShare * 100)}% of the whole goddamn budget on ${maxPick.name} in one shot, like a degenerate who thinks the slot machine is "due." Everyone else on this roster is getting fed scraps so that one bet could feel like a big dick move.` });
    }
    if (topPosEntry && topPosShare >= 0.45) {
      candidates.push({ severity: topPosShare, text: `${Math.round(topPosShare * 100)}% of the budget torched on ${topPosEntry[0]}s alone. That's not a strategy, that's a hostage situation — every other position got held at gunpoint and this dipshit still lost the ransom money.` });
    }
    if (t.rookieCount >= 3) {
      candidates.push({ severity: 0.5 + t.rookieCount * 0.05, text: `${t.rookieCount} rookies drafted on nothing but vibes and a hype-reel boner. This isn't a roster, it's a fucking science project that's due in September and everyone already knows it's getting an F.` });
    }
    if (t.rookieCount === 0 && t.picks.length >= 5) {
      candidates.push({ severity: 0.4, text: `Zero rookies, zero balls. Wouldn't touch a player unless some talking head on TV already sucked him off first — pure gutless, follow-the-herd bullshit dressed up as "discipline."` });
    }
    if (dollarPicks >= Math.ceil(t.picks.length / 2)) {
      candidates.push({ severity: 0.4 + dollarPicks * 0.02, text: `${dollarPicks} picks bought for a single dollar apiece. Half this roster got drafted with the same energy as taking a shit — quick, joyless, and everyone in the room wishing it'd hurry up.` });
    }
    if (avgPrice >= BUDGET * 0.12) {
      candidates.push({ severity: avgPrice / BUDGET, text: `Average pick price of $${avgPrice.toFixed(0)} — paid full goddamn retail on every single player all night, like the idea of a discount personally pissed in this idiot's cereal.` });
    } else if (avgPrice <= BUDGET * 0.04) {
      candidates.push({ severity: 0.3, text: `Average pick price of just $${avgPrice.toFixed(0)}. Built this whole sorry-ass roster out of the clearance bin and is somehow strutting around proud of it.` });
    }

    candidates.sort((a, b) => b.severity - a.severity);
    const picked = candidates.slice(0, 2).map((c) => c.text);
    if (picked.length === 0) {
      picked.push("Suspiciously balanced, aggressively boring as hell — this roster has the personality of wet cardboard. Nobody's going to remember a single pick, including the dumbass who made them.");
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
      .map((t) => {
        const lines = generateRoastLines(t);
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
  renderQuadrant();
  renderWaffle();
  renderPace();
  renderStealsReaches();
  renderRoasts();

  window.addEventListener("resize", () => {
    renderTrend();
    renderBoxWhisker();
    renderQuadrant();
    renderPace();
  });
})();
