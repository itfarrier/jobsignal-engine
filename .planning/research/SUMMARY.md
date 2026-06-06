# Project Research Summary

**Project:** JobSignal Engine — 01e hh.ru RSS Scanner Coverage Improvement
**Domain:** Multi-feed RSS job discovery from hh.ru public RSS endpoint
**Researched:** 2026-06-07
**Confidence:** HIGH (stack/architecture empirically verified via live hh.ru RSS tests)

## Executive Summary

The 01e hh.ru RSS scanner suffers from a hard cap of ~20 items per RSS feed with no pagination, yielding at most ~160 raw items per scan cycle. Research confirms the root cause is a single `area=113` feed per Target Role — `area=113` returns only the top-20 most relevant results across all Russia, not all Russia vacancies. The authenticated API (which would support pagination and higher per_page values) returns HTTP 403 without credentials, which PROJECT.md has determined are unobtainable. RSS is the only free, auth-free discovery path.

The recommended approach is **feed diversification through orthogonal parameter combinations**. Live testing confirmed that `professional_role`, `experience`, `work_format`, and sub-area ID parameters all work on the RSS endpoint and return **different 20-item sets** than the default query. By generating multiple feeds per role across sub-areas (Moscow + SPb + Russia), professional role IDs, query language variants (EN/RU synonyms), and experience bands, coverage can scale from ~160 raw items to an estimated 500–1,500+ raw items per scan — a 3–10× improvement — without changing architecture, adding cost, or needing API credentials.

**Key risks and mitigations:** (1) hh.ru IP blocking from excessive vacancy page fetches — increase inter-fetch delay from 1s to 3–5s with jitter, add 429/403 response monitoring; (2) Safety brake false-positives — adjust the 100 net-new cap to 300–500 before adding feeds; (3) n8n execution timeout — cap auto-generated feeds at 40 and calculate time budget against 1-hour default; (4) Cyrillic encoding corruption — add numeric HTML entity decoding and NFC normalization to FNV-1a hasher. These mitigations are preconditions for feed diversity, not optional optimizations.

## Key Findings

### Recommended Stack

**Core stack (all confirmed working, no changes needed to these):**
- **hh.ru RSS endpoint** (`https://hh.ru/search/vacancy/rss`): Returns structured XML (~10KB per feed) with ~20 items — free, no auth, verified working with `professional_role`, `experience`, `work_format`, `employment_form`, `order_by` parameters and hh.ru query language operators (`NAME:`, `AND`/`OR`/`NOT`, `"exact phrase"`, `!exact_form`, `*wildcard`)
- **n8n RSS Feed Read node**: Native node consuming RSS XML — unchanged, confirmed working
- **n8n Code nodes v2**: Data transformation for feed generation and job parsing — unchanged
- **Airtable API**: Profile, Search Queries, Pipeline storage — unchanged
- **FNV-1a hashing**: Cross-feed dedup — unchanged but **must add NFC normalization** for Cyrillic titles
- **Pipeline document ingestion**: Unchanged

**Critical version/cap requirements:**
- n8n RSS Feed Read node must be v1.2+ (fix for HTTP 406 errors on some feeds — PR #16001, June 2025)
- All strategies implementable via n8n native nodes (no new platforms, $0 marginal cost)
- 1s wait between feed requests keeps 40-feeds at ~40s; 1s vacancy fetches must be increased to 3–5s

### Expected Features

**Must have (table stakes — all already shipped in v1.0–v2.0):**
- One RSS feed per Target Role (profile-driven auto feed generation)
- Manual Search Queries override (user-supplied query strings override auto-feeds)
- Geography mapping via Target Geography (area resolver: Russia=113, Moscow=1, SPb=2)
- FNV-1a dedup with `-hhr` suffix for cross-feed dedup
- 100 net-new safety brake (but needs threshold adjustment for higher volumes)
- Description enrichment via vacancy page HTML fetch (JSON-LD + data-qa fallback)

**Should have (P1 — highest impact, lowest cost):**
- **Sub-area parallel feeds** (Moscow=1 + SPb=2 + Russia=113 per role) — 3× coverage, trivial URL parameter change
- **RU/EN query synonyms** — generate 2 text variants per role (EN and RU phrasing), 1.5–2× coverage
- **Experience-split feeds** — 3 experience levels (junior/mid/senior) per role, 2–4× coverage

**Should have (P2 — good value, needs minor verification):**
- **Work format split** (remote feed per role) — 1.5–2× coverage, `&work_format=REMOTE` parameter
- **`professional_role` ID feeds** — confirmed working via live test, orthogonal to keyword search
- **Title-scoped `NAME:` operator feeds** — `NAME:("Python Developer" OR ...)` for precision

**Defer (v2+ or conditional):**
- Full sub-area expansion beyond Moscow/SPb (10+ cities) — adds complexity, Moscow/SPb capture majority of IT jobs
- `no_magic=true` complement feeds — low marginal yield
- Paid scrapers/Apify actors — violates $0 marginal cost constraint
- Browser automation (Playwright/Puppeteer) — out of scope per PROJECT.md

### Architecture Approach

Only **2 nodes** change in the existing 22-node n8n workflow. `Build Feed List` (Code node) gets new area enumeration logic, query variant generation, and a 40-feed hard cap with priority scoring. `Parse & Filter Jobs` gets a `feedMeta` passthrough for diagnostics and a run-scoped dedup cache to avoid wasted vacancy fetches for cross-feed duplicates. All other nodes — RSS Feed Read, Loop Over Feeds/Jobs, Fetch Vacancy Page, Merge Descriptions, Aggregate All Jobs, Deduplicate vs Pipeline, Create Pipeline Records — remain completely unchanged.

**Major components:**
1. **Build Feed List** (MODIFIED) — Generates feed URLs using `GEO_TO_AREA` mapping, `makeQueryVariants()` (role_only + role_skills), `professional_role` and experience parameters. Caps at 40 feeds with priority sorting (Search Queries > role_only > role_skills > sub-areas)
2. **Parse & Filter Jobs** (MODIFIED) — Parses RSS XML, applies geography/title filters, computes FNV-1a hash, passes through `feedMeta` diagnostics, maintains run-scoped dedup set to skip already-fetched vacancy URLs
3. **Aggregate All Jobs** (UNCHANGED) — Intra-run dedup by `jobId` across all feeds
4. **Deduplicate vs Pipeline** (UNCHANGED except threshold) — Cross-run dedup + configurable safety brake

### Critical Pitfalls

1. **hh.ru IP Blocking from Vacancy Page Fetches** — hh.ru uses Cloudflare Bot Management and JA3 fingerprinting; sources report IP blocks after 80–120 HTML page requests/hour. Current 1s vacancy fetch delay is too aggressive. **Mitigation:** Increase to 3–5s with random jitter, track per-hour fetch count, add 429/403 response monitoring with RSS-only fallback mode.

2. **Safety Brake False-Positives at Higher Volume** — The hard 100 net-new throw aborts entire runs. With 40+ feeds generating 500–1,500 raw items, net-new will consistently exceed 100. **Mitigation:** Increase cap to 300–500 for hh.ru, or change from hard-throw to warn+truncate. Make configurable.

3. **n8n Execution Timeout with Many Feeds** — Default n8n timeout is 3,600s (1 hour). At worst case ~150s/feed, 25+ feeds could timeout. No partial-progress checkpointing means total run loss. **Mitigation:** Hard cap at 40 feeds, calculate time budget against timeout, schedule adjustment to 7:30 AM.

4. **Duplicate Waste from Overlapping Feed Queries** — Same vacancy appears across multiple feeds (area=1 + area=113 + role_only + role_skills). Current architecture fetches the vacancy HTML page for every occurrence before dedup runs. **Mitigation:** Add run-scoped dedup cache (track `applyLink` in `getWorkflowStaticData('global')`) to skip duplicate vacancy fetches; measure overlap ratio during verification.

5. **Cyrillic Encoding Issues** — `stripHtml` doesn't decode numeric HTML entities (`&#XXXX;`), causing literal entity codes in Pipeline descriptions. FNV-1a hashing without NFC normalization can produce different hashes for the same Cyrillic title. **Mitigation:** Extend `stripHtml` to decode numeric entities; add `String.normalize('NFC')` to FNV-1a input. These are preconditions for adding more feeds.

6. **Schedule Collision with Evaluator** — 01e at 8:20 AM, Evaluator at 9:00 AM gives only 40 min window. Expanded feeds could push execution past 9:00. **Mitigation:** Move 01e schedule to 7:30 AM, or split into two staggered runs.

## Implications for Roadmap

Based on combined research, the existing HH-12/HH-13/HH-14 phase structure is correct. Below are the refined phases with explicit feature addresses, architectural changes, and pitfall mitigations:

### Phase 1: HH-12 — Diagnose Baseline (Before Any Code Changes)

**Rationale:** All research confirms this must come first. Cannot measure improvement without baseline metrics. No code changes — only execution logging.

**Delivers:**
- Recorded baseline: feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records
- Exported execution data for comparison
- Confirms current status for all stakeholders

**Addresses from FEATURES.md:**
- Documents current behavior of all already-shipped table stakes

**Avoids from PITFALLS.md:**
- Pitfall 7 (invisible ceiling): baseline establishes the curve for later measurement
- No code changes means zero risk of introducing new issues

**Research flag:** ⚠️ Well-documented patterns — no deep research needed. Run workflow with execution logging enabled.

---

### Phase 2: HH-13 — Feed Diversity Implementation (Code Changes)

**Rationale:** Core implementation phase. Every research file agrees on the order: area enumeration first (highest impact), then query variants, then experience/work format splits. All pitfall mitigations must land in this phase.

**Delivers:**
- Modified `Build Feed List` node with area enumeration, query variants, professional_role mapping, experience/work format parameters, 40-feed hard cap with priority scoring
- Modified `Parse & Filter Jobs` node with feedMeta passthrough and run-scoped dedup cache
- Fixed `stripHtml` with numeric HTML entity decoding
- FNV-1a hasher with `String.normalize('NFC')`
- Adjusted vacancy fetch delay from 1s to 3–5s with jitter
- 429/403 response monitoring in Fetch Vacancy Page
- Configurable safety brake (cap raised to 300–500)
- Adjusted 01e schedule (recommended: 7:30 AM)
- Feed composition strategy document

**Addresses from FEATURES.md:**
- P1: Sub-area parallel feeds (Moscow=1 + SPb=2 + Russia=113)
- P1: RU/EN query synonyms (2 variants per role)
- P1: Experience-split feeds (3 levels per role)
- P2: Work format split (`&work_format=REMOTE`)
- P2: `professional_role` ID feeds (confirmed RSS support)
- P2: Title-scoped `NAME:` operator feeds

**Implements from ARCHITECTURE.md:**
- `Build Feed List` — area enumeration + query variants + cap logic + priority scoring
- `Parse & Filter Jobs` — feedMeta passthrough + run-scoped dedup
- Feed budget calculation and runtime governor updates

**Avoids from PITFALLS.md:**
- Pitfall 1 (IP blocking): increased delay, jitter, 429 monitoring
- Pitfall 2 (safety brake): increased/configurable cap
- Pitfall 3 (timeout): feed cap + time budget
- Pitfall 4 (duplicate waste): run-scoped dedup before fetch
- Pitfall 5 (feed explosion): hard cap + priority scoring
- Pitfall 6 (406 errors): ensure RSS Feed Read v1.2+, URL validation
- Pitfall 8 (Cyrillic encoding): numeric entity decode + NFC normalize
- Pitfall 9 (schedule collision): adjusted schedule

**Research flag:** ⚠️ Needs research during planning for:
- `professional_role` → Target Role mapping strategy (which IDs map to which roles)
- Optimal jitter range (3–5s recommended, but verify against actual hh.ru throttling behavior)
- Safety brake threshold tuning during execution
- n8n instance RSS Feed Read node version verification

---

### Phase 3: HH-14 — Verification and Tuning

**Rationale:** Must measure before shipping. Compare metrics against HH-12 baseline. Measure marginal yield per feed to identify diminishing returns. This phase validates the entire investment.

**Delivers:**
- Comparative metrics: feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records
- Per-feed marginal yield (unique new jobs contributed per feed)
- Overlap ratio measurement (target: <30% cross-feed overlap)
- Cyrillic rendering spot-check in Pipeline
- Execution time verification (target: completes within 60% of n8n timeout)
- No 429/403 responses in execution logs over 7-day monitoring window
- Verification that schedule change was adequate (01e finishes by 8:30 at latest)
- Decision on whether hh.ru RSS natural ceiling is acceptable or needs multi-sweep scheduling

**Addresses from FEATURES.md:**
- P3 items if verification shows margin: full sub-area expansion, `no_magic=true` complement feeds
- Feed quality over quantity decision

**Avoids from PITFALLS.md:**
- Pitfall 7 (invisible ceiling): measure the yield curve, make the call
- Pitfall 8 (encoding): spot-check Pipeline Russian text rendering

**Research flag:** ✅ Standard patterns — skip deep research. This is measurement and analysis against established baselines.

---

### Phase Ordering Rationale

- **HH-12 before HH-13:** Cannot measure improvement without baseline. Zero-code phase reduces risk.
- **HH-13 before HH-14:** Must implement before verifying. Pitfall mitigations are preconditions for safe feed expansion, not afterthoughts.
- **Encoding fixes in HH-13, not deferred:** Numeric entity decoding and NFC normalization are preconditions for adding more feeds; without them, duplicate Pipeline records accumulate silently as hash mismatches for Cyrillic job titles.
- **Vacancy fetch delay increase in HH-13, not optional:** Research shows 80–120 req/hr triggers hh.ru IP blocks. Moving from 1s to 3–5s with jitter must accompany feed expansion, not follow it.

### Research Flags

Phases likely needing deeper research during planning:
- **HH-13:** `professional_role` → Target Role mapping (which role IDs map to each Profile Target Role); optimal jitter range may need empirical tuning; n8n instance RSS Feed Read node version must be verified as v1.2+
- **HH-13:** Safety brake threshold — needs configurable parameter added to workflow, not a hard constant

Phases with standard patterns (skip research-phase):
- **HH-12:** Simple execution logging and metric recording — established pattern
- **HH-14:** Comparative analysis against baseline — established measurement pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Live curl tests confirmed RSS endpoint behavior, `professional_role` support, area behavior, API 403 response. Multiple community sources agree on parameter semantics. HH.ru official query language docs are authoritative. |
| Features | MEDIUM | Live verification of all proposed strategies not yet done end-to-end. Marginal yield estimates are projections based on feed multiplication math, not empirical measurement. Actual overlap ratios between area=1 and area=113 feeds need measurement. |
| Architecture | HIGH | Based on analysis of existing working 01e workflow JSON + live RSS testing. Only 2 nodes change; all unchanged nodes were verified as adequate through code review. Area mapping logic and query variant strategy are straightforward transformations. |
| Pitfalls | MEDIUM | Rate limit thresholds (80–120 req/hr) from proxy vendor source (commercial interest bias). No official hh.ru rate limit documentation exists. 1-hour n8n timeout confirmed in official docs. Run-scoped dedup approach uses n8n static data which has edge cases (concurrent executions). |

**Overall confidence:** HIGH

Research quality is strong for the core technical question (how RSS parameters work and what changes are needed in the workflow). Primary uncertainty is around rate limit thresholds and marginal yield — both of which are addressed by measurement during HH-14 verification.

### Gaps to Address

- **Rate limit verification:** The 80–120 req/hour figure comes from a proxy vendor (commercial interest). During HH-14, verify against actual hh.ru behavior at the recommended 3–5s delay. If 429s appear, reduce to 6–8s delay.
- **Marginal yield curve:** Projections of 3–10× improvement assume orthogonal feed parameters. Actual overlap between feeds can only be empirically measured. HH-14 must validate the yield curve before declaring success.
- **n8n execution timeout:** Must verify the n8n instance's actual `EXECUTIONS_TIMEOUT_MAX` setting. If self-hosted and configurable, increase to 7,200s as safety buffer. If cloud-hosted with fixed 3,600s, the 40-feed cap is correct.
- **Schedule timing:** The recommended 7:30 AM start is a proposal. Confirm it doesn't conflict with other scheduled workflows and that the n8n instance's timezone handling is correct.
- **`professional_role` mapping table completeness:** The STACK research lists IT role IDs, but the mapping from Profile Target Roles (e.g., "Python Developer") to hh.ru professional_role IDs (e.g., 96 = "Programmer") needs manual curation. Not all roles have exact 1:1 mappings.

## Sources

### Primary (HIGH confidence)
- **Live hh.ru RSS testing** — `curl https://hh.ru/search/vacancy/rss?...` (2026-06-07) confirmed 20-item cap, per-area result differences, `professional_role` filtering, no pagination
- **hh.ru API areas endpoint** — `GET https://api.hh.ru/areas/113` — 88 sub-regions, 14,342 cities (no auth)
- **hh.ru professional roles endpoint** — `GET https://api.hh.ru/professional_roles` — full role ID taxonomy (no auth)
- **hh.ru dictionaries endpoint** — `GET https://api.hh.ru/dictionaries` — parameter value enums (no auth)
- **hh.ru official API docs** — github.com/hhru/api — parameter semantics, search query language
- **hh.ru query language article** — feedback.hh.ru/article/9343 — `NAME:`, `AND`/`OR`/`NOT`, `""`, `!`, `*` operators
- **Existing 01e workflow analysis** — `workflows/01e-scanner-hhru.json` — current architecture, node structure, delay configs
- **n8n execution timeout docs** — docs.n8n.io/hosting/configuration/execution-timeout — 3,600s default timeout
- **n8n RSS Feed Read docs** — docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.rssfeedread — v1.2 fixes for 406 errors
- **n8n GitHub issues** — #18036, #18493, PR #16001 — RSS Feed Read 406 errors confirmed and fixed

### Secondary (MEDIUM confidence)
- **subscribe_job_rss** (github.com/selvnx/subscribe_job_rss, 2026) — confirmed RSS params: `text`, `area`, `experience`, `employment_form`, `work_format` — MEDIUM for `professional_role`, `search_field`, `no_magic` in RSS context
- **hh.ru anti-bot research** — proxycove.com proxy guide (2026) — 80–120 req/hr IP limit, 4–8s recommended delay — commercial source, plausible but unverified independently
- **hh.ru security tightening 2026** — prorecruitment.ru (2026-04-30) — Cloudflare Bot Management, TLS fingerprinting
- **DTF guide: parsing hh.ru** (2026) — `no_magic=true`, `search_field=name` in URL examples — community tutorial, not official
- **Apify hh-ru-job-scraper** (2025) — experience/schedule/employment filters in `startUrl` pattern — Apify actor, demonstrates parameter usage
- **n8n SplitInBatches behavior** — n8n.spot guide (2026) — no checkpointing confirmation

### Tertiary (LOW confidence)
- **forpes.ru hh.ru API analysis in R** (2023) — iterates `professional_role` IDs and areas to maximize coverage — older source, but its core insight (sub-areas return different sets) was verified by live RSS tests
- **Unofficial HH.ru API docs** (github.com/feildmaster/HeadHunter-API) — parameter documentation — community reverse engineering, not official

---

*Research completed: 2026-06-07*
*Ready for roadmap: yes*
