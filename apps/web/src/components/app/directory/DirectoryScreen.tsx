"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { ScopeToggle, useFlip } from "@/components/app/leaderboard/parts";
import { ButtonLink } from "@/components/ui/Button";
import { RemoteImage } from "@/components/ui/RemoteImage";
import { Segmented } from "@/components/ui/Segmented";
import { useMotionGate } from "@/components/motion/useMotionGate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { solidSrc } from "@/design-system/icons/object-assets";
import {
  DIRECTORY_COPY,
  KIND_ONE,
  KIND_PLURAL,
  SIDE_KINDS,
  emptyDirectoryTitle,
  entryHref,
  factLine,
  filterEntries,
  type DirEntry,
  type DirFilter,
} from "@/lib/directory/model";
import type { DirectoryRead } from "@/lib/directory/read";
import { monogram, type Scope } from "@/lib/leaderboard/model";
import type { Side } from "@/lib/side.constants";
import "@/components/app/leaderboard/leaderboard.css";
import "@/components/app/leaderboard/leaderboard-motion.css";
import "./directory.css";

/**
 * /directory: ONE DIRECTORY THAT FLIPS WITH THE SIDE (D76).
 *
 * The same card, search, filters and City / Global pill on both sides; only
 * who is listed changes. The card borrows the identity header's grammar
 * (IdentityHeader.tsx): the rounded-square face or the initials, the name
 * with its one verified mark, the kind and the place, then real counts. No
 * rating, review or count is invented; a newcomer reads "New on Vallo".
 */
export function DirectoryScreen({ side, read }: { side: Side; read: DirectoryRead }) {
  const { quiet } = useMotionGate();
  const copy = DIRECTORY_COPY[side];
  const [scope, setScope] = useState<Scope>("city");
  const [filter, setFilter] = useState<DirFilter>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(
    () => filterEntries(read.state === "ready" ? (scope === "city" ? read.city : read.global) : [], filter, query),
    [read, scope, filter, query],
  );
  const gridRef = useRef<HTMLUListElement | null>(null);
  useFlip(gridRef, shown, quiet);
  const filters = [{ value: "all" as DirFilter, label: "All" }, ...SIDE_KINDS[side].map((k) => ({ value: k as DirFilter, label: KIND_PLURAL[k] }))];
  const boardHref = side === "property" ? "/leaderboard?board=top&sub=property" : "/leaderboard?board=top&sub=hotels";

  return (
    <div className="nf-dir" data-testid="directory" data-side={side}>
      <PageHeader variant="large" title={copy.title} subtitle={copy.lede} fallback={side === "stays" ? "/stays" : "/home"} />

      <div className="nf-dir__tools">
        <label className="nf-dir__search">
          <UiIcon name="search" size={18} />
          <span className="sr-only">{copy.search}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            enterKeyHint="search"
            autoComplete="off"
            data-testid="dir-search"
          />
        </label>
        <Segmented<DirFilter> label="Show" options={filters} value={filter} onChange={setFilter} shape="pill" size="sm" variant="quiet" full />
      </div>

      <ScopeToggle scope={scope} onChange={setScope} placeName={read.place.name} />

      <Link href={boardHref} className="nf-dir__board">
        <UiIcon name="trending-up" size={18} />
        <span>{side === "property" ? "See the top agents this month" : "See the top hotels this month"}</span>
        <UiIcon name="chevron-right" size={16} />
      </Link>

      {read.state !== "ready" ? (
        <DirEmpty
          side={side}
          title={read.state === "not-live" ? "The directory opens soon" : "The directory did not load"}
          body={
            read.state === "not-live"
              ? "It is built and waiting for its switch. It will list only real, approved people and published businesses."
              : "Nothing is wrong with your account. Try again in a moment."
          }
          cta={null}
        />
      ) : shown.length === 0 ? (
        <DirEmpty
          side={side}
          title={query ? `Nobody matches "${query.trim()}"` : emptyDirectoryTitle(side, filter, scope, read.place.name)}
          body={
            query
              ? "Try a shorter name, an area, or Global."
              : scope === "city"
                ? `Try Global to see everyone on Vallo, or be the first in ${read.place.name}.`
                : "Be the first. Verification is free and takes a few minutes."
          }
          cta={copy.emptyCta}
        />
      ) : (
        <ul className="nf-dir__grid" data-testid="dir-cards" ref={gridRef}>
          {shown.map((e, i) => {
            const key = `${e.kind}:${e.ref ?? e.name}`;
            return (
              <li key={key} data-flip={key} className="nf-dir__li" style={{ "--lb-delay": `${Math.min(i, 5) * 60}ms` } as CSSProperties}>
                <DirCard entry={e} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DirCard({ entry }: { entry: DirEntry }) {
  const href = entryHref(entry);
  const where = [entry.area, entry.placeName].filter(Boolean).join(", ");
  const inner = (
    <>
      <span className="nf-dir__face" aria-hidden="true">
        {entry.avatarUrl ? <RemoteImage src={entry.avatarUrl} alt="" width={56} height={56} sizes="56px" /> : monogram(entry.name)}
      </span>
      <span className="nf-dir__main">
        <span className="nf-dir__name">
          <span className="nf-dir__name-text">{entry.name}</span>
          {entry.verified ? <UiIcon name="verified-badge" size={16} label="Verified" className="nf-dir__verified" /> : null}
        </span>
        <span className="nf-dir__sub">{[KIND_ONE[entry.kind], where].filter(Boolean).join(" · ")}</span>
        <span className="nf-dir__fact">{factLine(entry)}</span>
      </span>
      {href ? <UiIcon name="chevron-right" size={16} className="nf-dir__chev" /> : null}
    </>
  );
  return href ? (
    <Link href={href} className="nf-dir__card">
      {inner}
    </Link>
  ) : (
    <div className="nf-dir__card">{inner}</div>
  );
}

function DirEmpty({
  side,
  title,
  body,
  cta,
}: {
  side: Side;
  title: string;
  body: string;
  cta: { label: string; href: string } | null;
}) {
  return (
    <div className="nf-lb__empty nf-dir__empty" data-testid="dir-empty">
      <Image
        className="nf-lb__object"
        src={solidSrc(side === "property" ? "user-verified" : "hotel-star")}
        alt=""
        width={88}
        height={88}
        aria-hidden="true"
      />
      <h2>{title}</h2>
      <p>{body}</p>
      {cta ? (
        <ButtonLink href={cta.href} variant="primary" shape="pill" className="nf-dir__cta">
          {cta.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
