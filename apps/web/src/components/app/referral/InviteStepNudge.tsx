import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { myInviteStep, type InviteStep } from "@/lib/referral/invite-step";
import { ButtonLink } from "@/components/ui/Button";
import { panelClass } from "@/components/ui/Panel";

/** Where each step is finished, and back to the home they were on. */
const HREF: Record<InviteStep, (back: string) => string> = {
  phone: (back) => `/settings/phone?next=${encodeURIComponent(back)}`,
  setup: () => "/settings/account",
  email: () => "/settings/account",
};

/**
 * THE INVITED MEMBER'S NEXT STEP (27 October 2026). Drawn on the home screens
 * only for somebody who joined through an invite link and has a step left.
 * Quiet by default: nothing at all for everybody else.
 */
export async function InviteStepNudge({ back }: { back: string }) {
  const step = await myInviteStep();
  if (!step) return null;
  const copy = getDictionary(await getLocale()).experienceRewards.inviteStep;
  const title = copy[`${step}Title` as const];
  const body = copy[`${step}Body` as const];
  const action = copy[`${step}Action` as const];
  return (
    <section className={panelClass({ className: "mt-md grid gap-xs p-card" })} data-testid="invite-step" data-step={step}>
      <h2 className="nf-h3">{title}</h2>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{body}</p>
      <div>
        <ButtonLink href={HREF[step](back)} variant="primary">
          {action}
        </ButtonLink>
      </div>
    </section>
  );
}
