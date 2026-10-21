import { getDictionary } from "@vallo/i18n";
import { PageHeader } from "@/components/app/PageHeader";
import { PaymentMethodsPanel } from "@/components/app/payments/PaymentMethodsPanel";
import { LogOutRow, SettingsHub } from "@/app/(app)/settings/SettingsHub";
import { PERSON } from "../../_fixtures/people";
import { BANK_ACCOUNTS, PAYMENT_CARDS } from "../fixtures";

/**
 * The settings home as a signed-in person sees it, from fixtures, for the
 * side-by-side with `7F96BE6C`. The payment methods block is worker E's
 * panel on fixture rows, because the real block reads the session and this
 * sandbox has none; the real page renders `PaymentMethodsBlock`.
 */
export default function SettingsPreview() {
  const t = getDictionary("en");
  const hub = t.settings.hub;
  return (
    <main id="main" className="nf-shell pt-xl">
      <div className="mx-auto max-w-2xl">
        <PageHeader variant="large" title={t.nav.settings} subtitle={hub.ledeShort} fallback="/preview/f4" />
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
    </main>
  );
}
