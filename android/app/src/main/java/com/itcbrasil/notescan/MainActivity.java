package com.itcbrasil.notescan;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String cookieCheck = CookieManager.getInstance()
            .getCookie("https://notescan.itcbr.xyz");
        android.util.Log.d("NoteScan-Cookie",
            "Cookie no cold start: " + (cookieCheck != null ? "PRESENTE" : "NULO"));
        if (cookieCheck != null) {
            boolean hasAuthCookie = cookieCheck.contains("__Secure-authjs.session-token");
            android.util.Log.d("NoteScan-Cookie",
                "session-token presente: " + hasAuthCookie);
        }
        // Make sure the WebView accepts and persists cookies for the remote
        // server.url origin. Default is true, but we assert it so the NextAuth
        // session cookie is always stored.
        CookieManager.getInstance().setAcceptCookie(true);
    }

    @Override
    public void onPause() {
        super.onPause();
        flushCookies();
    }

    @Override
    public void onStop() {
        super.onStop();
        // onStop also runs before the process may be killed in the background;
        // flushing here as well guarantees the persistent session cookie reaches
        // disk, so the 7-day session survives app restarts (no re-login on
        // returning from multitasking).
        flushCookies();
    }

    private void flushCookies() {
        CookieManager.getInstance().flush();
    }
}
