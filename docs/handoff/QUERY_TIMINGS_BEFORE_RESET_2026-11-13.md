# The query scoreboard as it stood, just before it was wiped

13 November 2026. The founder asked for `pg_stat_statements_reset()` and this
is the snapshot taken immediately before running it, so the history is written
down rather than thrown away.

## Why it was wiped

`pg_stat_statements` had been accumulating since **25 October**. The dated
stays search was split into an undated twin on **11 November**, so the slow
rows below describe code that **is no longer running**, and any average read
off them makes the search look worse than it is. Only one row in the search
table had accumulated since the split, with five calls, which is not a
measurement.

It resets counters only. No table, no row, no schema and no product data is
touched, and the counters begin refilling on the next query.

## The stays search, by statement, before the wipe

PostgreSQL 17 keeps `stats_since` per statement, which is what makes the
problem legible: the slow rows all predate the 11 November split.

| calls | mean | max | sd | counting since | reading |
|---|---|---|---|---|---|
| 590 | 352 ms | 2,823 ms | 459 | 25 Oct 14:56 | before the split |
| 426 | 303 ms | 2,169 ms | 244 | 6 Nov 16:34 | before the split |
| 153 | 305 ms | 2,907 ms | 386 | 28 Oct 09:19 | before the split |
| 109 | 1,215 ms | 7,862 ms | 1,498 | 26 Oct 08:25 | before the split |
| 85 | 1,533 ms | 7,897 ms | 1,947 | 27 Oct 20:23 | before the split |
| 5 | 911 ms | 1,180 ms | 304 | 11 Nov 16:00 | after the split, too few calls |

The two worst rows are the reason the ten `57014` "Catalogue: read failed"
alerts between 17 October and 9 November were real rather than noise: `anon`
carries a 3 second `statement_timeout` (`authenticated` has 8), and a search
averaging 1.5 seconds with a 1.9 second standard deviation crosses 3 seconds
often.

Measured directly on 13 November with `explain (analyze, buffers)` as the
`anon` role, after the split: **`stays_search` 96 ms, `stays_search_undated`
37 ms, `stays_search_public` 44 ms.** So the condition that raised those
alerts is gone, and the table above is the record of a problem that was
fixed, not a problem that is open.

## The fifteen heaviest statements overall, by total time

Shortened to the first line each. These are the platform's own machinery, not
member queries.

| calls | mean | max | total | since | statement |
|---|---|---|---|---|---|
| 293,001 | 13.0 ms | 17,803 ms | 3,805 s | 25 Oct | Realtime WAL decoding (`wal->>...`) |
| 78,901 | 10.9 ms | 74,612 ms | 864 s | 25 Oct | `cron.job_run_details` insert |
| 2,246 | 368.5 ms | 7,508 ms | 828 s | 25 Oct | `public.shell_context()` through PostgREST |
| 27,057 | 26.8 ms | 25,084 ms | 724 s | 25 Oct | `private.hold_claims_sweep()` |
| 17,484 | 39.7 ms | 4,101 ms | 693 s | 25 Oct | a PostgREST call with a `p_st...` argument |
| 448 | 1,509.4 ms | 4,779 ms | 676 s | 25 Oct | a PostgREST scalar call |
| 5,406 | 96.5 ms | 27,220 ms | 522 s | 25 Oct | `private.request_push_drain()` |
| 10,475 | 46.7 ms | 7,580 ms | 489 s | 25 Oct | a PostgREST scalar call |
| 27,057 | 18.0 ms | 12,380 ms | 487 s | 25 Oct | `private.calls_sweep()` |
| 14,805 | 27.2 ms | 2,106 ms | 403 s | 29 Oct | a `listings` select |
| 1,702 | 232.9 ms | 5,708 ms | 396 s | 30 Oct | a `listings` select |
| 2,179 | 180.9 ms | 6,857 ms | 394 s | 9 Nov | a PostgREST scalar call |
| 34,865 | 11.2 ms | 5,630 ms | 389 s | 25 Oct | a PostgREST scalar call |
| 191,982 | 1.9 ms | 2,662 ms | 363 s | 25 Oct | PostgREST `set_config` preamble |
| 40,582 | 8.4 ms | 2,676 ms | 342 s | 25 Oct | a `listing_lister` select |

### Two things in that table worth a second look, neither chased here

**The maximums are wild and the means are not.** A `cron.job_run_details`
insert averaging 11 ms with a maximum of **74.6 seconds**, and Realtime WAL
decoding averaging 13 ms with a maximum of **17.8 seconds**, are the signature
of occasional severe contention rather than slow statements. A single insert
does not take 74 seconds because it is complicated.

**`hold_claims_sweep` and `calls_sweep` have run 27,057 times each**, which is
every minute for the whole window, and together account for about 1,200
seconds. That is the cost of the schedule, not of a defect, but it is worth
knowing before anybody adds another minute-by-minute sweep.

## What to do with the fresh counters

Leave them a day of real traffic, then read the search again:

```sql
select calls,
       round(mean_exec_time::numeric, 1) as mean_ms,
       round(max_exec_time::numeric, 1) as max_ms,
       round(stddev_exec_time::numeric, 1) as sd_ms,
       stats_since
from pg_stat_statements
where query ilike '%stays_search%'
order by calls desc;
```

The number that matters is the standard deviation against the 3 second `anon`
timeout, not the mean. A mean of 100 ms with a standard deviation of 1.5
seconds still times out for somebody.

The forward risk, measured but not proved, is in
`docs/handoff/AGENT_QUEUES.md`: the search costs 5,965 shared buffer hits to
return 5 rows from a 72 entry catalogue, so the work scales with the
catalogue and not with the page. That is the measurement to take once these
counters have a day on them.
