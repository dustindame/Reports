# Bid Board (phone app)

Wraps Draft Setup, Bid Board (the pick-entry screen, `player-entry.html`),
and Team Picks (all reachable from each other already) in an
installable Android app. It's a thin native
shell — `capacitor.config.json` points it at the live GitHub Pages
site, so it always shows the current version with zero rebuilds.

## Prerequisites

- [Node.js](https://nodejs.org) (LTS) — needed to run the Capacitor CLI.
  Not required after the Android project is generated; you won't need
  it again unless you change `capacitor.config.json`.
- Android Studio (already installed).

## One-time setup

Run these from this folder (`android-phone-app/`) in a terminal:

```
npm install
npx cap add android
npx cap sync android
```

`cap add android` generates the native `android/` project (not
committed to git — it's derived from `capacitor.config.json` and can
always be regenerated). `cap sync` copies the config into it.

**Required manual patch after `cap add android`:** replace the generated
`android/app/src/main/java/com/dustindame/draftentry/MainActivity.java`
with the current real version below — this file isn't committed
(nothing under `android/` is), so it has to be reapplied any time the
native project is regenerated from scratch. Also register
`ProBillingPlugin` (see its own section further down) if that's been
added by the time you're reading this.

```java
package com.dustindame.draftentry;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ProBillingPlugin.class);
        super.onCreate(savedInstanceState);
        // This is a live, frequently-updated web app -- default WebView
        // HTTP caching can keep showing a stale version after a real
        // deploy (this has actually happened -- a CSS change needed a
        // manual Force Stop + Clear Cache to show up). Always hit the
        // network instead.
        this.bridge.getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);

        // Targeting API 35 (Android 15) makes edge-to-edge display
        // mandatory -- see the "Status bar inset fix" section below for
        // the full history of getting this right.
        View rootContent = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootContent, (view, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
        // See fix attempt #3 below -- without this, the listener above
        // misses the one automatic insets dispatch that happens on a
        // fresh launch and never fires again on its own.
        ViewCompat.requestApplyInsets(rootContent);
    }
}
```

**A second required patch, same root cause, in `node_modules` this
time:** the installed AGP version also rejects the *old-style*
`getDefaultProguardFile('proguard-android.txt')` used inside the
Capacitor plugin modules themselves (confirmed via a real `assembleDebug`
run — this fails the build otherwise, it's not optional). In both:
- `node_modules/@capacitor/android/capacitor/build.gradle`
- `node_modules/@capacitor/app/android/build.gradle`

change:
```
proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
```
to:
```
proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
```

Since these live in `node_modules` (also not committed, and wiped by
`npm install`), re-check for and reapply this any time dependencies
are reinstalled — search for `getDefaultProguardFile('proguard-android.txt')`
across `node_modules` if a build fails with this exact error again;
there may be additional plugin modules by then that need the same fix.

**Verified:** `.\gradlew.bat assembleDebug` completes with `BUILD
SUCCESSFUL` after both patches above are applied, confirmed 2026-07-31.

**A third required patch, also lost on `cap add android`:** Google Play
requires the app to declare the `BILLING` permission before it'll let
you create an in-app product in Play Console, which only happens by
actually depending on the Play Billing library. In
`android/app/build.gradle`, inside the `dependencies { }` block, add:
```
implementation "com.android.billingclient:billing:7.1.1"
```
(check for a newer version at release time). This alone gets the
`BILLING` permission merged into the manifest automatically -- no
manual `AndroidManifest.xml` edit needed. The actual purchase-flow
code (calling the billing client, setting
`window.NATIVE_PRO_UNLOCKED`) is separate and still needs to be
written; this patch only unblocks creating the `pro_upgrade` product
in Play Console.

**Release signing, for building an actual uploadable AAB:** `build.gradle`
reads signing config from `android/keystore.properties` (gitignored,
lost on `cap add android` -- copy `android/keystore.properties.example`
to `android/keystore.properties` and fill in the real values). Points
at the upload key generated 2026-08-02, stored at
`G:\My Drive\Draft Board Backups\bidboard-upload-keystore.jks`, alias
`bidboard-upload` (store and key password are the same value, a PKCS12
quirk -- see the signing key section in `PROJECT_STATE.md`). Once that
file exists, `.\gradlew.bat bundleRelease` produces a signed AAB at
`android/app/build/outputs/bundle/release/app-release.aab`, ready to
upload to Play Console.

**Target SDK 35, then 36 -- this number moves forward roughly yearly,
expect to bump it again:** Play rejected the first upload (2026-08-03)
requiring API 35; rejected again (2026-08-06) requiring API 36
("target API level not within 1 year of latest Android release, effective
Aug 30 2026"). `android/variables.gradle`'s `compileSdkVersion`/
`targetSdkVersion` are now both `36`. Built cleanly both times with no
other changes needed (each new SDK Platform was already installed
locally) -- but don't assume that stays true forever; check for
required local SDK Platform installs if a future bump fails to
resolve.

**`versionCode` must increase on every upload** -- Play Console rejects
a re-upload of a version code it's already seen, even for a failed/draft
release. Managed via a single `appVersionCode` variable at the top of
`android/app/build.gradle` (also drives `versionName`, e.g. `1.0.12`,
so the installed version is always visible via Android's own
Settings → Apps → Bid Board → App details screen -- added 2026-08-08
specifically so "which build is actually on this phone" never has to
be guessed again). Bump it before every real upload.

**Status bar inset fix -- three attempts before this actually worked:**
- **Attempt #1 (2026-08-06)** attached the insets listener directly to
  `bridge.getWebView()`. Confirmed broken on a real device (versionCode
  5/6, installed via the actual Play Store update) -- header still
  covered. Root cause theory: `BridgeActivity` wraps the WebView inside
  its own internal layout, and Capacitor's own bridge can attach its
  own inset handling to that same view, silently overriding a listener
  set here.
- **Attempt #2 (2026-08-06)** moved the listener to
  `findViewById(android.R.id.content)` (the Activity's root content
  view) instead, reasoning it would receive real insets before
  Capacitor's internal layout exists. Shipped without a real device
  verification -- confirmed BROKEN on a real fresh install/reinstall
  2026-08-08 (the listener logic itself was fine, see attempt #3).
- **Attempt #3 (2026-08-08, current, see the full `MainActivity.java`
  above)** -- actual root cause: the system dispatches window insets
  once automatically as soon as the root view attaches, which happens
  inside `BridgeActivity`'s own `super.onCreate()` -- i.e. BEFORE
  attempt #2's listener gets attached. The listener was correct but
  silently missed the only dispatch that would ever fire on a fresh
  launch, and nothing re-triggers a second one on its own (which is why
  it could look intermittently "fixed" after something like a
  rotation, but never on first open). Fix: call
  `ViewCompat.requestApplyInsets(rootContent)` right after attaching
  the listener, forcing one explicit re-dispatch. **Not yet re-verified
  on a real device as of this writing** -- confirm on the next install
  before trusting this is finally resolved.

**Real Play Billing purchase flow, added 2026-08-04:** `ProBillingPlugin.java`
(a custom Capacitor plugin, `android/app/src/main/java/com/dustindame/draftentry/`)
and `shared/pro.js`'s `initNativeBilling()` / `purchase()`. The plugin
file itself and its one-line registration in `MainActivity.java` (also
inside `android/`) are **not tracked by git** (`android/` is entirely
gitignored) and must be manually recreated after a fresh
`cap add android` -- see git history / this README for the plugin's
full source if it's ever lost.

**Billing library bumped to `9.0.0`, 2026-08-06** (was `7.1.1`) --
Google requires v8.0.0+ by 2026-08-30 or app updates get rejected.
`com.android.billingclient:billing:9.0.0` requires `minSdk 23`
(`android/variables.gradle` was `22`, an already-ancient Android 5.1 --
bumped, no real users lost). The v9 API also changed shape from v7:
`enablePendingPurchases()` now needs a `PendingPurchasesParams` argument
(`.enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())`),
and `queryProductDetailsAsync`'s callback returns a
`QueryProductDetailsResult` object now, not a plain `List` -- call
`.getProductDetailsList()` on it. If bumping this library again in the
future, expect the API to have moved again; check the actual compiler
errors rather than assuming v7-era code still applies.

## Open and run

```
npx cap open android
```

This launches Android Studio with the project loaded. From there:
Run ▶ on a plugged-in phone (USB debugging enabled) or an emulator, or
**Build → Generate Signed Bundle / APK** to produce an installable
`.apk` you can sideload onto any Android phone (copy it over and open
it, or `adb install path/to/app-debug.apk`).

## App icon

The real icon (auction gavel + football + roster grid) is checked in at
`assets/icon.png` (1024x1024) — this is the source of truth, tracked in
git even though `android/` itself isn't. All actual density-specific
icon/splash files were generated from it via `@capacitor/assets` and
live under the (gitignored) `android/` folder, so **regenerate them any
time `android/` is recreated from scratch**:
```
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```
No splash-specific source was provided, so the icon image doubles as
the splash screen too — replace `assets/splash.png` (if one is added
later) and re-run the same command to give the splash its own image
instead.

To use a different icon going forward, replace `assets/icon.png` and
re-run the command above.

## If you ever change the site's URL or add a custom domain

Update `server.url` in `capacitor.config.json`, then re-run
`npx cap sync android`.
