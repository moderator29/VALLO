"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { MediaPill } from "@/components/ui/MediaPill";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { banner } from "@/lib/ui/toast";
import { feedback } from "@/lib/ui/feedback";

/**
 * THE SHARE COMPOSER (the founder, 9 November 2026, from the pump.fun share
 * surface). The thing you are sharing becomes one clean card on a chosen
 * background, with the two capsule controls underneath: "Background", which
 * shows the picked ground inside itself, and "Share", which sends. What leaves
 * the app is a short Vallo link, never a long one.
 *
 * It renders the card as styled HTML so the preview and the forwarded image
 * are the same design. The card's entrance is a spring once on open and is off
 * under reduced motion.
 */

export type ShareBackground =
  | { id: string; label: string; kind: "aurora"; variant: "brand" | "glow" | "ink" }
  | { id: string; label: string; kind: "image"; src: string };

export type ShareStat = { label: string; value: string };

export type ShareSubject = {
  /** The round media at the top of the card: a face or a cover. */
  avatar?: string;
  /** The handle chip under the avatar (@name, or an area). */
  handle?: string;
  /** The big line: a name, a title, a headline number. */
  headline: string;
  stats?: ShareStat[];
  /** The clean link this card points at, e.g. /u/ada or /roommates/r/abc. */
  url: string;
};

const DEFAULT_BG: ShareBackground[] = [
  { id: "glow", label: "Brand glow", kind: "aurora", variant: "glow" },
  { id: "brand", label: "Brand", kind: "aurora", variant: "brand" },
  { id: "ink", label: "Night", kind: "aurora", variant: "ink" },
];

export function ShareComposer({
  subject,
  backgrounds = DEFAULT_BG,
  copy,
}: {
  subject: ShareSubject;
  backgrounds?: ShareBackground[];
  copy?: { share?: string; background?: string; stats?: string; handle?: string; copied?: string };
}) {
  const reduce = useReducedMotion();
  const [bgId, setBgId] = useState(backgrounds[0]?.id);
  const [showStats, setShowStats] = useState(true);
  const [showHandle, setShowHandle] = useState(true);
  const bg = backgrounds.find((b) => b.id === bgId) ?? backgrounds[0];
  const t = {
    share: copy?.share ?? "Share",
    background: copy?.background ?? "Background",
    stats: copy?.stats ?? "Stats",
    handle: copy?.handle ?? "Name",
    copied: copy?.copied ?? "Link copied",
  };

  const cycleBackground = () => {
    const i = backgrounds.findIndex((b) => b.id === bgId);
    setBgId(backgrounds[(i + 1) % backgrounds.length]?.id);
    feedback("select");
  };

  const share = () => {
    feedback("confirm");
    const url = typeof window !== "undefined" ? `${window.location.origin}${subject.url}` : subject.url;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator.share({ title: subject.headline, url }).catch(() => {});
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      banner.success(t.copied);
      return;
    }
    banner.info(url);
  };

  const bgMediaForPill =
    bg?.kind === "image" ? { src: bg.src, alt: "" } : <span className={`nf-media-pill__swatch nf-aurora--${bg?.kind === "aurora" ? bg.variant : "glow"}`} aria-hidden style={{ width: "100%", height: "100%", borderRadius: "999px", display: "block" }} />;

  return (
    <div className="nf-share">
      <div className="nf-share__stage">
        <motion.div
          className="nf-share-card"
          initial={reduce ? false : { opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="nf-share-card__bg">
            {bg?.kind === "image" ? (
              <Image src={bg.src} alt="" fill sizes="320px" />
            ) : (
              <span className={`nf-aurora nf-aurora--${bg?.kind === "aurora" ? bg.variant : "glow"}`} />
            )}
          </div>
          <div className="nf-share-card__body">
            {subject.avatar ? (
              <span className="nf-share-card__avatar">
                <Image src={subject.avatar} alt="" fill sizes="88px" />
              </span>
            ) : null}
            {showHandle && subject.handle ? <span className="nf-share-card__handle">{subject.handle}</span> : null}
            <span className="nf-share-card__headline">{subject.headline}</span>
            {showStats && subject.stats?.length ? (
              <span className="nf-share-card__stats">
                {subject.stats.map((s, i) => (
                  <span className="nf-share-card__stat-group" key={s.label} style={{ display: "contents" }}>
                    {i > 0 ? <span className="nf-share-card__stat-divider" aria-hidden /> : null}
                    <span className="nf-share-card__stat">
                      <b>{s.value}</b>
                      <span>{s.label}</span>
                    </span>
                  </span>
                ))}
              </span>
            ) : null}
            <span className="nf-share-card__brand">
              <Image src="/brand/vallo-mark.svg" alt="" width={18} height={16} />
              Vallo
            </span>
          </div>
        </motion.div>
      </div>

      <div className="nf-share__swatches" role="group" aria-label={t.background}>
        {backgrounds.map((b) => (
          <button
            key={b.id}
            type="button"
            className="nf-swatch"
            aria-pressed={b.id === bgId}
            aria-label={b.label}
            onClick={() => {
              setBgId(b.id);
              feedback("select");
            }}
          >
            {b.kind === "image" ? <Image src={b.src} alt="" fill sizes="52px" /> : <span className={`nf-aurora nf-aurora--${b.variant}`} />}
          </button>
        ))}
      </div>

      <div className="nf-share__toggles">
        {subject.stats?.length ? (
          <MediaPill
            label={t.stats}
            tone="light"
            pressed={showStats}
            onClick={() => {
              setShowStats((v) => !v);
              feedback("select");
            }}
            media={<UiIcon name={showStats ? "check" : "close"} size={18} />}
            trailing={<span className="nf-media-pill__chev">{showStats ? "On" : "Off"}</span>}
          />
        ) : null}
        {subject.handle ? (
          <MediaPill
            label={t.handle}
            tone="light"
            pressed={showHandle}
            onClick={() => {
              setShowHandle((v) => !v);
              feedback("select");
            }}
            media={<UiIcon name={showHandle ? "check" : "close"} size={18} />}
            trailing={<span className="nf-media-pill__chev">{showHandle ? "On" : "Off"}</span>}
          />
        ) : null}
      </div>

      <div className="nf-share__actions">
        <MediaPill label={t.background} sub={bg?.label} media={bgMediaForPill} onClick={cycleBackground} trailingIcon="chevron-right" />
        <MediaPill label={t.share} tone="brand" media={<UiIcon name="share" size={18} />} trailingIcon="arrow-right" onClick={share} />
      </div>
    </div>
  );
}
