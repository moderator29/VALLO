"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { RoomCardView } from "@/components/roommates/Cards";
import { ChoiceChips, ToggleChips } from "@/components/roommates/ChoiceChips";
import { AMENITY_ICON, counted, fill, naira } from "@/components/roommates/format";
import { CostBreakdown } from "@/components/roommates/Panels";
import { SchoolPicker } from "@/components/roommates/SchoolPicker";
import { STATE_OPTIONS } from "@/components/roommates/states";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Check";
import { SelectField, TextArea, TextField } from "@/components/ui/Field";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { NairaField } from "@/components/ui/NairaField";
import { OptionCards } from "@/components/ui/OptionCards";
import { Quantity } from "@/components/ui/Quantity";
import { Segmented } from "@/components/ui/Segmented";
import { StepFrame, type StepSaveState } from "@/components/ui/StepFrame";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { saveRoommateListing } from "@/lib/features/roommates/actions";
import {
  AMENITIES,
  AUTHORITIES,
  FURNISHED,
  GENDER_PREFS,
  LIMITS,
  LISTING_KINDS,
  PERIODS,
  ROOMMATES_ROUTES,
  ROOM_TYPES,
  listingProblems,
  moveInCost,
  roommatePhotoUrl,
  type InstitutionRef,
  type ListingDraft,
  type ListingKind,
  type ListingStatus,
  type RoomCard,
} from "@/lib/features/roommates/model";
import { uploadToStorage } from "@/lib/media/upload";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { loadBrowserClient } from "@/lib/supabase/load-client";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

const TOTAL = 8;
const BUCKET = "roommate-photos";
const MAX_BYTES = 10 * 1024 * 1024;
const KIND_ICON: Record<ListingKind, UiIconName> = { room_offer: "door", roommate_wanted: "users", together: "circle-people" };

/* ------------------------------------------------------------------ the device copy */

function readKept(key: string): ListingDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ListingDraft>;
    return v && typeof v === "object" && typeof v.kind === "string" ? (v as ListingDraft) : null;
  } catch {
    return null;
  }
}
function keep(key: string, d: ListingDraft | null) {
  try {
    if (d) window.localStorage.setItem(key, JSON.stringify(d));
    else window.localStorage.removeItem(key);
  } catch {
    /* No storage: the flow still works, the draft is just not kept here. */
  }
}

const photoUrl = (path: string) => roommatePhotoUrl(SUPABASE_URL, path);
const extOf = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg");
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/**
 * POST ON ROOMMATES, ONE IDEA PER SCREEN (StepFrame): what kind of post, where,
 * the money (with the live "to move in" figure), the room and the home, who
 * would fit, the photographs, the words, then the review that shows the
 * card others will see. "Save draft" on every step; the unfinished post is
 * also kept on this device, so closing the flow loses nothing.
 */
export function PostFlow({
  initial,
  status,
  schools,
  me,
}: {
  initial: ListingDraft;
  /** The post's status when editing (null for a new post). */
  status: ListingStatus | null;
  schools: InstitutionRef[];
  /** The poster, for the card on the review. */
  me: { userId: string; name: string; avatarUrl: string | null };
}) {
  const copy = useScopedCopy("roommates");
  const C = copy.ui.create;
  const F = copy.ui.flow;
  const router = useRouter();
  const editing = initial.id !== null;
  const storeKey = `vallo.roommates.post.${initial.id ?? "new"}`;
  const [d, setD] = useState<ListingDraft>(initial);
  const [step, setStep] = useState(editing ? TOTAL : 1);
  const [dir, setDir] = useState<"forward" | "back">("forward");
  const [save, setSave] = useState<StepSaveState>("idle");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ id: string; city: string } | null>(null);
  const [pending, start] = useSafeTransition();

  useEffect(() => {
    if (editing) return;
    const kept = readKept(storeKey);
    if (!kept || (!kept.title && !kept.city && !kept.photos.length)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device draft is read after hydration, so server and first client render agree
    setD({ ...kept, kind: initial.kind !== kept.kind && new URLSearchParams(window.location.search).has("kind") ? initial.kind : kept.kind });
    setSave("device");
    banner.info(C.draftKept, {
      action: {
        label: C.discard,
        run: () => {
          keep(storeKey, null);
          setD(initial);
          setSave("idle");
          setStep(1);
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const patch = (x: Partial<ListingDraft>) => {
    setD((cur) => {
      const next = { ...cur, ...x };
      keep(storeKey, next);
      return next;
    });
    setSave("device");
    if (Object.keys(x).some((k) => problems[k])) setProblems((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !(k in x))));
  };

  const goto = (n: number) => {
    setDir(n > step ? "forward" : "back");
    setStep(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  /** Save to the account without publishing. The server needs a title and a city for any post; before that, the device keeps it. */
  const saveDraft = () =>
    start(async () => {
      if (d.title.trim().length < LIMITS.titleMin || d.city.trim().length < 2) {
        keep(storeKey, d);
        setSave("device");
        banner.info(C.draftDevice);
        return;
      }
      setSave("saving");
      try {
        const result = await saveRoommateListing(d);
        if (!result.ok) {
          setSave("error");
          feedback("error");
          if (result.fieldErrors) setProblems(result.fieldErrors);
          banner.error(result.error, { retry: saveDraft });
          return;
        }
        feedback("confirm");
        setSave("saved");
        if (!d.id) {
          const next = { ...d, id: result.data.id };
          setD(next);
          keep(storeKey, null);
          keep(`vallo.roommates.post.${result.data.id}`, null);
        }
        banner.success(copy.create.draftSaved);
      } catch (error) {
        setSave("error");
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const publishing = status === null || status === "draft" || status === "expired";

  const publish = () =>
    start(async () => {
      const issues = listingProblems(d);
      if (issues.length) {
        const words: Record<string, string> = C.problems;
        const fields: Record<string, string> = {};
        for (const i of issues) fields[i === "rent" ? "rentMinor" : i] = words[i] ?? F.notSaved;
        setProblems(fields);
        feedback("error");
        banner.error(issues.length > 1 ? `${counted(issues.length, F.fix)}. ${words[issues[0]!]}` : (words[issues[0]!] ?? F.notSaved));
        if (issues.includes("city")) goto(2);
        else if (issues.includes("rent")) goto(3);
        else if (issues.includes("title")) goto(7);
        return;
      }
      try {
        const result = await saveRoommateListing(d, publishing ? { publish: true } : {});
        if (!result.ok) {
          feedback("error");
          if (result.fieldErrors) setProblems(result.fieldErrors);
          banner.error(result.error, { retry: publish });
          return;
        }
        feedback("confirm");
        keep(storeKey, null);
        if (!publishing) {
          banner.success(C.savedLive);
          router.push(ROOMMATES_ROUTES.listing(result.data.id));
          router.refresh();
          return;
        }
        banner.success(copy.create.published);
        setDone({ id: result.data.id, city: d.city });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const words = { saving: F.saving, saved: F.saved, device: F.device, error: F.notSaved };
  const common = {
    total: TOTAL,
    eyebrow: editing ? C.editEyebrow : C.eyebrow,
    closeHref: editing && initial.id ? ROOMMATES_ROUTES.listing(initial.id) : ROOMMATES_ROUTES.home,
    closeLabel: F.close,
    backLabel: copy.ui.back,
    direction: dir,
    save,
    saveWords: words,
    stepLabel: fill(F.stepOf, { n: step, total: TOTAL }),
    onBack: step > 1 ? () => goto(step - 1) : undefined,
    secondary: step < TOTAL ? { label: copy.actions.saveDraft, onClick: saveDraft, disabled: pending, testId: "post-save-draft" } : undefined,
  } as const;
  const cont = (disabled = false) => ({ label: F.next, onClick: () => goto(step + 1), disabled, testId: "post-next" });

  if (done) {
    return (
      <div className="nf-rmf-done" data-testid="post-live">
        <span className="nf-rmf-done__mark" aria-hidden="true">
          <UiIcon name="check" size={36} />
        </span>
        <h1 className="nf-rmf-done__title">{copy.create.published}</h1>
        <p className="nf-rmf-done__body">{fill(copy.create.publishedBody, { city: done.city })}</p>
        <div className="nf-rmf-done__actions">
          <ButtonLink href={ROOMMATES_ROUTES.listing(done.id)} variant="primary" size="lg" full arrow data-testid="post-live-view">
            {C.publishedCta}
          </ButtonLink>
          <ButtonLink href={ROOMMATES_ROUTES.home} variant="secondary" size="lg" full>
            {C.backHome}
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <StepFrame {...common} step={1} title={copy.create.purpose} subtitle={C.purposeBody} primary={cont()} testId="post-step-purpose">
        <OptionCards
          label={copy.create.purpose}
          value={d.kind}
          options={LISTING_KINDS.map((k) => ({ value: k, label: copy.listingKinds[k], detail: copy.listingKindLong[k], icon: KIND_ICON[k] }))}
          onChange={(v) => {
            feedback("select");
            patch({ kind: v as ListingKind });
          }}
          testId="post-kind"
        />
      </StepFrame>
    );
  }

  if (step === 2) {
    return (
      <StepFrame {...common} step={2} title={copy.create.location} subtitle={C.locationBody} primary={cont(d.city.trim().length < 2)} testId="post-step-location">
        <div className="nf-rmf-stack">
          <Card icon="pin" title={copy.create.location}>
            <SelectField label={C.state} value={d.stateCode ?? ""} onChange={(e) => patch({ stateCode: e.target.value || null })}>
              <option value="">{copy.ui.discover.anyState}</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <TextField label={C.city} required value={d.city} maxLength={60} placeholder={copy.ui.onboarding.cityPlaceholder} onChange={(e) => patch({ city: e.target.value })} error={problems.city} />
            <TextField label={C.area} optionalText={F.optional} value={d.area} maxLength={80} placeholder={copy.ui.onboarding.areaPlaceholder} onChange={(e) => patch({ area: e.target.value })} />
          </Card>
          {schools.length ? (
            <Card icon="id-card" title={C.school}>
              <SchoolPicker schools={schools} value={d.institutionId} onChange={(id) => patch({ institutionId: id })} allowNone />
            </Card>
          ) : null}
        </div>
      </StepFrame>
    );
  }

  if (step === 3) {
    const cost = moveInCost(d);
    const together = d.kind === "together";
    const money = (minor: number | null) => (minor ? String(Math.round(minor / 100)) : "");
    const minorOf = (v: string) => (v ? Math.round(Number(v) * 100) : null);
    return (
      <StepFrame {...common} step={3} title={copy.create.money} subtitle={C.moneyBody} primary={cont()} testId="post-step-money">
        <div className="nf-rmf-stack">
          <Card icon="wallet" title={together ? C.budgetEach : copy.listing.rent}>
            <Segmented variant="solid" label={C.per} semantics="radio" full value={d.rentPeriod} options={PERIODS.map((x) => ({ value: x, label: copy.periods[x] }))} onChange={(x) => patch({ rentPeriod: x })} />
            {together ? (
              <NairaField label={C.budgetEach} value={money(d.shareMinor)} onValueChange={(v) => patch({ shareMinor: minorOf(v) })} error={problems.shareMinor} />
            ) : (
              <div className="nf-rmf-pair">
                <NairaField label={C.rent} required={d.kind === "room_offer"} value={money(d.rentMinor)} onValueChange={(v) => patch({ rentMinor: minorOf(v) })} error={problems.rentMinor} />
                <NairaField label={d.kind === "roommate_wanted" ? C.budgetEach : C.share} value={money(d.shareMinor)} onValueChange={(v) => patch({ shareMinor: minorOf(v) })} error={problems.shareMinor} />
              </div>
            )}
          </Card>
          {together ? null : (
            <Card icon="receipt" title={copy.listing.cost}>
              <div className="nf-rmf-pair">
                <NairaField label={C.deposit} value={money(d.depositMinor)} onValueChange={(v) => patch({ depositMinor: minorOf(v) })} />
                <NairaField label={C.agency} value={money(d.agencyFeeMinor)} onValueChange={(v) => patch({ agencyFeeMinor: minorOf(v) })} />
                <NairaField label={C.legal} value={money(d.legalFeeMinor)} onValueChange={(v) => patch({ legalFeeMinor: minorOf(v) })} />
                <NairaField label={C.service} value={money(d.serviceChargeMinor)} onValueChange={(v) => patch({ serviceChargeMinor: minorOf(v) })} />
              </div>
              <NairaField label={C.utilities} value={money(d.utilitiesMonthlyMinor)} onValueChange={(v) => patch({ utilitiesMonthlyMinor: minorOf(v) })} />
            </Card>
          )}
          {cost ? (
            <div className="nf-rmf-total" aria-live="polite" data-testid="post-move-in-total">
              <span className="nf-rmf-total__label">{C.toMoveIn}</span>
              <span className="nf-rmf-total__n">{naira(cost.totalMinor, false)}</span>
              <span className="nf-rmf-total__sub">{C.toMoveInBody}</span>
            </div>
          ) : null}
        </div>
      </StepFrame>
    );
  }

  if (step === 4) {
    const count = (key: "bedrooms" | "bathrooms" | "occupantsNow" | "occupantsMax" | "roomsAvailable" | "minStayMonths", label: string, opts: { min?: number; max?: number; zeroIsNull?: boolean } = {}) => (
      <div className="nf-rmf-count">
        <span className="nf-rmf-count__label">{label}</span>
        <Quantity
          label={label}
          decreaseLabel={`${label}: ${C.less}`}
          increaseLabel={`${label}: ${C.more}`}
          min={opts.min ?? 0}
          max={opts.max ?? 20}
          value={d[key] ?? 0}
          onChange={(n) => patch({ [key]: opts.zeroIsNull && n === 0 ? null : n } as Partial<ListingDraft>)}
        />
      </div>
    );
    return (
      <StepFrame {...common} step={4} title={copy.create.room} subtitle={C.roomBody} primary={cont()} testId="post-step-room">
        <div className="nf-rmf-stack">
          <Card icon="door" title={C.roomType}>
            <ChoiceChips label={C.roomType} value={d.roomType} options={ROOM_TYPES.map((v) => ({ value: v, label: copy.roomTypes[v] }))} onChange={(v) => patch({ roomType: v })} />
          </Card>
          <Card icon="bed" title={C.furnishing}>
            <ChoiceChips label={C.furnishing} value={d.furnished} options={FURNISHED.map((v) => ({ value: v, label: copy.furnished[v] }))} onChange={(v) => patch({ furnished: v })} />
          </Card>
          <Card icon="house" title={copy.ui.listing.facts}>
            {count("bedrooms", C.bedrooms, { zeroIsNull: true })}
            {count("bathrooms", C.bathrooms, { zeroIsNull: true })}
            {count("roomsAvailable", C.roomsAvailable)}
            {count("occupantsNow", C.occupantsNow)}
            {count("occupantsMax", C.occupantsMax, { zeroIsNull: true })}
          </Card>
          <Card icon="calendar-check" title={C.availableFrom}>
            <TextField label={C.availableFrom} hideLabel type="date" value={d.availableFrom ?? ""} onChange={(e) => patch({ availableFrom: e.target.value || null })} error={problems.availableFrom} />
            {count("minStayMonths", C.minStay, { max: 60, zeroIsNull: true })}
          </Card>
          <Card icon="check" title={C.amenities}>
            <ToggleChips label={C.amenities} value={d.amenities} options={AMENITIES.map((a) => ({ value: a, label: copy.amenities[a], icon: AMENITY_ICON[a] }))} onChange={(amenities) => patch({ amenities })} />
          </Card>
        </div>
      </StepFrame>
    );
  }

  if (step === 5) {
    return (
      <StepFrame {...common} step={5} title={copy.create.details} subtitle={C.detailsBody} primary={cont()} testId="post-step-details">
        <div className="nf-rmf-stack">
          <Card icon="users" title={C.household}>
            <ChoiceChips label={C.household} value={d.genderPref} options={GENDER_PREFS.map((v) => ({ value: v, label: copy.genderPref[v] }))} onChange={(v) => patch({ genderPref: v ?? "any" })} />
          </Card>
          <Card icon="clipboard-list" title={C.rules}>
            <RulesEditor rules={d.houseRules} onChange={(houseRules) => patch({ houseRules })} />
          </Card>
        </div>
      </StepFrame>
    );
  }

  if (step === 6) {
    return (
      <StepFrame {...common} step={6} title={copy.create.photos} subtitle={C.photosBody} primary={cont()} testId="post-step-photos">
        <Photos photos={d.photos} onChange={(photos) => patch({ photos })} recommend={d.kind === "room_offer"} />
      </StepFrame>
    );
  }

  if (step === 7) {
    return (
      <StepFrame {...common} step={7} title={copy.create.describe} subtitle={C.describeBody} primary={cont(d.title.trim().length < LIMITS.titleMin)} testId="post-step-describe">
        <div className="nf-rmf-stack">
          <TextField label={C.titleLabel} required value={d.title} maxLength={LIMITS.titleMax} showCount placeholder={C.titlePlaceholder} onChange={(e) => patch({ title: e.target.value })} error={problems.title} data-testid="post-title" />
          <TextArea label={C.descriptionLabel} value={d.description} maxLength={LIMITS.descriptionMax} rows={7} placeholder={C.descriptionPlaceholder} onChange={(e) => patch({ description: e.target.value })} error={problems.description} />
        </div>
      </StepFrame>
    );
  }

  /* Review */
  return (
    <StepFrame
      {...common}
      step={TOTAL}
      title={copy.create.review}
      subtitle={C.reviewBody}
      primary={{ label: publishing ? copy.actions.publish : copy.ui.onboarding.saveChanges, onClick: publish, loading: pending, disabled: pending, testId: "post-publish" }}
      secondary={{ label: copy.actions.saveDraft, onClick: saveDraft, disabled: pending, testId: "post-save-draft" }}
      testId="post-step-review"
    >
      <Review d={d} me={me} problems={problems} onPatch={patch} onEdit={goto} />
    </StepFrame>
  );
}

function Card({ icon, title, children }: { icon: UiIconName; title: string; children: ReactNode }) {
  return (
    <section className="nf-rmf-pcard">
      <h2 className="nf-rmf-pcard__title">
        <span className="nf-rm-plate" aria-hidden="true">
          <UiIcon name={icon} size={18} />
        </span>
        {title}
      </h2>
      <div className="nf-rmf-pcard__body">{children}</div>
    </section>
  );
}

function RulesEditor({ rules, onChange }: { rules: string[]; onChange: (r: string[]) => void }) {
  const copy = useScopedCopy("roommates");
  const C = copy.ui.create;
  const [text, setText] = useState("");
  const full = rules.length >= LIMITS.rulesMax;
  const add = () => {
    const v = text.trim().slice(0, LIMITS.ruleMax);
    if (!v || full) return;
    feedback("select");
    onChange([...rules, v]);
    setText("");
  };
  return (
    <div className="nf-rmf-areas">
      <div className="nf-rmf-addrow">
        <TextField
          label={C.rules}
          hideLabel
          value={text}
          maxLength={LIMITS.ruleMax}
          placeholder={C.rulePlaceholder}
          disabled={full}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" size="md" leadingIcon="plus" onClick={add} disabled={!text.trim() || full}>
          {C.addRule}
        </Button>
      </div>
      {rules.length ? (
        <ol className="nf-rmf-rules">
          {rules.map((r, i) => (
            <li key={`${i}-${r}`}>
              <span>{r}</span>
              <button type="button" aria-label={`${C.removeRule}: ${r}`} onClick={() => onChange(rules.filter((_, j) => j !== i))}>
                <UiIcon name="close" size={14} />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Upload, see, order and remove the photographs. The first is the cover. */
function Photos({ photos, onChange, recommend }: { photos: string[]; onChange: (p: string[]) => void; recommend: boolean }) {
  const copy = useScopedCopy("roommates");
  const C = copy.ui.create;
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const list = useRef(photos);
  useEffect(() => {
    list.current = photos;
  }, [photos]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = LIMITS.photosMax - list.current.length;
    if (room <= 0) {
      banner.error(C.tooMany);
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) banner.warning(C.tooMany);
    const supabase = await loadBrowserClient();
    if (!supabase) {
      banner.error(C.uploadFailed);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      banner.error(copy.ui.create.signedOut);
      return;
    }
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        banner.error(C.notImage);
        continue;
      }
      if (file.size > MAX_BYTES) {
        banner.error(C.tooBig);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const path = `${user.id}/${newId()}.${extOf(file.type)}`;
        const result = await uploadToStorage({ supabase, bucket: BUCKET, path, body: file, contentType: file.type || "image/jpeg" });
        if (!result.ok) {
          feedback("error");
          banner.error(C.uploadFailed, { retry: () => void pick(files) });
        } else {
          const blob = URL.createObjectURL(file);
          setLocal((m) => ({ ...m, [path]: blob }));
          list.current = [...list.current, path];
          onChange(list.current);
        }
      } catch {
        banner.error(C.uploadFailed);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= photos.length) return;
    feedback("select");
    const next = [...photos];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="nf-rmf-stack">
      {recommend && !photos.length ? (
        <p className="nf-rm-note">
          <UiIcon name="info" size={16} />
          {C.photosRecommended}
        </p>
      ) : null}
      <ul className="nf-rmf-photos">
        {photos.map((path, i) => (
          <li key={path} className="nf-rmf-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded blob or a storage URL, at thumbnail size */}
            <img src={local[path] ?? photoUrl(path)} alt="" loading="lazy" />
            {i === 0 ? <span className="nf-rmf-photo__cover">{C.cover}</span> : null}
            <span className="nf-rmf-photo__tools">
              <button type="button" aria-label={C.moveUp} disabled={i === 0} onClick={() => move(i, -1)}>
                <UiIcon name="arrow-left" size={16} />
              </button>
              <button type="button" aria-label={C.moveDown} disabled={i === photos.length - 1} onClick={() => move(i, 1)}>
                <UiIcon name="arrow-right" size={16} />
              </button>
              <button type="button" aria-label={C.removePhoto} onClick={() => onChange(photos.filter((p) => p !== path))}>
                <UiIcon name="trash" size={16} />
              </button>
            </span>
          </li>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <li key={`busy-${i}`} className="nf-rmf-photo nf-rmf-photo--busy" aria-label={C.uploading}>
            <UiIcon name="hourglass" size={20} />
          </li>
        ))}
        {photos.length + busy < LIMITS.photosMax ? (
          <li>
            <button type="button" className="nf-rmf-photo nf-rmf-photo--add" onClick={() => input.current?.click()} data-testid="post-add-photos">
              <UiIcon name="camera" size={24} />
              <span>{C.addPhotos}</span>
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files)} />
      <p className="nf-rm-note">
        <UiIcon name="picture" size={16} />
        {`${C.photosHint} ${counted(photos.length, copy.ui.card.photos)}`}
      </p>
    </div>
  );
}

function Review({
  d,
  me,
  problems,
  onPatch,
  onEdit,
}: {
  d: ListingDraft;
  me: { userId: string; name: string; avatarUrl: string | null };
  problems: Record<string, string>;
  onPatch: (x: Partial<ListingDraft>) => void;
  onEdit: (step: number) => void;
}) {
  const copy = useScopedCopy("roommates");
  const C = copy.ui.create;
  const card: RoomCard = useMemo(
    () => ({
      id: d.id ?? "draft",
      kind: d.kind,
      status: "live",
      title: d.title || copy.create.title,
      stateCode: d.stateCode,
      city: d.city || null,
      area: d.area || null,
      institution: null,
      rentMinor: d.rentMinor,
      rentPeriod: d.rentPeriod,
      shareMinor: d.shareMinor,
      roomsAvailable: d.roomsAvailable,
      occupantsNow: d.occupantsNow,
      occupantsMax: d.occupantsMax,
      bedrooms: d.bedrooms,
      bathrooms: d.bathrooms,
      roomType: d.roomType,
      furnished: d.furnished,
      amenities: d.amenities,
      availableFrom: d.availableFrom,
      genderPref: d.genderPref,
      photoUrls: d.photos.map(photoUrl),
      verified: false,
      linkedListingId: d.linkedListingId,
      owner: { userId: me.userId, name: me.name, handle: null, avatarUrl: me.avatarUrl, badges: [] },
      publishedAt: null,
      match: null,
    }),
    [d, me, copy.create.title],
  );
  const rows: { step: number; label: string; value: string }[] = [
    { step: 1, label: copy.create.purpose, value: copy.listingKinds[d.kind] },
    { step: 2, label: copy.create.location, value: [d.area, d.city].filter(Boolean).join(", ") },
    { step: 5, label: C.household, value: copy.genderPref[d.genderPref] },
    { step: 5, label: C.rules, value: d.houseRules.length ? d.houseRules.join(" · ") : "" },
    { step: 6, label: copy.create.photos, value: counted(d.photos.length, copy.ui.card.photos) },
  ];
  return (
    <div className="nf-rmf-stack" data-testid="post-review">
      <div className="nf-rmf-preview">
        <RoomCardView room={card} t={copy} linked={false} testId="post-review-card" />
      </div>
      <CostBreakdown cost={d} t={copy} />
      {rows.map((r) => (
        <section key={r.label} className="nf-rmf-review">
          <div className="nf-rmf-review__head">
            <h2 className="nf-rmf-review__title">{r.label}</h2>
            <Button variant="quiet" size="sm" leadingIcon="pencil" onClick={() => onEdit(r.step)}>
              {copy.ui.onboarding.edit}
            </Button>
          </div>
          <p className="nf-rmf-review__value" data-empty={!r.value || undefined}>
            {r.value || copy.ui.onboarding.notSet}
          </p>
        </section>
      ))}
      {d.description ? (
        <section className="nf-rmf-review">
          <div className="nf-rmf-review__head">
            <h2 className="nf-rmf-review__title">{C.descriptionLabel}</h2>
            <Button variant="quiet" size="sm" leadingIcon="pencil" onClick={() => onEdit(7)}>
              {copy.ui.onboarding.edit}
            </Button>
          </div>
          <p className="nf-rmf-review__intro">{d.description}</p>
        </section>
      ) : null}
      {d.kind === "room_offer" ? (
        <section className="nf-rmf-pcard" aria-labelledby="post-authority">
          <h2 id="post-authority" className="nf-rmf-pcard__title">
            <span className="nf-rm-plate" aria-hidden="true">
              <UiIcon name="file-check" size={18} />
            </span>
            {C.authority}
          </h2>
          <div className="nf-rmf-pcard__body" data-invalid={problems.authority ? true : undefined}>
            <OptionCards
              label={C.authority}
              value={d.authority}
              options={AUTHORITIES.map((a) => ({ value: a, label: copy.authority[a] }))}
              onChange={(v) => {
                feedback("select");
                onPatch({ authority: v as ListingDraft["authority"] });
              }}
              testId="post-authority"
            />
            <FieldProblem id="post-authority-problem" message={problems.authority} />
            <div className="nf-rmf-declare" data-invalid={problems.declared ? true : undefined}>
              <Checkbox
                checked={d.declared}
                onChange={(e) => onPatch({ declared: e.target.checked })}
                aria-invalid={problems.declared ? true : undefined}
                aria-describedby={problems.declared ? "post-declared-problem" : undefined}
                data-testid="post-declared"
              >
                {copy.create.declaration}
              </Checkbox>
              <FieldProblem id="post-declared-problem" message={problems.declared} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
