# JobSignal Engine

## What This Is

JobSignal Engine is an autonomous job-search pipeline that treats your hunt like a sales pipeline: scheduled n8n workflows discover roles from ATS APIs and job boards, score them against your Airtable Profile, tailor CVs, prep interviews, and email you results before you open your laptop. You review and apply — the system does discovery and prep unattended.

This milestone adds **hh.ru** as a fifth discovery source for the Russian job market, using public RSS feeds (no HeadHunter API credentials), Profile-driven search queries, and the same Pipeline / Evaluator downstream path as scanners 1a–1d.

## Core Value

Every morning, relevant new jobs land in Airtable already deduplicated and ready for AI scoring — including roles from hh.ru that match your skills, roles, and geography — so you spend time applying to good fits, not searching job boards.

## Requirements

### Validated

- ✓ Multi-source discovery via Greenhouse, Ashby, and Lever APIs for tracked companies — existing (`workflows/01a`–`01c`)
- ✓ LinkedIn / Indeed discovery via JobSpy sidecar and Search Queries table — existing (`workflows/01d`, self-hosted)
- ✓ Profile-driven geography filtering on ATS scanners — existing (dynamic `Target Geography` in parse nodes)
- ✓ FNV-1a job IDs, Pipeline deduplication, 100 net-new safety brake per scanner run — existing
- ✓ AI fit scoring, interview prep, High Fit alerts — existing (`workflows/02`)
- ✓ CV tailoring to DOCX via sidecar — existing (`workflows/03`)
- ✓ Housekeeping and evening digest — existing (`workflows/04`, `06`)
- ✓ Airtable as single source of truth (Profile, Tracked Companies, Pipeline, Search Queries) — existing

### Active

- [ ] **HH-01**: n8n workflow `workflows/01e-scanner-hhru.json` discovers vacancies via public hh.ru RSS (`/search/vacancy/rss`) — no OAuth / employer API
- [ ] **HH-02**: Auto-build RSS feeds from Profile (`Target Roles`, `Core Skills`, `Target Geography`) — one feed per role, bilingual `text=` where Profile is mixed RU/EN, cap ~8 auto feeds
- [ ] **HH-03**: Merge enabled **Search Queries** rows with `Source Type = HH RSS` (override / extra queries); `Location` field stores hh `area` ID when set, else derive from Profile
- [ ] **HH-04**: Parse RSS items (title, link, company, region, salary from description HTML); post-filter by Profile geography substrings (Russian + English); optional per-query **Title Keywords**; no extra Russian negative-filter logic in scanner (Evaluator handles `Negative Filters`)
- [ ] **HH-05**: Write net-new jobs to Pipeline with `source: hh.ru`, `jobId` suffix `-hhr`, same dedup / create pattern as 1d; schedule daily **8:20** + manual trigger
- [ ] **HH-06**: v1 uses RSS summary as `Job Description`; public vacancy-page scrape deferred to a later phase
- [ ] **HH-07**: Extend **Target Geography** in Airtable schema/docs and scanner `GEO_MAP`: Russia (`113`), Moscow (`1`), Saint Petersburg (`2`), Remote Russia; sync schema doc with geographies already in 1a–1c code
- [ ] **HH-08**: Document Search Queries **HH RSS** column usage; add `hh.ru` to Pipeline **Source** single-select options
- [ ] **HH-09**: Skip auto hh feeds when Profile has no RU-relevant geography (manual HH RSS Search Queries may still run)

### Out of Scope

- HeadHunter authenticated API (`hhru/api`) — user cannot obtain credentials; API docs are reference only for area IDs and field semantics
- Browser automation / auto-apply ([avkotau/hh.ru-parser](https://github.com/avkotau/hh.ru-parser)) — different product surface; apply remains manual
- hh.ru employer-only or application APIs
- Changing Evaluator, Tailor, Housekeeper, or Alerter behavior beyond accepting `hh.ru` as a new Source value
- Workflow 5 Optimizer (analytics) — pre-existing roadmap item, not this milestone
- Russian negative-filter heuristics in scanner parse nodes — rejected; Evaluator already uses Profile `Negative Filters`

## Context

**Brownfield:** Production codebase on branch `add-hh-ru`; scanners 1a–1d and evaluator pipeline are shipped. Codebase map lives in `.planning/codebase/`. Prior experimental notes referenced an API-based hh scanner; this milestone **replaces** that approach with RSS-first discovery per user constraint.

**hh.ru RSS:** Public endpoint example: `https://hh.ru/search/vacancy/rss?text=python+developer&area=113`. Returns ~20 items per feed with structured summary in `description` (company, region, salary in Russian). Full JD requires optional HTML fetch later.

**Area IDs (public reference):** Russia `113`, Moscow `1`, Saint Petersburg `2` — from `https://api.hh.ru/areas/{id}` without auth.

**Profile fields driving hh discovery:** `Target Roles`, `Core Skills`, `Target Industries`, `Target Geography`, `Seniority Level`, `Negative Filters` (evaluator only), `Location Preference`.

**Scanner pattern to mirror:** JobSpy `01d` (multi-query → loop → parse → aggregate → dedup → Pipeline) plus Profile read from `01a` (geography map).

## Constraints

- **Tech stack**: n8n workflow JSON + Airtable; no new application server; RSS via native `rssFeedRead` or HTTP + parse
- **Auth**: No HeadHunter API tokens; RSS and optional future public HTML only
- **Rate / safety**: 1s wait between feed requests; max 100 net-new Pipeline records per run; ~8 auto Profile feeds + manual Search Queries
- **Language**: Vacancies predominantly Russian; Profile and query strings may be mixed RU/EN
- **Compatibility**: Must not break existing scanners or Pipeline schema for non-hh sources
- **Cost**: $0 marginal for RSS discovery (aligns with project’s low-cost positioning)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| RSS over HH API | API auth not available to user | — Pending |
| One RSS feed per Target Role (not one mega-OR query) | ~20 items/feed; clearer `Source Query`; less noise; matches JobSpy one-intent-per-row pattern | — Pending |
| Profile auto-feeds + Search Queries `HH RSS` overrides | Flexibility without editing workflow for experiments | — Pending |
| RSS-only descriptions in v1 | Ship scanner faster; Evaluator tolerates thinner text short-term | — Pending |
| Match Profile `Target Geography` | Consistent with 1a–1c; user selects RU geos explicitly | — Pending |
| No RU negative filters in scanner | User preference; Evaluator already enforces Profile negatives | — Pending |
| Schedule 8:20 daily | After 1a–1d (8:00–8:15), before Evaluator 9:00 | — Pending |
| Reject Playwright auto-apply parser | Out of scope for discovery pipeline | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 after initialization (hh.ru scanner milestone)*
