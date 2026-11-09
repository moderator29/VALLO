"use client";

import { useMemo } from "react";
import { encodeQr, qrPath } from "@/lib/crypto/qr";

/**
 * The deposit address as a QR code, drawn locally as one SVG path.
 *
 * Encoded in the browser by `lib/crypto/qr.ts`, never by an image service:
 * sending a deposit address to somebody else's server to draw it would hand
 * them the payment. Dark modules on a white plate with a four-module quiet
 * zone in BOTH themes, because a camera reads dark-on-light and an inverted
 * code is the commonest reason one does not scan.
 */
export function QrCode({ value, label, size = 208 }: { value: string; label: string; size?: number }) {
  const drawn = useMemo(() => {
    try {
      const matrix = encodeQr(value);
      return { path: qrPath(matrix), units: matrix.size + 8 };
    } catch {
      return null;
    }
  }, [value]);
  if (!drawn) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${drawn.units} ${drawn.units}`}
      shapeRendering="crispEdges"
      className="rounded-md bg-[var(--nf-surface-on-paper)]"
    >
      <path d={drawn.path} fill="var(--nf-content-on-paper)" />
    </svg>
  );
}
