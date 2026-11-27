#!/usr/bin/env python3
"""Cut the single-file seed into six pastes that run in order.

168 KB does not fit in a chat message. Each part is its own transaction; the
later ones refuse to start out of order, and the last one counts everything.
"""
import io, os

SRC = "/home/user/VALLO/supabase/drafts/example_catalogue_2026-11-26.sql"
OUT = "/home/user/VALLO/supabase/drafts/example_catalogue_parts"
lines = io.open(SRC, encoding="utf-8").read().split("\n")

start = next(i for i, l in enumerate(lines) if l.startswith("insert into public.vallo_example_photo"))
end = next(i for i, l in enumerate(lines) if l.strip() == "on conflict (key) do nothing;")
rows, cur = [], []
for l in lines[start + 2:end]:
    cur.append(l)
    if l.rstrip().endswith("),") or l.rstrip().endswith(")"):
        rows.append("\n".join(cur)); cur = []
half = len(rows) // 2
HEAD = lines[start] + "\n" + lines[start + 1]
def insert(chunk):
    return HEAD + "\n" + "\n".join(chunk).rstrip().rstrip(",") + "\non conflict (key) do nothing;"

photos_a = "\n".join(lines[255:start]) + "\n" + insert(rows[:half])
photos_b = ("/* ---------------------- 2c. the photographs, the second half */\n\n"
            + insert(rows[half:]))

# (label, body, needs the photograph table to exist already)
PARTS = [
  ("the account, the credits table and the one check", "\n".join(lines[136:255]), False),
  (f"the first {half} photographs", photos_a, False),
  (f"the last {len(rows) - half} photographs, the policies and the forty tenancies",
   photos_b + "\n\n" + "\n".join(lines[560:881]), True),
  ("the shortlets, the amenities and the listing photographs", "\n".join(lines[881:1388]), True),
  ("the stays, the rooms and the rates", "\n".join(lines[1388:1787]), True),
  ("the restaurants, the credits and the self-check", "\n".join(lines[1787:]), True),
]

ACCOUNT_GUARD = """  if not exists (select 1 from public.agents where id = 'e0000000-0000-4000-8000-000000000003') then
    raise exception 'Run part 1 first: the examples account is not there yet.';
  end if;"""
PHOTO_GUARD = """  if not exists (select 1 from pg_tables
                  where schemaname = 'public' and tablename = 'vallo_example_photo') then
    raise exception 'Run the parts in order. Part 2 creates the photograph table and part 6 drops it.';
  end if;"""

os.makedirs(OUT, exist_ok=True)
n_parts = len(PARTS)
for n, (label, body, needs_photos) in enumerate(PARTS, start=1):
    head = (f"-- THE EXAMPLE CATALOGUE, PART {n} OF {n_parts}: {label}.\n"
            f"--\n"
            f"-- supabase/drafts/example_catalogue_2026-11-26.sql cut into {n_parts} pastes,\n"
            f"-- because 168 KB does not fit in a message. RUN THEM IN ORDER, one at a\n"
            f"-- time, each on its own. Every part is a transaction, so a part either\n"
            f"-- happens or it does not; parts 2 to {n_parts} refuse to start out of order; and\n"
            f"-- part {n_parts} counts everything and fails the paste if a number is wrong.\n"
            f"-- Running a part twice changes nothing.\n"
            f"--\n"
            f"-- Why each thing in here is the way it is: the header of the single-file\n"
            f"-- version in the repository.\n\nbegin;\n")
    checks = ([ACCOUNT_GUARD] if n > 1 else []) + ([PHOTO_GUARD] if needs_photos else [])
    if checks:
        head += "\ndo $part$\nbegin\n" + "\n".join(checks) + "\nend\n$part$;\n"
    path = os.path.join(OUT, f"part{n}.sql")
    io.open(path, "w", encoding="utf-8").write(head + "\n" + body.strip("\n") + "\n\ncommit;\n")
    size = os.path.getsize(path)
    print(f"part{n}.sql  {size//1024:3d} KB  {label}")
