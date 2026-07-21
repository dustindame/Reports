# Fantasy Auction Draft — Prototype

A two-screen system for running a live fantasy football auction draft.

- **`player-entry.html`** — phone screen used by whoever is running the draft to log each pick: search the player, tap the winning team, slide to the winning bid, confirm.
- **`draft-board.html`** — wide TV-facing display showing all 12 rosters, team budgets, recent picks, a clock, and a QR code, with NFL news/odds scrolling along the bottom.
- **`team-picks.html`** — the lightweight page the Draft Board's QR code links to, so anyone can scan it and check a team's roster on their own phone.
- **`index.html`** — a landing page linking to all three.

All three share a dark theme, gold accent color, the same 12 team names/colors, and the same four position colors (QB dark red, RB blue, WR green, TE orange/yellow) — see `shared/theme.css`.

## Running it

Static files, no build step. Serve the folder and open `index.html`:

```
python3 -m http.server 8000
```

## How the mock data works

`shared/data.js` deterministically generates a plausible mid-draft snapshot (12 teams, a real-ish player pool, partially filled rosters, realistic auction budgets) so the board and lookup page look populated on first load.

## Live sync: Supabase

A pick entered on `player-entry.html` needs to show up on `draft-board.html` (and `team-picks.html`) in real time, across devices — a phone and a TV are never the same browser, so `localStorage` (the original stand-in) couldn't do this. That's now backed by a real Supabase project:

- **`supabase/migrations/`** — creates the `picks` table (team, player, position, price, timestamp), opens it up to the `anon` key via Row Level Security policies (read + insert — there's no auth system, so this matches a shared-room trust model), and adds it to the `supabase_realtime` publication. If the GitHub repo is connected to the Supabase project, merging to `main` auto-applies these.
- **`shared/supabase-config.js`** — the project URL and anon public key. The anon key is meant to be public (it's what ships to every browser); access is enforced by the RLS policies above, not by keeping this secret. Never put a `service_role` key here.
- **`shared/data.js`** — `DraftStore.addPick()` inserts a row; `DraftStore.getPicks()` reads all rows; `DraftStore.onChange()` subscribes to `postgres_changes` INSERT events over Supabase Realtime. `applyLivePicks()` (now async) folds new rows into the deterministic mock draft, deduped by row id.

All three pages load the Supabase JS client from a CDN (`@supabase/supabase-js@2`) before `shared/data.js`. If `shared/supabase-config.js` still has its placeholder values, `DraftStore` no-ops with a console warning rather than throwing, so the pages still render the mock draft on their own.

The QR code on the Draft Board is a decorative, deterministically-generated pattern (see `shared/icons.js`) styled to read as a QR code — it links to `team-picks.html` for the demo, but doesn't encode a real payload since there's no hosted URL yet.
