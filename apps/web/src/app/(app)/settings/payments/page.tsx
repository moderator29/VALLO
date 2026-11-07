import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { PaymentMethodsBlock } from "@/components/app/payments/PaymentMethodsBlock";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import {
  PARTNERS_SHORT,
  PAYOUT_ANSWER,
  SETTINGS_PAY_DOOR,
  SETTINGS_PAY_PAID_TITLE,
  SETTINGS_PAY_RECORDS,
} from "@/lib/money/copy";

/* R3-04: the records beside the methods, each its own screen. */
const RECORDS: { href: string; icon: UiIconName; key: keyof typeof SETTINGS_PAY_DOOR }[] = [
  { href: "/receipts", icon: "receipt", key: "receipts" },
  { href: "/refunds", icon: "hand-coins", key: "refunds" },
  { href: "/payouts", icon: "bank", key: "payouts" },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).paymentsPage.title,
    robots: { index: false, follow: false },
  };
}

/* A list of somebody's cards is never served from a cache. */
export const dynamic = "force-dynamic";

/**
 * /settings/payments: "Payment methods". Shared by both sides, because both
 * pay and both are paid. The one block, on its own page with its lede; the
 * same block sits in the settings home's slot.
 */
export default async function PaymentsPage() {
  const [locale, session] = await Promise.all([getLocale(), resolveSession()]);
  const t = getDictionary(locale);
  const copy = t.paymentsPage;

  if (session.state !== "signed-in") {
    return (
      <PageFrame title={copy.title} fallback="/settings" width="narrow">
        <EmptyState
          icon="card-lock"
          title={copy.signInTitle}
          body={copy.signInBody}
          action={<EmptyActions primary={{ label: t.common.signIn, href: withNext("/sign-in", "/settings/payments") }} />}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame title={copy.title} subtitle={copy.lede} fallback="/settings" width="narrow">
      {/* `nf-money` stays on the body: its blocks reach into the gutter on a
          phone, the title does not. */}
      <div className="nf-money">
      <PaymentMethodsBlock />
      <p className={`mt-row px-2xs ${TYPE.caption}`}>{copy.cardsNote}</p>

      {/* How a lister is paid, said once here where the bank account is
          added, from the one sentence every surface reads (D50). */}
      <section className="nf-panel nf-panel--card mt-block" aria-labelledby="nf-paid-how" data-testid="settings-paid-how">
        <h2 id="nf-paid-how" className="nf-body font-semibold text-[var(--nf-content-primary)]">
          {SETTINGS_PAY_PAID_TITLE}
        </h2>
        <p className={`mt-inline ${TYPE.body}`}>{PAYOUT_ANSWER}</p>
      </section>

      <div className="mt-block">
        <ListGroup label={SETTINGS_PAY_RECORDS} labelAs="h2">
          {RECORDS.map((door) => (
            <ListRow
              key={door.href}
              href={door.href}
              chevron
              leading={
                <IconPlate size="sm">
                  <UiIcon name={door.icon} size={ICON_PLATE_GLYPH.sm} />
                </IconPlate>
              }
              title={SETTINGS_PAY_DOOR[door.key].title}
              sub={SETTINGS_PAY_DOOR[door.key].sub}
            />
          ))}
        </ListGroup>
      </div>
      <p className={`mt-row px-2xs ${TYPE.caption}`}>{PARTNERS_SHORT}</p>
      </div>
    </PageFrame>
  );
}
