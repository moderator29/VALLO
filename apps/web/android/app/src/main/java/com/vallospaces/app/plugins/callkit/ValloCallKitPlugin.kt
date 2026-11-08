package com.vallospaces.app.plugins.callkit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor plugin that bridges the JS call lifecycle to Android's
 * notification system and audio manager. Registered as "ValloCallKit"
 * to match the JS registerPlugin name.
 *
 * Android does not have CallKit. Instead we use:
 * - A high-priority notification with a full-screen intent for incoming calls
 * - AudioManager for audio routing
 * - NotificationChannel for call sounds and vibration
 */
@CapacitorPlugin(name = "ValloCallKit")
class ValloCallKitPlugin : Plugin() {

    companion object {
        private const val CHANNEL_INCOMING = "vallo_incoming_call"
        private const val CHANNEL_ACTIVE = "vallo_active_call"
        private const val NOTIFICATION_ID_INCOMING = 9001
        private const val NOTIFICATION_ID_ACTIVE = 9002
    }

    private var audioManager: AudioManager? = null
    private var previousAudioMode: Int = AudioManager.MODE_NORMAL

    override fun load() {
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val incoming = NotificationChannel(
            CHANNEL_INCOMING,
            "Incoming calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Shows when someone is calling you"
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            setSound(null, null)
        }

        val active = NotificationChannel(
            CHANNEL_ACTIVE,
            "Active calls",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows while you are on a call"
        }

        nm.createNotificationChannel(incoming)
        nm.createNotificationChannel(active)
    }

    @PluginMethod
    fun reportNewCall(call: PluginCall) {
        val callId = call.getString("callId") ?: run {
            call.reject("Missing callId")
            return
        }
        val displayName = call.getString("displayName") ?: "Unknown"
        val isOutgoing = call.getBoolean("isOutgoing") ?: false
        val kind = call.getString("kind") ?: "AUDIO"

        if (!isOutgoing) {
            showIncomingCallNotification(callId, displayName, kind == "VIDEO")
        } else {
            showActiveCallNotification(callId, displayName)
        }

        call.resolve()
    }

    @PluginMethod
    fun configureAudio(call: PluginCall) {
        val am = audioManager ?: run {
            call.reject("AudioManager not available")
            return
        }
        val mode = call.getString("mode") ?: "voiceChat"
        val preferredOutput = call.getString("preferredOutput") ?: "earpiece"

        previousAudioMode = am.mode
        am.mode = if (mode == "videoChat") {
            AudioManager.MODE_IN_COMMUNICATION
        } else {
            AudioManager.MODE_IN_COMMUNICATION
        }

        am.isSpeakerphoneOn = preferredOutput == "speaker"
        call.resolve()
    }

    @PluginMethod
    fun updateCall(call: PluginCall) {
        val callId = call.getString("callId") ?: run {
            call.reject("Missing callId")
            return
        }

        if (call.getBoolean("connected") == true) {
            val displayName = "Active call"
            dismissIncomingNotification()
            showActiveCallNotification(callId, displayName)
        }

        if (call.getBoolean("ended") == true) {
            dismissAllNotifications()
            audioManager?.let {
                it.mode = previousAudioMode
                it.isSpeakerphoneOn = false
            }
        }

        val output = call.getString("preferredOutput")
        if (output != null) {
            audioManager?.isSpeakerphoneOn = output == "speaker"
        }

        call.resolve()
    }

    @PluginMethod
    fun endCall(call: PluginCall) {
        dismissAllNotifications()
        audioManager?.let {
            it.mode = previousAudioMode
            it.isSpeakerphoneOn = false
        }
        call.resolve()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", true)
        call.resolve(result)
    }

    // MARK: - Notifications

    private fun showIncomingCallNotification(callId: String, callerName: String, hasVideo: Boolean) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callId", callId)
        }

        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val callType = if (hasVideo) "Video call" else "Voice call"

        val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(callerName)
            .setContentText("Incoming $callType")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Decline",
                createActionPendingIntent(callId, "decline")
            )
            .addAction(
                android.R.drawable.ic_menu_call,
                "Answer",
                createActionPendingIntent(callId, "answer")
            )
            .build()

        nm.notify(NOTIFICATION_ID_INCOMING, notification)
    }

    private fun showActiveCallNotification(callId: String, displayName: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notification = NotificationCompat.Builder(context, CHANNEL_ACTIVE)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("On a call")
            .setContentText(displayName)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "End",
                createActionPendingIntent(callId, "end")
            )
            .build()

        nm.notify(NOTIFICATION_ID_ACTIVE, notification)
    }

    private fun createActionPendingIntent(callId: String, action: String): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("callId", callId)
            putExtra("callAction", action)
        }
        val requestCode = if (action == "answer") 1 else 2
        return PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun dismissIncomingNotification() {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID_INCOMING)
    }

    private fun dismissAllNotifications() {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID_INCOMING)
        nm.cancel(NOTIFICATION_ID_ACTIVE)
    }
}
