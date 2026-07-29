package com.dustindame.draftboardtv

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
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
        private const val DRAFT_BOARD_URL = "https://dustindame.github.io/Reports/draft-board.html"
    }

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Passive TV display -- never let the screen sleep mid-draft.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // the site uses localStorage/sessionStorage throughout
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
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
        webView.destroy()
        super.onDestroy()
    }
}
