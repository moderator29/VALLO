package com.vallospaces.app;

import android.content.Context;
import android.content.pm.PackageInfo;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * A CRASH OF THE ANDROID SHELL ITSELF, KEPT FOR THE NEXT LAUNCH (build 1.0.2,
 * NATIVE_BUILD_QUEUE item 6; the twin of `ValloCrashLog` in ValloShell.swift).
 *
 * Two ways the shell dies that the web crash log cannot hear:
 *   1. an uncaught Java exception (a plugin, the activity): recorded, then the
 *      previous handler runs, so Android's own crash dialog and Play's vitals
 *      still see it exactly as before;
 *   2. the web view's renderer killed (most often for memory on a budget phone)
 *      or crashed: recorded from `onRenderProcessGone` in MainActivity.
 *
 * One small JSON file in the app's private files directory; read and deleted
 * once by `takeCrashReport`, which the page posts to `/api/client-error` with
 * platform `android`. It holds a type, a message and the shell's own stack:
 * never page content.
 */
final class ValloCrashLog {
    private static final String FILE = "vallo-crash.json";
    private static final int MAX_STACK = 4000;

    private ValloCrashLog() {}

    static void install(final Context context) {
        final Context app = context.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                StringWriter trace = new StringWriter();
                error.printStackTrace(new PrintWriter(trace));
                write(app, error.getClass().getName(), String.valueOf(error.getMessage()), trace.toString());
            } catch (Throwable ignored) {
                // Recording must never be the second failure.
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }

    /** The web view's renderer went away: `didCrash` false means Android killed it for memory. */
    static void renderProcessGone(Context context, boolean didCrash) {
        write(
            context.getApplicationContext(),
            "WebViewRenderProcessGone",
            didCrash ? "The web view's renderer crashed" : "The web view's renderer was stopped for memory",
            ""
        );
    }

    static void write(Context context, String name, String message, String stack) {
        try {
            JSONObject record = new JSONObject();
            record.put("name", name);
            record.put("message", message);
            record.put("stack", stack.length() > MAX_STACK ? stack.substring(0, MAX_STACK) : stack);
            record.put("release", release(context));
            record.put("at", System.currentTimeMillis());
            try (FileOutputStream out = new FileOutputStream(new File(context.getFilesDir(), FILE))) {
                out.write(record.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Throwable ignored) {
            // Nothing more to do on the way down.
        }
    }

    /** The last run's crash, once; null when the last run ended cleanly. */
    static JSONObject take(Context context) {
        File file = new File(context.getFilesDir(), FILE);
        if (!file.exists()) return null;
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) Math.min(file.length(), 64 * 1024)];
            int read = in.read(bytes);
            return new JSONObject(new String(bytes, 0, Math.max(read, 0), StandardCharsets.UTF_8));
        } catch (Throwable ignored) {
            return null;
        } finally {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private static String release(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long code = android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return info.versionName + " (" + code + ")";
        } catch (Throwable ignored) {
            return "?";
        }
    }
}
