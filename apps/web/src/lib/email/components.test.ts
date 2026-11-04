import { describe, expect, it } from "vitest";
import { everyComponent } from "./components-fixture";
import { sortEmailImages } from "./images";
import { LIGHT, PAPER_STATE } from "./theme";

/**
 * The email components (north star 16.5), checked as email: tables only,
 * every one present in both renderings, the paper register holding the card
 * at paper, the status chip saying its state with a word and a shape, and a
 * space card with no photograph drawing no picture of somewhere else.
 */
describe.each([
  ["paper", everyComponent("paymentReceipt"), "rm-sheet"],
  ["shell", everyComponent("newEnquiry"), "rm-card"],
] as const)("every component, %s register", (_register, message, cardClass) => {
  it("lays out with tables, never flex or grid", () => {
    expect(message.html).not.toMatch(/display\s*:\s*(flex|grid|inline-flex|inline-grid)/);
    expect(message.html).toContain(`class="${cardClass}"`);
  });

  it("says every component in the text part too", () => {
    for (const words of [
      "Paid in total: ₦195,000.50",
      "Status: Confirmed",
      "Dates: Fri 14 Aug to Sun 16 Aug",
      "Total: ₦195,000.50",
      "[x] Inspection report submitted (3 October)",
      "[ ] Vallo approves it",
      "Move-in total: ₦2,400,000",
      "Adaeze Chinwe Obi, Agent",
      "482 913",
      "Never pay anybody outside Vallo.",
      "Open the booking:\nhttps://vallospaces.com/bookings",
    ]) {
      expect(message.text).toContain(words);
    }
  });

  it("draws each state with its own shape beside its word", () => {
    expect(message.html).toContain(`border-radius:4px;background-color:${PAPER_STATE.success};`);
    expect(message.html).toContain(`border:2px solid ${PAPER_STATE.attention};`);
    expect(message.html).toContain(`border-radius:1px;background-color:${PAPER_STATE.error};`);
    expect(message.html).toMatch(/>&nbsp;<\/span>&nbsp;&nbsp;Waiting on the host</);
  });

  it("closes the itemised column with a solid rule in the heading ink", () => {
    expect(message.html).toContain(`border-top:2px solid ${LIGHT.text};`);
  });

  it("has one link to the page and does not print its address again under it", () => {
    /* 4 November 2026, the founder: one clean link, no scattered addresses. */
    expect(message.html.split('href="https://vallospaces.com/bookings"').length - 1).toBe(1);
    expect(message.html).not.toMatch(/>https:\/\/vallospaces.com\/bookings<\/a>/);
  });

  it("draws no photograph for a space that has none, and initials rather than a face", () => {
    expect(sortEmailImages(message.html).photos).toEqual([]);
    expect(message.html).toContain(">AO</td>");
  });
});
