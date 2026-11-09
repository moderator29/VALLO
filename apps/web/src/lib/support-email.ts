import { BRAND_DOMAIN } from "@/lib/brand-domain";

/**
 * The one way to reach a person, and the one place that decides what it is.
 *
 * This module used to hand out `support@rentme.ng`. **That mailbox does not
 * exist.** Six surfaces printed it as a live link, and two of them were
 * Privacy and Terms, which is where somebody goes to exercise a data right
 * under the NDPA. A wrong domain sends mail to the wrong place; an address
 * with no mailbox behind it sends it nowhere, silently, and the person who
 * wrote it believes they have asked. That is worse than the naijafinds.com
 * split this file was originally written to fix.
 *
 * So the module hands out a **channel** rather than an address.
 *
 * With no mailbox configured, every one of those surfaces points at
 * `/contact`, which is not a placeholder: the form there writes a real
 * `support_tickets` row under RLS, an admin reads it in the console at
 * `/admin/support`, and a reply notifies the person who sent it. It is a
 * working channel today, which a mailto is not.
 *
 * THE DEFAULT IS NOW INVERTED, AND THAT IS THE POINT OF THIS EDIT. Setting
 * `NEXT_PUBLIC_SUPPORT_EMAIL` used to flip all six surfaces to `mailto:` in
 * one environment change, which meant the day a mailbox appeared, every
 * "contact support" control on the platform started throwing people into
 * their mail application whether they wanted that or not.
 *
 * A mail client is THE ONE PERMITTED EXIT from Vallo, and it is permitted
 * because somebody CHOSE to be emailed. A default is not a choice. So
 * `SUPPORT_HREF` is `/contact` in both worlds now, and the mailbox, when it
 * exists, is offered BESIDE the form as a second control the person can take
 * or ignore. `/contact` already renders exactly that, as copyable text with
 * its own mailto beside it.
 *
 * Nothing else about the module changes: `SUPPORT_MAILBOX` is still the one
 * place that knows whether an address exists, and the surfaces that
 * deliberately offer the mail application read `SUPPORT_MAILTO_HREF`.
 */

/**
 * THE ONE CONTACT ADDRESS (the founder, 9 November 2026: "One address
 * everywhere: hello@vallospaces.com. Put it in one constant and import it").
 * It is the company mailbox the email sender already uses at both ends
 * (`lib/email/client.ts`), so it is a real inbox a person reads. Every
 * surface that names an address imports this; nothing types it by hand.
 */
export const CONTACT_EMAIL = `hello@${BRAND_DOMAIN}`;

/**
 * The address members are offered beside the contact form. It used to come
 * from `NEXT_PUBLIC_SUPPORT_EMAIL` and was null while that was unset; there is
 * one address now, so it is always this one.
 */
export const SUPPORT_EMAIL: string = CONTACT_EMAIL;

/**
 * Where "contact support" goes. `/contact`, always, in both worlds.
 *
 * It used to be `mailto:` the moment a mailbox was configured. See the
 * inversion note above: a person who would rather stay can, and a person who
 * would rather write an email still can, from the page this points at.
 */
export const SUPPORT_HREF = "/contact";

/**
 * The mail application, for the surfaces that offer it as a choice beside the
 * form. Null when no mailbox is configured, which is the normal case today.
 *
 * THE ONE PERMITTED EXIT FROM VALLO, and it is only an exit because whoever
 * clicks it has asked to be emailed. Never use it as a default href.
 */
export const SUPPORT_MAILTO_HREF: string = `mailto:${SUPPORT_EMAIL}`;

/**
 * What the link says. It labels `SUPPORT_HREF`, so it names the form.
 *
 * This used to print the address itself where one was configured, which was
 * true only while the href was a mailto. A link that reads as an email
 * address and goes to a page is a small lie, and this module exists because
 * of a bigger one.
 */
export const SUPPORT_LABEL = "the contact form";

/**
 * The same, for a sentence built in a server action where no link is possible.
 * `lib/profile/actions.ts` puts this in the account-deletion fallback.
 */
export const SUPPORT_SENTENCE = "open the contact form at vallospaces.com/contact";

/**
 * Whether a real mailbox exists at all.
 *
 * It was called `SUPPORT_IS_EMAIL` and it meant two things at once: "a
 * mailbox is configured" and "therefore `SUPPORT_HREF` is a mailto and needs
 * `target=\"_blank\"`". The second reading is now false and would have been a
 * quiet landmine, so the name says only the first.
 *
 * Read it to decide whether to OFFER the mail application beside the form.
 * Never to decide where the primary control goes.
 */
export const SUPPORT_MAILBOX: boolean = true;

/** @deprecated Use `SUPPORT_HREF`, which is correct with no mailbox too. */
export const SUPPORT_MAILTO: string = SUPPORT_HREF;
