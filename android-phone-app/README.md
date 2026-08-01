# Draft Entry (phone app)

Wraps Draft Setup, Draft Entry, and Team Picks (all reachable from
each other already) in an installable Android app. It's a thin native
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

## Open and run

```
npx cap open android
```

This launches Android Studio with the project loaded. From there:
Run ▶ on a plugged-in phone (USB debugging enabled) or an emulator, or
**Build → Generate Signed Bundle / APK** to produce an installable
`.apk` you can sideload onto any Android phone (copy it over and open
it, or `adb install path/to/app-debug.apk`).

## Changing the app icon / splash screen

Defaults come from Capacitor's template. To customize:
```
npm install -D @capacitor/assets
```
then follow [Capacitor's asset-generation guide](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
with your own `icon.png` / `splash.png` source images.

## If you ever change the site's URL or add a custom domain

Update `server.url` in `capacitor.config.json`, then re-run
`npx cap sync android`.
