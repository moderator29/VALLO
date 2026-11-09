"use client";

import type { SheetWords } from "@/components/social/sheet-words";
import { Button } from "@/components/ui/Button";
import "./profile.css";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@vallo/i18n/core";
import Link from "next/link";
import { ProfilePosts } from "@/components/social/profile/ProfilePosts";
import type { PostView } from "@/components/social/feed/PostCard";
import { EmptyState } from "@/components/app/Screen";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import {
  RowButton,
  RowLink,
  RowValue,
  SettingsGroup,
  Sheet,
} from "@/components/app/account/rows";
import { updateProfileAction, type ProfileSaved } from "@/lib/profile/actions";
import {
  MAX_NAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_PHONE_LENGTH,
} from "@/lib/profile/model";
import type { ActionResult } from "@/lib/actions/envelope";
import { banner } from "@/lib/ui/toast";
import { NO_FACTS, rowValue, type BelongingsFacts } from "./belongings";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { SwitchRoleRow } from "./SwitchRoleRow";
import { COVER_INPUT_ID } from "./AccountHero";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * EVERYTHING UNDER YOUR OWN IDENTITY, BUILT TO `50E032EA`.
 *
 * The render, measured (ledger section 1): a two-segment glass control,
 * Belongings with a house glyph lit in blue and Posts with a chat glyph on the
 * glass, 20px under it three glass rows on an 8px rhythm, each a line glyph
 * on the shared icon plate, a title, a muted line and a
 * chevron, then a larger gap and a quieter Switch role row, 60px tall.
 *
 * WHAT IS REAL ON EACH ROW. The rows are links to the real routes
 * (`/bookings`, `/saved`, `/agreements`). The render draws no
 * figures on them; the brief for this surface allows one where the database
 * returns it, so each row may carry a quiet value on its right: upcoming
 * stays, saved places, open agreements where the read returns them. A figure the read could not produce is not drawn
 * at all, and a zero count is not drawn either (see `rowValue`).
 *
 * NOTHING THE PAGE USED TO REACH HAS GONE. The render ends at Switch role
 * because the dock is under it; below the fold the rest of the account keeps
 * its rows: the public page, the cover photo, your details, where you are and
 * what you do, messages, notifications and help. Editing the profile is the
 * header's own button and the joining month is in the credentials section,
 * so neither is repeated here.
 *
 * Posts is the public page's own panel (`ProfilePosts`), reading the same
 * `getProfileFeed` rows, so a post looks the same wherever it is read and an
 * empty tab says the same honest thing.
 */

export type AccountCounts = { trips: number; saved: number; reviews: number };

export type AccountRowsCopy = {
  bookings: string;
  saved: string;
  agreements: string;
  messages: string;
  settings: string;
  belongings: string;
  posts: string;
  myBookings: string;
  myBookingsSub: string;
  savedSub: string;
  agreementsSub: string;
};

type Tab = "account" | "posts";

type Belonging = {
  key: "bookings" | "saved" | "payments";
  href: string;
  /**
   * The row's line glyph. Line, not glass (the founder, 29 September 2026):
   * the profile rows are one set with the "More of your account" rows under
   * them, the same plate, the same glyph size, stroke and blue.
   */
  glyph: UiIconName;
  /**
   * The row's clay mark (north star 10 F: "clay row marks"). A matte tier-B
   * object at 32px and above sits on a Plate, which is the D2 rule: clay for
   * content objects from 32px, line glyphs for chrome below it. The line
   * `glyph` above is what the object stands for and stays as the fallback.
   */
  clay: BrandIconProp;
  title: string;
  sub: string;
};

/**
 * A belongings row: the glass container, the plate with its glyph, the title,
 * the line under it, the value when there is one, the chevron. The whole row
 * is the link.
 */
function BelongingRow({ row, value }: { row: Belonging; value: string | null }) {
  return (
    <Link href={row.href} className="nf-pf-row" data-testid={`row-${row.key}`}>
      {/* A clay mark on a Plate (north star 10 F): the rows that are the
          member's own belongings carry the matte object, and the "more of
          your account" rows beneath keep the line glyph on `IconPlate`. */}
      <span className="nf-pf-glyph nf-pf-glyph--clay" aria-hidden="true">
        <BrandIcon name={row.clay} size={36} />
      </span>
      <span className="nf-pf-row__body">
        <span className="nf-pf-row__title">{row.title}</span>
        <span className="nf-pf-row__sub">{row.sub}</span>
      </span>
      {value ? (
        <span className="nf-pf-row__value nf-numeric" data-testid={`row-${row.key}-value`}>
          {value}
        </span>
      ) : null}
      <UiIcon name="chevron-right" size="sm" className="nf-pf-row__chev" />
    </Link>
  );
}

export function AccountBody({
  copy,
  email,
  placeLabel,
  occupationName,
  details,
  posts,
  handle,
  hasBio,
  locale,
  sheet,
  facts = NO_FACTS,
  switchLine,
}: {
  counts: AccountCounts;
  copy: AccountRowsCopy;
  email: string;
  placeLabel: string;
  occupationName: string;
  details: { firstName: string; surname: string; nickname: string; phone: string };
  /** The person's own posts. Empty when they have not claimed a handle. */
  posts: PostView[];
  handle: string | null;
  /** Drives the owner's first useful action while the Posts tab is empty. */
  hasBio: boolean;
  /** The locale, NOT a formatter: a function cannot cross into a client component. */
  locale: Locale;
  /** The post action sheet's two lines, from the server (`sheetWordsOf`). */
  sheet: SheetWords;
  /** What the four rows can honestly say about themselves. */
  facts?: BelongingsFacts;
  /** The line under Switch role, built from the workspaces this account holds. */
  switchLine?: string;
  /**
   * "Month Year". Accepted for callers that still pass it and no longer drawn
   * here: the joining month is a row of the credentials section now, so the
   * page says it once.
   */
  memberSince?: string;
  /**
   * The old role switch row. Accepted for callers that still pass it and no
   * longer drawn: Switch role now opens the workspace sheet the dock opens.
   */
  roleSwitch?: React.ReactNode;
}) {
  const COPY = useClientCopy().socialProfile.accountPage;
  const [tab, setTab] = useState<Tab>("account");
  /* The panel crossfades with a 12px lift (`nf-tab-swap`) once a tab has been
     CHOSEN, never for the tab the page opens on. */
  const [moved, setMoved] = useState(false);
  const [editing, setEditing] = useState(false);

  const tabs: { key: Tab; label: string; icon: UiIconName }[] = [
    { key: "account", label: copy.belongings, icon: "home" },
    { key: "posts", label: copy.posts, icon: "chat-bubble" },
  ];

  /*
   * THE THREE ROWS' GLYPHS are line glyphs on the shared plate (the founder,
   * 29 September 2026): a calendar for Plans, a bookmark for Saved (the render
   * draws a bookmark, not the heart), a document for Agreements.
   */
  const rows: Belonging[] = [
    {
      key: "bookings",
      href: "/bookings",
      glyph: "calendar-booking",
      clay: "calendar-page",
      title: copy.myBookings,
      sub: copy.myBookingsSub,
    },
    {
      key: "saved",
      href: "/saved",
      glyph: "bookmark",
      clay: "book-bookmark",
      title: copy.saved,
      sub: copy.savedSub,
    },
    {
      key: "payments",
      href: "/agreements",
      glyph: "document",
      clay: "scroll-unrolled",
      title: copy.agreements,
      sub: copy.agreementsSub,
    },
  ];

  return (
    <div className="nf-pf-body">
      <div role="tablist" aria-label="Your account" className="nf-pf-tabs">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`account-tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls={`account-panel-${entry.key}`}
            onClick={() => {
              setMoved(true);
              setTab(entry.key);
            }}
            className="nf-pf-tab"
            data-testid={`account-tab-${entry.key}`}
          >
            <UiIcon name={entry.icon} size="md" />
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "account" ? (
        <div
          role="tabpanel"
          id="account-panel-account"
          aria-labelledby="account-tab-account"
          className={`nf-pf-panel${moved ? " nf-tab-swap" : ""}`}
        >
          {/* Plans, Saved, Agreements and the workspaces: one group, one
              card, inset hairlines (plan item 16). */}
          <div className="nf-pf-rows" data-testid="belongings">
            {rows.map((row) => (
              <BelongingRow key={row.key} row={row} value={rowValue(row.key, facts, COPY, locale)} />
            ))}
            <SwitchRoleRow line={switchLine ?? COPY.switchNone} title={COPY.switchTitle} />
          </div>

          <div className="nf-pf-more">
            <SettingsGroup label={COPY.more}>
              {/* No "Edit profile" row: the header's own Edit profile button
                  is the one way in, and the page carried both. */}
              {handle ? (
                <>
                  <RowLink
                    href={`/u/${handle}`}
                    icon="link"
                    label={COPY.publicPage}
                    sub={COPY.publicPageSub}
                    testId="account-public-page"
                  />
                  <RowButton
                    onClick={() => document.getElementById(COVER_INPUT_ID)?.click()}
                    icon="picture"
                    label={COPY.coverPhoto}
                    sub={COPY.coverPhotoSub}
                    testId="account-cover-button"
                  />
                </>
              ) : null}
              <RowButton
                onClick={() => setEditing(true)}
                icon="user"
                label="Your details"
                sub="Name, nickname and phone number"
                testId="row-details"
              />
              <RowValue
                icon="mail"
                label="Email"
                value={email}
                sub="Your email address cannot be changed."
              />
              <RowLink
                href="/settings/place"
                icon="location"
                label="Where you are"
                value={placeLabel || "Not set"}
              />
              <RowLink
                href="/settings/place"
                icon="key"
                label="What you do"
                value={occupationName || "Not set"}
              />
            </SettingsGroup>

            <SettingsGroup
              label={COPY.activity}
              note="Photos are re-encoded on your phone before they are uploaded, so the location tag a camera writes never leaves it."
            >
              {/* UI-02: no Reviews row until a page lists a member's reviews; it
                  led to /reviews, which no route serves. Reviews are written
                  from a finished booking (/bookings/[id]/review). */}
              <RowLink
                href="/messages"
                icon="chat-bubble"
                label={copy.messages}
                sub="Chats with hosts"
              />
              <RowLink
                href="/notifications"
                icon="bell"
                label="Notifications"
                sub="Everything that happened while you were away"
              />
              {/* Vallo Roommates (8 November 2026): the member's hub. */}
              <RowLink href="/roommates/me" icon="house-duplex" label="Roommates" sub="Requests, groups and your posts" testId="account-roommates" />
              <RowLink href="/help" icon="ticket" label="Help" sub="FAQs, contact us" />
            </SettingsGroup>
          </div>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="account-panel-posts"
          aria-labelledby="account-tab-posts"
          className={`nf-pf-panel${moved ? " nf-tab-swap" : ""}`}
        >
          {handle === null ? (
            <EmptyState
              icon="user-verified"
              title="Claim a handle and this fills up"
              body="A handle is your address on Vallo. Everything you write around a place collects here once you have one."
            />
          ) : (
            <ProfilePosts
              tab="posts"
              handle={handle}
              posts={posts}
              isOwner
              signedIn
              sheet={sheet}
              hasBio={hasBio}
              labelledBy="account-tab-posts"
            />
          )}
        </div>
      )}

      <DetailsSheet open={editing} onClose={() => setEditing(false)} details={details} />
    </div>
  );
}

/* ------------------------------------------------------------------ sheet */

function DetailsSheet({
  open,
  onClose,
  details,
}: {
  open: boolean;
  onClose: () => void;
  details: { firstName: string; surname: string; nickname: string; phone: string };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult<ProfileSaved> | null, FormData>(
    updateProfileAction,
    null,
  );

  const [firstName, setFirstName] = useState(details.firstName);
  const [surname, setSurname] = useState(details.surname);
  const [nickname, setNickname] = useState(details.nickname);
  const [phone, setPhone] = useState(details.phone);

  // A successful save closes the sheet and refreshes the tree, so every other
  // surface showing this name agrees before the sheet has finished leaving.
  // The outcome is said by the one banner at the top of the screen (Grade 1);
  // a field's own error stays under that field.
  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      if (!state.fieldErrors) banner.error(state.error);
      return;
    }
    setFirstName(state.data.firstName);
    setSurname(state.data.surname);
    setNickname(state.data.nickname);
    setPhone(state.data.phone);
    onClose();
    banner.success("Your profile has been updated");
    router.refresh();
  }, [state, onClose, router]);

  const fieldError = (key: string): string | undefined =>
    state && !state.ok ? state.fieldErrors?.[key] : undefined;

  return (
    <Sheet open={open} onClose={onClose} title="Your details">
      <form action={formAction} noValidate id="account-details-form" className="space-y-md">
        <div className="grid gap-md sm:grid-cols-2">
          <Field
            name="firstName"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            error={fieldError("firstName")}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="given-name"
          />
          <Field
            name="surname"
            label="Surname"
            value={surname}
            onChange={setSurname}
            error={fieldError("surname")}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="family-name"
          />
        </div>

        <Field
          name="nickname"
          label="Nickname"
          value={nickname}
          onChange={setNickname}
          error={fieldError("nickname")}
          maxLength={MAX_NICKNAME_LENGTH}
          autoComplete="nickname"
          placeholder="What friends call you"
          optional
        />

        <Field
          name="phone"
          label="Phone number"
          value={phone}
          onChange={setPhone}
          error={fieldError("phone")}
          maxLength={MAX_PHONE_LENGTH}
          autoComplete="tel"
          inputMode="tel"
          placeholder="0803 123 4567"
          optional
        />

        <p className="text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          Your name is what hosts see when you message or book. Your phone number stays
          private to you and the platform.
        </p>
      </form>

      <div className="pt-2xs">
        <Button
          type="submit"
          variant="primary"
          full
          form="account-details-form"
          disabled={pending}
          data-testid="account-details-save"
        >
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}

function Field({
  name,
  label,
  value,
  onChange,
  error,
  maxLength,
  autoComplete,
  inputMode,
  placeholder,
  optional,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  maxLength: number;
  autoComplete?: string;
  inputMode?: "tel" | "text";
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="nf-label mb-2xs block">
        {label}
        {optional && (
          <span className="ml-2xs font-normal text-[var(--nf-content-muted)]">(optional)</span>
        )}
      </span>
      <input
        name={name}
        type="text"
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-problem` : undefined}
        className="nf-field"
      />
      {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={`${name}-problem`} message={error} />
    </label>
  );
}
