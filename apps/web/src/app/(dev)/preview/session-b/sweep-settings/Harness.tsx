import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { BackButton } from "@/components/site/BackButton";
import {
  AppearanceCard,
  DataCard,
  LanguageRow,
  SearchCard,
  SecurityCard,
} from "@/components/app/account/SettingsGroups";
import { RowLink, RowValue, SettingsGroup } from "@/components/app/account/rows";
import { SupportChat } from "@/components/app/account/SupportChat";
import { InterestChoices } from "@/components/app/welcome/InterestChoices";
import { DeviceList } from "@/app/(app)/settings/devices/DeviceList";
import { PlaceForm } from "@/app/(app)/settings/place/PlaceForm";
import { LegalDocument } from "@/app/(app)/legal/LegalDocument";
import { TERMS_SECTIONS } from "@/lib/legal/terms";
import { ErrorView } from "./ErrorView";
import { BottomSheetView, RowsSheetView } from "./SheetViews";
import LoadingSettings from "@/app/(app)/settings/loading";
import LoadingPayments from "@/app/(app)/settings/payments/loading";
import LoadingPlace from "@/app/(app)/settings/place/loading";
import LoadingInterests from "@/app/(app)/settings/interests/loading";
import LoadingNotifications from "@/app/(app)/notifications/loading";
import { PaymentMethodsPanel } from "@/components/app/payments/PaymentMethodsPanel";
import { PushDevices } from "@/components/app/push/PushDevices";
import { PushSetting } from "@/components/app/push/PushSetting";
import { LogOutRow, SettingsHub } from "@/app/(app)/settings/SettingsHub";
import { AccountSection } from "@/app/(app)/settings/AccountSection";
import { AccountNotificationsCard, AccountPrivacyCard } from "@/app/(app)/settings/AccountToggles";
import { DevicesRow } from "@/app/(app)/settings/DevicesCard";
import { PlaceCard } from "@/app/(app)/settings/PlaceCard";
import { InterestsRow } from "@/app/(app)/settings/InterestsCard";
import { LiveNotifications } from "@/app/(app)/notifications/LiveNotifications";
import { PERSON } from "../../_fixtures/people";
import { BANK_ACCOUNTS, NOTIFICATIONS, PAYMENT_CARDS } from "../../f4/fixtures";

/**
 * The settings sweep's proof harness (rule R-G): the real settings
 * components, signed in, on fixture props, so the browser checks under
 * `apps/web/tests/` can open each settings screen without an account. FIXTURE
 * PROPS, NOT DATA: the person, the cards, the devices and the notifications
 * are invented for the picture and prove only the look.
 *
 *   ?v=hub            /settings
 *   ?v=account        /settings/account
 *   ?v=notifications  /settings/notifications
 *   ?v=privacy        /settings/privacy (privacy and security)
 *   ?v=payments       /settings/payments
 *   ?v=deleting       /settings/account with a deletion already scheduled
 *   ?v=inbox          /notifications
 *   ?v=inbox-empty    /notifications with nothing in it
 *   ?v=help           /settings/help
 *   ?v=appearance     /settings/appearance (text size, motion, language)
 *   ?v=devices        /settings/devices
 *   ?v=place          /settings/place
 *   ?v=interests      /settings/interests
 *   ?v=terms          /legal/terms, the in-app legal reader
 *   ?v=error          the in-app error boundary
 *   ?v=sheet-rows     the rows sheet open over the hub (settings-rows.css)
 *   ?v=sheet-bottom   the bottom sheet open over the hub (overlays.css)
 *   ?v=loading-<x>    the skeleton of settings, payments, place, interests, inbox
 *
 * Every settings route sits behind the sign-in gate, so each is shot here.
 * `/offline` needs no session and is shot on its real route; the not-found
 * page is shot on an unknown path under this harness, which the gate lets
 * through.
 */
const ROUTES: Record<string, string> = {
  hub: "/settings",
  account: "/settings/account",
  notifications: "/settings/notifications",
  privacy: "/settings/privacy",
  payments: "/settings/payments",
  deleting: "/settings/account",
  inbox: "/notifications",
  "inbox-empty": "/notifications",
  help: "/settings/help",
  appearance: "/settings/appearance",
  devices: "/settings/devices",
  place: "/settings/place",
  interests: "/settings/interests",
  terms: "/legal/terms",
  error: "/settings",
  "sheet-rows": "/settings",
  "sheet-bottom": "/settings",
  "loading-settings": "/settings",
  "loading-payments": "/settings/payments",
  "loading-place": "/settings/place",
  "loading-interests": "/settings/interests",
  "loading-inbox": "/notifications",
};

const LOADING: Record<string, () => React.ReactNode> = {
  "loading-settings": LoadingSettings,
  "loading-payments": LoadingPayments,
  "loading-place": LoadingPlace,
  "loading-interests": LoadingInterests,
  "loading-inbox": LoadingNotifications,
};

export function routeFor(v: string): string {
  return ROUTES[v] ?? "/settings";
}

const DELETION_NONE = {
  method: "password" as const,
  blockers: [],
  purgeAfter: null,
  daysLeft: 0,
  unavailable: false,
};

export function SweepSettingsHarness({ v }: { v: string }) {
  const t = getDictionary("en");
  const hub = t.settings.hub;

  if (v === "inbox" || v === "inbox-empty") {
    return (
      <div className="mx-auto max-w-2xl">
        <LiveNotifications initial={v === "inbox" ? NOTIFICATIONS : []} userId={PERSON.id} />
      </div>
    );
  }

  if (v === "error") return <ErrorView />;

  const Loading = LOADING[v];
  if (Loading) return <Loading />;

  if (v === "terms") {
    return (
      <LegalDocument
        title="Terms of service"
        intro="The agreement between you and Vallo when you use the platform, book a place, or list one."
        updated="28 July 2026"
        sections={TERMS_SECTIONS}
        otherHref="/legal/privacy"
        otherLabel="Privacy policy"
      />
    );
  }

  if (v === "help") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={hub.help} subtitle={hub.helpSub} fallback="/settings" />
        <div className="space-y-block">
          <SupportChat />
          <SettingsGroup label={t.settings.about.label} note={t.settings.about.note}>
            <RowLink href="/help" icon="ticket" label={t.settings.about.help} sub={t.settings.about.helpSub} />
            <RowLink href="/terms" icon="grid" label={t.settings.about.terms} />
            <RowLink href="/privacy" icon="verified" label={t.settings.about.privacy} />
            <RowValue icon="info" label={t.settings.about.version} value="0.1.0" />
            <RowValue icon="share" label={t.settings.about.licences} value="Next.js, React, Tailwind CSS (MIT)" />
          </SettingsGroup>
        </div>
      </div>
    );
  }

  if (v === "appearance") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t.settings.appearance.label} subtitle={hub.appearanceSub} fallback="/settings" />
        <AppearanceCard t={t}>
          <LanguageRow t={t} current="en" />
        </AppearanceCard>
      </div>
    );
  }

  if (v === "devices") {
    const copy = t.settings.devices;
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title={copy.screenTitle} fallback="/settings" />
        <DeviceList
          readable
          locale="en"
          othersCount={1}
          current={{
            id: "00000000-0000-4000-8000-00000000d101",
            isCurrent: true,
            device: "Safari on iOS",
            thisDevice: copy.thisDevice,
            signedIn: "Signed in 2 June",
            lastSeen: "Active now",
          }}
          groups={[
            {
              key: "device:Chrome:Windows",
              device: "Chrome on Windows",
              count: "1 session",
              firstSignedIn: "First signed in 14 August",
              lastUsed: "Last used 3 days ago",
              endLabel: "Sign out this session",
              showLabel: t.platform.devices.showSessions,
              sessionIds: ["00000000-0000-4000-8000-00000000d102"],
              sessions: [],
            },
          ]}
          notMeCopy={t.platform.notMe}
          copy={{
            intro: copy.intro,
            caveat: copy.caveat,
            endThis: copy.endThis,
            endCurrent: copy.endCurrent,
            endOthers: copy.endOthers,
            endOthersSub: copy.endOthersSub,
            endOthersNone: copy.endOthersNone,
            endEverywhere: copy.endEverywhere,
            endEverywhereSub: copy.endEverywhereSub,
            confirm: copy.confirm,
            working: copy.working,
            endedOne: copy.endedOne,
            endedOthers: copy.endedOthers,
            endedNone: copy.endedNone,
            unreadable: copy.unreadable,
            currentTitle: t.platform.devices.currentTitle,
            othersTitle: t.platform.devices.othersTitle,
            othersEmpty: t.platform.devices.othersEmpty,
            strangerHint: t.platform.devices.strangerHint,
            groupFailed: t.platform.devices.groupFailed,
            endedGroup: t.platform.devices.endedGroup,
            notMeTitle: t.platform.devices.notMeTitle,
            notMeBody: t.platform.devices.notMeBody,
            notMe: t.platform.devices.notMe,
            notMeConfirm: t.platform.devices.notMeConfirm,
            notMeWorking: t.platform.devices.notMeWorking,
          }}
        />
      </div>
    );
  }

  if (v === "place") {
    const copy = t.settings.place;
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title={copy.screenTitle} subtitle={copy.screenSubtitle} fallback="/settings" />
        <PlaceForm
          t={t}
          states={[
            { code: "LA", name: "Lagos" },
            { code: "FC", name: "Federal Capital Territory" },
          ]}
          initial={{ stateCode: "LA", lgaCode: "", occupationCode: "" }}
          initialLabels={{ lgaName: "", occupationName: "" }}
        />
      </div>
    );
  }

  if (v === "interests") {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title={t.interests.screenTitle} subtitle={t.interests.screenSubtitle} fallback="/settings" />
        {/* The route's own container, class for class (audit S11). */}
        <div className="nf-panel nf-panel--card block p-lg sm:p-lg">
          <InterestChoices initial={["apartment"]} mode="settings" t={t} />
        </div>
      </div>
    );
  }

  if (v === "account" || v === "deleting") {
    const scheduled = v === "deleting";
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={hub.accountInfo} subtitle={hub.accountInfoSub} fallback="/settings" />
        <div className="space-y-block">
          <AccountSection
            t={t}
            locale="en"
            state="signed-in"
            email="seyi@example.com"
            deletion={
              scheduled
                ? {
                    ...DELETION_NONE,
                    purgeAfter: "2026-10-23T09:00:00.000Z",
                    daysLeft: 30,
                  }
                : DELETION_NONE
            }
          />
          <PlaceCard
            t={t}
            signedIn
            stateName="Lagos"
            lgaName="Eti-Osa"
            occupationName="Product designer"
          >
            <InterestsRow t={t} signedIn interests={["apartment"]} asked />
          </PlaceCard>
          <SearchCard t={t} />
        </div>
      </div>
    );
  }

  if (v === "notifications") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={t.settings.notifications.label}
          subtitle={hub.notificationsSub}
          fallback="/settings"
        />
        <AccountNotificationsCard
          t={t}
          initial={{ bookings: true, messages: true, wallet: true, marketing: false }}
        />
        <section className="mt-block space-y-block">
          <h2 className="nf-title-sm text-content">On your phone</h2>
          <PushSetting copy={t.experienceSettings.notifications.push} />
          <PushDevices
            readable
            rows={[
              {
                id: "00000000-0000-4000-8000-00000000d001",
                name: "iPhone",
                ref: "a1b2",
                lastSeen: "today",
                firstSeen: "in June",
              },
            ]}
          />
        </section>
      </div>
    );
  }

  if (v === "privacy") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={hub.privacy} subtitle={hub.privacySub} fallback="/settings" />
        <div className="space-y-block">
          <AccountPrivacyCard t={t} initialPrivacy={{ hideActivity: false, showOccupation: false, showHomeTown: false, profileVisibility: "everyone", messagingAccess: "everyone", contactDiscovery: true }} initialDataSaver={false} />
          <SecurityCard t={t}>
            <DevicesRow t={t} signedIn count={2} />
          </SecurityCard>
          <DataCard t={t} />
        </div>
      </div>
    );
  }

  if (v === "payments") {
    const copy = t.paymentsPage;
    return (
      <div className="nf-money mx-auto max-w-2xl">
        <PageHeader layout="stacked" title={copy.title} subtitle={copy.lede} fallback="/settings" />
        <PaymentMethodsPanel
          cards={PAYMENT_CARDS}
          accounts={BANK_ACCOUNTS}
          cardsFailed={false}
          accountsFailed={false}
          copy={copy}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {v === "sheet-rows" ? <RowsSheetView /> : null}
      {v === "sheet-bottom" ? <BottomSheetView /> : null}
      <BackButton fallback="/home" className="nf-icon-btn nf-icon-btn--glass h-11 w-11" />
      <header className="nf-hub-head">
        <h1 className="nf-hub-head__title">{t.nav.settings}</h1>
        <p className="nf-hub-head__lede">{hub.ledeShort}</p>
      </header>
      <div className="space-y-block">
        <SettingsHub
          t={t}
          locale="en"
          signedIn
          person={{
            name: PERSON.name,
            email: "seyi@example.com",
            avatarUrl: PERSON.avatarUrl,
            verified: PERSON.verified,
          }}
          notifications={{ bookings: true, messages: true, wallet: true, marketing: false }}
          deviceCount={2}
        />
        <PaymentMethodsPanel
          cards={PAYMENT_CARDS}
          accounts={BANK_ACCOUNTS}
          cardsFailed={false}
          accountsFailed={false}
          copy={t.paymentsPage}
        />
        <LogOutRow t={t} signedIn />
      </div>
    </div>
  );
}
