/* C6's member CSS move (6 October): the member-only sheets that left
   `globals.css`, the ones this tree draws, in their old globals order. They
   are the first imports so they keep their old place in the cascade: after
   every global partial, before any sheet this tree's components import. */
import "@/app/social.css";
import "@/app/social-feed.css";
import "@/app/css/passcode.css";
import "@/app/css/money-history.css";
import "@/app/css/detail-m.css";
import "@/app/css/member-loop.css";
import type { Metadata } from "next";
import { DeskKeys } from "@/components/app/desk/DeskKeys";
import { CONSOLE_JUMPS, CONSOLE_JUMP_WORDS } from "@/components/app/desk/desk-keys";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin, requireConsole } from "@/lib/admin/guard";
import { StaffFrame } from "./_components/StaffFrame";
import { getQueueCounts } from "@/lib/admin/queries";
import { getCoverageCounts } from "@/lib/admin/desk-reads/extra-counts";
import { getOpenChargebackCount } from "@/lib/admin/reads/chargebacks";
import { getShellIdentity } from "@/lib/app/shell-queries";
import { AccessScreen } from "./_components/AccessScreen";
import { ConsoleStepUp } from "./_components/ConsoleStepUp";
import { DesktopNote } from "./_components/DesktopNote";
import { notFound } from "next/navigation";
import { AdminFrame } from "./_components/AdminFrame";
import type { AdminIdentity } from "./_components/AdminNav";
import { EntryGate } from "./_components/EntryGate";
import { BackButton } from "@/components/site/BackButton";
import { getPersonTiers } from "@/lib/admin/reads/shared";
import { ENTRY_COOKIE } from "./_components/entry";
import { PasscodeLayer } from "@/components/passcode/PasscodeLayer";
import { CallLayerMount } from "@/components/calls/CallLayerMount";
/* The console's stylesheet, loaded by the console alone (B-4): it left
   `globals.css`, where every page paid for it. */
import "@/app/css/admin.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.console.title, robots: { index: false, follow: false } };
}

/**
 * The console shell, drawn from the four admin renders (5EAA44CB, 01F7DFC7,
 * 8E9602E2, C1D98B3C): a lit glass rail on the left with the Vallo mark, the
 * twelve rows and Settings and the operator at its foot; a bar across the
 * main column with the search, the clock, the bell and the operator; the desk
 * below. On a phone the rail becomes a drawer behind the bar's menu button.
 *
 * ACCESS IS DECIDED HERE, ONCE, before a single queue is read. Signed out
 * or unconfigured gets the access screen; a signed-in account that is not
 * staff gets the ordinary 404 (29 September: the console's existence is not
 * confirmed to anybody who cannot use it); staff whose session has not proved
 * its security key get the confirmation screen and nothing else.
 * The gate is `requireAdmin` exactly as before; nothing about it moved.
 *
 * WHERE THE CONSOLE LANDS (rule R-E). Every door in the product links
 * `/admin`, and an arrival BY ADDRESS lands there too: the first request to
 * any desk in a browser session is sent to `/admin?next=<desk>` by
 * `EntryGate`, which the overview answers with "You were heading to" as its
 * first link. That includes the sign-in bounce, which returns to the desk
 * address and is caught here. See `_components/entry.ts`.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const t = getDictionary(await getLocale());
  const access = await requireAdmin();
  if (access.state !== "admin") {
    /* Track K: a scoped staff member gets the restricted console, never the
       operator's rail. Anybody else gets the access screen as before. */
    const door = await requireConsole();
    if (door.state === "step-up") {
      const shell = await getShellIdentity();
      const who = shell.userName && shell.userName !== "Guest" ? shell.userName : "there";
      return <ConsoleStepUp name={who} />;
    }
    /* A signed-in account that is not staff gets the site's ordinary 404:
       nothing here confirms that a console exists. */
    if (door.state === "not-admin") notFound();
    if (door.state !== "console") return <AccessScreen t={t} state={door.state} />;
    const shell = await getShellIdentity();
    const name = shell.userName && shell.userName !== "Guest" ? shell.userName : (door.user.email ?? "Staff");
    return (
      <StaffFrame staff={door.staff} name={name}>
        <DesktopNote />
        <PasscodeLayer>{children}</PasscodeLayer>
        <DeskKeys jumps={CONSOLE_JUMPS} jumpWords={CONSOLE_JUMP_WORDS} />
        {/* VC1: review calls ring and play on the staff desk too. */}
        <CallLayerMount />
      </StaffFrame>
    );
  }

  const [counts, shell, jar, tiers, coverage, chargebacks] = await Promise.all([
    getQueueCounts(),
    getShellIdentity(),
    cookies(),
    // B-BADGE: the operator's published tier, for the shared slot beside their name.
    getPersonTiers([access.user.id]),
    // Retention, seating disputes and email recoveries: waiting, with no queue count of their own.
    getCoverageCounts(),
    /* Chargebacks not yet decided, read on the operator's own session
       (`staff_chargebacks` checks the finance scope itself). */
    getOpenChargebackCount(access.userClient),
  ]);
  /* R-E: has this browser session opened the overview as this operator? */
  const entered = jar.get(ENTRY_COOKIE)?.value === access.user.id;
  const badges: Record<string, number> = { ...(counts.state === "ok" ? counts.data : {}), ...coverage };
  if (chargebacks > 0) badges.chargebacks = chargebacks;

  const email = access.user.email ?? "";
  const name = shell.userName && shell.userName !== "Guest" ? shell.userName : email.split("@")[0] || "Admin";
  const identity: AdminIdentity = {
    name,
    role: access.isSuperAdmin ? t.admin.shell.bar.owner : t.admin.shell.bar.operator,
    initial: name.charAt(0).toUpperCase() || "V",
    avatarUrl: shell.avatarUrl || null,
    tier: tiers.get(access.user.id) ?? null,
  };

  return (
    <AdminFrame
      identity={identity}
      counts={badges}
      unread={shell.unreadNotifications}
      navLabel={t.admin.console.navLabel}
      navLabels={t.admin.nav}
      searchLabel={t.admin.common.searchLabel}
      bellLabel={t.uiCommon.console.notifications}
      shell={t.admin.shell}
      back={<BackButton fallback="/admin" surface="round" />}
      experience={{
        palette: t.experienceAdmin.palette,
        deskLedes: t.experienceAdmin.deskLedes,
        waitingTotal: t.experienceAdmin.shell.waitingTotal,
      }}
    >
      <EntryGate entered={entered} userId={access.user.id} opening={t.admin.shell.entry.opening}>
        <DesktopNote />
        {/* The passcode lock (docs/PASSCODE.md), for staff as for everyone. */}
        <PasscodeLayer>{children}</PasscodeLayer>
        {/* C6: j/k, a/x, g-jumps and ? on every desk but support, which has its own. */}
        <DeskKeys jumps={CONSOLE_JUMPS} jumpWords={CONSOLE_JUMP_WORDS} />
        <CallLayerMount />
      </EntryGate>
    </AdminFrame>
  );
}
