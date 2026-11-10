"use client";

import { useState } from "react";

import { UiIcon } from "@/design-system/icons/UiIcon";

import "./roommates-kit.css";
import "./institution-logo.css";

/** The https check every logo goes through; anything else shows the fallback. */
export function usableLogoUrl(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  return u.startsWith("https://") ? u : null;
}

/**
 * A school's logo in a rounded plate. The picture is decorative (the school's
 * name sits beside it), so alt is empty. When there is no logo, or the image
 * fails to load, the plate falls back to the id-card glyph the school rows
 * already use.
 */
export function InstitutionLogo({ name, logoUrl, size = 40 }: { name: string; logoUrl: string | null | undefined; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = usableLogoUrl(logoUrl);
  const showImage = url !== null && failed !== url;
  const px = `${size / 16}rem`;
  if (!showImage) {
    return (
      <span className="nf-rm-plate" aria-hidden="true" data-school={name} style={{ inlineSize: px, blockSize: px }}>
        <UiIcon name="id-card" size={Math.round(size * 0.45)} />
      </span>
    );
  }
  return (
    <span className="nf-rm-logo" aria-hidden="true" data-school={name} style={{ ["--nf-rm-logo-size" as string]: px }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small remote logo, host is named in img-src */}
      <img className="nf-rm-logo__img" src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
    </span>
  );
}
