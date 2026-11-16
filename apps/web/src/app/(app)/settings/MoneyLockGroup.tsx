"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, plural, type Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { RowButton, RowValue, SettingsGroup } from "@/components/app/account/rows";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { useMoneyStepUp } from "@/components/app/money/MoneyStepUp";
import {
  beginEnrol,
  finishEnrol,
  removeMoneyCredential,
  sendFallbackCode,
  stepUpStatus,
} from "@/lib/security/money-step-up-actions";
import { createPlatformKey, platformLockAvailable } from "@/lib/security/webauthn-client";
import { deviceKeyState, forgetDeviceKeysOutside, rememberDeviceKey, type DeviceKeyState } from "@/lib/platform/device-keys";
import type { MoneyCredentialList } from "@/lib/security/money-step-up";
import { MONEY_LOCK_BODY, MONEY_LOCK_DONE, MONEY_LOCK_REMOVED } from "@/lib/money/copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * LOCK MONEY WITH THIS PHONE. V-81.
 *
 * The settings half of the lock: enrol this phone's face or fingerprint lock
 * (after the password, so a thief holding an unlocked session cannot add
 * their own finger), see which phones lock money, and remove one (which asks
 * for the same proof as sending money). The list is read as the person
 * through the column grant, so it never carries a key.
 *
 * States: loading is the server render itself; `unreadable` says the list
 * could not be read and that the lock still works; an empty list offers the
 * enrolment; a browser that cannot ask the phone's lock says so and offers
 * nothing it cannot do.
 *
 * ---------------------------------------------------------------------------
 * REBUILT 14 NOVEMBER 2026, from the founder's own screenshot and his words:
 * "wtf is this it's not working it's not even asking to set it ... it's not
 * flow steps ... pages to enter to turn off and turn it on again flow".
 *
 * THREE FAULTS, ALL OF THEM ON THIS SCREEN.
 *
 * 1. THE SCREEN CONTRADICTED ITSELF. The enrolment row rendered for any
 *    readable list, with no question about whether THIS phone was already one
 *    of the phones in it, and every row read "This phone" whatever device its
 *    key was made on (`label` is always null). So his screen said "Money is
 *    locked with 1 phone / This phone / Added 1 Oct 2026" and, directly under
 *    it, "Add this phone". Both at once, and at most one of them true.
 *
 *    The phone's own record of the keys it made is `lib/platform/device-keys.ts`,
 *    and the account's key ids come from `stepUpStatus()`, which every money
 *    screen already reads. Together they answer the question the screen was
 *    never asking. A phone that already locks the money is not offered the
 *    enrolment; it is told so, offered the way off, and told how another phone
 *    is added (on that phone: a phone can only add itself).
 *
 * 2. THE SECOND TAP WAS MISLABELLED. Both buttons read "Add this phone", so
 *    the tap that checked the password looked like it had done nothing, and
 *    the one tap that actually asks the phone for Face ID was never made. The
 *    two taps STAY, for the reason at `setArmed` below, and they are now two
 *    numbered steps whose words differ: step one checks the password, step two
 *    is "Use Face ID or fingerprint" and says what is about to happen. The
 *    hardcoded English const that explained the second button is gone; the
 *    words are `moneyLock.stepTwo*` in the dictionary.
 *
 * 3. THE DISABLED ROW SAID NOTHING. `supported` starts null, so the row was
 *    dead and grey while the capability probe ran and dead for ever if it came
 *    back false, with no sentence either way. It now says which of the two it
 *    is.
 *
 * And the round trip (fault 1's other half): removing a phone never told this
 * phone it no longer held a key, because the settings list carries the row id
 * and never the credential id. So after a removal the add row stayed hidden
 * and the passcode screen went on offering a Face ID unlock that could only
 * fail. The ids are re-read after every change and `forgetDeviceKeysOutside`
 * drops what the account no longer has.
 */
export function MoneyLockGroup({ list, locale }: { list: MoneyCredentialList; locale: Locale }) {
  const copy = useScopedCopy("moneyLock");
  const router = useRouter();
  const lock = useMoneyStepUp();
  const [supported, setSupported] = useState<boolean | null>(null);
  /** The key ids the account holds; null until read, and null when unreadable. */
  const [accountKeys, setAccountKeys] = useState<readonly string[] | null>(null);
  /** Whether THIS phone holds one of them; null until read. */
  const [here, setHere] = useState<DeviceKeyState | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  /** The phone a removal is being explained for, before any proof is asked. */
  const [turningOff, setTurningOff] = useState<string | null>(null);
  /** Removed this session: the server has said so and the page has not been drawn again yet. */
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  /* A password changed in the last day is refused; the emailed code takes over. */
  const [forceCode, setForceCode] = useState(false);
  /* Every outcome, the enrol sheet's refusals included, goes to the one
     banner (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
  /* The proof was accepted; the phone's own lock waits for its own tap. */
  const [armed, setArmed] = useState<{ challenge: string; userId: string; email: string; rpId: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useSafeTransition();

  /**
   * Which keys the account holds, and whether this phone holds one of them.
   * Read on arrival and after every change, because both answers move: an
   * enrolment adds this phone's key and a removal takes one away, and the
   * screen must not go on describing the state before it.
   */
  const readKeys = useCallback(async () => {
    const status = await stepUpStatus().catch(() => null);
    const ids = status ? status.credentialIds : null;
    /* Unreadable: nothing is dropped, and the question falls back to this
       phone's own record, which still offers the set-up when it has none. */
    setHere(ids ? forgetDeviceKeysOutside(ids) : deviceKeyState());
    setAccountKeys(ids);
  }, []);

  useEffect(() => {
    let live = true;
    void platformLockAvailable().then((can) => {
      if (live) setSupported(can);
    });
    /* Through a microtask, like the probe above it: `readKeys` only ever
       sets state after awaiting the server, so neither call is the cascading
       render the lint rule is about, and this shape says so. */
    void Promise.resolve().then(readKeys);
    return () => {
      live = false;
    };
  }, [readKeys]);

  /* Signed out, or the lock is not deployed on this database: nothing to offer. */
  if (list.state === "signed-out" || list.state === "not-deployed") return null;
  const byCode = (list.state === "ok" && list.fallback === "email-code") || forceCode;
  /* A staff account's keys also open the console (`staffEnrolProven`). */
  const staff = list.state === "ok" && list.staff;
  const staffHasKey = staff && list.state === "ok" && list.rows.length > 0;
  const staffNeedsPassword = staff && list.state === "ok" && list.fallback === "password";

  /* Inside the sheet or not, a refusal is said by the one banner. */
  const fail = (text: string) => banner.error(text);

  const enrol = () =>
    start(async () => {
      try {
        let proof: { code?: string; password?: string; stepUp?: string };
        if (staffHasKey) {
          const stepUp = await lock.prove({ kind: "add_lock" });
          if (stepUp === null) return;
          proof = { stepUp };
        } else if (staff) {
          proof = { code: code.trim(), password: staffNeedsPassword ? password : undefined };
        } else {
          proof = byCode ? { code: password.trim() } : { password };
        }
        const begun = await beginEnrol(proof).catch(() => ({ ok: false as const, error: "failed" }));
        if (!begun.ok) {
          const refused = staffHasKey ? copy.staffAnotherKey : copy.rejected;
          fail(begun.error === "rejected" ? refused : begun.error === "password_recent" ? copy.passwordRecent : copy.failed);
          if (begun.error === "password_recent") {
            setForceCode(true);
            setCodeSent(false);
            setPassword("");
          }
          return;
        }
        /*
         * TWO TAPS, ON PURPOSE (the Face ID bug, 7 November 2026). WebKit, in
         * Safari and in the iPhone app alike, makes a passkey only inside the
         * tap that asked for it, and the password check above is a server
         * round trip that can spend that permission on a phone network: the
         * Face ID sheet never rose. So the proof is checked here, and the
         * next tap, on its own button with its own words, goes straight to
         * the phone.
         */
        setArmed(begun.data);
        setEnrolling(true);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  /* The second tap: the phone makes its key at once, inside the tap. Nothing
     is awaited before `createPlatformKey`, which is the whole point of it. */
  const confirmKey = async () => {
    const begun = armed;
    if (!begun || confirming) return;
    setConfirming(true);
    try {
      const made = await createPlatformKey({
        challenge: begun.challenge,
        userId: begun.userId,
        email: begun.email,
        rpId: begun.rpId,
        rpName: "Vallo",
        /* The keys the account already holds. The phone's OWN system sheet
           then refuses a second key for a phone that already has one, which
           is the last word on the duplicate this screen used to invite. */
        exclude: [...(accountKeys ?? [])],
      });
      if (!made) {
        banner.error(copy.rejected);
        return;
      }
      const done = await finishEnrol({ challenge: begun.challenge, ...made, label: null }).catch(() => ({
        ok: false as const,
        error: "failed",
      }));
      if (!done.ok) {
        banner.error(done.error === "rejected" ? copy.rejected : copy.failed);
        return;
      }
      /* This phone now holds a key (lib/platform/device-keys.ts). */
      rememberDeviceKey(made.credentialId);
      setArmed(null);
      setEnrolling(false);
      setPassword("");
      setCode("");
      banner.success(MONEY_LOCK_DONE);
      /* Before the refresh lands: this phone now locks the money, so the
         screen stops offering to add it in the same breath. */
      await readKeys();
      router.refresh();
    } catch (error) {
      if (!tapFailedOffline(error)) throw error;
    } finally {
      setConfirming(false);
    }
  };

  /** The turn-off sheet has been read and confirmed: now the proof, then the removal. */
  const remove = (id: string) => {
    /* The explanation closes first: the proof opens its own sheet, and two
       stacked sheets is not a flow. */
    setTurningOff(null);
    start(async () => {
      try {
        /* Removing a phone asks for a proof for exactly that. */
        const stepUp = await lock.prove({ kind: "remove_lock", target: id });
        if (stepUp === null) return;
        const done = await removeMoneyCredential({ id, stepUp }).catch(() => ({ ok: false as const, error: "failed" }));
        if (!done.ok) {
          banner.error(done.error === "rejected" ? (staff ? copy.staffKeyOnly : copy.rejected) : copy.failed);
          return;
        }
        setRemovedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
        banner.success(MONEY_LOCK_REMOVED);
        /* The phone forgets a key the account no longer has, so the set-up is
           offered again here and on the passcode screen. */
        await readKeys();
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  const rows = (list.state === "ok" ? list.rows : []).filter((row) => !removedIds.includes(row.id));
  /* The ids are the fresher answer: after an enrolment or a removal they have
     changed and this page's server render has not caught up yet. */
  const keyCount = accountKeys ? accountKeys.length : rows.length;
  const locked = keyCount > 0;
  /** This phone is one of the phones that lock the money. */
  const enrolledHere = locked && here === "has";
  /**
   * This phone is KNOWN not to be one of them. `unknown` is not that: a phone
   * whose storage was cleared holds no record and the screen must not claim
   * either way, so it says nothing and still offers the set-up, which is the
   * standing rule in `lib/platform/device-keys.ts`. The ceremony's own
   * `excludeCredentials` is what refuses a duplicate in that case.
   */
  const knownNotHere = locked && here === "none";
  /** The account holds keys and the record has not been read yet. */
  const checkingHere = locked && here === null;
  const groupNote = list.state === "unreadable" ? copy.settingsUnknown : MONEY_LOCK_BODY;
  const enrolSub = checkingHere || supported === null ? copy.settingsChecking : supported === false ? copy.settingsUnsupported : copy.settingsEnrolSteps;
  const step = armed ? 2 : 1;
  const stepLine = copy.stepCount.replace("{step}", String(step)).replace("{total}", "2");
  const stepTitle = armed ? copy.stepTwoTitle : byCode || (staff && !staffHasKey) ? copy.stepOneTitleCode : copy.stepOneTitle;
  const proofAction = byCode || (staff && !staffHasKey) ? copy.stepOneActionCode : copy.stepOneAction;

  return (
    <SettingsGroup label={copy.settingsTitle} note={<span>{groupNote}</span>}>
      {locked && (
        /* Its own label, not the group's. The heading above already says
           "Lock money with this phone"; repeating it here said nothing. */
        <RowValue icon="key" label={copy.settingsCountLabel} value={copy.settingsEnrolled.replace("{count}", plural(keyCount, copy.phones, locale))} testId="money-lock-count" />
      )}
      {(enrolledHere || knownNotHere) && (
        /* WHERE THIS PHONE STANDS, SAID ONCE. Everything below follows from
           it, and nothing below contradicts it. */
        <RowValue
          icon="phone"
          label={copy.thisPhone}
          sub={enrolledHere ? copy.thisPhoneOnBody : copy.thisPhoneOffBody}
          value={enrolledHere ? copy.thisPhoneOn : copy.thisPhoneOff}
          testId="money-lock-this-phone"
        />
      )}
      {rows.map((row) => (
        <RowButton
          key={row.id}
          icon="key"
          danger
          /* A row label is a verb, and it names the phone it acts on only
             when it can: only one row can be "this phone", and only when this
             phone is the one key the account holds. The status row above has
             already said where this phone stands, so the label does not say
             it a second time. */
          label={row.label ?? (enrolledHere && rows.length === 1 ? copy.settingsRemove : copy.settingsRemoveOther)}
          /* Two sentences, joined as two. A bare space ran them together as
             "Added 1 Oct 2026 Removing a phone asks for the same proof as
             sending money." */
          sub={`${copy.added.replace("{when}", formatDate(new Date(row.createdAt), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }))}. ${copy.settingsRemoveNeedsProof}`}
          disabled={pending}
          onClick={() => setTurningOff(row.id)}
          testId="money-lock-phone"
        />
      ))}
      {list.state === "ok" && !enrolledHere && (
        <RowButton
          icon="key"
          label={copy.settingsEnrol}
          sub={enrolSub}
          disabled={supported !== true || checkingHere || pending}
          onClick={() => {
            if (staffHasKey) enrol();
            else setEnrolling(true);
          }}
          testId="money-lock-enrol"
        />
      )}
      {enrolledHere && (
        /* The honest answer to "add another phone": not this button, that
           phone. A phone can only enrol itself. */
        <RowValue icon="phone" label={copy.anotherPhoneLabel} sub={copy.anotherPhoneBody} testId="money-lock-another-phone" />
      )}
      {lock.sheet}
      <Sheet
        open={turningOff !== null}
        onOpenChange={(open) => {
          if (pending) return;
          if (!open) setTurningOff(null);
        }}
        title={copy.offTitle}
        description={copy.offBody}
        detents={[0.6]}
      >
        <div className="space-y-row" data-testid="money-lock-off">
          <p className="nf-body text-[var(--nf-content-secondary)]">{copy.offKeeps}</p>
          {rows.length === 1 && <p className="nf-body text-[var(--nf-content-secondary)]">{copy.offLast}</p>}
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.settingsRemoveNeedsProof}</p>
          <Button
            type="button"
            variant="danger"
            full
            loading={pending}
            disabled={pending}
            onClick={() => {
              if (turningOff) remove(turningOff);
            }}
            data-testid="money-lock-off-confirm"
          >
            {copy.offConfirm}
          </Button>
          <Button type="button" variant="ghost" full disabled={pending} onClick={() => setTurningOff(null)}>
            {copy.offKeep}
          </Button>
        </div>
      </Sheet>
      <Sheet
        open={enrolling}
        onOpenChange={(open) => {
          if (pending || confirming) return;
          setEnrolling(open);
          if (!open) setArmed(null);
        }}
        title={stepTitle}
        description={armed ? copy.stepTwoBody : copy.stepOneBody}
        detents={[0.6]}
      >
        <div className="space-y-row">
          <p className="nf-caption text-[var(--nf-content-muted)]" data-testid="money-lock-step">
            {stepLine}
          </p>
          {armed ? (
            <>
              <Button type="button" variant="primary" full loading={confirming} disabled={confirming} onClick={() => void confirmKey()} data-testid="money-lock-confirm-key">
                {copy.stepTwoAction}
              </Button>
              {confirming && <p className="nf-body text-[var(--nf-content-secondary)]">{copy.stepTwoWaiting}</p>}
            </>
          ) : (
            <p className="nf-body text-[var(--nf-content-secondary)]">{staff && !staffHasKey ? copy.staffFirstKey : copy.stepOneNext}</p>
          )}
          {armed ? null : staff ? (
            <>
              {staffNeedsPassword && (
                <TextField
                  label={copy.passwordLabel}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
              {codeSent ? (
                <>
                  <TextField
                    label={copy.codeLabel}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    full
                    loading={pending}
                    disabled={pending || code.trim().length === 0 || (staffNeedsPassword && password.length === 0)}
                    onClick={enrol}
                    data-testid="money-lock-check-proof"
                  >
                    {proofAction}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  full
                  loading={pending}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        const sent = await sendFallbackCode().catch(() => ({ ok: false as const, error: "failed" }));
                        if (!sent.ok) banner.error(copy.failed);
                        else setCodeSent(true);
                      } catch (error) {
                        if (!tapFailedOffline(error)) throw error;
                      }
                    })
                  }
                >
                  {copy.sendCode}
                </Button>
              )}
            </>
          ) : byCode && !codeSent ? (
            <Button
              type="button"
              variant="primary"
              full
              loading={pending}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const sent = await sendFallbackCode().catch(() => ({ ok: false as const, error: "failed" }));
                    if (!sent.ok) banner.error(copy.failed);
                    else setCodeSent(true);
                  } catch (error) {
                    if (!tapFailedOffline(error)) throw error;
                  }
                })
              }
            >
              {copy.sendCode}
            </Button>
          ) : (
            <>
              <TextField
                label={byCode ? copy.codeLabel : copy.passwordLabel}
                type={byCode ? "text" : "password"}
                inputMode={byCode ? "numeric" : undefined}
                autoComplete={byCode ? "one-time-code" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                type="button"
                variant="primary"
                full
                loading={pending}
                disabled={pending || password.trim().length === 0}
                onClick={enrol}
                data-testid="money-lock-check-proof"
              >
                {proofAction}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            full
            disabled={pending || confirming}
            onClick={() => {
              setArmed(null);
              setEnrolling(false);
            }}
          >
            {copy.cancel}
          </Button>
        </div>
      </Sheet>
    </SettingsGroup>
  );
}
