"use client";

import Image from "next/image";
import { useState } from "react";

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

/** A card variant: a tab that changes what the card leads with. */
export type ShareLead = { id: string; label: string; headline: string; sub?: string };

export type ShareSubject = {
  /** The round media at the top of the card: a face or a cover. */
  avatar?: string;
  /** When there is no avatar, the initials tile is drawn from this name (never a gap). */
  initial?: string;
  /** The handle chip under the avatar (@name, or an area). */
  handle?: string;
  /** The big line: a name, a title, a headline number. */
  headline: string;
  stats?: ShareStat[];
  /** Optional lead tabs (Profile / Stats, Listing / Price): each sets the headline. */
  leads?: ShareLead[];
  /** The clean link this card points at, e.g. /u/ada or /roommates/r/abc. */
  url: string;
};

/** A steady tone per name, so the same person always wears the same colour. */
function toneOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % 5;
}

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
  copy?: { share?: string; background?: string; stats?: string; handle?: string; copied?: string; yours?: string; presets?: string; darken?: string };
}) {
  const [bgId, setBgId] = useState(backgrounds[0]?.id);
  const [showStats, setShowStats] = useState(true);
  const [showHandle, setShowHandle] = useState(true);
  const [leadId, setLeadId] = useState(subject.leads?.[0]?.id);
  const [darken, setDarken] = useState(false);
  const bg = backgrounds.find((b) => b.id === bgId) ?? backgrounds[0];
  /* The "Yours / Presets" split (SHARE_AND_CONTROLS.md section 5.1): a member's
     own photos on one tab, the Vallo aurora presets on the other. */
  const ownBgs = backgrounds.filter((b) => b.kind === "image");
  const presetBgs = backgrounds.filter((b) => b.kind === "aurora");
  const hasSplit = ownBgs.length > 0 && presetBgs.length > 0;
  const [bgGroup, setBgGroup] = useState<"yours" | "presets">(ownBgs.length > 0 ? "yours" : "presets");
  const shownBgs = hasSplit ? (bgGroup === "yours" ? ownBgs : presetBgs) : backgrounds;
  const lead = subject.leads?.find((l) => l.id === leadId) ?? subject.leads?.[0] ?? null;
  const headline = lead?.headline ?? subject.headline;
  const t = {
    share: copy?.share ?? "Share",
    background: copy?.background ?? "Background",
    stats: copy?.stats ?? "Stats",
    handle: copy?.handle ?? "Name",
    copied: copy?.copied ?? "Link copied",
    yours: copy?.yours ?? "Yours",
    presets: copy?.presets ?? "Presets",
    darken: copy?.darken ?? "Darken",
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
      void navigator.share({ title: headline, url }).catch(() => {});
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
      {subject.leads && subject.leads.length > 1 ? (
        <div className="nf-share__tabs" role="tablist" aria-label={t.background}>
          {subject.leads.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === (lead?.id ?? "")}
              className="nf-share__tab"
              onClick={() => {
                setLeadId(l.id);
                feedback("select");
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="nf-share__stage">
        <div className="nf-share-card nf-share-card--enter">
          <div className="nf-share-card__bg">
            {bg?.kind === "image" ? (
              <>
                <Image src={bg.src} alt="" fill sizes="320px" />
                {darken ? <span className="nf-share-card__darken" aria-hidden /> : null}
              </>
            ) : (
              <span className={`nf-aurora nf-aurora--${bg?.kind === "aurora" ? bg.variant : "glow"}`} />
            )}
          </div>
          <div className="nf-share-card__body">
            {subject.avatar ? (
              <span className="nf-share-card__avatar">
                <Image src={subject.avatar} alt="" fill sizes="88px" />
              </span>
            ) : subject.initial ? (
              <span className="nf-share-card__avatar nf-share-card__initial" data-tone={toneOf(subject.initial)}>
                {Array.from(subject.initial.trim())[0]?.toLocaleUpperCase() ?? "V"}
              </span>
            ) : null}
            {showHandle && subject.handle ? <span className="nf-share-card__handle">{subject.handle}</span> : null}
            <span className="nf-share-card__headline">{headline}</span>
            {lead?.sub ? <span className="nf-share-card__sub">{lead.sub}</span> : null}
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
        </div>
      </div>

      {hasSplit ? (
        <div className="nf-share__bgtabs" role="tablist" aria-label={t.background}>
          <button type="button" role="tab" aria-selected={bgGroup === "yours"} className="nf-share__tab" onClick={() => { setBgGroup("yours"); setBgId(ownBgs[0]?.id); feedback("select"); }}>
            {t.yours}
          </button>
          <button type="button" role="tab" aria-selected={bgGroup === "presets"} className="nf-share__tab" onClick={() => { setBgGroup("presets"); setBgId(presetBgs[0]?.id); feedback("select"); }}>
            {t.presets}
          </button>
        </div>
      ) : null}
      <div className="nf-share__swatches" role="group" aria-label={t.background}>
        {shownBgs.map((b) => (
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
        {bg?.kind === "image" ? (
          <MediaPill
            label={t.darken}
            tone="light"
            pressed={darken}
            onClick={() => {
              setDarken((v) => !v);
              feedback("select");
            }}
            media={<UiIcon name={darken ? "check" : "close"} size={18} />}
            trailing={<span className="nf-media-pill__chev">{darken ? "On" : "Off"}</span>}
          />
        ) : null}
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
