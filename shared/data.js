/* ===========================================================
   Shared data + mock state — Fantasy Auction Draft system
   Used by draft-board.html, player-entry.html, team-picks.html,
   setup.html

   TEAMS / ROSTER_SLOTS / BUDGET are populated asynchronously by
   initDraftConfig() from the `draft_config` table in Supabase (see
   setup.html / supabase/migrations). Every page script must
   `await configReady` before touching TEAMS, ROSTER_SLOTS, BUDGET,
   TOTAL_SLOTS, or any function below that depends on them.

   If nobody has configured a draft yet (draft_config is empty), the
   app falls back to a built-in 12-team demo: fixed named teams, a
   13-slot roster, a $200 budget, and a deterministic seeded mock
   draft so the app looks populated on first visit.
   =========================================================== */

let TEAMS;
let ROSTER_SLOTS;
let BUDGET;
let TOTAL_SLOTS;
let MOCK_DRAFT;

const FLEX_ELIGIBLE = ["RB", "WR", "TE"];
const POSITION_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te" };

const DEFAULT_TEAM_NAMES = [
  "Blitz Brigade",
  "Endzone Elites",
  "Gridiron Gladiators",
  "Hail Mary Heroes",
  "Pigskin Pirates",
  "Red Zone Raiders",
  "Sack Attack Squad",
  "Touchdown Titans",
  "Turf Tyrants",
  "Fumble Force",
  "End Around Eagles",
  "Onside Outlaws",
  "Deep Ball Dynasty",
  "Two-Point Takers",
];
const MAX_TEAMS = 14;
const MIN_TEAMS = 6;
const DEFAULT_NUM_TEAMS = 12;
const DEFAULT_BUDGET = 200;
const DEFAULT_ROSTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "FLEX", "BENCH", "BENCH", "BENCH", "BENCH", "BENCH"];

function teamColorVar(index) {
  return `var(--team-${(index % MAX_TEAMS) + 1})`;
}

const PLAYER_POOL = {
  QB: ["Patrick Mahomes", "Josh Allen", "Jalen Hurts", "Lamar Jackson", "Joe Burrow", "Justin Herbert", "C.J. Stroud", "Dak Prescott", "Trevor Lawrence", "Kyler Murray", "Brock Purdy", "Jordan Love", "Anthony Richardson", "Matthew Stafford", "Jared Goff", "Baker Mayfield", "Tua Tagovailoa", "Geno Smith", "Kirk Cousins", "Caleb Williams"],
  RB: ["Christian McCaffrey", "Bijan Robinson", "Breece Hall", "Jonathan Taylor", "Saquon Barkley", "Derrick Henry", "Josh Jacobs", "Isiah Pacheco", "Kenneth Walker III", "Travis Etienne", "De'Von Achane", "Jahmyr Gibbs", "James Cook", "Rachaad White", "Alvin Kamara", "Joe Mixon", "Aaron Jones", "Najee Harris", "Tony Pollard", "Austin Ekeler", "Rhamondre Stevenson", "D'Andre Swift", "Javonte Williams", "James Conner", "Zack Moss", "Brian Robinson Jr.", "Miles Sanders", "Kareem Hunt", "Cam Akers", "Devin Singletary", "Alexander Mattison", "Chuba Hubbard", "Jerome Ford", "Roschon Johnson", "Zamir White", "Tyjae Spears", "Ezekiel Elliott", "Antonio Gibson", "Clyde Edwards-Helaire", "D'Onta Foreman"],
  WR: ["Justin Jefferson", "Ja'Marr Chase", "Tyreek Hill", "CeeDee Lamb", "Amon-Ra St. Brown", "A.J. Brown", "Stefon Diggs", "Puka Nacua", "Garrett Wilson", "Chris Olave", "DK Metcalf", "Davante Adams", "Mike Evans", "DeVonta Smith", "Deebo Samuel", "Jaylen Waddle", "Drake London", "Terry McLaurin", "Amari Cooper", "Calvin Ridley", "Tank Dell", "Nico Collins", "Brandon Aiyuk", "Christian Kirk", "Michael Pittman Jr.", "Keenan Allen", "Jordan Addison", "Zay Flowers", "Rashee Rice", "Marquise Brown", "Diontae Johnson", "Courtland Sutton", "Jerry Jeudy", "Tyler Lockett", "Adam Thielen", "George Pickens", "Chris Godwin", "Curtis Samuel", "Gabe Davis", "Jakobi Meyers"],
  TE: ["Travis Kelce", "Sam LaPorta", "Mark Andrews", "T.J. Hockenson", "Trey McBride", "Kyle Pitts", "George Kittle", "Dallas Goedert", "Evan Engram", "David Njoku", "Dalton Kincaid", "Cole Kmet", "Pat Freiermuth", "Jake Ferguson", "Tyler Higbee", "Hunter Henry"],
};

const ALL_PLAYERS = Object.entries(PLAYER_POOL).flatMap(([position, names]) =>
  names.map((name) => ({ name, position }))
);

/* ---------- tiny seeded RNG so the demo draft looks the same every load ---------- */
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

/* ---------- demo mode only: a plausible mid-draft snapshot ----------
   Only ever called against the built-in 12-team / 13-slot / $200 demo
   setup (see initDraftConfig) — never against a real configured draft,
   which starts empty instead (see buildEmptyDraft). */
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

/* A real configured draft always starts empty — every slot open, no picks.
   Mixing in the seeded demo picks would corrupt an actual live draft. */
function buildEmptyDraft() {
  const roster = TEAMS.map((t) => ({ teamId: t.id, slots: ROSTER_SLOTS.map(() => null) }));
  return { roster, picks: [] };
}

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

/* ---------- Supabase-backed shared draft store ----------
   Picks confirmed on Player Entry are written to the `picks` table
   (see supabase/migrations) and streamed to every open screen via
   Supabase Realtime, so a pick entered on a phone shows up live on
   the TV and on other phones — across devices, not just browser tabs. */
const supabaseClient =
  typeof supabase !== "undefined" && SUPABASE_URL && !SUPABASE_URL.startsWith("REPLACE_")
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const DraftStore = {
  async addPick(pick) {
    if (!supabaseClient) {
      console.warn("Supabase isn't configured yet — see shared/supabase-config.js. Pick was not saved.");
      return;
    }
    const { error } = await supabaseClient.from("picks").insert({
      team_id: pick.teamId,
      player_name: pick.name,
      position: pick.position,
      price: pick.price,
    });
    if (error) console.error("Failed to save pick to Supabase:", error);
  },
  async getPicks() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient.from("picks").select("*").order("created_at", { ascending: true });
    if (error) {
      console.error("Failed to load picks from Supabase:", error);
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      name: row.player_name,
      position: row.position,
      price: row.price,
      loggedAt: new Date(row.created_at).getTime(),
    }));
  },
  async getConfig() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from("draft_config").select("*").eq("id", 1).maybeSingle();
    if (error) {
      console.error("Failed to load draft config from Supabase:", error);
      return null;
    }
    return data;
  },
  async saveConfig({ teamNames, budget, rosterSlots }) {
    if (!supabaseClient) {
      return { error: "Supabase isn't configured yet — see shared/supabase-config.js." };
    }
    const { error: clearError } = await supabaseClient.from("picks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (clearError) return { error: clearError.message };

    const { error } = await supabaseClient.from("draft_config").upsert({
      id: 1,
      num_teams: teamNames.length,
      budget,
      team_names: teamNames,
      roster_slots: rosterSlots,
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
    return { error: null };
  },
  onChange(cb) {
    if (!supabaseClient) return;
    supabaseClient
      .channel("picks-inserts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "picks" }, () => cb())
      .subscribe();
  },
};

/* ---------- config bootstrap ----------
   Every page script must `await configReady` before touching TEAMS,
   ROSTER_SLOTS, BUDGET, TOTAL_SLOTS, or calling any function above that
   reads them. */
async function initDraftConfig() {
  const config = await DraftStore.getConfig();

  if (config) {
    TEAMS = config.team_names.map((name, i) => ({ id: `t${i + 1}`, name, color: teamColorVar(i) }));
    ROSTER_SLOTS = config.roster_slots;
    BUDGET = config.budget;
    TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length;
    MOCK_DRAFT = buildEmptyDraft();
  } else {
    TEAMS = DEFAULT_TEAM_NAMES.slice(0, DEFAULT_NUM_TEAMS).map((name, i) => ({ id: `t${i + 1}`, name, color: teamColorVar(i) }));
    ROSTER_SLOTS = DEFAULT_ROSTER_SLOTS;
    BUDGET = DEFAULT_BUDGET;
    TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length;
    MOCK_DRAFT = buildMockDraft();
  }
}
const configReady = initDraftConfig();

/* Folds any picks logged on Player Entry (via DraftStore) into MOCK_DRAFT
   so the Draft Board / Team Picks views reflect them. Call once on load
   (after configReady) and again whenever DraftStore.onChange fires. */
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
async function applyLivePicks() {
  let changed = false;
  const picks = await DraftStore.getPicks();
  picks.forEach((lp) => {
    if (_appliedLiveKeys.has(lp.id)) return;
    _appliedLiveKeys.add(lp.id);
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

/* Used only if the live RSS fetch below fails (offline, feed down, etc.) —
   never shown otherwise. */
const FALLBACK_NEWS_TICKER = [
  "🏈 Auction rooms across the league are heating up as final rosters take shape",
  "📰 Star WR cleared to practice in full ahead of Week 1",
  "💰 Reminder: nominate your sleepers before the bench slots dry up",
  "📊 Early ADP risers: rookie RBs climbing fast in redraft leagues",
  "📰 Injury report: starting TE listed as questionable, monitor before kickoff",
];

/* ---------- live NFL news for the Draft Board ticker ----------
   Both feeds send Access-Control-Allow-Origin: * so they're fetchable
   directly from the browser — no proxy/backend needed. */
const NEWS_FEEDS = ["https://www.espn.com/espn/rss/nfl/news", "https://www.cbssports.com/rss/headlines/nfl/"];

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function fetchNewsHeadlines() {
  const headlines = [];
  for (const url of NEWS_FEEDS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      Array.from(doc.querySelectorAll("item"))
        .slice(0, 8)
        .forEach((item) => {
          const title = item.querySelector("title")?.textContent?.trim();
          if (title) headlines.push(`🏈 ${escapeHtml(title)}`);
        });
    } catch (e) {
      console.warn(`Failed to fetch news from ${url}:`, e);
    }
  }
  return headlines;
}
