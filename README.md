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

## Current state: static prototype, not a real product

As prototyped, this is a **static, disconnected mockup** — there's no real backend. To make it actually work as a live draft tool, a pick entered on the phone needs to show up on the TV in real time, across devices. That requires a shared data layer: a small backend (e.g. a lightweight API + database) or a realtime service like Firebase.

As a placeholder for that, `shared/data.js` includes a `DraftStore` object backed by `localStorage` plus an `applyLivePicks()` merge step. When `player-entry.html` confirms a pick, it's written to `localStorage`; `draft-board.html` and `team-picks.html` listen for storage changes and fold new picks into their view. This makes the three screens feel connected **when opened in tabs of the same browser** — it is not a substitute for a real shared backend, since `localStorage` doesn't sync across devices (a phone and a TV are never the same browser). Swapping `DraftStore` for real API/Firebase calls is the seam where that work would plug in.

The QR code on the Draft Board is a decorative, deterministically-generated pattern (see `shared/icons.js`) styled to read as a QR code — it links to `team-picks.html` for the demo, but doesn't encode a real payload since there's no hosted URL yet.
