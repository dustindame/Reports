package com.dustindame.draftboardtv

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

/**
 * The Draft Board is a passive, auto-updating display (like a
 * scoreboard) -- not something you navigate with a remote -- so a
 * fullscreen WebView pointed at the live page is enough. No Leanback
 * browse UI, no D-pad focus handling needed.
 *
 * Change DRAFT_BOARD_URL below to include your league code
 * (?league=YOURCODE) once you know it, so the TV boots straight into
 * the right league instead of showing the "enter a league code"
 * prompt every time it (re)starts.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val DRAFT_BOARD_URL = "https://reports.bidboard.workers.dev/draft-board.html"
        // How long the screen stays awake after the most recent pick
        // before falling back to normal TV screensaver/standby behavior.
        // Google's TV quality review flags apps that keep the screen on
        // indefinitely with no real activity -- this only holds it awake
        // while picks are genuinely still coming in.
        private const val KEEP_AWAKE_TIMEOUT_MS = 30L * 60 * 1000
    }

    private lateinit var webView: WebView
    private val idleHandler = Handler(Looper.getMainLooper())
    private val idleRunnable = Runnable {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /** Exposed to the web page as `window.AndroidTVBridge` (see draft-board.js). */
    private inner class WebAppBridge {
        @JavascriptInterface
        fun onDraftActivity() {
            runOnUiThread {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                idleHandler.removeCallbacks(idleRunnable)
                idleHandler.postDelayed(idleRunnable, KEEP_AWAKE_TIMEOUT_MS)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        hideSystemBars()

        webView = WebView(this)
        setContentView(webView)
        webView.addJavascriptInterface(WebAppBridge(), "AndroidTVBridge")

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // the site uses localStorage/sessionStorage throughout
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            // This is a live, frequently-updated web app, not a static
            // asset-heavy site -- default WebView HTTP caching can keep
            // showing a stale version after a real deploy (we hit this:
            // a CSS change needed a manual Force Stop + Clear Cache to
            // show up). Always hit the network instead.
            cacheMode = WebSettings.LOAD_NO_CACHE
            // draft-board.js checks navigator.userAgent for this marker to
            // hide export/snapshot (nowhere to save a file on a TV) and
            // disable the QR code link (an accidental remote click
            // shouldn't navigate the whole TV display away).
            userAgentString = "$userAgentString DraftBoardTVApp/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                hideSystemBars()
            }
        }
        // The site's console.warn/console.error calls (used for soft
        // failures like a failed fetch) are otherwise silently
        // swallowed by WebView -- surfacing them makes `adb logcat`
        // actually useful for debugging a blank/broken screen.
        webView.webChromeClient = WebChromeClient()

        webView.loadUrl(DRAFT_BOARD_URL)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun hideSystemBars() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    override fun onDestroy() {
        idleHandler.removeCallbacks(idleRunnable)
        webView.destroy()
        super.onDestroy()
    }
}
