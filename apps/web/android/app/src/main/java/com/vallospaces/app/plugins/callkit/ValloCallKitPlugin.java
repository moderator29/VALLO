package com.vallospaces.app.plugins.callkit;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that bridges the JS call lifecycle to Android's
 * notification system and audio manager. Registered as "ValloCallKit" to
 * match the JS registerPlugin name (src/lib/native/call-kit.ts).
 *
 * Android has no CallKit. Instead:
 * - a high-priority notification with a full-screen intent for incoming calls
 * - AudioManager for audio routing
 * - NotificationChannel for call sounds and vibration
 *
 * Java, like every other class in this app: the project has no Kotlin
 * toolchain, so the earlier Kotlin version of this file was never compiled
 * (CI's Android debug build failed in MainActivity on its import). Built on
 * CI; NOT tested on a device.
 */
@CapacitorPlugin(name = "ValloCallKit")
public class ValloCallKitPlugin extends Plugin {

    private static final String CHANNEL_INCOMING = "vallo_incoming_call";
    private static final String CHANNEL_ACTIVE = "vallo_active_call";
    private static final int NOTIFICATION_ID_INCOMING = 9001;
    private static final int NOTIFICATION_ID_ACTIVE = 9002;
    private static final int REQUEST_ANSWER = 1;
    private static final int REQUEST_DECLINE = 2;
    private static final int REQUEST_END = 3;

    private AudioManager audioManager;
    private int previousAudioMode = AudioManager.MODE_NORMAL;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannels();
    }

    private NotificationManager notifications() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = notifications();
        if (nm == null) return;

        NotificationChannel incoming = new NotificationChannel(CHANNEL_INCOMING, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
        incoming.setDescription("Shows when someone is calling you");
        incoming.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        incoming.setSound(null, null);

        NotificationChannel active = new NotificationChannel(CHANNEL_ACTIVE, "Active calls", NotificationManager.IMPORTANCE_LOW);
        active.setDescription("Shows while you are on a call");

        nm.createNotificationChannel(incoming);
        nm.createNotificationChannel(active);
    }

    @PluginMethod
    public void reportNewCall(PluginCall call) {
        String callId = call.getString("callId");
        if (callId == null) {
            call.reject("Missing callId");
            return;
        }
        String displayName = call.getString("displayName", "Unknown");
        boolean isOutgoing = Boolean.TRUE.equals(call.getBoolean("isOutgoing", false));
        String kind = call.getString("kind", "AUDIO");

        if (!isOutgoing) {
            showIncomingCallNotification(callId, displayName, "VIDEO".equals(kind));
        } else {
            showActiveCallNotification(callId, displayName);
        }
        call.resolve();
    }

    @PluginMethod
    public void configureAudio(PluginCall call) {
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }
        String preferredOutput = call.getString("preferredOutput", "earpiece");
        previousAudioMode = audioManager.getMode();
        /* Voice and video calls both use the communication mode. */
        audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
        audioManager.setSpeakerphoneOn("speaker".equals(preferredOutput));
        call.resolve();
    }

    @PluginMethod
    public void updateCall(PluginCall call) {
        String callId = call.getString("callId");
        if (callId == null) {
            call.reject("Missing callId");
            return;
        }
        if (Boolean.TRUE.equals(call.getBoolean("connected", false))) {
            dismissIncomingNotification();
            showActiveCallNotification(callId, "Active call");
        }
        if (Boolean.TRUE.equals(call.getBoolean("ended", false))) {
            dismissAllNotifications();
            restoreAudio();
        }
        String output = call.getString("preferredOutput");
        if (output != null && audioManager != null) {
            audioManager.setSpeakerphoneOn("speaker".equals(output));
        }
        call.resolve();
    }

    @PluginMethod
    public void endCall(PluginCall call) {
        dismissAllNotifications();
        restoreAudio();
        call.resolve();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        call.resolve(result);
    }

    private void restoreAudio() {
        if (audioManager == null) return;
        audioManager.setMode(previousAudioMode);
        audioManager.setSpeakerphoneOn(false);
    }

    /* ------------------------------------------------------------ notifications */

    private Intent launchIntent(String callId, String action) {
        Context context = getContext();
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent == null) intent = new Intent();
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("callId", callId);
        if (action != null) intent.putExtra("callAction", action);
        return intent;
    }

    private PendingIntent actionIntent(String callId, String action, int requestCode) {
        return PendingIntent.getActivity(
            getContext(),
            requestCode,
            launchIntent(callId, action),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void showIncomingCallNotification(String callId, String callerName, boolean hasVideo) {
        NotificationManager nm = notifications();
        if (nm == null) return;
        PendingIntent fullScreen = PendingIntent.getActivity(
            getContext(), 0, launchIntent(callId, null), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String callType = hasVideo ? "Video call" : "Voice call";

        Notification notification = new NotificationCompat.Builder(getContext(), CHANNEL_INCOMING)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(callerName)
            .setContentText("Incoming " + callType)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(fullScreen, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", actionIntent(callId, "decline", REQUEST_DECLINE))
            .addAction(android.R.drawable.ic_menu_call, "Answer", actionIntent(callId, "answer", REQUEST_ANSWER))
            .build();

        nm.notify(NOTIFICATION_ID_INCOMING, notification);
    }

    private void showActiveCallNotification(String callId, String displayName) {
        NotificationManager nm = notifications();
        if (nm == null) return;
        Notification notification = new NotificationCompat.Builder(getContext(), CHANNEL_ACTIVE)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("On a call")
            .setContentText(displayName)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", actionIntent(callId, "end", REQUEST_END))
            .build();

        nm.notify(NOTIFICATION_ID_ACTIVE, notification);
    }

    private void dismissIncomingNotification() {
        NotificationManager nm = notifications();
        if (nm != null) nm.cancel(NOTIFICATION_ID_INCOMING);
    }

    private void dismissAllNotifications() {
        NotificationManager nm = notifications();
        if (nm == null) return;
        nm.cancel(NOTIFICATION_ID_INCOMING);
        nm.cancel(NOTIFICATION_ID_ACTIVE);
    }
}
