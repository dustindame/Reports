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

// Draft Board display config -- which header widgets to show, and its
// custom name. Set by applyRealConfig()/applyDemoConfig(), read by
// draft-board.js after configReady resolves.
let BOARD_NAME = "Auction Draft Board";
let SHOW_NEWS = true;
let SHOW_MESSAGES = true;
let SHOW_RECENT = true;
let SHOW_DRAFTED_TOTAL = true;
let SHOW_POSITION_TOTALS = false;
let SHOW_ELAPSED_TIME = false;
let NICE_ENABLED = false;
let SHOTS_COUNT = 0;
let SHOT_PICK_NUMBERS = [];
let ROAST_ENABLED = true;
let ON_BREAK = false;

const FLEX_ELIGIBLE = ["RB", "WR", "TE"];
const POSITION_COLOR_VAR = { QB: "--qb", RB: "--rb", WR: "--wr", TE: "--te", DEF: "--def" };

/* Kept to <=12 characters each (no abbreviations) so they fit the Draft
   Board's Team column without wrapping or needing to be shortened. */
const DEFAULT_TEAM_NAMES = [
  "Blitz Squad",
  "End Zone",
  "Iron Curtain",
  "Hail Mary",
  "Pigskins",
  "Red Zone",
  "Sack Squad",
  "Touchdowns",
  "Turf Titans",
  "Fumble Force",
  "End Around",
  "Onside Kick",
  "Deep Ball",
  "Two Point",
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
  // A random per-device id (not tied to any real identity) so a poll
  // vote can be "one per device" and changeable, without any login.
  VOTER_KEY: "auctionDraft.voterToken",
  getVoterToken() {
    let token = localStorage.getItem(this.VOTER_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(this.VOTER_KEY, token);
    }
    return token;
  },
};

const PLAYER_POOL = {
  QB: ["Patrick Mahomes", "Josh Allen", "Jalen Hurts", "Lamar Jackson", "Joe Burrow", "Justin Herbert", "C.J. Stroud", "Dak Prescott", "Trevor Lawrence", "Kyler Murray", "Brock Purdy", "Jordan Love", "Anthony Richardson", "Matthew Stafford", "Jared Goff", "Baker Mayfield", "Tua Tagovailoa", "Geno Smith", "Kirk Cousins", "Caleb Williams", "Bo Nix", "Drake Maye", "Sam Darnold", "Aaron Rodgers", "Russell Wilson", "Daniel Jones", "Bryce Young", "Will Levis", "J.J. McCarthy", "Michael Penix Jr.", "Derek Carr", "Mac Jones", "Sam Howell", "Justin Fields", "Deshaun Watson", "Jameis Winston", "Gardner Minshew", "Tyler Huntley", "Joe Flacco", "Cooper Rush", "Fernando Mendoza", "Ty Simpson", "Carson Beck", "Drew Allar", "Cade Klubnik", "Taylen Green", "Cole Payton", "Garrett Nussmeier", "Behren Morton", "Athan Kaliakmanis"],
  RB: ["Christian McCaffrey", "Bijan Robinson", "Breece Hall", "Jonathan Taylor", "Saquon Barkley", "Derrick Henry", "Josh Jacobs", "Isiah Pacheco", "Kenneth Walker III", "Travis Etienne", "De'Von Achane", "Jahmyr Gibbs", "James Cook", "Rachaad White", "Alvin Kamara", "Joe Mixon", "Aaron Jones", "Najee Harris", "Tony Pollard", "Austin Ekeler", "Rhamondre Stevenson", "D'Andre Swift", "Javonte Williams", "James Conner", "Zack Moss", "Brian Robinson Jr.", "Miles Sanders", "Kareem Hunt", "Cam Akers", "Devin Singletary", "Alexander Mattison", "Chuba Hubbard", "Jerome Ford", "Roschon Johnson", "Zamir White", "Tyjae Spears", "Ezekiel Elliott", "Antonio Gibson", "Clyde Edwards-Helaire", "D'Onta Foreman", "David Montgomery", "Jaylen Warren", "Bucky Irving", "Ray Davis", "Tyler Allgeier", "Gus Edwards", "Rico Dowdle", "Kyren Williams", "Jaylen Wright", "Jaydon Blue", "Isaac Guerendo", "Braelon Allen", "Ty Chandler", "Blake Corum", "Justice Hill", "Elijah Mitchell", "Samaje Perine", "Dameon Pierce", "Khalil Herbert", "Trey Benson", "MarShawn Lloyd", "Tyler Badie", "Jeremiyah Love", "Jadarian Price", "Jonah Coleman", "Mike Washington Jr.", "Kaelon Black", "Adam Randall", "Nicholas Singleton", "Emmett Johnson", "Kaytron Allen", "Seth McGowan", "Demond Claiborne", "Eli Heidenreich", "Jam Miller"],
  WR: ["Justin Jefferson", "Ja'Marr Chase", "Tyreek Hill", "CeeDee Lamb", "Amon-Ra St. Brown", "A.J. Brown", "Stefon Diggs", "Puka Nacua", "Garrett Wilson", "Chris Olave", "DK Metcalf", "Davante Adams", "Mike Evans", "DeVonta Smith", "Deebo Samuel", "Jaylen Waddle", "Drake London", "Terry McLaurin", "Amari Cooper", "Calvin Ridley", "Tank Dell", "Nico Collins", "Brandon Aiyuk", "Christian Kirk", "Michael Pittman Jr.", "Keenan Allen", "Jordan Addison", "Zay Flowers", "Rashee Rice", "Marquise Brown", "Diontae Johnson", "Courtland Sutton", "Jerry Jeudy", "Tyler Lockett", "Adam Thielen", "George Pickens", "Chris Godwin", "Curtis Samuel", "Gabe Davis", "Jakobi Meyers", "DJ Moore", "Xavier Worthy", "Rome Odunze", "Malik Nabers", "Marvin Harrison Jr.", "Tee Higgins", "Ladd McConkey", "Josh Downs", "Wan'Dale Robinson", "Rashid Shaheed", "Khalil Shakir", "Jameson Williams", "Elijah Moore", "Romeo Doubs", "Christian Watson", "Josh Palmer", "Jalen Tolbert", "Darnell Mooney", "Jauan Jennings", "Ricky Pearsall", "Xavier Legette", "Keon Coleman", "Brian Thomas Jr.", "Troy Franklin", "Adonai Mitchell", "Ja'Lynn Polk", "Quentin Johnston", "Carnell Tate", "Jordyn Tyson", "Makai Lemon", "KC Concepcion", "Omar Cooper Jr.", "Denzel Boston", "Germie Bernard", "Chris Bell", "Chris Brazzell II", "De'Zhaun Stribling", "Malachi Fields", "Ja'Kobi Lane", "Elijah Sarratt", "Zachariah Branch", "Antonio Williams", "Skyler Bell", "Caleb Douglas", "Ted Hurst", "Bryce Lance", "Zavion Thomas", "Kevin Coleman Jr.", "Reggie Virgil", "Colbie Young", "Brenen Thompson", "Josh Cameron", "CJ Daniels", "Kendrick Law", "Kaden Wetjen", "Malik Benson", "Barion Brown", "Emmanuel Henderson Jr.", "Cyrus Allen", "CJ Williams", "Lewis Bond", "Deion Burks", "Anthony Smith"],
  TE: ["Travis Kelce", "Sam LaPorta", "Mark Andrews", "T.J. Hockenson", "Trey McBride", "Kyle Pitts", "George Kittle", "Dallas Goedert", "Evan Engram", "David Njoku", "Dalton Kincaid", "Cole Kmet", "Pat Freiermuth", "Jake Ferguson", "Tyler Higbee", "Hunter Henry", "Brock Bowers", "Zach Ertz", "Noah Fant", "Isaiah Likely", "Cade Otton", "Juwan Johnson", "Tucker Kraft", "Luke Musgrave", "Michael Mayer", "Darnell Washington", "Chigoziem Okonkwo", "Theo Johnson", "Brenton Strange", "Kenyon Sadiq", "Eli Stowers", "Max Klare", "Marlin Klein", "Oscar Delp", "Nate Boerkircher", "Eli Raridon", "Will Kacmarek", "Sam Roush", "Justin Joly", "Josh Cuevas", "Joe Royer", "Tanner Koziol", "Matthew Hibner", "Riley Nowakowski", "Seydou Traore", "Jack Endries", "Bauer Sharp", "Jaren Kanak", "Dallen Bentley", "Carsen Ryan"],
  DEF: ["49ers D/ST", "Ravens D/ST", "Cowboys D/ST", "Eagles D/ST", "Bills D/ST", "Jets D/ST", "Steelers D/ST", "Dolphins D/ST", "Browns D/ST", "Broncos D/ST", "Patriots D/ST", "Saints D/ST", "Colts D/ST", "Bears D/ST", "Chiefs D/ST", "Texans D/ST", "Buccaneers D/ST", "Packers D/ST", "Chargers D/ST", "Lions D/ST"],
};

/* Approximate overall fantasy-value order (not grouped by position) for
   the top tier, mixing positions the way real draft projections would --
   without this, ALL_PLAYERS retained PLAYER_POOL's position-grouped
   order (QB list first), so a search matching many players always
   surfaced QBs first regardless of actual value. Anyone not in this list
   just keeps their original relative order, after everyone who is. */
const TOP_VALUE_ORDER = [
  "Christian McCaffrey", "CeeDee Lamb", "Ja'Marr Chase", "Tyreek Hill", "Justin Jefferson",
  "Breece Hall", "Bijan Robinson", "Amon-Ra St. Brown", "Jahmyr Gibbs", "Jonathan Taylor",
  "Josh Allen", "A.J. Brown", "Puka Nacua", "Saquon Barkley", "Garrett Wilson",
  "Travis Kelce", "Patrick Mahomes", "De'Von Achane", "Lamar Jackson", "Jalen Hurts",
  "Chris Olave", "Stefon Diggs", "Derrick Henry", "Josh Jacobs", "Davante Adams",
  "Sam LaPorta", "Mike Evans", "Kenneth Walker III", "Nico Collins", "DK Metcalf",
  "Deebo Samuel", "Jaylen Waddle", "Drake London", "Joe Burrow", "James Cook",
  "Rachaad White", "Alvin Kamara", "Joe Mixon", "Terry McLaurin", "Mark Andrews",
];

/* This year's incoming rookie class, ranked 1-80 (per user-provided
   rankings) -- slotted into the search-value order right after the
   established veteran tier above, so e.g. the #1 rookie shows up ahead
   of a random veteran deep on the depth chart, without leapfrogging
   proven stars like McCaffrey or Lamb. */
const ROOKIE_ORDER = [
  "Jeremiyah Love", "Carnell Tate", "Jordyn Tyson", "Makai Lemon", "KC Concepcion",
  "Fernando Mendoza", "Omar Cooper Jr.", "Kenyon Sadiq", "Jadarian Price", "Denzel Boston",
  "Germie Bernard", "Chris Bell", "Eli Stowers", "Jonah Coleman", "Chris Brazzell II",
  "De'Zhaun Stribling", "Malachi Fields", "Ja'Kobi Lane", "Elijah Sarratt", "Zachariah Branch",
  "Antonio Williams", "Skyler Bell", "Mike Washington Jr.", "Kaelon Black", "Caleb Douglas",
  "Ted Hurst", "Ty Simpson", "Bryce Lance", "Max Klare", "Marlin Klein",
  "Adam Randall", "Nicholas Singleton", "Emmett Johnson", "Carson Beck", "Kaytron Allen",
  "Drew Allar", "Oscar Delp", "Zavion Thomas", "Kevin Coleman Jr.", "Reggie Virgil",
  "Colbie Young", "Brenen Thompson", "Josh Cameron", "CJ Daniels", "Nate Boerkircher",
  "Eli Raridon", "Will Kacmarek", "Sam Roush", "Seth McGowan", "Demond Claiborne",
  "Eli Heidenreich", "Kendrick Law", "Kaden Wetjen", "Malik Benson", "Barion Brown",
  "Emmanuel Henderson Jr.", "Cyrus Allen", "CJ Williams", "Lewis Bond", "Justin Joly",
  "Josh Cuevas", "Joe Royer", "Tanner Koziol", "Matthew Hibner", "Cade Klubnik",
  "Taylen Green", "Cole Payton", "Riley Nowakowski", "Jam Miller", "Garrett Nussmeier",
  "Deion Burks", "Seydou Traore", "Jack Endries", "Bauer Sharp", "Behren Morton",
  "Athan Kaliakmanis", "Jaren Kanak", "Dallen Bentley", "Carsen Ryan", "Anthony Smith",
];

const ALL_PLAYERS = (() => {
  const flat = Object.entries(PLAYER_POOL).flatMap(([position, names]) =>
    names.map((name) => ({ name, position }))
  );
  flat.forEach((p, i) => { p._originalOrder = i; });
  const rankOf = (name) => {
    const topIdx = TOP_VALUE_ORDER.indexOf(name);
    if (topIdx !== -1) return topIdx;
    const rookieIdx = ROOKIE_ORDER.indexOf(name);
    if (rookieIdx !== -1) return TOP_VALUE_ORDER.length + rookieIdx;
    return TOP_VALUE_ORDER.length + ROOKIE_ORDER.length + 1000;
  };
  return flat
    .slice()
    .sort((a, b) => {
      const diff = rankOf(a.name) - rankOf(b.name);
      return diff !== 0 ? diff : a._originalOrder - b._originalOrder;
    })
    .map(({ name, position }) => ({ name, position }));
})();

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
  const draftStart = Date.now() - 90 * 60 * 1000; // pretend the demo draft started 90 min ago
  chronological.forEach(({ ti, si }) => {
    const resolved = pickByTeamSlot.get(`${TEAMS[ti].id}:${si}`);
    if (!resolved) return;
    pickNumber += 1;
    // Mostly a steady ~40s/pick pace, with a handful of longer breaks
    // (bathroom/beer runs) so the demo recap's pace chart has something
    // interesting to show.
    const gapSeconds = rng() < 0.12 ? 180 + rng() * 420 : 20 + rng() * 60;
    const loggedAt = draftStart + pickNumber * gapSeconds * 1000;
    const pick = { pickNumber, ...resolved, loggedAt };
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

  BOARD_NAME = config.board_name || "Auction Draft Board";
  SHOW_NEWS = config.show_news !== false;
  SHOW_MESSAGES = config.show_messages !== false;
  SHOW_RECENT = config.show_recent !== false;
  SHOW_DRAFTED_TOTAL = config.show_drafted_total !== false;
  SHOW_POSITION_TOTALS = Boolean(config.show_position_totals);
  SHOW_ELAPSED_TIME = Boolean(config.show_elapsed_time);
  NICE_ENABLED = Boolean(config.nice_enabled);
  SHOTS_COUNT = Number(config.shots_count) || 0;
  SHOT_PICK_NUMBERS = Array.isArray(config.shot_pick_numbers) ? config.shot_pick_numbers : [];
  ROAST_ENABLED = config.roast_enabled !== false;
  ON_BREAK = Boolean(config.on_break);
}

function applyDemoConfig() {
  CURRENT_LEAGUE_CODE = null;
  TEAMS = DEFAULT_TEAM_NAMES.slice(0, DEFAULT_NUM_TEAMS).map((name, i) => ({ id: `t${i + 1}`, name, color: teamColorVar(i) }));
  ROSTER_SLOTS = DEFAULT_ROSTER_SLOTS;
  BUDGET = DEFAULT_BUDGET;
  TOTAL_SLOTS = TEAMS.length * ROSTER_SLOTS.length;
  MOCK_DRAFT = buildMockDraft();

  BOARD_NAME = "Auction Draft Board";
  SHOW_NEWS = true;
  SHOW_MESSAGES = true;
  SHOW_RECENT = true;
  SHOW_DRAFTED_TOTAL = true;
  SHOW_POSITION_TOTALS = false;
  SHOW_ELAPSED_TIME = false;
  NICE_ENABLED = false;
  SHOTS_COUNT = 0;
  SHOT_PICK_NUMBERS = [];
  ROAST_ENABLED = true;
  ON_BREAK = false; // demo mode has no backend to toggle a break against
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
      .select(
        "id, league_code, num_teams, budget, team_names, roster_slots, updated_at, board_name, show_news, show_messages, show_recent, show_drafted_total, show_position_totals, show_elapsed_time, nice_enabled, shots_count, shot_pick_numbers, roast_enabled, on_break"
      )
      .eq("league_code", leagueCode)
      .maybeSingle();
    if (error) {
      console.error("Failed to load league config from Supabase:", error);
      return null;
    }
    return data;
  },

  async createLeague({ leagueCode, pinHash, teamNames, budget, rosterSlots, boardOptions = {} }) {
    if (!supabaseClient) return { error: "Supabase isn't configured yet — see shared/supabase-config.js." };
    const { data, error } = await supabaseClient.rpc("create_league", {
      p_league_code: leagueCode,
      p_pin_hash: pinHash,
      p_num_teams: teamNames.length,
      p_budget: budget,
      p_team_names: teamNames,
      p_roster_slots: rosterSlots,
      p_board_name: boardOptions.boardName || "Auction Draft Board",
      p_show_news: boardOptions.showNews !== false,
      p_show_messages: boardOptions.showMessages !== false,
      p_show_recent: boardOptions.showRecent !== false,
      p_show_drafted_total: boardOptions.showDraftedTotal !== false,
      p_show_position_totals: Boolean(boardOptions.showPositionTotals),
      p_show_elapsed_time: Boolean(boardOptions.showElapsedTime),
      p_nice_enabled: Boolean(boardOptions.niceEnabled),
      p_shots_count: Number(boardOptions.shotsCount) || 0,
      p_shot_pick_numbers: boardOptions.shotPickNumbers || [],
      p_roast_enabled: boardOptions.roastEnabled !== false,
    });
    if (error) return { error: error.message };
    return { error: null, id: data };
  },

  async updateLeague({ leagueCode, pinHash, teamNames, budget, rosterSlots, clearPicks = true, boardOptions = {} }) {
    if (!supabaseClient) return { error: "Supabase isn't configured yet — see shared/supabase-config.js." };
    const { data, error } = await supabaseClient.rpc("update_league", {
      p_league_code: leagueCode,
      p_pin_hash: pinHash,
      p_num_teams: teamNames.length,
      p_budget: budget,
      p_team_names: teamNames,
      p_roster_slots: rosterSlots,
      p_clear_picks: clearPicks,
      p_board_name: boardOptions.boardName || "Auction Draft Board",
      p_show_news: boardOptions.showNews !== false,
      p_show_messages: boardOptions.showMessages !== false,
      p_show_recent: boardOptions.showRecent !== false,
      p_show_drafted_total: boardOptions.showDraftedTotal !== false,
      p_show_position_totals: Boolean(boardOptions.showPositionTotals),
      p_show_elapsed_time: Boolean(boardOptions.showElapsedTime),
      p_nice_enabled: Boolean(boardOptions.niceEnabled),
      p_shots_count: Number(boardOptions.shotsCount) || 0,
      p_shot_pick_numbers: boardOptions.shotPickNumbers || [],
      p_roast_enabled: boardOptions.roastEnabled !== false,
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
      .channel(`picks-changes-${CURRENT_LEAGUE_CODE}`)
      .on(
        // "*" (not just INSERT) so a pick undone elsewhere (DELETE) is
        // also noticed -- previously only new picks streamed in, and a
        // deletion needed a manual page refresh to show up.
        "postgres_changes",
        { event: "*", schema: "public", table: "picks", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` },
        () => cb()
      )
      .subscribe();
  },

  /* Fan shout-outs — posted from Team Picks (e.g. after scanning the
     Draft Board's QR code), shown highlighted in the Draft Board's news
     ticker. No PIN needed: unlike picks/setup this can't alter draft
     state, so it's open to anyone with the league code. */
  async sendMessage(text, options = {}) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const trimmed = text.trim().slice(0, 100);
    if (!trimmed) return { error: "Message can't be empty." };
    const { error } = await supabaseClient
      .from("board_messages")
      .insert({ league_code: CURRENT_LEAGUE_CODE, message: trimmed, loops: Number(options.loops) || 5 });
    if (error) return { error: error.message };
    return { error: null };
  },

  // Called once a message has been shown its full loop count -- removing
  // it server-side (not just from local state) means a page refresh
  // won't refetch and replay it, since loop progress is only ever
  // tracked in memory and getMessages() would otherwise treat it as
  // brand new again every time.
  async deleteMessage(id) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    await supabaseClient.from("board_messages").delete().eq("id", id).eq("league_code", CURRENT_LEAGUE_CODE);
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
    return data.map((row) => ({ id: row.id, text: row.message, loops: row.loops || 5, createdAt: new Date(row.created_at).getTime() }));
  },

  onMessage(cb) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    supabaseClient
      .channel(`board-messages-${CURRENT_LEAGUE_CODE}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_messages", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` },
        (payload) => cb({ id: payload.new.id, text: payload.new.message, loops: payload.new.loops || 5, createdAt: new Date(payload.new.created_at).getTime() })
      )
      .subscribe();
  },

  /* ---------------- Break mode + polls ----------------
     A break is just a flag on draft_config (see set_draft_break) --
     switching Draft Board over to the break screen and letting Team
     Picks show the poll. Polls themselves are separate rows (one league
     can only have one *active* poll at a time; starting a new one
     retires the last). Voting has no PIN -- it's public and anonymous,
     see LeagueSession.getVoterToken(). */
  async setBreak(onBreak, pinHash) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const { data, error } = await supabaseClient.rpc("set_draft_break", {
      p_league_code: CURRENT_LEAGUE_CODE,
      p_pin_hash: pinHash,
      p_on_break: onBreak,
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "Incorrect commissioner PIN." };
    return { error: null };
  },

  async createPoll(question, options, pinHash) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const { data, error } = await supabaseClient.rpc("create_poll", {
      p_league_code: CURRENT_LEAGUE_CODE,
      p_pin_hash: pinHash,
      p_question: question,
      p_options: options,
    });
    if (error) return { error: error.message };
    if (!data) return { error: "Incorrect commissioner PIN." };
    return { error: null, id: data };
  },

  async closePoll(pollId, pinHash) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return { error: "No active league." };
    const { data, error } = await supabaseClient.rpc("close_poll", {
      p_league_code: CURRENT_LEAGUE_CODE,
      p_pin_hash: pinHash,
      p_poll_id: pollId,
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "Incorrect commissioner PIN." };
    return { error: null };
  },

  async getActivePoll() {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return null;
    const { data, error } = await supabaseClient
      .from("polls")
      .select("*")
      .eq("league_code", CURRENT_LEAGUE_CODE)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Failed to load active poll:", error);
      return null;
    }
    if (!data) return null;
    return { id: data.id, question: data.question, options: data.options, createdAt: new Date(data.created_at).getTime() };
  },

  async getPollVotes(pollId) {
    if (!supabaseClient || !pollId) return [];
    const { data, error } = await supabaseClient.from("poll_votes").select("option_index, voter_token").eq("poll_id", pollId);
    if (error) {
      console.error("Failed to load poll votes:", error);
      return [];
    }
    return data.map((row) => ({ optionIndex: row.option_index, voterToken: row.voter_token }));
  },

  async submitPollVote(pollId, optionIndex) {
    if (!supabaseClient) return { error: "Supabase isn't configured yet." };
    const { data, error } = await supabaseClient.rpc("submit_poll_vote", {
      p_poll_id: pollId,
      p_option_index: optionIndex,
      p_voter_token: LeagueSession.getVoterToken(),
    });
    if (error) return { error: error.message };
    if (data === false) return { error: "This poll isn't active anymore." };
    return { error: null };
  },

  // Fires whenever draft_config changes for this league -- used to
  // notice on_break flipping without a manual refresh.
  onConfigChange(cb) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    supabaseClient
      .channel(`draft-config-changes-${CURRENT_LEAGUE_CODE}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "draft_config", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` },
        (payload) => cb(payload.new)
      )
      .subscribe();
  },

  // Fires on any poll or poll_votes change for this league -- covers a
  // new poll starting, the active poll closing, and vote counts ticking
  // up live.
  onPollChange(cb) {
    if (!supabaseClient || !CURRENT_LEAGUE_CODE) return;
    supabaseClient
      .channel(`poll-changes-${CURRENT_LEAGUE_CODE}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls", filter: `league_code=eq.${CURRENT_LEAGUE_CODE}` }, () => cb())
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, () => cb())
      .subscribe();
  },
};

/* One-liner NFL facts for the Draft Board's break screen -- static and
   local (not fetched), so they show up instantly with zero network
   dependency during a break. */
const NFL_FUN_FACTS = [
  "The Green Bay Packers are the only publicly-owned, nonprofit team in the four major U.S. pro sports leagues.",
  "The NFL was founded in 1920 in a car dealership showroom in Canton, Ohio.",
  "The Super Bowl trophy is named after Vince Lombardi, who never actually coached in a game called \"the Super Bowl.\"",
  "An NFL football is officially called \"The Duke,\" named after former Giants owner Wellington Mara's nickname.",
  "The longest field goal in NFL history is 66 yards, kicked by Justin Tucker in 2021.",
  "The Detroit Lions once played (and lost) a Thanksgiving game every year since 1934, except during WWII.",
  "Tom Brady was picked 199th overall in the 2000 NFL Draft -- six quarterbacks were taken before him.",
  "The shortest player in NFL history, Jack \"180\" Shapiro, was listed at 5'1\".",
  "The Chicago Bears and Arizona Cardinals are the NFL's two oldest franchises, both dating to 1898 and 1920 respectively as different sports clubs.",
  "An NFL game ball is used for only about one play before officials swap it out in cold or wet weather.",
  "The NFL didn't allow the forward pass until 1906, and it wasn't common until the 1930s.",
  "The Miami Dolphins' 1972 team remains the only perfect season (17-0) in NFL history.",
  "Instant replay review was first used by the NFL in 1986, removed in 1992, then reinstated in 1999.",
  "The two-point conversion wasn't adopted by the NFL until 1994 -- college football had it since 1958.",
  "A regulation NFL football weighs between 14 and 15 ounces, about the same as a can of soup.",
  "The Pro Football Hall of Fame is in Canton, Ohio because that's where the NFL (as the APFA) was founded.",
  "NFL kickers make roughly 85% of field goal attempts league-wide in a given season.",
  "The term \"Hail Mary\" pass was popularized by Roger Staubach after a 1975 playoff touchdown.",
  "Overtime in the NFL used to be strictly sudden death until a 2010 rule change added conditions for possession.",
  "The Buffalo Bills lost four consecutive Super Bowls from 1991 to 1994 -- a record no team wants to match.",
  "An NFL season used to be just 12 games long until it expanded to 14 in 1961, then 16 in 1978, then 17 in 2021.",
  "The widest halftime show TV audience ever recorded belongs to Super Bowl LVIII's 2024 broadcast.",
  "NFL referees run an average of about 4 miles during a single game.",
  "The Cleveland Browns are named after their first head coach, Paul Brown, not a color scheme.",
  "Deion Sanders is the only athlete to play in both a Super Bowl and a World Series.",
];

/* Folds any picks logged on Player Entry (via DraftStore) into MOCK_DRAFT
   so the Draft Board / Team Picks views reflect them. Call once on load
   (after configReady) and again whenever DraftStore.onChange fires. */
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
  if (!supabaseClient || !CURRENT_LEAGUE_CODE) return false; // demo mode has no server to sync against

  let changed = false;
  const serverPicks = await DraftStore.getPicks();
  const serverIds = new Set(serverPicks.map((p) => p.id));

  // Drop any locally-held pick the server no longer has -- e.g. undone
  // from a different device/tab. Without this, Draft Board/Team Picks
  // only ever reflected new picks and needed a manual page refresh to
  // notice a deletion.
  for (let i = MOCK_DRAFT.picks.length - 1; i >= 0; i--) {
    const local = MOCK_DRAFT.picks[i];
    if (!serverIds.has(local.id)) {
      MOCK_DRAFT.picks.splice(i, 1);
      const roster = getTeamRoster(local.teamId);
      if (roster && roster.slots[local.slotIndex] && roster.slots[local.slotIndex].id === local.id) {
        roster.slots[local.slotIndex] = null;
      }
      changed = true;
    }
  }

  // Add any server pick not yet reflected locally.
  serverPicks.forEach((lp) => {
    if (MOCK_DRAFT.picks.some((p) => p.id === lp.id)) return;
    const roster = getTeamRoster(lp.teamId);
    if (!roster) return;
    const slotIndex = findOpenSlotIndex(roster, lp.position);
    if (slotIndex === -1) return;
    const pick = { id: lp.id, pickNumber: MOCK_DRAFT.picks.length + 1, teamId: lp.teamId, slotIndex, name: lp.name, position: lp.position, price: lp.price, loggedAt: lp.loggedAt };
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

/* ---------- live NFL betting odds for the Draft Board ticker ----------
   ESPN's public scoreboard endpoint (the same one their own site uses)
   sends Access-Control-Allow-Origin: * and includes a game's spread/
   over-under once a sportsbook has posted odds for it -- no API key,
   no backend, no scraping. There's no free, keyless, CORS-friendly
   endpoint for full-season futures odds (win totals, Super Bowl odds,
   etc.) from ESPN or DraftKings, so this covers upcoming-week game
   lines only; it naturally returns nothing in the deep offseason before
   books have posted lines for the next slate. */
const ODDS_FEED_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

async function fetchBettingOdds() {
  const headlines = [];
  try {
    const res = await fetch(ODDS_FEED_URL);
    if (!res.ok) return headlines;
    const data = await res.json();
    (data.events || []).forEach((event) => {
      const comp = event.competitions && event.competitions[0];
      const odds = comp && comp.odds && comp.odds[0];
      if (!odds || !odds.details) return;
      const competitors = comp.competitors || [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      const matchup =
        home && away
          ? `${away.team.abbreviation} @ ${home.team.abbreviation}`
          : event.shortName || "Upcoming game";
      const ouText = odds.overUnder ? ` · O/U ${odds.overUnder}` : "";
      headlines.push(`🎲 ${escapeHtml(matchup)}: ${escapeHtml(odds.details)}${ouText}`);
    });
  } catch (e) {
    console.warn("Failed to fetch betting odds:", e);
  }
  return headlines;
}
