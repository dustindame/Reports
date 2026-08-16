# Reddit Post Draft — r/AlphaAndBetaUsers (and similar)

Updated 2026-08-16 — Fire TV confirmed live (downloaded and tested), live Stripe purchases confirmed working, Amazon/Android links removed since Amazon just needs an app-name search and Android isn't in production yet, plus added explicit limitations (5-league free cap, retention timing, "this is new" honesty section).

---

**[Web + Fire TV] Bid Board — Live Fantasy Football Auction Draft Tracker**

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

No installs required for any of this — it's all just a website. There's also a real, live Fire TV app for the big-screen display — search **"Draft Board"** on the Amazon Appstore. Mix and match whichever pieces work for your setup (see below).

### Ways to actually use this

Every screen talks to the same league code, so you can mix web and app however fits your setup:

- **All web, no installs** — open Bid Board and Draft Board in browser tabs (phone + laptop/TV). Fastest way to just try it tonight.
- **Web entry + Fire TV display** — log picks from Bid Board in a phone browser, show Draft Board on an actual Fire TV via the app. No install needed on the phone side at all.
- **Both apps** — Bid Board installed on the phone, Draft Board installed on Fire TV, once you're using them regularly.

Nothing about the league or picks cares which combination you use — it's all the same live data either way.

### Getting Draft Board onto a TV that doesn't have the app

If you don't have (or don't want) the Fire TV app yet, Android TV / Fire TV doesn't ship with a normal web browser by default, so "just open the website" isn't one-click there like it is on a phone or laptop. A few real options:

- **Cast a browser tab** from your phone or laptop to the TV (Chromecast, or a Fire TV's own screen-mirroring) — open Draft Board in Chrome, cast the tab.
- **HDMI from a laptop** — plug in directly, open the site in any browser, done.
- **A smart TV with its own built-in browser** (some Samsung/LG TVs have one) — just open it there directly.
- **Sideload a browser app onto Fire TV** — Amazon Appstore has a few (Silk Browser, etc.) that install directly on Fire TV like any other app, letting you open the site without the dedicated Draft Board app at all.

Once you have the actual Fire TV app installed, none of this is needed — it's a one-time league-code entry and it just works.

### Nuances worth knowing before you draft with it

- **League code = view access. PIN = edit access.** Share the code freely; only give the PIN to whoever's actually logging picks.
- **Once the first pick is logged, team count/budget/roster positions lock** — this protects against someone fat-fingering a setting mid-draft and scrambling everything already drafted. Everything cosmetic (board name, display toggles, fun extras) stays editable anytime.
- **Free-text player entries need consistent spelling.** If a player isn't in the built-in list, you can add them manually — but "AJ Smith" and "A.J. Smith" count as two different players to the duplicate-pick check. Stick to one spelling.
- **No server-side budget enforcement.** It won't stop you from technically overbidding — this is a trust-based tool for actual live drafts, not a locked-down system fighting you.
- **Up to 5 leagues per device on the free tier.** Tracked per browser/app, not per person — creating a 6th just quietly drops the oldest one from your saved list rather than blocking you.
- **Leagues aren't kept forever.** Free leagues clear out after **7 idle days** (14 if the draft's marked complete). Pro leagues last **60 idle days**. There's a one-tap "Download Recap" image if you want a permanent copy before that happens — this applies to everyone, Pro or not.
- **No account needed to use any of this.** Optional Google Sign-In exists only for the Pro purchase (so it can follow you across devices/browsers) — everything else works with just the league code.
- **Try before you commit** — there's a demo mode with fake data if you just want to poke around the UI first.

### This is genuinely new — a couple of honest caveats

- This app is very early. It's been tested carefully, but it hasn't been through a real season with a large number of live drafters yet — treat it as a solid, functional tool, not a battle-hardened one.
- **There is currently no way to recover a lost league code or PIN yourself** — if you lose both, that league is genuinely gone (the PIN is a one-way hash, not stored anywhere reversible, by design). Keep them written down somewhere until this improves.
- Data is backed up automatically, but only **weekly**, not continuously — this is a small solo project, not an enterprise product with real-time redundancy. Don't treat it as a permanent historical record; download your Recap if you want to keep it.

### About the $3.99 Pro upgrade — read this part

**Pro does NOT limit your ability to run a real draft in any way.** Free already includes up to 14 teams, every roster position, and the full live-sync experience — there's no team cap, no roster restriction, nothing gating the actual drafting.

Pro is purely **fun extras on top**: a post-draft Recap page (spend charts, stat leaders, and an optional savage AI-generated roast of everyone's draft), a Break Screen (trivia/odds/leaders for pauses), Fan Messages on the ticker, and a couple of small novelty touches. It's a one-time purchase, not a subscription, and it unlocks for the whole league — anyone with the league code gets Pro features too, not just whoever paid.

### What's coming

- **Android apps for both phone and TV are on track to release in about a week**, via Google Play. The web version and the Fire TV app both work today regardless of that timeline, so there's no need to wait to actually start using this.

**Fire TV app:** search "Draft Board" on the Amazon Appstore
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
- Fire TV app is confirmed live (downloaded and tested directly) — search "Draft Board" on the Amazon Appstore.
- Web link needs zero swapping — it's already live, and the live Stripe purchase path has been tested and confirmed working.
- No Android link needed yet — not in production, not mentioned as something to test right now.
