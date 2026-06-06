# Pitfalls Research

**Domain:** hh.ru RSS Scanner feed diversity (01e coverage improvement)
**Researched:** 2026-06-07
**Confidence:** MEDIUM (hh.ru rate limits sourced from community parsing guides and proxy vendor research — no official hh.ru RSS documentation exists; n8n timeout/research confirmed via official docs)

## Critical Pitfalls

### Pitfall 1: hh.ru IP Blocking from Too Many Vacancy Page Fetches

**What goes wrong:**
Adding more RSS feeds means more unique vacancies per run, which means more vacancy HTML page fetches (each RSS item's `link` URL is fetched via HTTP). hh.ru's anti-bot detection triggers on the per-vacancy HTML fetches, not the RSS feed endpoint itself. The server IP gets blocked for 1–24 hours, causing ALL hh.ru discovery to stop — both RSS feed reads and vacancy page fetches fail until the ban expires.

**Why it happens:**
- hh.ru uses Cloudflare Bot Management, TLS fingerprinting, and behavioral analysis (2026 research confirms JA3/JA3S fingerprinting, CAPTCHA on suspicious patterns)
- RSS endpoints (`/search/vacancy/rss`) are syndication endpoints with lighter protection, but the individual vacancy URLs (`https://hh.ru/vacancy/{id}`) fetched from RSS items go through full HTML scraping protection
- Sources report hh.ru blocks IPs after 80–120 requests per hour to the HTML pages (proxycove.com, 2026) — after that, HTTP 429 or CAPTCHA for 1–6 hours
- Current 1s delay between vacancy fetches is too aggressive: recommended delay for hh.ru HTML pages is 4–8 seconds with random jitter (proxycove.com)
- More feeds → more vacancies → more fetches → higher probability of hitting the per-hour limit
- n8n HTTP Request node has a fixed `User-Agent` string (`Mozilla/5.0 (compatible; JobSignalEngine/2.0; ...)`) — this is unique and trackable; hh.ru can correlate all requests to a single bot identity regardless of IP

**How to avoid:**
- Increase vacancy fetch delay from 1s to 3–5s minimum (random jitter between 3–8s recommended)
- Track per-run fetch count; if approaching ~80 vacancy fetches, stop fetching and use RSS fallback for remaining jobs
- Consider rotating `User-Agent` headers across a pool of real browser UAs — but note TLS fingerprinting will still identify Python/Node HTTP libs
- Most important: **do NOT parallelize vacancy fetches** — n8n's `batchSize: 1` in Loop Over Jobs is correct; keep it serial
- Add a response status monitor: if `Fetch Vacancy Page` starts returning 429 or CAPTCHA pages, switch to RSS-only mode for the remainder of the run
- If IP blocks are recurrent, route hh.ru traffic through a residential HTTP proxy (this adds cost and complexity — defer unless blocking becomes a real problem)

**Warning signs:**
- `Fetch Vacancy Page` starts returning 403/429 status codes after ~N successful fetches (count them per run)
- Response body contains CAPTCHA HTML or Cloudflare challenge page (check `_fetchStatus` in diagnostics)
- Vacancy page fetch time increases progressively (server-side throttling before explicit block)
- Multiple consecutive `Fetch Vacancy Page` timeouts (10s timeout hit)
- RSS feed reads still succeed but vacancy page fetches fail — confirms the block is on HTML pages, not RSS

**Phase to address:**
Feed diversity phase (HH-13) — must add delay randomization and fetch-count monitoring before increasing feed count. If blocking occurs, create a follow-up phase for proxy integration.

---

### Pitfall 2: Safety Brake False-Positives with Higher Feed Volume

**What goes wrong:**
The existing safety brake in `Deduplicate vs Pipeline` throws `Error: Safety brake: N net-new jobs exceeds 100 limit`, aborting the entire run. Adding more feeds or query variations directly increases raw vacancy volume. The scanner produces zero new Pipeline records on days when the brake fires, even though dozens of legitimately new jobs were discovered.

**Why it happens:**
- Each hh.ru RSS feed returns ~20 items. Current config: up to 8 Profile auto-feeds + manual Search Queries = ~10–15 feeds → ~200–300 raw items
- After deduplication against existing Pipeline, net-new is typically lower, but with diverse queries each feed may return unique results
- Adding sub-areas (Moscow + SPb + Russia), skill variations, and role synonyms could 3–5x the feed count to 30–50 feeds → 600–1000 raw items
- Net-new could easily exceed 100 even with legitimate, non-duplicate vacancies
- The 100 cap was designed for the other scanners (1a–1d) which see lower volumes; hh.ru RSS is inherently higher-volume because it's a general job board, not a tracked-company ATS

**How to avoid:**
- Increase the cap to 300–500 net-new for hh.ru specifically
- OR refactor: change the safety brake from a hard throw to a warning + truncation (take top 200 net-new, log the overflow count)
- OR implement per-feed quotas (max N per feed, sum total) to distribute coverage
- Document that the cap should be tuned based on observed daily volume during HH-14 verification
- The cap must remain as an explicit safeguard against misconfigured queries (e.g., blank `text=` returning all vacancies) — but it should be a configurable parameter, not a constant

**Warning signs:**
- n8n execution errors with "Safety brake: N net-new jobs exceeds 100 limit"
- The error message includes the actual count — trend it: if it's consistently 100–200, bump the cap; if it spikes to 2000+, investigate query config
- High overlap ratio: if (raw items − net-new) / raw items > 70%, many feeds return already-seen jobs (normal for hh.ru's ~20 item cap)
- Low overlap ratio but still exceeds cap: genuine high volume day — need higher cap

**Phase to address:**
HH-13 (feed diversity implementation) — must adjust safety brake threshold before or concurrently with adding feeds. HH-14 (verification) should validate the new threshold is adequate.

---

### Pitfall 3: n8n Execution Timeout with Many Feeds

**What goes wrong:**
n8n has a default `EXECUTIONS_TIMEOUT_MAX` of 3600 seconds (1 hour). The 01e workflow runs feeds sequentially (Loop Over Feeds, batchSize=1), and within each feed processes vacancies one-by-one (Loop Over Jobs, batchSize=1). Adding feeds multiplies execution time linearly. When the timeout fires mid-loop, ALL progress in that run is lost — n8n does NOT checkpoint iteration state.

**Why it happens:**
- Per-feed time breakdown (worst case):
  - RSS Feed Read: ~0.5–2s (network + XML parse)
  - Wait 1s (feed pacing)
  - Per-vacancy: HTTP fetch up to 10s timeout + Wait 1s vacancy = ~11s
  - 20 vacancies per feed × 11s = ~220s
  - **Per feed total: ~222s worst case**
- 8 feeds: ~1,776s = ~30 min ✓
- 16 feeds: ~3,552s = ~59 min — cutting close
- 25 feeds: ~5,550s = ~92 min — exceeds 1 hour default
- Real fetch times are usually faster (1–3s, not 10s timeout), so actual headroom is better
- But the risk is asymmetric: a single slow hh.ru response (throttling, network issues) can blow the per-vacancy budget; 10 slow fetches add 90s
- n8n's `SplitInBatches` (used for both loops) keeps execution alive until all batches finish — there is no partial-progress save

**How to avoid:**
- Calculate max feeds for target timeout: `maxFeeds = timeout / avgPerFeedTime` with 20% safety margin
  - With 1h timeout and ~60s per feed average: ~48 feeds max — but this assumes fast fetches
  - With 1h timeout and ~150s per feed (moderate slowness): ~24 feeds max
- Set a hard cap on auto-generated feeds in `Build Feed List` Code node (e.g., max 25 feeds per run)
- Add execution time tracking in the Code node: check elapsed time and skip remaining feeds if approaching 80% of timeout
- Increase `EXECUTIONS_TIMEOUT` to 7200s (2h) at the environment level if n8n is self-hosted — but note this ties up n8n worker for longer
- If timeout still bites: extract the feed-loop into a sub-workflow (Execute Workflow node per feed batch) so partial progress is preserved

**Warning signs:**
- n8n execution log shows `Workflow execution cancelled: timeout of 3600s reached` (or 7200s if increased)
- The error appears after X minutes of execution, always in the middle of a loop
- Monitoring: compare `executionStartedAt` to `stoppedAt` in n8n execution history
- If multiple consecutive runs timeout but still create some Pipeline records, timeout is the issue

**Phase to address:**
HH-13 (feed diversity implementation) — must include feed cap and timeout budget calculation. Document n8n timeout env var change if self-hosted.

---

### Pitfall 4: Duplicate Waste from Overlapping Feed Queries

**What goes wrong:**
When you add many query variations for the same job market (sub-areas in Moscow, different skill combinations, role synonyms), the same vacancy frequently appears in multiple feeds. These duplicates consume processing time (vacancy page fetches, parsing) and safety brake budget without adding value. In extreme cases, duplicates can consume >50% of the safety brake cap, hiding genuinely new jobs.

**Why it happens:**
- hh.ru RSS returns up to ~20 most recent items matching the query
- A Python Developer vacancy in Moscow matches queries: `python developer`, `python`, `python backend developer`, `django` (if Django is a skill), area=1 (Moscow), area=113 (Russia), etc.
- Current dedup happens at TWO stages:
  1. `Aggregate All Jobs` — cross-feed dedup by `jobId` (FNV-1a of title+company+applyLink) — catches cross-feed duplicates
  2. `Deduplicate vs Pipeline` — against existing records — catches previously-seen jobs
- But dedup #1 only runs AFTER all feeds have been processed: the vacancy page fetch for a job that will later be deduped as duplicate has already run
- With overlapping feeds, you can fetch the same vacancy page 3–5 times per run, wasting bandwidth and risking rate limits

**How to avoid:**
- Implement a **seen-URL cache using n8n workflow static data**: track `applyLink` values seen in the current run and skip Fetch Vacancy Page for duplicates
- Add this in `Parse & Filter Jobs`: check a `Set` in `getWorkflowStaticData('global')` for already-seen URLs this run; skip expensive fetch if present
- Feed dedup at the earliest possible point: before vacancy fetch, not after
- For sub-area feeds (same query, different area), expect high overlap — consider limiting to one area per query or using a broader area instead of multiple overlapping ones
- Track `sourceQuery` overlap statistics: if two feeds consistently return >60% overlapping results, merge or deduplicate at feed-list build time

**Warning signs:**
- `Aggregate All Jobs` output shows `X items → Y unique` with Y significantly less than X (e.g., 300 raw → 120 unique = 60% overlap)
- Same vacancy appearing multiple times in n8n execution logs with different `sourceQuery` values
- High ratio of "already in Pipeline" items vs "net new" — this is normal and expected for a mature Pipeline but excessive cross-feed overlap exacerbates it

**Phase to address:**
HH-13 (feed diversity implementation) — add run-scoped dedup cache before vacancy fetch. Use HH-14 verification to measure overlap ratio and optimize feed composition.

---

## Moderate Pitfalls

### Pitfall 5: Feed Composition Explosion — Unbounded Query Growth

**What goes wrong:**
Adding "more of everything" (sub-areas × roles × skills × experience levels × employment types) causes combinatorial explosion of RSS feeds. Feed count balloons from ~10 to 50+ with no clear strategy, creating all the problems above (timeouts, rate limits, duplicates) simultaneously.

**Why it happens:**
- It's tempting to generate feeds for every combination: each Target Role × each Core Skill × each RU geography area
- Example: 5 roles × 3 skills × 3 areas = 45 feeds alone before manual Search Queries
- Each feed is independent in n8n, requiring its own RSS read + parse + vacancy loop
- No natural upper bound in the absence of a feed budget

**How to avoid:**
- Define a **feed budget**: max N feeds per run, hard-capped in `Build Feed List` Code node
- Prioritize feeds by expected yield: role+area combinations > skill-only queries > narrow sub-area feeds
- Use a ranked strategy: generate all candidate feeds but only take top N by priority score
- Prefer broader queries over many narrow ones: one "python developer" query for Moscow beats "python" + "developer" + "python developer" as separate feeds
- Manual Search Queries should count against the feed budget, not be additive on top of auto-feeds
- Document the feed composition strategy in `docs/HH-RSS-STRATEGY.md` so future changes are deliberate

**Warning signs:**
- `Build Feed List` Code node output shows 30+ feeds
- Feed list growth is not reviewed at each milestone — it creeps up
- Adding new Profile skills or Target Roles doubles the feed count without conscious decision

**Phase to address:**
HH-13 (feed diversity implementation) — must include feed budget and prioritization logic in `Build Feed List`. Also create a feed composition strategy doc.

---

### Pitfall 6: RSS Feed Read Node 406 Errors on Some hh.ru Feeds

**What goes wrong:**
n8n's RSS Feed Read node (pre-v1.2) returned HTTP 406 errors for some RSS feeds due to `Accept` header negotiation issues. While hh.ru's RSS endpoint works with current n8n versions, adding exotic feeds (unusual query parameters, encoded Cyrillic in URL) could trigger similar issues. A single failed feed in a batch can waste the feed slot but `continueOnFail: true` mitigates this.

**Why it happens:**
- n8n RSS Read uses `rss-parser` npm package internally with default HTTP headers
- Fixed in n8n PR #16001 (June 2025, v1.2 of the node) — header handling was updated
- But some RSS servers are finicky about custom query parameters or long URLs
- hh.ru's RSS endpoint may reject URLs with certain special characters despite `encodeURIComponent`
- Russian text with unusual Unicode characters could cause URL encoding edge cases

**How to avoid:**
- Ensure n8n instance is running RSS Feed Read node v1.2 or later (update n8n if self-hosted)
- Add URL validation in `Build Feed List`: verify `encodeURIComponent` output is well-formed
- Log failed feed URLs for manual inspection — `continueOnFail: true` means failures are silent
- Consider HTTP Request node as fallback for RSS fetch (raw XML → parse in Code) if RSS Read node proves unreliable for specific feeds
- Test a few exotic query strings manually before adding them to production

**Warning signs:**
- n8n execution log shows RSS Read node errors (check `continueOnFail` items for error output)
- A particular query produces fewer items than expected (might be silently failing)
- "Status code 406" in n8n error logs

**Phase to address:**
HH-13 — add URL encoding validation and a fallback mechanism (HTTP Request + custom RSS parser). Test with Russian query strings before release.

---

### Pitfall 7: Invisible Vacancy Count Ceiling from hh.ru RSS Server-Side Limit

**What goes wrong:**
Even with more feeds, the actual number of unique new vacancies per run may plateau because hh.ru RSS feeds are limited server-side to a rolling window of ~20 most recent items per query. Each query only returns the latest 20 postings, so adding more feeds doesn't linearly increase coverage — you're just getting different slices of the same recent posting window.

**Why it happens:**
- hh.ru RSS is not a search API with pagination — it returns a fixed-size recent-item window
- Each feed: `https://hh.ru/search/vacancy/rss?text=...&area=...` → ~20 items, newest first
- Different queries return different subsets of recent postings, but there's significant overlap in the most-recent window
- The 20-item cap is server-enforced; there's no `per_page` or `max_items` parameter for RSS (the API endpoint supports `per_page` up to 100, but the RSS endpoint is separate and undocumented)
- After adding ~15–20 diverse feeds, additional feeds yield diminishing returns — you've already sampled the entire recent posting surface

**How to avoid:**
- During HH-14 verification, measure **unique net-new queries vs net-new jobs** — plot the curve
- Stop adding feeds once marginal yield drops below 1–2 new jobs per feed per run
- Focus on feed QUALITY over quantity: better query terms that target specific niches rather than broad role+skill combos
- Accept that hh.ru RSS has a natural ceiling of ~100–300 new vacancies per day from a single IP, regardless of feed count
- For deeper coverage, the only option is multiple sweeps per day (current schedule does 1 run at 8:20)

**Warning signs:**
- Adding 5 new feeds produces only 2–3 more unique jobs per run total
- Overlap ratio approaches 80–90% between feeds
- Scatter plot of feeds vs unique jobs shows a clear asymptote

**Phase to address:**
HH-14 (verification) — measure the yield curve and make the call on whether feed diversity has hit diminishing returns. If so, accept the ceiling or explore multi-sweep scheduling.

---

### Pitfall 8: CYR-1252 / Encoding Issues with Russian Text in RSS

**What goes wrong:**
hh.ru RSS feeds contain Russian text in titles, descriptions, and company names, XML-entity-encoded (e.g., `&amp;`, `&#1072;`). The n8n RSS Read node parses XML into JavaScript strings correctly (UTF-8), but downstream processing may corrupt non-ASCII characters. Specifically, the `stripHtml` function and `FNV-1a` hasher may produce different hashes for semantically identical Cyrillic strings if normalization differs.

**Why it happens:**
- hh.ru RSS XML declares `encoding="UTF-8"` — this works
- n8n RSS Read returns parsed strings as UTF-8 JavaScript strings — correct
- `stripHtml` in `Merge Descriptions` was copied from the RSS test script and handles `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`, `&nbsp;` — but NOT numeric HTML entities like `&#1072;` (Cyrillic letters)
- These numeric entities may survive into Pipeline `Job Description` as literal `&#1072;` text instead of the intended character
- FNV-1a hash runs on `title + company + applyLink`. If encoding issues alter `title` or `company` across different representations, the same job could get a different hash → duplicate record in Pipeline
- Vacancy page fetch (JSON-LD extraction) may use different encoding than RSS fallback, causing subtle differences in stored description

**How to avoid:**
- Extend `stripHtml` to decode numeric HTML entities (`&#XXXX;` and `&#xXXXX;`) — add this to the decode sequence before stripping tags
- Use `JSON.parse` trick `"\"&#1072;\"".replace(/&#(\d+);/g, ...)` or a simple regex decoder
- Normalize Cyrillic strings before FNV-1a hashing: NFC-normalize via `str.normalize('NFC')` (JavaScript's `String.prototype.normalize` is available in n8n Code node's Node.js runtime)
- Verify the hash input for a few known Russian company names to ensure consistency

**Warning signs:**
- Pipeline `Job Description` contains literal `&#1072;` or `&#x440;` text instead of readable Russian
- The same hh.ru vacancy appears as multiple Pipeline records with slightly different titles (one with encoded entities, one decoded)
- FNV-1a hash mismatch for identical jobs detected during manual spot-checks

**Phase to address:**
HH-13 (feed diversity implementation) — fix stripHtml for numeric entities and add NFC normalization to the FNV-1a input. These are preconditions for adding more feeds, not post-checks.

---

### Pitfall 9: Unintentional Self-DoS from Schedule Timing Conflicts

**What goes wrong:**
Adding more feeds increases 01e execution time from ~15 minutes to 45–60+ minutes. The Evaluator workflow (02) starts at 9:00 AM — if 01e is still running, it creates two problems: (a) n8n worker resource contention slows both workflows, (b) hh.ru jobs discovered in the late portion of 01e miss the 9:00 Evaluator run entirely, getting deferred to the next day.

**Why it happens:**
- Current schedule: 01e at 8:20 AM, Evaluator at 9:00 AM (40 min window)
- Current 01e execution: ~15–20 minutes → comfortable 20 min buffer
- With 3x feed count, execution could stretch to 45–60+ minutes → collides with 9:00 AM
- n8n queue-based execution: simultaneous workflow executions compete for the same node execution slots
- Delayed Evaluator start = jobs evaluated later = missed High Fit alerts, delayed digest

**How to avoid:**
- Move 01e schedule earlier: 7:30 or 7:45 AM to restore the 60+ minute buffer
- OR split 01e into two staggered runs: 01e-A (primary feeds) at 7:30, 01e-B (expanded feeds) at 8:30
- Monitor execution duration trend; alert if it exceeds 35 minutes for two consecutive runs
- If execution consistently exceeds 40 min despite all optimizations, permanently reschedule

**Warning signs:**
- n8n execution history shows 01e and 02 running simultaneously
- Pipeline records from 01e have `Discovery Date` showing 9:xx when they should be 8:xx
- Evaluator run processes fewer hh.ru jobs than expected (those found after 01e finished weren't evaluated)
- n8n reports execution queue depth > 1 during 8:30–9:30 window

**Phase to address:**
HH-13 (feed diversity) — schedule adjustment must be part of the plan. Verify during HH-14.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep 1s delay between vacancy fetches | Faster execution, simpler config | IP ban from hh.ru, all discovery stops for 1-24h | Never — increase to 3-5s with jitter |
| Hard-code safety brake at 100 net-new | Simple constant, no config | Run aborts on high-volume days, zero jobs discovered | Only until feed-diversity phase adjusts it |
| No run-scoped dedup cache (fetch all vacancies, dedup later) | Simpler code, fewer n8n static data tricks | Wasteful vacancy fetches for duplicates → rate limiting | Tolerable at ≤10 feeds; must fix at 15+ feeds |
| Add feeds without measuring marginal yield | Quick coverage boost | Wasted execution time on feeds returning near-zero unique jobs | During initial exploration (HH-13), but HH-14 must measure |
| FNV-1a without NFC normalization | Hash is simple and fast | Encoding variations cause duplicate Pipeline records for same job | Only if never adding Russian-language data — inapplicable here |
| One fixed User-Agent header | Simple config | hh.ru tracks this bot identity across sessions | Acceptable for RSS reads; risky for 100+ vacancy fetches per run |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| hh.ru RSS endpoint | Adding exotic query parameters without testing | Test each new query pattern against the live RSS URL in a browser first |
| hh.ru vacancy HTML pages | Assuming 1s delay is sufficient between fetches | Use 3-5s with ±1s random jitter; monitor for 429 responses |
| n8n RSS Feed Read node | Assuming all feeds work identically | Add continueOnFail: true (already done); monitor for 406 errors |
| n8n Loop Over Items (SplitInBatches) | Adding more items without calculating execution time budget | Calculate max feasible items for the timeout window |
| Airtable Pipeline dedup | Relying on end-of-run dedup only | Add run-scoped dedup before expensive operations (vacancy fetch) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Adding feeds without time budget | Execution timeout mid-run | Calculate max feeds = timeout / avgPerFeedTime × 0.8 | 20-25 feeds (depends on fetch speed) |
| Vacancy fetch serial delay too low | 429 errors, IP block | Increase to 3-5s with jitter; monitor per-hour fetch count | 80+ fetches/hour |
| No marginal yield tracking | Diminishing returns from new feeds | HH-14 must measure unique jobs per feed | After ~15-20 diverse feeds |
| Unbounded feed generation | Combinatorial feed explosion | Hard cap + priority scoring in Build Feed List | When generating feeds for roles×skills×areas combinations |
| Single daily schedule | Jobs discovered after 8:20 miss Evaluator at 9:00 | Move to 7:30 or add second sweep | When 01e execution exceeds 35 minutes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No fetch count limit per run | hh.ru IP block takes down ALL hh.ru discovery | Track fetch count; switch to RSS-only fallback after N fetches |
| Fixed User-Agent for all requests | Correlatable bot fingerprint; easier to block | Rotate across a small pool of realistic User-Agent strings |
| No 429/403 response monitoring | Silent degradation: fetches return error pages but Merge falls back to RSS without alerting | Check `_fetchStatus` and `_fetchHint` diagnostics; alert on consecutive failures |
| Single point of failure (one IP) | Any hh.ru block stops the entire scanner | RSS-only mode as degraded fallback; proxy as escalation |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Safety brake fires silently on high-volume days | User expects new jobs but Pipeline has zero hh.ru records — no alert | Log the count in n8n execution output; consider a notification for brake events |
| Adding feeds with no visible feedback | User doesn't know how many feeds are active or their yield | Show feed count and per-feed yield in execution output (n8n console log) |
| Execution timeout mid-run with no partial results | All feed progress for that run is lost; user assumes system is broken | Split into sub-workflows or log partial progress so user can diagnose |
| No encoding normalization on descriptions | Russian text renders with literal entity codes instead of readable Cyrillic | Fix stripHtml numeric entity decoding before shipping feed diversity |
| Single schedule doesn't adapt to longer execution | Jobs found late miss daily Evaluator run | Add a runtime duration check after feed loop; auto-adjust or warn in execution log |

## "Looks Done But Isn't" Checklist

- [ ] **Safety Brake:** Is the 100 net-new cap adjusted for higher feed volume? If not, runs will abort silently.
- [ ] **Delay Jitter:** Are vacancy fetches spaced 3-5s with random jitter, not a fixed 1s? Fixed delays look like bot behavior.
- [ ] **Run-Scoped Dedup:** Is there an in-memory Set tracking fetched vacancy URLs to skip duplicates? Currently duplicates are only caught after fetch.
- [ ] **NFC Normalization:** Does FNV-1a hasher use `String.normalize('NFC')` on Russian company names/titles? Encoding variants could cause duplicate Pipeline records.
- [ ] **Numeric HTML Entity Decoding:** Does `stripHtml` handle `&#XXXX;` and `&#xXXXX;` for Cyrillic characters? Currently only handles named entities.
- [ ] **Feed Budget Cap:** Is there a hard upper limit on auto-generated feeds in `Build Feed List`? Feed count should not grow unbounded.
- [ ] **Execution Time Budget:** Has the expected max execution time been calculated against the n8n timeout? Feeds should not exceed 80% of timeout.
- [ ] **Schedule Adjusted:** Is the 8:20 AM start time early enough to finish before 9:00 Evaluator? Longer execution needs earlier start.
- [ ] **Marginal Yield Measurement:** Will HH-14 compare per-feed unique contribution? Without this, feed additions are blind.
- [ ] **429/403 Monitoring:** Is there logic to detect blocked vacancy fetches and fall back to RSS-only? Without this, IP bans are discovered only when everything stops working.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| hh.ru IP block (all requests fail) | HIGH (1-24h downtime) | 1. Confirm block: check response codes (429/403). 2. Run RSS-only mode (skip vacancy fetches, use RSS descriptions). 3. If self-hosted: cycle VPS IP / use different egress. 4. If cloud: wait 1-6h, reduce fetch rate before retry. 5. Add residential proxy as permanent fix. |
| Safety brake abort on high-volume day | LOW (missed day of jobs) | 1. Check error count in execution logs. 2. Temporarily increase cap to 500. 3. Run workflow manually to catch missed jobs. 4. Adjust cap permanently if trend continues. |
| Execution timeout mid-loop | MEDIUM (lost run progress) | 1. Check execution history for timeout error. 2. Reduce feed count or increase timeout. 3. Re-run workflow manually after fix. 4. Consider sub-workflow split if recurrent. |
| Duplicate Pipeline records from encoding mismatch | MEDIUM (manual cleanup) | 1. Query Airtable Pipeline for duplicate `Job ID` values near each other. 2. Deduplicate manually or via Housekeeper. 3. Apply NFC normalization fix to prevent recurrence. 4. Archive duplicate rows. |
| Schedule collision with Evaluator | LOW (deferred evaluation) | 1. Check n8n execution timeline for overlap. 2. Manually trigger Evaluator for missed hh.ru jobs. 3. Move 01e schedule earlier. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. hh.ru IP blocking from vacancy fetches | HH-13 (increase delay, add fetch monitoring) | HH-14: check no 429/403 in execution logs over 7 days |
| 2. Safety brake false-positives | HH-13 (adjust cap or make configurable) | HH-14: verify no aborted runs with new feed count |
| 3. n8n execution timeout | HH-13 (feed cap, time budget) | HH-14: confirm execution completes within 60% of timeout |
| 4. Duplicate waste from overlapping feeds | HH-13 (run-scoped dedup before fetch) | HH-14: measure overlap ratio, target <30% |
| 5. Feed composition explosion | HH-13 (feed budget, priority scoring) | HH-14: verify feed count stays under cap |
| 6. RSS Feed Read 406 errors | HH-13 (URL validation, HTTP fallback) | Manual: test exotic query strings before enabling |
| 7. Server-side RSS item ceiling | HH-14 (measure yield curve) | HH-14: decide whether ceiling is acceptable |
| 8. Cyrillic encoding issues | HH-13 (numeric entity decode, NFC normalize) | HH-14: spot-check Pipeline Russian text rendering |
| 9. Schedule collision with Evaluator | HH-13 (adjust schedule) | HH-14: verify 01e finishes by 8:30 at latest |

## Sources

- **hh.ru anti-bot / rate limit research:** proxycove.com proxy guide for hh.ru (2026) — 80–120 req/hr IP limit, 4–8s recommended delay for HTML scraping — MEDIUM confidence (proxy vendor source, commercial interest)
- **hh.ru security tightening 2026:** prorecruitment.ru (2026-04-30) — Cloudflare Bot Management, TLS fingerprinting, API availability changes — MEDIUM confidence (industry blog)
- **hh.ru API docs:** github.com/hhru/api — RSS is undocumented, API limits are documented for authenticated endpoints only — HIGH confidence (official)
- **n8n RSS Feed Read node docs:** docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.rssfeedread/ — v1.2 fixes, config options — HIGH confidence (official docs)
- **n8n execution timeout config:** docs.n8n.io/hosting/configuration/configuration-examples/execution-timeout/ — EXECUTIONS_TIMEOUT_MAX default 3600s — HIGH confidence (official docs)
- **n8n SplitInBatches behavior:** n8n.spot guide (2026) — no checkpointing, keeps execution alive until all batches finish — MEDIUM confidence (community docs)
- **n8n RSS community reports:** github.com/n8n-io/n8n issues #18036, #18493 — 406 errors on some feeds, fixed in v1.2 — HIGH confidence (GitHub issues + PR #16001)
- **hh.ru RSS community projects:** github.com/selvnv/subscribe_job_rss (2026) — RSS still works, API closed Dec 2025, 1s delay between vacancy fetches used — MEDIUM confidence (open source, not official)
- **RSS specification:** rssboard.org — no item limit, UTF-8 encoding standard — HIGH confidence (W3C-affiliated spec)
- **Existing 01e workflow analysis:** workflows/01e-scanner-hhru.json — current 1s delays, batchSize=1, loop structure — HIGH confidence (code review)

---
*Pitfalls research for: hh.ru RSS feed diversity (01e coverage improvement)*
*Researched: 2026-06-07*
