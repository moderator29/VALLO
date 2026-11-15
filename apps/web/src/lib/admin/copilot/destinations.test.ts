import { describe, expect, it } from "vitest";
import { isConsolePath, MAX_DESTINATIONS, splitDestinations } from "./destinations";

/**
 * THE DESTINATION SYNTAX, AND THE ONE RULE THAT MATTERS: only an address a
 * tool returned this turn becomes a button. Anything the model writes of its
 * own is drawn as plain words, so there is never a link to a desk this person
 * cannot open and never something pressable that goes nowhere.
 */

const allowed = [
  { label: "Open Listings", href: "/admin/listings" },
  { label: "Open Support", href: "/admin/support?ticket=7" },
];

describe("a console path", () => {
  it("is an /admin path and nothing else", () => {
    expect(isConsolePath("/admin")).toBe(true);
    expect(isConsolePath("/admin/listings")).toBe(true);
    expect(isConsolePath("/admin/support?ticket=7")).toBe(true);
    expect(isConsolePath("/admin/manual/queues#tickets")).toBe(true);
  });

  it("is never a host, a scheme, a traversal or another part of the site", () => {
    for (const bad of ["https://evil.example/admin", "//evil.example", "/admin/../settings", "/settings/help", "/adminx", "admin/listings", `/admin/${"x".repeat(400)}`]) {
      expect(isConsolePath(bad), bad).toBe(false);
    }
  });
});

describe("the answer's destinations", () => {
  it("turns a marker whose address a tool returned into a destination, and takes it out of the words", () => {
    const { prose, destinations } = splitDestinations("3 listings are waiting.\n\n[[go:/admin/listings|Open Listings]]", allowed);
    expect(destinations).toEqual([{ label: "Open Listings", href: "/admin/listings" }]);
    expect(prose).toBe("3 listings are waiting.");
    expect(prose).not.toContain("[[go:");
  });

  it("keeps the words of a marker the model invented and offers no destination", () => {
    const { prose, destinations } = splitDestinations("Try the staff desk.\n\n[[go:/admin/staff|Open the Staff desk]]", allowed);
    expect(destinations).toEqual([]);
    expect(prose).toContain("Open the Staff desk");
    expect(prose).not.toContain("[[go:");
    expect(prose).not.toContain("/admin/staff");
  });

  it("refuses an address that is not a console path even when it is on the allowed list", () => {
    const { destinations } = splitDestinations("[[go:https://evil.example|Open it]]", [{ label: "Open it", href: "https://evil.example" }]);
    expect(destinations).toEqual([]);
  });

  it("uses the words the tool gave, not the words the model wrote", () => {
    const { destinations } = splitDestinations("[[go:/admin/listings|Click here now]]", allowed);
    expect(destinations[0]!.label).toBe("Open Listings");
  });

  it("offers one button per address and no more than the cap", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `Desk ${i}`, href: `/admin/d${i}` }));
    const text = [...many, many[0]!].map((d) => `[[go:${d.href}|${d.label}]]`).join("\n");
    const { destinations } = splitDestinations(text, many);
    expect(destinations).toHaveLength(MAX_DESTINATIONS);
    expect(new Set(destinations.map((d) => d.href)).size).toBe(MAX_DESTINATIONS);
  });

  it("hides a marker that is only half written, so a stream never shows the syntax", () => {
    for (const partial of ["Reading on. [[", "Reading on. [[go", "Reading on. [[go:", "Reading on. [[go:/admin/list"]) {
      expect(splitDestinations(partial, allowed).prose).toBe("Reading on.");
    }
  });

  it("leaves an answer with no markers exactly as it was", () => {
    const text = "Nothing is waiting on you today.";
    expect(splitDestinations(text, allowed)).toEqual({ prose: text, destinations: [] });
  });

  it("offers nothing when the tools returned nothing, whatever the model writes", () => {
    const { prose, destinations } = splitDestinations("[[go:/admin/listings|Open Listings]]", []);
    expect(destinations).toEqual([]);
    expect(prose).toBe("Open Listings");
  });
});
