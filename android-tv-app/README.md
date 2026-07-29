# Draft Board TV (Fire TV / Android TV app)

A minimal native Android app — a fullscreen `WebView` pointed at the
live Draft Board page. No Node/npm needed; this is a plain Gradle
project.

The Draft Board is a passive, auto-updating display (not something you
navigate with a remote), so a WebView is enough — no Leanback browse
UI or D-pad focus handling to build.

## Open and run

1. Open Android Studio → **Open** → select this `android-tv-app/`
   folder.
2. Let Gradle sync (first sync downloads dependencies, takes a few
   minutes).
3. **Build → Generate Signed Bundle / APK → APK** to produce an
   installable `.apk`, or plug in a Fire TV / Android TV device with
   ADB debugging enabled and hit Run ▶.

## Installing on an actual Fire Stick

Fire TV doesn't have Google Play by default, so you'll sideload:

1. On the Fire TV: Settings → My Fire TV → Developer Options → turn on
   **ADB Debugging** and **Apps from Unknown Sources**.
2. Find its IP address: Settings → My Fire TV → About → Network.
3. From a computer on the same network, with `adb` installed (it ships
   with Android Studio, under
   `<Android Studio SDK path>/platform-tools`):
   ```
   adb connect <fire-tv-ip>:5555
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
4. Find "Draft Board" under Fire TV's apps/channels.

## Setting your league code

Right now `MainActivity.kt` hardcodes the URL to
`https://dustindame.github.io/Reports/draft-board.html` with no league
code, so it'll prompt for one on first launch (same as opening that
URL in a browser) — you'll need to re-enter it if the app is ever
force-stopped and Chrome's WebView data gets cleared, since there's no
persistent settings screen yet.

**To skip that entirely**, once you know your league code, change the
`DRAFT_BOARD_URL` constant in `MainActivity.kt` to:
```
https://dustindame.github.io/Reports/draft-board.html?league=YOURCODE
```
rebuild, and the TV boots straight into your league every time.

## Known placeholders to replace before this looks "finished"

- `app/src/main/res/drawable/tv_banner.xml` — the launcher banner is a
  plain colored placeholder, not real branded art. Android TV banners
  are conventionally a 320×180 PNG; replace this file with a real
  `drawable-xhdpi/tv_banner.png` (delete the `.xml` version) once you
  have artwork.
- `ic_launcher_background.xml` / `ic_launcher_foreground.xml` — same
  story for the app icon.
