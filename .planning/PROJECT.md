# JobSignal Engine

## What This Is

JobSignal Engine is an autonomous job-search pipeline that treats your hunt like a sales pipeline: scheduled n8n workflows discover roles from ATS APIs and job boards, score them against your Airtable Profile, tailor CVs, prep interviews, and email you results before you open your laptop. You review and apply — the system does discovery and prep unattended.

**hh.ru** is now a fifth discovery source for the Russian job market (v1.0 shipped 2026-06-05). Scanner `01e` uses public RSS feeds (no HeadHunter API credentials), Profile-driven search queries, and the same Pipeline / Evaluator downstream path as scanners 1a–1d.

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
- ✓ hh.ru RSS scanner (`workflows/01e-scanner-hhru.json`) — v1.0
- ✓ RU Target Geography options and HH RSS Search Query columns in schema docs — v1.0
- ✓ Pipeline Source `hh.ru` with `-hhr` job IDs and 8:20 daily schedule — v1.0

### Active

- [ ] **HH-10**: Fetch full vacancy description from public vacancy HTML page (post-RSS enrichment)
- [ ] **HH-11**: Read Profile `Target Geography` dynamically in JobSpy 1d parse node (existing TODO in 01d)

### Out of Scope

- HeadHunter authenticated API (`hhru/api`) — user cannot obtain credentials; API docs are reference only for area IDs and field semantics
- Browser automation / auto-apply ([avkotau/hh.ru-parser](https://github.com/avkotau/hh.ru-parser)) — different product surface; apply remains manual
- hh.ru employer-only or application APIs
- Changing Evaluator, Tailor, Housekeeper, or Alerter behavior beyond accepting `hh.ru` as a new Source value
- Workflow 5 Optimizer (analytics) — pre-existing roadmap item, not this milestone
- Russian negative-filter heuristics in scanner parse nodes — rejected; Evaluator already uses Profile `Negative Filters`

## Context

**Brownfield:** Production codebase on branch `add-hh-ru`; scanners 1a–1e and evaluator pipeline are shipped. Codebase map lives in `.planning/codebase/`. hh.ru discovery uses RSS-first approach (API auth unavailable).

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
| RSS over HH API | API auth not available to user | ✓ Shipped in 01e |
| One RSS feed per Target Role (not one mega-OR query) | ~20 items/feed; clearer `Source Query`; less noise; matches JobSpy one-intent-per-row pattern | ✓ Shipped in 01e |
| Profile auto-feeds + Search Queries `HH RSS` overrides | Flexibility without editing workflow for experiments | ✓ Shipped in 01e |
| RSS-only descriptions in v1 | Ship scanner faster; Evaluator tolerates thinner text short-term | ✓ Shipped; HH-10 deferred |
| Match Profile `Target Geography` | Consistent with 1a–1c; user selects RU geos explicitly | ✓ Shipped in 01e |
| No RU negative filters in scanner | User preference; Evaluator already enforces Profile negatives | ✓ Shipped in 01e |
| Schedule 8:20 daily | After 1a–1d (8:00–8:15), before Evaluator 9:00 | ✓ Shipped in 01e |
| Reject Playwright auto-apply parser | Out of scope for discovery pipeline | ✓ Confirmed out of scope |

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
*Last updated: 2026-06-05 after v1.0 milestone*
