package com.vallospaces.app;

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
                        /* Recorded for the crash log; returning false keeps
                           today's behaviour (the system ends the app and the
                           next open starts clean). */
                        ValloCrashLog.renderProcessGone(
                            MainActivity.this,
                            android.os.Build.VERSION.SDK_INT >= 26 && detail != null && detail.didCrash()
                        );
                        return false;
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
