import os, re, sys
root = sys.argv[1]; out = sys.argv[2]
rows = []
for dp, dn, fn in os.walk(root):
    if 'page.tsx' not in fn: continue
    rel = os.path.relpath(dp, root)
    if rel.startswith('(dev)'): continue
    route = '/' + '/'.join(p for p in rel.split(os.sep) if p != '.' and not (p.startswith('(') and p.endswith(')')))
    route = route.rstrip('/') or '/'
    group = rel.split(os.sep)[0] if rel != '.' else '(root)'
    rows.append((route, rel))
rows = sorted(set(rows))
def owner(route):
    if route.startswith('/messages') or route.startswith('/assistant') or route.startswith('/support/messages'): return 'MSG'
    if route.startswith('/admin/crashes'): return 'Lead'
    return 'FE'
def section(route):
    seg = route.split('/')[1] if route != '/' else ''
    return {'': 'Public', 'admin': 'Admin', 'agent': 'Agent workspace', 'host': 'Host workspace', 'api': 'API'}.get(seg, None) or ('Member: ' + seg)
by = {}
for r, rel in rows:
    by.setdefault(section(r), []).append((r, rel))
lines = ["# PAGE LEDGER: every page, nothing forgotten (founder, 7 November 2026)", "",
 "Generated from `apps/web/src/app/**/page.tsx` (dev previews left out): " + str(len(rows)) + " pages.",
 "Every page is passed by its owner and ticked here in the same change. A",
 "tick means seen in a production build at 390 AND 360 wide, light AND dark,",
 "on the one design system (PageFrame or StepFrame, the banner, the sheet,",
 "the button ladder, empty and loading states in shape). Regenerate with",
 "`python3 scripts/page-ledger.py apps/web/src/app docs/handoff/PAGE_LEDGER.md`",
 "only to ADD new pages; never wipe ticks.", "",
 "Columns: Frame (on PageFrame or StepFrame), Light, Dark, 360, Notes.", ""]
for sec in sorted(by):
    lines += ["## " + sec, "", "| Page | Owner | Frame | Light | Dark | 360 | Notes |", "|---|---|---|---|---|---|---|"]
    for r, rel in by[sec]:
        lines.append(f"| `{r}` | {owner(r)} |  |  |  |  |  |")
    lines.append("")
open(out, 'w').write('\n'.join(lines))
print(len(rows), len(by))
