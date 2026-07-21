# Fantasy Auction Draft

A multi-screen system for running a live fantasy football auction draft, with real-time sync across devices via Supabase.

- **`setup.html`** — the commissioner configures a league before it starts: 6–14 teams, a custom budget, a custom roster/lineup (slot counts per position), and team names. Generates a shareable **league code** and a **commissioner PIN**.
- **`player-entry.html`** — phone screen used by whoever is running the draft to log each pick: search the player, tap the winning team, slide to the winning bid, confirm. Requires the league's PIN.
- **`draft-board.html`** — wide TV-facing display showing every roster, team budgets, recent picks, a clock, a real scannable QR code, and a live NFL news ticker.
- **`team-picks.html`** — the page the Draft Board's QR code links to, so anyone can scan it and check any team's roster/budget on their own phone.
- **`index.html`** — a landing page linking to the above.

All pages share a dark theme, gold accent color, up to 14 team colors, and four position colors (QB dark red, RB blue, WR green, TE orange/yellow) — see `shared/theme.css`.

## Running it

Static files, no build step. Serve the folder and open `index.html`:

```
python3 -m http.server 8000
```

## Leagues: codes for viewing, a PIN for writing

Multiple leagues/drafts can exist side by side. Each is identified by a short, shareable **league code** (e.g. `BLZ4K2`), generated in `setup.html` when a league is created:

- **Viewing** a league (Draft Board, Team Picks, or just opening Enter Pick) only needs the code. `shared/league-gate.js` prompts for it if none is remembered (checks a `?league=` URL param, then `localStorage`), with a "use the demo instead" way out. The Draft Board's QR code encodes the code directly (`team-picks.html?league=CODE`), so scanning it needs no typing.
- **Writing** to a league (logging a pick, editing its setup) additionally requires the commissioner's PIN, chosen when the league is created. This is checked **server-side** — see below — not just hidden behind a client-side prompt, so a leaked league code alone can never let someone alter a draft.
- Both are remembered per device: the league code in `localStorage` (long-term — that's the "set it up ahead of time, pick it back up on your phone" part), the unlocked PIN in `sessionStorage` (cleared when the browser tab closes, so the commissioner isn't retyping it for every single pick but does need it again next session).

If no league is selected, the app falls back to a local-only demo: 12 named teams, a $200 budget, a 13-slot roster, and a deterministic seeded mock draft — no real backend row involved, and confirming a pick here just simulates locally (there's nothing real to save it to).

### How the PIN check actually works

A PIN prompt in the UI is not, by itself, security — anyone can call the Supabase REST API directly regardless of what the frontend shows. The real enforcement lives in `supabase/migrations/`:

- `draft_config` and `picks` have **no direct insert/update/delete grants** for the `anon` key. All writes go through `SECURITY DEFINER` Postgres functions (`create_league`, `update_league`, `submit_pick`, `verify_pin`) that check a SHA-256 hash of the PIN against the stored `commish_pin_hash` *in the database* before doing anything. The plaintext PIN is never sent to or stored in Supabase — only its hash (computed client-side via `sha256Hex()` in `shared/data.js`, using the Web Crypto API).
- `commish_pin_hash` itself is never exposed to `anon` reads either — Postgres column-level `GRANT` limits `SELECT` on `draft_config` to the non-secret columns.

**Honest limitation**: this is real server-side enforcement, but it isn't brute-force-hardened — there's no rate limiting on PIN guesses. That's a reasonable trust level for a friends-and-family hobby app, not for anything that needs to resist a determined attacker.

## Supabase setup

- **`supabase/migrations/`** — creates `draft_config` and `picks`, the RLS policies and column grants described above, the four `SECURITY DEFINER` functions, and adds `picks` to the `supabase_realtime` publication. If the GitHub repo is connected to the Supabase project for migrations, merging to `main` auto-applies these; otherwise run them by hand via the Supabase SQL Editor.
- **`shared/supabase-config.js`** — the project URL and anon public key. The anon key is meant to be public (it's what ships to every browser); access is enforced by the RLS/grants above, not by keeping this secret. Never put a `service_role` key here.
- **`shared/data.js`** — `DraftStore` wraps all reads/writes (`getConfig`, `createLeague`, `updateLeague`, `submitPick` via `addPick`, `verifyPin`, `getPicks`, `onChange` for Realtime). `applyLivePicks()` folds new picks into the in-memory draft state, deduped by row id.

All pages load the Supabase JS client from a CDN (`@supabase/supabase-js@2`) before `shared/data.js`. If `shared/supabase-config.js` still has its placeholder values, `DraftStore` no-ops with a console warning rather than throwing.

## Draft Board extras

- **QR code**: a real scannable code (via the `qrcode-generator` library, loaded from a CDN), not a decorative placeholder — encodes the Team Picks URL plus the current league code.
- **News ticker**: real NFL headlines fetched directly from ESPN's and CBS Sports' public RSS feeds (both send `Access-Control-Allow-Origin: *`, so no proxy/backend is needed), refreshed every 10 minutes. Falls back to a small static headline list if the fetch fails (offline, feed down, etc). Betting odds are intentionally not included — there's no free, keyless odds feed; adding real odds would need signing up for a free-tier API key (e.g. The Odds API).
