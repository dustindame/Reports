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

  /* ---------------- Total spend by team ---------------- */
  function renderTeamSpend() {
    const el = document.getElementById("chartTeamSpend");
    if (picks.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const sorted = teamStats.slice().sort((a, b) => b.spend - a.spend);
    const maxSpend = Math.max(...sorted.map((t) => t.spend), 1);
    el.innerHTML = sorted
      .map(
        (t) => `<div class="bar-row">
          <span class="bar-label">${escapeHtml(t.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${((t.spend / maxSpend) * 100).toFixed(1)}%; background:${t.color}"></span></span>
          <span class="bar-value">$${t.spend}</span>
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
            const pct = ((t.positionSpend[pos] / total) * 100).toFixed(1);
            return `<span class="mix-seg" style="width:${pct}%; background:var(${POSITION_COLOR_VAR[pos]})" title="${pos}: $${t.positionSpend[pos]}"></span>`;
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

  /* ---------------- Advanced: position price volatility ----------------
     Standard deviation of price within each position -- a high number
     means that position had real bidding wars (some picks way above
     others), a low number means everyone paid about the same. */
  function renderVolatility() {
    const el = document.getElementById("chartVolatility");
    const present = POS_KEYS.filter((pos) => picks.filter((p) => p.position === pos).length >= 2);
    if (present.length === 0) {
      el.innerHTML = `<div class="chart-empty">Not enough picks per position yet.</div>`;
      return;
    }
    const rows = present
      .map((pos) => {
        const prices = picks.filter((p) => p.position === pos).map((p) => p.price);
        const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
        const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
        return { pos, stdDev: Math.sqrt(variance) };
      })
      .sort((a, b) => b.stdDev - a.stdDev);
    const maxDev = Math.max(...rows.map((r) => r.stdDev), 1);
    el.innerHTML = rows
      .map(
        (r) => `<div class="bar-row">
          <span class="bar-label">${r.pos}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${((r.stdDev / maxDev) * 100).toFixed(1)}%; background:var(${POSITION_COLOR_VAR[r.pos]})"></span></span>
          <span class="bar-value">±$${r.stdDev.toFixed(0)}</span>
        </div>`
      )
      .join("");
  }

  /* ---------------- Advanced: budget concentration ----------------
     Each team's single biggest pick as a share of their total spend --
     high share = "bet it all on one player," low share = spread evenly. */
  function renderConcentration() {
    const el = document.getElementById("chartConcentration");
    const withPicks = teamStats.filter((t) => t.picks.length > 0);
    if (withPicks.length === 0) {
      el.innerHTML = `<div class="chart-empty">No picks yet.</div>`;
      return;
    }
    const rows = withPicks
      .map((t) => {
        const maxPick = t.picks.reduce((max, p) => (p.price > max.price ? p : max), t.picks[0]);
        const share = t.spend > 0 ? maxPick.price / t.spend : 0;
        return { team: t, share, maxPick };
      })
      .sort((a, b) => b.share - a.share);
    el.innerHTML = rows
      .map(
        (r) => `<div class="bar-row">
          <span class="bar-label">${escapeHtml(r.team.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(r.share * 100).toFixed(1)}%; background:${r.team.color}"></span></span>
          <span class="bar-value">${(r.share * 100).toFixed(0)}%</span>
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
     Harsher / more savage tone per request ("R rated"). Kept free of actual
     profanity and slurs by design -- if genuinely explicit language is
     wanted, that's a separate ask. */
  function generateRoastLines(t) {
    if (t.picks.length === 0) {
      return ["Didn't draft a single player. Showed up, took up a seat, contributed absolutely nothing — the human equivalent of a bye week."];
    }
    const maxPick = t.picks.reduce((max, p) => (p.price > max.price ? p : max), t.picks[0]);
    const maxShare = maxPick.price / BUDGET;
    const avgPrice = t.spend / t.picks.length;
    const dollarPicks = t.picks.filter((p) => p.price === 1).length;
    const topPosEntry = Object.entries(t.positionSpend).sort((a, b) => b[1] - a[1])[0];
    const topPosShare = topPosEntry && t.spend > 0 ? topPosEntry[1] / t.spend : 0;

    const candidates = [];
    if (maxShare >= 0.3) {
      candidates.push({ severity: maxShare, text: `Blew ${Math.round(maxShare * 100)}% of the entire budget on ${maxPick.name} like it was a bottle service tab. One injury away from a full-blown crisis.` });
    }
    if (topPosEntry && topPosShare >= 0.45) {
      candidates.push({ severity: topPosShare, text: `${Math.round(topPosShare * 100)}% of the budget torched on ${topPosEntry[0]}s. This isn't a roster, it's a cry for help with a one-track mind.` });
    }
    if (t.rookieCount >= 3) {
      candidates.push({ severity: 0.5 + t.rookieCount * 0.05, text: `${t.rookieCount} rookies drafted. Either you found the next big thing or you built a daycare and called it a fantasy team.` });
    }
    if (t.rookieCount === 0 && t.picks.length >= 5) {
      candidates.push({ severity: 0.4, text: `Zero rookies. Terrified of upside, allergic to risk — the roster equivalent of ordering water at a bar.` });
    }
    if (dollarPicks >= Math.ceil(t.picks.length / 2)) {
      candidates.push({ severity: 0.4 + dollarPicks * 0.02, text: `${dollarPicks} picks bought for a single dollar. Half this roster looks like it was drafted while checking a phone.` });
    }
    if (avgPrice >= BUDGET * 0.12) {
      candidates.push({ severity: avgPrice / BUDGET, text: `Average pick price of $${avgPrice.toFixed(0)} — paid full sticker on everyone, every time, like the auction had no other bidders in the room.` });
    } else if (avgPrice <= BUDGET * 0.04) {
      candidates.push({ severity: 0.3, text: `Average pick price of just $${avgPrice.toFixed(0)}. Congratulations on assembling the discount rack and calling it a strategy.` });
    }

    candidates.sort((a, b) => b.severity - a.severity);
    const picked = candidates.slice(0, 2).map((c) => c.text);
    if (picked.length === 0) {
      picked.push("Painfully balanced, aggressively boring — the fantasy football equivalent of beige paint. No one will remember this roster, including the person who drafted it.");
    }
    return picked;
  }

  function renderRoasts() {
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
  renderTeamSpend();
  renderPositionMix();
  renderTrend();
  renderPositionMatrix();
  renderVolatility();
  renderConcentration();
  renderStealsReaches();
  renderRoasts();

  window.addEventListener("resize", renderTrend);
})();
