import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { isCryptoReference } from "@/lib/payments/references";
import { readCryptoPayment } from "@/lib/crypto/service";
import { activeProvider } from "@/lib/crypto/providers";
import { PageFrame } from "@/components/app/PageFrame";
import { ResultScreen } from "@/components/app/ResultSheet";
import { CryptoPaymentStatus } from "@/components/app/payments/crypto/CryptoPaymentStatus";
import { withNext } from "@/lib/auth/next-link";

export const metadata: Metadata = { title: "Crypto payment" };

/**
 * One crypto payment: where to send it, where it stands, and its receipt.
 *
 * Where every crypto notification and email points. The row is read under
 * the payer's OWN session (RLS: `crypto_payments_payer_select`), so a
 * reference that is not theirs is simply not found, and this page cannot be
 * used to ask about somebody else's payment. It draws what the database says
 * and polls the same row; nothing here can mark a charge paid.
 *
 * Deliberately NOT gated on the crypto flag: a payment already under way must
 * stay visible, with its receipt, even after crypto is switched off.
 */
export default async function CryptoPaymentPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const locale = await getLocale();
  const t = getDictionary(locale).cryptoPay;
  const c = getDictionary(locale).checkout;
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    return (
      <Shell title={t.pageTitle}>
        <ResultScreen
          state="sign-in"
          verdict={c.signIn}
          consequence={t.signedOutBody}
          /* Back to this payment after signing in: the bare /sign-in left the
             payer on the home screen with no way back to the payment. */
          actions={[{ label: c.signIn, href: withNext("/sign-in", `/pay/crypto/${encodeURIComponent(reference)}`), tone: "primary" }]}
        />
      </Shell>
    );
  }

  /* A malformed escape in the address (`%E0%A4%A`) throws; it is simply not a
     payment of ours, so it answers as not found rather than as a crash. */
  let ref = "";
  try {
    ref = decodeURIComponent(reference ?? "");
  } catch {
    ref = "";
  }
  const client = session.supabase as unknown as SupabaseClient;
  const view = isCryptoReference(ref) ? await readCryptoPayment(client, { reference: ref }) : null;

  if (!view) {
    return (
      <Shell title={t.pageTitle}>
        <ResultScreen
          state="missing"
          verdict={t.notFound}
          consequence={t.notFoundBody}
          actions={[{ label: t.backToCharge, href: "/bookings", tone: "primary" }]}
        />
      </Shell>
    );
  }

  const providerName = activeProvider()?.displayName ?? "the provider";
  const chargeHref = await chargeHrefFor(client, view.bookingId);
  return (
    <Shell title={t.pageTitle}>
      <CryptoPaymentStatus initial={view} locale={locale} providerName={providerName} />
      <p className="mt-lg text-center">
        <Link href={chargeHref} className="nf-body-sm font-semibold text-[var(--nf-brand-primary)] underline">
          {t.backToCharge}
        </Link>
      </p>
    </Shell>
  );
}

/**
 * Where the charge this payment is for can be paid: a rent charge lives on
 * the rent page of its inspection, a stay on its checkout. Read under the
 * payer's own session; any failure falls back to the checkout, which answers
 * honestly for either kind.
 */
async function chargeHrefFor(client: SupabaseClient, bookingId: string): Promise<string> {
  try {
    const { data } = await client.from("rent_payments").select("inspection_id").eq("booking_id", bookingId).maybeSingle();
    const inspectionId = (data as { inspection_id?: string } | null)?.inspection_id;
    if (inspectionId) return `/rent/pay/${inspectionId}`;
  } catch {
    /* fall through to the checkout */
  }
  return `/checkout/${bookingId}`;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PageFrame title={title} fallback="/bookings" width="narrow">
      {children}
    </PageFrame>
  );
}
