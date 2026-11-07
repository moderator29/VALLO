package com.vallospaces.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * FACE UNLOCK AND FINGERPRINT IN THE APP (7 October 2026, the founder: "set and
 * build Face ID to work").
 *
 * Vallo's biometric is a WebAuthn platform key (a passkey) whose assertion
 * the SERVER verifies before it writes the unlock (`src/lib/passcode/passkey-unlock.ts`);
 * the same key confirms payments. A WebView does not run WebAuthn unless the
 * app asks for it, so this turns it on for the app's own web view, on a
 * device whose WebView supports it (androidx.webkit, WEB_AUTHENTICATION).
 * With the app's identity, Android requires the site to vouch for the app in
 * `public/.well-known/assetlinks.json` with the
 * `delegate_permission/common.get_login_creds` relation, and that file's two
 * SHA-256 fingerprints are still placeholders (see AndroidManifest.xml): until
 * the owner fills them, the platform refuses the ceremony and the lock falls
 * back to the passcode, exactly as on a device without a biometric.
 *
 * Nothing here decides an unlock. It needs a NATIVE REBUILD.
 */
public class MainActivity extends BridgeActivity {
    /*
     * RENDERER RECOVERY (Agent NATIVE job 7, build 1.0.2). On a 2 GB phone
     * Android stops the web view's renderer for memory more than anything
     * else goes wrong, and an unhandled loss ends the whole app: the person
     * is thrown to the home screen mid-task. Now the dead web view is taken
     * out and destroyed, the activity is rebuilt with a fresh one, and it
     * opens on the page the person was on (the page reports its path through
     * ValloShell.notePath; the rebuilt activity hands it to the page as an
     * ordinary app link, which `lib/native/deep-links.ts` routes). At most
     * MAX_RECOVERIES in RECOVERY_WINDOW_MS, so a page that kills the renderer
     * every time cannot loop: after that the app ends as it did before.
     */
    static final int MAX_RECOVERIES = 2;
    static final long RECOVERY_WINDOW_MS = 60_000;
    private static final long[] recoveries = new long[MAX_RECOVERIES];
    private static int recoveryCount = 0;
    /** The path the page last reported (ValloShellPlugin.notePath); "/" until then. */
    static volatile String lastPath = "/";

    /** Whether one more recovery fits inside the window. */
    static synchronized boolean mayRecover(long now) {
        int recent = 0;
        for (int i = 0; i < Math.min(recoveryCount, MAX_RECOVERIES); i++) {
            if (now - recoveries[i] < RECOVERY_WINDOW_MS) recent++;
        }
        if (recent >= MAX_RECOVERIES) return false;
        recoveries[recoveryCount % MAX_RECOVERIES] = now;
        recoveryCount++;
        return true;
    }

    private boolean recoverRenderer(WebView view) {
        if (!mayRecover(android.os.SystemClock.elapsedRealtime())) return false;
        try {
            android.view.ViewGroup parent = (android.view.ViewGroup) view.getParent();
            if (parent != null) parent.removeView(view);
            view.destroy();
        } catch (Throwable ignored) {
            // A web view that will not even be destroyed is still never used again.
        }
        String origin = "https://www.vallospaces.com";
        try {
            String server = getBridge() != null ? getBridge().getServerUrl() : null;
            if (server != null && server.startsWith("https://")) origin = server.replaceAll("/+$", "");
        } catch (Throwable ignored) {
            // The production origin stands.
        }
        String path = lastPath != null && lastPath.startsWith("/") && !lastPath.startsWith("//") ? lastPath : "/";
        Intent reopen = new Intent(Intent.ACTION_VIEW, Uri.parse(origin + path), this, MainActivity.class);
        setIntent(reopen);
        recreate();
        return true;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Build 1.0.2 (Agent NATIVE job 2): the shell's own crash record is
           armed first, and Vallo's shell plugin (ValloShellPlugin: the
           Recents cover, the crash hand-over) is registered before the
           bridge is created by super.onCreate. */
        ValloCrashLog.install(this);
        registerPlugin(ValloShellPlugin.class);
        super.onCreate(savedInstanceState);
        /* The opening (founder's rulings, 7 November 2026): the exact mark
           drawn in over the launch navy, as on the iPhone (LaunchMark). */
        LaunchMark.show(this);
        try {
            if (getBridge() != null) {
                getBridge().addWebViewListener(new WebViewListener() {
                    @Override
                    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                        /* Recorded for the crash log either way. */
                        ValloCrashLog.renderProcessGone(
                            MainActivity.this,
                            android.os.Build.VERSION.SDK_INT >= 26 && detail != null && detail.didCrash()
                        );
                        return recoverRenderer(view);
                    }
                });
            }
        } catch (Throwable ignored) {
            // The listener is a record only; the app runs the same without it.
        }
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION) && getBridge() != null) {
                WebView webView = getBridge().getWebView();
                WebSettingsCompat.setWebAuthenticationSupport(
                    webView.getSettings(),
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
                );
            }
        } catch (Throwable ignored) {
            // An older WebView without the feature: the passcode stays the way in.
        }
    }
}
