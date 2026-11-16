/* Screenshot harness for Settings, Lock money with this phone (V-81, rebuilt
   14 November 2026): the real group with fixture props and this phone's own
   key record staged, so each of the three honest states can be drawn in a
   sandbox with no session.

     ?s=add     nothing added yet: the enrolment, and what its two steps are
     ?s=on      this phone locks the money: no enrolment offered, the way off,
                and how another phone is added
     ?s=other   a key on another phone: this one says it is not among them and
                is offered the set-up
     ?s=unknown this phone has no record of its own: nothing is claimed either
                way and the set-up is offered

   What a sandbox cannot draw: the sheets behind the rows end in a server
   action and a real passkey ceremony. Closed outside development by the
   preview layout's own guard. */
import { RouteCopy } from "@/lib/i18n/route-copy";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@vallo/i18n";
import { PageFrame } from "@/components/app/PageFrame";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { MONEY_LOCK_WHAT } from "@/lib/money/copy";
import type { MoneyCredentialList } from "@/lib/security/money-step-up";
import { MoneyLockPreview } from "./MoneyLockPreview";

const PHONE = { id: "11111111-1111-4111-8111-111111111111", label: null, createdAt: "2026-10-01T09:00:00.000Z", lastUsedAt: null };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = "add" } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const lede = t.experienceAccount.settings.lede;
  const list: MoneyCredentialList = {
    state: "ok",
    rows: s === "add" ? [] : [PHONE],
    fallback: "password",
    staff: false,
  };
  const seed = s === "on" ? "has" : s === "other" ? "none" : "unknown";
  return (
    <RouteCopy keys={["moneyLock"]}>
      <PageFrame title={t.platform.moneyLock.settingsTitle} fallback="/settings/privacy" width="narrow">
        <div>
          <SettingsLede label={lede.what} what={MONEY_LOCK_WHAT} who={lede.moneyLock.who} />
          <MoneyLockPreview list={list} locale={locale} seed={seed} />
        </div>
      </PageFrame>
    </RouteCopy>
  );
}
