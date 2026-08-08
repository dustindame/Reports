# Bid Board / Draft Board — Troubleshooting & Support Playbook

Written 2026-08-08. This is an operational reference, not code documentation — the goal is that if a real customer messages you with a problem (especially mid-draft, when you have almost no time to think), you can find the fix here in under a minute instead of re-deriving it from scratch. Organized by symptom, not by system.

Where things live, if you need to go look yourself:
- Live site: `https://reports.bidboard.workers.dev/`
- Supabase project: `esoywmghcnvtauxzabvx` (dashboard → Table Editor, or SQL Editor for anything below)
- Code: `C:\Projects\Reports-work` (GitHub: `dustindame/Reports`)
- Full technical/architecture reference: `PROJECT_STATE.md` in the same folder

---

## 1. "My picks disappeared" / "A pick is wrong or missing"

**First, don't panic — picks live in the database (Supabase), not on any one device.** Nothing is lost just because a phone/TV screen looks wrong; that's almost always a display/sync issue, not a data-loss issue.

1. **Ask for the league code.** Every fix below needs it.
2. **Check what's actually in the database**, not what the screen shows:
   - Supabase dashboard → Table Editor → `picks` table → filter `league_code = THEIRCODE` → sort by `created_at`.
   - Compare this against what they say is missing/wrong. If the pick IS in the table correctly, this is a **display/sync problem**, not data loss — see Section 5 (sync issues) instead of touching the data.
3. **A pick really is missing** (not in the table at all): there's no undo-history table — the pick was either never submitted (a network failure during the tap) or was deleted (see below). Ask the commissioner to re-enter it; there is no way to "recover" a pick that never made it to the database, since none is generated until the write succeeds.
4. **A pick has the wrong team or wrong amount**: the commissioner can delete it from Bid Board (Settings → find pick → remove) and re-enter it correctly. There's no direct "edit" — remove-and-reenter is the only path, and it's a deliberate simplicity choice, not a missing feature. If the pick UI won't let them remove it, do it directly:
   ```sql
   delete from picks where id = 'THE_PICK_UUID';
   ```
   Get the UUID from Table Editor first — never delete by team/player name alone, you could hit the wrong row if there's ambiguity.
5. **"Someone drafted the same player twice"**: shouldn't be possible — there's a unique index on `(league_code, lower(trim(player_name)))`. If it happened anyway, the two entries almost certainly have different spellings (e.g. "AJ Brown" vs "A.J. Brown") — this is a known gap (free-text entries aren't fuzzy-matched). Delete the wrong one manually as above.
6. **Budget looks wrong for a team**: budget is computed live from `SUM(picks.bid_amount) WHERE team = X`, not stored directly — so if the picks table is correct, the budget shown is correct by definition. If it still looks wrong, that's a display bug, not a data bug — check Section 5 first (stale WebView), then check the math ($budget - sum of that team's bids) yourself against the picks table before assuming a code bug.
7. **A draft got wiped/reset entirely and shouldn't have**: check the automated weekly backups first before assuming permanent loss.
   - Backups live in a separate private repo: `https://github.com/dustindame/draft-board-backups` (folder `backups/`), one JSON snapshot per Sunday 9am UTC run, plus any on-demand runs.
   - Restore process: run `restore.js` in that repo (manual, upsert-based) pointed at the backup file closest to before the data loss. This assumes the schema already exists (it will, since migrations are unaffected by data loss).
   - **This only helps for damage from Sunday-to-Sunday** — anything drafted since the last backup and then lost has no recovery path. Be upfront about that if it comes up.

---

## 2. "I bought Pro but it's not showing / not unlocked"

Pro is a purchase that unlocks **the browser/device**, and separately gets written onto **the specific league** (`draft_config.is_pro`). Both matter — walk through in this order:

1. **Which platform did they buy on — web (Stripe) or the Android app (Google Play)?** Ask before doing anything; the fix path is different.

### Bought on the web (Stripe)
2. Check Stripe Dashboard → Payments — did the charge actually succeed? If it's not there or shows "failed," they weren't charged — Pro correctly isn't unlocked, this isn't a bug (see Section 3 for what to do about a failed/duplicate charge).
3. If the charge succeeded in Stripe but Pro isn't unlocked: check the webhook.
   - Stripe Dashboard → Developers → Webhooks → the endpoint pointed at `.../api/stripe-webhook` → look for the matching `checkout.session.completed` event → check its delivery status.
   - If it shows a failure/retry, that's the bug — Cloudflare Worker logs (`npx wrangler tail` while reproducing, or the Cloudflare dashboard's Logs tab) will show why (usually a Supabase write failure — check `SUPABASE_SERVICE_ROLE_KEY` is still valid, or a Stripe signature mismatch — check `STRIPE_WEBHOOK_SECRET` matches the endpoint's actual signing secret).
   - **Manual override if you need to unblock someone right now** while you debug the webhook: in Supabase Table Editor, directly set `draft_config.is_pro = true` for their `league_code`, and add a row to `pro_purchases` (`email`, `source = 'stripe'`) so future restores work too.
4. Confirm they're signed in with the **same Google account** on the browser where they expect to see Pro — the purchase is tied to the signed-in email, not the browser/device alone. A different browser/device signed into the same Google account should auto-restore via `/api/restore-purchase` on load; if it's not restoring, check that endpoint directly:
   ```
   curl -X POST https://reports.bidboard.workers.dev/api/restore-purchase -H "content-type: application/json" -d "{\"email\":\"their@email.com\"}"
   ```
   Should return `{"purchased":true}`. If `false` but Stripe shows a real charge, the webhook didn't write `pro_purchases` — same fix as step 3.

### Bought on the Android app (Google Play)
5. Check Google Play Console → the app → Monetize → Products → order history (or the account's Play Store purchase history directly) to confirm the charge went through.
6. If charged but Pro doesn't show: the native app calls `restore()` on load, which checks Play's own purchase records directly (not your database) — this should be reliable. If it's still not unlocking:
   - Ask them to force-close and reopen the app (not just background/foreground) — the WebView can cache a stale unlocked-state check.
   - Check `ProBillingPlugin.java`'s billing connection actually succeeded — a "Billing service not ready" error would show as a rejected promise; look at the app's logcat if you have device access (`adb logcat | grep ProBilling`).
7. **If they want this purchase usable on the web too** (cross-platform restore): as of 2026-08-08 this requires the purchase to have been registered via the optional post-purchase email prompt (`promptToRegisterPurchaseEmail` in `setup.js`) — if they skipped that prompt, there's no email on file to restore against on the web. You can register it after the fact if they give you the email and you can get their purchase token (not normally exposed to you directly — realistically, just re-prompt them to tap "Restore Purchase" in the app again, which re-surfaces the same registration prompt).
8. **Reminder**: as of 2026-08-08, native Google Sign-In does not exist yet — an app purchase can be *registered* for web use (if they used the prompt), but a *web* purchase cannot yet auto-restore *inside* the native app (that direction needs real native OAuth, not built yet). If someone reports this specific direction not working, that's expected, not a bug — explain it rather than debug it.

---

## 3. Refunds

### Stripe (web purchases)
1. Stripe Dashboard → Payments → find the charge (search by email or amount, $3.99) → **Refund**. Full refund is simplest and matches a $3.99 impulse-purchase product — don't overthink partial refunds.
2. **After refunding, manually revoke Pro** — Stripe refunding the charge does NOT automatically un-flip `is_pro` (there's no code listening for refund events yet). Do it directly in Supabase:
   ```sql
   update draft_config set is_pro = false where league_code = 'THEIRCODE';
   delete from pro_purchases where email = 'their@email.com';
   ```
   Skipping the second line only matters if you want to also block them from silently "restoring" it back — worth doing for an intentional refund, not worth stressing over for an edge case.
3. If several leagues need the same downgrade (unlikely at $3.99/one-time, but possible if they made multiple leagues), find them all first: `select league_code from draft_config where is_pro = true and ...` — there's no direct email→league link in `draft_config` itself (Pro is per-league, purchases are per-email), so you may need to ask them which league code(s) to fix, or accept that Pro persisting on an already-created league after a refund is a minor, low-stakes edge case at this price point.

### Google Play (app purchases)
4. Refunds for Play purchases go through **Google's** system, not yours — direct them to Google Play Store → Order history → the purchase → Report a problem / Request refund. You generally can't refund a Play purchase from Play Console at all within the first 48 hours (Google auto-approves most refund requests inside that window); after that, Play Console → Order management lets you issue one manually if Google support doesn't handle it.
5. Same manual downgrade as Stripe above — Google's refund does not automatically touch your Supabase `is_pro` flag either, since nothing currently listens for Play refund/voided-purchase notifications (a possible future improvement — Google's Real-time Developer Notifications, not built).

### General refund policy to quote if asked
- Both `terms.html` and `privacy.html` have the actual current policy text live — check those first if unsure of current wording (they've been updated since this playbook was written and are the source of truth, not this doc).

---

## 4. Lost league code or commissioner PIN

**There is no account system and no "forgot password" flow — this is a known, accepted limitation** (see `PROJECT_STATE.md` Section 5). Be upfront that recovery is limited, not evasive about it.

1. **Lost league code**: if they still have the browser/device that created it, `localStorage` remembers it (`league-gate.js`'s remembered-code logic) — have them just reopen the site/app normally. If that device is gone too, the ONLY recovery path is checking Supabase directly if you know enough to identify it (e.g. team names they remember, approximate creation date):
   ```sql
   select league_code, created_at from draft_config where created_at > 'YYYY-MM-DD' order by created_at desc;
   ```
   Match by team names/budget if there are multiple candidates. If you can't identify it this way, it's genuinely unrecoverable — say so.
2. **Lost commissioner PIN**: the PIN is stored as a SHA-256 hash server-side (`commish_pin_hash`), by design **not recoverable even by you** — this is a real security boundary, not a gap to route around. The only fix is resetting it directly in the database to a new known value, which requires generating a matching hash:
   - The hash function is plain SHA-256 of the PIN string (see `shared/data.js`'s `sha256Hex`) — you can compute one yourself (e.g. in a browser console: `crypto.subtle.digest('SHA-256', new TextEncoder().encode('newpin')).then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))`).
   - Then: `update draft_config set commish_pin_hash = 'THE_HASH' where league_code = 'THEIRCODE';`
   - Give them the new plain PIN directly (never store/send it insecurely, but a PIN isn't a high-value secret — a text message is fine for this app's actual risk level).

---

## 5. Display / sync issues (stale data, TV not updating, "it looks wrong on my phone")

**Rule of thumb: if the database is correct and only the screen is wrong, this category — don't touch data.**

1. **Stale WebView cache** (most common cause, both native apps): force-close the app fully (not just background it) and relaunch. Both apps disable HTTP caching in code, but a genuinely stuck WebView process can still hold old JS in memory until it's actually killed.
2. **Cloudflare edge cache right after a deploy**: if you just pushed a fix, give it a minute, or bypass with a throwaway query string (`?nocache=123`) to confirm the fix is actually live before assuming it isn't.
3. **Realtime subscription silently dropped** (rare, but happens on flaky wifi/long idle): the manual **Refresh** button on Draft Board/Bid Board is the user-facing fix — tell them to tap it. If it happens repeatedts for one specific league, check Supabase's Realtime status isn't degraded (status.supabase.com) — not something you can fix on your end if so.
4. **TV app specifically not updating**: confirm it's actually pointed at the current hosted URL (`draft-board.html`) — a very old install predating the Cloudflare migration would still be hitting the old GitHub Pages URL. Reinstalling from a fresh build fixes this permanently; there's no remote-config way to repoint an old install.
5. **Config change (settings edit) not propagating** to an already-open Draft Board/Bid Board: should auto-reload the page on any relevant change (`configHasOtherChanges()` in `shared/data.js`) — if it's not, manual Refresh is the fallback, same as #3.

---

## 6. Draft is "stuck" / can't submit picks / commissioner locked out

1. **PIN rejected but they're sure it's right**: PINs are case/whitespace-sensitive exactly as typed at creation — ask them to re-check for a leading/trailing space or autocapitalize issue on mobile keyboards. If truly lost, see Section 4.
2. **"Duplicate player" error on a real, correct pick**: means that exact player (by name string) is already in the picks table for that league — check Table Editor to confirm, then either it's a genuine duplicate attempt (explain) or a near-duplicate spelling collision (rare, but see Section 1 item 5) — actually no, the constraint blocks exact matches only, so if they're hitting this on a player they haven't drafted, check for a spelling variant already present and get them to match it or use free-text with a distinct enough label.
3. **Settings won't let team count/budget/roster change**: this is **intentional** once a league has any picks — `update_league` silently ignores changes to those specific fields to protect draft integrity mid-draft. Not a bug; explain rather than try to force it. If they genuinely need to change it mid-draft (rare, e.g. wrong initial setup caught early), the only path is a direct SQL update to `draft_config`, done carefully, understanding it could put existing picks in an inconsistent state (e.g. lowering budget below what's already spent) — think it through case by case, don't just run it blind.
4. **Draft won't "complete" / recap won't show**: check `draft_config.draft_completed` — it's a manual toggle, not automatic; the commissioner needs to actually set it (Settings → Draft Complete, or similar control) once all picks are in.
5. **Budget shows negative or a team went over budget**: there is genuinely no server-side enforcement of budget limits (client-side only, by design — see `PROJECT_STATE.md` Section 5) — if it happened, it happened for real (two simultaneous bids racing, or someone just overriding a client-side check). No automatic fix; it's a manual conversation with the commissioner about how they want to handle it (nothing in the data model prevents a pick above remaining budget from being deleted/corrected like any other pick, per Section 1).

---

## 7. "The league got deleted / disappeared on its own"

Leagues are cleaned up automatically after a period of inactivity — this is by design, not a bug, but can look alarming if someone didn't expect it:
- **Free leagues**: cleaned up after 7–14 days idle.
- **Pro leagues**: cleaned up after 60 idle days.
- The Recap page is generated live from picks, not stored separately — once a league's picks are gone, Recap is gone with them; there's a "Download Recap" button specifically as the permanent-copy safety net, but only if they used it beforehand.
- **If someone hits this and is upset**: check the weekly backup repo (Section 1, item 7) — if it happened recently enough to be in a Sunday snapshot, you can restore it. Otherwise, it's genuinely gone; be upfront rather than implying a recovery that doesn't exist.

---

## 8. General debugging toolkit (when nothing above matches)

- **See exactly what's live right now for a league**: Supabase Table Editor → `draft_config` (league settings + `is_pro`) and `picks` (every pick) filtered by `league_code`. This beats guessing from a screenshot every time.
- **See exactly what a specific person purchased**: `pro_purchases` table, filtered by email.
- **Tail live Worker logs while reproducing an issue**: `npx wrangler tail` from `C:\Projects\Reports-work`, then have the person (or you) trigger the action — shows real request/response/error data as it happens.
- **Check if a deploy actually went out**: compare the live site's behavior against the local repo's latest commit; when in doubt, just run `npx wrangler deploy` again — it's safe to re-run, idempotent.
- **Reproduce it yourself before assuming what's wrong**: use their league code directly (with permission) rather than theorizing from a description — most of these issues are five minutes of looking at real data, not guesswork.
- **When you truly can't tell if it's a data problem or a display problem**: check the database first, always. If the data's right, it's a display/sync bug (Section 5). If the data's wrong, don't try to "reload past it" — fix the data (Section 1) or explain the limitation (Sections 4/6/7).
- **Escalation for anything Google/Stripe-side that you can't fix directly**: Stripe has live chat support in-dashboard, generally fast. Google Play developer support is slower (community forums first, ticket support has real hold times) — set expectations with the customer accordingly if their issue routes there.

---

## 9. Things that are NOT bugs (say this instead of debugging)

A quick list so you don't burn time "fixing" intended behavior:
- No sound on pick confirmation — removed on purpose.
- Season Odds rotating instead of scrolling — intentional.
- Structural settings (team count/budget/roster) locked once a draft has picks — intentional, protects data integrity.
- Free tier capped at 2 saved leagues per device — intentional (Pro removes the cap).
- Recap/backup download buttons missing on the TV app specifically — intentional (nowhere for a TV to save a download to).
- A web-purchased Pro account not restoring inside the native Android app — expected, until native Google Sign-In is built (not yet, as of 2026-08-08).
- No way to edit a submitted pick directly (only remove + re-add) — intentional simplicity choice.
- Polls feature doesn't exist anymore even though old docs/screenshots might show it — deliberately removed 2026-08-03.
