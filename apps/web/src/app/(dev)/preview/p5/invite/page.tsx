import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { previewHarnessIsOpen } from "@/lib/preview-harness";
import { PageHeader } from "@/components/app/PageHeader";
import { InviteTicket } from "@/components/app/account/InviteTicket";
import { InviteReadyPill } from "@/components/money/InviteReadyPill";
import { RowLink, RowValue, SettingsGroup } from "@/components/app/account/rows";
import { SettingsLede } from "@/components/app/account/SettingsLede";

export const dynamic = "force-dynamic";

/** /settings/invite with a fixture code, composed in the route's order, rewards not live. */
export default async function InvitePreview() {
  if (!previewHarnessIsOpen(process.env)) notFound();
  const t = getDictionary("en");
  const door = t.publicDoors.invite;
  const copy = t.experienceAccount.invite;
  const lede = t.experienceAccount.settings.lede;
  const code = "K7M2QX";
  const url = `https://vallospaces.com/join/${code}`;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={door.rowTitle} subtitle={door.rowSub} fallback="/preview/p5" />
      <SettingsLede label={lede.what} what={lede.invite.what} who={lede.invite.who} />
      <div className="space-y-block">
        <InviteReadyPill label="Your invite is ready" url={url} shareText={door.shareText.replace("{url}", url)} shareAria={copy.shareAria} />
        <InviteTicket copy={copy} code={code} url={url} shareText={door.shareText.replace("{url}", url)} whatsappLabel={door.whatsapp} dismissLabel={t.experienceUi.notNow} autoplay={false} />
        <SettingsGroup label={copy.groupLabel}>
          {/* Stays `overflow-wrap: anywhere` on purpose: an invite link is one token and must wrap inside the row (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
          <RowValue icon="link" label={copy.linkLabel} value={<span className="nf-numeric [overflow-wrap:anywhere]">{url.replace(/^https?:\/\//, "")}</span>} testId="invite-url" />
          <RowLink href="/settings/invite/how-it-works" icon="info" label={copy.howTitle} sub={copy.howSub} testId="invite-how-row" />
          <RowLink href="/settings/invite/referrals" icon="users" label={copy.referralsTitle} sub={copy.referrals.lede} testId="invite-referrals-row" />
          <RowLink href="/rewards" icon="hand-coins" label={t.experienceRewards.title} sub={t.experienceRewards.inviteHub.balanceRowSub} testId="invite-rewards-door" />
        </SettingsGroup>
      </div>
    </div>
  );
}
