"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Logo } from "@/design-system/brand/Logo";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Fab } from "@/components/ui/Fab";
import { Toggle } from "@/components/ui/Switch";
import { Tag } from "@/components/ui/Tag";
import { DropdownButton } from "@/components/ui/DropdownButton";
import { Quantity } from "@/components/ui/Quantity";
import { Checkbox, Radio } from "@/components/ui/Check";
import { Segmented } from "@/components/ui/Segmented";
import { ActionTile } from "@/components/ui/ActionTile";
import { LinkButton } from "@/components/ui/LinkButton";

/**
 * The button system, every kind and every state, in paper and night side by
 * side (founder reference 55; CLEAN_UNIFIED_DIRECTION.md section 19). Real
 * primitives only. Hover and pressed samples carry `data-force`, which the
 * screenshot harness turns into a forced `:hover` or `:active`; live, they
 * answer the pointer like any other button. Open it with the light theme
 * chosen: the right-hand panel is a night island, so both themes show at once.
 */

const PALETTE: { name: string; token: string }[] = [
  { name: "Brand Blue", token: "--nf-act-blue" },
  { name: "Cyan", token: "--nf-act-cyan" },
  { name: "Orange (spark)", token: "--nf-spark" },
  { name: "Gray", token: "--nf-act-disabled-ink" },
  { name: "Text", token: "--nf-act-surface-ink" },
];

function States({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-md">{children}</div>;
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-xs">
      {children}
      <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{label}</span>
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-sm lg:grid-cols-2">
      <div className="rounded-card border border-[var(--nf-card-border)] bg-[var(--nf-surface-primary)] p-md">
        {children}
      </div>
      <div
        data-theme="dark"
        className="rounded-card border border-[var(--nf-card-border)] bg-[var(--nf-surface-elevated)] p-md"
      >
        {children}
      </div>
    </div>
  );
}

function Kind({ n, title, use, children }: { n: number; title: string; use: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-sm" data-testid={`kind-${n}`}>
      <div>
        <h2 className="text-[length:var(--nf-text-h4)] font-semibold text-[var(--nf-content-primary)]">
          {n}. {title}
        </h2>
        <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{use}</p>
      </div>
      <Pair>{children}</Pair>
    </section>
  );
}

function ToggleDemo({ initial, disabled, label }: { initial: boolean; disabled?: boolean; label: string }) {
  const [on, setOn] = useState(initial);
  return <Toggle checked={on} onCheckedChange={setOn} disabled={disabled} aria-label={label} />;
}

function QuantityDemo({ disabled, force }: { disabled?: boolean; force?: string }) {
  const [n, setN] = useState(1);
  return (
    <div data-force-child={force}>
      <Quantity
        value={n}
        onChange={setN}
        min={0}
        max={9}
        label="Guests"
        decreaseLabel="Fewer guests"
        increaseLabel="More guests"
        disabled={disabled}
      />
    </div>
  );
}

function SegmentedDemo() {
  const [v, setV] = useState<"buy" | "rent" | "pay">("buy");
  const [w, setW] = useState<"home" | "calendar" | "search">("home");
  return (
    <div className="flex flex-wrap items-center gap-md">
      <Segmented
        label="Mode"
        value={v}
        onChange={setV}
        options={[
          { value: "buy", label: "Buy" },
          { value: "rent", label: "Rent" },
          { value: "pay", label: "Pay" },
        ]}
      />
      <Segmented
        label="View"
        iconOnly
        value={w}
        onChange={setW}
        options={[
          { value: "home", label: "Home", icon: "home" },
          { value: "calendar", label: "Calendar", icon: "calendar-booking" },
          { value: "search", label: "Search", icon: "search" },
        ]}
      />
    </div>
  );
}

export default function ButtonSystemPreview() {
  return (
    <main className="nf-shell flex flex-col gap-xl py-lg" data-testid="button-system">
      <header className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex items-center gap-md">
          <Logo size={36} wordSize={20} />
          <div>
            <h1 className="text-[length:var(--nf-text-h2)] font-semibold text-[var(--nf-content-primary)]">
              Button styles and usage
            </h1>
            <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
              Sixteen kinds, every state, paper on the left and night on the right.
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-md" aria-label="Palette">
          {PALETTE.map((p) => (
            <li key={p.token} className="flex flex-col items-center gap-2xs">
              <span
                className="block size-8 rounded-circle border border-[var(--nf-card-border)]"
                style={{ background: `var(${p.token})` }}
              />
              <span className="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-primary)]">{p.name}</span>
              <span className="text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">{p.token}</span>
            </li>
          ))}
        </ul>
      </header>

      <Kind n={1} title="Primary" use="The main action, one per view: Save, Continue, Book, Submit.">
        <States>
          <Cell label="Default"><Button variant="primary" arrow>Continue</Button></Cell>
          <Cell label="Hover"><Button variant="primary" arrow data-force="hover">Continue</Button></Cell>
          <Cell label="Pressed"><Button variant="primary" arrow data-force="active">Continue</Button></Cell>
          <Cell label="Disabled"><Button variant="primary" arrow disabled>Continue</Button></Cell>
          <Cell label="Loading"><Button variant="primary" loading>Saving</Button></Cell>
        </States>
      </Kind>

      <Kind n={2} title="Secondary" use="The alternative beside the primary: Cancel, View details.">
        <States>
          <Cell label="Default"><Button variant="secondary" arrow>View details</Button></Cell>
          <Cell label="Hover"><Button variant="secondary" arrow data-force="hover">View details</Button></Cell>
          <Cell label="Pressed"><Button variant="secondary" arrow data-force="active">View details</Button></Cell>
          <Cell label="Disabled"><Button variant="secondary" arrow disabled>View details</Button></Cell>
        </States>
      </Kind>

      <Kind n={3} title="Tertiary" use="Less emphasis, no box until the pointer arrives: Learn more, Skip.">
        <States>
          <Cell label="Default"><Button variant="quiet" arrow>Learn more</Button></Cell>
          <Cell label="Hover"><Button variant="quiet" arrow data-force="hover">Learn more</Button></Cell>
          <Cell label="Pressed"><Button variant="quiet" arrow data-force="active">Learn more</Button></Cell>
          <Cell label="Disabled"><Button variant="quiet" arrow disabled>Learn more</Button></Cell>
        </States>
      </Kind>

      <Kind n={4} title="Icon buttons" use="Compact actions: search, filter, share. Always named for a screen reader.">
        <div className="flex flex-col gap-sm">
          {(["search", "sliders", "share"] as const).map((icon) => (
            <States key={icon}>
              <Cell label="Default"><Button variant="icon" iconOnly leadingIcon={icon} aria-label={icon} /></Cell>
              <Cell label="Hover"><Button variant="icon" iconOnly leadingIcon={icon} aria-label={icon} data-force="hover" /></Cell>
              <Cell label="Pressed"><Button variant="icon" iconOnly leadingIcon={icon} aria-label={icon} data-force="active" /></Cell>
              <Cell label="Disabled"><Button variant="icon" iconOnly leadingIcon={icon} aria-label={icon} disabled /></Cell>
            </States>
          ))}
        </div>
      </Kind>

      <Kind n={5} title="Floating action button" use="The one primary action of a focused context: add a listing on the desk.">
        <States>
          <Cell label="Default"><Fab aria-label="Add" /></Cell>
          <Cell label="Hover"><Fab aria-label="Add" data-force="hover" /></Cell>
          <Cell label="Pressed"><Fab aria-label="Add" data-force="active" /></Cell>
          <Cell label="Disabled"><Fab aria-label="Add" disabled /></Cell>
        </States>
      </Kind>

      <Kind n={6} title="Toggle" use="On and off: a filter, a notification.">
        <States>
          <Cell label="Off"><ToggleDemo initial={false} label="Example off" /></Cell>
          <Cell label="On"><ToggleDemo initial label="Example on" /></Cell>
          <Cell label="Disabled off"><ToggleDemo initial={false} disabled label="Example disabled" /></Cell>
          <Cell label="Disabled on"><ToggleDemo initial disabled label="Example disabled on" /></Cell>
        </States>
      </Kind>

      <Kind n={7} title="Chip and tag" use="A label on a card: what a thing is. Not a control.">
        <States>
          <Cell label="Brand"><Tag icon="verified">Verified</Tag></Cell>
          <Cell label="Spark"><Tag tone="spark" icon="star">Featured</Tag></Cell>
          <Cell label="Success"><Tag tone="success" icon="circle-check">Available</Tag></Cell>
          <Cell label="Neutral"><Tag tone="neutral" icon="info">Example</Tag></Cell>
        </States>
      </Kind>

      <Kind n={8} title="Dropdown" use="Selection and sorting: opens a list the page owns.">
        <States>
          <Cell label="Default"><DropdownButton>Sort by</DropdownButton></Cell>
          <Cell label="Hover"><DropdownButton data-force="hover">Sort by</DropdownButton></Cell>
          <Cell label="Open"><DropdownButton expanded>Sort by</DropdownButton></Cell>
          <Cell label="Disabled"><DropdownButton disabled>Sort by</DropdownButton></Cell>
        </States>
      </Kind>

      <Kind n={9} title="Quantity" use="Increase and decrease a count: guests, rooms, nights.">
        <States>
          <Cell label="Default"><QuantityDemo /></Cell>
          <Cell label="Hover on plus"><QuantityDemo force="hover" /></Cell>
          <Cell label="Disabled"><QuantityDemo disabled /></Cell>
        </States>
      </Kind>

      <Kind n={10} title="Checkbox" use="Several choices at once: terms, preferences.">
        <div className="flex flex-col">
          <Checkbox>Remember me</Checkbox>
          <Checkbox defaultChecked>Remember me</Checkbox>
          <Checkbox disabled>Remember me</Checkbox>
          <Checkbox disabled defaultChecked>Remember me</Checkbox>
        </div>
      </Kind>

      <Kind n={11} title="Radio" use="One choice from a few: payment method.">
        <div className="flex flex-col">
          <Radio name="pay-example" defaultChecked>Bank transfer</Radio>
          <Radio name="pay-example">Card</Radio>
          <Radio name="pay-example-off" disabled>Bank transfer</Radio>
          <Radio name="pay-example-off" disabled defaultChecked>Card</Radio>
        </div>
      </Kind>

      <Kind n={12} title="Segmented control" use="Switch between options: Buy, Rent, Pay. Words or icons.">
        <SegmentedDemo />
      </Kind>

      <Kind n={13} title="Add and create" use="Adding things: add a property, a room, a workspace.">
        <States>
          <Cell label="Filled"><Button variant="primary" leadingIcon="plus">Add property</Button></Cell>
          <Cell label="Outline"><Button variant="secondary" leadingIcon="plus">Add property</Button></Cell>
          <Cell label="Text"><Button variant="quiet" leadingIcon="plus">Add property</Button></Cell>
        </States>
      </Kind>

      <Kind n={14} title="Back and navigation" use="Going back, and the steps of a flow.">
        <States>
          <Cell label="Icon"><Button variant="icon" iconOnly leadingIcon="arrow-left" aria-label="Back" /></Cell>
          <Cell label="Text"><Button variant="quiet" leadingIcon="arrow-left">Back</Button></Cell>
          <Cell label="Outline"><Button variant="secondary" leadingIcon="arrow-left">Back</Button></Cell>
          <Cell label="Next"><Button variant="primary" arrow>Next</Button></Cell>
        </States>
      </Kind>

      <Kind n={15} title="Action tiles" use="Direct actions on a thing: call, share, download, delete.">
        <States>
          <ActionTile icon="phone" label="Call" onClick={() => undefined} />
          <ActionTile icon="share" label="Share" onClick={() => undefined} />
          <ActionTile icon="arrow-down" label="Download" tone="success" onClick={() => undefined} />
          <ActionTile icon="trash" label="Delete" tone="danger" onClick={() => undefined} />
          <ActionTile icon="share" label="Disabled" disabled onClick={() => undefined} />
        </States>
      </Kind>

      <Kind n={16} title="Link buttons" use="Inline ways on: view all, learn more.">
        <States>
          <Cell label="Default"><LinkButton href="#">View all</LinkButton></Cell>
          <Cell label="Hover"><LinkButton href="#" data-force="hover">Learn more</LinkButton></Cell>
          <Cell label="As a button link"><ButtonLink href="#" variant="secondary" size="sm" arrow>See all</ButtonLink></Cell>
        </States>
      </Kind>

      <footer className="flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
        <UiIcon name="info" size={16} />
        Primary for the main action, secondary for its alternative, tertiary for less emphasis, icon buttons for compact spaces, the FAB for one key action.
      </footer>
    </main>
  );
}
