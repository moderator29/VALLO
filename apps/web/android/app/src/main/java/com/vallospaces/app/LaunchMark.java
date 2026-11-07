package com.vallospaces.app;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.Interpolator;
import android.view.animation.PathInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

/**
 * THE OPENING ON ANDROID (founder's ruling, 7 November 2026, replacing D68c:
 * "seriously animated, lovely and attractive"). The twin of `LaunchMark` in
 * `ios/App/App/ValloShell.swift`.
 *
 * Android's system splash holds the first frame until the page has parsed
 * (the splash plugin keeps it on screen), and it now shows the exact Vallo
 * mark, still, at the centre (`res/drawable/splash_icon.xml`). Under it this
 * overlay already holds the same mark at the same size and place, so when the
 * system splash goes nothing moves; then, when the page says it has painted
 * (`handoff`), the letters V A L L O slide down out from behind the mark one
 * after another on the iPhone's timings (60 ms apart, 420 ms each, the
 * entrance curve), the version line fades in at the foot, and the overlay
 * fades onto the page: about one second from the hand-over to the page.
 *
 * The ring cannot draw itself in here as it does on the iPhone: the mark is
 * already on screen in the system splash, and undrawing it to draw it again
 * would be a flicker. So Android's opening is the system's own convention
 * (the mark on the splash) carried into Vallo's own reveal.
 *
 * It never takes a touch (not clickable, not focusable, hidden from
 * accessibility), so a tap lands on the page under it. With animations
 * switched off in the system's settings it simply goes when the page is
 * ready. If the page never says so, it goes after `CEILING_MS` by itself.
 *
 * Built, NOT tested on a device: no Android SDK runs in this repository.
 */
final class LaunchMark {
    private static final int GROUND = Color.rgb(1, 1, 24);
    /** The letters' timings, shared with the iPhone (launch-sequence.test.ts). */
    static final long LETTER_STEP_MS = 60;
    static final long LETTER_MS = 420;
    static final long VERSION_DELAY_MS = 200;
    static final long VERSION_MS = 300;
    static final long HOLD_MS = 120;
    static final long FADE_MS = 220;
    /** If the page never hands over, the overlay goes by itself. */
    static final long CEILING_MS = 6000;
    private static final int[] LETTERS = {
        R.drawable.launch_letter_v,
        R.drawable.launch_letter_a,
        R.drawable.launch_letter_l1,
        R.drawable.launch_letter_l2,
        R.drawable.launch_letter_o,
    };

    private static FrameLayout ground;
    private static ImageView[] letters;
    private static TextView version;
    private static boolean revealed;

    private LaunchMark() {}

    private static int dp(Activity a, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, a.getResources().getDisplayMetrics()));
    }

    static void show(final Activity activity) {
        if (ground != null) return;
        try {
            FrameLayout g = new FrameLayout(activity);
            g.setBackgroundColor(GROUND);
            g.setClickable(false);
            g.setFocusable(false);
            g.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);

            ImageView mark = new ImageView(activity);
            mark.setImageResource(R.drawable.launch_mark);
            mark.setScaleType(ImageView.ScaleType.FIT_XY);
            FrameLayout.LayoutParams markLp = new FrameLayout.LayoutParams(dp(activity, 76), dp(activity, 65), Gravity.CENTER);
            g.addView(mark, markLp);

            FrameLayout word = new FrameLayout(activity);
            word.setClipChildren(true);
            word.setClipToPadding(true);
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
            revealed = false;
            new Handler(Looper.getMainLooper()).postDelayed(LaunchMark::handOff, CEILING_MS);
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

    /** The page has painted: reveal the wordmark, then hand over. Main thread. */
    static void handOff() {
        final FrameLayout g = ground;
        if (g == null || revealed) return;
        revealed = true;
        if (!animatorsOn()) {
            remove(g);
            return;
        }
        Interpolator entrance = new PathInterpolator(0.16f, 1f, 0.3f, 1f);
        for (int i = 0; i < letters.length; i++) {
            letters[i].animate().translationY(0f).setStartDelay(i * LETTER_STEP_MS).setDuration(LETTER_MS).setInterpolator(entrance).start();
        }
        version.animate().alpha(0.55f).setStartDelay(VERSION_DELAY_MS).setDuration(VERSION_MS).setInterpolator(entrance).start();
        long landed = (letters.length - 1) * LETTER_STEP_MS + LETTER_MS + HOLD_MS;
        g.animate()
            .alpha(0f)
            .setStartDelay(landed)
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
            letters = null;
            version = null;
        }
    }
}
