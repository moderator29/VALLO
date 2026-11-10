import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstitutionLogo, logoToShow, usableLogoUrl } from "./InstitutionLogo";

const URL_OK = "https://upload.wikimedia.org/wikipedia/en/e/ea/Example_logo.png";

describe("InstitutionLogo fallback logic", () => {
  it("draws the logo only for an https address", () => {
    expect(usableLogoUrl(URL_OK)).toBe(URL_OK);
    expect(usableLogoUrl(null)).toBeNull();
    expect(usableLogoUrl(undefined)).toBeNull();
    expect(usableLogoUrl("")).toBeNull();
    expect(usableLogoUrl("http://example.edu.ng/logo.png")).toBeNull();
    expect(usableLogoUrl("javascript:alert(1)")).toBeNull();
  });

  it("falls back when the address is missing", () => {
    expect(logoToShow(null, null)).toBeNull();
  });

  it("falls back once that very address has failed, and not for a different one", () => {
    expect(logoToShow(URL_OK, null)).toBe(URL_OK);
    expect(logoToShow(URL_OK, URL_OK)).toBeNull();
    expect(logoToShow(URL_OK, "https://upload.wikimedia.org/other.png")).toBe(URL_OK);
  });
});

describe("InstitutionLogo markup", () => {
  it("renders the school icon plate with no image when there is no logo", () => {
    const html = renderToStaticMarkup(<InstitutionLogo name="Test University" logoUrl={null} />);
    expect(html).toContain("nf-rm-plate");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<img");
  });

  it("renders a decorative, lazy, contained image when there is a logo", () => {
    const html = renderToStaticMarkup(<InstitutionLogo name="Test University" logoUrl={URL_OK} size={32} />);
    expect(html).toContain("<img");
    expect(html).toContain('alt=""');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain(`src="${URL_OK}"`);
    expect(html).toContain("nf-rm-logo__img");
    expect(html).not.toContain("nf-rm-plate");
  });
});
