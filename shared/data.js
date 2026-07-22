/* ===========================================================
   Shared data + mock state — Fantasy Auction Draft system
   Used by draft-board.html, player-entry.html, team-picks.html,
   setup.html

   TEAMS / ROSTER_SLOTS / BUDGET are populated by applyRealConfig() or
   applyDemoConfig() (see shared/league-gate.js, which resolves which
   league is active and calls the right one via configReady). Every page
   script must `await configReady` before touching TEAMS, ROSTER_SLOTS,
   BUDGET, TOTAL_SLOTS, or any function below that depends on them.

   Multiple leagues can exist side by side, each identified by a short
   shareable `league_code` (see supabase/migrations). Viewing a league
   (Draft Board, Team Picks) only needs the code. Writing to one (logging
   a pick, editing setup) additionally requires the commissioner's PIN,
   checked server-side by Postgres functions (create_league/update_league/
   submit_pick/verify_pin) — a leaked league code alone can never alter a
   draft. See LeagueSession below for how the code/PIN are remembered on
   a device.

   If no league is selected (first visit, no code entered), the app falls
   back to a built-in local-only demo: fixed named teams, a 13-slot
   roster, a $200 budget, and a deterministic seeded mock draft — no real
   backend row involved.
   =========================================================== */

let TEAMS;
let ROSTER_SLOTS;
let BUDGET;
let TOTAL_SLOTS;
let MOCK_DRAFT;
let CURRENT_LEAGUE_CODE = null;

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

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* 6-char codes, excluding easily-confused characters (0/O, 1/I). */
function generateLeagueCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- remembering the active league + unlocked PIN on this device ----------
   leagueCode is remembered long-term (localStorage) — that's the "easily
   select it again later" part. The unlocked PIN hash is remembered only
   for the current browser tab session (sessionStorage) so the
   commissioner isn't retyping it for every single pick, but it's gone
   once the tab closes. */
const LeagueSession = {
  LEAGUE_KEY: "auctionDraft.leagueCode",
  getLeagueCode() {
    return localStorage.getItem(this.LEAGUE_KEY);
  },
  setLeagueCode(code) {
    localStorage.setItem(this.LEAGUE_KEY, code);
  },
  clearLeagueCode() {
    localStorage.removeItem(this.LEAGUE_KEY);
  },
  pinStorageKey(leagueCode) {
    return `auctionDraft.pinHash.${leagueCode}`;
  },
  getPinHash(leagueCode) {
    return sessionStorage.getItem(this.pinStorageKey(leagueCode));
  },
  setPinHash(leagueCode, hash) {
    sessionStorage.setItem(this.pinStorageKey(leagueCode), hash);
  },
  clearPinHash(leagueCode) {
    sessionStorage.removeItem(this.pinStorageKey(leagueCode));
  },
};

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
   Only ever called by applyDemoConfig() — never against a real league,
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
      pickByTeamSlot.set(`${p.teamId}:${p.slotIndex}`, { ...p, price, id: crypto.randomUUID() });
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

/* A real league always starts empty — every slot open, no picks. Mixing
   in the seeded demo picks would corrupt an actual live draft. */
function buildEmptyDraft() {
  const roster = TEAMS.map((t) => ({ teamId: t.id, slots: ROSTER_SLOTS.map(() => null) }));
  return { roster, picks: [] };
}

/* ---------- switching between a real league and the local demo ---------- */
function applyRealConfig(config, leagueCode) {
  CURRENT_LEAGUE_CODE = leagueCode;
  TEAMS = config.team_names.map((name, i) => ({ id: `t${i + 1}`, name, color: teamColorVar(i) }));
  ROSTER_SLOTS = config.roster_slots;
  BUDGET = config.budget;
  TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length;
  MOCK_DRAFT = buildEmptyDraft();
}

function applyDemoConfig() {
  CURRENT_LEAGUE_CODE = null;
  TEAMS = DEFAULT_TEAM_NAMES.slice(0, DEFAULT_NUM_TEAMS).map((name, i) => ({ id: `t${i + 1}`, name, color: teamColorVar(i) }));
  ROSTER_SLOTS = DEFAULT_ROSTER_SLOTS;
  BUDGET = DEFAULT_BUDGET;
  TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length;
  MOCK_DRAFT = buildMockDraft();
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
   Reads (getConfig/getPicks/onChange) are scoped by league_code and only
   need the code. Writes (addPick/createLeague/updateLeague) go through
   SECURITY DEFINER Postgres functions that check the commissioner PIN
   hash server-side — see supabase/migrations. A league code alone can
   never write anything; the PIN check happens in the database, not just
   in this client code. */
const supabaseClient =
  typeof supabase !== "undefined" && SUPABASE_URL && !SUPABASE_URL.startsWith("REPLACE_")
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const DraftStore = {
  async getConfig(leagueCode) {
    if (!supabaseClient || !leagueCode) return null;
    const { data, error } = await supabaseClient
      .from("draft_config")
      .select("id, league_code, num_teams, budget, team_names, roster_slots, updated_at")
      .eq("league_code", leagueCode)
      .maybeSingle();
    if (error) {
      console.error("Failed to load league config from Supabase:", error);
      return null;
    }
    return data;
  },

  async createLeague({ leagueCode, pinHash, teamNames, budget, rosterSlots }) {
    if (!supabaseClient) return { error: "Supabase isn't configured yet — see shared/supabase-config.js." };
    const { data, error } = await supabaseClient.rpc("create_league", {
      p_league_code: leagueCode,
      p_pin_hash: pinHash,
      p_num_teams: teamNames.length,
      p_budget: budget,
      p_team_names: teamNames,
      p_roster_slots: rosterSlots,
    });
    if (error) return { error: error.message };
    return { error: null, id: data };
  },

  async updateLeague({ leagueCode, pinHash, teamNames, budget, rosterSlots, clearPicks = true }) {
    if (!supabaseClient) return { error: "Supabase isn't configured yet — see shared/supabase-config.js." };
    const { data, error } = await supabaseClient.rpc("update_league", {
      p_league_code: leagueCode,
      p_pin_hash: pinHash,
      p_num_teams: teamNames.length,
      p_budget: budget,
      p_team_names: teamNames,
      p_roster_slots: rosterSlots,
      p_clear_picks: clearPicks,
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "Incorrect commissioner PIN." };
    return { error: null };
  },

  async verifyPin(leagueCode, pinHash) {
    if (!supabaseClient) return false;
    const { data, error } = await supabaseClient.rpc("verify_pin", { p_league_code: leagueCode, p_pin_hash: pinHash });
    if (error) {
      console.error("Failed to verify PIN:", error);
      return false;
    }
    return data === true;
  },

  async addPick(pick, pinHash) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) {
      console.warn("No active league — pick was not saved.");
      return { error: "No active league." };
    }
    const { data, error } = await supabaseClient.rpc("submit_pick", {
      p_league_code: CURRENT_LEAGUE_CODE,
      p_pin_hash: pinHash,
      p_team_id: pick.teamId,
      p_player_name: pick.name,
      p_position: pick.position,
      p_price: pick.price,
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "Incorrect commissioner PIN." };
    return { error: null };
  },

  async deletePick(pickId, pinHash) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const { data, error } = await supabaseClient.rpc("delete_pick", {
      p_league_code: CURRENT_LEAGUE_CODE,
      p_pin_hash: pinHash,
      p_pick_id: pickId,
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "Incorrect commissioner PIN." };
    return { error: null };
  },

  async getPicks() {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return [];
    const { data, error } = await supabaseClient
      .from("picks")
      .select("*")
      .eq("league_code", CURRENT_LEAGUE_CODE)
      .order("created_at", { ascending: true });
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

  onChange(cb) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    supabaseClient
      .channel(`picks-inserts-${CURRENT_LEAGUE_CODE}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "picks", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` },
        () => cb()
      )
      .subscribe();
  },

  /* Fan shout-outs — posted from Team Picks (e.g. after scanning the
     Draft Board's QR code), shown highlighted in the Draft Board's news
     ticker. No PIN needed: unlike picks/setup this can't alter draft
     state, so it's open to anyone with the league code. */
  async sendMessage(text) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const trimmed = text.trim().slice(0, 80);
    if (!trimmed) return { error: "Message can't be empty." };
    const { error } = await supabaseClient.from("board_messages").insert({ league_code: CURRENT_LEAGUE_CODE, message: trimmed });
    if (error) return { error: error.message };
    return { error: null };
  },

  async getMessages(limit = 10) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return [];
    const { data, error } = await supabaseClient
      .from("board_messages")
      .select("*")
      .eq("league_code", CURRENT_LEAGUE_CODE)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("Failed to load board messages from Supabase:", error);
      return [];
    }
    return data.map((row) => ({ id: row.id, text: row.message, createdAt: new Date(row.created_at).getTime() }));
  },

  onMessage(cb) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    supabaseClient
      .channel(`board-messages-${CURRENT_LEAGUE_CODE}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_messages", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` },
        (payload) => cb({ id: payload.new.id, text: payload.new.message, createdAt: new Date(payload.new.created_at).getTime() })
      )
      .subscribe();
  },
};

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
    const pick = { id: lp.id, pickNumber: MOCK_DRAFT.picks.length + 1, teamId: lp.teamId, slotIndex, name: lp.name, position: lp.position, price: lp.price };
    roster.slots[slotIndex] = pick;
    MOCK_DRAFT.picks.push(pick);
    changed = true;
  });
  return changed;
}

/* Removes a pick from the in-memory draft state right after a successful
   delete_pick RPC call, so the UI updates immediately without waiting for
   a Realtime round-trip. Safe to call even if the pick isn't found. */
function removePickLocally(pickId) {
  const idx = MOCK_DRAFT.picks.findIndex((p) => p.id === pickId);
  if (idx === -1) return;
  const [removed] = MOCK_DRAFT.picks.splice(idx, 1);
  const roster = getTeamRoster(removed.teamId);
  if (roster && roster.slots[removed.slotIndex] && roster.slots[removed.slotIndex].id === pickId) {
    roster.slots[removed.slotIndex] = null;
  }
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
