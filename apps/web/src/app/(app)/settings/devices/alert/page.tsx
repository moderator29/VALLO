import type { Metadata } from "next";
import { withNext } from "@/lib/auth/next-link";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { EmptyActions } from "@/components/app/EmptyActions";
import { resolveSession } from "@/lib/actions/session";
import { sessionWhen } from "@/lib/security/when";
import { NotMePanel } from "../NotMePanel";
import { phrase } from "../when-words";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getDictionary(await getLocale()).platform.alert.screenTitle,
    robots: { index: false, follow: false },
  };
}

/* A security answer served from a cache is an answer about the past. */
export const dynamic = "force-dynamic";

/**
 * "A NEW DEVICE SIGNED IN. WAS THIS YOU?" V-19.
 *
 * Where the new sign-in notification lands (the push, and the in-app row,
 * both written by `private.notify_new_device`). The link carries the device's
 * digest and nothing else; the words and the first-seen time are read back
 * from `public.known_devices` through `my_new_device`, which answers only for
 * the signed-in owner. A digest that belongs to somebody else, or to nobody,
 * returns no row, and the screen says it could not find that sign-in rather
 * than drawing somebody else's device or a blank card.
 *
 * Two answers and no third. "Yes, it was me" goes to the devices screen and
 * changes nothing. "This was not me" is the same panel the devices screen
 * carries: every other session ended, withdrawals and sends held for 24
 * hours, and the password form one tap away.
 */

type Loose = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<unknown> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (client: unknown) => client as any as Loose;

type Found =
  | { state: "found"; words: string | null; firstSeenAt: string; readAt: number }
  | { state: "missing" };

async function readDevice(fingerprint: string): Promise<Found | { state: "signed-out" }> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  if (!/^[0-9a-z]{1,16}$/i.test(fingerprint)) return { state: "missing" };
  try {
    const { data, error } = (await loose(session.supabase).rpc("my_new_device", {
      p_fingerprint: fingerprint,
    })) as { data: unknown; error: unknown };
    if (error || !Array.isArray(data) || data.length === 0) return { state: "missing" };
    const row = data[0] as { device_words?: unknown; first_seen_at?: unknown };
    if (typeof row.first_seen_at !== "string") return { state: "missing" };
    return {
      state: "found",
      words: typeof row.device_words === "string" ? row.device_words : null,
      firstSeenAt: row.first_seen_at,
      /* The clock belongs to the read, not the render (see `SessionsState`). */
      readAt: Date.now(),
    };
  } catch {
    return { state: "missing" };
  }
}

export default async function NewSignInAlertPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.platform.alert;
  const fold = t.platform.devices;
  const device = await readDevice(typeof d === "string" ? d : "");

  if (device.state === "signed-out") {
    return (
      <PageFrame title={copy.screenTitle} fallback="/settings/devices" width="narrow">
        <EmptyState
          icon="globe-pin"
          title={t.settings.devices.accountTitle}
          body={t.settings.devices.accountBodySignedOut}
          action={
            <EmptyActions
              primary={{
                label: t.common.signIn,
                href: withNext("/sign-in", d ? `/settings/devices/alert?d=${encodeURIComponent(d)}` : "/settings/devices/alert"),
              }}
            />
          }
        />
      </PageFrame>
    );
  }

  const notMe = (
    <NotMePanel
      title={fold.notMeTitle}
      body={fold.notMeBody}
      button={{ idle: fold.notMe, confirm: fold.notMeConfirm, working: fold.notMeWorking }}
      copy={t.platform.notMe}
      locale={locale}
    />
  );

  if (device.state === "missing") {
    return (
      <PageFrame title={copy.screenTitle} fallback="/settings/devices" width="narrow" testId="sign-in-alert-missing">
        <EmptyState
          icon="globe-pin"
          title={copy.unknownTitle}
          body={copy.unknownBody}
          action={<EmptyActions primary={{ label: copy.openDevices, href: "/settings/devices" }} />}
        />
        {notMe}
      </PageFrame>
    );
  }

  const firstSeen = phrase(copy.firstSeen, sessionWhen(device.firstSeenAt, device.readAt), t);

  return (
    <PageFrame title={copy.screenTitle} fallback="/settings/devices" width="narrow" testId="sign-in-alert">
      <div className="nf-panel nf-panel--card block p-card">
        <p className="nf-caption text-muted">{copy.heading}</p>
        <p className="nf-h3 mt-row text-content" data-testid="sign-in-alert-device">
          {device.words ?? copy.deviceUnnamed}
        </p>
        {firstSeen && <p className="nf-body-sm mt-row text-content-2">{firstSeen}</p>}
        <p className="nf-body mt-group font-semibold text-content">{copy.question}</p>
        <Link href="/settings/devices" className="nf-btn nf-btn--glass nf-btn--sm mt-row w-full">
          {copy.yes}
        </Link>
        <p className="nf-caption mt-row text-muted">{copy.yesNote}</p>
      </div>
      {notMe}
    </PageFrame>
  );
}
