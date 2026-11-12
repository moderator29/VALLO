package com.vallospaces.app;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.animation.Interpolator;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

/**
 * THE OPENING ON ANDROID, DRAWN (founder's rulings, 7 November 2026: the
 * animated logo replaces D68c, and Android gets the FULL drawing animation,
 * the same as the iPhone). The twin of `LaunchMark` in
 * `ios/App/App/ValloShell.swift`, on the same layers, centre line and timings
 * (held equal by `src/lib/native/launch-sequence.test.ts`):
 *
 *   0.00 s  the ring draws round from its left tip (a stroke along its own
 *           centre line, cut to the ring's picture)
 *   0.20 s  the four towers rise one after another, 90 ms apart
 *   0.74 s  the letters V A L L O slide down out from behind the mark, 60 ms apart
 *   0.95 s  the version line fades in at the foot
 *   1.40 s  landed; the overlay fades onto the page at the later of this and
 *           the page's hand-over (`handoff`), by 1.95 s at the latest
 *
 * WHEN IT STARTS. The system splash is the bare navy and holds the window's
 * first frame until the page has parsed (the splash plugin keeps it on
 * screen). On Android 12 and above the window draws nothing until then, so
 * the sequence starts on the overlay's FIRST REAL DRAW, never behind the
 * splash. Below 12 the plugin's splash is its own layer over the window, so
 * the sequence starts at the hand-over instead.
 *
 * It never takes a touch (not clickable, not focusable, hidden from
 * accessibility). With animations switched off in the system settings it
 * simply goes when the page is ready. If the page never hands over it goes
 * after `CEILING_MS` by itself.
 *
 * Built, NOT tested on a device: no Android SDK runs in this repository.
 */
final class LaunchMark {
    private static final int GROUND = Color.rgb(1, 1, 24);

    /* The sequence, in milliseconds, the same numbers as the iPhone's. */
    static final long RING_MS = 620;
    static final long TOWER_BEGIN_MS = 200;
    static final long TOWER_STEP_MS = 90;
    static final long TOWER_MS = 460;
    static final long LETTER_BEGIN_MS = 740;
    static final long LETTER_STEP_MS = 60;
    static final long LETTER_MS = 420;
    static final long VERSION_BEGIN_MS = 950;
    static final long VERSION_MS = 300;
    static final long SEQUENCE_END_MS = 1400;
    static final long SEQUENCE_CEILING_MS = 1950;
    static final long FADE_MS = 220;
    /** If the page never hands over and the window never draws, the overlay goes by itself. */
    static final long CEILING_MS = 6000;

    /** The ring's centre line as fractions of the mark's box (x, y pairs), from vallo-mark.svg. */
    static final float[] RING_LINE = {
        0.186f, 0.5652f, 0.161f, 0.5844f, 0.1372f, 0.6058f, 0.1151f, 0.6299f,
        0.0956f, 0.6569f, 0.0801f, 0.6874f, 0.0705f, 0.721f, 0.0701f, 0.7561f,
        0.0804f, 0.7883f, 0.0978f, 0.816f, 0.12f, 0.8393f, 0.1455f, 0.858f,
        0.1729f, 0.8731f, 0.2017f, 0.8848f, 0.2313f, 0.8938f, 0.2614f, 0.9004f,
        0.2917f, 0.905f, 0.3223f, 0.9078f, 0.3529f, 0.909f, 0.3836f, 0.9087f,
        0.4142f, 0.9071f, 0.4448f, 0.9043f, 0.4753f, 0.9003f, 0.5057f, 0.8953f,
        0.5359f, 0.889f, 0.5659f, 0.8817f, 0.5957f, 0.8733f, 0.6253f, 0.8639f,
        0.6547f, 0.8534f, 0.6837f, 0.8417f, 0.7123f, 0.8288f, 0.7405f, 0.8147f,
        0.7681f, 0.7992f, 0.7951f, 0.7822f, 0.8213f, 0.7637f, 0.8465f, 0.7435f,
        0.8704f, 0.7212f, 0.8927f, 0.6969f, 0.9125f, 0.67f, 0.9291f, 0.6403f,
        0.9404f, 0.6076f, 0.944f, 0.5726f, 0.9371f, 0.538f, 0.9207f, 0.508f,
        0.8981f, 0.4838f, 0.8721f, 0.465f, 0.8442f, 0.4504f, 0.8151f, 0.4391f,
    };
    static final float RING_STROKE = 0.132f * 1.35f;

    private static final int[] TOWERS = {
        R.drawable.launch_tower1, R.drawable.launch_tower2, R.drawable.launch_tower3, R.drawable.launch_tower4,
    };
    private static final int[] LETTERS = {
        R.drawable.launch_letter_v,
        R.drawable.launch_letter_a,
        R.drawable.launch_letter_l1,
        R.drawable.launch_letter_l2,
        R.drawable.launch_letter_o,
    };

    private static FrameLayout ground;
    private static RingView ring;
    private static WipeView[] towers;
    private static ImageView[] letters;
    private static TextView version;
    private static boolean started;
    private static boolean handedOver;
    private static boolean leaving;
    private static long startedAt;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private LaunchMark() {}

    private static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    static void show(final Activity activity) {
        if (ground != null) {
            /*
             * THE ACTIVITY CAN BE REBUILT UNDER US (12 November 2026).
             * `MainActivity.recoverRenderer` calls `recreate()` when the
             * system stops the web view's renderer for memory, and onCreate
             * calls this again. These fields are static, so an overlay from
             * the activity that has gone kept that Activity alive here and
             * this launch got no opening at all. Let the dead one go.
             */
            if (ground.getContext() == activity) return;
            remove(ground);
        }
        try {
            final FrameLayout g = new FrameLayout(activity);
            g.setBackgroundColor(GROUND);
            g.setClickable(false);
            g.setFocusable(false);
            g.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);

            FrameLayout mark = new FrameLayout(activity);
            g.addView(mark, new FrameLayout.LayoutParams(dp(activity, 76), dp(activity, 65), Gravity.CENTER));
            ring = new RingView(activity, BitmapFactory.decodeResource(activity.getResources(), R.drawable.launch_ring));
            mark.addView(ring, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            towers = new WipeView[TOWERS.length];
            for (int i = 0; i < TOWERS.length; i++) {
                towers[i] = new WipeView(activity, BitmapFactory.decodeResource(activity.getResources(), TOWERS[i]));
                mark.addView(towers[i], new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }

            FrameLayout word = new FrameLayout(activity);
            word.setClipChildren(true);
            FrameLayout.LayoutParams wordLp = new FrameLayout.LayoutParams(dp(activity, 124), dp(activity, 26), Gravity.CENTER);
            wordLp.topMargin = dp(activity, 58);
            g.addView(word, wordLp);
            letters = new ImageView[LETTERS.length];
            for (int i = 0; i < LETTERS.length; i++) {
                ImageView letter = new ImageView(activity);
                letter.setImageResource(LETTERS[i]);
                letter.setScaleType(ImageView.ScaleType.FIT_XY);
                letter.setTranslationY(-dp(activity, 26));
                word.addView(letter, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                letters[i] = letter;
            }

            version = new TextView(activity);
            version.setText("Version " + versionName(activity));
            version.setTextColor(Color.WHITE);
            version.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            version.setAlpha(0f);
            FrameLayout.LayoutParams versionLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
            );
            versionLp.bottomMargin = dp(activity, 48);
            g.addView(version, versionLp);

            activity.addContentView(g, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            ground = g;
            started = false;
            handedOver = false;
            leaving = false;

            if (!animatorsOn()) {
                /* Animations off: the finished logo, still, until the page is ready. */
                finishAll();
            } else if (Build.VERSION.SDK_INT >= 31) {
                /* Start on the first frame the window really draws. */
                g.getViewTreeObserver().addOnDrawListener(new ViewTreeObserver.OnDrawListener() {
                    @Override
                    public void onDraw() {
                        MAIN.post(() -> {
                            if (g.getViewTreeObserver().isAlive()) g.getViewTreeObserver().removeOnDrawListener(this);
                            start();
                        });
                    }
                });
            }
            /*
             * THE CEILING FOR THE PATHS THAT NEVER REACH start() (12 November
             * 2026). It was scheduled only inside start(), so the two paths
             * that do not call it had no ceiling at all and fell through to
             * giveUp() at CEILING_MS, six seconds:
             *
             *   below Android 12 with no hand-over  the overlay is BLANK on
             *     this path (nothing has been drawn: the ring undrawn, the
             *     letters off the top, the version line transparent), and the
             *     page that never hands over is the packaged offline card,
             *     which is App Review's airplane mode cold start. That card
             *     now hands over (native-shell/shell.js), and this is the
             *     belt and braces for a page whose script never runs.
             *   animations switched off  the finished logo, still, for six
             *     seconds. The iPhone clears its own quiet path in 1.45 s.
             *
             * The iPhone schedules its ceiling in `show` on every path
             * (ValloShell.swift), and this is the same thing. `leave` is
             * idempotent, and start()'s own ceiling still governs a sequence
             * that is actually running, so a slow first draw is not cut short.
             */
            MAIN.postDelayed(LaunchMark::ceilingForIdle, SEQUENCE_CEILING_MS);
            MAIN.postDelayed(LaunchMark::giveUp, CEILING_MS);
        } catch (Throwable ignored) {
            // No overlay: the page arrives as it did before.
            ground = null;
        }
    }

    private static String versionName(Activity activity) {
        try {
            return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Throwable ignored) {
            return "";
        }
    }

    private static boolean animatorsOn() {
        return Build.VERSION.SDK_INT < 26 || ValueAnimator.areAnimatorsEnabled();
    }

    /** Play the sequence, once. Main thread. */
    private static void start() {
        if (started || ground == null) return;
        started = true;
        startedAt = SystemClock.uptimeMillis();
        Interpolator entrance = new PathInterpolator(0.16f, 1f, 0.3f, 1f);
        Interpolator sweep = new PathInterpolator(0.45f, 0f, 0.2f, 1f);

        ValueAnimator draw = ValueAnimator.ofFloat(0f, 1f).setDuration(RING_MS);
        draw.setInterpolator(sweep);
        draw.addUpdateListener((a) -> ring.setProgress((float) a.getAnimatedValue()));
        draw.start();

        for (int i = 0; i < towers.length; i++) {
            final WipeView tower = towers[i];
            ValueAnimator rise = ValueAnimator.ofFloat(0f, 1f).setDuration(TOWER_MS);
            rise.setStartDelay(TOWER_BEGIN_MS + i * TOWER_STEP_MS);
            rise.setInterpolator(entrance);
            rise.addUpdateListener((a) -> tower.setProgress((float) a.getAnimatedValue()));
            rise.start();
        }
        for (int i = 0; i < letters.length; i++) {
            letters[i].animate().translationY(0f).setStartDelay(LETTER_BEGIN_MS + i * LETTER_STEP_MS).setDuration(LETTER_MS).setInterpolator(entrance).start();
        }
        version.animate().alpha(0.55f).setStartDelay(VERSION_BEGIN_MS).setDuration(VERSION_MS).setInterpolator(entrance).start();

        /* The latest the overlay may stay, whatever the page does. */
        MAIN.postDelayed(LaunchMark::leave, SEQUENCE_CEILING_MS);
        if (handedOver) leaveWhenLanded();
    }

    /** The finished logo, with nothing travelling. */
    private static void finishAll() {
        started = true;
        startedAt = SystemClock.uptimeMillis() - SEQUENCE_END_MS;
        ring.setProgress(1f);
        for (WipeView t : towers) t.setProgress(1f);
        for (ImageView l : letters) l.setTranslationY(0f);
        version.setAlpha(0.55f);
    }

    /** The page has painted. Main thread. */
    static void handOff() {
        if (ground == null) return;
        handedOver = true;
        if (!animatorsOn()) {
            remove(ground);
            return;
        }
        /* Below Android 12 the plugin's splash covered the window until now. */
        if (!started) start();
        else leaveWhenLanded();
    }

    private static void leaveWhenLanded() {
        long elapsed = SystemClock.uptimeMillis() - startedAt;
        MAIN.postDelayed(LaunchMark::leave, Math.max(0, SEQUENCE_END_MS - elapsed));
    }

    /** Nothing is travelling and the ceiling has passed: the overlay goes. */
    private static void ceilingForIdle() {
        if (ground == null) return;
        if (!started || !animatorsOn()) leave();
    }

    private static void giveUp() {
        if (ground == null) return;
        if (!started) remove(ground);
        else leave();
    }

    private static void leave() {
        final FrameLayout g = ground;
        if (g == null || leaving) return;
        leaving = true;
        g.animate()
            .alpha(0f)
            .setStartDelay(0)
            .setDuration(FADE_MS)
            .setInterpolator(new PathInterpolator(0.4f, 0f, 1f, 1f))
            .withEndAction(() -> remove(g))
            .start();
    }

    private static void remove(FrameLayout g) {
        ViewGroup parent = (ViewGroup) g.getParent();
        if (parent != null) parent.removeView(g);
        if (ground == g) {
            ground = null;
            ring = null;
            towers = null;
            letters = null;
            version = null;
        }
    }

    /** The ring's picture, shown only under a stroke drawn along its centre line. */
    static final class RingView extends View {
        private final Bitmap bitmap;
        private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint image = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final Path line = new Path();
        private final Path part = new Path();
        private PathMeasure measure;
        private float progress;
        private final Rect src;
        private final RectF dst = new RectF();

        RingView(Context context, Bitmap bitmap) {
            super(context);
            this.bitmap = bitmap;
            this.src = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
            stroke.setStyle(Paint.Style.STROKE);
            stroke.setStrokeCap(Paint.Cap.ROUND);
            stroke.setStrokeJoin(Paint.Join.ROUND);
            stroke.setColor(Color.WHITE);
            image.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        }

        void setProgress(float p) {
            progress = p;
            invalidate();
        }

        @Override
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            line.reset();
            for (int i = 0; i + 1 < RING_LINE.length; i += 2) {
                float x = RING_LINE[i] * w;
                float y = RING_LINE[i + 1] * h;
                if (i == 0) line.moveTo(x, y);
                else line.lineTo(x, y);
            }
            measure = new PathMeasure(line, false);
            stroke.setStrokeWidth(RING_STROKE * w);
            dst.set(0, 0, w, h);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            if (measure == null || progress <= 0f) return;
            if (progress >= 1f) {
                canvas.drawBitmap(bitmap, src, dst, null);
                return;
            }
            int layer = canvas.saveLayer(dst, null);
            part.reset();
            measure.getSegment(0, measure.getLength() * progress, part, true);
            canvas.drawPath(part, stroke);
            canvas.drawBitmap(bitmap, src, dst, image);
            canvas.restoreToCount(layer);
        }
    }

    /** A tower's picture, revealed upward from its foot. */
    static final class WipeView extends View {
        private final Bitmap bitmap;
        private final Paint image = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final Rect src;
        private final RectF dst = new RectF();
        private float progress;

        WipeView(Context context, Bitmap bitmap) {
            super(context);
            this.bitmap = bitmap;
            this.src = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
        }

        void setProgress(float p) {
            progress = p;
            invalidate();
        }

        @Override
        protected void onSizeChanged(int w, int h, int oldw, int oldh) {
            dst.set(0, 0, w, h);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            if (progress <= 0f) return;
            canvas.save();
            canvas.clipRect(0f, dst.height() * (1f - progress), dst.width(), dst.height());
            canvas.drawBitmap(bitmap, src, dst, image);
            canvas.restore();
        }
    }
}
