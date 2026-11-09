"use client";

import { banner } from "@/lib/ui/toast";
import { State } from "@/components/ui/State";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { assignFirmListing, setFirmRouting } from "@/lib/firm/actions";
import type { FirmListing, FirmMember, FirmRouting } from "@/lib/firm/queries";
import { Icon3D } from "@/components/ui/Icon3D";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-99: THE FIRM DESK. Every open listing under the firm with who handles it
 * (reassigned in one change of the select), the team with how many enquiries
 * were routed to each in thirty days, and the routing rule. States: could not
 * be read, no listings, the desk, saving, saved, refused in words.
 */

type Copy = Dictionary["frontDoor"]["firm"];

function AssignRow({ listing, team, copy }: { listing: FirmListing; team: FirmMember[]; copy: Copy }) {
  const router = useRouter();
  const [value, setValue] = useState(listing.assignedAgentId ?? "");
  const [pending, start] = useSafeTransition();
  return (
    <li className="flex flex-col gap-2xs border-t border-[var(--nf-border-subtle)] pt-row first:border-t-0 first:pt-0">
      <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]">{listing.title}</p>
      <p className="nf-caption text-[var(--nf-content-muted)]">
        {[listing.area, copy.enquiries.replace("{count}", String(listing.enquiries30d))].filter(Boolean).join(" · ")}
      </p>
      <label className="block">
        <span className="nf-label">{copy.assignedTo}</span>
        <select
          className="nf-field"
          value={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            start(async () => {
              try {
                const result = await assignFirmListing({ listingId: listing.listingId, agentId: next === "" ? null : next });
                /* Said by the one banner at the top of the screen (Grade 1). */
                if (result.ok) banner.success(copy.saved);
                else banner.error(result.error);
                if (result.ok) router.refresh();
                else setValue(listing.assignedAgentId ?? "");
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
        >
          <option value="">{copy.unassigned}</option>
          {team.map((m) => (
            <option key={m.agentId} value={m.agentId}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}

export function FirmDesk({
  firmId,
  listings,
  team,
  routing,
  areas,
  copy,
}: {
  firmId: string;
  listings: FirmListing[] | null;
  team: FirmMember[] | null;
  routing: FirmRouting | null;
  /** The closed-list neighbourhoods the firm's listings sit in, for the area map. */
  areas: string[];
  copy: Copy;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<FirmRouting["mode"]>(routing?.mode ?? "lister");
  const [areaAgents, setAreaAgents] = useState<Record<string, string>>(routing?.areaAgents ?? {});
  const [officeStart, setOfficeStart] = useState(routing?.officeStart ?? "09:00");
  const [officeEnd, setOfficeEnd] = useState(routing?.officeEnd ?? "17:00");
  const [pending, start] = useSafeTransition();

  if (listings === null || team === null) {
    return <p className="nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>;
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="firm-desk">
      <section className="nf-panel nf-panel--card p-card-sm" aria-labelledby="firm-listings-title">
        <div className="flex items-center gap-sm">
          <span className="grid size-10 shrink-0 place-items-center" aria-hidden="true" data-art="keys">
            <Icon3D name="keys" size={40} />
          </span>
          <h2 id="firm-listings-title" className="nf-h4 text-[var(--nf-content-primary)]">
            {copy.listingsTitle}
          </h2>
        </div>
        {listings.length === 0 ? (
          <State compact kind="empty" icon="keys-home" title={copy.listingsEmpty} className="mt-group" />
        ) : (
          <ul className="mt-group flex flex-col gap-row">
            {listings.map((listing) => (
              <AssignRow key={listing.listingId} listing={listing} team={team} copy={copy} />
            ))}
          </ul>
        )}
      </section>

      <section className="nf-panel nf-panel--card p-card-sm" aria-labelledby="firm-team-title">
        <div className="flex items-center gap-sm">
          <span className="grid size-10 shrink-0 place-items-center" aria-hidden="true" data-art="team">
            <Icon3D name="team" size={40} />
          </span>
          <h2 id="firm-team-title" className="nf-h4 text-[var(--nf-content-primary)]">
            {copy.teamTitle}
          </h2>
        </div>
        <ul className="mt-group flex flex-col gap-xs">
          {team.map((m) => (
            <li key={m.agentId} className="flex justify-between gap-sm nf-body-sm text-[var(--nf-content-primary)]">
              <span>
                {m.name} <span className="nf-caption text-[var(--nf-content-muted)]">{copy.roles[m.role === "principal" ? "principal" : "staff"]}</span>
              </span>
              <span className="nf-caption text-[var(--nf-content-muted)]">{copy.routed.replace("{count}", String(m.routed30d))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-group nf-caption text-[var(--nf-content-muted)]">{copy.leaving}</p>
      </section>

      <section className="nf-panel nf-panel--card p-card-sm flex flex-col gap-row" aria-labelledby="firm-routing-title">
        <h2 id="firm-routing-title" className="nf-h4 text-[var(--nf-content-primary)]">
          {copy.routingTitle}
        </h2>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.routingNote}</p>
        {routing === null ? (
          /* A failed read never offers Save: saving the defaults shown here
             would overwrite the stored rule. */
          <p className="nf-body-sm text-[var(--nf-content-muted)]" role="status">
            {copy.unreachable}
          </p>
        ) : (
          <>
        <fieldset className="flex flex-col gap-xs">
          {(["lister", "area", "round_robin"] as const).map((m) => (
            <label key={m} className="flex items-center gap-sm nf-body-sm text-[var(--nf-content-primary)]">
              <input type="radio" name="firm-mode" checked={mode === m} onChange={() => setMode(m)} />
              {copy.modes[m]}
            </label>
          ))}
        </fieldset>
        {mode === "area" &&
          areas.map((area) => (
            <label key={area} className="block">
              <span className="nf-label">{copy.areaRow.replace("{area}", area)}</span>
              <select
                className="nf-field"
                value={areaAgents[area] ?? ""}
                onChange={(e) => {
                  const next = { ...areaAgents };
                  if (e.target.value === "") delete next[area];
                  else next[area] = e.target.value;
                  setAreaAgents(next);
                }}
              >
                <option value="">{copy.unassigned}</option>
                {team.map((m) => (
                  <option key={m.agentId} value={m.agentId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        {mode === "round_robin" && (
          <div className="grid grid-cols-2 gap-row">
            <label className="block">
              <span className="nf-label">{copy.officeFrom}</span>
              <input type="time" className="nf-field" value={officeStart} onChange={(e) => setOfficeStart(e.target.value)} />
            </label>
            <label className="block">
              <span className="nf-label">{copy.officeTo}</span>
              <input type="time" className="nf-field" value={officeEnd} onChange={(e) => setOfficeEnd(e.target.value)} />
            </label>
          </div>
        )}
        <Button
          variant="primary"
          loading={pending}
          onClick={() => {
            start(async () => {
              try {
                const result = await setFirmRouting({ firmId, mode, areaAgents, officeStart, officeEnd });
                /* Said by the one banner at the top of the screen (Grade 1). */
                if (result.ok) banner.success(copy.saved);
                else banner.error(result.error);
                if (result.ok) router.refresh();
              } catch (error) {
                if (!tapFailedOffline(error)) throw error;
              }
            });
          }}
        >
          {pending ? copy.saving : copy.saveRouting}
        </Button>
          </>
        )}
      </section>
    </div>
  );
}
