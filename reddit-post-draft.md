# Reddit Post Draft — r/AlphaAndBetaUsers (and similar)

Updated 2026-08-12 — full rewrite covering the live web version, current Android beta status, Pro clarification, and what's coming next.

---

**[Web + Android Beta] Bid Board — Live Fantasy Football Auction Draft Tracker**

**Try it now, no install:** https://reports.bidboard.workers.dev

### What it does

Bid Board tracks a fantasy football **auction draft** live — not a snake/turn-based draft, the "anyone can bid on anyone, whenever" format. One person (or several, at once) logs picks from a phone: search the player, tap the winning team, slide to the bid amount, confirm. It shows up instantly on a big-screen display and on everyone else's phones — no spreadsheet, no shouting bids across the room, no "wait, did that save?"

Three screens, all synced live:
- **Bid Board** — the phone screen you actually log picks from.
- **Draft Board** — the big-screen display (TV, laptop over HDMI, any browser). Shows every team's roster and budget.
- **Team Picks** — a read-only phone view so anyone can check any team's roster, just by scanning a QR code off the TV.

### How to set it up right now

1. Go to https://reports.bidboard.workers.dev/setup.html
2. Pick team count (6–14), starting budget, roster positions (yes, Kicker and Superflex are supported), team names. Set a commissioner PIN.
3. You get a **league code** (share this — lets anyone *view* the draft) and the **PIN** (keep this with whoever's logging picks — it's needed to *write* anything).
4. Open **Bid Board** on the phone doing entry, **Draft Board** on the TV/laptop, **Team Picks** on everyone else's phones. Enter the league code (and PIN, for Bid Board) when asked.
5. Draft.

No installs required for any of this — it's all just a website. There's also a real Android app in closed testing on Google Play right now (link below if you want to try it and help it graduate out of that phase) — same experience, wrapped as an installable app.

### Nuances worth knowing before you draft with it

- **League code = view access. PIN = edit access.** Share the code freely; only give the PIN to whoever's actually logging picks.
- **Once the first pick is logged, team count/budget/roster positions lock** — this protects against someone fat-fingering a setting mid-draft and scrambling everything already drafted. Everything cosmetic (board name, display toggles, fun extras) stays editable anytime.
- **Free-text player entries need consistent spelling.** If a player isn't in the built-in list, you can add them manually — but "AJ Smith" and "A.J. Smith" count as two different players to the duplicate-pick check. Stick to one spelling.
- **No server-side budget enforcement.** It won't stop you from technically overbidding — this is a trust-based tool for actual live drafts, not a locked-down system fighting you.
- **Leagues aren't kept forever.** Free leagues clear out after 7 idle days (14 if the draft's marked complete). There's a one-tap "Download Recap" image if you want a permanent copy before that happens.
- **No account needed to use any of this.** Optional Google Sign-In exists only for the Pro purchase (so it can follow you across devices/browsers) — everything else works with just the league code.
- **Try before you commit** — there's a demo mode with fake data if you just want to poke around the UI first.

### About the $3.99 Pro upgrade — read this part

**Pro does NOT limit your ability to run a real draft in any way.** Free already includes up to 14 teams, every roster position, and the full live-sync experience — there's no team cap, no roster restriction, nothing gating the actual drafting.

Pro is purely **fun extras on top**: a post-draft Recap page (spend charts, stat leaders, and an optional savage AI-generated roast of everyone's draft), a Break Screen (trivia/odds/leaders for pauses), Fan Messages on the ticker, and a couple of small novelty touches. It's a one-time purchase, not a subscription, and it unlocks for the whole league — anyone with the league code gets Pro features too, not just whoever paid.

### What's coming

- **The Android app is in closed testing on Google Play** — needs a batch of real testers to run for 14 days before it can go fully public. If you install it and just open it once, that genuinely helps (link below).
- **A Fire TV / Android TV app (Draft Board) is submitted to the Amazon Appstore**, pending review — turns any Fire TV into the big-screen display with zero setup beyond entering a league code.
- Once both clear their respective review processes, this becomes a normal install from either store — until then, the web version is the fastest way to actually use it today.

**Android beta opt-in:** [your opt-in link here]
**Web version (works right now):** https://reports.bidboard.workers.dev

---

## Where to post it
1. **r/AlphaAndBetaUsers** — the primary target, built exactly for this.
2. **r/AndroidApps** — check rules first, some restrict self-promo to specific threads/days.
3. Relevant Discord servers ("app beta testers," "indie app testing").

## Other tester sources
- Your own fantasy league group chats — highest-conversion, do this first.
- Fantasy football Discord servers — ask in general chat, most are fine with a genuine "I built this" post.
- r/fantasyfootball / r/DynastyFF — check self-promotion rules; if they have a weekly/monthly thread for this, it's a highly relevant audience.
- Facebook fantasy football groups — often more casual about this than Reddit.

## Reminder for whoever posts this
- Swap in the real opt-in link before posting (Play Console → Testing → Closed testing → your track → Testers tab → "How testers join").
- The web link needs zero swapping — it's already live.
