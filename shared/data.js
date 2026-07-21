/* ===========================================================
   Shared data + mock state — Fantasy Auction Draft system
   Used by draft-board.html, player-entry.html, team-picks.html

   NOTE: This is a static prototype. Teams/players/picks below are
   generated client-side to make the mockups feel populated. A real
   build needs a shared data layer (small backend or Firebase) so a
   pick entered on the Player Entry screen actually appears live on
   the Draft Board — see DraftStore below for the seam where that
   would plug in (currently backed by localStorage as a stand-in so
   the two screens sync when opened in the same browser).
   =========================================================== */

const TEAMS = [
  { id: "t1", name: "Blitz Brigade", color: "var(--team-1)" },
  { id: "t2", name: "Endzone Elites", color: "var(--team-2)" },
  { id: "t3", name: "Gridiron Gladiators", color: "var(--team-3)" },
  { id: "t4", name: "Hail Mary Heroes", color: "var(--team-4)" },
  { id: "t5", name: "Pigskin Pirates", color: "var(--team-5)" },
  { id: "t6", name: "Red Zone Raiders", color: "var(--team-6)" },
  { id: "t7", name: "Sack Attack Squad", color: "var(--team-7)" },
  { id: "t8", name: "Touchdown Titans", color: "var(--team-8)" },
  { id: "t9", name: "Turf Tyrants", color: "var(--team-9)" },
  { id: "t10", name: "Fumble Force", color: "var(--team-10)" },
  { id: "t11", name: "End Around Eagles", color: "var(--team-11)" },
  { id: "t12", name: "Onside Outlaws", color: "var(--team-12)" },
];

const ROSTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"];
const TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length; // 156
const BUDGET = 200;
const FLEX_ELIGIBLE = ["RB", "WR", "TE"];

const POSITION_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te" };

const PLAYER_POOL = {
  QB: ["Patrick Mahomes", "Josh Allen", "Jalen Hurts", "Lamar Jackson", "Joe Burrow", "Justin Herbert", "C.J. Stroud", "Dak Prescott", "Trevor Lawrence", "Kyler Murray", "Brock Purdy", "Jordan Love", "Anthony Richardson", "Matthew Stafford", "Jared Goff", "Baker Mayfield", "Tua Tagovailoa", "Geno Smith", "Kirk Cousins", "Caleb Williams"],
  RB: ["Christian McCaffrey", "Bijan Robinson", "Breece Hall", "Jonathan Taylor", "Saquon Barkley", "Derrick Henry", "Josh Jacobs", "Isiah Pacheco", "Kenneth Walker III", "Travis Etienne", "De'Von Achane", "Jahmyr Gibbs", "James Cook", "Rachaad White", "Alvin Kamara", "Joe Mixon", "Aaron Jones", "Najee Harris", "Tony Pollard", "Austin Ekeler", "Rhamondre Stevenson", "D'Andre Swift", "Javonte Williams", "James Conner", "Zack Moss", "Brian Robinson Jr.", "Miles Sanders", "Kareem Hunt", "Cam Akers", "Devin Singletary", "Alexander Mattison", "Chuba Hubbard", "Jerome Ford", "Roschon Johnson", "Zamir White", "Tyjae Spears", "Ezekiel Elliott", "Antonio Gibson", "Clyde Edwards-Helaire", "D'Onta Foreman"],
  WR: ["Justin Jefferson", "Ja'Marr Chase", "Tyreek Hill", "CeeDee Lamb", "Amon-Ra St. Brown", "A.J. Brown", "Stefon Diggs", "Puka Nacua", "Garrett Wilson", "Chris Olave", "DK Metcalf", "Davante Adams", "Mike Evans", "DeVonta Smith", "Deebo Samuel", "Jaylen Waddle", "Drake London", "Terry McLaurin", "Amari Cooper", "Calvin Ridley", "Tank Dell", "Nico Collins", "Brandon Aiyuk", "Christian Kirk", "Michael Pittman Jr.", "Keenan Allen", "Jordan Addison", "Zay Flowers", "Rashee Rice", "Marquise Brown", "Diontae Johnson", "Courtland Sutton", "Jerry Jeudy", "Tyler Lockett", "Adam Thielen", "George Pickens", "Chris Godwin", "Curtis Samuel", "Gabe Davis", "Jakobi Meyers"],
  TE: ["Travis Kelce", "Sam LaPorta", "Mark Andrews", "T.J. Hockenson", "Trey McBride", "Kyle Pitts", "George Kittle", "Dallas Goedert", "Evan Engram", "David Njoku", "Dalton Kincaid", "Cole Kmet", "Pat Freiermuth", "Jake Ferguson", "Tyler Higbee", "Hunter Henry"],
};

const ALL_PLAYERS = Object.entries(PLAYER_POOL).flatMap(([position, names]) =>
  names.map((name) => ({ name, position }))
);

/* ---------- tiny seeded RNG so the mock draft looks the same every load ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(19472026);
function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- build a plausible mid-draft snapshot ---------- */
function buildMockDraft() {
  const pools = { QB: shuffle(PLAYER_POOL.QB, rng), RB: shuffle(PLAYER_POOL.RB, rng), WR: shuffle(PLAYER_POOL.WR, rng), TE: shuffle(PLAYER_POOL.TE, rng) };
  const cursor = { QB: 0, RB: 0, WR: 0, TE: 0 };

  const filledCountByTeam = [6, 5, 7, 4, 5, 3, 6, 4, 5, 7, 3, 4]; // uneven — mid-draft feel
  const roster = TEAMS.map((t) => ({ teamId: t.id, slots: ROSTER_SLOTS.map(() => null) }));

  const fillOrder = [];
  TEAMS.forEach((t, ti) => {
    for (let si = 0; si < filledCountByTeam[ti]; si++) fillOrder.push({ ti, si });
  });
  const chronological = shuffle(fillOrder, rng);

  function nextPlayerFor(requiredPositions) {
    for (const pos of requiredPositions) {
      if (cursor[pos] < pools[pos].length) {
        const name = pools[pos][cursor[pos]++];
        return { name, position: pos };
      }
    }
    return null;
  }

  function basePriceFor(position) {
    const base = position === "QB" ? 18 : position === "RB" ? 24 : position === "WR" ? 20 : 9;
    const spread = Math.floor(rng() * (base * 2.2));
    return Math.max(1, base - Math.floor(base * 0.4) + spread);
  }

  // Assign players to each team's slots first (fill order 0..filledCount-1),
  // deferring price so it can be computed with a budget-aware pass below —
  // every open roster spot must always keep at least $1 reserved.
  const teamPicks = TEAMS.map(() => []);
  chronological
    .slice()
    .sort((a, b) => a.ti - b.ti || a.si - b.si)
    .forEach(({ ti, si }) => {
      const slotType = ROSTER_SLOTS[si];
      const required = slotType === "FLEX" ? FLEX_ELIGIBLE : slotType === "BENCH" ? ["RB", "WR", "WR", "QB", "TE"] : [slotType];
      const player = nextPlayerFor(required);
      if (!player) return;
      teamPicks[TEAMS.findIndex((t) => t.id === TEAMS[ti].id)].push({ teamId: TEAMS[ti].id, slotIndex: si, name: player.name, position: player.position });
    });

  const pickByTeamSlot = new Map();
  teamPicks.forEach((picksForTeam) => {
    let spent = 0;
    picksForTeam.forEach((p, idx) => {
      const remainingBudget = BUDGET - spent;
      const slotsLeftAfterThis = ROSTER_SLOTS.length - idx - 1;
      const maxPrice = Math.max(1, remainingBudget - slotsLeftAfterThis);
      const price = Math.min(basePriceFor(p.position), maxPrice);
      spent += price;
      pickByTeamSlot.set(`${p.teamId}:${p.slotIndex}`, { ...p, price });
    });
  });

  const picks = [];
  let pickNumber = 0;
  chronological.forEach(({ ti, si }) => {
    const resolved = pickByTeamSlot.get(`${TEAMS[ti].id}:${si}`);
    if (!resolved) return;
    pickNumber += 1;
    const pick = { pickNumber, ...resolved };
    roster[ti].slots[si] = pick;
    picks.push(pick);
  });

  picks.sort((a, b) => a.pickNumber - b.pickNumber);
  return { roster, picks };
}

const MOCK_DRAFT = buildMockDraft();

function getTeamRoster(teamId) {
  return MOCK_DRAFT.roster.find((r) => r.teamId === teamId);
}

function computeTeamBudget(teamId) {
  const roster = getTeamRoster(teamId);
  const filled = roster.slots.filter(Boolean);
  const spent = filled.reduce((sum, p) => sum + p.price, 0);
  const remaining = BUDGET - spent;
  const openSlots = ROSTER_SLOTS.length - filled.length;
  const maxBid = openSlots > 0 ? Math.max(1, remaining - (openSlots - 1)) : 0;
  return { spent, remaining, maxBid, filled: filled.length, open: openSlots };
}

function draftedCount() {
  return MOCK_DRAFT.picks.length;
}

function recentPicks(n = 5) {
  return MOCK_DRAFT.picks.slice(-n).reverse();
}

function teamById(id) {
  return TEAMS.find((t) => t.id === id);
}

/* ---------- localStorage stand-in for a real shared backend ----------
   A production build would replace this with a small server or Firebase
   so a pick submitted on the phone appears on the TV in real time across
   devices. Here, writing/reading the same key lets the two screens sync
   automatically when opened in tabs on the same browser. */
const DraftStore = {
  KEY: "auctionDraft.livePicks",
  addPick(pick) {
    const live = this.getPicks();
    live.push(pick);
    localStorage.setItem(this.KEY, JSON.stringify(live));
  },
  getPicks() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || "[]");
    } catch {
      return [];
    }
  },
  onChange(cb) {
    window.addEventListener("storage", (e) => {
      if (e.key === this.KEY) cb();
    });
  },
};

/* Folds any picks logged on Player Entry (via DraftStore) into MOCK_DRAFT
   so the Draft Board / Team Picks views reflect them. Call once on load
   and again whenever DraftStore.onChange fires. */
const _appliedLiveKeys = new Set();
function findOpenSlotIndex(roster, position) {
  const candidates = [];
  ROSTER_SLOTS.forEach((slot, i) => {
    if (slot === position) candidates.push({ i, priority: 0 });
  });
  ROSTER_SLOTS.forEach((slot, i) => {
    if (slot === "FLEX" && FLEX_ELIGIBLE.includes(position)) candidates.push({ i, priority: 1 });
  });
  ROSTER_SLOTS.forEach((slot, i) => {
    if (slot === "BENCH") candidates.push({ i, priority: 2 });
  });
  candidates.sort((a, b) => a.priority - b.priority);
  const open = candidates.find((c) => !roster.slots[c.i]);
  return open ? open.i : -1;
}
function applyLivePicks() {
  let changed = false;
  DraftStore.getPicks().forEach((lp) => {
    const key = `${lp.loggedAt}:${lp.teamId}:${lp.name}`;
    if (_appliedLiveKeys.has(key)) return;
    _appliedLiveKeys.add(key);
    const roster = getTeamRoster(lp.teamId);
    if (!roster) return;
    const slotIndex = findOpenSlotIndex(roster, lp.position);
    if (slotIndex === -1) return;
    const pick = { pickNumber: MOCK_DRAFT.picks.length + 1, teamId: lp.teamId, slotIndex, name: lp.name, position: lp.position, price: lp.price };
    roster.slots[slotIndex] = pick;
    MOCK_DRAFT.picks.push(pick);
    changed = true;
  });
  return changed;
}

const NEWS_TICKER = [
  "🏈 Auction rooms across the league are heating up as final rosters take shape",
  "📈 Line movement: Chiefs -2.5 vs. Bills, total 47.5",
  "📰 Star WR cleared to practice in full ahead of Week 1",
  "💰 Reminder: nominate your sleepers before the bench slots dry up",
  "📊 Early ADP risers: rookie RBs climbing fast in redraft leagues",
  "🏈 Odds update: MVP favorite shortens to +450 after strong camp reports",
  "📰 Injury report: starting TE listed as questionable, monitor before kickoff",
  "📈 Over/under for total league points this week ticks up to 214.5",
];
