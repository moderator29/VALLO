"use client";

import type { AccountCopy } from "@/components/app/account/settings-copy";
import { withNext } from "@/lib/auth/next-link";
import { clearListingDrafts } from "@/lib/agent/listing-draft-storage";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RowLink, RowValue, RowButton, SettingsGroup } from "@/components/app/account/rows";
import { clearPacks } from "@/lib/offline/pack-store";
import { clearShelf } from "@/lib/offline/shelf-store";
import { clearOutbox } from "@/lib/offline/outbox";
import { forgetKeptPages } from "@/lib/offline/page-cache";
import { forgetWidget } from "@/lib/native/widget";
import { revokeWidgetTokens } from "@/lib/native/widget-actions";
import { clearAllInflight } from "@/lib/offline/inflight";
import { signOut } from "@/lib/profile/actions";
import { clearLocalDevice, readLocalDevice } from "@/components/app/push/device-state";
import { playThreshold } from "@/lib/motion/threshold";
import { DeleteAccountPanel } from "./DeleteAccountPanel";
import type { Blocker } from "@/lib/account-deletion/preconditions";
import type { Locale } from "@vallo/i18n/core";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * The account block: who you are signed in as, sign out, and deletion.
 *
 * DELETION MOVED OUT OF THIS FILE. It used to be a drawer here that ended in
 * `admin.auth.admin.deleteUser`, which cannot complete for anybody who has
 * booked or paid for anything, because `bookings.guest_id` and
 * `wallets.user_id` are both `on delete restrict`. The whole flow, its
 * preconditions and the thirty day window now live in `DeleteAccountPanel`,
 * driven by `lib/account-deletion`. See `docs/design/audits/r3/findings.md`
 * F-17.
 *
 * The control stays exactly where it was, last in the Account group, reading
 * as what it is before it is pressed. It is not hidden, not moved behind a
 * support link and not made harder to find than it was: rule 15 is as binding
 * on a control somebody is leaving through as on one they are arriving at.
 */
export function AccountSection({
  t,
  locale,
  state,
  email,
  deletion,
}: {
  /* Handed down from the settings page, which resolved the locale. The flow
     below is the one control in the app that cannot be undone, so not one word
     of it may arrive in a language the person did not choose. */
  t: AccountCopy;
  locale: Locale;
  state: "signed-in" | "signed-out" | "unconfigured";
  email: string;
  /** What lib/account-deletion knows about this account, read on the server. */
  deletion: {
    method: "password" | "email-code";
    blockers: Blocker[];
    purgeAfter: string | null;
    daysLeft: number;
    unavailable: boolean;
  };
}) {
  const router = useRouter();
  const copy = t.settings.account;
  const [signingOut, startSignOut] = useSafeTransition();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const leave = () => {
    setSignOutError(null);
    startSignOut(async () => {
      /* V-98: the widget stops reading this account before the session ends. */
      await revokeWidgetTokens().catch(() => undefined);
      /* The push row for THIS device is retired with the session. */
      const result = await signOut(readLocalDevice()?.deviceRef);
      if (!result.ok) {
        setSignOutError(result.error);
        return;
      }
      /* V-35, V-77: a shared phone keeps neither somebody else's gate code
         nor their shortlist. */
      await clearPacks();
      await clearShelf();
      /* SUP-16: a listing draft never outlives the session that wrote it. */
      clearListingDrafts();
      await clearOutbox();
      /* The pages this phone kept for offline go with the session. */
      await forgetKeptPages();
      await forgetWidget();
      clearAllInflight();
      clearLocalDevice();
      /* Track M: the page recedes and the panels close on the mark. */
      await playThreshold("leave");
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <SettingsGroup
      label={copy.label}
      note={
        signOutError ? (
          <span role="alert" className="text-[var(--nf-state-error)]">
            {signOutError}
          </span>
        ) : state === "unconfigured" ? (
          copy.unconfiguredNote
        ) : undefined
      }
    >
      {/* Payment methods: the cards you pay with and the accounts you are
          paid into, a screen of their own. Both sides pay and both are paid,
          so it lives under Account rather than under either console. */}
      {state === "signed-in" && (
        <RowLink
          href="/settings/payments"
          icon="wallet"
          label={t.paymentsPage.settingsRow}
          sub={t.paymentsPage.settingsRowSub}
          testId="settings-payments-row"
        />
      )}
      <RowValue
        icon="user"
        label={state === "signed-in" ? copy.signedIn : copy.notSignedIn}
        sub={
          state === "signed-in"
            ? undefined
            : state === "signed-out"
              ? copy.signedOutSub
              : copy.unconfiguredSub
        }
        value={state === "signed-in" ? email || copy.activeOnThisDevice : undefined}
      />

      {state === "signed-in" ? (
        <RowButton
          icon="arrow-right"
          label={signingOut ? copy.signingOut : t.common.signOut}
          onClick={leave}
          disabled={signingOut}
          chevron={false}
        />
      ) : state === "signed-out" ? (
        <RowLink href={withNext("/sign-in", "/settings/account")} icon="key" label={t.common.signIn} />
      ) : null}

      {state === "signed-in" && (
        <DeleteAccountPanel
          t={t}
          locale={locale}
          method={deletion.method}
          blockers={deletion.blockers}
          purgeAfter={deletion.purgeAfter}
          daysLeft={deletion.daysLeft}
          unavailable={deletion.unavailable}
        />
      )}
    </SettingsGroup>
  );
}
