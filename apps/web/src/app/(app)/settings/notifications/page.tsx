import type { Metadata } from "next";
import { forNotificationsCard } from "@/components/app/account/settings-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { NotificationsCard } from "@/components/app/account/SettingsGroups";
import { loadSettingsState } from "@/lib/profile/queries";
import { PushDevices, type PushDeviceView } from "@/components/app/push/PushDevices";
import { PushSetting } from "@/components/app/push/PushSetting";
import { deviceName, loadPushDevices, whenPhrase } from "@/lib/push/devices";
import { NotificationMatrix } from "./NotificationMatrix";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { SettingsInnerNav } from "@/components/app/account/SettingsInnerNav";


/* English until the key lands in the dictionary, like the other words this
   screen states once. */
const REMINDERS_ROW = {
  label: "Reminders",
  sub: "Places near you, people you follow, gentle nudges",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.notifications.label };
}

/**
 * NEVER CACHED, and on this screen that is a correctness property rather than
 * a freshness one. A list of devices served from a cache is a list of devices
 * that could be reached at some point in the past, shown to somebody deciding
 * right now whether to turn one off.
 */
export const dynamic = "force-dynamic";

/**
 * Notifications, channel by channel, and the phones they reach.
 *
 * ===========================================================================
 * TWO THINGS ARE MOUNTED HERE THAT WERE NOT BEFORE, AND THE SECOND IS THE ONE
 * THAT MATTERS.
 *
 * `PushSetting` is the one place asking about notifications is not an
 * interruption, because the person came here to ask us.
 *
 * `PushDevices` is what makes the permission reversible. WITHOUT A DEVICE
 * LIST, PUSH IS SOMETHING A PERSON CAN GRANT AND CANNOT TAKE BACK except by
 * uninstalling Vallo, which is not a setting, it is an ultimatum.
 *
 * Both are below the existing channel toggles rather than above them. The
 * toggles are what a person came for; the devices are the fine print of a
 * decision they have already made.
 *
 * ===========================================================================
 * THE ROWS ARE FORMATTED HERE, IN THE SERVER COMPONENT.
 *
 * The client component holds no copy of the device data, so there is no path
 * by which the screen shows a device that is no longer live: the actions call
 * `revalidatePath` and this re-renders from the database. Nothing that leaves
 * this file carries a push token. See `lib/push/devices.ts` for what is
 * selected and, more to the point, what is not.
 *
 * SIGNED OUT, THE PUSH BLOCK IS NOT DRAWN AT ALL. A device list belongs to an
 * account, and a stranger on a shared handset has no account here yet. The
 * channel toggles above still work: they fall back to the device document,
 * which is the existing behaviour and is not changed.
 */
export default async function NotificationsSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const account = await loadSettingsState();
  const push = await loadPushDevices();
  const copy = t.experienceAccount.settings;

  const rows: PushDeviceView[] =
    push.state === "signed-in"
      ? push.devices.map((row) => ({
          id: row.id,
          name: deviceName(row),
          ref: row.ref,
          lastSeen: whenPhrase(row.lastSeen),
          firstSeen: whenPhrase(row.firstSeen),
        }))
      : [];

  return (
    <PageFrame
      title={t.settings.notifications.label}
      subtitle={t.settings.hub.notificationsSub}
      fallback="/settings"
      width="narrow"
    >
      {/* One child: the lede and the inner nav keep their 16px foot. */}
      <div>
      <SettingsLede label={copy.lede.what} what={copy.lede.notifications.what} who={copy.lede.notifications.who} />
      {push.state === "signed-in" && (
        <SettingsInnerNav
          label={copy.nav.label}
          toggleLabel={copy.nav.toggle}
          currentLabel={t.settings.notifications.label}
          sections={[
            { id: "settings-notifications", label: copy.notificationsNav.navChannels, icon: "bell" },
            { id: "settings-push", label: copy.notificationsNav.navPhone, icon: "phone" },
          ]}
        />
      )}
      <section id="settings-notifications" className="scroll-mt-28">
        {account.state === "signed-in" ? (
          /* R3-14: event by channel, and quiet hours, each cell a preference
             delivery reads (NotificationMatrix's header says which). */
          <NotificationMatrix initial={account.settings.notifications} copy={t.experienceSettings.notifications} />
        ) : (
          <NotificationsCard t={forNotificationsCard(t)} />
        )}
      </section>

      {/* The reminders Vallo may send on its own (Agent FEATURES' screen),
          one tap down from the channels. */}
      <section id="settings-reminders" className="mt-block scroll-mt-28">
        <SettingsGroup label={REMINDERS_ROW.label}>
          <RowLink
            href="/settings/notifications/reminders"
            icon="bell"
            label={REMINDERS_ROW.label}
            sub={REMINDERS_ROW.sub}
            testId="settings-reminders-row"
          />
        </SettingsGroup>
      </section>

      {push.state === "signed-in" && (
        <section id="settings-push" className="mt-block scroll-mt-28 space-y-block">
          <h2 className="nf-title-sm text-content">{copy.notificationsNav.navPhone}</h2>
          {/* The same live rows the list below draws, by `device_ref`. The
              control reads on only when THIS device's ref is among them: see
              `components/app/push/device-state.ts`. */}
          <PushSetting registeredRefs={rows.map((row) => row.ref)} />
          <PushDevices rows={rows} readable={push.readable} />
        </section>
      )}
      </div>
    </PageFrame>
  );
}
