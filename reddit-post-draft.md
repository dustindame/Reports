# Reddit Post Draft — r/AlphaAndBetaUsers (and similar)

Updated 2026-08-16 — trimmed to an actual Reddit-length post (the previous version had grown into a full FAQ). The detailed nuances now live on the site itself / this doc's appendix below, not in the post.

---

## THE ACTUAL POST

**[Web + Fire TV] Bid Board — Live Fantasy Football Auction Draft Tracker**

Try it now, no install: https://reports.bidboard.workers.dev

Bid Board tracks a fantasy football **auction draft** live — not snake/turn-based, the "anyone can bid on anyone, whenever" format. Log picks from your phone, watch them show up instantly on a TV display and everyone else's phones. No spreadsheet, no shouting bids across the room.

**Quick start:** Setup a league on any device → get a code + PIN → open Bid Board (phone, for entry), Draft Board (TV/laptop, for display), Team Picks (phone, read-only roster lookup). Everything free with no signup.

**Free covers a full real draft** — up to 14 teams, every roster position, live sync, no team cap. A one-time $3.99 Pro unlock adds fun extras (post-draft recap with stat charts and an AI roast, a break screen, fan messages) — doesn't gate the actual drafting.

**Fire TV app is live** — search "Draft Board" on the Amazon Appstore for the big-screen display. Android (phone + TV) is about a week out via Google Play; the web version and Fire TV both work today regardless.

This is a solo-built, genuinely new project — feedback and bug reports very welcome.

---

## Appendix: nuances (for replies / your own reference, not the post itself)

- League code = view access, PIN = edit access (can't be recovered if lost).
- Team count/budget/roster lock once the first pick is logged; everything cosmetic stays editable.
- Custom player entries need consistent spelling for duplicate-pick detection.
- No server-side budget enforcement — trust-based for real live drafts.
- Up to 15 leagues per device; oldest quietly drops off if you exceed it.
- Leagues auto-clear after 30 idle days (download the Recap image first if you want a permanent copy).
- Data backups run every 2 hours, not continuously — this is a small solo project.
- Getting Draft Board onto a TV without the app: cast a browser tab, HDMI from a laptop, a smart TV's own browser, or sideload a browser app on Fire TV (it has no built-in one).

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
