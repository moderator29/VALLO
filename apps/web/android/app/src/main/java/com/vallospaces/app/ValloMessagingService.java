package com.vallospaces.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/**
 * VALLO'S OWN ANDROID NOTIFICATION, WITH THE PICTURE BESIDE THE WORDS
 * (FEATURE_BACKLOG A2, build 1.0.2; the founder's lock screen: the round
 * avatar beside the text, the photo below it). The twin of the iPhone's
 * Notification Service Extension.
 *
 * It extends the push plugin's own service, so everything that already works
 * keeps working: tokens, the page hearing every push, and every ordinary
 * notification message, which Android still draws by itself. It adds one
 * thing: a DATA message marked `vallo_rich` (sent by the server only to a
 * shell that said it is 1.0.2 or later, `lib/push/family.ts`), which it draws
 * itself:
 *
 *   - the brand small icon, tinted with the brand accent;
 *   - the picture as the large icon beside the text: round for a person
 *     (messages), a rounded square for a place;
 *   - the same picture as the big picture when the notification is opened out;
 *   - the family's channel (and so its chime), the header line as the sub
 *     text, grouped by the push's tag;
 *   - a tap that opens the app with the push's data, read by the plugin
 *     exactly as it reads a system-drawn notification (`google.message_id`),
 *     so `lib/native/push-taps.ts` routes it to the same screen.
 *
 * A picture that cannot be fetched in a few seconds is left out; the
 * notification is never held back or lost. Built, NOT tested on a device.
 */
public class ValloMessagingService extends MessagingService {
    private static final int IMAGE_TIMEOUT_MS = 6000;
    private static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        if (!"1".equals(data.get("vallo_rich"))) return;
        try {
            show(getApplicationContext(), message, data);
        } catch (Throwable ignored) {
            // Nothing more to do: the page still heard the push.
        }
    }

    private static void show(Context context, RemoteMessage message, Map<String, String> data) {
        String title = data.containsKey("title") ? data.get("title") : "Vallo";
        String body = data.containsKey("body") ? data.get("body") : "";
        String channel = data.containsKey("channel") ? data.get("channel") : "vallo_default";
        String tag = data.containsKey("tag") ? data.get("tag") : "vallo";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_vallo)
            .setColor(ContextCompat.getColor(context, R.color.vallo_notification))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setGroup(tag)
            .setSilent("1".equals(data.get("quiet")))
            .setContentIntent(tapIntent(context, message, data));
        if (data.containsKey("subtitle")) builder.setSubText(data.get("subtitle"));

        Bitmap picture = fetch(data.get("image"));
        if (picture != null) {
            boolean round = "1".equals(data.get("round"));
            builder.setLargeIcon(round ? circle(picture) : roundedSquare(picture));
            builder.setStyle(new NotificationCompat.BigPictureStyle().bigPicture(picture).bigLargeIcon((Bitmap) null));
        } else {
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(tag, 0, builder.build());
    }

    /** The app, opened with the push's data, as the plugin reads a system-drawn tap. */
    private static PendingIntent tapIntent(Context context, RemoteMessage message, Map<String, String> data) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String id = message.getMessageId();
        intent.putExtra("google.message_id", id != null ? id : String.valueOf(System.currentTimeMillis()));
        for (Map.Entry<String, String> entry : data.entrySet()) intent.putExtra(entry.getKey(), entry.getValue());
        int request = (data.containsKey("tag") ? data.get("tag") : "vallo").hashCode();
        return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** An https picture, small enough, in a few seconds; otherwise none. */
    private static Bitmap fetch(String address) {
        if (address == null || !address.startsWith("https://")) return null;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(IMAGE_TIMEOUT_MS);
            connection.setReadTimeout(IMAGE_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(true);
            if (connection.getResponseCode() / 100 != 2) return null;
            if (connection.getContentLength() > MAX_IMAGE_BYTES) return null;
            try (InputStream in = connection.getInputStream()) {
                return BitmapFactory.decodeStream(in);
            }
        } catch (Throwable ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static Bitmap square(Bitmap source) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        return Bitmap.createScaledBitmap(Bitmap.createBitmap(source, x, y, side, side), 256, 256, true);
    }

    private static Bitmap circle(Bitmap source) {
        Bitmap sq = square(source);
        Bitmap out = Bitmap.createBitmap(sq.getWidth(), sq.getHeight(), Bitmap.Config.ARGB_8888);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(sq, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        float r = sq.getWidth() / 2f;
        new Canvas(out).drawCircle(r, r, r, paint);
        return out;
    }

    private static Bitmap roundedSquare(Bitmap source) {
        Bitmap sq = square(source);
        Bitmap out = Bitmap.createBitmap(sq.getWidth(), sq.getHeight(), Bitmap.Config.ARGB_8888);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(sq, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        float radius = sq.getWidth() * 0.22f;
        new Canvas(out).drawRoundRect(new RectF(0, 0, sq.getWidth(), sq.getHeight()), radius, radius, paint);
        return out;
    }
}
