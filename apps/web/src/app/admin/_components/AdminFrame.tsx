import type { ReactNode } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import { LogoMark } from "@/design-system/brand/Logo";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  AdminRail,
  AdminRailFoot,
  AdminTabs,
  ConsoleSearch,
  IdentityBlock,
  type AdminIdentity,
} from "./AdminNav";
import { ConsoleClock } from "./ConsoleClock";
import { ConsolePalette, type PaletteCopy } from "./ConsolePalette";
import { RootFlag } from "@/components/ui/RootFlag";
import "./admin-material.css";

/**
 * The console chrome, drawn from what the layout hands it and nothing else,
 * so the access gate and the reads stay in `admin/layout.tsx` and the frame
 * can be drawn on its own.
 */
export function AdminFrame({
  identity,
  counts,
  unread,
  navLabel,
  navLabels,
  searchLabel,
  bellLabel,
  shell,
  back,
  experience,
  children,
}: {
  identity: AdminIdentity;
  counts: Record<string, number>;
  unread: number;
  navLabel: string;
  navLabels?: Dictionary["admin"]["nav"];
  searchLabel: string;
  bellLabel: string;
  /** The console's own copy (`admin.shell`), in the reader's language. */
  shell?: Dictionary["admin"]["shell"];
  /**
   * The console's back control (R14), mounted by `admin/layout.tsx`: the
   * shared `BackButton`, which goes to the route's declared parent in
   * `lib/nav/route-parents.ts` (every desk to `/admin`, a record to its desk).
   * It leads the top bar, where the render's rhythm puts the first control.
   */
  back?: ReactNode;
  /**
   * Session 3's console copy (`experienceAdmin`): the palette's words and the
   * one line each desk carries. Optional so a frame drawn without it (a test,
   * an older harness) still renders the rail and the bar exactly as before,
   * only without the palette.
   */
  experience?: {
    palette: PaletteCopy;
    deskLedes: Readonly<Record<string, string | undefined>>;
    waitingTotal: string;
  };
  children: ReactNode;
}) {
  const badges = counts;
  const brand = (
    <Link href="/admin" className="nf-admin-brand" aria-label={shell?.nav.brandHome ?? "Vallo console overview"}>
      <LogoMark size={40} />
      <span className="nf-admin-brand__word" aria-hidden="true">
        Vallo
      </span>
    </Link>
  );

  return (
    <div className="nf-admin">
      {/* `data-admin` on <html>: the console keeps its scrollbar lane (admin.css). */}
      <RootFlag name="admin" />
      {/* The rail is a full-height lit column as every render draws it: the
          aside stretches the whole page, and its contents ride a sticky inner
          column the viewport's height, so Settings and the operator stay
          pinned at the foot however far the desk scrolls. */}
      <aside className="nf-admin-rail" aria-label={navLabel}>
        <div className="nf-admin-rail__inner">
          <div className="nf-admin-rail__brand">{brand}</div>
          <div className="nf-admin-rail__scroll">
            <AdminRail counts={badges} labels={navLabels} navLabel={navLabel} shell={shell} />
          </div>
          <AdminRailFoot identity={identity} counts={badges} shell={shell} />
        </div>
      </aside>

      <div className="nf-admin-main nf-soft-top">
        <header className="nf-admin-bar nf-safe-top">
          <AdminTabs
            counts={badges}
            labels={navLabels}
            shell={shell}
            navLabel={navLabel}
            identity={identity}
            brand={brand}
            ledes={experience?.deskLedes}
            waitingText={experience?.waitingTotal}
          />
          {back && <span className="nf-admin-bar__back">{back}</span>}
          <span className="nf-admin-bar__brand">{brand}</span>
          <ConsoleSearch
            label={searchLabel}
            placeholder={shell?.bar.search ?? "Search anything..."}
            hint={experience?.palette.shortcut}
          />
          {experience && (
            <ConsolePalette copy={experience.palette} ledes={experience.deskLedes} counts={badges} shell={shell} />
          )}
          <span className="nf-admin-bar__spacer" />
          <ConsoleClock />
          <Link
            href="/notifications"
            className="nf-admin-icon-btn nf-admin-bell nf-icon-btn nf-icon-btn--round"
            aria-label={
              unread > 0
                ? `${bellLabel}, ${unread} unread`
                : bellLabel
            }
          >
            <UiIcon name="bell" size={20} />
            {unread > 0 && <span className="nf-admin-bell__dot" aria-hidden="true" />}
          </Link>
          <span className="nf-admin-bar__me">
            <IdentityBlock identity={identity} compact />
          </span>
        </header>

        <main id="main" className="nf-admin-body">
          {children}
        </main>
      </div>
    </div>
  );
}
