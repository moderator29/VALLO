import { describe, expect, it } from "vitest";
import { renderClient } from "@/lib/testing/render-client";

const render = (body: string) => renderClient(`import { renderToStaticMarkup } from "react-dom/server"; ${body}`);

describe("copilot UI", () => {
  it("draws the starter chips, the composer and New chat on an empty conversation", async () => {
    const html = await render(`
      import { CopilotChat } from "@/components/admin/copilot/CopilotChat";
      export const html = () => renderToStaticMarkup(<CopilotChat scope="support" deskName="Support" starters={["What needs me first today?", "Draft a reply to the oldest ticket"]} storageKey="t" />);
    `);
    expect(html).toContain("What needs me first today?");
    expect(html).toContain("Draft a reply to the oldest ticket");
    expect(html).toContain("<textarea");
    expect(html).toContain("New chat");
    expect(html).toContain('aria-live="polite"');
  });

  it("draws a proposal card with Confirm, Edit in the desk and Dismiss", async () => {
    const html = await render(`
      import { ProposalCard } from "@/components/admin/copilot/ProposalCard";
      const proposal = { id: "p1", tool: "create_my_task", label: "Add a task to my list", summary: "Adds Follow up to your My Desk tasks.", args: { title: "Follow up", priority: "normal" }, mode: "act", deskHref: "/admin/my-desk/tasks", token: "t", expiresAt: "2026-11-10T09:15:00Z" };
      export const html = () => renderToStaticMarkup(<ProposalCard state={{ proposal, status: "pending" }} onConfirm={() => {}} onDismiss={() => {}} />);
    `);
    expect(html).toContain("Add a task to my list");
    expect(html).toContain("Adds Follow up to your My Desk tasks.");
    expect(html).toContain("Confirm");
    expect(html).toContain("Edit in the desk");
    expect(html).toContain('href="/admin/my-desk/tasks"');
    expect(html).toContain("Dismiss");
  });

  it("draws a draft with Copy and no Confirm, and a done card with its outcome", async () => {
    const html = await render(`
      import { ProposalCard } from "@/components/admin/copilot/ProposalCard";
      const base = { id: "p2", tool: "draft_ticket_reply", label: "Draft reply (not sent)", summary: "A draft.", args: { text: "Hello Ada, thanks for waiting." }, deskHref: "/admin/support?ticket=1", expiresAt: "x" };
      const done = { ...base, id: "p3", mode: "act", token: "t", args: {} };
      export const html = () => renderToStaticMarkup(<div><ProposalCard state={{ proposal: { ...base, mode: "draft" }, status: "pending" }} onConfirm={() => {}} onDismiss={() => {}} /><ProposalCard state={{ proposal: done, status: "done", message: "Task added.", href: "/admin/my-desk/tasks" }} onConfirm={() => {}} onDismiss={() => {}} /></div>);
    `);
    expect(html).toContain("Copy draft");
    expect(html).toContain("Hello Ada, thanks for waiting.");
    expect(html).not.toContain(">Confirm<");
    expect(html).toContain("Task added.");
    expect(html).not.toContain('role="alert"');
  });

  it("renders markdown-lite with lists, bold, console links only, and no long dash", async () => {
    const html = await render(`
      import { CopilotMarkdown } from "@/components/admin/copilot/markdown-lite";
      const text = "**Two things** first\\n\\n- Open [the queue](/admin/support?ticket=1)\\n- Ignore [bad](https://evil.example) and <b>raw</b>\\n\\n1. One\\n2. Two \\u2014 done";
      export const html = () => renderToStaticMarkup(<CopilotMarkdown text={text} />);
    `);
    expect(html).toContain("<strong>Two things</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain('href="/admin/support?ticket=1"');
    expect(html).not.toContain("evil.example");
    expect(html).toContain("&lt;b&gt;raw&lt;/b&gt;");
    expect(html).not.toContain("—");
  });

  it("lists capabilities by desk with example prompts and the limits", async () => {
    const html = await render(`
      import { CopilotCapabilities } from "@/components/admin/copilot/CopilotCapabilities";
      import { COPILOT_CAPABILITIES } from "@/lib/admin/copilot/capabilities";
      export const html = () => renderToStaticMarkup(<CopilotCapabilities desks={COPILOT_CAPABILITIES.slice(0, 3)} />);
    `);
    expect(html).toContain("What I can do for you");
    expect(html).toContain("What I will not do");
    expect(html).toContain("I never move money");
  });
});
