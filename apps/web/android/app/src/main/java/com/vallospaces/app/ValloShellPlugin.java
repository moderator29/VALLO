package com.vallospaces.app;

import android.app.Activity;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/**
 * VALLO'S OWN SHELL PLUGIN, THE ANDROID TWIN (build 1.0.2, Agent NATIVE job 2).
 *
 * The same three calls the iPhone app answers (`ios/App/App/ValloShell.swift`,
 * `src/lib/native/shell-plugin.ts`):
 *
 *   setPrivacyCover  Android 13 and above: the Recents thumbnail of a money or
 *                    identity screen is left blank (`setRecentsScreenshotEnabled`).
 *                    Below 13 there is no such switch, and FLAG_SECURE is NOT used:
 *                    it would also block the screenshots people here take of a
 *                    payment receipt to share it, which is ordinary use.
 *   takeCrashReport  the shell's own crash from the last run, once (ValloCrashLog).
 *   notePath         the page's current path, so a renderer the system
 *                    stopped for memory reopens on the same page (MainActivity).
 *   handoff          the page has painted: the launch overlay (LaunchMark)
 *                    fades onto it once the drawing has landed.
 *
 * Registered in MainActivity before the bridge starts. Built, NOT tested on a
 * device: no Android SDK runs in this repository.
 */
@CapacitorPlugin(name = "ValloShell")
public class ValloShellPlugin extends Plugin {

    @PluginMethod
    public void setPrivacyCover(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.runOnUiThread(() -> activity.setRecentsScreenshotEnabled(!on));
        }
        call.resolve();
    }

    @PluginMethod
    public void takeCrashReport(PluginCall call) {
        JSObject result = new JSObject();
        JSONObject report = ValloCrashLog.take(getContext());
        result.put("report", report != null ? report : JSONObject.NULL);
        call.resolve(result);
    }

    /** The page's current path, kept for renderer recovery (MainActivity). */
    @PluginMethod
    public void notePath(PluginCall call) {
        String path = call.getString("path", "/");
        if (path != null && path.startsWith("/") && !path.startsWith("//") && path.length() <= 2048) {
            MainActivity.lastPath = path;
        }
        call.resolve();
    }

    @PluginMethod
    public void handoff(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) activity.runOnUiThread(LaunchMark::handOff);
        call.resolve();
    }
}
