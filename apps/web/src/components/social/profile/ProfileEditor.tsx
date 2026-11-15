"use client";

import { banner } from "@/lib/ui/toast";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { ActionResult } from "@/lib/actions/envelope";
import { saveSocialProfile } from "@/lib/social/profiles-actions";
import type { AreaOption, SocialProfileView } from "@/lib/social/profiles-queries";
import {
  BIO_HELD_DETAIL,
  BIO_HELD_TITLE,
  BIO_MAX,
  CONTACT_POLICIES,
  CONTACT_POLICY_COPY,
  HANDLE_HELP,
  HANDLE_MAX,
  LINK_MAX,
  PIDGIN_COPY,
  PRONOUNS_MAX,
  linkLabel,
  type ContactPolicy,
  type SocialProfileSaved,
} from "@/lib/social/profiles-model";
import { useDisplayHost } from "@/lib/ui/use-display-host";
import "@/app/css/catalogue.css";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * The profile editor, as a full page.
 *
 * One form, one write, one truth. Every field here maps to a column the
 * database validates itself, so the client's job is to say what is wrong while
 * somebody is typing and then get out of the way. Inputs are controlled, so a
 * rejected save never empties a field: whatever was typed is still there to
 * correct.
 *
 * The handle is the one field that can be refused by a rule the browser cannot
 * know about. Reserved words, anything resembling an official Vallo name and a
 * handle released inside the last 90 days are all refused by a trigger, which
 * hands back a sentence written for a person. Those arrive as a field error on
 * this input, in the trigger's own words.
 *
 * Saving a changed handle changes this page's address, so a successful save
 * moves the browser to the new one. Nobody is left on a URL that now belongs to
 * a profile that no longer exists.
 */
export function ProfileEditor({
  profile,
  initialHandle,
  areas,
}: {
  /** The row being edited, or null when this is a first claim. */
  profile: SocialProfileView | null;
  /** The handle to start from: the person's own, or the one they came to take. */
  initialHandle: string;
  areas: AreaOption[];
}) {
  const router = useRouter();
  const host = useDisplayHost();
  const [state, formAction, pending] = useActionState<
    ActionResult<SocialProfileSaved> | null,
    FormData
  >(saveSocialProfile, null);

  const [handle, setHandle] = useState(initialHandle);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? "");
  const [link, setLink] = useState(profile ? linkLabel(profile.link) : "");
  const [contactPolicy, setContactPolicy] = useState<ContactPolicy>(
    profile?.contactPolicy ?? "REQUEST",
  );
  const [pidginOk, setPidginOk] = useState(profile?.pidginOk ?? false);
  const [homeAreaId, setHomeAreaId] = useState(profile?.homeAreaId ?? "");

  const handleId = useId();
  const bioId = useId();
  const pronounsId = useId();
  const linkId = useId();
  const areaId = useId();
  const policyId = useId();

  const saved = state?.ok ? state.data : null;

  /* A saved handle is this page's address. Move to it, then re-read the server
     tree so every surface showing this person agrees with the database. */
  useEffect(() => {
    if (!saved) return;
    router.replace(`/u/${saved.handle}/edit`);
    router.refresh();
  }, [saved, router]);

  /* The outcome is said by the one banner at the top of the screen (Grade 1);
     each field's own error stays under that field. */
  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      banner.error(state.error);
      return;
    }
    const handle = state.data.handle;
    banner.success(state.data.claimed ? `@${handle} is yours.` : "Your profile is saved.", {
      action: { label: "View your profile", run: () => router.push(`/u/${handle}`) },
    });
  }, [state, router]);

  const fieldError = (key: string): string | undefined =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  const bioHeld = saved ? saved.bioStatus === "HELD" : profile?.bioStatus === "HELD";
  const claiming = profile === null;

  return (
    <form action={formAction} className="space-y-sm" noValidate>
      {bioHeld && (
        <div
          role="status"
          className="nf-panel nf-panel--card nf-panel--held p-md"
        >
          <p className="flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-status-pending)]">
            <UiIcon name="hourglass" size={15} className="shrink-0" />
            {BIO_HELD_TITLE}
          </p>
          <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            {BIO_HELD_DETAIL}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------ handle */}
      <section className="nf-panel nf-panel--card p-md sm:p-lg">
        <h2 className="nf-overline">{claiming ? "Claim your handle" : "Your handle"}</h2>
        <label htmlFor={handleId} className="nf-label mt-sm">
          Handle
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[1.05rem] top-1/2 -translate-y-1/2 text-[var(--nf-content-muted)]"
          >
            @
          </span>
          <input
            id={handleId}
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/^@/, "").toLowerCase())}
            maxLength={HANDLE_MAX}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            required
            aria-invalid={fieldError("handle") ? true : undefined}
            aria-describedby={fieldError("handle") ? `${handleId}-help ${handleId}-problem` : `${handleId}-help`}
            /* LEFT OFF THE SCALE ON PURPOSE. 1.9rem clears the "@" drawn inside
               the field, so it is a function of that glyph's advance width in
               this typeface, not a rhythm between two pieces of content. The
               nearest rungs are 24px and 32px; the first puts the caret on top
               of the @ and the second leaves a visible gap after it. If the
               brand face ever changes this needs re-measuring, which a rung
               would hide rather than help. */
            className="nf-field pl-[1.9rem]"
            placeholder="yourname"
          />
        </div>
        <p id={`${handleId}-help`} className="mt-xs text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          {HANDLE_HELP} People will find you at {host}/u/{handle || "yourname"}.
          {!claiming && " A handle can be changed once every 30 days."}
        </p>
        {/* A field's problem keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
        <FieldProblem id={`${handleId}-problem`} message={fieldError("handle")} when={state} />
      </section>

      {/* --------------------------------------------------------------- bio */}
      <section className="nf-panel nf-panel--card p-md sm:p-lg">
        <h2 className="nf-overline">About you</h2>

        <label htmlFor={bioId} className="nf-label mt-sm">
          Bio
        </label>
        <textarea autoCapitalize="sentences" enterKeyHint="enter"
          id={bioId}
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX}
          rows={4}
          aria-invalid={fieldError("bio") ? true : undefined}
          aria-describedby={fieldError("bio") ? `${bioId}-help ${bioId}-problem` : `${bioId}-help`}
          className="nf-field resize-y"
          placeholder="Where you are, what you know, what you are looking for."
        />
        <p id={`${bioId}-help`} className="mt-xs flex items-start justify-between gap-sm text-[length:var(--nf-text-overline)] leading-relaxed">
          <span className="text-[var(--nf-content-muted)]">
            Never put a phone number or an account number here. Those are held for review.
          </span>
          <span className="nf-numeric shrink-0 text-[var(--nf-content-muted)]">
            {bio.length}/{BIO_MAX}
          </span>
        </p>
        <FieldProblem id={`${bioId}-problem`} message={fieldError("bio")} when={state} />

        <label htmlFor={pronounsId} className="nf-label mt-md">
          Pronouns
          <span className="ml-2xs font-normal text-[var(--nf-content-muted)]">optional</span>
        </label>
        <input
          id={pronounsId}
          name="pronouns"
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
          maxLength={PRONOUNS_MAX}
          autoComplete="off"
          aria-invalid={fieldError("pronouns") ? true : undefined}
          aria-describedby={fieldError("pronouns") ? `${pronounsId}-problem` : undefined}
          className="nf-field"
          placeholder="she/her"
        />
        <FieldProblem id={`${pronounsId}-problem`} message={fieldError("pronouns")} when={state} />

        <label htmlFor={linkId} className="nf-label mt-md">
          Link
          <span className="ml-2xs font-normal text-[var(--nf-content-muted)]">optional</span>
        </label>
        <input
          id={linkId}
          name="link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          maxLength={LINK_MAX}
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="url"
          aria-invalid={fieldError("link") ? true : undefined}
          aria-describedby={fieldError("link") ? `${linkId}-problem` : undefined}
          className="nf-field"
          placeholder="myshop.ng"
        />
        <p className="mt-xs text-[length:var(--nf-text-overline)] leading-relaxed">
          <span className="text-[var(--nf-content-muted)]">One place people can find you. We add the https:// for you.</span>
        </p>
        <FieldProblem id={`${linkId}-problem`} message={fieldError("link")} when={state} />
      </section>

      {/* -------------------------------------------------------- home area */}
      <section className="nf-panel nf-panel--card p-md sm:p-lg">
        <h2 className="nf-overline">Where you are</h2>
        <label htmlFor={areaId} className="nf-label mt-sm">
          Home area
        </label>
        {areas.length > 0 ? (
          <select
            id={areaId}
            name="homeAreaId"
            value={homeAreaId}
            onChange={(e) => setHomeAreaId(e.target.value)}
            aria-invalid={fieldError("homeAreaId") ? true : undefined}
            aria-describedby={fieldError("homeAreaId") ? `${areaId}-problem` : undefined}
            className="nf-field"
          >
            <option value="">Rather not say</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}, {area.city}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="homeAreaId" value="" />
            <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
              No places are open yet. When the first areas open you will be able to say which one
              is home, and this is where you set it.
            </p>
          </>
        )}
        <FieldProblem id={`${areaId}-problem`} message={fieldError("homeAreaId")} when={state} />
      </section>

      {/* ------------------------------------------------------- who reaches */}
      {/*
        A radiogroup rather than a fieldset with a legend. A legend is laid out
        on the box's top border, so on a card it cuts a hole through the stride's
        gradient ring and reads as a mistake. The group keeps the same semantics
        through role and aria-labelledby, and the heading then matches every
        other section on the page.
      */}
      <section className="nf-panel nf-panel--card p-md sm:p-lg">
        <h2 id={`${policyId}-label`} className="nf-overline">
          Who can message you
        </h2>
        <div
          role="radiogroup"
          aria-labelledby={`${policyId}-label`}
          className="mt-sm space-y-xs"
        >
          {CONTACT_POLICIES.map((policy) => {
            const copy = CONTACT_POLICY_COPY[policy];
            const active = contactPolicy === policy;
            return (
              <label
                key={policy}
                /* The shared choice card: panel at rest, the selected edge
                   and glow when its radio is checked (`social-profile.css`). */
                className="nf-pchoice"
              >
                <input
                  type="radio"
                  name="contactPolicy"
                  value={policy}
                  checked={active}
                  onChange={() => setContactPolicy(policy)}
                  className="mt-2xs shrink-0 accent-[var(--nf-brand-primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{copy.title}</span>
                  <span className="mt-3xs block text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
                    {copy.detail}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <label className="nf-pchoice mt-sm">
          {/* The hidden field posts first, so an unticked box still sends a
              value and the last one written wins. */}
          <input type="hidden" name="pidginOk" value="off" />
          <input
            type="checkbox"
            name="pidginOk"
            value="on"
            checked={pidginOk}
            onChange={(e) => setPidginOk(e.target.checked)}
            className="mt-2xs shrink-0 accent-[var(--nf-brand-primary)]"
          />
          <span className="min-w-0">
            <span className="block text-[length:var(--nf-text-body-sm)] font-semibold">{PIDGIN_COPY.title}</span>
            <span className="mt-3xs block text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
              {PIDGIN_COPY.detail}
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-xs pb-xs sm:flex-row-reverse">
        <Button type="submit" variant="primary" loading={pending} disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving" : claiming ? "Claim this handle" : "Save profile"}
        </Button>
        {!claiming && (
          <ButtonLink href={`/u/${initialHandle}`} variant="ghost" className="w-full sm:w-auto">
            Cancel
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
