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

**Required manual patch after `cap add android`:** this is a live,
frequently-updated web app, and default WebView caching can keep
showing a stale version after a real deploy (this has actually
happened — a CSS change needed a manual Force Stop + Clear Cache to
show up). Replace the generated
`android/app/src/main/java/com/dustindame/draftentry/MainActivity.java`
with:

```java
package com.dustindame.draftentry;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        this.bridge.getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
    }
}
```

This file isn't committed (nothing under `android/` is), so this patch
has to be reapplied any time the native project is regenerated from
scratch.

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

**Target SDK 35, also lost on `cap add android`:** Play Console rejected
the first upload (2026-08-03) with "must target at least API level 35"
-- `android/variables.gradle` originally set `compileSdkVersion` and
`targetSdkVersion` to `34`; bumped both to `35`. Built cleanly with no
other changes needed (SDK Platform 35 was already installed locally).

**`versionCode` must increase on every upload** -- Play Console rejects
a re-upload of a version code it's already seen, even for a failed/draft
release. Currently at `4` (in `android/app/build.gradle`'s
`defaultConfig`) as of the real Play Billing integration built
2026-08-04 -- bump it again before the next real upload.

**Real Play Billing purchase flow, added 2026-08-04:** see
`ProBillingPlugin.java` (custom Capacitor plugin, registered in
`MainActivity.java`) and `shared/pro.js`'s `initNativeBilling()` /
`purchase()`. This is tracked in git (not inside `android/`), so no
manual patch needed here beyond the `android/` files already covered
above (the plugin itself and its `MainActivity.java` registration line
DO live inside `android/` and would need reapplying after a fresh
`cap add android` -- see the plugin source for what to restore).

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
