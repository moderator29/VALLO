/**
 * Gyroscope-driven parallax (9.2).
 *
 * Sets `--nf-tilt-x` and `--nf-tilt-y` on `document.documentElement` from the
 * device's orientation sensor, so any element with `.nf-gyro-tilt` gets a
 * subtle parallax shift. The CSS in `premium-motion-2.css` reads these and
 * translates `0.6px * value`, which at the clamp below means at most 9px of
 * travel. Without the sensor, the properties stay at 0 and nothing moves.
 *
 * Call `startGyroTilt()` once from a client component. It returns a cleanup
 * function. The listener respects reduced motion: if `motionQuiet()` is true
 * at call time, it bails immediately.
 */
import { motionQuiet } from "./gate";

const CLAMP = 15;

export function startGyroTilt(): () => void {
  if (typeof window === "undefined") return () => {};
  if (motionQuiet()) return () => {};
  if (!("DeviceOrientationEvent" in window)) return () => {};

  const root = document.documentElement;
  let baseGamma: number | null = null;
  let baseBeta: number | null = null;

  const onOrientation = (e: DeviceOrientationEvent) => {
    const gamma = e.gamma ?? 0;
    const beta = e.beta ?? 0;

    if (baseGamma === null) {
      baseGamma = gamma;
      baseBeta = beta;
    }

    const dx = Math.max(-CLAMP, Math.min(CLAMP, gamma - baseGamma));
    const dy = Math.max(-CLAMP, Math.min(CLAMP, beta - (baseBeta ?? 0)));

    root.style.setProperty("--nf-tilt-x", String(Math.round(dx)));
    root.style.setProperty("--nf-tilt-y", String(Math.round(dy)));
  };

  window.addEventListener("deviceorientation", onOrientation, { passive: true });

  return () => {
    window.removeEventListener("deviceorientation", onOrientation);
    root.style.removeProperty("--nf-tilt-x");
    root.style.removeProperty("--nf-tilt-y");
  };
}
