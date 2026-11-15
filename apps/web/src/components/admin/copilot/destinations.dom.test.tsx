import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * WHAT A PERSON CAN PRESS UNDER AN ANSWER.
 *
 * A destination the tools returned is drawn as the product's own button,
 * pointing at the console page. Anything the model named of its own is drawn
 * as its words, with no anchor at all: the one thing worse than no button is
 * a button that goes nowhere or to a desk the person cannot open.
 */
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/lib/ui/feedback", () => ({ feedback: { tap() {} } }));

const { CopilotAnswer } = await import("./CopilotAnswer");

const html = (el: unknown) => renderToStaticMarkup(el as React.ReactElement);
const offered = [
  { label: "Open Listings", href: "/admin/listings" },
  { label: "Open the queue", href: "/admin/queue" },
];

describe("a destination under an answer", () => {
  it("is a real button to the console page, in the product's own button", () => {
    const out = html(
      <CopilotAnswer text={"7 listings are waiting, the oldest for 2 days.\n\n[[go:/admin/listings|Open Listings]]"} destinations={offered} />,
    );
    expect(out).toContain('href="/admin/listings"');
    expect(out).toContain("Open Listings");
    expect(out).toMatch(/class="[^"]*nf-btn/);
    expect(out).toContain('aria-label="Where to go next"');
    expect(out).not.toContain("[[go:");
  });

  it("draws one button per destination the answer offered, and nothing for the rest", () => {
    const out = html(
      <CopilotAnswer text={"Two places.\n\n[[go:/admin/listings|Open Listings]]\n[[go:/admin/queue|Open the queue]]"} destinations={offered} />,
    );
    expect(out.match(/<a /g)).toHaveLength(2);
    expect(out).toContain('href="/admin/queue"');
  });

  it("draws a destination the model invented as plain words, with no anchor", () => {
    const out = html(<CopilotAnswer text={"Try there.\n\n[[go:/admin/staff|Open the Staff desk]]"} destinations={offered} />);
    expect(out).toContain("Open the Staff desk");
    expect(out).not.toContain('href="/admin/staff"');
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("Where to go next");
  });

  it("draws nothing pressable when the tools offered nothing", () => {
    const out = html(<CopilotAnswer text={"Nothing is waiting on you today."} destinations={[]} />);
    expect(out).not.toContain("<a ");
    expect(out).toContain("Nothing is waiting on you today.");
  });

  it("keeps the words of the answer and the button apart, so there is no wall of text", () => {
    const out = html(<CopilotAnswer text={"**7 waiting**\n\n- The oldest is 2 days old\n\n[[go:/admin/listings|Open Listings]]"} destinations={offered} />);
    expect(out).toContain("<strong>7 waiting</strong>");
    expect(out).toContain("<li>");
    expect(out.indexOf("nf-copilot-go")).toBeGreaterThan(out.indexOf("<li>"));
  });

  it("still links a console path written in the prose, as a link and not a button", () => {
    const out = html(<CopilotAnswer text={"The manual is at /admin/manual."} destinations={offered} />);
    expect(out).toContain('href="/admin/manual"');
    expect(out).not.toContain("nf-copilot-go");
  });
});
