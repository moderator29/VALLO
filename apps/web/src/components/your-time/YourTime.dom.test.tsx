import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { YourTime } from "./YourTime";

const copy = getDictionary("en").experienceSettings.yourTime;

describe("<YourTime>", () => {
  it("writes the reader's clock after the Lagos time, muted", () => {
    const html = renderToStaticMarkup(<YourTime at="2026-11-13T09:00:00Z" locale="en" copy={copy} zone="Europe/London" />);
    expect(html).toContain("09:00 your time");
    expect(html).toContain('data-your-time="Europe/London"');
  });

  it("names the day when it differs", () => {
    const html = renderToStaticMarkup(<YourTime at="2026-11-13T20:30:00Z" locale="en" copy={copy} zone="Asia/Dubai" />);
    expect(html).toContain("Sat 00:30 your time");
  });

  it("draws nothing on the server, where the device's zone is unknown, or when the clocks agree", () => {
    expect(renderToStaticMarkup(<YourTime at="2026-11-13T09:00:00Z" locale="en" copy={copy} />)).toBe("");
    expect(renderToStaticMarkup(<YourTime at="2026-11-13T09:00:00Z" locale="en" copy={copy} zone="Africa/Lagos" />)).toBe("");
  });
});
