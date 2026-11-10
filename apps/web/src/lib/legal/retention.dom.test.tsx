import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetentionTable } from "@/components/legal/RetentionTable";
import { PRIVACY_SECTIONS } from "./privacy";
import { RETENTION_SCHEDULE, RETENTION_STATUS } from "./retention";

/** The founder's schedule of 10 November 2026, pending counsel. */
describe("the retention schedule", () => {
  const byId = Object.fromEntries(RETENTION_SCHEDULE.map((row) => [row.id, row.period]));

  it("holds the founder's periods", () => {
    expect(byId.financial).toMatch(/^6 years/);
    expect(byId.identity).toMatch(/^5 years/);
    expect(byId.agreements).toMatch(/^6 years/);
    expect(byId.messages).toMatch(/^24 months/);
    expect(byId.support).toMatch(/^3 years/);
    expect(byId.security).toMatch(/12 months/);
    expect(byId.analytics).toMatch(/14 months/);
    expect(byId.marketing).toMatch(/3 years/);
    expect(byId.backups).toMatch(/35 days/);
    expect(byId.profile).toMatch(/30-day/);
  });

  it("is drawn on the Privacy page from this one list, marked as pending review", () => {
    const html = renderToStaticMarkup(<RetentionTable />);
    for (const row of RETENTION_SCHEDULE) {
      expect(html).toContain(row.what);
      expect(html).toContain(row.period.replace(/'/g, "&#x27;"));
    }
    expect(html).toContain("may change");
    expect(RETENTION_STATUS).toMatch(/reviewed by our legal advisers/);
    expect(PRIVACY_SECTIONS.find((s) => s.id === "retention")).toBeTruthy();
  });

  it("uses no em dash", () => {
    for (const row of RETENTION_SCHEDULE) expect(JSON.stringify(row)).not.toMatch(/—/);
  });
});
