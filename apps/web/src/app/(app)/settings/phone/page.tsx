import Link from "next/link";
import type { Metadata } from "next";
import { formatDate, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { panelClass } from "@/components/ui/Panel";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { phoneConfirmationOn } from "@/lib/phone-otp/flag";
import { isQaTester } from "@/lib/phone-otp/qa";
import { PhoneConfirmForm } from "./PhoneConfirmForm";
import { ProfilePhoneForm } from "./ProfilePhoneForm";
import { safeReturnPath } from "@/lib/security/return-path";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).trustVisible.phone.title };
}

/**
 * SETTINGS, PHONE (V-50): confirm one mobile number for this account.
 *
 * The page every phone-gated moment points to (`PhoneGateLink`, with
 * `?next=` where the member was, which the form returns them to). Its
 * states: signed out (sign in), the flag off (nothing is needed, said
 * plainly, and no form that cannot send), a QA account (never asked: said,
 * with the way back), a failed read (said, nothing changed), already
 * confirmed (the last four digits and the date, with a way to change it),
 * and the form. Loading is the settings route's own skeleton.
 */
export default async function PhoneSettingsPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const rawNext = (await searchParams).next;
  const next = safeReturnPath(typeof rawNext === "string" ? rawNext : "", "") || null;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.trustVisible.phone;
  const session = await resolveSession();

  /* One frame for every state the screen draws, so the title never moves. */
  const frame = { title: copy.title, subtitle: copy.subtitle, fallback: "/settings", width: "narrow" } as const;

  if (session.state !== "signed-in") {
    return (
      <PageFrame {...frame}>
        <EmptyState
          icon="user-verified"
          title={copy.signedOutTitle}
          body={copy.signedOutBody}
          action={<EmptyActions primary={{ label: copy.signIn, href: withNext("/sign-in", "/settings/phone") }} />}
        />
      </PageFrame>
    );
  }

  /* TESTERS ARE NEVER ASKED (13 October 2026), read on the server from the
     session's own user id. */
  if (await isQaTester(session.user.id)) {
    return (
      <PageFrame {...frame}>
        <div data-testid="phone-qa">
          <EmptyState
            icon="user-verified"
            title={copy.qaTitle}
            body={copy.qaBody}
            action={
              next ? (
                <ButtonLink href={next} variant="primary" size="lg">
                  {copy.profileBack}
                </ButtonLink>
              ) : undefined
            }
          />
        </div>
      </PageFrame>
    );
  }

  if (!(await phoneConfirmationOn())) {
    /* No code can be sent yet, but a number can still be put on the profile
       for what is opened in the member's own name (the wallet). */
    const { data: profile } = await session.supabase.from("profiles").select("phone").eq("id", session.user.id).maybeSingle();
    const onFile = (profile as { phone?: string | null } | null)?.phone?.trim() || null;
    return (
      <PageFrame {...frame}>
        <div data-testid="phone-closed">
          <ProfilePhoneForm copy={copy} currentLast={onFile ? onFile.slice(-4) : null} next={next} />
        </div>
      </PageFrame>
    );
  }

  const { data, error } = await (session.supabase as unknown as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: string): {
          maybeSingle(): Promise<{ data: { phone: string; confirmed_at: string } | null; error: unknown }>;
        };
      };
    };
  })
    .from("confirmed_phones")
    .select("phone, confirmed_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return (
    <PageFrame {...frame}>
      <div className="space-y-block">
        <p className={TYPE.body}>{copy.why}</p>
        {error ? (
          <p role="status" className={TYPE.body}>
            {copy.readFailed}
          </p>
        ) : (
          <>
            {data && (
              <div className={panelClass({ className: "p-card" })} data-testid="phone-confirmed">
                <p className="nf-body text-[var(--nf-content-primary)]">
                  {copy.confirmed
                    .replace("{last}", data.phone.slice(-4))
                    .replace("{date}", formatDate(new Date(data.confirmed_at), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }))}
                </p>
              </div>
            )}
            {/* A confirmed number never changes (2 November 2026): no form, only
                the way to support for a number that is wrong. */}
            {data ? (
              <p className={TYPE.body} data-testid="phone-fixed">
                {copy.numberFixed}{" "}
                <Link href="/support" className="nf-link">
                  {copy.contactSupport}
                </Link>
              </p>
            ) : (
              <PhoneConfirmForm copy={copy} next={next} />
            )}
          </>
        )}
      </div>
    </PageFrame>
  );
}
