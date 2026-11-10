/**
 * The one contact address in the written surface of the platform.
 *
 * Every document that names a mailbox imports this, so there is never a second
 * address to drift. The contact form at `/contact` stays the primary way in
 * (it files a ticket with a reference); this is the address for a person who
 * would rather write an email.
 */
export const CONTACT_EMAIL = "hello@vallospaces.com";

export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
