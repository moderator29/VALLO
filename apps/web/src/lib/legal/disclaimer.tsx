/**
 * THE DISCLAIMER (Track B, 25 September 2026).
 *
 * Founder directive: anything that happens off the platform is not Vallo's
 * responsibility, and that has to be said in a document of its own rather than
 * only inside the Terms, where nobody deciding whether to send a transfer will
 * find it. It forms part of the Terms (section 15 points here), and it is
 * rendered by `(site)/disclaimer` and `(app)/legal/disclaimer` from this one
 * array, so the two copies cannot differ.
 *
 * Every money sentence is read from `lib/money/copy.ts`.
 */
import Link from "next/link";
import { COMPANY_FORMAL_NAME, COMPANY_TRADING_NAME } from "./company";
import {
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  OFF_PLATFORM_SENTENCE,
  PRIVATE_FEE_NOTE,
} from "@/lib/money/copy";

export const DISCLAIMER_UPDATED = "25 September 2026";

const LINK = "font-semibold text-[var(--nf-content-link)] hover:underline";

export const DISCLAIMER_SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Off the platform is outside our responsibility",
    body: (
      <>
        <p>
          <strong>{OFF_PLATFORM_SENTENCE}</strong>
        </p>
        <p>
          That includes, without exception: money paid in cash, by direct bank transfer,
          by mobile money, in crypto sent to anybody&rsquo;s address, or by any route other
          than the checkout on {COMPANY_TRADING_NAME}; conversations moved to WhatsApp, a
          phone call, email or any other app; agreements signed or varied outside the
          platform; and keys, documents or property handed over without a record on the
          platform.
        </p>
        <p>
          We cannot see any of it, cannot verify any of it and cannot recover money paid
          that way. If anybody asks you to
          move a payment or a conversation off the platform, report them.
        </p>
      </>
    ),
  },
  {
    title: "2. We are a marketplace, not a party",
    body: (
      <>
        <p>
          {COMPANY_TRADING_NAME} connects people who list property and stays with people
          looking for them. The property is provided by the person who listed it. A
          tenancy, a sale or a stay is between you and them; {COMPANY_FORMAL_NAME} is not
          the landlord, the vendor, the host or an agent for either side.
        </p>
        <p>
          Approving an agreement means a person at {COMPANY_TRADING_NAME} checked that it
          is complete and consistent with the listing and the inspection report. It is not
          a guarantee of the property, of its title or of the behaviour of anybody in the
          deal.
        </p>
      </>
    ),
  },
  {
    title: "3. We never hold your money",
    body: (
      <p>
        {NO_CUSTODY_SENTENCE} {COMPANY_TRADING_NAME} is not a bank, a wallet provider, an
        escrow agent or a licensed financial institution, keeps no balance in your name and
        never gives you a crypto address of its own. A payment that has settled to an owner
        or agent is theirs; we cannot reverse it.
      </p>
    ),
  },
  {
    title: "4. Inspection fees",
    body: (
      <p>
        <strong>{NO_INSPECTION_FEE}</strong> {PRIVATE_FEE_NOTE}
      </p>
    ),
  },
  {
    title: "5. Vallo does not guarantee the deal",
    body: (
      <p>
        Vallo is not a party to your tenancy or your sale, is not acting as agent for
        either side, and does not guarantee the transaction. The Vallo Guarantee was
        retired on 9 November 2026. The Terms of service, section 14, set out what Vallo
        does and does not do, and exactly what we will do if something goes wrong.
      </p>
    ),
  },
  {
    title: "6. Listings, verification and information",
    body: (
      <>
        <p>
          What a listing says, including its photographs, its price and any title it
          states, is what the person who listed it says. A verified badge tells you who
          somebody is, not how they will behave. Have a lawyer verify title at the land
          registry before money moves on any purchase.
        </p>
        <p>
          Price Check reports what places on the platform are asking. Price Check
          figures, area notes and anything written by the assistant are guidance, not
          legal advice or a survey, and they can be wrong.
        </p>
      </>
    ),
  },
  {
    title: "7. How this fits with the Terms",
    body: (
      <p>
        This disclaimer forms part of the{" "}
        <Link href="/terms" className={LINK}>
          Terms of service
        </Link>
        . Nothing in it excludes liability that cannot lawfully be excluded under Nigerian
        law, including for fraud or for death or personal injury caused by negligence.
      </p>
    ),
  },
];
