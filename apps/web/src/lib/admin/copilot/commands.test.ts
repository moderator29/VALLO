import { describe, expect, it } from "vitest";
import { COPILOT_COMMANDS, commandKeyFor, commandsFor, matchCommands } from "./commands";
import { followUpsFor } from "./follow-ups";

describe("the copilot's quick commands", () => {
  it("lists only the commands a person's own desks open", () => {
    const support = commandsFor({ isAdmin: false, isSuperAdmin: false, scopes: ["support"] }).map((c) => c.key);
    expect(support).toContain("tickets");
    expect(support).toContain("today");
    expect(support).not.toContain("alerts");
    expect(support).not.toContain("sql");
    const boss = commandsFor({ isAdmin: true, isSuperAdmin: true, scopes: [] }).map((c) => c.key);
    expect(boss).toEqual(expect.arrayContaining(["tickets", "alerts", "sql", "access"]));
    const admin = commandsFor({ isAdmin: true, isSuperAdmin: false, scopes: [] }).map((c) => c.key);
    expect(admin).not.toContain("sql");
  });

  it("matches as you type, key first, and is quiet when the composer is not a command", () => {
    expect(matchCommands("/", COPILOT_COMMANDS)).toHaveLength(COPILOT_COMMANDS.length);
    expect(matchCommands("/ti", COPILOT_COMMANDS)?.[0]?.key).toBe("tickets");
    expect(matchCommands("/tick", COPILOT_COMMANDS)?.[0]?.key).toBe("tickets");
    expect(matchCommands("what needs me", COPILOT_COMMANDS)).toBeNull();
    expect(matchCommands("/today please", COPILOT_COMMANDS)).toBeNull();
  });

  it("every command does exactly one thing and has a unique key", () => {
    const keys = COPILOT_COMMANDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of COPILOT_COMMANDS) expect([c.prompt, c.template, c.action].filter(Boolean), c.key).toHaveLength(1);
  });
});

describe("what to ask next", () => {
  it("follows what the answer read, newest first, and fills with general questions", () => {
    expect(followUpsFor(["get_support_queue"])).toEqual(["Reply to the oldest ticket", "Which tickets are past the promised time?", "What should I do next?"]);
    expect(followUpsFor([])).toHaveLength(3);
    expect(new Set(followUpsFor(["get_support_queue", "get_support_ticket"])).size).toBe(3);
  });
});

describe("your own commands", () => {
  it("names a saved question by its first words, never one already taken", () => {
    expect(commandKeyFor("Which tickets are late today?", [])).toBe("whichtickets");
    expect(commandKeyFor("Which tickets are late today?", ["whichtickets"])).toBe("whichtickets2");
    expect(commandKeyFor("?? !!", [])).toBe("mine");
    expect(commandKeyFor("Today please", COPILOT_COMMANDS.map((c) => c.key))).toBe("todayplease");
  });
});
