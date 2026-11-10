import { readFeeCalcConfig } from "./config";
import { FeeCalculator } from "./FeeCalculator";

/**
 * The calculator with its rates: read on the server (`config.ts`), handed to
 * the small client component as plain data. Placed by a chapter section that
 * asks for it (`tool: "fee-calculator"`) and by the help centre's payments
 * topic, so both show the same figures from the same read.
 */
export async function FeeCalculatorSection() {
  return <FeeCalculator config={await readFeeCalcConfig()} />;
}
