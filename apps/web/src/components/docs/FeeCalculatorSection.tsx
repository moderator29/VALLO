import { readListerFees } from "@/lib/site/lister-fees";
import { DocCallout } from "./DocCallout";
import { FeeCalculator } from "./FeeCalculator";

/**
 * THE FEE CALCULATOR, ON A PAGE. A server component: it reads the current
 * rates with `readListerFees` (the same read the supply pages use, from
 * `public.fee_rates`) and hands numbers to the client calculator. If the rates
 * cannot be read it does not guess; it says so and shows no figures.
 */
export async function FeeCalculatorSection() {
  const rates = await readListerFees();
  if (!rates) {
    return (
      <DocCallout kind="note" title="Rates not available just now">
        <p>
          The calculator reads the live rates and cannot reach them at the moment, so it shows no figures rather than
          guess. Your own listing shows the exact fee before you publish.
        </p>
      </DocCallout>
    );
  }
  return <FeeCalculator rates={rates} />;
}
