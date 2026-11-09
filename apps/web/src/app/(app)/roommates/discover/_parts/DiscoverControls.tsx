"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { ChoiceChips } from "@/components/roommates/ChoiceChips";
import { naira } from "@/components/roommates/format";

import { STATE_OPTIONS, stateName } from "@/components/roommates/states";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { SelectField, TextField } from "@/components/ui/Field";
import { NairaField } from "@/components/ui/NairaField";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { saveRoommateSearch } from "@/lib/features/roommates/actions";
import {
  EMPTY_PEOPLE_FILTERS,
  EMPTY_ROOM_FILTERS,
  FURNISHED,
  GENDER_PREFS,
  INTENTS,
  LIFE_STAGES,
  LISTING_KINDS,
  PERIODS,
  ROOM_TYPES,
  type InstitutionRef,
  type PeopleFilters,
  type RoomFilters,
} from "@/lib/features/roommates/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { discoverHref, type Draft, type Mode } from "./href";

/** The filters both modes share, carried across the People | Rooms switch. */
function shared(f: Draft): Draft {
  return { q: f.q ?? "", stateCode: f.stateCode ?? null, city: f.city ?? null, institutionId: f.institutionId ?? null, maxMinor: f.maxMinor ?? null, period: f.period ?? "year", moveBy: f.moveBy ?? null, verifiedOnly: f.verifiedOnly ?? false };
}

export function ModeSwitch({ mode }: { mode: Mode }) {
  const copy = useScopedCopy("roommates");
  const router = useRouter();
  return (
    <Segmented<Mode>
      label={copy.ui.discover.mode}
      value={mode}
      full
      variant="solid"
      options={[
        { value: "people", label: copy.discover.people, icon: "users" },
        { value: "rooms", label: copy.discover.rooms, icon: "bed" },
      ]}
      onChange={(next) => {
        const url = new URL(window.location.href);
        const params = Object.fromEntries(url.searchParams.entries());
        const f: Draft = { q: params.q ?? "", stateCode: params.state ?? null, city: params.city ?? null, institutionId: params.school ?? null, maxMinor: params.max ? Number(params.max) : null, period: params.per === "month" ? "month" : "year", moveBy: params.by ?? null, verifiedOnly: params.verified === "1" };
        router.push(discoverHref(next, shared(f)));
      }}
    />
  );
}

function activeCount(mode: Mode, f: Draft): number {
  const keys: (keyof Draft)[] =
    mode === "people" ? ["stateCode", "city", "institutionId", "maxMinor", "moveBy", "lifeStage", "intent"] : ["stateCode", "city", "institutionId", "maxMinor", "moveBy", "kind", "roomType", "furnished", "genderPref"];
  return keys.filter((k) => f[k] !== null && f[k] !== undefined && f[k] !== "").length + (f.verifiedOnly ? 1 : 0);
}

export function DiscoverControls({
  mode,
  people,
  rooms,
  schools,
  canSave,
}: {
  mode: Mode;
  people: PeopleFilters;
  rooms: RoomFilters;
  schools: InstitutionRef[];
  canSave: boolean;
}) {
  const copy = useScopedCopy("roommates");
  const d = copy.ui.discover;
  const router = useRouter();
  const current: Draft = mode === "people" ? people : rooms;
  const [q, setQ] = useState(current.q ?? "");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(current);
  const go = (f: Draft) => router.push(discoverHref(mode, f));
  const count = activeCount(mode, current);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    feedback("select");
    go({ ...current, q: q.trim() });
  };

  const quick =
    mode === "people"
      ? (["student", "corps_member", "professional"] as const).map((v) => ({ key: v, label: copy.lifeStages[v], on: current.lifeStage === v, set: () => go({ ...current, lifeStage: current.lifeStage === v ? null : v }) }))
      : LISTING_KINDS.map((v) => ({ key: v, label: copy.listingKinds[v], on: current.kind === v, set: () => go({ ...current, kind: current.kind === v ? null : v }) }));

  const patch = (p: Draft) => setDraft((x) => ({ ...x, ...p }));
  const schoolOptions = [...schools].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="nf-rmd-controls">
      <form role="search" className="nf-rmd-search" onSubmit={submit} aria-label={d.searchLabel}>
        <span className="nf-rmd-search__glyph" aria-hidden="true">
          <UiIcon name="search" size={20} />
        </span>
        <label htmlFor="rm-discover-q" className="sr-only">
          {copy.discover.search}
        </label>
        <input
          id="rm-discover-q"
          className="nf-rmd-search__input"
          type="search"
          enterKeyHint="search"
          value={q}
          maxLength={80}
          placeholder={copy.discover.search}
          onChange={(e) => setQ(e.target.value)}
          data-testid="discover-search"
        />
        <button type="submit" className="nf-rmd-search__go" aria-label={d.searchLabel}>
          <UiIcon name="arrow-right" size={20} />
        </button>
      </form>

      <ChipRow label={copy.discover.filters}>
        <Chip
          behaviour="filter"
          selected={count > 0}
          icon="sliders"
          expanded={open}
          {...(count ? { count } : {})}
          onSelectedChange={() => {
            feedback("select");
            setDraft(current);
            setOpen(true);
          }}
          data-testid="discover-filters"
        >
          {copy.discover.filters}
        </Chip>
        <Chip
          behaviour="filter"
          selected={Boolean(current.verifiedOnly)}
          icon="verified"
          onSelectedChange={() => {
            feedback("select");
            go({ ...current, verifiedOnly: !current.verifiedOnly });
          }}
        >
          {copy.discover.filterLabels.verified}
        </Chip>
        {quick.map((c) => (
          <Chip
            key={c.key}
            behaviour="filter"
            selected={c.on}
            onSelectedChange={() => {
              feedback("select");
              c.set();
            }}
          >
            {c.label}
          </Chip>
        ))}
        {canSave ? <SaveSearchButton mode={mode} filters={current} variant="chip" /> : null}
      </ChipRow>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={d.filtersTitle}
        description={d.filtersBody}
        fullPage
        sideOnWide
        closeLabel={copy.ui.flow.close}
        reset={{
          label: copy.discover.reset,
          onClick: () => {
            feedback("select");
            setDraft({ ...(mode === "people" ? EMPTY_PEOPLE_FILTERS : EMPTY_ROOM_FILTERS), q: current.q ?? "" });
          },
        }}
        apply={{
          label: copy.discover.apply,
          onClick: () => {
            feedback("confirm");
            setOpen(false);
            go(draft);
          },
        }}
        testId="discover-filter-sheet"
      >
        <div className="nf-rmd-sheet">
          <FilterGroup title={copy.discover.filterLabels.city} icon="pin">
            <SelectField label={d.state} value={draft.stateCode ?? ""} onChange={(e) => patch({ stateCode: e.target.value || null })}>
              <option value="">{d.anyState}</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <TextField label={copy.discover.filterLabels.city} value={draft.city ?? ""} maxLength={60} placeholder={d.cityPlaceholder} onChange={(e) => patch({ city: e.target.value || null })} />
          </FilterGroup>

          {schoolOptions.length ? (
            <FilterGroup title={copy.discover.filterLabels.institution} icon="id-card">
              <SelectField label={copy.discover.filterLabels.institution} hideLabel value={draft.institutionId ?? ""} onChange={(e) => patch({ institutionId: e.target.value || null })}>
                <option value="">{d.anySchool}</option>
                {schoolOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortName ? `${s.name} (${s.shortName})` : s.name}
                  </option>
                ))}
              </SelectField>
            </FilterGroup>
          ) : null}

          <FilterGroup title={copy.discover.filterLabels.budget} icon="wallet">
            <div className="nf-rmd-budget">
              <span className="nf-rmd-budget__tag">{draft.maxMinor ? `${copy.ui.card.budgetUpTo.replace("{amount}", naira(draft.maxMinor))}${copy.perPeriod[draft.period ?? "year"]}` : d.any}</span>
            </div>
            <NairaField
              label={d.maxBudget}
              value={draft.maxMinor ? String(Math.round(draft.maxMinor / 100)) : ""}
              onValueChange={(v) => patch({ maxMinor: v ? Math.round(Number(v) * 100) : null })}
            />
            <ChoiceChips
              label={d.maxBudget}
              anyLabel={d.any}
              value={BUDGET_STEPS[draft.period ?? "year"].includes(draft.maxMinor ?? -1) ? (draft.maxMinor ?? null) : null}
              options={BUDGET_STEPS[draft.period ?? "year"].map((v) => ({ value: v, label: naira(v) }))}
              onChange={(v) => patch({ maxMinor: v })}
            />
            <Segmented
              variant="solid"
              label={d.per}
              semantics="radio"
              size="sm"
              value={draft.period ?? "year"}
              options={PERIODS.map((p) => ({ value: p, label: copy.periods[p] }))}
              onChange={(p) => patch({ period: p })}
            />
          </FilterGroup>

          <FilterGroup title={copy.discover.filterLabels.moveBy} icon="calendar-check">
            <TextField label={copy.discover.filterLabels.moveBy} hideLabel type="date" value={draft.moveBy ?? ""} onChange={(e) => patch({ moveBy: e.target.value || null })} />
          </FilterGroup>

          {mode === "people" ? (
            <>
              <FilterGroup title={copy.discover.filterLabels.lifeStage} icon="users">
                <ChoiceChips label={copy.discover.filterLabels.lifeStage} anyLabel={d.any} value={draft.lifeStage ?? null} options={LIFE_STAGES.map((v) => ({ value: v, label: copy.lifeStages[v] }))} onChange={(v) => patch({ lifeStage: v })} />
              </FilterGroup>
              <FilterGroup title={copy.ui.onboarding.intentsTitle} icon="circle-people">
                <ChoiceChips label={copy.ui.onboarding.intentsTitle} anyLabel={d.any} value={draft.intent ?? null} options={INTENTS.map((v) => ({ value: v, label: copy.intents[v] }))} onChange={(v) => patch({ intent: v })} />
              </FilterGroup>
            </>
          ) : (
            <>
              <FilterGroup title={copy.discover.filterLabels.kind} icon="door">
                <ChoiceChips label={copy.discover.filterLabels.kind} anyLabel={d.any} value={draft.kind ?? null} options={LISTING_KINDS.map((v) => ({ value: v, label: copy.listingKinds[v] }))} onChange={(v) => patch({ kind: v })} />
              </FilterGroup>
              <FilterGroup title={copy.discover.filterLabels.roomType} icon="door">
                <ChoiceChips label={copy.discover.filterLabels.roomType} anyLabel={d.any} value={draft.roomType ?? null} options={ROOM_TYPES.map((v) => ({ value: v, label: copy.roomTypes[v] }))} onChange={(v) => patch({ roomType: v })} />
              </FilterGroup>
              <FilterGroup title={copy.discover.filterLabels.furnished} icon="bed">
                <ChoiceChips label={copy.discover.filterLabels.furnished} anyLabel={d.any} value={draft.furnished ?? null} options={FURNISHED.map((v) => ({ value: v, label: copy.furnished[v] }))} onChange={(v) => patch({ furnished: v })} />
              </FilterGroup>
              <FilterGroup title={copy.discover.filterLabels.gender} icon="users">
                <ChoiceChips label={copy.discover.filterLabels.gender} anyLabel={d.any} value={draft.genderPref ?? null} options={GENDER_PREFS.map((v) => ({ value: v, label: copy.genderPref[v] }))} onChange={(v) => patch({ genderPref: v })} />
              </FilterGroup>
            </>
          )}

          <FilterGroup title={d.sort} icon="sort">
            <ChoiceChips
              label={d.sort}
              value={draft.sort ?? (mode === "people" ? "match" : "newest")}
              options={(["match", "newest", "budget"] as const).map((v) => ({ value: v, label: copy.discover.sort[v] }))}
              onChange={(v) => patch({ sort: v ?? (mode === "people" ? "match" : "newest") })}
            />
          </FilterGroup>

          <div className="nf-rmd-group">
            <Switch label={copy.discover.filterLabels.verified} checked={Boolean(draft.verifiedOnly)} onCheckedChange={(v) => patch({ verifiedOnly: v })} />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, icon, children }: { title: string; icon: "pin" | "id-card" | "wallet" | "calendar-check" | "users" | "circle-people" | "door" | "bed" | "sort"; children: ReactNode }) {
  return (
    <section className="nf-rmd-group">
      <h3 className="nf-rmd-group__title">
        <span className="nf-rm-plate" aria-hidden="true">
          <UiIcon name={icon} size={18} />
        </span>
        {title}
      </h3>
      <div className="nf-rmd-group__body">{children}</div>
    </section>
  );
}

/** Save these filters; the hub lists them and a new match is told. */
export function SaveSearchButton({ mode, filters, variant }: { mode: Mode; filters: Draft; variant: "chip" | "primary" }) {
  const copy = useScopedCopy("roommates");
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useSafeTransition();
  const [done, setDone] = useState(false);
  const place = filters.city || stateName(filters.stateCode) || null;
  const base = mode === "rooms" ? (filters.kind ? copy.listingKinds[filters.kind] : copy.ui.discover.searchRoomsLabel) : copy.ui.discover.searchPeopleLabel;
  const label = place ? `${base}, ${place}` : base;

  const save = () =>
    start(async () => {
      try {
        const result = await saveRoommateSearch({
          label: label.slice(0, 80),
          kind: mode === "rooms" ? (filters.kind ?? null) : null,
          stateCode: filters.stateCode ?? null,
          city: filters.city ?? null,
          institutionId: filters.institutionId ?? null,
          maxMinor: filters.maxMinor ?? null,
          period: filters.period ?? "year",
          alert: true,
        });
        if (!result.ok) {
          feedback("error");
          if (result.error.startsWith("Sign in")) {
            banner.error(result.error, { action: { label: copy.ui.signInCta, run: () => router.push(`/sign-in?next=${encodeURIComponent(path + window.location.search)}`) } });
          } else banner.error(result.error, { retry: save });
          return;
        }
        feedback("confirm");
        setDone(true);
        banner.success(copy.discover.saved);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  if (variant === "chip") {
    return (
      <Chip behaviour="filter" selected={done} icon="bookmark" disabled={pending || done} onSelectedChange={save} data-testid="discover-save-search">
        {done ? copy.actions.saved : copy.discover.saveSearch}
      </Chip>
    );
  }
  return (
    <Button variant="primary" size="md" leadingIcon="bookmark" loading={pending} done={done} disabled={done} onClick={save} data-testid="discover-save-search">
      {copy.discover.saveSearch}
    </Button>
  );
}


