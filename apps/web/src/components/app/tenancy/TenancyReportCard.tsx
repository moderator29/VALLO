"use client";

import { banner } from "@/lib/ui/toast";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ROOM_COPY, ROOM_ITEMS, type RoomItem } from "@/lib/inspections/report";
import { formatMoneyDate } from "@/lib/money/dates";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import type { TenancyReportView } from "@/lib/tenancy/queries";
import { addTenancyReportPhoto, countersignTenancyReport, saveTenancyReport } from "@/lib/tenancy/actions";
import { uploadToStorage } from "@/lib/media/upload";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["tenancy"];

/**
 * One tenancy report, move-in or move-out. V-54.
 *
 * The same eight rooms the viewing report ticks, so a move-out reads against
 * the move-in item by item. Each party writes their own record of each
 * stage; the author ticks, notes and photographs, and the other party
 * countersigns once it is submitted. After submission the report
 * is fixed: the database refuses any change but the countersignature.
 *
 * Photos go straight from the browser to the private `tenancy-evidence`
 * bucket under `<tenancy>/<report>/<file>`, which is the permission the
 * bucket's policy checks, and the row that records them is added only once
 * the upload came back.
 */
export function TenancyReportCard({
  tenancyId,
  report,
  copy,
  locale,
  canWrite,
}: {
  tenancyId: string;
  report: TenancyReportView;
  copy: Copy;
  locale: Locale;
  /** The viewer is a party (not staff) and the stage is open. */
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [items, setItems] = useState<Partial<Record<RoomItem, boolean>>>(report.items);
  const [notes, setNotes] = useState(report.notes ?? "");
  const [uploadFor, setUploadFor] = useState<RoomItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const status = report.status;
  const editing = canWrite && (status.kind === "open" || (status.kind === "draft" && report.authorIsViewer));
  const countersign =
    canWrite && !report.authorIsViewer && report.id !== null && (status.kind === "submitted" || status.kind === "not_answered");
  const ticked = ROOM_ITEMS.filter((room) => items[room]).length;
  const stageName = report.stage === "move_in" ? copy.moveIn : copy.moveOut;
  const title = (report.authorIsViewer ? copy.reportOwn : copy.reportOther).replace("{stage}", stageName);
  const day = (iso: string) => formatMoneyDate(iso, locale) ?? iso;

  const statusLine =
    status.kind === "not_open"
      ? copy.reportOpensOn.replace("{date}", day(status.opensOn))
      : status.kind === "draft"
        ? copy.reportDraft.replace("{who}", report.authorIsViewer ? copy.you : copy.otherParty)
        : status.kind === "submitted"
          ? copy.reportSubmitted.replace("{date}", day(status.submittedAt))
          : status.kind === "not_answered"
            ? copy.reportNotAnswered.replace("{date}", day(status.since))
            : status.kind === "countersigned"
              ? copy.reportCountersigned.replace("{date}", day(status.at))
              : null;

  function save(submit: boolean) {
    start(async () => {
      try {
        const result = await saveTenancyReport({
          tenancyId,
          stage: report.stage,
          items: ROOM_ITEMS.map((room) => ({ item: room, checked: items[room] === true })),
          notes,
          submit,
        });
        if (!result.ok) {
          banner.error(result.error);
          return;
        }
        banner.success(submit ? "Report submitted." : "Report saved.");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  async function upload(file: File) {
    if (!report.id) {
      banner.error(copy.failed);
      return;
    }
    const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${tenancyId}/${report.id}/${crypto.randomUUID()}.${extension}`;
    /* The browser client loads now, when a photo is chosen, not with the
       page (lib/supabase/load-client.ts); a chunk that cannot be fetched is
       the upload failure this card already says. */
    const supabase = await loadBrowserClient();
    if (!supabase) {
      banner.error(copy.failed);
      return;
    }
    const uploaded = await uploadToStorage({ supabase, bucket: "tenancy-evidence", path, body: file, contentType: file.type });
    if (!uploaded.ok) {
      banner.error(copy.failed);
      return;
    }
    const added = await addTenancyReportPhoto({ tenancyId, reportId: report.id, item: uploadFor, path });
    if (!added.ok) {
      banner.error(added.error);
      return;
    }
    router.refresh();
  }

  return (
    <article className="nf-panel nf-panel--card block p-md" data-testid={`tenancy-report-${report.stage}-${report.authorIsViewer ? "own" : "other"}`}>
      <h3 className="nf-h4">{title}</h3>
      {statusLine && <p className="nf-caption mt-2xs">{statusLine}</p>}

      <ul className="mt-sm grid gap-xs">
        {ROOM_ITEMS.map((room) => {
          const checked = items[room] === true;
          const photos = report.photos.filter((photo) => photo.item === room);
          return (
            <li key={room} className="flex items-start justify-between gap-sm">
              <label className="flex min-h-[44px] min-w-0 flex-1 items-start gap-sm">
                <input
                  type="checkbox"
                  className="mt-3xs h-5 w-5 shrink-0"
                  checked={checked}
                  disabled={!editing || pending}
                  onChange={(event) => setItems((now) => ({ ...now, [room]: event.target.checked }))}
                />
                <span className="min-w-0">
                  <span className="nf-body-sm block font-semibold text-[var(--nf-content-primary)]">
                    {ROOM_COPY[room].title}
                  </span>
                  {photos.length > 0 && (
                    <span className="nf-caption block">{copy.reportPhotos.replace("{count}", String(photos.length))}</span>
                  )}
                </span>
              </label>
              {editing && report.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setUploadFor(room);
                    fileRef.current?.click();
                  }}
                  aria-label={`${copy.reportAddPhoto}: ${ROOM_COPY[room].title}`}
                >
                  <UiIcon name="picture" size={16} />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {report.photos.some((photo) => photo.url) && (
        <ul className="mt-sm grid grid-cols-3 gap-xs">
          {report.photos
            .filter((photo) => photo.url)
            .slice(0, 12)
            .map((photo) => (
              <li key={photo.id} className="aspect-square overflow-hidden rounded-[var(--nf-radius-sm)]">
                {/* A signed, short-lived URL to a private object: never cached by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url ?? ""} alt={photo.item ? ROOM_COPY[photo.item].title : ""} className="h-full w-full object-cover" />
              </li>
            ))}
        </ul>
      )}

      {editing ? (
        <div className="mt-md grid gap-sm">
          <label className="nf-label" htmlFor={`notes-${report.stage}`}>
            {copy.reportNotes}
          </label>
          <textarea
            id={`notes-${report.stage}`}
            className="nf-field min-h-[5.5rem]"
            maxLength={4000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <div className="grid gap-sm sm:grid-cols-2">
            <Button variant="secondary" full disabled={pending} onClick={() => save(false)}>
              {report.id ? copy.reportSave : copy.reportWrite}
            </Button>
            <Button variant="primary" full disabled={pending || ticked < ROOM_ITEMS.length} onClick={() => save(true)}>
              {copy.reportSubmit}
            </Button>
          </div>
          {ticked < ROOM_ITEMS.length && <p className="nf-caption">{copy.reportNeedsEight}</p>}
        </div>
      ) : (
        report.notes && <p className="nf-body-sm mt-sm whitespace-pre-line">{report.notes}</p>
      )}

      {countersign && report.id && (
        <Button
          className="mt-md"
          variant="primary"
          full
          disabled={pending}
          onClick={() => {
            start(async () => {
              try {
                const result = await countersignTenancyReport({ tenancyId, reportId: report.id as string });
                if (!result.ok) banner.error(result.error);
                else router.refresh();
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
        >
          {copy.reportCountersign}
        </Button>
      )}

    </article>
  );
}
