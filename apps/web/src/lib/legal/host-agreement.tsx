import type { ReactNode } from "react";

/**
 * THE HOST AGREEMENT: what a host of a stay or a restaurant agrees to, beside
 * the Terms of service and the Privacy policy.
 *
 * A host agrees to all three before their business is created (the wizard's
 * business step), and the agreement is recorded on the business with the
 * moment and the version of each (`consents.agreements`). A business whose
 * host has not agreed to the current version is not sent for review and not
 * published. Plain words on purpose: a host should be able to read it in two
 * minutes and know exactly what they may and may not charge.
 *
 * Changing these words means a new HOST_AGREEMENT_VERSION, and every host is
 * then asked again before their next application is sent.
 */
export { HOST_AGREEMENT_VERSION } from "./versions";

export const HOST_AGREEMENT_SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "1. Who this is for",
    body: (
      <p>
        You agree to this when you set up a hotel, a guest house, serviced apartments, a shortlet
        or a restaurant on Vallo. It sits beside the Terms of service and the Privacy policy, which
        apply to you too.
      </p>
    ),
  },
  {
    title: "2. You may only charge what is listed",
    body: (
      <ul>
        <li>
          <strong>You must not charge a guest anything that is not listed on Vallo.</strong> The
          nightly price, each rate, and every charge at the door (a caution deposit, power,
          cleaning, an extra guest, a visitor) are listed on your page before anybody books.
        </li>
        <li>
          <strong>Every charge you list must say what it is for.</strong> You cannot add a charge
          without a stated reason.
        </li>
        <li>
          <strong>Anything not listed cannot be charged.</strong> If a guest is asked for money that
          is not listed, they can report it, and we may refund them and stop your listing.
        </li>
        <li>
          A caution deposit is returned to the guest under the rules you listed with it. It is never
          kept by a cancellation policy.
        </li>
      </ul>
    ),
  },
  {
    title: "3. Cancellations",
    body: (
      <ul>
        <li>
          You pick one cancellation policy: Flexible, Moderate, Firm or Strict. Its refund rules are
          shown to the guest before they book, and the refund follows them.
        </li>
        <li>
          Deadlines are counted in Lagos time from check-in at the time you state. Refunds are paid
          in naira through our payment provider.
        </li>
      </ul>
    ),
  },
  {
    title: "4. Restaurants",
    body: (
      <ul>
        <li>
          Asking for a table is free for the diner, and a table is never paid for in advance. You
          confirm a table when you have one, and the diner pays the bill at your restaurant.
        </li>
        <li>
          Listing is free. Vallo charges a restaurant only for completed visits: a fixed fee for
          each table seated from a Vallo reservation, whatever the size of the party, billed once a
          month at the amount published on the What Vallo costs page (/docs/what-vallo-costs). A
          no-show or a cancelled table costs you nothing. You mark each table seated or a no-show
          after its time, honestly.
        </li>
      </ul>
    ),
  },
  {
    title: "5. What you tell us is true",
    body: (
      <p>
        Your papers, your photographs, your prices and your hours describe the place a guest will
        actually find. A person at Vallo reads your application before anything is published, and we
        may stop a listing that is not true.
      </p>
    ),
  },
];
