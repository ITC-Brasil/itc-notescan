package com.itcbrasil.notescan;

import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onPause() {
        super.onPause();
        // Persist the WebView cookie jar to disk whenever the app is backgrounded.
        // The system WebView keeps cookies in memory and flushes on an
        // unpredictable schedule, so a process kill could drop the NextAuth
        // session cookie and force re-login despite the 7-day maxAge. Flushing
        // on pause guarantees the session survives app restarts.
        CookieManager.getInstance().flush();
    }
}
